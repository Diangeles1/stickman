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
      pose: e.pose,
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
    } = {},
  ) => {
    const duracoes = duracaoDe(atacante, move);
    const { strike, recover, contactAt, def } = duracoes;
    // COMBO QUE FLUI: o golpe encadeado nao volta a guarda para carregar do
    // zero. Soco, guarda, soco, guarda e o que a diretiva chama de combo
    // robotico; aqui o braco que volta de um golpe ja e a carga do outro.
    const windup = opcoes.encadeado
      ? Math.max(3, Math.round(duracoes.windup * 0.45))
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
    estado[atacante].pose = "coil";
    if (!opcoes.encadeado) {
      estado[atacante].x -= lado * RECUO_DA_CARGA * perfil.recuoDoPeso;
    }
    // A chave sai alguns quadros DEPOIS do cursor: no mesmo quadro ela
    // colidia com a chave de chegada da aproximacao e virava corte seco.
    const cargaPronta =
      cursor + Math.max(1, Math.min(windup - 1, Math.round(windup * 0.6)));
    chave(atacante, cargaPronta);
    estado[atacante].x = xNoContato;
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
        zoom: opcoes.finalizador ? 1.7 : opcoes.esquivado ? 1.08 : 1.35,
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

      // o ritmo cai para o espectador LER que passou perto
      slowMo.push({
        from: frameContato - s(0.12),
        to: frameContato + s(0.1),
        factor: 0.55,
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
        sound: "block",
        victim: alvo,
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
    chave(atacante, retorno);
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
      // Ele CHEGA junto com o pouso, nao depois dele. Seguir o proprio golpe
      // e chegar com ele; so comeca a andar depois de se recompor, porque
      // andar com a perna do chute ainda no ar e o que um boneco faria.
      const chegada = Math.max(
        retorno + QUADROS_DE_TRANSICAO + s(0.2),
        Math.min(fimDaReacao, fimDoDeslocamento + s(0.12)),
      );
      estado[atacante].pose = "walk1";
      chave(atacante, retorno + QUADROS_DE_TRANSICAO);
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
  };
};
