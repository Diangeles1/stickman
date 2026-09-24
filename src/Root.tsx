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
import {
  Prototype,
  duracaoDoPrototipo,
  type PrototypeProps,
} from "./compositions/Prototype";
import { PROTOTIPO } from "./data/fights/prototype";
import { BENCHMARK } from "./data/fights/benchmark";
import { BENCHMARK2 } from "./data/fights/benchmark2";
import { LUTA_COMPLETA } from "./data/fights/luta-completa";
import { gerarLuta } from "./data/gerador";
import { UM_SOCO } from "./data/fights/um-soco";
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
  "launched",
  "groundHit",
  "downed",
  "sitUp",
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

      {/*
        LUTA GERADA. A duracao nao e fixa na composicao: ela e calculada a
        partir da semente, porque cada luta tem um numero de golpes diferente.
        Trocar a semente pela linha de comando gera outra luta:

          node scripts/remotion.mjs render Luta out/luta-7.mp4 --props="{\"seed\":7}"
      */}
      <Composition
        id="Luta"
        component={Prototype}
        fps={VIDEO.fps}
        width={VIDEO.width}
        height={VIDEO.height}
        durationInFrames={600}
        defaultProps={{ seed: 1, segundos: 30, debug: false }}
        calculateMetadata={({ props }: { props: PrototypeProps }) => {
          // a luta e montada AQUI, fora do render, e entra nas props ja
          // pronta: assim o componente nunca gera nada por quadro
          const spec = gerarLuta(props.seed ?? 1, {
            segundos: props.segundos ?? 30,
          });
          return {
            durationInFrames: duracaoDoPrototipo(spec),
            props: { ...props, spec },
          };
        }}
      />

      {/*
        BENCHMARK do motor: os 15 passos da diretiva em 5 a 8 segundos. E este
        que decide se o motor esta pronto para uma luta inteira.
      */}
      <Composition
        id="Benchmark"
        component={Prototype}
        durationInFrames={duracaoDoPrototipo(BENCHMARK)}
        fps={BENCHMARK.fps}
        width={BENCHMARK.width}
        height={BENCHMARK.height}
        defaultProps={{ spec: BENCHMARK, debug: false }}
      />
      {/*
        O MESMO benchmark sem nada alem dos corpos: sem particulas, flash,
        rastros, tremor, audio nem movimento de camera. E aqui que a animacao e
        julgada; efeito so entra depois que esta versao convence.
      */}
      <Composition
        id="Benchmark-SemEfeitos"
        component={Prototype}
        durationInFrames={duracaoDoPrototipo(BENCHMARK)}
        fps={BENCHMARK.fps}
        width={BENCHMARK.width}
        height={BENCHMARK.height}
        defaultProps={{ spec: BENCHMARK, semEfeitos: true }}
      />
      {/* A LUTA COMPLETA: abertura, trocas, aereo, escalada e finalizador */}
      <Composition
        id="LutaCompleta"
        component={Prototype}
        durationInFrames={duracaoDoPrototipo(LUTA_COMPLETA)}
        fps={LUTA_COMPLETA.fps}
        width={LUTA_COMPLETA.width}
        height={LUTA_COMPLETA.height}
        defaultProps={{ spec: LUTA_COMPLETA, debug: false }}
      />
      <Composition
        id="LutaCompleta-SemEfeitos"
        component={Prototype}
        durationInFrames={duracaoDoPrototipo(LUTA_COMPLETA)}
        fps={LUTA_COMPLETA.fps}
        width={LUTA_COMPLETA.width}
        height={LUTA_COMPLETA.height}
        defaultProps={{ spec: LUTA_COMPLETA, semEfeitos: true }}
      />
      {/* BENCHMARK #2: combo encadeado, contra-ataque, esquiva e queda */}
      <Composition
        id="Benchmark2"
        component={Prototype}
        durationInFrames={duracaoDoPrototipo(BENCHMARK2)}
        fps={BENCHMARK2.fps}
        width={BENCHMARK2.width}
        height={BENCHMARK2.height}
        defaultProps={{ spec: BENCHMARK2, debug: false }}
      />
      <Composition
        id="Benchmark2-SemEfeitos"
        component={Prototype}
        durationInFrames={duracaoDoPrototipo(BENCHMARK2)}
        fps={BENCHMARK2.fps}
        width={BENCHMARK2.width}
        height={BENCHMARK2.height}
        defaultProps={{ spec: BENCHMARK2, semEfeitos: true }}
      />
      <Composition
        id="Benchmark-Debug"
        component={Prototype}
        durationInFrames={duracaoDoPrototipo(BENCHMARK)}
        fps={BENCHMARK.fps}
        width={BENCHMARK.width}
        height={BENCHMARK.height}
        defaultProps={{ spec: BENCHMARK, debug: true }}
      />

      {/*
        Teste de UM soco. Existe para responder uma pergunta so: o punho
        encosta? Duas versoes do MESMO dado: uma limpa, para julgar, e uma com
        o overlay de medicao, para conferir o numero. Nunca duas lutas
        diferentes, senao a conferencia nao vale.
      */}
      <Composition
        id="UmSoco"
        component={Prototype}
        durationInFrames={duracaoDoPrototipo(UM_SOCO)}
        fps={UM_SOCO.fps}
        width={UM_SOCO.width}
        height={UM_SOCO.height}
        defaultProps={{ spec: UM_SOCO, debug: false }}
      />
      <Composition
        id="UmSoco-Debug"
        component={Prototype}
        durationInFrames={duracaoDoPrototipo(UM_SOCO)}
        fps={UM_SOCO.fps}
        width={UM_SOCO.width}
        height={UM_SOCO.height}
        defaultProps={{ spec: UM_SOCO, debug: true }}
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
