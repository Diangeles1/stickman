/**
 * TELA DE ESCOLHA: os primeiros 5 segundos do video.
 *
 * "ESCOLHA UM PERSONAGEM!" com os dois lutadores em paineis lado a lado e
 * uma contagem de 5 a 1 no meio. Quem assiste escolhe um antes da luta
 * comecar, e isso da a sensacao de aposta: a pessoa fica ate o fim para ver
 * se acertou. O resultado muda de video para video (ver data/trocar.ts),
 * entao a escolha nunca e obvia.
 *
 * Tudo em coordenada de TELA, dirigido pelo quadro: nada de animacao CSS.
 */

import React from "react";
import {
  AbsoluteFill,
  Audio,
  Sequence,
  staticFile,
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { CORES, Katana } from "../characters/Katana";
import { POSES } from "../characters/poses";
import { PRESETS } from "../characters/presets";
import { ALTURA_QUADRIL } from "../characters/skeleton";
import { Stickman } from "../characters/Stickman";
import type { FighterId, FightSpec, Pose } from "../core/types";
import { FALAS } from "../audio/falas";
import { NARRADOR } from "../audio/registry";
import { FONTE } from "./EspetaculoNaTela";
import { MarcaDagua } from "./MarcaDagua";
import { NOMES } from "./espetaculo";

/** segundos de contagem */
export const SEGUNDOS_DE_ESCOLHA = 5;
/** clarao de passagem para a luta, em quadros */
const PASSAGEM = 14;
/** duracao total da tela, em quadros a 60fps */
export const QUADROS_DE_ESCOLHA = SEGUNDOS_DE_ESCOLHA * 60 + PASSAGEM;

const PILHA = `${FONTE}, "Arial Black", "DejaVu Sans", sans-serif`;
const contorno = (px: number) => ({
  stroke: "#000",
  strokeWidth: px,
  strokeLinejoin: "round" as const,
  paintOrder: "stroke" as const,
});

/** guarda respirando: o peito sobe e desce, os punhos acompanham */
const respirando = (frame: number, fase: number, armado = false): Pose => {
  const g = armado ? POSES.guardaKatana : POSES.guard;
  const k = Math.sin(frame * 0.09 + fase) * 3;
  const sobe = (p?: { x: number; y: number }) =>
    p ? { x: p.x, y: p.y + k } : p;
  return {
    ...g,
    neck: sobe(g.neck),
    head: sobe(g.head),
    handFront: sobe(g.handFront),
    handBack: sobe(g.handBack),
    elbowFront: sobe(g.elbowFront),
    elbowBack: sobe(g.elbowBack),
  };
};

const Painel: React.FC<{
  id: FighterId;
  lado: -1 | 1;
  frame: number;
  fps: number;
  largura: number;
  nome?: string;
  poder?: string;
  arma?: { tipo: "katana"; elemento: "gelo" | "fogo" };
}> = ({ id, lado, frame, fps, largura, nome, poder, arma }) => {
  const preset = PRESETS[id];
  const entra = spring({ frame: frame - (lado < 0 ? 0 : 4), fps, config: { damping: 14, stiffness: 160 } });
  const desliza = interpolate(entra, [0, 1], [lado * largura * 0.6, 0]);
  const x0 = lado < 0 ? 40 : largura / 2 + 10;
  const w = largura / 2 - 50;
  const topo = 470;
  const altura = 1040;
  const chao = topo + altura - 190;
  const escalaExtra = 0.85;
  const quadril = chao - ALTURA_QUADRIL * preset.scale * escalaExtra;
  // cada painel "acende" no seu meio segundo: parece que a escolha esta
  // pulando de um para o outro
  const segundo = Math.floor(frame / 30);
  const aceso = (segundo % 2 === 0) === lado < 0;
  // painel claro na cor do lutador: o personagem aparece com a cor dele de
  // verdade, a mesma da luta
  const cor = id === "black" ? "#c9d1e8" : id === "red" ? "#f7cfca" : "#e8e8e8";

  return (
    <g transform={`translate(${desliza} 0)`}>
      <rect
        x={x0}
        y={topo}
        width={w}
        height={altura}
        rx={28}
        fill={cor}
        opacity={aceso ? 0.95 : 0.7}
        stroke={aceso ? "#ffd23f" : "#ffffff"}
        strokeWidth={aceso ? 14 : 8}
      />
      {/* chao do painel */}
      <rect x={x0 + 30} y={chao} width={w - 60} height={10} rx={5} fill="#000" opacity={0.35} />
      <clipPath id={`painel-${id}`}>
        <rect x={x0} y={topo} width={w} height={altura} rx={28} />
      </clipPath>
      <g clipPath={`url(#painel-${id})`}>
      <Stickman
        preset={preset}
        pose={respirando(frame, lado < 0 ? 0 : 1.7, Boolean(arma))}
        baseX={x0 + w / 2}
        baseY={quadril}
        facing={(lado < 0 ? 1 : -1) as 1 | -1}
        scaleExtra={escalaExtra}
        contorno
      />
      {arma && (
        <Katana
          corpo={{
            x: x0 + w / 2,
            baseY: quadril,
            facing: (lado < 0 ? 1 : -1) as 1 | -1,
            scale: preset.scale * escalaExtra,
            spin: 0,
            giro: 1,
            pose: respirando(frame, lado < 0 ? 0 : 1.7, true),
            poseNome: "guardaKatana",
            noAr: false,
            velocidade: 0,
            aceleracao: 0,
            agachamento: 0,
            correcaoDaMira: 0,
            alcancou: true,
          }}
          elemento={arma.elemento}
          frame={frame}
        />
      )}
      </g>
      <text
        x={x0 + w / 2}
        y={topo + altura - 70}
        textAnchor="middle"
        fontFamily={PILHA}
        fontSize={96}
        fill={id === "black" ? "#2c3350" : preset.stroke}
        stroke="#ffffff"
        strokeWidth={12}
        strokeLinejoin="round"
        paintOrder="stroke"
        letterSpacing={3}
      >
        {nome ?? NOMES[id]}
      </text>
      {poder && (
        <text
          x={x0 + w / 2}
          y={topo + altura - 18}
          textAnchor="middle"
          fontFamily={PILHA}
          fontSize={52}
          fill={arma ? CORES[arma.elemento].borda : "#ffffff"}
          stroke="#1b1b22"
          strokeWidth={8}
          strokeLinejoin="round"
          paintOrder="stroke"
          letterSpacing={2}
        >
          {poder}
        </text>
      )}
    </g>
  );
};

export const TelaDeEscolha: React.FC<{
  a: FighterId;
  b: FighterId;
  /** nomes na tela (padrao: os nomes de cor) */
  nomes?: Partial<Record<FighterId, string>>;
  /** subtitulo de cada painel: o poder do lutador */
  poderes?: Partial<Record<FighterId, string>>;
  armas?: FightSpec["armas"];
}> = ({ a, b, nomes, poderes, armas }) => {
  const frame = useCurrentFrame();
  const { width, height, fps } = useVideoConfig();

  const titulo = spring({ frame, fps, config: { damping: 9, stiffness: 240, mass: 0.6 } });
  const tituloEscala = titulo <= 1 ? 1 + 1.6 * (1 - titulo) : 1 - 0.3 * Math.min(1, titulo - 1);
  const restante = SEGUNDOS_DE_ESCOLHA - Math.floor(frame / fps);
  const noSegundo = frame % fps;
  const pulo = spring({ frame: noSegundo, fps, config: { damping: 8, stiffness: 320, mass: 0.5 } });
  const numeroEscala = pulo <= 1 ? 1 + 1.2 * (1 - pulo) : 1 - 0.25 * Math.min(1, pulo - 1);
  const progresso = noSegundo / fps;
  const raio = 118;
  const cx = width / 2;
  const cy = 650;
  const fim = SEGUNDOS_DE_ESCOLHA * fps;
  const clarao = interpolate(frame, [fim - 4, fim + 2, fim + PASSAGEM], [0, 1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <AbsoluteFill>
      <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
        <defs>
          <radialGradient id="fundoEscolha" cx="50%" cy="45%" r="70%">
            <stop offset="0%" stopColor="#2a2f45" />
            <stop offset="100%" stopColor="#07080d" />
          </radialGradient>
        </defs>
        <rect width={width} height={height} fill="url(#fundoEscolha)" />
        {/* raios girando no fundo: tela de selecao de jogo de luta */}
        <g transform={`translate(${cx} ${cy}) rotate(${frame * 0.4})`} opacity={0.12}>
          {Array.from({ length: 18 }, (_, i) => {
            const ang = (i / 18) * Math.PI * 2;
            const d = 0.08;
            const p = (r: number, da: number) =>
              `${Math.cos(ang + da) * r},${Math.sin(ang + da) * r}`;
            return <polygon key={i} points={`0,0 ${p(2000, d)} ${p(2000, -d)}`} fill="#ffffff" />;
          })}
        </g>

        <g transform={`translate(${cx} 330) scale(${tituloEscala}) rotate(-3)`}>
          <text
            textAnchor="middle"
            fontFamily={PILHA}
            fontSize={112}
            fill="#ffd23f"
            {...contorno(14)}
            letterSpacing={3}
          >
            ESCOLHA UM
          </text>
          <text
            y={110}
            textAnchor="middle"
            fontFamily={PILHA}
            fontSize={112}
            fill="#ffd23f"
            {...contorno(14)}
            letterSpacing={3}
          >
            PERSONAGEM!
          </text>
        </g>

        <Painel id={a} lado={-1} frame={frame} fps={fps} largura={width} nome={nomes?.[a]} poder={poderes?.[a]} arma={armas?.[a]} />
        <Painel id={b} lado={1} frame={frame} fps={fps} largura={width} nome={nomes?.[b]} poder={poderes?.[b]} arma={armas?.[b]} />

        {/* contagem */}
        {restante > 0 && (
          <g>
            <circle cx={cx} cy={cy} r={raio + 18} fill="#000" opacity={0.55} />
            <circle cx={cx} cy={cy} r={raio} fill="#0b0c12" stroke="#ffffff" strokeWidth={10} />
            {/* anel que esvazia dentro do segundo */}
            <circle
              cx={cx}
              cy={cy}
              r={raio}
              fill="none"
              stroke={restante <= 2 ? "#ff2e2e" : "#ffd23f"}
              strokeWidth={14}
              strokeDasharray={`${2 * Math.PI * raio}`}
              strokeDashoffset={`${2 * Math.PI * raio * progresso}`}
              transform={`rotate(-90 ${cx} ${cy})`}
              strokeLinecap="round"
            />
            <g transform={`translate(${cx} ${cy + 62}) scale(${numeroEscala})`}>
              <text
                textAnchor="middle"
                fontFamily={PILHA}
                fontSize={180}
                fill={restante <= 2 ? "#ff2e2e" : "#ffffff"}
                {...contorno(12)}
              >
                {restante}
              </text>
            </g>
          </g>
        )}

        <text
          x={cx}
          y={1590}
          textAnchor="middle"
          fontFamily={PILHA}
          fontSize={66}
          fill="#ffffff"
          {...contorno(10)}
          letterSpacing={2}
          opacity={interpolate(frame, [20, 34], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" })}
        >
          COMENTA QUEM VOCÊ ESCOLHEU!
        </text>

        <rect width={width} height={height} fill="#ffffff" opacity={clarao} />
      </svg>
      <MarcaDagua vaga="rodape" larguraTela={width} />
      {/* tique a cada segundo, com um grave de batida de coracao */}
      {Array.from({ length: SEGUNDOS_DE_ESCOLHA }, (_, k) => (
        <Sequence key={k} from={k * fps} layout="none">
          <Audio src={staticFile("assets/audio/impacts/impact_light_01.wav")} volume={0.7} />
          <Audio src={staticFile("assets/audio/heavy/low_boom_01.wav")} volume={0.25 + k * 0.08} />
        </Sequence>
      ))}
      {/* narrador: chama para a escolha e conta os tres ultimos */}
      <Sequence from={0} layout="none">
        <Audio src={staticFile(FALAS.escolha.arquivo)} volume={NARRADOR.volume} />
      </Sequence>
      {(["tres", "dois", "um"] as const).map((fala, k) => (
        <Sequence key={fala} from={(k + 2) * fps + 6} layout="none">
          <Audio src={staticFile(FALAS[fala].arquivo)} volume={NARRADOR.volume} />
        </Sequence>
      ))}
      <Sequence from={fim - 12} layout="none">
        <Audio src={staticFile("assets/audio/transitions/whoosh_transition_01.wav")} volume={0.6} />
      </Sequence>
      <Sequence from={fim} layout="none">
        <Audio src={staticFile("assets/audio/heavy/heavy_hit_01.wav")} volume={0.6} />
      </Sequence>
    </AbsoluteFill>
  );
};
