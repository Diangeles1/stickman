/**
 * Compilador de timeline: FightSpec (dados) -> Timeline (quadros resolvidos).
 *
 * E o coracao do motor. Roda UMA vez, fora do render, e produz tudo que os
 * componentes precisam para desenhar o quadro N sem guardar estado. Isso e o
 * que satisfaz a exigencia de determinismo do Remotion e, ao mesmo tempo, o
 * que permite descrever uma luta por JSON.
 *
 * Fluxo: beats -> para cada beat, avanca o cursor de quadros, escreve
 * quadros-chave nas trilhas dos lutadores, e emite impactos, camera e slow
 * motion. Quem desenha depois so interpola entre chaves.
 */

import { ATAQUES, escalaDuracao, knockbackEfetivo } from "../attacks/registry";
import { PRESETS } from "../characters/presets";
import { s } from "./time";
import { ALTURA_QUADRIL as ALTURA_DO_ESQUELETO } from "../characters/skeleton";
import {
  ALVO_PADRAO,
  POSE_DA_REACAO,
  REACAO_DO_PONTO,
  distanciaDeCombate,
  pontoDeContato,
  type PontoAlvo,
} from "./contact";
import type {
  AttackName,
  CameraKey,
  FightSpec,
  FighterId,
  FighterTrack,
  ImpactEvent,
  PoseName,
  ScheduledBeat,
  Timeline,
} from "./types";

/**
 * A distancia de combate NAO e mais uma constante.
 *
 * Ela e calculada por golpe, em distanciaDeCombate(), a partir de onde o membro
 * atacante realmente chega naquela pose. A constante anterior (543, vinda de um
 * multiplicador chutado) deixava o punho parando a 294 unidades do alvo: meio
 * corpo de distancia. O golpe era animado no vazio.
 *
 * Este valor sobrou so como distancia de espera, quando ninguem esta atacando.
 */
const DISTANCIA_DE_ESPERA = 620;

/**
 * Passo para tras na preparacao do golpe, em unidades de mundo.
 *
 * O atacante para um pouco ALEM da distancia de contato e volta durante o
 * disparo. E isso que faz o soco ter o corpo atras dele em vez de ser so um
 * braco que estica. Pequeno: 46 unidades e ~8% de uma altura de corpo.
 */
const RECUO_DA_CARGA = 46;

/**
 * Quadros que o alvo leva para entrar na pose de reacao depois do contato.
 * Dois: reacao a impacto e estalo. Mais que isso vira transicao, e transicao
 * le como "se moveu", nao como "levou".
 */
const QUADROS_DA_REACAO = 2;

/**
 * Altura do quadril, em coordenada de mundo (negativo = acima do chao).
 * Vem do esqueleto para nao existirem dois valores que possam divergir: foi
 * exatamente esse tipo de duplicacao que deixou o boneco flutuando antes.
 */
export const ALTURA_QUADRIL = -ALTURA_DO_ESQUELETO;

type Estado = {
  x: number;
  pose: PoseName;
  airborne: boolean;
};

export const compilar = (spec: FightSpec): Timeline => {
  const A = spec.fighterA;
  const B = spec.fighterB;
  const preset = { [A]: PRESETS[A], [B]: PRESETS[B] } as Record<FighterId, typeof PRESETS[FighterId]>;

  const tracks: Record<string, FighterTrack> = {
    [A]: { id: A, keys: [] },
    [B]: { id: B, keys: [] },
  };
  const estado: Record<string, Estado> = {
    [A]: { x: -DISTANCIA_DE_ESPERA, pose: "idle", airborne: false },
    [B]: { x: DISTANCIA_DE_ESPERA, pose: "idle", airborne: false },
  };

  const scheduled: ScheduledBeat[] = [];
  const impacts: ImpactEvent[] = [];
  const cameraKeys: CameraKey[] = [];
  const slowMo: Timeline["slowMo"] = [];

  let cursor = 0;

  const chave = (quem: FighterId, frame: number) => {
    const e = estado[quem];
    tracks[quem].keys.push({ frame, x: e.x, pose: e.pose, airborne: e.airborne });
  };

  // ambos comecam registrados, senao a interpolacao nao tem de onde partir
  chave(A, 0);
  chave(B, 0);

  const oposto = (quem: FighterId): FighterId => (quem === A ? B : A);

  /**
   * Leva o atacante ate a distancia de golpe PERCORRENDO o caminho.
   *
   * A primeira versao so atribuia a posicao nova, o que teletransportava o
   * personagem. O diagnostico pegou isso: o preto ia de -1073 para +37 em
   * 0,26s, ou seja piscava de um lado da arena para o outro.
   *
   * Agora o deslocamento vira tempo: ele corre ate lá, com pose de corrida, a
   * uma velocidade fixa. Devolve quantos quadros isso consumiu, para o
   * chamador avancar o cursor.
   */
  const VELOCIDADE_DE_CORRIDA = 26; // unidades de mundo por quadro

  const aproximar = (
    atacante: FighterId,
    alvo: FighterId,
    distanciaAlvo: number,
  ): number => {
    const lado = estado[atacante].x <= estado[alvo].x ? -1 : 1;
    const destino = estado[alvo].x + lado * distanciaAlvo;
    const distancia = Math.abs(destino - estado[atacante].x);

    // ja esta no alcance: nao gasta tempo
    if (distancia < distanciaAlvo * 0.2) {
      estado[atacante].x = destino;
      return 0;
    }

    const quadros = Math.max(s(0.12), Math.round(distancia / VELOCIDADE_DE_CORRIDA));

    // sai da pose atual correndo
    estado[atacante].pose = distancia > distanciaAlvo * 1.5 ? "sprint1" : "run1";
    chave(atacante, cursor);
    estado[atacante].x = destino;
    chave(atacante, cursor + quadros);

    // A camera acompanha a corrida. SEM isto ela ficava estacionada na ultima
    // coordenada (o diagnostico pegou: travada em x=-1162 por 1,5s enquanto o
    // lutador corria para +37, com os DOIS fora do quadro).
    cameraKeys.push({
      frame: cursor,
      center: { x: 0, y: ALTURA_QUADRIL - 60 },
      zoom: 0.95,
      ease: quadros,
      fit: true,
    });

    cursor += quadros;
    return quadros;
  };

  const duracaoDe = (quem: FighterId, move: AttackName) => {
    const a = ATAQUES[move];
    const k = escalaDuracao(preset[quem].profile.speed, spec.intensity);
    return {
      windup: Math.max(2, Math.round(a.windup * k)),
      strike: Math.max(2, Math.round(a.strike * k)),
      recover: Math.max(2, Math.round(a.recover * k)),
      contactAt: Math.max(1, Math.round(a.contactAt * k)),
      def: a,
    };
  };

  /** Um golpe completo: preparacao, disparo, contato com consequencia, volta. */
  const golpear = (
    atacante: FighterId,
    alvo: FighterId,
    move: AttackName,
    opcoes: {
      bloqueado?: boolean;
      finalizador?: boolean;
      ponto?: PontoAlvo;
    } = {},
  ) => {
    const { windup, strike, recover, contactAt, def } = duracaoDe(atacante, move);

    // O ponto atingido define a distancia E a reacao. Sem isso o golpe era
    // animado contra uma distancia fixa que o membro nao alcancava.
    const ponto: PontoAlvo = opcoes.ponto ?? ALVO_PADRAO[move] ?? "chest";
    const distancia = distanciaDeCombate(def, atacante, alvo, ponto);
    // Aproxima ate a posicao CARREGADA, um passo atras da distancia de
    // contato. Antes ele chegava na distancia de contato e o recuo era
    // aplicado como atribuicao no MESMO quadro: 46 unidades de teleporte, que
    // a derivada da amostragem lia como velocidade enorme e acendia linhas de
    // velocidade em cima do personagem parado.
    aproximar(atacante, alvo, distancia + RECUO_DA_CARGA);

    // ---- 1. ANTECIPACAO ---------------------------------------------------
    // o corpo recua um passo e CARREGA. O recuo e pequeno de proposito: o que
    // vende o golpe nao e o recuo, e ele voltar para frente no disparo.
    const lado: 1 | -1 = estado[atacante].x <= estado[alvo].x ? 1 : -1;
    // ele JA esta na posicao carregada; o passo a frente acontece no disparo
    const xNoContato = estado[atacante].x + lado * RECUO_DA_CARGA;
    // pose de CARGA, nao guarda: e ela que cria o arco que o punho percorre
    estado[atacante].pose = "coil";
    chave(atacante, cursor);
    // segura a carga ate o fim da preparacao. SEM esta chave o braco ja
    // comecava a se estender durante o windup, e o golpe nao tinha disparo.
    chave(atacante, cursor + windup);

    // O ALVO ENTRA EM GUARDA. Nao e enfeite: distanciaDeCombate() mede o ponto
    // atingido NA POSE DE GUARDA. Se o alvo estivesse em "advance" (que e como
    // ele saia da aproximacao), o peito dele estaria noutro lugar e a conta da
    // distancia seria sobre um corpo que nao existe na tela. Medido: 76
    // unidades de erro so por causa disso.
    if (estado[alvo].pose !== "guard" && !estado[alvo].airborne) {
      estado[alvo].pose = "guard";
      chave(alvo, cursor + Math.round(windup * 0.6));
    }
    if (def.tier === "extreme") {
      cameraKeys.push({
        frame: cursor,
        center: { x: (estado[atacante].x + estado[alvo].x) / 2, y: ALTURA_QUADRIL - 40 },
        zoom: opcoes.finalizador ? 1.7 : 1.35,
        ease: windup,
      });
      if (opcoes.finalizador) {
        // o ritmo cai antes do estouro: e o contraste que da forca
        slowMo.push({ from: cursor, to: cursor + windup, factor: 0.45 });
      }
    }
    cursor += windup;

    // ---- 2. DISPARO -------------------------------------------------------
    // A CORRECAO CENTRAL DO PROJETO.
    //
    // A pose cheia do golpe e marcada NO QUADRO DO CONTATO, nao no inicio do
    // disparo. Antes ela era marcada no inicio; como a amostragem interpola
    // ate a chave seguinte (a guarda da recuperacao), no quadro do contato o
    // punho ja estava METADE do caminho de volta:
    //
    //   antes:  |--windup--|X.........contato.........|guarda|
    //                      ^ extensao maxima aqui, cedo demais
    //   agora:  |--windup--|.........X contato .......|guarda|
    //                                ^ extensao maxima EXATAMENTE no contato
    //
    // Era dai que vinham as 294 unidades que faltavam, e nao da distancia.
    const frameContato = cursor + contactAt;
    const direcao = lado;
    estado[atacante].pose = def.pose;
    // o passo a frente entra DENTRO do golpe: o peso do corpo vai junto
    estado[atacante].x = xNoContato;
    chave(atacante, frameContato);

    // ---- 3. CONTATO -------------------------------------------------------
    // segura a extensao por alguns quadros. Sem isto o quadro seguinte ao
    // contato ja estava voltando, e o impacto passava sem ser lido.
    const parada = Math.max(1, Math.min(s(0.05), strike - contactAt - 1));
    chave(atacante, frameContato + parada);

    // ONDE O MEMBRO REALMENTE CHEGA. O flash, a onda e as particulas nascem
    // daqui, e nao de um deslocamento fixo em relacao ao alvo.
    const contato = pontoDeContato(
      def,
      atacante,
      estado[atacante].x,
      direcao,
      ALTURA_DO_ESQUELETO,
    );

    // ultimo quadro em que o ALVO recebe chave nesta sequencia. O compilador
    // precisa saber disso: a volta para a guarda era escrita em cursor+strike,
    // que cai ANTES do fim do voo. Chave fora de ordem e invisivel no
    // TypeScript e some com o knockback inteiro na hora de amostrar.
    let fimDaReacao = frameContato;

    if (opcoes.bloqueado) {
      // sobe a guarda pouco antes: a defesa e uma reacao, precisa de tempo
      chave(alvo, frameContato - s(0.14));
      estado[alvo].pose = "block";
      chave(alvo, frameContato - 2);
      impacts.push({
        frame: frameContato,
        at: contato,
        // bloqueio nao e golpe limpo: um degrau abaixo na intensidade
        tier: def.tier === "extreme" ? "medium" : "light",
        direction: direcao,
        hitStop: Math.max(1, Math.round(def.hitStop * 0.6)),
        cracksGround: false,
        sound: "block",
        victim: alvo,
      });
    } else {
      impacts.push({
        frame: frameContato,
        at: contato,
        tier: def.tier,
        direction: direcao,
        hitStop: def.hitStop,
        cracksGround: Boolean(def.cracksGround),
        sound: def.sound,
        victim: alvo,
      });

      const voa = Boolean(def.launches) || def.tier === "extreme";

      // knockback em unidades de MUNDO, cortado no teto da intensidade
      // (ver TETO_KNOCKBACK). Sem o teto o finalizador jogava o alvo para fora
      // do cenario e a composicao se desfazia.
      const empurrao = knockbackEfetivo(
        def.knockback,
        def.tier,
        preset[atacante].profile.power,
      );
      const voo = Math.round(strike * (voa ? 3.2 : 1.6));
      const xAntes = estado[alvo].x;

      // ==== REACAO EM QUATRO FASES ==========================================
      // A versao anterior tinha duas: dobrava e depois era empurrada. O corpo
      // ficava dobrado e PARADO por 0,1s antes de sair, e as duas coisas liam
      // como eventos separados em vez de uma consequencia da outra.

      // FASE 0 - INTEIRO ate o contato. Sem esta chave a interpolacao vinha da
      // ultima chave dele, la atras, e ele comecava a se dobrar quase um
      // segundo ANTES de ser atingido: reagia ao golpe que ainda nao saira.
      chave(alvo, frameContato);

      // FASE 1 - ABSORCAO. O corpo dobra em torno do golpe e JA comeca a ser
      // deslocado: o impulso age no contato, nao depois dele. Dois quadros com
      // curva de estalo (ver curvaPara): reacao a impacto nao e transicao.
      estado[alvo].pose = POSE_DA_REACAO[REACAO_DO_PONTO[ponto]];
      estado[alvo].x = xAntes + direcao * empurrao * 0.1;
      chave(alvo, frameContato + QUADROS_DA_REACAO);

      // FASE 2 - o corpo continua dobrado enquanto escorrega. E o que separa
      // "sentiu o golpe" de "foi empurrado": ele sente E anda ao mesmo tempo.
      estado[alvo].x = xAntes + direcao * empurrao * 0.34;
      chave(alvo, frameContato + s(0.1));

      // FASE 3 - DESLOCAMENTO. Agora sim a pose de empurrado, com o resto do
      // caminho. A curva saidaRapida da a desaceleracao de corpo com massa.
      estado[alvo].pose = voa ? "airborne" : "knockback";
      estado[alvo].airborne = voa;
      estado[alvo].x = xAntes + direcao * empurrao;
      chave(alvo, frameContato + voo);
      fimDaReacao = frameContato + voo;

      // FASE 4 - FREADA. Ele planta o pe de tras e para de deslizar. Antes o
      // corpo empurrado voltava direto para a guarda, o que le como
      // "teleportou de volta ao normal" e joga fora o peso do golpe.
      if (!voa) {
        estado[alvo].pose = "stagger";
        // escorrega um pouco mais enquanto freia: a freada tem custo
        estado[alvo].x = xAntes + direcao * empurrao * 1.08;
        chave(alvo, frameContato + voo + s(0.13));
        // segura a freada: o corpo respira antes de voltar a guarda
        chave(alvo, frameContato + voo + s(0.3));
        fimDaReacao = frameContato + voo + s(0.3);
      }

      if (voa) {
        // POUSO EM QUATRO TEMPOS. Trocar direto para "downed" fazia o corpo
        // mudar de pose de um quadro para o outro, o que le como troca de
        // desenho e nao como queda.
        estado[alvo].airborne = false;
        estado[alvo].pose = "land";          // 1. toca o chao
        chave(alvo, frameContato + voo + s(0.05));

        estado[alvo].pose = "squash";        // 2. o corpo comprime
        estado[alvo].x += direcao * empurrao * 0.1;
        chave(alvo, frameContato + voo + s(0.14));

        estado[alvo].pose = "land";          // 3. quique curto de volta
        chave(alvo, frameContato + voo + s(0.24));

        estado[alvo].pose = "downed";        // 4. acomoda no chao
        estado[alvo].x += direcao * empurrao * 0.05;
        chave(alvo, frameContato + voo + s(0.46));
        fimDaReacao = frameContato + voo + s(0.46);
      }

      cameraKeys.push({
        frame: frameContato,
        center: { x: estado[alvo].x, y: ALTURA_QUADRIL - 60 },
        zoom: def.tier === "extreme" ? 0.85 : 1.1,
        ease: def.tier === "extreme" ? 8 : 5,
        shake: def.tier === "extreme" ? 46 : def.tier === "medium" ? 24 : 10,
        // o corpo voa longe: sem plano de dois o outro sai do quadro
        fit: true,
      });

      // no golpe extremo a camera ACOMPANHA o corpo voando (item 11), em vez
      // de so enquadrar os dois de longe
      if (def.tier === "extreme") {
        cameraKeys.push({
          frame: frameContato + Math.round(strike * 0.8),
          center: { x: 0, y: ALTURA_QUADRIL - 80 },
          zoom: 0.78,
          ease: Math.round(strike * 1.6),
          follow: alvo,
        });
      }
    }

    cursor += strike;

    // recuperacao: a camera volta para o plano de dois (o briefing pede
    // "voltar para plano aberto quando necessario"). Isso tambem e a rede de
    // seguranca contra a camera parar numa coordenada velha.
    cameraKeys.push({
      frame: cursor,
      center: { x: 0, y: ALTURA_QUADRIL - 60 },
      zoom: 0.95,
      ease: Math.max(s(0.1), Math.round(recover * 0.7)),
      fit: true,
    });

    // O ATACANTE TAMBEM REAGE AO PROPRIO GOLPE. Ele ficava plantado na
    // posicao do contato enquanto o braco voltava sozinho, o que le como
    // braco de manequim. Agora o corpo recua junto com o braco: e a
    // continuacao do passo que ele deu para golpear.
    estado[atacante].pose = "guard";
    estado[atacante].x -= lado * RECUO_DA_CARGA * 0.55;
    chave(atacante, cursor);

    // O alvo so volta a guarda DEPOIS que a reacao termina. A versao anterior
    // escrevia esta chave em cursor+strike, que para um soco cai 13 quadros
    // ANTES do fim do voo: a chave saia fora de ordem e a amostragem, que
    // percorre as chaves em sequencia, simplesmente pulava o knockback.
    const voltaDoAlvo = Math.max(cursor, fimDaReacao + s(0.08));
    if (!opcoes.bloqueado) {
      // quem caiu no chao NAO levanta sozinho: isso e um beat de getUp
      if (estado[alvo].pose !== "downed") {
        estado[alvo].pose = estado[alvo].airborne ? "airborne" : "guard";
        chave(alvo, voltaDoAlvo);
      }
    }

    // o cursor nao pode terminar antes da ultima chave escrita, senao o
    // proximo beat escreve no passado
    cursor = Math.max(cursor + recover, voltaDoAlvo);
  };

  for (const beat of spec.beats) {
    const inicio = cursor;

    switch (beat.type) {
      case "approach": {
        const e = estado[beat.who];
        e.pose = "run1";
        chave(beat.who, cursor);
        e.x = beat.toX;
        e.pose = "run2";
        chave(beat.who, cursor + beat.duration);
        // o oponente tambem se move, senao um corre e o outro fica plantado
        const outro = oposto(beat.who);
        estado[outro].pose = "advance";
        chave(outro, cursor);
        estado[outro].x += (beat.toX > estado[outro].x ? -1 : 1) * 60;
        chave(outro, cursor + beat.duration);
        cameraKeys.push({
          frame: cursor,
          center: { x: 0, y: ALTURA_QUADRIL - 40 },
          zoom: 0.92,
          ease: beat.duration,
          fit: true,
        });
        cursor += beat.duration;
        break;
      }

      case "attack":
        golpear(beat.attacker, beat.target, beat.move, { ponto: beat.targetPoint });
        break;

      case "blocked":
        golpear(beat.attacker, beat.target, beat.move, {
          bloqueado: true,
          ponto: beat.targetPoint,
        });
        break;

      case "combo": {
        // o combo muda a posicao entre golpes sozinho (aproximar() roda em
        // cada golpe), que e o que o briefing pede
        beat.moves.forEach((move, i) => {
          const ultimo = i === beat.moves.length - 1;
          golpear(beat.attacker, beat.target, move, { bloqueado: !ultimo });
        });
        break;
      }

      case "dodge": {
        estado[beat.who].pose = "dodge";
        chave(beat.who, cursor);
        estado[beat.who].x += (estado[beat.who].x < 0 ? -1 : 1) * 80;
        chave(beat.who, cursor + beat.duration);
        cameraKeys.push({
          frame: cursor,
          center: { x: estado[beat.who].x, y: ALTURA_QUADRIL - 70 },
          zoom: 1.3,
          ease: 4,
        });
        // esquiva extrema em camera lenta: momento de leitura
        slowMo.push({ from: cursor, to: cursor + beat.duration, factor: 0.5 });
        estado[beat.who].pose = "guard";
        chave(beat.who, cursor + beat.duration + 2);
        cursor += beat.duration;
        break;
      }

      case "knockback": {
        estado[beat.who].pose = "knockback";
        chave(beat.who, cursor);
        estado[beat.who].x += (estado[beat.who].x < 0 ? -1 : 1) * beat.distance;
        chave(beat.who, cursor + beat.duration);
        estado[beat.who].pose = "guard";
        chave(beat.who, cursor + beat.duration + 4);
        cursor += beat.duration;
        break;
      }

      case "powerUp": {
        estado[beat.who].pose = "charge";
        chave(beat.who, cursor);
        chave(beat.who, cursor + beat.duration);
        cameraKeys.push({
          frame: cursor,
          center: { x: estado[beat.who].x, y: ALTURA_QUADRIL - 60 },
          zoom: 1.2,
          ease: Math.round(beat.duration * 0.6),
          // segue de verdade: a aura acontece enquanto ele ainda escorrega
          follow: beat.who,
        });
        cursor += beat.duration;
        break;
      }

      case "airborne": {
        estado[beat.who].airborne = true;
        estado[beat.who].pose = "airborne";
        chave(beat.who, cursor);
        chave(beat.who, cursor + beat.duration);
        estado[beat.who].airborne = false;
        estado[beat.who].pose = "land";
        chave(beat.who, cursor + beat.duration + 4);
        cursor += beat.duration;
        break;
      }

      case "recover": {
        // LEVANTAR SO SE ELE CAIU. Antes este beat forcava a pose getUp
        // sempre, e getUp tem o quadril agachado: um lutador que apenas levou
        // um soco em pe agachava e se levantava, o que conta ao espectador uma
        // queda que nunca aconteceu.
        const caido = estado[beat.who].pose === "downed";
        if (caido) {
          estado[beat.who].pose = "getUp";
          chave(beat.who, cursor + Math.round(beat.duration * 0.45));
        } else {
          // quem esta de pe apenas se recompoe: segura a pose atual um
          // instante e volta a guarda. E um respiro, nao uma queda.
          chave(beat.who, cursor + Math.round(beat.duration * 0.25));
        }
        estado[beat.who].pose = "guard";
        chave(beat.who, cursor + beat.duration);
        cursor += beat.duration;
        break;
      }

      case "finisher":
        golpear(beat.attacker, beat.target, beat.move, {
          finalizador: true,
          ponto: beat.targetPoint,
        });
        break;

      case "hold":
      case "cta":
      case "hook":
        cursor += beat.duration;
        break;
    }

    scheduled.push({ beat, from: inicio, to: cursor });
  }

  // chave final para a interpolacao nao ficar sem destino no ultimo quadro
  chave(A, cursor);
  chave(B, cursor);

  return {
    spec,
    durationInFrames: Math.max(1, cursor),
    scheduled,
    impacts,
    cameraKeys,
    tracks,
    slowMo,
  };
};
