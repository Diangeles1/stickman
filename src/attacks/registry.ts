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

import { corpos } from "../core/time";
import type { AttackDef, AttackName, ImpactTier } from "../core/types";

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
    // 260 rendia 357 unidades depois do bonus de forca e do cambaleio, ou
    // seja 0,6 corpo de deslocamento para um soco reto. Alem de exagerado por
    // si, empurrava o alvo para fora do que o plano de dois cabe no zoom
    // minimo legivel, e a camera passava a cortar o atacante por 0,6s.
    //
    // O peso do golpe nao vem da distancia: vem da dobra do corpo, do hit
    // stop, do fechamento da camera e do cambaleio. Ja aprendemos isso no
    // finalizador, que a 4,7 corpos lia como teletransporte.
    knockback: 190,
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
    strike: 14,
    recover: 24,
    // 8 e nao 6: golpe que lanca precisa de tempo para as pernas empurrarem
    // antes do braco subir; em 5 quadros a corrente inteira cabia em dois
    contactAt: 8,
    tier: "extreme",
    knockback: 520,
    hitStop: 6,
    contactJoint: "handFront",
    sound: "heavyHit",
    launches: true,
    // curta distancia: o punho SOBE com o braco dobrado ate o queixo
    extensao: 0.72,
    // e continua subindo depois do contato
    seguimento: { x: 0.35, y: -1 },
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
    // o ANTEBRACO da frente lidera a investida, colado ao corpo. Era o ombro,
    // que e raiz de cadeia: nao ha membro para a cinematica inversa mirar, e
    // toda investida gerada errava o alvo por 90 a 136 unidades.
    contactJoint: "elbowFront",
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
    // no quadro do contato o pulo esta a 60% do tempo no ar: H = g T^2 / 8
    // com T = 0,65 s (39 quadros) da 190, e 4H(0,6)(0,4) = 182 acima do apoio
    elevacao: 182,
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
    // no quadro do contato o pulo esta a 60% do tempo no ar: H = g T^2 / 8
    // com T = 0,65 s (39 quadros) da 190, e 4H(0,6)(0,4) = 182 acima do apoio
    elevacao: 182,
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
 * TETO DE KNOCKBACK POR INTENSIDADE, em corpos de distancia.
 *
 * O deslocamento e calibrado no CORPO do personagem, nao em numero solto: e a
 * unica medida que continua valendo se a escala do boneco mudar.
 *
 * O limite existe porque o finalizador chegou a 2826 unidades (4,7 corpos): o
 * alvo saia do cenario, a camera tinha que abrir e os dois viravam pontos na
 * tela. A sensacao virou "foi teletransportado", nao "foi chutado".
 *
 * O teto e aplicado DEPOIS do bonus de forca do atacante, entao lutador forte
 * chega mais perto do teto, mas nunca passa dele.
 */
export const TETO_KNOCKBACK: Record<ImpactTier, number> = {
  light: corpos(0.45),    // um passo para tras
  medium: corpos(1.1),    // um corpo de distancia
  // 2.2 ainda era demais: a auditoria de camera mediu 1,6s com o ATACANTE
  // cortado fora do quadro depois do chute, porque a 900 unidades de
  // separacao o plano de dois nao cabe no zoom minimo legivel e a camera tem
  // que escolher um dos dois. 1.5 corpo continua sendo um lancamento.
  extreme: corpos(1.5),
};

/** Aplica o bonus de forca e corta no teto da intensidade. */
export const knockbackEfetivo = (
  base: number,
  tier: ImpactTier,
  forcaDoAtacante: number,
): number =>
  Math.min(TETO_KNOCKBACK[tier], base * (1 + forcaDoAtacante * 0.6));

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
