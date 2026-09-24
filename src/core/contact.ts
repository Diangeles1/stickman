/**
 * Coreografia baseada em CONTATO.
 *
 * O PROBLEMA QUE ISTO RESOLVE: a distancia de combate era um multiplicador
 * chutado (1,8 vezes o comprimento do braco). Medido depois: o punho parava a
 * 294 unidades do alvo, meio corpo de distancia. O golpe era animado no vazio.
 *
 * O PRINCIPIO: a distancia de combate nao e escolhida, e DERIVADA. Para cada
 * golpe, mede-se onde o membro atacante realmente chega no quadro de contato,
 * e a distancia e essa. Se a pose mudar, a distancia acompanha sozinha.
 *
 * Nenhum valor magico: tudo sai da geometria da pose.
 */

import { POSES } from "../characters/poses";
import { PRESETS } from "../characters/presets";
import { juntasNoMundo } from "../characters/skeleton";
import type {
  AttackDef,
  FighterId,
  JointName,
  PoseName,
  Vec2,
} from "./types";

/** Pontos de contato do ALVO: onde um golpe pode acertar. */
export type PontoAlvo = "head" | "chest" | "torso" | "legs" | "center";

/** Junta que representa cada ponto do alvo. */
const JUNTA_DO_ALVO: Record<PontoAlvo, JointName> = {
  head: "head",
  chest: "neck",
  torso: "hip",
  legs: "kneeFront",
  center: "hip",
};

/**
 * Tipo de reacao, escolhido pela regiao atingida.
 * Cada um dobra o corpo de um jeito diferente (ver poses de reacao).
 */
export type TipoDeReacao = "headHit" | "chestHit" | "bodyHit" | "legHit";

export const REACAO_DO_PONTO: Record<PontoAlvo, TipoDeReacao> = {
  head: "headHit",
  chest: "chestHit",
  torso: "bodyHit",
  center: "bodyHit",
  legs: "legHit",
};

/** Pose de reacao correspondente a cada tipo. */
export const POSE_DA_REACAO: Record<TipoDeReacao, PoseName> = {
  headHit: "hitHead",
  chestHit: "hitChest",
  bodyHit: "hitBody",
  legHit: "hitLeg",
};

/**
 * Onde a junta atacante esta, em relacao ao quadril, na pose do golpe.
 *
 * Positivo = a frente do quadril, no sentido para o qual o lutador olha.
 * E ESTA a medida que define a distancia de combate.
 */
export const alcanceDoGolpe = (
  golpe: AttackDef,
  lutador: FighterId,
): { x: number; y: number } => {
  const preset = PRESETS[lutador];
  const juntas = juntasNoMundo(POSES[golpe.pose], {
    baseX: 0,
    baseY: 0,
    facing: 1,
    scale: preset.scale,
  });
  const p = juntas[golpe.contactJoint];
  return { x: p.x, y: p.y };
};

/**
 * Onde o ponto atingido do alvo esta, em relacao ao quadril dele.
 *
 * Usa a pose de guarda, que e a que o alvo tem na hora de levar o golpe.
 */
export const posicaoDoAlvo = (
  ponto: PontoAlvo,
  lutador: FighterId,
  pose: PoseName = "guard",
): Vec2 => {
  const preset = PRESETS[lutador];
  const juntas = juntasNoMundo(POSES[pose], {
    baseX: 0,
    baseY: 0,
    facing: 1,
    scale: preset.scale,
  });
  return juntas[JUNTA_DO_ALVO[ponto]];
};

/**
 * Quanto o punho AFUNDA no corpo, medido da superficie para dentro.
 *
 * Encostar exatamente na superficie le como "chegou perto". Afundar um pouco
 * le como golpe. Afundar muito le como atravessar: foi o que estava
 * acontecendo, com o punho 51 unidades PASSADO do eixo do tronco, ou seja
 * saindo do outro lado do corpo.
 */
const AFUNDAMENTO = 12;

/**
 * DISTANCIA DE COMBATE para este golpe, contra este alvo, neste ponto.
 *
 * DERIVACAO, porque foi errando isto que o golpe passou a bater no vazio e
 * depois a atravessar o corpo. Com o alvo a direita, o atacante a esquerda, e
 * D a distancia entre os dois quadris:
 *
 *   atacante olha para +1  ->  punho.x  = Xb - D + alcance.x
 *   alvo    olha para -1  ->  ponto.x  = Xb - pontoNoAlvo.x     (espelhado)
 *
 *   folga = ponto.x - punho.x = D - alcance.x - pontoNoAlvo.x
 *
 * Queremos folga = (meia espessura do tronco + meia espessura do punho) menos
 * o afundamento, que e o ponto em que o punho encosta na SUPERFICIE e entra um
 * pouco. Isolando D:
 *
 *   D = alcance.x + pontoNoAlvo.x + superficie - AFUNDAMENTO
 *
 * O erro anterior era um sinal: usava MENOS pontoNoAlvo.x. Como esse termo vale
 * ~12 unidades, o erro somava ~67 com a penetracao chutada de 26, e era
 * exatamente o que colocava o punho atravessado no tronco.
 */
export const distanciaDeCombate = (
  golpe: AttackDef,
  atacante: FighterId,
  alvo: FighterId,
  ponto: PontoAlvo,
): number => {
  const alcance = alcanceDoGolpe(golpe, atacante);
  const noAlvo = posicaoDoAlvo(ponto, alvo);

  // os membros sao tracos grossos: a superficie do corpo fica meia espessura
  // a frente do eixo da junta, dos dois lados
  const meioTronco = (PRESETS[alvo].limbWidth * PRESETS[alvo].scale) / 2;
  const meioPunho = (PRESETS[atacante].limbWidth * PRESETS[atacante].scale) / 2;
  const superficie = meioTronco + meioPunho;

  return Math.max(
    120,
    alcance.x + noAlvo.x + superficie - AFUNDAMENTO,
  );
};

/** Folga que a distancia de combate persegue: usada pelo medidor de contato. */
export const folgaDesejada = (atacante: FighterId, alvo: FighterId): number =>
  (PRESETS[alvo].limbWidth * PRESETS[alvo].scale) / 2 +
  (PRESETS[atacante].limbWidth * PRESETS[atacante].scale) / 2 -
  AFUNDAMENTO;

/**
 * Ponto de contato em coordenadas de MUNDO, no quadro do golpe.
 *
 * E aqui que nascem o flash, a onda de choque e as particulas. Antes eles
 * usavam um deslocamento fixo em relacao ao alvo, o que punha o efeito num
 * lugar que nao tinha nada a ver com onde o membro chegou.
 */
export const pontoDeContato = (
  golpe: AttackDef,
  atacante: FighterId,
  xAtacante: number,
  facing: 1 | -1,
  alturaQuadril: number,
): Vec2 => {
  const alcance = alcanceDoGolpe(golpe, atacante);
  return {
    x: xAtacante + alcance.x * facing,
    y: -alturaQuadril + alcance.y,
  };
};

/**
 * Qual ponto do alvo cada golpe procura, por padrao.
 *
 * Pode ser sobrescrito por beat, que e o que o briefing pede
 * ({ attackPoint, targetPoint }). Isto e so o padrao sensato.
 */
export const ALVO_PADRAO: Record<string, PontoAlvo> = {
  punch: "chest",
  punchFast: "chest",
  punchHeavy: "chest",
  uppercut: "head",
  kick: "torso",
  kickLow: "legs",
  kickHigh: "head",
  spinKick: "chest",
  knee: "torso",
  elbow: "head",
  charge: "torso",
  airAttack: "head",
  diveAttack: "chest",
  special: "chest",
  finisher: "chest",
};
