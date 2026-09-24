/**
 * Trilha sonora da luta, montada a partir da timeline.
 *
 * SINCRONIA: cada camada e posicionada em relacao ao quadro de CONTATO do
 * golpe, nao ao inicio dele. O whoosh tem offset negativo, entao ele comeca
 * antes e TERMINA no contato; o impacto entra exatamente no contato; o grave
 * entra dois quadros depois. E isso que faz a imagem e o som parecerem uma
 * coisa so.
 *
 * O quadro de contato usado aqui e o quadro REAL do video (com o hit stop
 * somado), nao o quadro logico da timeline. Sem essa conversao o som chegaria
 * adiantado em relacao a imagem congelada.
 */

import React from "react";
import { Audio, Sequence, staticFile, useVideoConfig } from "remotion";
import type { Timeline } from "../core/types";
import {
  AMBIENTE,
  REFORCO_HITSTOP,
  SOM_AURA,
  SONS,
  type CamadaDeSom,
} from "./registry";

export type FightAudioProps = {
  timeline: Timeline;
};

/**
 * Converte um quadro logico da timeline no quadro real do video.
 *
 * O hit stop congela a imagem repetindo o quadro do impacto, o que empurra
 * tudo que vem depois para frente. A funcao quadroEfetivo em sampler.ts faz o
 * caminho inverso (real -> logico); aqui precisamos de logico -> real.
 */
const paraQuadroReal = (timeline: Timeline, quadroLogico: number): number => {
  let somado = 0;
  for (const i of timeline.impacts) {
    if (i.hitStop > 0 && i.frame < quadroLogico) somado += i.hitStop;
  }
  return quadroLogico + somado;
};

/** Uma camada, posicionada no tempo. */
const Camada: React.FC<{
  camada: CamadaDeSom;
  quadroDoContato: number;
  fps: number;
}> = ({ camada, quadroDoContato, fps }) => {
  const inicio = Math.round(quadroDoContato + camada.offset * fps);
  // Sequence nao aceita inicio negativo: se o whoosh comecaria antes do video,
  // cortamos o comeco dele em vez de atrasar o som
  const from = Math.max(0, inicio);
  const cortar = from - inicio;

  return (
    <Sequence from={from} durationInFrames={Infinity} layout="none">
      <Audio
        src={staticFile(camada.arquivo)}
        volume={camada.volume}
        startFrom={cortar > 0 ? cortar : undefined}
      />
    </Sequence>
  );
};

export const FightAudio: React.FC<FightAudioProps> = ({ timeline }) => {
  const { fps, durationInFrames } = useVideoConfig();

  return (
    <>
      {/* ambiente: um leito grave que roda o video inteiro, bem baixo */}
      <Sequence from={0} durationInFrames={durationInFrames} layout="none">
        <Audio src={staticFile(AMBIENTE.arquivo)} volume={AMBIENTE.volume} loop />
      </Sequence>

      {/* um som composto por impacto, ancorado no quadro de contato */}
      {timeline.impacts.map((imp, i) => {
        const camadas = SONS[imp.sound];
        if (!camadas) return null;
        const contatoReal = paraQuadroReal(timeline, imp.frame);
        const reforco = REFORCO_HITSTOP[imp.tier];

        return (
          <React.Fragment key={`imp-${i}`}>
            {camadas.map((c, k) => (
              <Camada
                key={k}
                camada={c}
                quadroDoContato={contatoReal}
                fps={fps}
              />
            ))}
            {reforco && imp.hitStop > 0 && (
              <Camada
                camada={reforco}
                quadroDoContato={contatoReal}
                fps={fps}
              />
            )}
          </React.Fragment>
        );
      })}

      {/* aura: disparada no inicio do beat de powerUp */}
      {timeline.scheduled
        .filter((s) => s.beat.type === "powerUp")
        .map((s, i) => (
          <React.Fragment key={`aura-${i}`}>
            {SOM_AURA.map((c, k) => (
              <Camada
                key={k}
                camada={c}
                quadroDoContato={paraQuadroReal(timeline, s.from)}
                fps={fps}
              />
            ))}
          </React.Fragment>
        ))}
    </>
  );
};
