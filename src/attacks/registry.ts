/**
 * Registro de golpes.
 *
 * Cada golpe e DADO, nao codigo: adicionar um golpe novo e acrescentar uma
 * entrada aqui. Quem consome (compilador de timeline, personagem, efeitos,
 * audio) le da definicao e nao precisa saber que o golpe existe.
 *
 * Duracoes em quadros a 60 fps. O compilador escala pela velocidade do
 * lutador e pela intensidade da luta, entao estes numeros sao a referencia
 * "neutra".
 *
 * ATENCAO: a primeira versao destes numeros foi escrita como se fosse 30fps
 * (soco com 5 quadros de preparacao). A 60fps isso dava 0,08s, imperceptivel,
 * e a luta inteira saia em 5s em vez de 9s. Estao dobrados. Ao adicionar golpe
 * novo, pense em SEGUNDOS e multiplique por 60, nao copie de referencia a 30.
 *
 * As cinco fases do briefing:
 *   windup  = preparacao (o corpo carrega, e o que da leitura ao golpe)
 *   strike  = execucao (o membro dispara)
 *   contact = o quadro, dentro do strike, em que encosta
 *   recover = recuperacao (volta para a guarda)
 * A "reacao" nao mora aqui: e do alvo, e vem de knockback/hitStop.
 */

import type { AttackDef, AttackName } from "../core/types";

const def = (d: AttackDef): AttackDef => d;

export const ATAQUES: Record<AttackName, AttackDef> = {
  punch: def({
    name: "punch",
    pose: "punch",
    windup: 10,
    strike: 12,
    recover: 16,
    contactAt: 6,
    tier: "medium",
    knockback: 260,
    hitStop: 3,
    contactJoint: "handFront",
    sound: "punch",
  }),
  punchFast: def({
    name: "punchFast",
    pose: "punchFast",
    windup: 4,
    strike: 8,
    recover: 8,
    contactAt: 4,
    tier: "light",
    knockback: 120,
    hitStop: 2,
    contactJoint: "handFront",
    sound: "punchLight",
  }),
  punchHeavy: def({
    name: "punchHeavy",
    pose: "punchHeavy",
    // preparacao longa de proposito: golpe forte precisa ser LIDO antes de
    // chegar, senao o impacto parece arbitrario
    windup: 24,
    strike: 14,
    recover: 28,
    contactAt: 6,
    tier: "extreme",
    knockback: 620,
    hitStop: 7,
    contactJoint: "handFront",
    sound: "heavyHit",
    cracksGround: true,
  }),
  uppercut: def({
    name: "uppercut",
    pose: "uppercut",
    windup: 16,
    strike: 12,
    recover: 24,
    contactAt: 6,
    tier: "extreme",
    knockback: 520,
    hitStop: 6,
    contactJoint: "handFront",
    sound: "heavyHit",
    launches: true,
  }),
  kick: def({
    name: "kick",
    pose: "kick",
    windup: 12,
    strike: 14,
    recover: 20,
    contactAt: 8,
    tier: "medium",
    knockback: 380,
    hitStop: 4,
    contactJoint: "footFront",
    sound: "kick",
  }),
  kickLow: def({
    name: "kickLow",
    pose: "kickLow",
    windup: 8,
    strike: 10,
    recover: 14,
    contactAt: 6,
    tier: "light",
    knockback: 150,
    hitStop: 2,
    contactJoint: "footFront",
    sound: "kickLight",
  }),
  kickHigh: def({
    name: "kickHigh",
    pose: "kickHigh",
    windup: 14,
    strike: 14,
    recover: 22,
    contactAt: 8,
    tier: "medium",
    knockback: 440,
    hitStop: 4,
    contactJoint: "footFront",
    sound: "kick",
  }),
  spinKick: def({
    name: "spinKick",
    pose: "spinKick",
    windup: 18,
    strike: 16,
    recover: 26,
    contactAt: 10,
    tier: "extreme",
    knockback: 760,
    hitStop: 8,
    contactJoint: "footFront",
    sound: "heavyHit",
    cracksGround: true,
  }),
  knee: def({
    name: "knee",
    pose: "knee",
    windup: 8,
    strike: 10,
    recover: 14,
    contactAt: 6,
    tier: "medium",
    knockback: 200,
    hitStop: 3,
    contactJoint: "kneeFront",
    sound: "punch",
  }),
  elbow: def({
    name: "elbow",
    pose: "elbow",
    windup: 10,
    strike: 10,
    recover: 18,
    contactAt: 6,
    tier: "extreme",
    knockback: 700,
    hitStop: 6,
    contactJoint: "elbowFront",
    sound: "heavyHit",
    cracksGround: true,
  }),
  charge: def({
    name: "charge",
    pose: "charge",
    windup: 12,
    strike: 20,
    recover: 16,
    contactAt: 12,
    tier: "medium",
    knockback: 420,
    hitStop: 4,
    contactJoint: "shoulderFront",
    sound: "whoosh",
  }),
  airAttack: def({
    name: "airAttack",
    pose: "airAttack",
    windup: 8,
    strike: 12,
    recover: 16,
    contactAt: 6,
    tier: "medium",
    knockback: 340,
    hitStop: 4,
    contactJoint: "handFront",
    sound: "punch",
  }),
  diveAttack: def({
    name: "diveAttack",
    pose: "diveAttack",
    windup: 14,
    strike: 16,
    recover: 24,
    contactAt: 10,
    tier: "extreme",
    knockback: 680,
    hitStop: 7,
    contactJoint: "footFront",
    sound: "heavyHit",
    cracksGround: true,
  }),
  special: def({
    name: "special",
    pose: "charge",
    windup: 36,
    strike: 18,
    recover: 32,
    contactAt: 8,
    tier: "extreme",
    knockback: 1000,
    hitStop: 9,
    contactJoint: "handFront",
    sound: "explosion",
    cracksGround: true,
  }),
  finisher: def({
    name: "finisher",
    pose: "spinKick",
    // a preparacao mais longa do jogo: e o contraste entre o silencio e o
    // estouro que faz o golpe final parecer forte
    windup: 44,
    strike: 18,
    recover: 36,
    contactAt: 10,
    tier: "extreme",
    knockback: 1000,
    hitStop: 12,
    contactJoint: "footFront",
    sound: "explosion",
    cracksGround: true,
  }),
};

/**
 * Nota sobre knockback: os valores sao em unidades de MUNDO, e o corpo tem 597
 * de altura. O finalizador estava em 1800, que com o bonus de forca dava 2826
 * (4,7x o corpo): o alvo voava para fora do cenario e a camera tinha que abrir
 * tanto que os dois viravam pontos na tela. Teto pratico: ~1,7x a altura.
 */

/** Duracao total de um golpe em quadros, sem escala. */
export const duracaoBase = (a: AttackDef): number =>
  a.windup + a.strike + a.recover;

/**
 * Escala a duracao pela velocidade do lutador e pela intensidade da luta.
 * Lutador rapido e luta intensa = golpe mais curto, que e o que faz "velocidade
 * 9/10" significar algo de verdade em vez de ser enfeite no JSON.
 */
export const escalaDuracao = (velocidade: number, intensidade: number): number => {
  const porVelocidade = 1.15 - velocidade * 0.3; // 0.85 a 1.15
  const porIntensidade = 1.1 - (intensidade / 10) * 0.22; // 0.88 a 1.1
  // O piso era 0.55, o que comprimia o golpe ate ele nao ser mais legivel na
  // tela. Velocidade alta agora significa golpe rapido, nao golpe invisivel.
  return Math.max(0.78, porVelocidade * porIntensidade);
};
