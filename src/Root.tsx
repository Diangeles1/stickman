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
import { trocarVencedor } from "./data/trocar";
import { TESTE_KATANA } from "./data/fights/teste-katana";
import { GELO_VS_FOGO } from "./data/fights/gelo-vs-fogo";
import { DOMINIO } from "./data/fights/dominio";
import { DUELO_DO_VALE, DUELO_DO_VALE_2 } from "./data/fights/duelo-do-vale";
import { duelo, dueloDoDia } from "./data/fights/diario";
import { NINJAS } from "./data/fights/ninjas";
import { DUELO } from "./data/fights/duelo";
import {
  AvatarDoCanal,
  BannerDoCanal,
  CapaDoVideo,
} from "./compositions/ArteDoCanal";
import { UM_SOCO } from "./data/fights/um-soco";
import type { PoseName } from "./core/types";

/** a luta completa com os papeis invertidos: o vermelho vence */
const LUTA_VERMELHO_VENCE: typeof LUTA_COMPLETA = {
  ...trocarVencedor(LUTA_COMPLETA),
  scenario: "cidade",
};
/** a luta completa num vilarejo de rabisco */
const LUTA_NO_VILAREJO: typeof LUTA_COMPLETA = {
  ...LUTA_COMPLETA,
  scenario: "vilarejo",
};

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
      {/*
        A DURACAO SAI DO SPEC QUE CHEGA, e nao do PROTOTIPO.

        Ela era fixa em `duracaoDoPrototipo(PROTOTIPO)`. Como esta composicao
        aceita um `spec` nas props -- e e por ela que se renderiza uma luta
        avulsa para conferir --, passar outra luta rendia um video cortado no
        tamanho do prototipo: 787 quadros, 13 segundos, sem nenhum aviso.
        Tropecei nisso duas vezes achando que o render tinha falhado.

        Com `calculateMetadata` o padrao continua sendo o prototipo e quem
        passa outro spec recebe a luta inteira.
      */}
      <Composition
        id="Prototype"
        component={Prototype}
        durationInFrames={duracaoDoPrototipo(PROTOTIPO)}
        fps={PROTOTIPO.fps}
        width={PROTOTIPO.width}
        height={PROTOTIPO.height}
        defaultProps={{ spec: PROTOTIPO }}
        calculateMetadata={({ props }) => {
          const p = props as { spec?: typeof PROTOTIPO; escolha?: boolean };
          const spec = p.spec ?? PROTOTIPO;
          return {
            durationInFrames: duracaoDoPrototipo(spec, { escolha: p.escolha ?? false }),
            fps: spec.fps,
            width: spec.width,
            height: spec.height,
          };
        }}
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
        defaultProps={{ seed: 1, segundos: 30, debug: false, escolha: true }}
        calculateMetadata={({ props }: { props: PrototypeProps }) => {
          // a luta e montada AQUI, fora do render, e entra nas props ja
          // pronta: assim o componente nunca gera nada por quadro
          const spec = gerarLuta(props.seed ?? 1, {
            segundos: props.segundos ?? 30,
          });
          /*
            A TELA DE ESCOLHA VEM LIGADA. Esta composicao e a que produz video
            para publicar, e o gancho ("escolha um personagem") e o que faz o
            espectador ficar ate o fim para saber se acertou. Quem quiser a
            luta crua passa escolha: false nas props.
          */
          const escolha = props.escolha ?? true;
          return {
            durationInFrames: duracaoDoPrototipo(spec, { escolha }),
            props: { ...props, spec, escolha },
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
      {/*
        EPISODIO "ESCOLHA UM PERSONAGEM": a tela de escolha com a contagem e
        depois a luta completa. Dois finais da mesma coreografia: o preto
        vence, ou os papeis se invertem e o vermelho vence (data/trocar.ts).
      */}
      <Composition
        id="Escolha-PretoVence"
        component={Prototype}
        durationInFrames={duracaoDoPrototipo(LUTA_NO_VILAREJO, { escolha: true })}
        fps={LUTA_COMPLETA.fps}
        width={LUTA_COMPLETA.width}
        height={LUTA_COMPLETA.height}
        defaultProps={{ spec: LUTA_NO_VILAREJO, escolha: true }}
      />
      <Composition
        id="Escolha-VermelhoVence"
        component={Prototype}
        durationInFrames={duracaoDoPrototipo(LUTA_VERMELHO_VENCE, { escolha: true })}
        fps={LUTA_COMPLETA.fps}
        width={LUTA_COMPLETA.width}
        height={LUTA_COMPLETA.height}
        defaultProps={{ spec: LUTA_VERMELHO_VENCE, escolha: true }}
      />
      {/*
        BENCHMARK #3: oito segundos de duelo armado. A versao SemEfeitos e a
        que julga a animacao; a outra existe so para comparar.
      */}
      <Composition
        id="Duelo-SemEfeitos"
        component={Prototype}
        durationInFrames={duracaoDoPrototipo(DUELO)}
        fps={DUELO.fps}
        width={DUELO.width}
        height={DUELO.height}
        defaultProps={{ spec: DUELO, semEfeitos: true }}
      />
      <Composition
        id="Duelo"
        component={Prototype}
        durationInFrames={duracaoDoPrototipo(DUELO)}
        fps={DUELO.fps}
        width={DUELO.width}
        height={DUELO.height}
        defaultProps={{ spec: DUELO }}
      />

      {/* DUELO DO VALE: verde contra roxo, COM placar e vencedor */}
      <Composition
        id="DueloDoVale"
        component={Prototype}
        durationInFrames={duracaoDoPrototipo(DUELO_DO_VALE)}
        fps={DUELO_DO_VALE.fps}
        width={DUELO_DO_VALE.width}
        height={DUELO_DO_VALE.height}
        defaultProps={{ spec: DUELO_DO_VALE }}
      />

      {/*
        A MESMA LUTA COM A TELA DE ESCOLHA, e e esta que vai para o canal.

        O gancho ("escolha um personagem") e o que faz o espectador ficar ate
        o fim para saber se acertou -- ver a mesma nota na composicao gerada.
        A versao sem escolha fica como fonte crua, para conferir a luta.
      */}
      <Composition
        id="DueloDoVale-Escolha"
        component={Prototype}
        durationInFrames={duracaoDoPrototipo(DUELO_DO_VALE, { escolha: true })}
        fps={DUELO_DO_VALE.fps}
        width={DUELO_DO_VALE.width}
        height={DUELO_DO_VALE.height}
        defaultProps={{ spec: DUELO_DO_VALE, escolha: true }}
      />

      {/*
        O DUELO DE HOJE. A composicao le a data na hora de montar, entao o
        mesmo comando produz um video diferente a cada dia sem ninguem
        editar nada (ver data/fights/diario.ts e scripts/diario.mts).
      */}
      <Composition
        id="DueloDoDia"
        component={Prototype}
        /*
          A DATA VEM DAS PROPS, e cair no `new Date()` so quando ninguem pedir.

          Sem isso, renderizar um dia futuro produzia a luta de HOJE com o
          titulo de amanha -- o script calculava o duelo da data pedida para o
          texto e a composicao ignorava, porque lia o relogio. Um erro que nao
          aparece em nada: o video renderiza, publica e esta errado.
        */
        calculateMetadata={({ props }) => {
          const quando = (props as { data?: string }).data;
          const spec = duelo(dueloDoDia(quando ? new Date(`${quando}T12:00:00Z`) : new Date()));
          return {
            durationInFrames: duracaoDoPrototipo(spec, { escolha: true }),
            fps: spec.fps,
            width: spec.width,
            height: spec.height,
            props: { spec, escolha: true },
          };
        }}
        durationInFrames={3600}
        fps={60}
        width={1080}
        height={1920}
        defaultProps={{ spec: duelo(dueloDoDia(new Date())), escolha: true }}
      />

      {/* A MESMA luta com Lucas e Gabriel, e o outro vencedor */}
      <Composition
        id="DueloDoVale2-Escolha"
        component={Prototype}
        durationInFrames={duracaoDoPrototipo(DUELO_DO_VALE_2, { escolha: true })}
        fps={DUELO_DO_VALE_2.fps}
        width={DUELO_DO_VALE_2.width}
        height={DUELO_DO_VALE_2.height}
        defaultProps={{ spec: DUELO_DO_VALE_2, escolha: true }}
      />

      {/* DOMINIO: o de branco contra o de marcas */}
      <Composition
        id="Ninjas"
        component={Prototype}
        durationInFrames={duracaoDoPrototipo(NINJAS)}
        fps={NINJAS.fps}
        width={NINJAS.width}
        height={NINJAS.height}
        defaultProps={{ spec: NINJAS }}
      />
      <Composition
        id="Ninjas-Escolha"
        component={Prototype}
        durationInFrames={duracaoDoPrototipo(NINJAS, { escolha: true })}
        fps={NINJAS.fps}
        width={NINJAS.width}
        height={NINJAS.height}
        defaultProps={{ spec: NINJAS, escolha: true }}
      />
      <Composition
        id="Dominio"
        component={Prototype}
        durationInFrames={duracaoDoPrototipo(DOMINIO)}
        fps={DOMINIO.fps}
        width={DOMINIO.width}
        height={DOMINIO.height}
        defaultProps={{ spec: DOMINIO }}
      />
      {/*
        MESMA luta, estilo diferente. Existe para comparar: os dados sao
        identicos, so o preset de animacao muda (ver animation/estilo.ts).
      */}
      <Composition
        id="Dominio-Anime"
        component={Prototype}
        durationInFrames={duracaoDoPrototipo(DOMINIO)}
        fps={DOMINIO.fps}
        width={DOMINIO.width}
        height={DOMINIO.height}
        defaultProps={{ spec: { ...DOMINIO, estilo: "anime" as const } }}
      />
      <Composition
        id="Dominio-Pesado"
        component={Prototype}
        durationInFrames={duracaoDoPrototipo(DOMINIO)}
        fps={DOMINIO.fps}
        width={DOMINIO.width}
        height={DOMINIO.height}
        defaultProps={{ spec: { ...DOMINIO, estilo: "combatePesado" as const } }}
      />
      <Composition
        id="Dominio-Escolha"
        component={Prototype}
        durationInFrames={duracaoDoPrototipo(DOMINIO, { escolha: true })}
        fps={DOMINIO.fps}
        width={DOMINIO.width}
        height={DOMINIO.height}
        defaultProps={{ spec: DOMINIO, escolha: true }}
      />

      {/* PALITANOS: BLACK ICE vs RED FIRE */}
      <Composition
        id="GeloVsFogo"
        component={Prototype}
        durationInFrames={duracaoDoPrototipo(GELO_VS_FOGO)}
        fps={GELO_VS_FOGO.fps}
        width={GELO_VS_FOGO.width}
        height={GELO_VS_FOGO.height}
        defaultProps={{ spec: GELO_VS_FOGO }}
      />
      <Composition
        id="GeloVsFogo-Escolha"
        component={Prototype}
        durationInFrames={duracaoDoPrototipo(GELO_VS_FOGO, { escolha: true })}
        fps={GELO_VS_FOGO.fps}
        width={GELO_VS_FOGO.width}
        height={GELO_VS_FOGO.height}
        defaultProps={{ spec: GELO_VS_FOGO, escolha: true }}
      />
      <Composition
        id="TesteKatana"
        component={Prototype}
        durationInFrames={duracaoDoPrototipo(TESTE_KATANA)}
        fps={TESTE_KATANA.fps}
        width={TESTE_KATANA.width}
        height={TESTE_KATANA.height}
        defaultProps={{ spec: TESTE_KATANA }}
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

      {/* ARTE DO CANAL: um quadro so cada, para exportar como imagem */}
      <Composition id="Banner" component={BannerDoCanal} durationInFrames={1} fps={30} width={2048} height={1152} />
      <Composition id="Avatar" component={AvatarDoCanal} durationInFrames={1} fps={30} width={800} height={800} />
      <Composition
        id="CapaDoVideo"
        component={CapaDoVideo}
        durationInFrames={1}
        fps={30}
        width={1280}
        height={720}
        defaultProps={{ titulo: "GELO vs FOGO", subtitulo: "QUEM VENCE?" }}
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
