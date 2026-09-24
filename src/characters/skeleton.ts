/**
 * Esqueleto do stickman: converte uma POSE em coordenadas de mundo.
 *
 * Sistema de coordenadas: o chao e y = 0 e para CIMA e y negativo, igual ao
 * SVG. O quadril e a origem da pose, entao mover o personagem e mudar um unico
 * numero (baseX) sem recalcular junta nenhuma.
 *
 * Uma pose guarda DESLOCAMENTO de cada junta em relacao ao quadril, nao
 * angulo. Isso deixa a pose legivel e editavel na mao: "mao na altura do
 * ombro, 90 para frente" e um par de numeros, nao trigonometria.
 */

import type { JointName, Pose, Vec2 } from "../core/types";

/**
 * Escala aplicada a TODA pose.
 *
 * As poses foram escritas em unidades pequenas (o quadril ao pe da 92) porque
 * nesse tamanho o numero e legivel na mao. A escala leva isso para o tamanho
 * de mundo que o video usa.
 *
 * Este valor veio de um bug real: ao portar do prototipo em Python eu trouxe o
 * raio da cabeca (62) mas esqueci a escala 2,6 que o prototipo aplicava nas
 * juntas. Resultado: cabeca 2,6x grande demais e boneco flutuando acima do
 * chao. Por isso a altura do quadril agora e DERIVADA daqui, e nao um numero
 * solto que pode divergir.
 */
export const ESCALA_POSE = 2.9;

/** Distancia do quadril ao pe na pose base, antes da escala. */
const QUADRIL_AO_PE = 92;

/**
 * Altura do quadril acima do chao. Derivada, para o pe sempre encostar no
 * chao quando baseY = -ALTURA_QUADRIL.
 */
export const ALTURA_QUADRIL = QUADRIL_AO_PE * ESCALA_POSE;

/**
 * Ossos desenhados, em ordem de profundidade: o que vem depois fica na frente.
 * O braco e a perna "de tras" vem primeiro de proposito, para o corpo ter
 * leitura de volume sem precisar de sombra.
 */
export const OSSOS: [JointName, JointName][] = [
  ["hip", "kneeBack"],
  ["kneeBack", "footBack"],
  ["neck", "shoulderBack"],
  ["shoulderBack", "elbowBack"],
  ["elbowBack", "handBack"],
  ["hip", "neck"],
  ["hip", "kneeFront"],
  ["kneeFront", "footFront"],
  ["neck", "shoulderFront"],
  ["shoulderFront", "elbowFront"],
  ["elbowFront", "handFront"],
  ["neck", "head"],
];

/** Juntas do braco e da perna de tras, para o componente poder pintar mais escuro. */
export const JUNTAS_FUNDO = new Set<JointName>([
  "shoulderBack",
  "elbowBack",
  "handBack",
  "kneeBack",
  "footBack",
]);

/**
 * Deslocamentos que toda pose herda. Uma pose so declara o que muda, o que
 * deixa cada entrada de poses.ts curta e faz a diferenca entre duas poses
 * ficar obvia na leitura.
 */
const BASE: Required<Pose> = {
  hip: { x: 0, y: 0 },
  neck: { x: 0, y: -74 },
  head: { x: 0, y: -114 },
  shoulderBack: { x: -14, y: -68 },
  elbowBack: { x: -20, y: -38 },
  handBack: { x: -4, y: -52 },
  shoulderFront: { x: 14, y: -68 },
  elbowFront: { x: 28, y: -38 },
  handFront: { x: 44, y: -56 },
  kneeBack: { x: -22, y: 46 },
  footBack: { x: -40, y: 92 },
  kneeFront: { x: 18, y: 46 },
  footFront: { x: 34, y: 92 },
};

export const TODAS_AS_JUNTAS = Object.keys(BASE) as JointName[];

/** Junta base, para quem quiser construir pose nova a partir dela. */
export const poseBase = (): Required<Pose> => ({
  hip: { ...BASE.hip },
  neck: { ...BASE.neck },
  head: { ...BASE.head },
  shoulderBack: { ...BASE.shoulderBack },
  elbowBack: { ...BASE.elbowBack },
  handBack: { ...BASE.handBack },
  shoulderFront: { ...BASE.shoulderFront },
  elbowFront: { ...BASE.elbowFront },
  handFront: { ...BASE.handFront },
  kneeBack: { ...BASE.kneeBack },
  footBack: { ...BASE.footBack },
  kneeFront: { ...BASE.kneeFront },
  footFront: { ...BASE.footFront },
});

/**
 * Y do pe na pose base. E a DEFINICAO de onde fica o chao.
 *
 * ALTURA_QUADRIL vem deste mesmo numero, entao uma pose cujo pe mais baixo
 * esteja em 92 apoia exatamente no chao quando baseY = -ALTURA_QUADRIL.
 */
export const PE_NO_CHAO = QUADRIL_AO_PE;

/**
 * Y do pe mais baixo da pose, em unidades de pose.
 *
 * E o que permite APOIAR o personagem no chao em vez de confiar que a pose foi
 * escrita com o pe no lugar certo. Medido: 13 das 39 poses estavam fora, e
 * sprint1 flutuava 106 unidades de mundo (18% de uma altura de corpo).
 */
export const peMaisBaixo = (pose: Pose): number => {
  const c = completar(pose);
  return Math.max(c.footFront.y, c.footBack.y);
};

/** Fator que leva unidades de pose para unidades de mundo. */
export const escalaDoMundo = (escalaDoLutador: number): number =>
  escalaDoLutador * ESCALA_POSE;

/**
 * OSSOS RIGIDOS, do tronco para as pontas.
 *
 * A ordem importa: o pai e corrigido antes do filho, senao corrigir o pai
 * desloca um filho que ja estava certo.
 */
const OSSOS_RIGIDOS: [JointName, JointName][] = [
  ["neck", "head"],
  ["shoulderFront", "elbowFront"],
  ["elbowFront", "handFront"],
  ["shoulderBack", "elbowBack"],
  ["elbowBack", "handBack"],
  ["hip", "kneeFront"],
  ["kneeFront", "footFront"],
  ["hip", "kneeBack"],
  ["kneeBack", "footBack"],
];

const distancia = (a: Vec2, b: Vec2) => Math.hypot(b.x - a.x, b.y - a.y);

/** Comprimento de cada osso na pose base. E a medida do personagem. */
const COMPRIMENTO = OSSOS_RIGIDOS.map(([a, b]) => distancia(BASE[a], BASE[b]));

/** Comprimento do tronco. Este pode comprimir um pouco (ver completar). */
const TRONCO = distancia(BASE.hip, BASE.neck);

/**
 * Compressao maxima do tronco.
 *
 * Diferente dos membros, o tronco PODE encurtar: e o squash da animacao
 * classica, e poses como land, squash e hitChest usam isso de proposito. O que
 * nao pode e encurtar sem limite, que seria erro disfarcado de estilo.
 */
const SQUASH_DO_TRONCO = 0.2;

/**
 * Ombro no referencial do TRONCO, nao do quadril.
 *
 * Guardado como (ao longo do tronco, perpendicular ao tronco) para que o ombro
 * acompanhe o tronco quando ele se inclina ou comprime.
 */
const ombroNoTronco = (ombro: Vec2) => {
  // na pose base o tronco aponta para cima: u = (0,-1), perpendicular = (1,0)
  const dx = ombro.x - BASE.neck.x;
  const dy = ombro.y - BASE.neck.y;
  return { aoLongo: -dy, perpendicular: dx };
};
const OMBRO_FRENTE = ombroNoTronco(BASE.shoulderFront);
const OMBRO_TRAS = ombroNoTronco(BASE.shoulderBack);

/**
 * Completa uma pose parcial com os deslocamentos base e IMPOE O ESQUELETO.
 *
 * Duas correcoes, e as duas existem porque pose escrita a mao e uma lista de
 * posicoes sem nenhuma restricao entre elas. Auditadas com um script que mede
 * cada osso em todas as poses:
 *
 * 1. OSSO NAO ESTICA. O braco de tras chegava a 400% do comprimento em
 *    "downed", o antebraco a 226% no "uppercut", e as pernas encurtavam 64%
 *    em "getUp". Parado isso passa por estilo; em movimento a interpolacao faz
 *    o comprimento variar quadro a quadro e a mao estica e encolhe como
 *    borracha. Aqui a DIRECAO continua sendo o que a pose pediu, e so a
 *    distancia e travada.
 *
 * 2. O OMBRO ACOMPANHA O TRONCO. Nenhuma das poses declara ombro, entao os
 *    ombros ficavam cravados no deslocamento base enquanto o pescoco se movia
 *    livre: em hitChest o pescoco vai para y=-46 e o ombro continuava em -68,
 *    ou seja 22 unidades ACIMA do pescoco. Os bracos nasciam de um ponto solto
 *    no espaco, sem relacao com o corpo. Agora o ombro e derivado do tronco e
 *    gira com ele.
 *
 * Vale tambem para poses MISTURADAS, porque a mistura passa por aqui. Isso
 * resolve de graca o problema que misturar() admitia no comentario: a mao
 * agora percorre um ARCO de raio constante em volta do cotovelo, em vez de
 * cortar reto e encurtar o membro no meio do caminho.
 */
export const completar = (pose: Pose): Required<Pose> => {
  const saida = poseBase();
  for (const junta of TODAS_AS_JUNTAS) {
    const v = pose[junta];
    if (v) saida[junta] = v;
  }

  // ---- tronco: comprimento limitado, direcao livre -------------------------
  let ux = saida.neck.x - saida.hip.x;
  let uy = saida.neck.y - saida.hip.y;
  const dTronco = Math.hypot(ux, uy);
  if (dTronco > 0.001) {
    const limitado = Math.max(
      TRONCO * (1 - SQUASH_DO_TRONCO),
      Math.min(TRONCO * (1 + SQUASH_DO_TRONCO), dTronco),
    );
    ux /= dTronco;
    uy /= dTronco;
    saida.neck = {
      x: saida.hip.x + ux * limitado,
      y: saida.hip.y + uy * limitado,
    };
  } else {
    ux = 0;
    uy = -1;
  }

  // ---- ombros: penduram no tronco e giram com ele --------------------------
  // perpendicular ao tronco, no sentido da frente
  const px = -uy;
  const py = ux;
  const ombro = (o: { aoLongo: number; perpendicular: number }): Vec2 => ({
    x: saida.neck.x + ux * o.aoLongo + px * o.perpendicular,
    y: saida.neck.y + uy * o.aoLongo + py * o.perpendicular,
  });
  // as direcoes ORIGINAIS dos bracos sao medidas a partir do ombro que a pose
  // assumia (o da base), entao guardamos o ombro antigo antes de mover
  const ombroAntigoFrente = saida.shoulderFront;
  const ombroAntigoTras = saida.shoulderBack;
  saida.shoulderFront = ombro(OMBRO_FRENTE);
  saida.shoulderBack = ombro(OMBRO_TRAS);

  const antigo: Partial<Record<JointName, Vec2>> = {
    shoulderFront: ombroAntigoFrente,
    shoulderBack: ombroAntigoTras,
  };

  // ---- membros e cabeca: comprimento exato, direcao da pose ---------------
  for (let i = 0; i < OSSOS_RIGIDOS.length; i++) {
    const [pai, filho] = OSSOS_RIGIDOS[i];
    // a intencao da pose e a direcao medida ANTES de qualquer correcao
    const origemDaDirecao = antigo[pai] ?? saida[pai];
    let dx = saida[filho].x - origemDaDirecao.x;
    let dy = saida[filho].y - origemDaDirecao.y;
    const d = Math.hypot(dx, dy);
    if (d < 0.001) {
      // sem direcao declarada: usa a da pose base
      dx = BASE[filho].x - BASE[pai].x;
      dy = BASE[filho].y - BASE[pai].y;
    }
    const norma = Math.hypot(dx, dy) || 1;
    antigo[filho] = saida[filho];
    saida[filho] = {
      x: saida[pai].x + (dx / norma) * COMPRIMENTO[i],
      y: saida[pai].y + (dy / norma) * COMPRIMENTO[i],
    };
  }

  return saida;
};

/**
 * CADEIA DE CADA MEMBRO, da raiz para a ponta.
 *
 * A raiz do braco e o OMBRO, que por sua vez e derivado do tronco: quando o
 * tronco gira, a cadeia inteira gira com ele.
 */
export const CADEIA_DO_MEMBRO: Partial<Record<JointName, JointName[]>> = {
  handFront: ["shoulderFront", "elbowFront", "handFront"],
  handBack: ["shoulderBack", "elbowBack", "handBack"],
  footFront: ["hip", "kneeFront", "footFront"],
  footBack: ["hip", "kneeBack", "footBack"],
  // cadeias de UM osso, para golpe de cotovelo e de joelho: nao ha junta
  // intermediaria para dobrar, so a direcao do osso para escolher
  elbowFront: ["shoulderFront", "elbowFront"],
  elbowBack: ["shoulderBack", "elbowBack"],
  kneeFront: ["hip", "kneeFront"],
  kneeBack: ["hip", "kneeBack"],
};

/** Soma dos comprimentos de uma cadeia: o alcance maximo do membro. */
export const alcanceDaCadeia = (cadeia: JointName[]): number => {
  let total = 0;
  for (let i = 0; i < cadeia.length - 1; i++) {
    total += distancia(BASE[cadeia[i]], BASE[cadeia[i + 1]]);
  }
  return total;
};

/**
 * CINEMATICA INVERSA de dois ossos.
 *
 * Dada a raiz, o alvo e os dois comprimentos, devolve onde a junta do meio e a
 * ponta tem que estar para a ponta encostar no alvo. E o problema de encontrar
 * a intersecao de dois circulos, que tem solucao fechada: nada de iteracao.
 *
 *          meio
 *          /   \        L1 = raiz..meio
 *      L1 /     \ L2    L2 = meio..ponta
 *        /       \      d  = raiz..alvo
 *     raiz ------ alvo
 *              d
 *
 *   a = (L1^2 - L2^2 + d^2) / 2d     projecao do meio sobre a reta raiz-alvo
 *   h = sqrt(L1^2 - a^2)             afastamento do meio em relacao a reta
 *
 * Existem duas solucoes, uma para cada lado da reta (cotovelo para cima ou
 * para baixo). Escolhemos a que tem o MESMO SENTIDO DE DOBRA da pose escrita a
 * mao, para o IK corrigir a mira sem inverter o desenho do membro.
 *
 * Quando o alvo esta fora de alcance, o membro estica na direcao dele em vez
 * de a conta explodir: golpe curto continua sendo um golpe curto.
 */
export const resolverDoisOssos = (
  raiz: Vec2,
  alvo: Vec2,
  L1: number,
  L2: number,
  meioOriginal: Vec2,
  pontaOriginal: Vec2,
): { meio: Vec2; ponta: Vec2; alcancou: boolean } => {
  let dx = alvo.x - raiz.x;
  let dy = alvo.y - raiz.y;
  let d = Math.hypot(dx, dy);
  if (d < 0.0001) {
    dx = 1;
    dy = 0;
    d = 1;
  }

  const minimo = Math.abs(L1 - L2) + 0.001;
  const maximo = L1 + L2 - 0.001;
  const alcancou = d >= minimo && d <= maximo;
  const limitado = Math.max(minimo, Math.min(maximo, d));
  const k = limitado / d;
  dx *= k;
  dy *= k;
  d = limitado;

  const ux = dx / d;
  const uy = dy / d;
  const a = (L1 * L1 - L2 * L2 + d * d) / (2 * d);
  const h = Math.sqrt(Math.max(0, L1 * L1 - a * a));
  const nx = -uy;
  const ny = ux;

  const ponta = { x: raiz.x + dx, y: raiz.y + dy };

  /** sentido de dobra: sinal do produto vetorial raiz->meio x meio->ponta */
  const dobra = (meio: Vec2, p: Vec2) =>
    (meio.x - raiz.x) * (p.y - meio.y) - (meio.y - raiz.y) * (p.x - meio.x);

  const desejado = dobra(meioOriginal, pontaOriginal);
  const opcao = (s: number) => ({
    x: raiz.x + ux * a + nx * h * s,
    y: raiz.y + uy * a + ny * h * s,
  });
  const positiva = opcao(1);
  const negativa = opcao(-1);
  const meio =
    Math.sign(dobra(positiva, ponta)) === Math.sign(desejado)
      ? positiva
      : negativa;

  return { meio, ponta, alcancou };
};

/** Desfaz a transformacao: ponto de mundo para as unidades da pose. */
export const paraLocal = (mundo: Vec2, t: Transformacao): Vec2 => {
  const rad = ((t.spin ?? 0) * Math.PI) / 180;
  const cos = Math.cos(rad);
  const sen = Math.sin(rad);
  const dx = mundo.x - t.baseX;
  const dy = mundo.y - t.baseY;
  // rotacao inversa
  const ex = dx * cos + dy * sen;
  const ey = -dx * sen + dy * cos;
  const escala = t.scale * ESCALA_POSE;
  return { x: ex / (t.facing * escala), y: ey / escala };
};

/**
 * MIRA o membro atacante num ponto, em unidades da pose.
 *
 * Isto e o que garante que o golpe encoste nos DOIS eixos. A distancia de
 * combate resolve o horizontal por construcao, mas o vertical vinha da pose:
 * medido, o punho acertava 58 unidades ABAIXO do peito, na altura do estomago,
 * e a correcao era mexer nos numeros da pose a mao. Isso nao escala para 16
 * ataques vezes 5 pontos de alvo.
 *
 * A saida e uma pose DECLARADA, e nao a pose final: completar() vai reimpor os
 * comprimentos dos ossos depois, e ela mede a direcao de cada osso a partir da
 * junta que a POSE declarou, nao da corrigida. Entao aqui devolvemos
 * deslocamentos que, passados por completar(), produzem exatamente a solucao
 * do IK. Sem isso o IK seria desfeito na etapa seguinte.
 *
 * `peso` permite a correcao entrar e sair sem estalo: 0 mantem a pose escrita
 * a mao, 1 poe a ponta exatamente no alvo.
 */
export const mirarMembro = (
  pose: Pose,
  ponta: JointName,
  alvoLocal: Vec2,
  peso: number,
): { pose: Pose; erro: number; alcancou: boolean } => {
  const cadeia = CADEIA_DO_MEMBRO[ponta];
  if (!cadeia || peso <= 0) {
    return { pose, erro: 0, alcancou: true };
  }
  const c = completar(pose);
  const lerp = (a: Vec2, b: Vec2): Vec2 => ({
    x: a.x + (b.x - a.x) * peso,
    y: a.y + (b.y - a.y) * peso,
  });

  // ---- cadeia de UM osso: so escolher a direcao -------------------------
  if (cadeia.length === 2) {
    const [raizN, pontaN] = cadeia;
    const raiz = c[raizN];
    const L = distancia(raiz, c[pontaN]);
    const dx = alvoLocal.x - raiz.x;
    const dy = alvoLocal.y - raiz.y;
    const d = Math.hypot(dx, dy) || 1;
    const alvoNoOsso = { x: raiz.x + (dx / d) * L, y: raiz.y + (dy / d) * L };
    const fim = lerp(c[pontaN], alvoNoOsso);
    const declaradaRaiz = pose[raizN] ?? BASE[raizN];
    return {
      pose: {
        ...pose,
        [pontaN]: {
          x: declaradaRaiz.x + (fim.x - raiz.x),
          y: declaradaRaiz.y + (fim.y - raiz.y),
        },
      },
      erro: distancia(c[pontaN], alvoNoOsso),
      alcancou: Math.abs(d - L) < 1,
    };
  }

  // ---- cadeia de DOIS ossos: intersecao de circulos ---------------------
  const [raizN, meioN, pontaN] = cadeia;
  const raiz = c[raizN];
  const L1 = distancia(raiz, c[meioN]);
  const L2 = distancia(c[meioN], c[pontaN]);

  const sol = resolverDoisOssos(raiz, alvoLocal, L1, L2, c[meioN], c[pontaN]);
  const meio = lerp(c[meioN], sol.meio);
  const fim = lerp(c[pontaN], sol.ponta);

  // devolve DESLOCAMENTO declarado, para sobreviver ao completar() seguinte
  const declaradaRaiz = pose[raizN] ?? BASE[raizN];
  const dMeio = {
    x: declaradaRaiz.x + (meio.x - raiz.x),
    y: declaradaRaiz.y + (meio.y - raiz.y),
  };
  const dPonta = {
    x: dMeio.x + (fim.x - meio.x),
    y: dMeio.y + (fim.y - meio.y),
  };

  return {
    pose: { ...pose, [meioN]: dMeio, [pontaN]: dPonta },
    erro: distancia(c[pontaN], sol.ponta),
    alcancou: sol.alcancou,
  };
};

/**
 * Interpola duas poses. t=0 devolve a, t=1 devolve b.
 *
 * Interpolar DESLOCAMENTO (e nao angulo) pode encurtar o membro no meio do
 * caminho, mas completar() reimpoe o comprimento depois, entao a mao percorre
 * um arco de raio constante.
 */
export const misturar = (a: Pose, b: Pose, t: number): Required<Pose> => {
  const ca = completar(a);
  const cb = completar(b);
  const saida = poseBase();
  for (const junta of TODAS_AS_JUNTAS) {
    saida[junta] = {
      x: ca[junta].x + (cb[junta].x - ca[junta].x) * t,
      y: ca[junta].y + (cb[junta].y - ca[junta].y) * t,
    };
  }
  return saida;
};

export type Transformacao = {
  /** posicao do quadril no mundo */
  baseX: number;
  /** altura do quadril; negativo e para cima a partir do chao */
  baseY: number;
  /** 1 olha para a direita, -1 para a esquerda */
  facing: 1 | -1;
  scale: number;
  /** rotacao do corpo inteiro em graus, em torno do quadril (chute giratorio) */
  spin?: number;
};

/** Aplica a transformacao e devolve as juntas em coordenadas de mundo. */
export const juntasNoMundo = (
  pose: Pose,
  t: Transformacao,
): Record<JointName, Vec2> => {
  const c = completar(pose);
  const rad = ((t.spin ?? 0) * Math.PI) / 180;
  const cos = Math.cos(rad);
  const sen = Math.sin(rad);
  const saida = {} as Record<JointName, Vec2>;

  for (const junta of TODAS_AS_JUNTAS) {
    // espelha, escala (ESCALA_POSE leva a pose para unidades de mundo), gira
    // em torno do quadril e por fim translada
    const escala = t.scale * ESCALA_POSE;
    const ex = c[junta].x * t.facing * escala;
    const ey = c[junta].y * escala;
    saida[junta] = {
      x: t.baseX + ex * cos - ey * sen,
      y: t.baseY + ex * sen + ey * cos,
    };
  }
  return saida;
};
