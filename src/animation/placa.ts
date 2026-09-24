/**
 * A PLACA: o vencedor vira de frente para a tela, leva a mao por cima do
 * ombro, puxa das costas uma placa gigante num cabo e segura no alto.
 *
 * Como a danca, e uma funcao do tempo escrita nos angulos dos ossos. Tres
 * poses-chave e as passagens entre elas:
 *
 *   0-14    VIRA: sai do perfil para a pose de frente (simetrica: pes para
 *           os dois lados, bracos iguais, cabeca no meio)
 *   14-30   BUSCA: o braco da frente sobe e a mao vai para tras da cabeca,
 *           onde a placa esta "guardada"
 *   30-44   PUXA: o braco estica para cima de uma vez e a placa sai de tras
 *           do corpo crescendo ate o tamanho real, com repique
 *   44-     SEGURA: uma mao no cabo, a outra apontando para a placa, e o
 *           corpo quicando no ritmo
 *
 * Um corpo de stickman desenhado de lado nao tem "frente". De frente e a
 * pose simetrica em volta do quadril: e assim que o desenho a mao resolve.
 */

import { dosAngulos, paraAngulos, type Angulos } from "../characters/skeleton";
import type { Pose } from "../core/types";
import { TEMPO_DA_DANCA } from "./danca";

export const VIRA = 14;
export const BUSCA = 30;
export const PUXA = 44;

/** DE FRENTE: tudo simetrico em volta do quadril. */
export const POSE_DE_FRENTE: Pose = {
  neck: { x: 0, y: -74 },
  head: { x: 0, y: -114 },
  elbowFront: { x: 24, y: -44 },
  handFront: { x: 30, y: -18 },
  elbowBack: { x: -24, y: -44 },
  handBack: { x: -30, y: -18 },
  kneeFront: { x: 22, y: 46 },
  footFront: { x: 36, y: 92 },
  kneeBack: { x: -22, y: 46 },
  footBack: { x: -36, y: 92 },
};

/** a mao por cima do ombro, atras da cabeca */
const BUSCANDO: Pose = {
  ...POSE_DE_FRENTE,
  elbowFront: { x: 34, y: -104 },
  handFront: { x: 6, y: -98 },
  // a outra mao na cintura: pose de quem vai mostrar alguma coisa
  elbowBack: { x: -40, y: -44 },
  handBack: { x: -16, y: -28 },
  kneeFront: { x: 20, y: 44 },
  kneeBack: { x: -20, y: 44 },
};

/** segurando o cabo no alto; a outra mao aponta para a placa */
const SEGURANDO: Pose = {
  ...POSE_DE_FRENTE,
  elbowFront: { x: 30, y: -96 },
  handFront: { x: 40, y: -124 },
  elbowBack: { x: -38, y: -88 },
  handBack: { x: -52, y: -112 },
};

const A_FRENTE = paraAngulos(POSE_DE_FRENTE);
const A_BUSCANDO = paraAngulos(BUSCANDO);
const A_SEGURANDO = paraAngulos(SEGURANDO);

const suave = (t: number) => {
  const c = Math.max(0, Math.min(1, t));
  return c * c * (3 - 2 * c);
};
/** sai rapido: e um puxao, nao um gesto */
const puxao = (t: number) => 1 - Math.pow(1 - Math.max(0, Math.min(1, t)), 3);

const misturarA = (a: Angulos, b: Angulos, t: number): Angulos => {
  const r = { ...a, raiz: { x: 0, y: 0 } } as Angulos;
  for (const k of Object.keys(a) as (keyof Angulos)[]) {
    if (k === "raiz") continue;
    (r[k] as number) = (a[k] as number) + ((b[k] as number) - (a[k] as number)) * t;
  }
  return r;
};

/**
 * Pose da placa `t` quadros depois do inicio. A virada (0-VIRA) e feita por
 * quem chama, misturando a pose anterior com esta.
 */
export const poseDaPlaca = (t: number): Pose => {
  let a: Angulos;
  if (t < VIRA) a = A_FRENTE;
  else if (t < BUSCA) a = misturarA(A_FRENTE, A_BUSCANDO, suave((t - VIRA) / (BUSCA - VIRA)));
  else if (t < PUXA) a = misturarA(A_BUSCANDO, A_SEGURANDO, puxao((t - BUSCA) / 8));
  else {
    // quica no ritmo da danca: joelho afunda em cada tempo
    const afunda = 0.5 + 0.5 * Math.cos(((t - PUXA) / TEMPO_DA_DANCA) * Math.PI * 2);
    a = {
      ...A_SEGURANDO,
      coxaF: A_SEGURANDO.coxaF - 0.18 * afunda,
      canelaF: A_SEGURANDO.canelaF + 0.34 * afunda,
      coxaT: A_SEGURANDO.coxaT + 0.18 * afunda,
      canelaT: A_SEGURANDO.canelaT - 0.34 * afunda,
    };
  }
  return dosAngulos(a);
};

/**
 * Estado da placa: quanto ela ja saiu (0 escondida atras do corpo, 1 no
 * alto) e a escala, com o repique de quando ela "chega".
 */
export const placaNoQuadro = (
  t: number,
): { saida: number; escala: number } | null => {
  if (t < BUSCA) return null;
  const k = (t - BUSCA) / (PUXA - BUSCA);
  const saida = puxao(k);
  // repique: passa um pouco do tamanho e volta
  const repique = k >= 1 ? 0 : Math.sin(Math.min(1, k) * Math.PI) * 0.12;
  const escala = 0.08 + 0.92 * saida + repique;
  return { saida, escala };
};
