/**
 * O CORPO NO QUADRO: fonte unica da verdade sobre como um lutador e desenhado.
 *
 * Existe por dois motivos, os dois tirados de bugs reais deste projeto:
 *
 * 1. A cena, o overlay de depuracao e os medidores montavam a transformacao
 *    do personagem cada um por conta. Quando divergiam, o medidor aprovava um
 *    corpo que a tela nao desenhava, e foi assim que "o golpe nao encosta"
 *    sobreviveu a tres rodadas de analise visual.
 *
 * 2. A altura do quadril era uma CONSTANTE. Toda pose de perna dobrada ficava
 *    flutuando: medido, sprint1 flutuava 106 unidades de mundo, 18% de uma
 *    altura de corpo, e no video os pes do lutador nao tocavam o chao em
 *    nenhum quadro da corrida.
 *
 * Ordem do que e resolvido aqui:
 *
 *   amostragem -> respiracao -> apoio no chao -> compressao do impacto -> IK
 *
 * APOIO: a altura do quadril e derivada do pe mais baixo. Isso da de graca o
 * que antes faltava, porque perna que dobra baixa o quadril: oscilacao vertical
 * na corrida, corpo que afunda ao carregar o golpe, centro de massa coerente
 * com as pernas, sem ninguem animar nada disso na mao.
 *
 * IK: a distancia de combate resolve o eixo horizontal por construcao, mas o
 * vertical vinha da pose escrita a mao. O compilador declara a intencao
 * (AimEvent) e aqui ela e resolvida por cinematica inversa de dois ossos.
 */

import {
  alturaDoVoo,
  amostrar,
  disparo,
  inclinacaoDesenhada,
  progressoDoVoo,
  suave,
} from "./sampler";
import { poseDaDanca, reboladoDaDanca } from "./danca";
import { VIRA, poseDaPlaca } from "./placa";
import { PRESETS } from "../characters/presets";
import {
  ALTURA_QUADRIL,
  PE_NO_CHAO,
  escalaDoMundo,
  juntasNoMundo,
  mirarMembro,
  paraLocal,
  peMaisBaixo,
  completar,
  giroVisivel,
  misturar,
  poseBase,
  type Transformacao,
} from "../characters/skeleton";
import {
  folgaDesejada,
  pontoDoAlvo,
  type PontoAlvo,
} from "../core/contact";
import type {
  AimEvent,
  JointName,
  FighterId,
  Pose,
  PoseName,
  Timeline,
  Vec2,
} from "../core/types";

/** Poses em que o corpo respira. Postura de espera, nunca durante a acao. */
const POSES_QUE_RESPIRAM = new Set<PoseName>(["idle", "guard"]);

/**
 * GINGA DA GUARDA: o lutador quica no lugar, como boxeador.
 *
 * E o que mais separa luta de stickman profissional de manequim: ninguem
 * espera um golpe parado. Os joelhos flexionam num ritmo curto e o corpo sobe
 * e desce junto; a respiracao sozinha e sutil demais para ler no celular.
 *
 * Feita DOBRANDO OS JOELHOS, nao descendo o quadril: o apoio no chao (mais
 * abaixo) deriva a altura do corpo do pe mais baixo, entao joelho que dobra
 * baixa o corpo sozinho e o pe continua plantado.
 */
const PERIODO_DA_GINGA = 34;
/**
 * Deslocamento das juntas no ponto mais baixo da ginga, em unidades de pose.
 *
 * Os DOIS joelhos vao para FRENTE, que e para onde um joelho dobra. A versao
 * anterior abria o joelho de tras para tras, e a base virava um arco de
 * pernas para fora a cada quique. Os valores sao diferentes porque as pernas
 * da guarda tem angulos diferentes: medidos para os dois pes subirem igual em
 * relacao ao quadril (~5,5 unidades de pose), e entao e o corpo que desce, nao
 * um pe que levanta.
 */
const GINGA: Pose = {
  // O PE ENTRA NA CONTA, e e ele que faz o corpo descer: o pe sobe 5 unidades
  // em relacao ao quadril, entao o quadril desce 5 em relacao ao chao. O
  // joelho acompanha indo para frente, que e para onde joelho dobra.
  //
  // Antes o balanco mexia SO os joelhos. Como o corretor de ossos mantem o
  // comprimento da perna, o pe era arrastado junto: ele andava ate 130
  // unidades para os lados a cada ciclo, o planejamento dos pes entendia
  // aquilo como "a pose quer o pe noutro lugar" e mandava dar um passo. Duas
  // vezes por segundo, para sempre. Era a perna tremendo.
  footFront: { x: 0, y: -5 },
  footBack: { x: 0, y: -5 },
  kneeFront: { x: 10, y: -3 },
  kneeBack: { x: 16, y: -3 },
  neck: { x: 2, y: 3 },
  head: { x: 3, y: 4 },
  handFront: { x: 2, y: 5 },
  handBack: { x: 1, y: 4 },
  elbowFront: { x: 1, y: 3 },
  elbowBack: { x: 1, y: 3 },
};

const gingar = (pose: Pose, frame: number, defasagem: number): Pose => {
  // 1 - cos da uma descida suave e uma subida suave: o corpo "pesa" embaixo
  const fase = (frame / PERIODO_DA_GINGA) * Math.PI * 2 + defasagem;
  const quanto = (1 - Math.cos(fase)) / 2;
  const saida: Pose = { ...pose };
  for (const [junta, d] of Object.entries(GINGA) as [keyof Pose, { x: number; y: number }][]) {
    const v = pose[junta];
    if (!v) continue;
    saida[junta] = { x: v.x + d.x * quanto, y: v.y + d.y * quanto };
  }
  return saida;
};

/**
 * GIRO DO CHUTE GIRATORIO: uma volta inteira no eixo vertical.
 *
 * O corpo gira entre o fim da carga e o contato, e chega ao contato exatamente
 * de frente (giro = 1), que e onde a distancia de combate e a mira foram
 * calculadas. No meio da volta ele fica de costas para o adversario, que e o
 * quadro que o olho usa para ler "girou".
 */
const POSES_QUE_GIRAM = new Set<PoseName>(["spinKick"]);

/**
 * BASE FECHADA NO GIRO: os pes vem para baixo do quadril enquanto o corpo da
 * a volta.
 *
 * O giro achata o corpo em volta do quadril; com a base aberta da guarda, os
 * pes varriam o chao de um lado ao outro (267 unidades). Girar sobre o pe de
 * apoio com a base aberta tambem nao serve: o quadril e que viajava 380
 * unidades. Quem gira de verdade FECHA a base antes e pivota sob o proprio
 * corpo, e e isso que esta funcao faz, na medida em que o giro acontece.
 */
const estreitarNoGiro = (pose: Pose, fechamento: number): Pose => {
  if (fechamento <= 0.001) return pose;
  const w = fechamento;
  const c = completar(pose);
  const fechar = (v: { x: number; y: number }, k: number) => ({
    x: v.x * (1 - k * w),
    y: v.y,
  });
  return {
    ...c,
    footFront: fechar(c.footFront, 0.8),
    footBack: fechar(c.footBack, 0.8),
    kneeFront: fechar(c.kneeFront, 0.6),
    kneeBack: fechar(c.kneeBack, 0.6),
  };
};

/**
 * O GIRO EM DOIS TEMPOS: primeiro FECHA A BASE, depois gira.
 *
 * Fechando a base durante a propria volta, os pes eram arrastados pelo chao
 * (a auditoria de pes mediu estalos de 100 unidades num quadro): com o corpo
 * de perfil nao ha como pregar pe nenhum. Fechando ANTES, com o corpo ainda
 * de frente, os pes plantados transformam o fechamento em passos de verdade,
 * e a volta acontece sobre pes que ja estao embaixo do quadril.
 *
 * `giro`: 1 de frente, -1 de costas. `fechamento`: 0 base aberta, 1 fechada.
 */
const giroNoQuadro = (
  track: Timeline["tracks"][string],
  frame: number,
): { giro: number; fechamento: number; inicio?: number } => {
  const keys = track.keys;
  for (let i = 1; i < keys.length; i++) {
    const k = keys[i];
    if (!POSES_QUE_GIRAM.has(k.pose)) continue;
    const anterior = keys[i - 1];
    // so a chave em que o golpe CHEGA: as seguintes seguram a extensao
    if (POSES_QUE_GIRAM.has(anterior.pose)) continue;
    // O TRONCO GIRA PRIMEIRO, A PERNA CHICOTEIA DEPOIS: a volta comeca
    // ainda na carga e termina na metade do disparo; o resto do tempo e so a
    // perna estendendo. Girando ate o ultimo quadro, corpo e perna chegavam
    // juntos e o chute perdia o estalo.
    // A volta e RAPIDA (~10 quadros): de perfil o corpo nao se le, entao
    // quanto menos tempo ele passa assim, melhor. Mais lenta, lia como um
    // poste parado no meio do golpe.
    const inicio = anterior.frame - 6;
    const fim = anterior.frame + (k.frame - anterior.frame) * 0.35;
    const inicioDoFechamento = inicio - 12;
    if (frame < inicioDoFechamento || frame > k.frame) continue;
    const fechamento =
      frame < inicio
        ? suave((frame - inicioDoFechamento) / (inicio - inicioDoFechamento))
        : frame <= fim
          ? 1
          : 1 - suave((frame - fim) / Math.max(1, k.frame - fim));
    if (frame < inicio) return { giro: 1, fechamento };
    const p = Math.min(1, (frame - inicio) / Math.max(1, fim - inicio));
    return { giro: Math.cos(suave(p) * Math.PI * 2), fechamento, inicio };
  }
  return { giro: 1, fechamento: 0 };
};

/**
 * RESPIRACAO: o peito sobe e desce e os bracos acompanham.
 *
 * Sem isto o lutador que espera fica LITERALMENTE parado. Medido no
 * diagnostico: o vermelho ficava com velocidade 0,00 por 0,35s antes de levar
 * o golpe, ou seja um manequim em cena.
 *
 * Feito comprimindo o TRONCO, nao subindo o corpo: os pes ficam plantados e o
 * peito se move, que e como respiracao funciona. Os ombros acompanham sozinhos
 * porque agora sao derivados do tronco (ver skeleton.completar).
 *
 * 1.6 unidades de pose davam 4px na tela: invisivel, e o lutador continuava
 * lendo como manequim. 4.2 da ~12 unidades de mundo, que se percebe sem virar
 * balanco. O limite e o squash do tronco (20% de 74 = 14.8).
 */
const AMPLITUDE_DO_PEITO = 4.2;
const AMPLITUDE_DOS_BRACOS = 2.6;
/** Periodo em quadros. 96 a 60fps = 1,6s por ciclo, ritmo de quem espera. */
const PERIODO_DA_RESPIRACAO = 96;

const respirar = (pose: Pose, frame: number, defasagem: number): Pose => {
  const fase = (frame / PERIODO_DA_RESPIRACAO) * Math.PI * 2 + defasagem;
  const sobe = Math.sin(fase);
  const neck = pose.neck;
  const handFront = pose.handFront;
  const handBack = pose.handBack;
  return {
    ...pose,
    ...(neck
      ? { neck: { x: neck.x, y: neck.y - sobe * AMPLITUDE_DO_PEITO } }
      : {}),
    ...(handFront
      ? {
          handFront: {
            x: handFront.x,
            y: handFront.y - sobe * AMPLITUDE_DOS_BRACOS,
          },
        }
      : {}),
    ...(handBack
      ? {
          handBack: {
            x: handBack.x,
            y: handBack.y - sobe * AMPLITUDE_DOS_BRACOS * 0.7,
          },
        }
      : {}),
  };
};

/**
 * GIRO DA QUEDA, em graus.
 *
 * Corpo lancado nao viaja reto: ele roda. Sem isto o lancamento era translacao
 * pura seguida de uma troca para pose horizontal, que e exatamente o que a
 * diretiva chama de "personagem simplesmente mudando para uma pose deitada".
 *
 * O giro vai a zero no fim do arco, entao o corpo chega ao chao alinhado com a
 * pose de pouso: girar ate o ultimo quadro faria o pe aterrissar de lado e o
 * apoio colocaria o personagem torto.
 */
const GIRO_DA_QUEDA = 52;

/** Poses de corpo lancado por um golpe: so elas recebem o giro da queda. */
const POSES_ARREMESSADAS = new Set<PoseName>(["launched", "airborne", "knockback"]);

/** Em quantos quadros o membro completa o avanco e volta. */
const QUADROS_DO_AVANCO = 6;

/** Duracao da absorcao do impacto, em quadros logicos. */
const DUR_COMPRESSAO = 5;

/**
 * ABSORCAO DO IMPACTO: o corpo do atingido comprime por alguns quadros.
 *
 * E o squash da animacao classica aplicado ao corpo inteiro. Sem ele a reacao
 * era so troca de pose, e troca de pose sozinha nao comunica que uma forca
 * entrou no corpo.
 */
const compressaoDe = (
  timeline: Timeline,
  id: FighterId,
  frame: number,
): number => {
  let fator = 1;
  for (const imp of timeline.impacts) {
    if (imp.victim !== id) continue;
    const idade = frame - imp.frame;
    if (idade < 0 || idade > DUR_COMPRESSAO) continue;
    const forca = 1 - idade / DUR_COMPRESSAO;
    const fundo =
      imp.tier === "extreme" ? 0.11 : imp.tier === "medium" ? 0.065 : 0.03;
    fator = Math.min(fator, 1 - fundo * forca);
  }
  return fator;
};

/**
 * Peso da correcao de mira neste quadro.
 *
 * Entra durante o disparo, vale 1 EXATAMENTE no quadro do contato, e sai
 * depois. Sem essa janela a correcao apareceria de um quadro para o outro e o
 * membro daria um estalo.
 */
const pesoDaMira = (aim: AimEvent, frame: number): number => {
  if (frame < aim.from || frame > aim.to) return 0;
  if (frame <= aim.contact) {
    const dur = Math.max(1, aim.contact - aim.from);
    // ACELERA ate o contato. Com curva suave a correcao tinha a maior taxa no
    // MEIO do caminho, e o punho atingia a velocidade maxima 2 quadros ANTES
    // do contato: o golpe chegava e o corpo vinha atras, cadeia invertida.
    // mesma curva do disparo da pose (t^3): com t^2 a mira chegava antes do
    // braco e o pico de velocidade do punho caia dois quadros antes do
    // contato, junto com o do ombro
    return disparo((frame - aim.from) / dur);
  }
  const dur = Math.max(1, aim.to - aim.contact);
  return 1 - suave((frame - aim.contact) / dur);
};

export type Corpo = {
  /** posicao do quadril no mundo */
  x: number;
  baseY: number;
  facing: 1 | -1;
  /** escala ja pronta para juntasNoMundo */
  scale: number;
  spin: number;
  /** giro no eixo vertical: 1 de frente, -1 de costas (ver Transformacao) */
  giro: number;
  pose: Pose;
  poseNome: PoseName;
  /** o corpo esta no ar (salto, lancamento): nenhum pe apoia */
  noAr: boolean;
  velocidade: number;
  aceleracao: number;
  /** quanto o quadril baixou em relacao ao apoio neutro, em unidades de mundo */
  agachamento: number;
  /** quanto o IK precisou corrigir a ponta do membro, em unidades de pose */
  correcaoDaMira: number;
  /** false quando o alvo estava fora do alcance do membro */
  alcancou: boolean;
};

/** A transformacao de desenho de um corpo. */
export const transformDoCorpo = (c: Corpo): Transformacao => ({
  baseX: c.x,
  baseY: c.baseY,
  facing: c.facing,
  scale: c.scale,
  spin: c.spin,
  giro: c.giro,
});

/** Juntas do corpo em coordenadas de mundo. */
export const juntasDoCorpo = (c: Corpo) =>
  juntasNoMundo(c.pose, transformDoCorpo(c));

/**
 * Corpo SEM correcao de mira.
 *
 * Separado porque o IK de um lutador precisa saber onde esta o ponto do outro,
 * e resolver os dois com IK ao mesmo tempo seria dependencia circular. O ponto
 * do alvo e lido do corpo sem mira, que nao depende de ninguem.
 */
/**
 * POSTURA: a assinatura corporal de cada lutador.
 *
 * Dois lutadores com a mesma biblioteca de poses lutam igual, e um animador
 * que viu a luta resumiu o problema assim: "eles ainda compartilham a mesma
 * linguagem de movimento". Cor diferente nao e personagem diferente.
 *
 * Aqui o perfil do preset (velocidade contra forca) vira POSTURA, aplicada em
 * cima de qualquer pose de espera ou de deslocamento:
 *
 *   PESADO (forca > velocidade)   base larga, quadril baixo, tronco a frente
 *   RAPIDO (velocidade > forca)   base estreita, quadril alto, tronco reto
 *
 * NAO se aplica a pose de ATAQUE. A altura da ponta da lamina e do punho no
 * contato e calibrada contra o ponto mirado (ver scripts/contato.mts, mira.mts):
 * mexer na postura ali sairia da calibragem e o golpe deixaria de encostar.
 * O ataque e o mesmo para os dois; o que muda e o corpo que chega nele.
 */
const POSES_COM_POSTURA = new Set<PoseName>([
  "idle", "guard", "guardaKatana",
  "block", "bloqueioKatana", "absorver", "absorverKatana",
]);
// So a ESPERA e a DEFESA, que e onde a personalidade se le: e a pose em que
// o lutador passa mais tempo e a primeira coisa que o espectador ve dele.
//
// Tudo que faz parte de um golpe (carga, ataque) fica de fora, e por um
// motivo medido: a postura e um deslocamento fixo, e quando ela existe numa
// pose e nao na seguinte, o corpo salta essa diferenca inteira de uma vez. No
// meio de um golpe isso colapsa a corrente pe-quadril-tronco-braco num
// instante so (auditoria de cadeia: "corpo se movendo como bloco"), e a
// corrente e justamente o que faz o golpe ter peso.

const aplicarPostura = (pose: Pose, peso: number): Pose => {
  if (Math.abs(peso) < 0.05) return pose;
  // a base abre no pesado, mas NUNCA alem do que a perna alcanca: passando
  // do alcance util, o planejamento dos pes entende como perna esticada e
  // manda dar passos no lugar (ver PASSO_MINIMO)
  const largura = 1 + 0.16 * peso;
  const altura = 1 - 0.05 * peso;
  const inclinacao = 7 * peso;
  const mexer = (p: Vec2 | undefined, dx: number, esc = 1): Vec2 | undefined =>
    p ? { x: p.x * esc + dx, y: p.y } : p;
  return {
    ...pose,
    // tronco e cabeca vao para frente no pesado, ficam retos no rapido
    neck: mexer(pose.neck, inclinacao),
    head: mexer(pose.head, inclinacao * 1.5),
    // a base abre e o quadril baixa (o pe fica mais perto do quadril)
    footBack: pose.footBack
      ? { x: pose.footBack.x * largura, y: pose.footBack.y * altura }
      : pose.footBack,
    footFront: pose.footFront
      ? { x: pose.footFront.x * largura, y: pose.footFront.y * altura }
      : pose.footFront,
    kneeBack: pose.kneeBack
      ? { x: pose.kneeBack.x * largura, y: pose.kneeBack.y * altura }
      : pose.kneeBack,
    kneeFront: pose.kneeFront
      ? { x: pose.kneeFront.x * largura, y: pose.kneeFront.y * altura }
      : pose.kneeFront,
  };
};

/** -1 puro rapido, +1 puro pesado */
export const pesoDoLutador = (id: FighterId): number => {
  const { speed, power } = PRESETS[id].profile;
  return Math.max(-1, Math.min(1, power - speed));
};

const corpoBase = (
  timeline: Timeline,
  id: FighterId,
  frame: number,
): Corpo => {
  const { fighterA, fighterB } = timeline.spec;
  const outroId = id === fighterA ? fighterB : fighterA;
  const preset = PRESETS[id];

  const a = amostrar(timeline.tracks[id], frame);
  const b = amostrar(timeline.tracks[outroId], frame);

  // cada um sempre encara o outro: sem isso o golpe sai de costas
  const facing: 1 | -1 = a.x <= b.x ? 1 : -1;

  // meia volta de defasagem para o segundo lutador: os dois respirando em
  // sincronia denunciaria que a respiracao e a mesma funcao
  const defasagem = id === fighterA ? 0 : Math.PI;
  const respirando = POSES_QUE_RESPIRAM.has(a.poseNome)
    ? respirar(a.pose, frame, defasagem)
    : a.pose;
  const { giro, fechamento, inicio: inicioDoGiro } = giroNoQuadro(
    timeline.tracks[id],
    frame,
  );
  let pose = estreitarNoGiro(
    a.poseNome === "guard" ? gingar(respirando, frame, defasagem) : respirando,
    fechamento,
  );
  // a postura do lutador por cima da pose (ver aplicarPostura)
  if (POSES_COM_POSTURA.has(a.poseNome)) {
    pose = aplicarPostura(pose, pesoDoLutador(id));
  }

  // DANCA DA VITORIA: por cima de tudo, entrando em 12 quadros a partir da
  // guarda (misturada em angulos, os ossos nao esticam). Continua alguns
  // quadros depois do fim, enquanto a placa (abaixo) vira o corpo de frente.
  let rebolado = 0;
  const danca = timeline.scheduled.find(
    (b) =>
      b.beat.type === "danca" &&
      b.beat.who === id &&
      frame >= b.from &&
      frame < b.to + VIRA,
  );
  if (danca) {
    const t = frame - danca.from;
    const entrada = Math.min(1, t / 12);
    pose = misturar(pose, poseDaDanca(t), entrada * entrada * (3 - 2 * entrada));
    rebolado = reboladoDaDanca(t) * entrada;
  }
  // A PLACA: vira de frente e puxa a placa das costas
  const placa = timeline.scheduled.find(
    (b) => b.beat.type === "placa" && b.beat.who === id && frame >= b.from,
  );
  if (placa) {
    const t = frame - placa.from;
    const vira = Math.min(1, t / VIRA);
    const w = vira * vira * (3 - 2 * vira);
    pose = misturar(pose, poseDaPlaca(t), w);
    rebolado *= 1 - w;
  }

  // Em pose de ataque ou de reacao a inclinacao e zerada: a pose ja tem a
  // atitude do corpo desenhada, e girar o corpo no quadro do contato tirava o
  // punho do ponto onde a geometria calculou o contato.
  let spin = inclinacaoDesenhada(a) * facing;

  // GIRO DA QUEDA. Sobe e volta a zero ao longo do arco (meia volta de seno),
  // no sentido em que o corpo esta viajando.
  // So corpo ARREMESSADO rola no ar. Quem pula para golpear controla o
  // proprio corpo: aplicado a ele, o giro tombava o atacante 52 graus para
  // frente e o pulo terminava com ele deitado em cima do outro.
  const arco = POSES_ARREMESSADAS.has(a.poseNome)
    ? progressoDoVoo(timeline.tracks[id], frame)
    : -1;
  if (arco >= 0) {
    spin += Math.sin(arco * Math.PI) * GIRO_DA_QUEDA * Math.sign(a.velocidade || 1);
  }

  const compressao = compressaoDe(timeline, id, frame);
  const escala = escalaDoMundo(preset.scale);

  // PIVO NO PE DE APOIO. Com a base ja fechada (ver giroNoQuadro), girar em
  // volta do quadril ainda arrastava o pe de apoio num arco pelo chao. Aqui o
  // corpo e deslocado para o pe de tras ficar parado enquanto o quadril da a
  // volta em torno dele; como a base esta fechada, o quadril anda pouco.
  //
  // O pe fica onde estava NO INICIO da volta, e nao onde a pose atual o poe:
  // a carga continua se aprofundando durante o giro, e ancorar no pe da pose
  // atual fazia o pivo andar junto (15 unidades por quadro).
  let pivo = 0;
  if (giro !== 1 && inicioDoGiro !== undefined) {
    const noInicio = amostrar(timeline.tracks[id], inicioDoGiro);
    const peNoInicio =
      noInicio.x +
      completar(estreitarNoGiro(noInicio.pose, 1)).footBack.x * escala * facing;
    const peAgora =
      completar(pose).footBack.x * escala * facing * giroVisivel(giro);
    // Entra e sai junto com o giro: aplicado inteiro, o deslocamento sumia
    // de uma vez quando o giro voltava a 1, e o corpo saltava 71 unidades
    // no quadro seguinte ao fim da volta.
    //
    // Inteiro enquanto os pes estao soltos (giro < 0,75, ver `girando`), e
    // so desvanece quando os pes plantados ja voltaram a segurar o apoio:
    // desvanecendo antes, o pe de apoio deslizava nas duas pontas da volta.
    const pesoDoPivo = giro < 0.75 ? 1 : (1 - giro) / 0.25;
    pivo = (peNoInicio - peAgora - a.x) * pesoDoPivo;
  }

  // APOIO: o pe mais baixo encosta no chao. Medido no corpo JA INCLINADO E
  // ESPELHADO, e nao na pose crua: o spin gira o esqueleto em volta do
  // quadril, entao o pe mais baixo da pose deixa de ser o pe mais baixo na
  // tela. A primeira versao usava a pose crua e deixava 20 quadros com o pe
  // fora do chao, o pior a 53 unidades.
  const local = juntasNoMundo(pose, {
    baseX: 0,
    baseY: 0,
    facing,
    scale: preset.scale,
    spin,
    giro,
  });
  // O ponto mais baixo do CORPO, e nao so dos pes. Em pe da no mesmo; mas o
  // corpo que cai de costas apoia nas costas e na cabeca, e o que levanta
  // apoia na mao. Medindo so os pes, o corpo deitado com as pernas no ar
  // afundava o tronco inteiro abaixo do chao.
  const raioCabeca = (preset.headRadius - preset.limbWidth / 2) * preset.scale;
  let apoio = local.head.y + raioCabeca;
  for (const junta of Object.keys(local) as (keyof typeof local)[]) {
    if (junta === "head") continue;
    apoio = Math.max(apoio, local[junta].y);
  }
  const voo = alturaDoVoo(timeline.tracks[id], frame);

  /*
    CABECA ESTAVEL NA CORRIDA.

    Andando e correndo, o quadril sobe e desce a cada passada -- a perna que
    dobra baixa o corpo, e isso e emergente da cinematica, nao um seno colado
    por cima. Mas um corpo humano NAO deixa a cabeca acompanhar essa oscilacao
    inteira: o pescoco e o tronco absorvem parte dela, e o olhar fica mais
    estavel que o quadril. E por isso que corredor filmado de lado tem a
    cabeca quase em linha reta enquanto o quadril sobe e desce visivelmente.

    Sem essa compensacao o boneco inteiro quica como bloco, que e uma das
    coisas que mais denunciam ciclo de caminhada amador.

    A compensacao e PARCIAL de proposito. Zerar a oscilacao da cabeca deixaria
    o pescoco esticando e encolhendo a cada passo, que e pior: o defeito
    trocaria de lugar em vez de sumir.
  */
  const oscilacao = apoio - PE_NO_CHAO * escala;
  if (POSES_DE_LOCOMOCAO.has(a.poseNome) && Math.abs(oscilacao) > 0.5) {
    const cabeca = pose.head;
    const pescoco = pose.neck;
    if (cabeca) pose.head = { x: cabeca.x, y: cabeca.y + oscilacao * 0.45 };
    if (pescoco) pose.neck = { x: pescoco.x, y: pescoco.y + oscilacao * 0.2 };
  }

  return {
    x: a.x + pivo + rebolado,
    baseY: (-apoio - voo) * compressao,
    facing,
    scale: preset.scale * compressao,
    spin,
    giro,
    pose,
    poseNome: a.poseNome,
    noAr: voo > 0.5,
    velocidade: a.velocidade,
    aceleracao: a.aceleracao,
    agachamento: apoio - PE_NO_CHAO * escala,
    correcaoDaMira: 0,
    alcancou: true,
  };
};

// ===========================================================================
// PES PLANTADOS
// ===========================================================================
//
// A pose diz onde o pe fica em relacao ao QUADRIL. Se o quadril anda, o pe
// anda junto, e um pe que anda encostado no chao e patinacao: a auditoria
// mediu 6.000 unidades de pe deslizando numa luta de 8 segundos. E o defeito
// que mais faz um lutador parecer boneco arrastado.
//
// Aqui o pe que encosta no chao e PREGADO no mundo, e a perna se resolve por
// cinematica inversa para alcanca-lo. Quando o corpo se afasta demais do pe
// pregado (a perna nao alcanca, ou o pe ficou longe de onde a pose quer),
// o pe DA UM PASSO: levanta, viaja em arco e planta de novo. E o que faz o
// peso ser transferido de um pe para o outro em vez de o corpo flutuar.
//
// Resolvido em sequencia, quadro a quadro, porque "onde o pe foi plantado"
// depende do passado. Continua sendo funcao pura da timeline: o resultado e
// calculado uma vez por lutador e guardado, e todo quadro consulta a mesma
// tabela.

/** Poses em que o corpo esta de pe e os pes podem apoiar. */
export const POSES_DE_APOIO = new Set<PoseName>([
  "idle", "guard", "coil",
  "walk1", "walk2", "run1", "run2", "sprint1", "sprint2",
  "advance", "retreat", "land",
  "block", "dodge", "duck", "stagger",
  "punch", "punchFast", "punchHeavy", "uppercut",
  "kick", "kickLow", "kickHigh", "spinKick", "knee", "elbow", "charge",
  "hitHead", "hitChest", "hitBody", "hitLeg",
  "guardaKatana", "bloqueioKatana", "cargaKatana", "cargaBaixa",
  "absorver", "absorverKatana", "pousoKatana",
  "corteSobe", "corteDesce", "corteLateral", "corteRapido", "corteMergulho",
  "corridaKatana1", "corridaKatana2", "saltoParaTras", "lancar", "bracosFrente",
  "katanaErguida",
]);

const POSES_DE_LOCOMOCAO = new Set<PoseName>([
  "walk1", "walk2", "run1", "run2", "sprint1", "sprint2", "advance", "retreat",
]);

/** Pe a menos disto do chao (unidades de mundo) esta apoiado. */
const ALTURA_DE_APOIO = 14;
/**
 * Acima desta velocidade do quadril (unidades por quadro) o corpo esta sendo
 * ARRASTADO por um golpe, e pe arrastado desliza de verdade.
 */
const VELOCIDADE_DE_ARRASTO = 16;
/**
 * Pe pregado mais longe que isto de onde a pose o quer da um passo.
 *
 * Com 85 o pe ficava pregado longe demais e a IK esticava a perna: depois de
 * um bloqueio o lutador ficava de pernas retas, base aberta, sem guarda
 * nenhuma. Mais curto, ele reajusta a base com um passo, que e o que um
 * lutador faz o tempo todo.
 */
const DISTANCIA_DO_PASSO = 55;
/**
 * Deslocamento minimo para um passo existir, em unidades de mundo.
 *
 * Abaixo disto o pe chegaria praticamente no mesmo lugar, e um passo que nao
 * sai do lugar nao e passo: e tremor.
 */
const PASSO_MINIMO = 18;
/** Fracao do alcance da perna acima da qual o pe precisa se mover. */
const ALCANCE_UTIL = 0.97;
/** Perto do chao (unidades de mundo) o pe esta sujeito ao limite abaixo. */
const ALTURA_DO_ESTALO = 20;
/** O mais longe que um pe anda num quadro rente ao chao. */
const PASSO_MAXIMO_POR_QUADRO = 28;
/** Altura minima do pe quando o limite acima o obriga a dar um passo. */
const ALTURA_DO_PASSINHO = 10;

/** Quadros para o pe sair do chao sem estalo quando deixa de apoiar. */
const QUADROS_DE_SOLTURA = 5;

type EstadoDoPe = {
  modo: "livre" | "plantado" | "passo" | "soltando";
  /** x onde esta pregado */
  px: number;
  /** passo ou soltura: de onde saiu e quando */
  de: Vec2;
  ini: number;
  dur: number;
  /** ultima posicao entregue */
  ultimo: Vec2;
};

type PlanoDosPes = {
  alvo: Record<"footFront" | "footBack", { x: Float64Array; y: Float64Array; peso: Float64Array }>;
};

const POSE_BASE = poseBase();
const distancia = (a: Vec2, b: Vec2) => Math.hypot(b.x - a.x, b.y - a.y);

const CACHE_DOS_PES = new WeakMap<Timeline, Map<FighterId, PlanoDosPes>>();

const PES = ["footFront", "footBack"] as const;

const planejarPes = (timeline: Timeline, id: FighterId): PlanoDosPes => {
  let porLutador = CACHE_DOS_PES.get(timeline);
  if (!porLutador) {
    porLutador = new Map();
    CACHE_DOS_PES.set(timeline, porLutador);
  }
  const pronto = porLutador.get(id);
  if (pronto) return pronto;

  const n = timeline.durationInFrames + 2;
  const plano: PlanoDosPes = {
    alvo: {
      footFront: { x: new Float64Array(n), y: new Float64Array(n), peso: new Float64Array(n) },
      footBack: { x: new Float64Array(n), y: new Float64Array(n), peso: new Float64Array(n) },
    },
  };
  const estado: Record<(typeof PES)[number], EstadoDoPe> = {
    footFront: { modo: "livre", px: 0, de: { x: 0, y: 0 }, ini: 0, dur: 1, ultimo: { x: 0, y: 0 } },
    footBack: { modo: "livre", px: 0, de: { x: 0, y: 0 }, ini: 0, dur: 1, ultimo: { x: 0, y: 0 } },
  };
  const perna =
    (distancia(POSE_BASE.hip, POSE_BASE.kneeFront) +
      distancia(POSE_BASE.kneeFront, POSE_BASE.footFront)) *
    escalaDoMundo(PRESETS[id].scale);

  for (let f = 0; f < n; f++) {
    const c = corpoBase(timeline, id, f);
    const j = juntasDoCorpo(c);
    // Girando no eixo vertical o esqueleto esta achatado: a conversao do alvo
    // do pe para o espaco da perna explode perto do perfil (giro ~ 0) e a IK
    // da perna se debatia. Durante a volta os pes seguem a pose.
    // (com o corpo pelo menos 75% de frente a conversao ja e estavel, e e
    // melhor os pes voltarem a pisar: o fim da volta vira um passo)
    const girando = c.giro < 0.75;
    const podeApoiar =
      !c.noAr &&
      POSES_DE_APOIO.has(c.poseNome) &&
      // andando, o pe de apoio SEMPRE prega, em qualquer velocidade: e
      // exatamente ai que a patinacao aparece. So o corpo EMPURRADO arrasta.
      (POSES_DE_LOCOMOCAO.has(c.poseNome) ||
        Math.abs(c.velocidade) <= VELOCIDADE_DE_ARRASTO) &&
      // girando no eixo vertical o pe de apoio pivota: nao ha onde pregar
      !girando;

    for (const pe of PES) {
      const st = estado[pe];
      const outro = estado[pe === "footFront" ? "footBack" : "footFront"];
      const cru = j[pe];
      const noChao = cru.y > -ALTURA_DE_APOIO;
      let saida: Vec2 = cru;
      let peso = 0;

      if (!podeApoiar || !noChao) {
        if (st.modo === "plantado" || st.modo === "passo") {
          st.modo = "soltando";
          st.de = { ...st.ultimo };
          st.ini = f;
        }
        if (st.modo === "soltando") {
          const s = (f - st.ini) / QUADROS_DE_SOLTURA;
          if (s >= 1) {
            st.modo = "livre";
          } else {
            const e = suave(s);
            saida = {
              x: st.de.x + (cru.x - st.de.x) * e,
              y: st.de.y + (cru.y - st.de.y) * e,
            };
            peso = 1;
          }
        }
        // pe livre nunca atravessa o chao: a pose misturada pode passar o
        // pe por baixo da linha no meio de uma transicao (medido: 16 unidades
        // abaixo no recolher do chute giratorio)
        if (peso === 0 && cru.y > 0 && !girando) {
          saida = { x: cru.x, y: 0 };
          peso = 1;
        }
      } else {
        if (st.modo === "livre" || st.modo === "soltando") {
          // planta onde o pe esta AGORA na tela, nao onde a pose queria: sem
          // isso a soltura pela metade viraria um salto de posicao
          st.px = st.modo === "soltando" ? st.ultimo.x : cru.x;
          st.modo = "plantado";
        }
        if (st.modo === "plantado") {
          const erro = cru.x - st.px;
          const alcance = Math.hypot(st.px - j.hip.x, j.hip.y);
          // UM PASSO SO VALE SE ELE MUDA ALGUMA COISA.
          //
          // A perna esticada demais pede um passo, mas se a pose quer o pe
          // exatamente onde ele ja esta, esse passo cai no mesmo lugar, a
          // perna continua esticada e no quadro seguinte ele pede outro. Era
          // dai que vinha a perna tremendo: um lutador parado levantava um pe
          // a cada seis quadros, alternando, sem sair do lugar.
          const esticada = alcance > perna * ALCANCE_UTIL;
          const precisa =
            Math.abs(erro) > DISTANCIA_DO_PASSO ||
            (esticada && Math.abs(erro) > PASSO_MINIMO);
          // um pe de cada vez: os dois no ar ao mesmo tempo e pulo, nao passo
          if (precisa && outro.modo !== "passo") {
            st.modo = "passo";
            st.de = { x: st.px, y: 0 };
            st.ini = f;
            st.dur = Math.max(6, Math.min(12, Math.round(Math.abs(erro) / 14)));
          } else {
            saida = { x: st.px, y: 0 };
            peso = 1;
          }
        }
        if (st.modo === "passo") {
          const s = Math.min(1, (f - st.ini) / st.dur);
          const e = suave(s);
          const altura = Math.min(46, Math.abs(cru.x - st.de.x) * 0.22 + 14);
          saida = {
            x: st.de.x + (cru.x - st.de.x) * e,
            y: -Math.sin(Math.PI * s) * altura,
          };
          peso = 1;
          if (s >= 1) {
            st.modo = "plantado";
            st.px = cru.x;
            saida = { x: st.px, y: 0 };
          }
        }
      }

      // LIMITE DE VELOCIDADE DO PE PERTO DO CHAO. Transicao de pose (parado
      // para corrida, fim de passo) podia levar o pe 40 a 70 unidades num
      // quadro: o pe teleportava rente ao chao. Pe de verdade, perto do chao,
      // anda no maximo o que um passo anda. Aqui ele chega no mesmo lugar,
      // so que em alguns quadros.
      if (
        f > 0 &&
        !c.noAr &&
        !girando &&
        saida.y > -ALTURA_DO_ESTALO &&
        Math.abs(c.velocidade) <= VELOCIDADE_DE_ARRASTO
      ) {
        const dx = saida.x - st.ultimo.x;
        const dy = saida.y - st.ultimo.y;
        const d = Math.hypot(dx, dy);
        if (d > PASSO_MAXIMO_POR_QUADRO) {
          const k = PASSO_MAXIMO_POR_QUADRO / d;
          // pe que precisa andar tanto esta DANDO UM PASSO: sai do chao. Preso
          // na altura em que estava, ele deslizava rente ao chao.
          saida = {
            x: st.ultimo.x + dx * k,
            y: Math.min(st.ultimo.y + dy * k, -ALTURA_DO_PASSINHO),
          };
          peso = 1;
          if (st.modo === "plantado") st.px = saida.x;
        }
      }

      st.ultimo = saida;
      plano.alvo[pe].x[f] = saida.x;
      plano.alvo[pe].y[f] = saida.y;
      plano.alvo[pe].peso[f] = peso;
    }
  }

  porLutador.set(id, plano);
  return plano;
};

/**
 * IK com entrada e saida EM ANGULO.
 *
 * mirarMembro mistura a pose e a solucao do IK por POSICAO de junta, e no meio
 * do caminho isso corta o arco: medido no soco pesado, o punho mergulhava 160
 * unidades entre dois quadros e subia de volta. Aqui o IK resolve inteiro e a
 * entrada dele e feita pela mistura por angulo do rig: o braco GIRA ate a
 * solucao, como todo o resto do corpo.
 */
const mirarPorAngulo = (
  pose: Pose,
  junta: JointName,
  alvo: Vec2,
  peso: number,
): { pose: Pose; erro: number; alcancou: boolean } => {
  const r = mirarMembro(pose, junta, alvo, 1);
  if (peso >= 0.999) return r;
  return { ...r, pose: misturar(pose, r.pose, peso) };
};

/** Corpo com os pes resolvidos, ainda sem a mira do golpe. */
const corpoPlantado = (
  timeline: Timeline,
  id: FighterId,
  frame: number,
): Corpo => {
  const eu = corpoBase(timeline, id, frame);
  // na volta do giro nao ha IK de perna (ver `girando` no planejamento)
  if (eu.giro < 0.75) return eu;
  const plano = planejarPes(timeline, id);
  const ultimo = timeline.durationInFrames + 1;
  const f0 = Math.max(0, Math.min(ultimo, Math.floor(frame)));
  const f1 = Math.min(ultimo, f0 + 1);
  const k = Math.max(0, Math.min(1, frame - f0));

  let pose = eu.pose;
  for (const pe of PES) {
    const a = plano.alvo[pe];
    const peso = a.peso[f0] + (a.peso[f1] - a.peso[f0]) * k;
    if (peso <= 0.001) continue;
    const alvo = {
      x: a.x[f0] + (a.x[f1] - a.x[f0]) * k,
      y: a.y[f0] + (a.y[f1] - a.y[f0]) * k,
    };
    const local = paraLocal(alvo, transformDoCorpo(eu));
    pose = mirarPorAngulo(pose, pe, local, peso).pose;
  }
  return { ...eu, pose };
};

/** A mira ativa deste lutador neste quadro, se houver. */
const miraAtiva = (
  timeline: Timeline,
  id: FighterId,
  frame: number,
): AimEvent | undefined =>
  // GOLPE DE ARMA nao usa cinematica inversa. O braco tem ~200 unidades de
  // alcance e a lamina outras 290: o ponto de contato fica bem alem do que a
  // mao alcanca, entao mirar a MAO nele so torcia o braco e piorava (medido:
  // o erro da ponta subia de 30 para 300). Quem resolve o contato de arma e a
  // distancia de combate, calculada a partir da ponta nesta pose.
  timeline.aims.find(
    (m) => m.who === id && !m.recuo && frame >= m.from && frame <= m.to,
  );

/**
 * Resolve o corpo de um lutador no quadro pedido, ja com a mira corrigida.
 *
 * O APOIO e calculado antes do IK de proposito: o IK move apenas o membro
 * atacante, e o membro atacante nunca e o pe de apoio. Assim a altura do
 * quadril continua valida e o personagem nao sai do chao ao golpear.
 */
export const corpoNoQuadro = (
  timeline: Timeline,
  id: FighterId,
  frame: number,
): Corpo => {
  const eu = corpoPlantado(timeline, id, frame);
  const aim = miraAtiva(timeline, id, frame);
  if (!aim) return eu;

  const peso = pesoDaMira(aim, frame);
  if (peso <= 0.001) return eu;

  const alvo = corpoPlantado(timeline, aim.alvo, aim.congelarEm ?? frame);
  const noMundo = pontoDoAlvo(aim.ponto as PontoAlvo, juntasDoCorpo(alvo));

  // O ALVO DO IK E A SUPERFICIE DO CORPO, NAO O EIXO DA JUNTA.
  //
  // pontoDoAlvo devolve o eixo do tronco; a superficie fica meia espessura de
  // membro a frente, dos dois lados. Com membro fino a diferenca passava
  // despercebida, mas ao triplicar a espessura para bater com a referencia ela
  // virou 68 unidades: o punho mirava no EIXO e afundava o membro inteiro
  // dentro do adversario.
  const folga = folgaDesejada(id, aim.alvo);
  noMundo.x -= folga * aim.direcao;

  // FOLLOW-THROUGH: depois do contato o alvo da mira avanca, entao o membro
  // PASSA do ponto antes de voltar. Membro que para exatamente onde acertou
  // le como golpe sem massa; o que da peso e ele continuar e ser recolhido.
  const depois = frame - aim.contact;
  if (depois > 0) {
    const t = Math.min(1, depois / QUADROS_DO_AVANCO);
    // sobe rapido e volta: sin de meia volta
    const dir = aim.direcaoDoAvanco ?? { x: 1, y: 0 };
    const k = Math.sin(t * Math.PI) * aim.avanco;
    noMundo.x += k * dir.x * aim.direcao;
    noMundo.y += k * dir.y;
  }

  const alvoLocal = paraLocal(noMundo, transformDoCorpo(eu));

  const r = mirarPorAngulo(eu.pose, aim.joint, alvoLocal, peso);
  return {
    ...eu,
    pose: r.pose,
    correcaoDaMira: r.erro,
    alcancou: r.alcancou,
  };
};

/** Altura do quadril neutra, para quem so precisa de uma referencia. */
export const BASE_Y_NEUTRO = -ALTURA_QUADRIL;

/**
 * Altura do quadril de uma pose APOIADA, sem consultar trilha nenhuma.
 * O compilador precisa disto e roda antes de existir trilha.
 */
export const baseYDaPose = (pose: Pose, escalaDoLutador: number): number =>
  -peMaisBaixo(pose) * escalaDoMundo(escalaDoLutador);

/** Ponto do mundo no meio do corpo, util para camera e efeitos. */
export const centroDoCorpo = (c: Corpo): Vec2 => ({
  x: c.x,
  y: c.baseY - 120,
});
