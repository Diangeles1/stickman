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
  AimEvent,
  Beat,
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
 *
 * Baixado de 620 para 380 porque 620 punha os dois a 1240 de distancia no
 * quadro ZERO: nem no zoom minimo eles cabiam, e o primeiro quadro do video (o
 * que decide se alguem continua assistindo) saia com os dois cortados nas
 * bordas. Com 380 o plano de dois abre com os dois inteiros.
 */
const DISTANCIA_DE_ESPERA = 380;

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
 *
 * Eram dois, e em dois quadros o corpo inteiro trocava de pose junto: nao
 * havia onde a onda do impacto (cabeca, depois tronco, depois pernas)
 * acontecer. Com cinco, a REGIAO atingida ainda reage no primeiro quadro (a
 * janela dela e curta e a curva e de estalo), e o resto do corpo chega depois.
 */
const QUADROS_DA_REACAO = 5;

/**
 * Quadros que qualquer troca de pose IMPORTANTE ganha para acontecer.
 *
 * Existe porque duas chaves no mesmo quadro sao lidas pela amostragem como
 * corte seco, e o diagnostico achou quatro dessas colisoes numa luta de dois
 * segundos, incluindo "run1 -> coil": a corrida virava carga de golpe num
 * unico quadro. A diretiva e explicita: nenhuma animacao troca
 * instantaneamente.
 */
const QUADROS_DE_TRANSICAO = 4;

/**
 * Distancia em que os dois ficam frente a frente sem estar golpeando.
 *
 * Escolhida pela CAMERA, nao pelo combate: com 420 de separacao o plano de
 * dois cabe em zoom 1.04, ou seja o corpo ocupa 32% da altura da tela. Acima
 * de ~600 a camera tem que abrir abaixo do piso legivel e passa a cortar um
 * dos dois.
 */
const DISTANCIA_NEUTRA = 420;

/**
 * Altura do quadril, em coordenada de mundo (negativo = acima do chao).
 * Vem do esqueleto para nao existirem dois valores que possam divergir: foi
 * exatamente esse tipo de duplicacao que deixou o boneco flutuando antes.
 */
export const ALTURA_QUADRIL = -ALTURA_DO_ESQUELETO;

/** Golpes que acontecem no ar: o atacante pula para golpear. */
const GOLPES_AEREOS = new Set<PoseName>(["airAttack", "diveAttack"]);

/**
 * Lutador ARMADO nao luta de guarda de boxe: estas poses sao trocadas pelas
 * de katana na hora de escrever a chave. O resto do compilador continua
 * pensando em "guard", "block" e "coil", e nao precisa saber da espada.
 */
const POSES_ARMADAS: Partial<Record<PoseName, PoseName>> = {
  guard: "guardaKatana",
  idle: "guardaKatana",
  block: "bloqueioKatana",
  coil: "cargaKatana",
};
/**
 * Tempo no ar do pulo de ataque, em quadros. 0,65s da ~190 unidades de
 * altura com a gravidade do mundo: o golpe vem DE CIMA (com 0,55s o pulo
 * mal tirava a cabeca da altura da do outro), e o membro ainda alcanca o
 * peito descendo.
 */
const TEMPO_NO_AR = s(0.65);

/**
 * PERSONALIDADE NA FISICA: o mesmo golpe, com outro corpo.
 *
 * A diferenca entre os lutadores era so a duracao dos golpes e a forca do
 * empurrao. Aqui ela entra na FORMA do movimento, derivada do perfil de cada
 * um (presets): o forte joga mais peso para tras antes de bater, carrega mais
 * fundo, continua girando mais depois do contato e demora mais para se
 * recompor; o rapido faz tudo mais compacto e volta logo para a guarda.
 */
const perfilDeMovimento = (quem: FighterId) => {
  const { speed, power } = PRESETS[quem].profile;
  return {
    /** fracao do recuo da carga que o peso vai para tras na antecipacao */
    recuoDoPeso: 0.2 + 0.35 * power,
    /** exagero da carga no fim da preparacao (1 = pose escrita) */
    carga: 1.04 + 0.16 * power,
    /** o quanto o corpo continua depois do contato (0 a ~1,2) */
    seguimento: 0.4 + 0.8 * power,
    /** fracao da recuperacao gasta para recolher o membro */
    recolher: 0.22 + 0.4 * (1 - speed),
  };
};

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
  const aims: AimEvent[] = [];
  const cameraKeys: CameraKey[] = [];
  const slowMo: Timeline["slowMo"] = [];
  const camaraLenta: Timeline["camaraLenta"] = [];
  const poderes: Timeline["poderes"] = [];

  let cursor = 0;

  const chave = (quem: FighterId, frame: number, exagero?: number) => {
    const e = estado[quem];
    // Chave fora de ordem e invisivel no TypeScript e apaga um trecho inteiro
    // na amostragem (ja sumiu com um knockback assim). Nunca antes da ultima.
    const keys = tracks[quem].keys;
    if (keys.length > 0) frame = Math.max(frame, keys[keys.length - 1].frame);
    tracks[quem].keys.push({
      frame,
      x: e.x,
      // lutador armado: a guarda, a defesa e a carga viram as de katana
      pose: spec.armas?.[quem] ? (POSES_ARMADAS[e.pose] ?? e.pose) : e.pose,
      airborne: e.airborne,
      ...(exagero !== undefined && exagero !== 1 ? { exagero } : {}),
    });
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

    // ja esta no lugar
    if (distancia < 2) {
      estado[atacante].x = destino;
      return 0;
    }

    // DISTANCIA CURTA: um passo de ajuste, nao uma corrida. A versao anterior
    // teleportava ate 20% da distancia de combate (medido: 48 unidades num
    // quadro) e, acima disso, disparava uma corrida de poucos quadros a quase
    // o dobro da velocidade de corrida: o lutador parava, arrancava de novo e
    // tombava 45 graus para frente. Ajuste curto e um passo, e os pes
    // plantados fazem o passo acontecer.
    if (distancia < 170) {
      const quadrosDoPasso = Math.max(s(0.16), Math.round(distancia / 11));
      chave(atacante, cursor);
      estado[atacante].pose = "advance";
      estado[atacante].x = destino;
      chave(atacante, cursor + quadrosDoPasso);
      cursor += quadrosDoPasso;
      return quadrosDoPasso;
    }

    const quadros = Math.max(s(0.12), Math.round(distancia / VELOCIDADE_DE_CORRIDA));

    // ---- SAIDA DA PARADA ---------------------------------------------------
    // Uma chave com a pose ATUAL no quadro em que ele comeca a andar. Sem ela,
    // a pose de corrida era escrita no mesmo quadro da pose anterior e virava
    // corte seco: o diagnostico acusava "idle -> run1" no quadro 0.
    chave(atacante, cursor);

    // ---- CORRIDA -----------------------------------------------------------
    // A desaceleracao come os ultimos quadros: sem ela ele corria em
    // velocidade cheia e a pose de carga era escrita no MESMO quadro da
    // chegada ("run1 -> coil" no quadro 29), o que le como freada instantanea.
    const travagem = Math.min(s(0.2), Math.max(s(0.07), Math.round(quadros * 0.4)));
    const corrida = Math.max(1, quadros - travagem);

    estado[atacante].pose = distancia > distanciaAlvo * 1.5 ? "sprint1" : "run1";
    chave(atacante, cursor + 1);
    // O trecho de corrida cobre a fracao do caminho PROPORCIONAL ao tempo
    // dele (um pouco mais, porque a travagem e mais lenta). Fixo em 88%, a
    // corrida curta saia a 1,5 vez a velocidade de corrida.
    const fracao = Math.min(0.88, (corrida / quadros) * 1.15);
    estado[atacante].x = estado[atacante].x + (destino - estado[atacante].x) * fracao;
    chave(atacante, cursor + corrida);

    // ---- DESACELERACAO -----------------------------------------------------
    // Os ultimos 12% do caminho em pose de passo, gastando o tempo da
    // travagem. A inclinacao procedural faz o corpo tombar para TRAS sozinho,
    // porque a aceleracao fica negativa aqui (ver inclinacaoDoCorpo).
    estado[atacante].pose = "advance";
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
      /** o alvo sai do caminho: golpe completo, nenhum impacto */
      esquivado?: boolean;
      finalizador?: boolean;
      ponto?: PontoAlvo;
      /**
       * Golpe que VEM de outro no mesmo combo: a recuperacao do anterior e a
       * preparacao deste. Sem peso para tras e com metade da carga.
       */
      encadeado?: boolean;
      /**
       * Outro golpe do combo vem depois deste: ninguem se afasta, quem
       * defende segura a guarda, e a volta e curta, porque ela ja e a
       * preparacao do proximo.
       */
      continua?: boolean;
      /**
       * O mesmo atacante golpeia de novo em seguida (o beat seguinte e dele):
       * ele NAO volta para a distancia neutra. Um golpe que passou vira o
       * embalo do proximo; recuar entre os dois jogava fora essa logica.
       */
      mantemPressao?: boolean;
      /** esquiva pulando por cima (corte baixo) */
      pulo?: boolean;
    } = {},
  ) => {
    const duracoes = duracaoDe(atacante, move);
    const { recover, contactAt, def } = duracoes;
    const aereo = GOLPES_AEREOS.has(def.pose);
    // o golpe aereo dura o pulo inteiro, nao o disparo de um golpe no chao
    const strike = aereo
      ? Math.max(duracoes.strike, 3 + TEMPO_NO_AR + 3)
      : duracoes.strike;
    // COMBO QUE FLUI: o golpe encadeado nao volta a guarda para carregar do
    // zero. Soco, guarda, soco, guarda e o que a diretiva chama de combo
    // robotico; aqui o braco que volta de um golpe ja e a carga do outro.
    // O FINALIZADOR carrega quase o dobro: e o golpe mais importante da luta,
    // e a preparacao longa (com a camera lenta que o acompanha) e o que faz
    // o espectador saber que ele vem. Com a carga de um golpe comum, o giro
    // do preto cabia em 7 quadros e o finalizador parecia um chute qualquer.
    const windup = opcoes.encadeado
      ? Math.max(3, Math.round(duracoes.windup * 0.45))
      : opcoes.finalizador
        ? Math.round(duracoes.windup * 1.8)
        : duracoes.windup;

    // O ponto atingido define a distancia E a reacao. Sem isso o golpe era
    // animado contra uma distancia fixa que o membro nao alcancava.
    const ponto: PontoAlvo = opcoes.ponto ?? ALVO_PADRAO[move] ?? "chest";
    const distancia = distanciaDeCombate(def, atacante, alvo, ponto);
    // Aproxima ate a posicao CARREGADA, um passo atras da distancia de
    // contato. Antes ele chegava na distancia de contato e o recuo era
    // aplicado como atribuicao no MESMO quadro: 46 unidades de teleporte, que
    // a derivada da amostragem lia como velocidade enorme e acendia linhas de
    // velocidade em cima do personagem parado.
    if (opcoes.encadeado) {
      // No combo o ajuste de distancia acontece DENTRO da carga (a chave da
      // carga leva o corpo ate la), e nao num passo separado: com um passo
      // entre cada golpe, o lutador ia e voltava e tres socos levavam 1,2 s.
      const ladoDoAtaque = estado[atacante].x <= estado[alvo].x ? -1 : 1;
      // sem o passo inteiro de carga: o golpe encadeado sai de onde o
      // anterior deixou o corpo, e so o ajuste de distancia entre um golpe e
      // outro acontece aqui. Com o recuo inteiro, o lutador ia e voltava a
      // cada soco do combo.
      estado[atacante].x =
        estado[alvo].x + ladoDoAtaque * (distancia + RECUO_DA_CARGA * 0.25);
    } else {
      aproximar(atacante, alvo, distancia + RECUO_DA_CARGA);
    }

    // ---- 1. ANTECIPACAO ---------------------------------------------------
    // Tres tempos, e e a ordem que um lutador segue:
    //
    //   a. o PESO VAI PARA TRAS: o corpo recua um pouco enquanto enrola
    //      (carga). Antes o corpo andava para FRENTE durante a preparacao, ou
    //      seja a antecipacao ia no mesmo sentido do golpe e nao antecipava
    //      nada.
    //   b. O PASSO: ainda enrolado, e carregando mais fundo (moving hold, a
    //      pose nao congela), o corpo avanca e o pe da frente planta (ver pes
    //      plantados). Quanto mais forte o lutador, mais fundo ele carrega.
    //   c. o DISPARO (mais abaixo) e so a corrente: com o pe ja plantado, o
    //      quadril gira, o tronco gira, o ombro vem, e o punho chega por
    //      ultimo. Deslocando o corpo durante o disparo, a translacao
    //      dominava a velocidade de todas as juntas e o golpe virava um bloco
    //      empurrado para frente (medido com scripts/cadeia.mts).
    const lado: 1 | -1 = estado[atacante].x <= estado[alvo].x ? 1 : -1;
    const perfil = perfilDeMovimento(atacante);
    const xNoContato =
      estado[atacante].x + lado * RECUO_DA_CARGA * (opcoes.encadeado ? 0.25 : 1);
    estado[atacante].pose = def.carga ?? "coil";
    if (!opcoes.encadeado) {
      estado[atacante].x -= lado * RECUO_DA_CARGA * perfil.recuoDoPeso;
    }
    // A chave sai alguns quadros DEPOIS do cursor: no mesmo quadro ela
    // colidia com a chave de chegada da aproximacao e virava corte seco.
    const cargaPronta =
      cursor + Math.max(1, Math.min(windup - 1, Math.round(windup * 0.6)));
    chave(atacante, cargaPronta);
    // golpe AEREO: o corpo fica agachado onde esta; o avanco e o proprio pulo
    if (!aereo) estado[atacante].x = xNoContato;
    chave(atacante, cursor + windup, windup >= 3 ? perfil.carga : 1);

    // O ALVO ENTRA EM GUARDA. Nao e enfeite: distanciaDeCombate() mede o ponto
    // atingido NA POSE DE GUARDA. Se o alvo estivesse em "advance" (que e como
    // ele saia da aproximacao), o peito dele estaria noutro lugar e a conta da
    // distancia seria sobre um corpo que nao existe na tela. Medido: 76
    // unidades de erro so por causa disso.
    // (no meio de um combo bloqueado ele JA esta defendendo: segura a defesa)
    const segueDefendendo = opcoes.bloqueado && estado[alvo].pose === "block";
    if (estado[alvo].pose !== "guard" && !estado[alvo].airborne && !segueDefendendo) {
      estado[alvo].pose = "guard";
      chave(alvo, cursor + Math.round(windup * 0.6));
    }
    if (def.tier === "extreme") {
      cameraKeys.push({
        frame: cursor,
        center: { x: (estado[atacante].x + estado[alvo].x) / 2, y: ALTURA_QUADRIL - 40 },
        // golpe que vai ser esquivado nao fecha tanto: o quadro precisa caber
        // o corpo que SAI do caminho, senao a esquiva acontece fora da tela
        // o finalizador fecha o MAXIMO que ainda cabe os dois: a 1.7 fixo a
        // preparacao inteira acontecia com o alvo fora do quadro
        zoom: opcoes.finalizador
          ? Math.min(
              1.7,
              1080 / (Math.abs(estado[atacante].x - estado[alvo].x) + 380),
            )
          : opcoes.esquivado
            ? 1.08
            : 1.35,
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
    // GOLPE AEREO: agacha (a carga acima), DECOLA, golpeia ja descendo e
    // pousa. O golpe acontece depois do topo do pulo: e a queda que da peso a
    // ele. A altura sai do tempo no ar (ver alturaDoVoo).
    let frameContato = cursor + contactAt;
    let pouso = 0;
    if (aereo) {
      // decola AINDA CARREGADO (a pose de carga, no ar): o braco que vai
      // golpear fica guardado ate o disparo. Com a pose de pulo (bracos para
      // cima), o movimento mais rapido do golpe era o braco subindo na
      // decolagem, e o soco em si saia mais lento que ela.
      estado[atacante].pose = "coil";
      estado[atacante].airborne = true;
      chave(atacante, cursor + 3, perfil.carga);
      frameContato = cursor + 3 + Math.round(TEMPO_NO_AR * 0.6);
      pouso = cursor + 3 + TEMPO_NO_AR;
    }
    const direcao = lado;
    estado[atacante].pose = def.pose;
    if (aereo) estado[atacante].x = xNoContato;
    chave(atacante, frameContato);

    // ---- 3. CONTATO E FOLLOW-THROUGH -------------------------------------
    // O golpe nao para no contato. O membro continua (a mira empurra a ponta
    // alem do ponto, ver AimEvent.avanco) e o CORPO continua girando alem da
    // pose do golpe: e a massa que nao para de uma vez. Quanto mais pesado o
    // lutador, mais longe o corpo vai. Antes esta chave so segurava a pose, e
    // o corpo parava no quadro do contato como se batesse numa parede.
    //
    // No golpe ESQUIVADO o corpo vai bem mais longe: nao havia nada para
    // parar o golpe, e o atacante se desequilibra para frente. E essa
    // abertura que da ao outro o contra-ataque.
    const parada = Math.max(1, Math.min(s(0.05), strike - contactAt - 1));
    const alem = opcoes.esquivado ? 2.2 : 1;
    estado[atacante].x += lado * RECUO_DA_CARGA * 0.2 * perfil.seguimento * alem;
    chave(atacante, frameContato + parada, 1 + 0.18 * perfil.seguimento * alem);
    if (aereo) {
      // pousa um pouco a frente, agachado: o pouso absorve a queda
      estado[atacante].pose = "land";
      estado[atacante].airborne = false;
      estado[atacante].x += lado * RECUO_DA_CARGA * 0.6;
      chave(atacante, Math.max(pouso, frameContato + parada + 2));
    }

    // ONDE O MEMBRO REALMENTE CHEGA. O flash, a onda e as particulas nascem
    // daqui, e nao de um deslocamento fixo em relacao ao alvo.
    // Golpe BLOQUEADO encosta na guarda, nao no ponto mirado: o punho que ia
    // na cabeca bate no antebraco que esta na frente dela.
    const pontoTocado: PontoAlvo = opcoes.bloqueado ? "guarda" : ponto;
    const contato = pontoDeContato(
      pontoTocado,
      alvo,
      estado[alvo].x,
      // o alvo olha para o lado contrario ao do golpe
      (-direcao) as 1 | -1,
      opcoes.bloqueado ? "block" : "guard",
    );

    // ---- MIRA ------------------------------------------------------------
    // O compilador declara a INTENCAO: esta junta tem que encostar neste
    // ponto neste quadro. Quem desenha resolve por cinematica inversa.
    //
    // A distancia de combate ja resolve o eixo horizontal por construcao, mas
    // o vertical vinha da pose: medido, o punho acertava 58 unidades abaixo do
    // peito e a correcao era mexer nos numeros da pose a mao. Isso nao escala
    // para 16 ataques vezes 5 pontos de alvo.
    aims.push({
      who: atacante,
      joint: def.contactJoint,
      alvo,
      ponto: pontoTocado,
      contact: frameContato,
      // entra durante o disparo e sai depois de segurar o contato
      from: cursor,
      to: frameContato + parada + s(0.1),
      direcao,
      // golpe mais pesado passa mais alem: e a massa do membro que continua
      avanco: def.tier === "extreme" ? 54 : def.tier === "medium" ? 34 : 20,
      ...(def.seguimento
        ? {
            direcaoDoAvanco: {
              x: def.seguimento.x / Math.hypot(def.seguimento.x, def.seguimento.y),
              y: def.seguimento.y / Math.hypot(def.seguimento.x, def.seguimento.y),
            },
          }
        : {}),
      // na esquiva o alvo comeca a sair s(0.2) antes do contato (ver abaixo):
      // a mira fica no lugar onde ele estava nesse instante
      ...(opcoes.esquivado ? { congelarEm: frameContato - s(0.2) } : {}),
      ...(def.lamina ? { recuo: def.lamina } : {}),
    });

    // ultimo quadro em que o ALVO recebe chave nesta sequencia. O compilador
    // precisa saber disso: a volta para a guarda era escrita em cursor+strike,
    // que cai ANTES do fim do voo. Chave fora de ordem e invisivel no
    // TypeScript e some com o knockback inteiro na hora de amostrar.
    let fimDaReacao = frameContato;
    /** quadro em que o corpo empurrado termina de se deslocar (ou pousa) */
    let fimDoDeslocamento = frameContato;

    if (opcoes.esquivado) {
      // ==== GOLPE QUE PASSA =================================================
      // Nenhum ImpactEvent: sem impacto nao ha flash, tremor, som nem reacao,
      // e e exatamente isso que faz a esquiva valer alguma coisa.
      //
      // O alvo sai ANTES do quadro do contato. Se saisse no contato, o olho
      // leria "acertou e ele se mexeu depois"; saindo antes, le "ele viu
      // vindo". A mira continua apontando para onde ele ESTAVA, entao o punho
      // atravessa o espaco vazio, que e a leitura certa de um golpe errado.
      chave(alvo, frameContato - s(0.2));

      if (opcoes.pulo) {
        // CORTE BAIXO: o alvo agacha e PULA; a lamina passa por baixo dos pes
        estado[alvo].pose = "coil";
        chave(alvo, frameContato - s(0.14));
        estado[alvo].pose = "jump";
        estado[alvo].airborne = true;
        chave(alvo, frameContato - s(0.1));
        estado[alvo].pose = "airborne";
        chave(alvo, frameContato + s(0.22));
        estado[alvo].pose = "land";
        estado[alvo].airborne = false;
        chave(alvo, frameContato + s(0.3));
        estado[alvo].pose = "guard";
        chave(alvo, frameContato + s(0.46));
        fimDaReacao = frameContato + s(0.46);
      } else {
      // golpe na cabeca se esquiva ABAIXANDO; no corpo, jogando o peso para
      // tras. Duas leituras diferentes para dois golpes diferentes.
      estado[alvo].pose = ponto === "head" ? "duck" : "dodge";
      const saida = ponto === "head" ? 40 : 150;
      estado[alvo].x += direcao * saida;
      chave(alvo, frameContato - s(0.03));
      // segura a esquiva enquanto o punho passa
      chave(alvo, frameContato + s(0.1));

      estado[alvo].pose = "guard";
      chave(alvo, frameContato + s(0.34));
      fimDaReacao = frameContato + s(0.34);
      }

      // o ritmo cai para o espectador LER que passou perto
      slowMo.push({
        from: frameContato - s(0.12),
        to: frameContato + s(0.1),
        factor: 0.55,
      });
      // e cai de verdade: o golpe passa rente em camera lenta
      camaraLenta.push({
        from: frameContato - s(0.12),
        to: frameContato + s(0.1),
        factor: 0.5,
      });

      // a camera fecha um pouco, sem tremor: nao houve impacto
      cameraKeys.push({
        frame: frameContato - s(0.08),
        // entre os DOIS, depois da esquiva: centrada no ponto onde o alvo
        // estava, a camera perdia justamente quem esquivou (ele sai 150
        // unidades dali). A esquiva so se le se o corpo que saiu aparece.
        center: {
          x: (estado[atacante].x + estado[alvo].x) / 2,
          y: ALTURA_QUADRIL - 60,
        },
        zoom: 1.2,
        ease: s(0.1),
      });
      cameraKeys.push({
        frame: frameContato + s(0.2),
        center: { x: 0, y: ALTURA_QUADRIL - 60 },
        zoom: 0.95,
        ease: s(0.3),
        fit: true,
      });
    } else if (opcoes.bloqueado) {
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
        sound: def.somBloqueio ?? "block",
        victim: alvo,
        attacker: atacante,
        bloqueado: true,
      });
      // A GUARDA ABSORVE, MAS O CORPO SENTE: o bloqueio empurra quem defende
      // para tras, mais quanto mais forte for quem bateu. Sem isto o soco
      // pesado batia na guarda como numa parede, e a forca dele sumia.
      chave(alvo, frameContato);
      estado[alvo].x +=
        direcao * (30 + 60 * PRESETS[atacante].profile.power);
      chave(alvo, frameContato + s(0.12));
      fimDaReacao = frameContato + s(0.12);
      if (!opcoes.continua) {
        estado[alvo].pose = "guard";
        chave(alvo, frameContato + s(0.4));
        fimDaReacao = frameContato + s(0.4);
      }
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
        attacker: atacante,
        ...(opcoes.finalizador ? { finalizador: true } : {}),
      });
      if (opcoes.finalizador) {
        // NOCAUTE EM CAMERA LENTA: o voo comeca quatro vezes mais devagar e
        // acelera de volta. E o quadro que o espectador vai querer rever.
        camaraLenta.push(
          { from: frameContato, to: frameContato + s(0.25), factor: 0.25 },
          { from: frameContato + s(0.25), to: frameContato + s(0.5), factor: 0.5 },
        );
      }

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
      // deslocado: o impulso age no contato, nao depois dele. A regiao
      // atingida reage no primeiro quadro (a cabeca que leva o soco comeca a
      // chicotear no quadro do contato) e o resto do corpo chega em seguida,
      // na ordem da regiao (ver ATRASO_REACAO_*). Com dois quadros para tudo,
      // o corpo inteiro trocava de pose junto e a onda do impacto nao existia.
      const f1 = frameContato + QUADROS_DA_REACAO;
      const f2 = frameContato + s(0.16);
      const f3 = frameContato + s(0.2);
      const fim = Math.max(f3 + 4, frameContato + voo);
      estado[alvo].pose = POSE_DA_REACAO[REACAO_DO_PONTO[ponto]];
      estado[alvo].x = xAntes + direcao * empurrao * 0.1;
      chave(alvo, f1);

      // FASE 2 - o corpo continua dobrado enquanto escorrega. E o que separa
      // "sentiu o golpe" de "foi empurrado": ele sente E anda ao mesmo tempo.
      estado[alvo].x = xAntes + direcao * empurrao * 0.34;
      chave(alvo, f2);

      // FASE 3 - DESLOCAMENTO. Agora sim a pose de empurrado, com o resto do
      // caminho. A curva saidaRapida da a desaceleracao de corpo com massa.
      //
      // A chave entra no INICIO do deslocamento, e isso importa muito no golpe
      // que LANCA: escrita so no fim, o corpo percorria o voo DESLIZANDO NO
      // CHAO e virava "no ar" nos ultimos quadros. No voo a pose e a de corpo
      // LANCADO, dobrado em "C" com os membros atrasados pela inercia.
      estado[alvo].pose = voa ? "launched" : "knockback";
      estado[alvo].airborne = voa;
      chave(alvo, f3);

      estado[alvo].x = xAntes + direcao * empurrao;
      chave(alvo, fim);
      fimDaReacao = fim;
      fimDoDeslocamento = fim;

      // FASE 4 - FREADA. Ele planta o pe de tras e para de deslizar. Antes o
      // corpo empurrado voltava direto para a guarda, o que le como
      // "teleportou de volta ao normal" e joga fora o peso do golpe.
      if (!voa) {
        estado[alvo].pose = "stagger";
        // escorrega um pouco mais enquanto freia: a freada tem custo
        estado[alvo].x = xAntes + direcao * empurrao * 1.08;
        chave(alvo, fim + s(0.13));
        // segura a freada: o corpo respira antes de voltar a guarda
        chave(alvo, fim + s(0.3));
        fimDaReacao = fim + s(0.3);
      }

      if (voa) {
        // QUEDA: as costas batem, o corpo desliza deitado e para.
        //
        // A sequencia anterior (pousa de pe, agacha, levanta de novo, deita)
        // fazia o corpo lancado de costas aterrissar EM PE, o que nenhum corpo
        // arremessado faz, e ainda ficar de pe por um instante antes de deitar.
        estado[alvo].airborne = false;
        estado[alvo].pose = "groundHit"; // 1. costas e quadril no chao, pernas no ar
        estado[alvo].x += direcao * empurrao * 0.06;
        chave(alvo, fim + 2);

        estado[alvo].pose = "downed"; // 2. desliza deitado, perdendo velocidade
        estado[alvo].x += direcao * empurrao * 0.14;
        chave(alvo, fim + 2 + s(0.32));
        fimDaReacao = fim + 2 + s(0.32);
      }

      // ==== CAMERA DO GOLPE ================================================
      // Esta chave tinha zoom, centro E fit: true ao mesmo tempo. Como fit
      // recalcula os dois a partir da separacao, o zoom e o centro escritos
      // aqui nunca chegavam a tela: o fechamento no golpe era codigo morto, e
      // a camera ABRIA no momento do impacto em vez de fechar.

      // 1. FECHA NO PONTO DE CONTATO, rapido. E o movimento que mais vale numa
      //    luta: a tela vem para onde o golpe aconteceu.
      cameraKeys.push({
        frame: frameContato,
        center: { x: contato.x, y: ALTURA_QUADRIL - 60 },
        zoom: def.tier === "extreme" ? 1.42 : def.tier === "medium" ? 1.28 : 1.18,
        ease: 3,
        shake: def.tier === "extreme" ? 46 : def.tier === "medium" ? 24 : 10,
      });

      // 2. Depois de segurar o fechamento pela absorcao, volta ao plano de
      //    dois. O plano de dois tem piso de zoom e, quando eles nao cabem,
      //    segue o atingido (ver enquadrarDois).
      cameraKeys.push({
        frame: frameContato + s(0.18),
        center: { x: 0, y: ALTURA_QUADRIL - 60 },
        zoom: 0.95,
        ease: s(0.3),
        fit: true,
      });

      // no golpe extremo a camera ACOMPANHA o corpo voando (item 11), em vez
      // de so enquadrar os dois de longe
      if (def.tier === "extreme") {
        cameraKeys.push({
          frame: frameContato + Math.round(strike * 0.8),
          center: { x: 0, y: ALTURA_QUADRIL - 80 },
          // 0.82 e o menor zoom em que o corpo ainda ocupa 25% da altura da
          // tela (a 0.78 caia para 24%, o piso da diretiva)
          zoom: 0.82,
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
    // no meio do combo o corpo NAO recua: o proximo golpe sai daqui
    if (!opcoes.continua) estado[atacante].x -= lado * RECUO_DA_CARGA * 0.55;

    // ---- QUEM LANCA ANDA ATRAS ---------------------------------------------
    // Sem isto os dois terminam o golpe a 900 unidades de distancia, o plano
    // de dois nao cabe no zoom minimo legivel, e a camera tem que escolher um:
    // a auditoria mediu 1,6s com o atacante cortado fora do quadro.
    //
    // Nao e concessao a camera, e o que um lutador faz: quem acerta um golpe
    // que joga o outro longe avanca atras dele, nao fica parado olhando.
    const destinoFinal = estado[alvo].x - lado * DISTANCIA_NEUTRA;
    const vaiSeguir =
      !opcoes.bloqueado &&
      !opcoes.esquivado &&
      fimDaReacao > cursor + s(0.25) &&
      // so avanca, nunca recua: o alvo pode ter caido perto
      (destinoFinal - estado[atacante].x) * lado > 0;

    // RECUPERACAO: o membro volta, o tronco volta, o peso se acomoda (a volta
    // para a guarda passa um pouco do ponto e assenta, ver acomodar). Leva
    // uma fracao da recuperacao que depende do lutador: o rapido recolhe em
    // poucos quadros, o pesado demora. Antes o membro que levou 10 quadros
    // para ir voltava em 3, e recolher de estalo le como elastico.
    const retorno = opcoes.continua
      ? cursor + Math.max(2, Math.round(recover * 0.12))
      : cursor +
        Math.max(3, Math.round(recover * perfil.recolher * (opcoes.esquivado ? 1.5 : 1)));
    // (quem vai seguir o alvo recolhe o membro JA ANDANDO, ver abaixo)
    if (!vaiSeguir) chave(atacante, retorno);
    let ultimaDoAtacante = retorno;

    // DISTANCIA DE NOVO. Depois de uma troca sem knockback (golpe esquivado ou
    // bloqueado) os dois ficavam na distancia do golpe, com os corpos um
    // dentro do outro, e as trocas seguintes aconteciam nesse emaranhado.
    // Quem atacou sai para a distancia neutra: e o que devolve a leitura das
    // duas silhuetas e da ao proximo golpe espaco para ter aproximacao.
    if (
      (opcoes.bloqueado || opcoes.esquivado) &&
      !opcoes.continua &&
      !opcoes.mantemPressao
    ) {
      const neutro = estado[alvo].x - lado * DISTANCIA_NEUTRA * 0.9;
      if ((estado[atacante].x - neutro) * lado > 0) {
        estado[atacante].pose = "retreat";
        estado[atacante].x = neutro;
        const passoAtras =
          retorno + Math.max(s(0.22), Math.round(recover * 0.5));
        chave(atacante, passoAtras);
        estado[atacante].pose = "guard";
        ultimaDoAtacante = passoAtras + s(0.1);
        chave(atacante, ultimaDoAtacante);
      }
    }

    if (vaiSeguir) {
      // Ele CHEGA junto com o pouso, nao depois dele: seguir o proprio golpe
      // e chegar com ele. O membro recolhe no caminho para o passo (a perna
      // do chute desce e os pes plantados cuidam do apoio). Esperando se
      // recompor para so entao andar, o alvo empurrado ja estava 600
      // unidades longe e a camera perdia um dos dois em todo knockback.
      const chegada = Math.max(
        cursor + QUADROS_DE_TRANSICAO + s(0.2),
        Math.min(fimDaReacao, fimDoDeslocamento + s(0.12)),
      );
      estado[atacante].pose = "walk1";
      chave(atacante, cursor + QUADROS_DE_TRANSICAO);
      estado[atacante].x = destinoFinal;
      chave(atacante, chegada);
      estado[atacante].pose = "guard";
      ultimaDoAtacante = chegada + s(0.12);
      chave(atacante, ultimaDoAtacante);
    }

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
    cursor = opcoes.continua
      ? Math.max(retorno, fimDaReacao) + 1
      : Math.max(cursor + recover, voltaDoAlvo, ultimaDoAtacante + 1);
  };


  // ==========================================================================
  // TECNICAS: as cenas de poder da luta de gelo contra fogo.
  //
  // Cada uma escreve tudo de uma vez: poses, deslocamento, camera, impactos e
  // os efeitos de poder (effects/Poderes.tsx). A regra do roteiro manda na
  // coreografia: o GELO e controle e velocidade (desliza, corta preciso), o
  // FOGO e forca e explosao (dispara com explosao, lanca, empurra).
  // ==========================================================================
  /** altura da mao em guarda, no mundo: onde as laminas se encontram */
  const MAO_Y = ALTURA_QUADRIL - 190;
  const PARA_SEMPRE = 1e9;
  const poder = (e: Timeline["poderes"][number]) => poderes.push(e);
  const nome = (texto: string, quem: FighterId, quadro: number, dur = s(0.9)) =>
    poder({ tipo: "nomeDaTecnica", texto, quem, from: quadro, to: quadro + dur });
  const pose = (quem: FighterId, p: PoseName, quadro: number, x?: number) => {
    if (x !== undefined) estado[quem].x = x;
    estado[quem].pose = p;
    chave(quem, quadro);
  };

  const tecnica = (b: Extract<Beat, { type: "tecnica" }>): number => {
    const G = b.gelo;
    const F = b.fogo;
    const c = cursor;
    const lado = estado[G].x <= estado[F].x ? 1 : -1; // gelo -> fogo
    switch (b.tecnica) {
      case "encontro": {
        // os dois parados, cada um no seu elemento; a camera passa entre eles
        // e alterna closes. Silencio antes da luta.
        const dur = s(2.4);
        pose(G, "guard", c, -380);
        pose(F, "guard", c, 380);
        pose(G, "guard", c + dur);
        pose(F, "guard", c + dur);
        poder({ tipo: "auraGelo", quem: G, from: c + 6, to: PARA_SEMPRE, forca: 0.9 });
        poder({ tipo: "auraFogo", quem: F, from: c + 30, to: PARA_SEMPRE, forca: 0.9 });
        poder({ tipo: "geloNoChao", a: { x: -380, y: 0 }, b: { x: -220, y: 0 }, from: c + 8, to: c + 70 });
        poder({ tipo: "chaoQueimado", a: { x: 380, y: 0 }, from: c + 30, to: PARA_SEMPRE, forca: 170 });
        const perto = (x: number, quadro: number, y = ALTURA_QUADRIL - 260) =>
          cameraKeys.push({ frame: quadro, center: { x, y }, zoom: 2.1, ease: 4 });
        cameraKeys.push({ frame: c, center: { x: -380, y: ALTURA_QUADRIL - 80 }, zoom: 1.05, ease: 1 });
        cameraKeys.push({ frame: c + 2, center: { x: 380, y: ALTURA_QUADRIL - 80 }, zoom: 1.05, ease: s(0.9) });
        perto(-380 + 20, c + s(1.0)); // olho do gelo
        perto(380 - 20, c + s(1.3)); // olho do fogo
        perto(-380 + 90, c + s(1.6), MAO_Y); // katana de gelo
        perto(380 - 90, c + s(1.85), MAO_Y); // katana de fogo
        cameraKeys.push({ frame: c + s(2.1), center: { x: 0, y: ALTURA_QUADRIL - 60 }, zoom: 0.95, ease: 6, fit: true });
        return c + dur;
      }

      case "investida": {
        // gelo DESLIZA (trilha de gelo), fogo DISPARA (explosao no pe); as
        // laminas se encontram no meio: gelo para um lado, fogo para o outro
        const m = (estado[G].x + estado[F].x) / 2;
        const encontro = c + s(0.6);
        pose(G, "deslizar", c + 8, estado[G].x + lado * 40);
        pose(F, "sprint1", c + 8, estado[F].x - lado * 40);
        poder({ tipo: "trilhaGelo", quem: G, from: c + 8, to: encontro });
        poder({ tipo: "explosaoFogo", a: { x: estado[F].x + lado * 50, y: -40 }, from: c + 8, to: c + 40, forca: 150 });
        pose(G, "corteLateral", encontro, m - lado * 235);
        pose(F, "corteDesce", encontro, m + lado * 235);
        impacts.push({
          frame: encontro,
          at: { x: m, y: MAO_Y },
          tier: "extreme",
          direction: lado,
          hitStop: 8,
          cracksGround: false,
          sound: "clang",
        });
        poder({ tipo: "choque", a: { x: m, y: MAO_Y }, from: encontro, to: encontro + 40, dir: -lado, forca: 240 });
        cameraKeys.push({ frame: encontro - 6, center: { x: m, y: ALTURA_QUADRIL - 120 }, zoom: 1.35, ease: 6, shake: 34 });
        // o choque separa os dois
        pose(G, "guard", encontro + s(0.35), m - lado * 330);
        pose(F, "guard", encontro + s(0.35), m + lado * 330);
        cameraKeys.push({ frame: encontro + s(0.3), center: { x: m, y: ALTURA_QUADRIL - 60 }, zoom: 0.95, ease: 12, fit: true });
        return encontro + s(0.5);
      }

      case "campoDeGelo": {
        // mao no chao: o gelo toma a arena. O fogo escorrega; o gelo passa
        // patinando e corta.
        const xG = estado[G].x;
        pose(G, "maoNoChao", c + 10);
        const toque = c + 16;
        nome("ICE FIELD", G, toque);
        poder({ tipo: "estilhacosGelo", a: { x: xG + lado * 60, y: -20 }, from: toque, to: toque + 36, forca: 200, dir: lado });
        poder({ tipo: "geloNoChao", a: { x: xG, y: 0 }, b: { x: xG + lado * 1500, y: 0 }, from: toque, to: toque + s(0.5) });
        cameraKeys.push({ frame: toque, center: { x: (xG + estado[F].x) / 2, y: ALTURA_QUADRIL - 60 }, zoom: 0.85, ease: 8, shake: 16 });
        // o fogo tenta avancar e o pe escorrega
        const escorrega = toque + s(0.45);
        pose(F, "advance", escorrega - 8);
        pose(F, "stagger", escorrega, estado[F].x - lado * 50);
        // o gelo levanta e patina, passando por ele
        pose(G, "guard", toque + s(0.4));
        const xF = estado[F].x;
        const passa = escorrega + s(0.35);
        pose(G, "deslizar", escorrega + 4, xG + lado * 60);
        poder({ tipo: "trilhaGelo", quem: G, from: escorrega + 4, to: passa + 10 });
        pose(G, "corteLateral", passa, xF + lado * 60);
        impacts.push({
          frame: passa,
          at: { x: xF, y: MAO_Y + 40 },
          tier: "medium",
          direction: lado,
          hitStop: 6,
          cracksGround: false,
          sound: "corte",
          victim: F,
          attacker: G,
        });
        poder({ tipo: "sangue", a: { x: xF, y: MAO_Y + 40 }, from: passa, to: passa + 60, dir: lado, forca: 1 });
        poder({ tipo: "marcaDeCorte", quem: F, from: passa, to: PARA_SEMPRE });
        // passa direto e so para longe: as bolas de fogo precisam de espaco
        pose(G, "deslizar", passa + 12, xF + lado * 420);
        pose(G, "guard", passa + s(0.4), xF + lado * 600);
        // o fogo cambaleia, vira e olha o corte
        pose(F, "hitChest", passa + 4, xF);
        pose(F, "guard", passa + s(0.5));
        cameraKeys.push({ frame: passa - 10, center: { x: xF, y: ALTURA_QUADRIL - 120 }, zoom: 1.25, ease: 8 });
        cameraKeys.push({ frame: passa + s(0.35), center: { x: 0, y: ALTURA_QUADRIL - 60 }, zoom: 0.95, ease: 14, fit: true });
        return passa + s(0.55);
      }

      case "bolasDeFogo": {
        // tres bolas de fogo; o gelo desvia de cada uma de um jeito e a ultima
        // explode atras dele. O fogo derrete o gelo do chao: vapor.
        const ladoF = estado[F].x <= estado[G].x ? 1 : -1; // fogo -> gelo
        pose(F, "lancar", c + 12);
        nome("FIRE BULLETS", F, c + 12);
        // plano aberto: a bola precisa ser vista saindo de um e chegando no outro
        cameraKeys.push({ frame: c, center: { x: 0, y: ALTURA_QUADRIL - 60 }, zoom: 0.9, ease: 10, fit: true });
        const xG = estado[G].x;
        const mao = { x: estado[F].x + ladoF * 150, y: MAO_Y };
        // o gelo desvia de cada uma de um jeito: inclina para tras, pula, e
        // na terceira desliza POR BAIXO dela, na direcao do fogo; a bola passa
        // por cima e explode atras dele
        let xAtual = xG;
        let q = c + 14;
        for (let i = 0; i < 3; i++) {
          const chega = q + 20;
          const alvo =
            i === 0
              ? { x: xAtual, y: MAO_Y }
              : i === 1
                ? { x: xAtual, y: -110 }
                : { x: xAtual + ladoF * 240, y: MAO_Y - 30 };
          poder({ tipo: "bolaDeFogo", a: mao, b: alvo, from: q, to: chega, forca: 46 });
          poder({ tipo: "vapor", a: { x: alvo.x, y: -60 }, from: chega, to: chega + 30, forca: 140 });
          if (i < 2) {
            pose(F, "guard", q + 6);
            pose(F, "lancar", q + 12);
          }
          if (i === 0) {
            xAtual += ladoF * 70;
            pose(G, "dodge", chega - 5, xAtual);
            pose(G, "guard", chega + 10);
          } else if (i === 1) {
            pose(G, "coil", chega - 12);
            estado[G].airborne = true;
            pose(G, "jump", chega - 7);
            pose(G, "airborne", chega + 8);
            estado[G].airborne = false;
            pose(G, "land", chega + 14);
          } else {
            xAtual -= ladoF * 90;
            pose(G, "deslizar", chega - 4, xAtual);
          }
          q += 26;
        }
        // o fogo no chao derrete o gelo: ele some a partir daqui
        poderes.forEach((e) => {
          if (e.tipo === "geloNoChao" && !e.forca) e.forca = c + 30;
        });
        // a ultima explode atras do gelo e EMPURRA ele na direcao do fogo
        const fim = q;
        cameraKeys.push({ frame: fim - 6, center: { x: xAtual, y: ALTURA_QUADRIL - 80 }, zoom: 1.0, ease: 6, shake: 26 });
        pose(G, "deslizar", fim + 6, estado[F].x + ladoF * 330);
        pose(G, "guard", fim + 20);
        pose(F, "guard", fim);
        cameraKeys.push({ frame: fim + 10, center: { x: 0, y: ALTURA_QUADRIL - 60 }, zoom: 0.95, ease: 12, fit: true });
        return fim + 26;
      }

      case "infernoVsZero": {
        // o fogo junta uma esfera enorme; o gelo fecha os olhos, a chuva
        // congela no ar; os dois lancam e os poderes colidem no meio
        // os dois abrem distancia: a esfera e os feixes precisam do meio livre
        const m = (estado[G].x + estado[F].x) / 2;
        pose(G, "retreat", c + 8, m - lado * 330);
        pose(F, "retreat", c + 8, m + lado * 330);
        const xG = estado[G].x;
        const xF = estado[F].x;
        pose(F, "katanaErguida", c + 16);
        const esfera = { x: xF, y: ALTURA_QUADRIL - 560 };
        poder({ tipo: "esferaInferno", a: esfera, from: c + 12, to: c + s(1.3), forca: 250 });
        nome("INFERNO", F, c + 18);
        pose(G, "guard", c + s(0.5));
        pose(G, "katanaErguida", c + s(0.75));
        poder({ tipo: "zeroAbsoluto", quem: G, from: c + s(0.7), to: c + s(2.4) });
        poder({ tipo: "chuvaCongelada", from: c + s(0.75), to: c + s(2.4) });
        nome("ZERO ABSOLUTE", G, c + s(0.8));
        // aberto e alto: a esfera cresce em cima do fogo, o gelo no quadro
        cameraKeys.push({ frame: c + 4, center: { x: (xG + xF) / 2, y: ALTURA_QUADRIL - 300 }, zoom: 0.72, ease: 14 });
        cameraKeys.push({ frame: c + s(0.7), center: { x: xG, y: ALTURA_QUADRIL - 200 }, zoom: 1.4, ease: 8 });
        // lancam: o fogo empurra as maos, o gelo desce a katana
        const lanca = c + s(1.3);
        pose(F, "bracosFrente", lanca);
        pose(G, "corteDesce", lanca);
        const colisao = { x: m, y: ALTURA_QUADRIL - 200 };
        const fimFeixe = lanca + s(1.1);
        poder({ tipo: "feixeFogo", a: { x: xF - lado * 120, y: ALTURA_QUADRIL - 210 }, b: colisao, from: lanca, to: fimFeixe, forca: 120 });
        poder({ tipo: "raioGelo", a: { x: xG + lado * 150, y: ALTURA_QUADRIL - 190 }, b: colisao, from: lanca, to: fimFeixe, forca: 100 });
        // o vapor so vem DEPOIS que os feixes se encontram e brigam um pouco:
        // antes disso ele escondia os dois poderes
        poder({ tipo: "vapor", a: colisao, from: lanca + s(0.5), to: fimFeixe, forca: 150 });
        // tremor crescente
        for (let k = 0; k < 5; k++) {
          cameraKeys.push({
            frame: lanca + k * 13,
            center: { x: m, y: ALTURA_QUADRIL - 120 },
            zoom: 0.92 + k * 0.06,
            ease: 12,
            shake: 8 + k * 9,
          });
        }
        pose(F, "bracosFrente", fimFeixe);
        pose(G, "corteDesce", fimFeixe);
        // explosao: tela branca, fogo e gelo juntos
        impacts.push({
          frame: fimFeixe,
          at: colisao,
          tier: "extreme",
          direction: lado,
          hitStop: 10,
          cracksGround: true,
          sound: "explosion",
        });
        poder({ tipo: "telaBranca", from: fimFeixe, to: fimFeixe + 14 });
        poder({ tipo: "explosaoFogo", a: colisao, from: fimFeixe, to: fimFeixe + 40, forca: 420 });
        poder({ tipo: "estilhacosGelo", a: colisao, from: fimFeixe, to: fimFeixe + 36, forca: 400 });
        poder({ tipo: "vapor", a: { x: m, y: -150 }, from: fimFeixe + 8, to: fimFeixe + s(1.2), forca: 420 });
        // depois: o gelo ajoelhado, o fogo de pe (parece que o fogo venceu)
        pose(G, "ajoelhado", fimFeixe + 16, xG - lado * 120);
        pose(F, "guard", fimFeixe + 16, xF + lado * 80);
        cameraKeys.push({ frame: fimFeixe + 16, center: { x: m, y: ALTURA_QUADRIL - 60 }, zoom: 0.95, ease: 20, fit: true });
        pose(G, "ajoelhado", fimFeixe + s(0.75));
        return fimFeixe + s(0.8);
      }

      case "choqueFinal": {
        // o gelo abre o olho e levanta; os dois correm; as katanas cruzam, a
        // tela fica branca, silencio, TING: as duas espadas quebram
        const m = (estado[G].x + estado[F].x) / 2;
        pose(G, "guard", c + 10);
        pose(G, "run1", c + 18);
        pose(F, "run1", c + 14);
        const cruza = c + s(0.55);
        pose(G, "corteDesce", cruza, m - lado * 235);
        pose(F, "corteDesce", cruza, m + lado * 235);
        cameraKeys.push({ frame: c + 16, center: { x: m, y: ALTURA_QUADRIL - 100 }, zoom: 1.2, ease: s(0.4) });
        impacts.push({
          frame: cruza,
          at: { x: m, y: MAO_Y },
          tier: "extreme",
          direction: lado,
          hitStop: 7,
          cracksGround: false,
          sound: "clang",
        });
        poder({ tipo: "telaBranca", from: cruza, to: cruza, forca: 1 });
        poder({ tipo: "quebraLaminas", a: { x: m, y: MAO_Y }, from: cruza + 2, to: cruza + 90 });
        // seguem o corte e param de costas um para o outro? Nao: param frente
        // a frente, sem espada, se encarando
        pose(G, "corteDesce", cruza + 10);
        pose(F, "corteDesce", cruza + 10);
        return cruza + 14;
      }

      case "encarar": {
        const m = (estado[G].x + estado[F].x) / 2;
        pose(G, "guard", c + 14, m - lado * 230);
        pose(F, "guard", c + 14, m + lado * 230);
        poder({ tipo: "rachadura", a: { x: m, y: 0 }, from: c + 20, to: c + 60, forca: 320 });
        cameraKeys.push({ frame: c + 10, center: { x: m, y: ALTURA_QUADRIL - 140 }, zoom: 0.72, ease: s(1.2) });
        // longo o bastante para o logo, os nomes e a pergunta serem lidos
        const dur = s(3.6);
        pose(G, "guard", c + dur);
        pose(F, "guard", c + dur);
        poder({ tipo: "nomeDaTecnica", texto: "FINAL", from: c + s(0.5), to: c + dur });
        return c + dur;
      }
    }
    return c;
  };

  for (let indice = 0; indice < spec.beats.length; indice++) {
    const beat = spec.beats[indice];
    const inicio = cursor;
    // o proximo beat e um golpe do MESMO atacante: ele mantem a pressao
    const proxima = spec.beats[indice + 1];
    const mantemPressao =
      proxima !== undefined &&
      "attacker" in proxima &&
      "attacker" in beat &&
      proxima.attacker === beat.attacker;

    switch (beat.type) {
      case "approach": {
        const e = estado[beat.who];
        // chave com a pose ATUAL antes de trocar: sem ela a troca para corrida
        // caia no mesmo quadro e virava corte seco ("idle -> run1" no quadro 0)
        chave(beat.who, cursor);
        e.pose = "run1";
        chave(beat.who, cursor + QUADROS_DE_TRANSICAO);
        // corre ate perto e FREIA nos ultimos quadros, em pose de passo: sem
        // isso ele chegava em velocidade de corrida e parava de um quadro para
        // o outro, ainda com a perna no meio da passada
        const inicioDoApproach = e.x;
        e.x = inicioDoApproach + (beat.toX - inicioDoApproach) * 0.9;
        e.pose = "run2";
        chave(beat.who, cursor + Math.round(beat.duration * 0.72));
        e.x = beat.toX;
        e.pose = "advance";
        chave(beat.who, cursor + beat.duration);
        // o oponente tambem se move, senao um corre e o outro fica plantado
        const outro = oposto(beat.who);
        chave(outro, cursor);
        estado[outro].pose = "advance";
        estado[outro].x += (beat.toX > estado[outro].x ? -1 : 1) * 60;
        chave(outro, cursor + beat.duration);
        // ele volta a GUARDA em vez de congelar na pose de passo: e o que o
        // deixa esperando o golpe em vez de virar estatua no meio da arena
        estado[outro].pose = "guard";
        chave(outro, cursor + beat.duration + QUADROS_DE_TRANSICAO * 2);
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
          mantemPressao,
        });
        break;

      case "dodged":
        golpear(beat.attacker, beat.target, beat.move, {
          esquivado: true,
          ponto: beat.targetPoint,
          mantemPressao,
          pulo: beat.pulo,
        });
        break;

      case "combo": {
        // o combo muda a posicao entre golpes sozinho (aproximar() roda em
        // cada golpe), que e o que o briefing pede
        beat.moves.forEach((move, i) => {
          const ultimo = i === beat.moves.length - 1;
          golpear(beat.attacker, beat.target, move, {
            // por padrao so o ultimo passa pela guarda; com final "blocked"
            // o defensor segura o combo inteiro
            bloqueado: !ultimo || beat.final === "blocked",
            encadeado: i > 0,
            continua: !ultimo,
            ponto: beat.targetPoint,
          });
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
        // O OUTRO VOLTA A ENTRAR. Depois de um knockback os dois ficavam
        // parados na distancia em que o empurrao os deixou, e a camera, para
        // caber os dois, abria ate o piso e ainda cortava o atacante. Nao era
        // problema de camera: era composicao. Lutador nao fica parado olhando
        // o adversario se recompor, ele fecha a distancia.
        const outroLado = oposto(beat.who);
        const rival = estado[outroLado];
        const separacao = Math.abs(rival.x - estado[beat.who].x);
        if (separacao > DISTANCIA_NEUTRA) {
          const lado = rival.x <= estado[beat.who].x ? -1 : 1;
          rival.pose = "walk1";
          chave(outroLado, cursor);
          rival.x = estado[beat.who].x + lado * DISTANCIA_NEUTRA;
          chave(outroLado, cursor + Math.round(beat.duration * 0.8));
          rival.pose = "guard";
          chave(outroLado, cursor + beat.duration);
        }

        // LEVANTAR SO SE ELE CAIU. Antes este beat forcava a pose getUp
        // sempre, e getUp tem o quadril agachado: um lutador que apenas levou
        // um soco em pe agachava e se levantava, o que conta ao espectador uma
        // queda que nunca aconteceu.
        const caido = estado[beat.who].pose === "downed";
        if (caido) {
          // tres tempos: senta apoiado na mao, ajoelha, fica de pe. Cada um
          // e uma pose que o corpo consegue sustentar, e o peso sobe em
          // etapas; direto de deitado para ajoelhado o corpo girava no ar
          estado[beat.who].pose = "sitUp";
          chave(beat.who, cursor + Math.round(beat.duration * 0.3));
          estado[beat.who].pose = "getUp";
          chave(beat.who, cursor + Math.round(beat.duration * 0.62));
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

      case "danca": {
        // o vencedor sai da guarda e entra no passinho; o resto do corpo
        // (pernas, bracos, rebolado) e calculado em animation/danca.ts
        chave(beat.who, cursor);
        estado[beat.who].pose = "danca";
        chave(beat.who, cursor + 10);
        chave(beat.who, cursor + beat.duration);
        // a camera enquadra o vencedor dancando E o derrotado no chao: um
        // sem o outro nao conta a piada. Corpo inteiro, com os pes, porque
        // e nas pernas que o passinho acontece.
        cameraKeys.push({
          frame: cursor,
          center: {
            x: (estado[beat.who].x + estado[oposto(beat.who)].x) / 2,
            y: ALTURA_QUADRIL - 60,
          },
          zoom: 1.0,
          ease: s(0.5),
          fit: true,
        });
        cursor += beat.duration;
        break;
      }

      case "placa": {
        // o movimento e procedural (animation/placa.ts); aqui so a troca de
        // pose, para os pes plantados soltarem e o corpo girar de frente
        chave(beat.who, cursor);
        estado[beat.who].pose = "placa";
        chave(beat.who, cursor + 12);
        chave(beat.who, cursor + beat.duration);
        // abre e sobe: a placa fica bem acima da cabeca. Puxada um pouco
        // para o lado do derrotado, que continua no quadro caido
        cameraKeys.push({
          frame: cursor + 20,
          center: {
            x:
              estado[beat.who].x +
              (estado[oposto(beat.who)].x - estado[beat.who].x) * 0.4,
            y: ALTURA_QUADRIL - 320,
          },
          zoom: 0.85,
          ease: s(0.45),
        });
        cursor += beat.duration;
        break;
      }

      case "tecnica":
        cursor = tecnica(beat);
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
    aims,
    cameraKeys,
    tracks,
    slowMo,
    camaraLenta,
    poderes,
  };
};
