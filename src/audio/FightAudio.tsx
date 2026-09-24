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
import { logicoParaReal } from "../core/tempo";
import type { Timeline } from "../core/types";
import { espetaculoDe } from "../effects/espetaculo";
import { TEMPO_DA_DANCA } from "../animation/danca";
import {
  AMBIENTE,
  BATIDA_ESTALO,
  BATIDA_GRAVE,
  REFORCO_HITSTOP,
  SOM_ABERTURA_LUTE,
  SOM_ABERTURA_VS,
  SOM_ESQUIVA,
  SOM_KO,
  SOM_QUEDA,
  SOM_VENCEDOR,
  SOM_AURA,
  SONS,
  type CamadaDeSom,
} from "./registry";

export type FightAudioProps = {
  timeline: Timeline;
};

/**
 * Quadro logico da timeline -> quadro real do video.
 *
 * O hit stop e a camera lenta esticam o video; o mapa em core/tempo.ts sabe
 * onde cada quadro logico foi parar.
 */
const paraQuadroReal = (timeline: Timeline, quadroLogico: number): number =>
  logicoParaReal(timeline, quadroLogico);

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

/** Um som composto inteiro disparado num quadro real. */
const Disparo: React.FC<{ som: CamadaDeSom[]; quadro: number; fps: number }> = ({
  som,
  quadro,
  fps,
}) => (
  <>
    {som.map((c, k) => (
      <Camada key={k} camada={c} quadroDoContato={quadro} fps={fps} />
    ))}
  </>
);

export const FightAudio: React.FC<FightAudioProps> = ({ timeline }) => {
  const { fps, durationInFrames } = useVideoConfig();
  const e = espetaculoDe(timeline);
  const vence = e.rotulos.find((r) => r.vaga === "vence");

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

      {/* ESPETACULO: cada letreiro e cada queda tem o seu som, no mesmo
          quadro real em que aparece na tela */}
      <Disparo som={SOM_ABERTURA_VS} quadro={e.abertura.vs} fps={fps} />
      <Disparo som={SOM_ABERTURA_LUTE} quadro={e.abertura.lute} fps={fps} />
      {e.esquivas.map((q, i) => (
        <Disparo key={`esq-${i}`} som={SOM_ESQUIVA} quadro={q} fps={fps} />
      ))}
      {e.quedas.map((q, i) => (
        <Disparo key={`queda-${i}`} som={SOM_QUEDA} quadro={q.real} fps={fps} />
      ))}
      {e.ko && <Disparo som={SOM_KO} quadro={e.ko.real} fps={fps} />}
      {vence && <Disparo som={SOM_VENCEDOR} quadro={vence.inicio} fps={fps} />}

      {/* batida do passinho: grave no tempo (quando o joelho afunda),
          estalo no contratempo */}
      {timeline.scheduled
        .filter((b) => b.beat.type === "danca")
        .flatMap((b) => {
          const tempos = Math.floor((b.to - b.from) / TEMPO_DA_DANCA);
          return Array.from({ length: tempos }, (_, k) => {
            const tempo = b.from + k * TEMPO_DA_DANCA;
            return (
              <React.Fragment key={`batida-${b.from}-${k}`}>
                <Camada
                  camada={BATIDA_GRAVE}
                  quadroDoContato={paraQuadroReal(timeline, tempo)}
                  fps={fps}
                />
                <Camada
                  camada={BATIDA_ESTALO}
                  quadroDoContato={paraQuadroReal(
                    timeline,
                    tempo + TEMPO_DA_DANCA / 2,
                  )}
                  fps={fps}
                />
              </React.Fragment>
            );
          });
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
