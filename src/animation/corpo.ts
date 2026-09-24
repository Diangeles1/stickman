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
 * Aqui o personagem e APOIADO: a altura do quadril e derivada do pe mais baixo
 * da pose. Isso da de graca o que antes faltava, porque perna que dobra baixa
 * o quadril:
 *
 *   - oscilacao vertical na corrida (o corpo sobe e desce a cada passada)
 *   - o corpo afunda ao carregar um golpe e ao aterrissar
 *   - centro de massa coerente com as pernas, sem ninguem animar isso na mao
 */

import {
  alturaDoVoo,
  amostrar,
  inclinacaoDesenhada,
} from "./sampler";
import {
  ALTURA_QUADRIL,
  PE_NO_CHAO,
  escalaDoMundo,
  juntasNoMundo,
  peMaisBaixo,
} from "../characters/skeleton";
import type {
  FighterPreset,
  FighterTrack,
  Pose,
  PoseName,
  Vec2,
} from "../core/types";

/** Poses em que o corpo respira. Postura de espera, nunca durante a acao. */
const POSES_QUE_RESPIRAM = new Set<PoseName>(["idle", "guard"]);

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
 * Amplitude minima de proposito. Respiracao que se nota deixa de ser
 * respiracao e vira balanco.
 */
// 1.6 unidades de pose davam 4px na tela: invisivel, e o lutador continuava
// lendo como manequim. 4.2 da ~12 unidades de mundo, que se percebe sem virar
// balanco. O limite e o squash do tronco (20% de 74 = 14.8).
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

export type Corpo = {
  /** posicao do quadril no mundo */
  x: number;
  baseY: number;
  facing: 1 | -1;
  /** escala do preset, ja pronta para juntasNoMundo */
  scale: number;
  spin: number;
  pose: Pose;
  poseNome: PoseName;
  velocidade: number;
  aceleracao: number;
  /** quanto o quadril baixou em relacao ao apoio neutro, em unidades de mundo */
  agachamento: number;
};

/**
 * Resolve o corpo de um lutador no quadro pedido.
 *
 * `compressao` vem da absorcao do impacto e multiplica a altura do quadril,
 * comprimindo o corpo CONTRA o chao em vez de encolher no ar.
 */
export const corpoNoQuadro = (args: {
  track: FighterTrack;
  outro: FighterTrack;
  frame: number;
  preset: FighterPreset;
  compressao?: number;
  /** defasagem da respiracao, para os dois nao respirarem em sincronia */
  defasagem?: number;
}): Corpo => {
  const {
    track,
    outro,
    frame,
    preset,
    compressao = 1,
    defasagem = 0,
  } = args;

  const a = amostrar(track, frame);
  const b = amostrar(outro, frame);

  // cada um sempre encara o outro: sem isso o golpe sai de costas
  const facing: 1 | -1 = a.x <= b.x ? 1 : -1;

  const pose = POSES_QUE_RESPIRAM.has(a.poseNome)
    ? respirar(a.pose, frame, defasagem)
    : a.pose;

  const escala = escalaDoMundo(preset.scale);

  // Em pose de ataque ou de reacao a inclinacao e zerada: a pose ja tem a
  // atitude do corpo desenhada, e girar o corpo no quadro do contato tirava o
  // punho do ponto onde a geometria calculou o contato.
  const spin = inclinacaoDesenhada(a) * facing;

  // APOIO: o pe mais baixo encosta no chao. Quando a perna dobra, o quadril
  // baixa, e e dai que sai o peso do movimento.
  //
  // Medido no corpo JA INCLINADO E ESPELHADO, e nao na pose crua. A primeira
  // versao usava a pose crua e deixava 20 quadros com o pe fora do chao, o
  // pior a 53 unidades: o spin gira o esqueleto em volta do quadril, entao o
  // pe mais baixo da pose deixa de ser o pe mais baixo na tela. Corpo
  // inclinado tem que apoiar no pe que de fato chega mais perto do chao.
  const local = juntasNoMundo(pose, {
    baseX: 0,
    baseY: 0,
    facing,
    scale: preset.scale,
    spin,
  });
  const apoio = Math.max(local.footFront.y, local.footBack.y);
  const voo = alturaDoVoo(track, frame);

  return {
    x: a.x,
    baseY: (-apoio - voo) * compressao,
    facing,
    scale: preset.scale * compressao,
    spin,
    pose,
    poseNome: a.poseNome,
    velocidade: a.velocidade,
    aceleracao: a.aceleracao,
    agachamento: apoio - PE_NO_CHAO * escala,
  };
};

/**
 * Altura do quadril de uma pose APOIADA, sem consultar trilha nenhuma.
 *
 * O compilador precisa disto para saber onde o membro atacante vai estar no
 * quadro do contato, e o compilador roda antes de existir trilha.
 */
export const baseYDaPose = (pose: Pose, escalaDoLutador: number): number =>
  -peMaisBaixo(pose) * escalaDoMundo(escalaDoLutador);

/** Altura do quadril neutra, para quem so precisa de uma referencia. */
export const BASE_Y_NEUTRO = -ALTURA_QUADRIL;

/** Ponto do mundo no meio do corpo, util para camera e efeitos. */
export const centroDoCorpo = (c: Corpo): Vec2 => ({
  x: c.x,
  y: c.baseY - 120,
});
