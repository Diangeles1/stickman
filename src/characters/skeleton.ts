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
 * Pose completa e com as articulacoes dobrando para o lado certo.
 *
 * Aplicada UMA vez, na biblioteca de poses, e nao dentro de completar(): o IK
 * de golpe de cotovelo e de joelho move exatamente a junta do meio, e
 * corrigir depois dele desfazia a mira (o cotovelo saia 92 unidades do alvo).
 * Poses anatomicas na origem bastam: a mistura por angulo nunca troca o sinal
 * de uma dobra, e o IK de dois ossos preserva o sentido da pose.
 */
export const anatomizar = (pose: Pose): Required<Pose> => {
  const saida = completar(pose);
  for (const [raiz, meio, ponta, sinal, tolerancia] of DOBRAS) {
    anatomico(saida, raiz, meio, ponta, sinal, tolerancia);
  }
  return saida;
};

/**
 * DOBRA ANATOMICA: joelho e cotovelo so dobram para um lado.
 *
 * Com o lutador olhando para +x, a canela so gira PARA TRAS em relacao a
 * coxa (o joelho aponta para frente) e o antebraco so fecha PARA FRENTE em
 * relacao ao braco (o cotovelo aponta para tras). Medido na biblioteca de
 * poses com o rig por angulos: 18 das 39 poses tinham joelho ou cotovelo
 * invertido, varios em mais de 90 graus (o braco de tras do soco a 154). Em
 * pose parada isso passa despercebido; em movimento e o "membro quebrado" que
 * denuncia boneco.
 *
 * A correcao ESPELHA a junta do meio sobre a reta raiz-ponta. E a outra
 * solucao do mesmo triangulo: a ponta (mao, pe) fica EXATAMENTE onde a pose
 * pediu, entao alcance, distancia de combate e contato nao mudam. So a
 * articulacao passa a dobrar para o lado que um corpo dobra.
 */
const DOBRAS: [JointName, JointName, JointName, 1 | -1, number][] = [
  // [raiz, meio, ponta, sinal anatomico da dobra, tolerancia em radianos]
  ["hip", "kneeFront", "footFront", 1, 0.09],
  ["hip", "kneeBack", "footBack", 1, 0.09],
  ["shoulderFront", "elbowFront", "handFront", -1, 0.14],
  ["shoulderBack", "elbowBack", "handBack", -1, 0.14],
];

const anatomico = (
  p: Required<Pose>,
  raiz: JointName,
  meio: JointName,
  ponta: JointName,
  sinal: 1 | -1,
  tolerancia: number,
): void => {
  const r = p[raiz];
  const m = p[meio];
  const t = p[ponta];
  const a1 = Math.atan2(m.y - r.y, m.x - r.x);
  const a2 = Math.atan2(t.y - m.y, t.x - m.x);
  let dobra = a2 - a1;
  while (dobra <= -Math.PI) dobra += Math.PI * 2;
  while (dobra > Math.PI) dobra -= Math.PI * 2;
  if (dobra * sinal >= -tolerancia) return;
  const dx = t.x - r.x;
  const dy = t.y - r.y;
  const n = Math.hypot(dx, dy);
  if (n < 0.001) return;
  const ux = dx / n;
  const uy = dy / n;
  const vx = m.x - r.x;
  const vy = m.y - r.y;
  const proj = vx * ux + vy * uy;
  p[meio] = {
    x: r.x + 2 * proj * ux - vx,
    y: r.y + 2 * proj * uy - vy,
  };
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
  // giro perto de zero nao tem inversa util: o corpo esta de perfil e
  // qualquer x local cai na mesma linha. O piso so evita divisao por zero.
  const giro = t.giro ?? 1;
  const g = Math.abs(giro) < 0.05 ? Math.sign(giro || 1) * 0.05 : giro;
  return { x: ex / (t.facing * g * escala), y: ey / escala };
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
/**
 * ATRASO POR JUNTA: a acao sobrepondo (overlapping action).
 *
 * O PROBLEMA QUE ISTO RESOLVE, e e o maior de todos: a mistura usava um unico
 * fator de tempo para o corpo inteiro, entao TODAS as juntas partiam e
 * chegavam no mesmo instante. Medido com scripts/cadeia.mts: quadril, joelho,
 * pe, pescoco e ombro atingiam a velocidade maxima no MESMO quadro, com
 * espalhamento zero, e o punho picava 2 quadros ANTES do quadril, ou seja com
 * a cadeia invertida.
 *
 * Corpo que parte e chega junto e lido como posicao sendo trocada. Corpo em
 * que cada parte tem o seu tempo e lido como corpo se movendo. E a diferenca
 * entre animacao interpolada e animacao.
 *
 * Aqui cada junta recebe uma fracao de atraso. No fator 1 todas chegam a 1,
 * entao a pose no QUADRO-CHAVE continua exata: o atraso muda o caminho, nao
 * o destino. Isso importa porque o contato e garantido nos quadros-chave.
 */
/**
 * Cada junta tem uma JANELA dentro do movimento: um numero so e o instante em
 * que ela comeca (e todas terminam juntas no fim); um par [comeca, termina]
 * tambem diz quando ela CHEGA.
 *
 * O par existe porque atrasar so a partida nao faz cadeia: todas as juntas
 * ainda chegam no ultimo quadro, e numa curva que acelera ate o contato todas
 * atingem a velocidade maxima nesse mesmo quadro. O corpo continua um bloco,
 * so que com partida escalonada. Cadeia de verdade e a raiz CHEGAR antes: o
 * quadril termina de girar, o tronco termina, o ombro termina, e por ultimo o
 * punho, que recebe a energia de todos.
 */
export type PerfilDeAtraso = Partial<Record<JointName, number | [number, number]>>;

/**
 * ATAQUE: o movimento nasce no chao e sobe.
 * pe -> perna -> quadril -> tronco -> ombro -> braco -> punho
 */
export const ATRASO_DO_ATAQUE: PerfilDeAtraso = {
  hip: [0, 0.25],
  kneeBack: [0.02, 0.32], kneeFront: [0.02, 0.32],
  footBack: [0.04, 0.36], footFront: [0.04, 0.36],
  neck: [0.08, 0.5],
  shoulderBack: [0.1, 0.56], shoulderFront: [0.1, 0.56],
  head: [0.14, 0.62],
  elbowBack: [0.24, 0.74], elbowFront: [0.24, 0.74],
  handBack: [0.34, 1], handFront: [0.34, 1],
};

/**
 * UPPERCUT: a forca vem das PERNAS se esticando, de baixo para cima.
 *
 * Com o perfil do soco reto, cotovelo e punho chegavam juntos (o braco do
 * uppercut quase nao estende, so sobe), e tronco e quadril tambem: a corrente
 * inteira cabia em dois quadros. Aqui as pernas empurram primeiro, o tronco
 * sobe em seguida, e o punho e o ultimo a chegar, subindo.
 */
export const ATRASO_DO_UPPERCUT: PerfilDeAtraso = {
  hip: [0, 0.28],
  kneeBack: [0, 0.28], kneeFront: [0, 0.28],
  footBack: [0, 0.3], footFront: [0, 0.3],
  neck: [0.12, 0.55],
  shoulderBack: [0.16, 0.6], shoulderFront: [0.16, 0.6],
  head: [0.22, 0.72],
  elbowBack: [0.3, 0.7], elbowFront: [0.3, 0.7],
  handBack: [0.45, 1], handFront: [0.45, 1],
};

/**
 * CHUTE: a mesma cadeia, mas a ponta e o PE.
 *
 * Com o perfil do soco o pe da frente chegava junto com o quadril, ou seja
 * antes do tronco: a perna que chuta era a primeira coisa a parar. Aqui a
 * perna de apoio e o tronco se resolvem primeiro, os bracos abrem como
 * contrapeso, e o joelho e o pe da frente chegam por ultimo.
 */
export const ATRASO_DO_CHUTE: PerfilDeAtraso = {
  hip: [0, 0.6],
  kneeBack: [0.02, 0.62], footBack: [0.02, 0.62],
  neck: [0.08, 0.7],
  head: [0.14, 0.78],
  shoulderBack: [0.1, 0.74], shoulderFront: [0.1, 0.74],
  elbowBack: [0.16, 0.82], elbowFront: [0.16, 0.82],
  handBack: [0.22, 0.88], handFront: [0.22, 0.88],
  kneeFront: [0.28, 0.92],
  footFront: [0.38, 1],
};

/**
 * REACAO: o movimento nasce no PONTO ATINGIDO e se espalha.
 * tronco -> cabeca -> bracos -> quadril -> pernas -> pes
 *
 * E o inverso do ataque de proposito. Quem leva um golpe no peito tem o
 * tronco cedendo primeiro e os pes por ultimo; usar o perfil do ataque aqui
 * poria o quadril reagindo antes do peito que foi atingido.
 */
export const ATRASO_DA_REACAO: PerfilDeAtraso = {
  neck: 0,
  head: 0.1,
  shoulderBack: 0.08, shoulderFront: 0.08,
  hip: 0.14,
  elbowBack: 0.18, elbowFront: 0.18,
  handBack: 0.28, handFront: 0.28,
  kneeBack: 0.22, kneeFront: 0.22,
  footBack: 0.3, footFront: 0.3,
};

// ===========================================================================
// RIG POR ANGULOS (cinematica direta)
// ===========================================================================
//
// As poses continuam ESCRITAS como deslocamento de junta (e o formato que se
// le e se ajusta na mao), mas a mistura entre duas poses acontece em ANGULOS
// DE OSSO, cada osso relativo ao pai:
//
//   quadril (raiz, posicao)
//     tronco (angulo absoluto; comprimento pode comprimir: squash)
//       cabeca           relativa ao tronco
//       braco            relativo ao tronco   -> antebraco relativo ao braco
//     coxa (absoluta)                         -> canela relativa a coxa
//
// Por que isto e o nucleo da animacao, e nao um detalhe:
//
// 1. O BRACO E CARREGADO PELO TRONCO. Misturando posicoes, a mao ia do ponto A
//    ao ponto B por conta propria, e o tronco girar nao mudava nada no
//    caminho dela. Em angulo relativo, quando o tronco gira o braco inteiro
//    vai junto, e o braco ainda gira por cima disso. Com tempos diferentes
//    por osso (tronco primeiro, braco depois) aparece a corrente cinetica: o
//    tronco puxa, o braco chega atrasado e chicoteia.
// 2. ARCO DE GRACA. Osso que gira em volta da articulacao descreve arco; nao
//    existe caminho reto entre duas poses.
// 3. EXAGERO E EXTRAPOLACAO VALIDOS. "Passar 15% alem da pose" em angulo e
//    girar um pouco mais; em posicao seria esticar o membro para fora do
//    esqueleto.
//
// Cada angulo e medido a partir de uma referencia NEUTRA (tronco para cima,
// braco e coxa para baixo, antebraco e canela retos), e a mistura e linear
// nesse espaco. Assim o braco que vai de "pendurado atras" para "pendurado na
// frente" passa por baixo, e nao por cima da cabeca, que e o que uma mistura
// pelo caminho mais curto do circulo faria em alguns casos.

/** Angulos de uma pose. Todos em radianos, relativos a referencia neutra. */
export type Angulos = {
  raiz: Vec2;
  tronco: number;
  /** comprimento do tronco (squash e stretch) */
  troncoLen: number;
  cabeca: number;
  bracoF: number;
  anteF: number;
  bracoT: number;
  anteT: number;
  coxaF: number;
  canelaF: number;
  coxaT: number;
  canelaT: number;
};

const CIMA = -Math.PI / 2;
const BAIXO = Math.PI / 2;

/** Normaliza para (-PI, PI]. */
const embrulhar = (a: number): number => {
  let r = a % (Math.PI * 2);
  if (r <= -Math.PI) r += Math.PI * 2;
  if (r > Math.PI) r -= Math.PI * 2;
  return r;
};

const anguloDe = (de: Vec2, para: Vec2): number =>
  Math.atan2(para.y - de.y, para.x - de.x);

const L_CABECA = COMPRIMENTO[0];
const L_BRACO_F = COMPRIMENTO[1];
const L_ANTE_F = COMPRIMENTO[2];
const L_BRACO_T = COMPRIMENTO[3];
const L_ANTE_T = COMPRIMENTO[4];
const L_COXA_F = COMPRIMENTO[5];
const L_CANELA_F = COMPRIMENTO[6];
const L_COXA_T = COMPRIMENTO[7];
const L_CANELA_T = COMPRIMENTO[8];

/** Decompoe uma pose em angulos de osso. */
export const paraAngulos = (pose: Pose): Angulos => {
  const c = completar(pose);
  const tronco = anguloDe(c.hip, c.neck);
  const braco = (ombro: Vec2, cotovelo: Vec2) =>
    embrulhar(anguloDe(ombro, cotovelo) - tronco - Math.PI);
  const bracoF = anguloDe(c.shoulderFront, c.elbowFront);
  const bracoT = anguloDe(c.shoulderBack, c.elbowBack);
  const coxaF = anguloDe(c.hip, c.kneeFront);
  const coxaT = anguloDe(c.hip, c.kneeBack);
  return {
    raiz: { ...c.hip },
    tronco: embrulhar(tronco - CIMA),
    troncoLen: distancia(c.hip, c.neck),
    cabeca: embrulhar(anguloDe(c.neck, c.head) - tronco),
    bracoF: braco(c.shoulderFront, c.elbowFront),
    anteF: embrulhar(anguloDe(c.elbowFront, c.handFront) - bracoF),
    bracoT: braco(c.shoulderBack, c.elbowBack),
    anteT: embrulhar(anguloDe(c.elbowBack, c.handBack) - bracoT),
    coxaF: embrulhar(coxaF - BAIXO),
    canelaF: embrulhar(anguloDe(c.kneeFront, c.footFront) - coxaF),
    coxaT: embrulhar(coxaT - BAIXO),
    canelaT: embrulhar(anguloDe(c.kneeBack, c.footBack) - coxaT),
  };
};

const ponta = (de: Vec2, angulo: number, comprimento: number): Vec2 => ({
  x: de.x + Math.cos(angulo) * comprimento,
  y: de.y + Math.sin(angulo) * comprimento,
});

/** Reconstroi a pose a partir dos angulos. Ossos sempre no comprimento exato. */
export const dosAngulos = (a: Angulos): Required<Pose> => {
  const hip = { ...a.raiz };
  const tronco = a.tronco + CIMA;
  const len = Math.max(
    TRONCO * (1 - SQUASH_DO_TRONCO),
    Math.min(TRONCO * (1 + SQUASH_DO_TRONCO), a.troncoLen),
  );
  const neck = ponta(hip, tronco, len);
  const ux = Math.cos(tronco);
  const uy = Math.sin(tronco);
  const px = -uy;
  const py = ux;
  const ombro = (o: { aoLongo: number; perpendicular: number }): Vec2 => ({
    x: neck.x + ux * o.aoLongo + px * o.perpendicular,
    y: neck.y + uy * o.aoLongo + py * o.perpendicular,
  });
  const shoulderFront = ombro(OMBRO_FRENTE);
  const shoulderBack = ombro(OMBRO_TRAS);
  const bracoF = a.bracoF + tronco + Math.PI;
  const bracoT = a.bracoT + tronco + Math.PI;
  const elbowFront = ponta(shoulderFront, bracoF, L_BRACO_F);
  const elbowBack = ponta(shoulderBack, bracoT, L_BRACO_T);
  const coxaF = a.coxaF + BAIXO;
  const coxaT = a.coxaT + BAIXO;
  const kneeFront = ponta(hip, coxaF, L_COXA_F);
  const kneeBack = ponta(hip, coxaT, L_COXA_T);
  return {
    hip,
    neck,
    head: ponta(neck, tronco + a.cabeca, L_CABECA),
    shoulderFront,
    shoulderBack,
    elbowFront,
    handFront: ponta(elbowFront, bracoF + a.anteF, L_ANTE_F),
    elbowBack,
    handBack: ponta(elbowBack, bracoT + a.anteT, L_ANTE_T),
    kneeFront,
    footFront: ponta(kneeFront, coxaF + a.canelaF, L_CANELA_F),
    kneeBack,
    footBack: ponta(kneeBack, coxaT + a.canelaT, L_CANELA_T),
  };
};

/**
 * Qual junta da o TEMPO de cada canal de angulo.
 *
 * Os perfis de atraso continuam escritos por junta (e como se pensa: "o punho
 * chega por ultimo"), e aqui cada osso herda o tempo da junta da PONTA dele.
 * O ombro nao tem canal proprio: ele e derivado do tronco.
 */
const TEMPO_DO_CANAL: Record<Exclude<keyof Angulos, "raiz">, JointName> = {
  tronco: "neck",
  troncoLen: "neck",
  cabeca: "head",
  bracoF: "elbowFront",
  anteF: "handFront",
  bracoT: "elbowBack",
  anteT: "handBack",
  coxaF: "kneeFront",
  canelaF: "footFront",
  coxaT: "kneeBack",
  canelaT: "footBack",
};

const tempoDaJunta = (
  junta: JointName,
  t: number,
  atrasos: PerfilDeAtraso | undefined,
  curva: (t: number) => number,
): number => {
  const janela = atrasos?.[junta] ?? 0;
  const [comeca, termina] = typeof janela === "number" ? [janela, 1] : janela;
  // reescala o tempo da junta para a janela dela e so entao aplica a curva.
  // A curva pode passar de 1 (acomodacao, exagero): isso e intencional.
  return curva(Math.max(0, Math.min(1, (t - comeca) / (termina - comeca))));
};

/** Mistura de angulos, canal por canal, cada um no seu tempo. */
export const misturarAngulos = (
  a: Angulos,
  b: Angulos,
  t: number,
  atrasos?: PerfilDeAtraso,
  curva: (t: number) => number = (x) => x,
): Angulos => {
  const th = tempoDaJunta("hip", t, atrasos, curva);
  const saida = {
    raiz: {
      x: a.raiz.x + (b.raiz.x - a.raiz.x) * th,
      y: a.raiz.y + (b.raiz.y - a.raiz.y) * th,
    },
  } as Angulos;
  for (const canal of Object.keys(TEMPO_DO_CANAL) as (keyof typeof TEMPO_DO_CANAL)[]) {
    const tc = tempoDaJunta(TEMPO_DO_CANAL[canal], t, atrasos, curva);
    saida[canal] = a[canal] + (b[canal] - a[canal]) * tc;
  }
  return saida;
};

/**
 * Interpola duas poses POR OSSO, em angulo. t=0 devolve a, t=1 devolve b.
 *
 * `t` e o tempo CRU (0 a 1) e `curva` e aplicada depois da janela de cada
 * junta. A ordem importa: aplicando a curva antes, uma curva que acelera ate
 * o fim empurrava a chegada de TODAS as juntas para os ultimos quadros, e num
 * golpe de 6 quadros a cadeia inteira cabia num so.
 */
/**
 * REACOES POR REGIAO: a forca entra pelo ponto atingido e se espalha.
 *
 * Um perfil so de reacao (tronco primeiro) fazia o soco no rosto e o chute na
 * perna produzirem a mesma onda pelo corpo. Aqui cada regiao comeca onde o
 * golpe encostou, e a janela de cada junta diz quando ela CHEGA, nao so
 * quando parte: a cabeca que leva um soco termina de chicotear antes de o
 * quadril terminar de ceder, e os pes sao sempre os ultimos a acomodar.
 */
export const ATRASO_REACAO_CABECA: PerfilDeAtraso = {
  head: [0, 0.35],
  neck: [0.05, 0.5],
  shoulderBack: [0.08, 0.55], shoulderFront: [0.08, 0.55],
  elbowBack: [0.14, 0.75], elbowFront: [0.14, 0.75],
  handBack: [0.2, 0.9], handFront: [0.2, 0.9],
  hip: [0.18, 0.7],
  kneeBack: [0.28, 0.9], kneeFront: [0.28, 0.9],
  footBack: [0.34, 1], footFront: [0.34, 1],
};

/** Peito: o tronco afunda primeiro e a cabeca chega DEPOIS, por cima do golpe. */
export const ATRASO_REACAO_PEITO: PerfilDeAtraso = {
  neck: [0, 0.4],
  shoulderBack: [0, 0.42], shoulderFront: [0, 0.42],
  hip: [0.06, 0.5],
  head: [0.14, 0.72],
  elbowBack: [0.14, 0.78], elbowFront: [0.14, 0.78],
  handBack: [0.22, 0.92], handFront: [0.22, 0.92],
  kneeBack: [0.22, 0.88], kneeFront: [0.22, 0.88],
  footBack: [0.3, 1], footFront: [0.3, 1],
};

/** Tronco (chute): o quadril e empurrado, o resto e arrastado por ele. */
export const ATRASO_REACAO_TRONCO: PerfilDeAtraso = {
  hip: [0, 0.4],
  neck: [0.04, 0.5],
  shoulderBack: [0.06, 0.55], shoulderFront: [0.06, 0.55],
  head: [0.16, 0.8],
  elbowBack: [0.16, 0.82], elbowFront: [0.16, 0.82],
  handBack: [0.24, 0.95], handFront: [0.24, 0.95],
  kneeBack: [0.18, 0.85], kneeFront: [0.18, 0.85],
  footBack: [0.26, 1], footFront: [0.26, 1],
};

/** Perna: o joelho cede primeiro, o quadril cai, e o tronco tomba por ultimo. */
export const ATRASO_REACAO_PERNA: PerfilDeAtraso = {
  kneeFront: [0, 0.35], footFront: [0, 0.4],
  hip: [0.08, 0.5],
  kneeBack: [0.12, 0.6], footBack: [0.16, 0.65],
  neck: [0.2, 0.75],
  shoulderBack: [0.22, 0.78], shoulderFront: [0.22, 0.78],
  elbowBack: [0.26, 0.9], elbowFront: [0.26, 0.9],
  head: [0.3, 1],
  handBack: [0.32, 1], handFront: [0.32, 1],
};

export const misturar = (
  a: Pose,
  b: Pose,
  t: number,
  atrasos?: PerfilDeAtraso,
  curva: (t: number) => number = (x) => x,
): Required<Pose> =>
  dosAngulos(misturarAngulos(paraAngulos(a), paraAngulos(b), t, atrasos, curva));

/**
 * EXAGERO: leva a pose `alvo` mais longe (ou mais perto) na direcao em que
 * ela se afasta de `base`. `fator` 1 devolve o alvo; 1.15 passa 15% alem;
 * 0.85 fica 15% aquem.
 *
 * E como a personalidade entra na forma do movimento sem escrever poses
 * novas: o pesado carrega mais fundo e termina mais longe, o agil faz o
 * mesmo golpe mais compacto. Tambem e o follow-through do corpo: depois do
 * contato o corpo continua girando alem da pose do golpe.
 */
export const exagerar = (
  base: Pose,
  alvo: Pose,
  fator: number,
): Required<Pose> => misturar(base, alvo, fator);

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
  /**
   * GIRO NO EIXO VERTICAL: multiplica a largura do corpo. 1 = de frente para
   * o lado que ele olha, 0 = de perfil para a camera, -1 = de costas.
   *
   * E como animacao 2D mostra um corpo girando em torno de si mesmo (o chute
   * giratorio): o esqueleto "achata" ate virar uma linha e abre do outro
   * lado. Sem isto o chute giratorio era um chute lateral com outro nome.
   */
  giro?: number;
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
  const giro = t.giro ?? 1;

  for (const junta of TODAS_AS_JUNTAS) {
    // espelha, escala (ESCALA_POSE leva a pose para unidades de mundo), gira
    // em torno do quadril e por fim translada
    const escala = t.scale * ESCALA_POSE;
    const ex = c[junta].x * t.facing * giro * escala;
    const ey = c[junta].y * escala;
    saida[junta] = {
      x: t.baseX + ex * cos - ey * sen,
      y: t.baseY + ex * sen + ey * cos,
    };
  }
  return saida;
};
