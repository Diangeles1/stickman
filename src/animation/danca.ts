/**
 * DANCA DA VITORIA: o passinho do Jamal (brega funk).
 *
 * Nao e uma sequencia de poses escritas: e uma funcao do tempo, escrita
 * direto nos ANGULOS dos ossos (ver paraAngulos em skeleton.ts). Assim os
 * ossos nunca mudam de comprimento, o movimento e continuo em todo quadro e
 * o ritmo e exato, o que importa porque o som da batida cai no mesmo quadro
 * (ver FightAudio).
 *
 * Um ciclo tem 8 tempos:
 *
 *   tempos 1-4  MOLEJO: joelhos afundam em cada tempo, um pe de apoio e o
 *               outro sai batendo (frente, tras, alternando), bracos soltos
 *               balancando ao contrario das pernas
 *   tempos 5-8  HELICOPTERO: o braco da frente sobe e o antebraco gira por
 *               cima da cabeca, a outra mao vai na cintura, o quadril
 *               rebola mais e o passinho continua embaixo
 *
 * Angulos em radianos. Convencao (ver Angulos): coxa 0 = reta para baixo,
 * negativo leva o joelho para a frente; canela positiva dobra o joelho;
 * braco 0 = pendurado, negativo leva para a frente e para cima.
 */

import { POSES } from "../characters/poses";
import { dosAngulos, paraAngulos, type Angulos } from "../characters/skeleton";
import type { Pose } from "../core/types";

/**
 * Quadros por tempo. 22 a 60fps da ~164 batidas por minuto, o andamento do
 * brega funk.
 */
export const TEMPO_DA_DANCA = 22;
const TEMPOS_POR_CICLO = 8;
/** quadros para o braco subir para o helicoptero (e descer de volta) */
const TRANSICAO = 8;

const BASE = paraAngulos(POSES.guard);

const suave = (t: number) => {
  const c = Math.max(0, Math.min(1, t));
  return c * c * (3 - 2 * c);
};
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

const CICLO = TEMPO_DA_DANCA * TEMPOS_POR_CICLO;

/**
 * Quanto do helicoptero esta ligado (0 molejo, 1 helicoptero) e ha quantos
 * quadros o helicoptero atual comecou. O braco sobe nos primeiros quadros da
 * segunda metade do ciclo e desce nos primeiros quadros do ciclo seguinte.
 */
const helicoptero = (t: number): { peso: number; desde: number } => {
  const noCiclo = t % CICLO;
  const meio = CICLO / 2;
  if (noCiclo >= meio) {
    return { peso: suave((noCiclo - meio) / TRANSICAO), desde: noCiclo - meio };
  }
  return {
    peso: t >= CICLO ? 1 - suave(noCiclo / TRANSICAO) : 0,
    desde: noCiclo + meio,
  };
};

/** Pose da danca `t` quadros depois do inicio. */
export const poseDaDanca = (t: number): Pose => {
  const b = t / TEMPO_DA_DANCA;
  const k = Math.floor(b);
  const fase = b - k;
  // AFUNDA NO TEMPO: o joelho esta mais dobrado exatamente na batida
  const afunda = 0.5 + 0.5 * Math.cos(fase * Math.PI * 2);
  // o pe que bate sobe e volta dentro do tempo
  const batida = Math.sin(fase * Math.PI);
  const { peso: h, desde } = helicoptero(t);
  const rebolado = Math.sin(b * Math.PI);

  // pernas: em tempo par a da frente bate, em tempo impar a de tras
  const frenteBate = k % 2 === 0;
  const apoioCoxa = -0.32 * afunda - 0.08;
  const apoioCanela = 0.62 * afunda + 0.15;
  const frente = frenteBate
    ? { coxa: -0.2 - 0.5 * batida, canela: 0.25 + 0.55 * batida }
    : { coxa: apoioCoxa, canela: apoioCanela };
  const tras = frenteBate
    ? { coxa: apoioCoxa + 0.1, canela: apoioCanela }
    : { coxa: 0.2 + 0.45 * batida, canela: 0.35 + 0.7 * batida };

  // bracos soltos do molejo: balancam ao contrario das pernas
  const balanco = Math.sin(b * Math.PI);
  const molejo = {
    bracoF: -0.25 + 0.55 * balanco,
    anteF: -1.3 - 0.2 * afunda,
    bracoT: -0.25 - 0.55 * balanco,
    anteT: -1.3 - 0.2 * afunda,
  };
  // helicoptero: braco da frente em pe, antebraco girando uma volta por
  // tempo; a outra mao na cintura
  const helice = {
    // em pe e um pouco a frente: reto para cima o braco sumia atras da cabeca
    bracoF: -2.35,
    // parte do angulo do molejo, para a subida nao dar voltas extras
    anteF: -1.3 - (desde / TEMPO_DA_DANCA) * Math.PI * 2,
    bracoT: 0.55,
    anteT: -2.3,
  };

  const a: Angulos = {
    ...BASE,
    raiz: { x: 0, y: 0 },
    // corpo levemente a frente, rebolando para os lados do tempo
    tronco: 0.1 + (0.07 + 0.06 * h) * rebolado,
    cabeca: 0.12 * Math.sin(b * Math.PI * 2) - 0.05,
    bracoF: lerp(molejo.bracoF, helice.bracoF, h),
    anteF: lerp(molejo.anteF, helice.anteF, h),
    bracoT: lerp(molejo.bracoT, helice.bracoT, h),
    anteT: lerp(molejo.anteT, helice.anteT, h),
    coxaF: frente.coxa,
    canelaF: frente.canela,
    coxaT: tras.coxa,
    canelaT: tras.canela,
  };
  return dosAngulos(a);
};

/** Deslocamento do quadril no mundo: o rebolado anda um pouco para os lados. */
export const reboladoDaDanca = (t: number): number =>
  18 * Math.sin((t / TEMPO_DA_DANCA) * Math.PI);
