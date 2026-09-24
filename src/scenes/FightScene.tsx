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
import { corpoNoQuadro } from "../animation/corpo";
import { poseDeContato, quadroEfetivo } from "../animation/sampler";
import { Arena } from "../backgrounds/Arena";
import { cameraNoQuadro, transformDaCamera } from "../camera/camera";
import { PRESETS } from "../characters/presets";
import { ALTURA_QUADRIL } from "../characters/skeleton";
import { Stickman } from "../characters/Stickman";
import {
  Aura,
  Clarao,
  Flash,
  LinhasDeVelocidade,
  Ondas,
  Particulas,
} from "../effects/Impact";
import { DebugOverlay } from "../debug/DebugOverlay";
import { poeiraAmbiente } from "../particles/particles";
import type { Timeline } from "../core/types";

export type FightSceneProps = {
  timeline: Timeline;
  /** liga o overlay de medicao (punho, alvo, distancia). Desligado no render final. */
  debug?: boolean;
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

export const FightScene: React.FC<FightSceneProps> = ({ timeline, debug = false }) => {
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

  // Estado dos dois lutadores neste quadro, resolvido UMA vez. As camadas de
  // tras (aura, linhas) e a da frente (corpos) leem daqui, entao nao existe a
  // possibilidade de uma camada discordar da outra.
  const lutadores = [fighterA, fighterB].map((id) => {
    const corpo = corpoNoQuadro(timeline, id, frame);
    return {
      id,
      corpo,
      preset: PRESETS[id],
      // Em pose de contato (golpe dado ou recebido) nao ha linha de
      // velocidade: ela sujava justamente os quadros em que o corpo precisa
      // ser lido. No knockback ela continua, que e onde ela ganha o seu
      // salario.
      rapido:
        Math.abs(corpo.velocidade) > LIMITE_LINHAS &&
        !poseDeContato(corpo.poseNome),
    };
  });

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      style={{ background: "#06070a" }}
    >
      <defs>
        <linearGradient id="ceu" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#050609" />
          <stop offset="100%" stopColor="#0d0f15" />
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

        {/*
          Onda de choque e clarao vao ATRAS dos lutadores. Na frente eles
          cobriam exatamente o punho e o peito, que sao as duas coisas que o
          espectador precisa ver no quadro do golpe: o traco da onda passava
          por cima do corpo e clareava o vermelho. Atras, recortam a silhueta
          dos dois contra a luz, que e o efeito que se quer.

          So as PARTICULAS ficam na frente: estilhaco voando na frente do
          corpo e correto, e sao poucos e pequenos.
        */}
        <Ondas impactos={timeline.impacts} frame={frame} />
        <Clarao impactos={timeline.impacts} frame={frame} />

        {/* aura e linhas de velocidade FICAM ATRAS dos dois corpos. A linha de
            velocidade do lutador empurrado atravessava o peito do outro, e no
            quadro do golpe isso vira sujeira em cima da acao. */}
        <g data-layer="atras-dos-corpos">
          {lutadores.map(({ id, corpo, preset, rapido }) => (
            <g key={`tras-${id}`}>
              {auraDe(id) > 0.02 && (
                <Aura
                  centro={{ x: corpo.x, y: corpo.baseY }}
                  cor={preset.auraColor}
                  forca={auraDe(id)}
                  frame={frame}
                />
              )}
              {rapido && (
                <LinhasDeVelocidade
                  origem={{ x: corpo.x, y: corpo.baseY }}
                  direcao={Math.sign(corpo.velocidade)}
                  forca={Math.min(
                    1,
                    (Math.abs(corpo.velocidade) - LIMITE_LINHAS) / 60,
                  )}
                  seed={seed}
                  chave={`sl-${id}-${Math.round(frame / 3)}`}
                />
              )}
            </g>
          ))}
        </g>

        {lutadores.map(({ id, corpo, preset }) => (
          <Stickman
            key={id}
            preset={preset}
            pose={corpo.pose}
            baseX={corpo.x}
            baseY={corpo.baseY}
            facing={corpo.facing}
            scaleExtra={corpo.scale / preset.scale}
            spin={corpo.spin}
          />
        ))}

        <Particulas
          impactos={timeline.impacts}
          frame={frame}
          seed={seed}
          fps={fps}
        />

        {debug && <DebugOverlay timeline={timeline} frame={frame} />}
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
