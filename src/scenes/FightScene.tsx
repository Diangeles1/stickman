/**
 * Cena de luta: junta camera, cenario, lutadores e efeitos num quadro.
 *
 * Este componente NAO sabe qual luta esta desenhando. Recebe uma Timeline e
 * desenha o quadro atual. Trocar a luta e trocar os dados, nao o codigo.
 *
 * Ordem das camadas, de tras para frente: fundo, arena, poeira, aura, lutadores,
 * particulas, ondas de choque, e por fim o flash, que e o unico que fica FORA
 * da camera porque cobre a tela e nao o mundo.
 */

import React from "react";
import { useCurrentFrame, useVideoConfig } from "remotion";
import { alturaNoAr, amostrar, quadroEfetivo } from "../animation/sampler";
import { Arena } from "../backgrounds/Arena";
import { cameraNoQuadro, transformDaCamera } from "../camera/camera";
import { PRESETS } from "../characters/presets";
import { ALTURA_QUADRIL } from "../characters/skeleton";
import { Stickman } from "../characters/Stickman";
import {
  Aura,
  Flash,
  LinhasDeVelocidade,
  Ondas,
  Particulas,
} from "../effects/Impact";
import { poeiraAmbiente } from "../particles/particles";
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

/** Acima desta velocidade (unidades por quadro) aparecem linhas de velocidade. */
const LIMITE_LINHAS = 26;

export const FightScene: React.FC<FightSceneProps> = ({ timeline }) => {
  const frameReal = useCurrentFrame();
  const { width, height, fps } = useVideoConfig();

  // hit stop: durante os quadros de impacto o tempo PARA, e e isso que faz o
  // golpe pesar. A timeline continua intacta; so o quadro consultado congela.
  const frame = quadroEfetivo(timeline, frameReal);

  const cam = cameraNoQuadro(timeline, frame, CAMERA_PADRAO, {
    largura: width,
    alturaQuadril: -ALTURA_QUADRIL,
  });
  const { fighterA, fighterB, seed } = timeline.spec;

  // rachaduras abertas pelos impactos que JA aconteceram neste quadro: elas
  // sao consequencia da acao, nao desenho permanente do cenario
  const rachaduras = timeline.impacts
    .filter((i) => i.cracksGround && i.frame <= frame)
    .map((i) => i.at.x);

  const poeira = React.useMemo(
    () => poeiraAmbiente(seed, frame, fps),
    [seed, frame, fps],
  );

  /** Forca da aura de um lutador neste quadro, vinda dos beats de powerUp. */
  const auraDe = (id: string): number => {
    let forca = 0;
    for (const s of timeline.scheduled) {
      if (s.beat.type !== "powerUp" || s.beat.who !== id) continue;
      if (frame < s.from) continue;
      // sobe durante o beat e se mantem depois: a aura ficou ligada
      const subida = Math.min(1, (frame - s.from) / Math.max(1, s.to - s.from));
      forca = Math.max(forca, subida);
    }
    return forca;
  };

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      style={{ background: "#0e0f13" }}
    >
      <defs>
        <linearGradient id="ceu" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#0b0c10" />
          <stop offset="100%" stopColor="#171a22" />
        </linearGradient>
      </defs>
      <rect width={width} height={height} fill="url(#ceu)" />

      <g transform={transformDaCamera(cam, width, height)}>
        <Arena seed={seed} rachaduras={rachaduras} />

        {/* poeira no ar: o cenario respira mesmo quando ninguem se move */}
        <g data-layer="ambient-dust">
          {poeira.map((p, i) => (
            <circle
              key={i}
              cx={p.pos.x}
              cy={p.pos.y}
              r={p.raio}
              fill="#9aa4bb"
              opacity={p.opacidade}
            />
          ))}
        </g>

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
          const preset = PRESETS[id];
          const forcaAura = auraDe(id);
          const rapido = Math.abs(a.velocidade) > LIMITE_LINHAS;

          return (
            <g key={id}>
              {forcaAura > 0.02 && (
                <Aura
                  centro={{ x: a.x, y: baseY }}
                  cor={preset.auraColor}
                  forca={forcaAura}
                  frame={frame}
                />
              )}
              {rapido && (
                <LinhasDeVelocidade
                  origem={{ x: a.x, y: baseY }}
                  direcao={Math.sign(a.velocidade)}
                  forca={Math.min(
                    1,
                    (Math.abs(a.velocidade) - LIMITE_LINHAS) / 60,
                  )}
                  seed={seed}
                  chave={`sl-${id}-${Math.round(frame / 3)}`}
                />
              )}
              <Stickman
                preset={preset}
                pose={a.pose}
                baseX={a.x}
                baseY={baseY}
                facing={facing}
                // a inclinacao vem da velocidade: e o movimento corporal
                // integrado. O sinal acompanha o lado para o qual ele olha.
                spin={a.inclinacao * facing}
              />
            </g>
          );
        })}

        <Particulas
          impactos={timeline.impacts}
          frame={frame}
          seed={seed}
          fps={fps}
        />
        <Ondas impactos={timeline.impacts} frame={frame} />
      </g>

      {/* o flash cobre a TELA, nao o mundo: fica fora do grupo da camera */}
      <Flash
        impactos={timeline.impacts}
        frame={frame}
        largura={width}
        altura={height}
      />
    </svg>
  );
};
