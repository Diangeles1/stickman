/**
 * Registro das composicoes.
 *
 * Alem das composicoes de video, ficam aqui as FOLHAS DE TRABALHO (PoseSheet),
 * que nao entram em video nenhum e servem para validar pose e enquadramento
 * sem renderizar uma luta inteira.
 */

import "./index.css";
import React from "react";
import { Composition } from "remotion";
import { PoseSheet } from "./compositions/PoseSheet";
import { Prototype, duracaoDoPrototipo } from "./compositions/Prototype";
import { PROTOTIPO } from "./data/fights/prototype";
import type { PoseName } from "./core/types";

/** Alvo do projeto: vertical de Shorts/TikTok a 60fps. */
export const VIDEO = {
  width: 1080,
  height: 1920,
  fps: 60,
} as const;

const POSES_LOCOMOCAO: PoseName[] = [
  "idle",
  "guard",
  "walk1",
  "walk2",
  "run1",
  "run2",
  "sprint1",
  "sprint2",
  "jump",
  "airborne",
  "land",
  "charge",
];

const POSES_COMBATE: PoseName[] = [
  "punch",
  "punchFast",
  "punchHeavy",
  "uppercut",
  "kick",
  "kickLow",
  "kickHigh",
  "spinKick",
  "knee",
  "elbow",
  "airAttack",
  "diveAttack",
];

const POSES_REACAO: PoseName[] = [
  "block",
  "dodge",
  "duck",
  "advance",
  "retreat",
  "knockback",
  "downed",
  "getUp",
];

export const RemotionRoot: React.FC = () => {
  return (
    <>
      {/* a luta: os dados vem de data/fights, nao daqui */}
      <Composition
        id="Prototype"
        component={Prototype}
        durationInFrames={duracaoDoPrototipo(PROTOTIPO)}
        fps={PROTOTIPO.fps}
        width={PROTOTIPO.width}
        height={PROTOTIPO.height}
        defaultProps={{ spec: PROTOTIPO }}
      />

      <Composition
        id="PoseSheet-Locomocao"
        component={PoseSheet}
        durationInFrames={1}
        fps={VIDEO.fps}
        width={VIDEO.width}
        height={VIDEO.height}
        defaultProps={{
          poses: POSES_LOCOMOCAO,
          fighter: "black" as const,
          colunas: 3,
        }}
      />
      <Composition
        id="PoseSheet-Combate"
        component={PoseSheet}
        durationInFrames={1}
        fps={VIDEO.fps}
        width={VIDEO.width}
        height={VIDEO.height}
        defaultProps={{
          poses: POSES_COMBATE,
          fighter: "red" as const,
          colunas: 3,
        }}
      />
      <Composition
        id="PoseSheet-Reacao"
        component={PoseSheet}
        durationInFrames={1}
        fps={VIDEO.fps}
        width={VIDEO.width}
        height={VIDEO.height}
        defaultProps={{
          poses: POSES_REACAO,
          fighter: "black" as const,
          colunas: 2,
        }}
      />
    </>
  );
};
