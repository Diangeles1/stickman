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

/** Completa uma pose parcial com os deslocamentos base. */
export const completar = (pose: Pose): Required<Pose> => {
  const saida = poseBase();
  for (const junta of TODAS_AS_JUNTAS) {
    const v = pose[junta];
    if (v) saida[junta] = v;
  }
  return saida;
};

/**
 * Interpola duas poses. t=0 devolve a, t=1 devolve b.
 *
 * Interpolar DESLOCAMENTO (e nao angulo) pode encurtar o membro no meio do
 * caminho. Na pratica o efeito e desprezivel nas poses deste motor e a
 * simplicidade compensa: sem isso cada pose exigiria cinematica inversa.
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
