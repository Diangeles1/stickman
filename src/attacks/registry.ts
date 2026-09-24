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
    windup: 5,
    strike: 6,
    recover: 8,
    contactAt: 3,
    tier: "medium",
    knockback: 260,
    hitStop: 3,
    contactJoint: "handFront",
    sound: "punch",
  }),
  punchFast: def({
    name: "punchFast",
    pose: "punchFast",
    windup: 2,
    strike: 4,
    recover: 4,
    contactAt: 2,
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
    windup: 12,
    strike: 7,
    recover: 14,
    contactAt: 3,
    tier: "extreme",
    knockback: 820,
    hitStop: 7,
    contactJoint: "handFront",
    sound: "heavyHit",
    cracksGround: true,
  }),
  uppercut: def({
    name: "uppercut",
    pose: "uppercut",
    windup: 8,
    strike: 6,
    recover: 12,
    contactAt: 3,
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
    windup: 6,
    strike: 7,
    recover: 10,
    contactAt: 4,
    tier: "medium",
    knockback: 380,
    hitStop: 4,
    contactJoint: "footFront",
    sound: "kick",
  }),
  kickLow: def({
    name: "kickLow",
    pose: "kickLow",
    windup: 4,
    strike: 5,
    recover: 7,
    contactAt: 3,
    tier: "light",
    knockback: 150,
    hitStop: 2,
    contactJoint: "footFront",
    sound: "kickLight",
  }),
  kickHigh: def({
    name: "kickHigh",
    pose: "kickHigh",
    windup: 7,
    strike: 7,
    recover: 11,
    contactAt: 4,
    tier: "medium",
    knockback: 440,
    hitStop: 4,
    contactJoint: "footFront",
    sound: "kick",
  }),
  spinKick: def({
    name: "spinKick",
    pose: "spinKick",
    windup: 9,
    strike: 8,
    recover: 13,
    contactAt: 5,
    tier: "extreme",
    knockback: 1150,
    hitStop: 8,
    contactJoint: "footFront",
    sound: "heavyHit",
    cracksGround: true,
  }),
  knee: def({
    name: "knee",
    pose: "knee",
    windup: 4,
    strike: 5,
    recover: 7,
    contactAt: 3,
    tier: "medium",
    knockback: 200,
    hitStop: 3,
    contactJoint: "kneeFront",
    sound: "punch",
  }),
  elbow: def({
    name: "elbow",
    pose: "elbow",
    windup: 5,
    strike: 5,
    recover: 9,
    contactAt: 3,
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
    windup: 6,
    strike: 10,
    recover: 8,
    contactAt: 6,
    tier: "medium",
    knockback: 420,
    hitStop: 4,
    contactJoint: "shoulderFront",
    sound: "whoosh",
  }),
  airAttack: def({
    name: "airAttack",
    pose: "airAttack",
    windup: 4,
    strike: 6,
    recover: 8,
    contactAt: 3,
    tier: "medium",
    knockback: 340,
    hitStop: 4,
    contactJoint: "handFront",
    sound: "punch",
  }),
  diveAttack: def({
    name: "diveAttack",
    pose: "diveAttack",
    windup: 7,
    strike: 8,
    recover: 12,
    contactAt: 5,
    tier: "extreme",
    knockback: 900,
    hitStop: 7,
    contactJoint: "footFront",
    sound: "heavyHit",
    cracksGround: true,
  }),
  special: def({
    name: "special",
    pose: "charge",
    windup: 18,
    strike: 9,
    recover: 16,
    contactAt: 4,
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
    windup: 22,
    strike: 9,
    recover: 18,
    contactAt: 5,
    tier: "extreme",
    knockback: 1800,
    hitStop: 12,
    contactJoint: "footFront",
    sound: "explosion",
    cracksGround: true,
  }),
};

/** Duracao total de um golpe em quadros, sem escala. */
export const duracaoBase = (a: AttackDef): number =>
  a.windup + a.strike + a.recover;

/**
 * Escala a duracao pela velocidade do lutador e pela intensidade da luta.
 * Lutador rapido e luta intensa = golpe mais curto, que e o que faz "velocidade
 * 9/10" significar algo de verdade em vez de ser enfeite no JSON.
 */
export const escalaDuracao = (velocidade: number, intensidade: number): number => {
  const porVelocidade = 1.25 - velocidade * 0.5; // 0.75 a 1.25
  const porIntensidade = 1.2 - (intensidade / 10) * 0.4; // 0.8 a 1.2
  return Math.max(0.55, porVelocidade * porIntensidade);
};
