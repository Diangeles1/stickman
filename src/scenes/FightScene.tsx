/**
 * Cena de luta: junta camera, cenario e lutadores num quadro.
 *
 * Este componente NAO sabe qual luta esta desenhando. Ele recebe uma Timeline
 * e desenha o quadro atual. Trocar a luta e trocar os dados, nao o codigo, que
 * e a regra mais importante do briefing.
 */

import React from "react";
import { useCurrentFrame, useVideoConfig } from "remotion";
import { alturaNoAr, amostrar, quadroEfetivo } from "../animation/sampler";
import { Arena } from "../backgrounds/Arena";
import { cameraNoQuadro, transformDaCamera } from "../camera/camera";
import { PRESETS } from "../characters/presets";
import { ALTURA_QUADRIL } from "../characters/skeleton";
import { Stickman } from "../characters/Stickman";
import type { Timeline } from "../core/types";

export type FightSceneProps = {
  timeline: Timeline;
};

/** Enquadramento inicial, usado antes da primeira chave de camera. */
const CAMERA_PADRAO = {
  center: { x: 0, y: -ALTURA_QUADRIL - 120 },
  // 0.62 deixava o corpo com 19% da altura da tela, pequeno demais para
  // Shorts. Em 0.95 ele ocupa ~30%, que e onde a acao se le no celular.
  zoom: 0.95,
};

export const FightScene: React.FC<FightSceneProps> = ({ timeline }) => {
  const frameReal = useCurrentFrame();
  const { width, height } = useVideoConfig();

  // hit stop: durante os quadros de impacto o tempo PARA, e e isso que faz o
  // golpe pesar. A timeline continua intacta; so o quadro consultado congela.
  const frame = quadroEfetivo(timeline, frameReal);

  const cam = cameraNoQuadro(timeline, frame, CAMERA_PADRAO, {
    largura: width,
    alturaQuadril: -ALTURA_QUADRIL,
  });
  const { fighterA, fighterB, seed } = timeline.spec;

  // rachaduras abertas pelos impactos que JA aconteceram neste quadro
  const rachaduras = timeline.impacts
    .filter((i) => i.cracksGround && i.frame <= frame)
    .map((i) => i.at.x);

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      style={{ background: "#0e0f13" }}
    >
      {/* degrade do fundo: escuro no topo, um pouco mais claro no horizonte */}
      <defs>
        <linearGradient id="ceu" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#0b0c10" />
          <stop offset="100%" stopColor="#171a22" />
        </linearGradient>
      </defs>
      <rect width={width} height={height} fill="url(#ceu)" />

      <g transform={transformDaCamera(cam, width, height)}>
        <Arena seed={seed} rachaduras={rachaduras} />

        {[fighterA, fighterB].map((id, indice) => {
          const track = timeline.tracks[id];
          const a = amostrar(track, frame);
          const outro = amostrar(
            timeline.tracks[indice === 0 ? fighterB : fighterA],
            frame,
          );
          // cada um sempre encara o outro: sem isso o golpe sai de costas
          const facing: 1 | -1 = a.x <= outro.x ? 1 : -1;
          const baseY = alturaNoAr(track, frame, ALTURA_QUADRIL);

          return (
            <Stickman
              key={id}
              preset={PRESETS[id]}
              pose={a.pose}
              baseX={a.x}
              baseY={baseY}
              facing={facing}
            />
          );
        })}
      </g>
    </svg>
  );
};
