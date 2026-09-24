/**
 * PLACAR E LETREIROS: a camada de tela que prende quem esta assistindo.
 *
 * Fica FORA da camera (e tela, nao mundo): barras de vida no topo como num
 * jogo de luta, placas de nome com "VS" na abertura, e letreiros que batem
 * na tela no instante do evento (COMBO, ESQUIVA, BLOQUEIO, K.O.).
 *
 * O roteiro de tudo vem de espetaculo.ts. Aqui so se desenha, a partir do
 * quadro REAL: o letreiro continua se mexendo durante o hit stop e a camera
 * lenta, e e isso que faz o congelamento parecer proposital.
 */

import React from "react";
import {
  AbsoluteFill,
  continueRender,
  delayRender,
  interpolate,
  spring,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { PRESETS } from "../characters/presets";
import type { FighterId, Timeline } from "../core/types";
import {
  NOMES,
  espetaculoDe,
  vidaNoQuadro,
  type Rotulo,
} from "./espetaculo";

/**
 * Bangers: letra de gibi, a mesma familia visual dos letreiros de luta.
 * Arquivo local (public/assets/fonts), entao o render nao depende de rede.
 */
export const FONTE = "Bangers";
const PILHA = `${FONTE}, "Arial Black", "DejaVu Sans", sans-serif`;

if (typeof window !== "undefined" && typeof FontFace !== "undefined") {
  const espera = delayRender("fonte Bangers");
  const fonte = new FontFace(
    FONTE,
    `url(${staticFile("assets/fonts/Bangers-Regular.ttf")})`,
  );
  fonte
    .load()
    .then(() => {
      document.fonts.add(fonte);
      continueRender(espera);
    })
    // sem a fonte o video sai com a reserva; nao vale travar o render
    .catch(() => continueRender(espera));
}

/** cor do lutador na interface: o "preto" e escuro demais sobre o painel */
const corDe = (id: FighterId): string =>
  id === "black" ? "#dfe5f5" : PRESETS[id].stroke;

/** contorno grosso de letreiro: em SVG o traco vai por baixo do preenchimento */
const contorno = (px: number, cor = "#000"): React.SVGProps<SVGTextElement> => ({
  stroke: cor,
  strokeWidth: px,
  strokeLinejoin: "round",
  paintOrder: "stroke",
});

/**
 * Escala de uma PANCADA a partir de uma mola: entra grande, bate, amassa um
 * pouco no repique e assenta em 1. Sem o limite o repique da mola passava do
 * ponto e o letreiro encolhia ate sumir.
 */
const batida = (mola: number): number =>
  mola <= 1 ? 1 + 1.6 * (1 - mola) : 1 - 0.35 * Math.min(1, mola - 1);

/**
 * Altura do placar. O topo da tela do TikTok/Shorts fica coberto pela
 * interface do app ("Seguindo | Para voce"): a 70px o placar sumia embaixo
 * dela.
 */
const TOPO = 220;

// ---------------------------------------------------------------------------

const Barra: React.FC<{
  id: FighterId;
  lado: -1 | 1;
  vida: number;
  fantasma: number;
  atingido: number;
  entrada: number;
  largura: number;
}> = ({ id, lado, vida, fantasma, atingido, entrada, largura }) => {
  const L = 430;
  const H = 46;
  const x0 = lado < 0 ? 44 : largura - 44 - L;
  // a barra ancora na borda de fora e esvazia rumo ao centro
  const cheia = (v: number) => (L - 8) * (v / 100);
  const pisca = atingido < 6;
  const baixa = vida <= 25;
  const cor = baixa ? "#ff3b30" : "#ffd23f";
  const desliza = interpolate(entrada, [0, 1], [-160, 0]);
  const tremor = atingido < 10 ? (atingido % 2 === 0 ? 1 : -1) * (10 - atingido) : 0;
  const barraX = (v: number) => (lado < 0 ? x0 + 4 : x0 + L - 4 - cheia(v));

  return (
    <g transform={`translate(${tremor} ${desliza})`} opacity={entrada}>
      {/* painel */}
      <rect
        x={x0 - 6}
        y={TOPO}
        width={L + 12}
        height={H + 12}
        rx={10}
        fill="#0b0c12"
        stroke="#ffffff"
        strokeWidth={4}
      />
      <rect x={x0 + 4} y={TOPO + 10} width={L - 8} height={H - 8} fill="#3a0d0f" />
      {/* fantasma: o que acabou de ser perdido, descendo atrasado */}
      <rect
        x={barraX(fantasma)}
        y={TOPO + 10}
        width={cheia(fantasma)}
        height={H - 8}
        fill="#ffffff"
        opacity={0.85}
      />
      <rect
        x={barraX(vida)}
        y={TOPO + 10}
        width={cheia(vida)}
        height={H - 8}
        fill={pisca ? "#ffffff" : cor}
      />
      <rect
        x={barraX(vida)}
        y={TOPO + 10}
        width={cheia(vida)}
        height={(H - 8) * 0.35}
        fill="#ffffff"
        opacity={0.35}
      />
      <text
        x={lado < 0 ? x0 : x0 + L}
        y={TOPO + 110}
        textAnchor={lado < 0 ? "start" : "end"}
        fontFamily={PILHA}
        fontSize={64}
        fill={corDe(id)}
        {...contorno(10)}
        letterSpacing={2}
      >
        {NOMES[id]}
      </text>
    </g>
  );
};

// ---------------------------------------------------------------------------

const Letreiro: React.FC<{
  r: Rotulo;
  idade: number;
  fps: number;
  largura: number;
  altura: number;
}> = ({ r, idade, fps, largura, altura }) => {
  const entra = spring({
    frame: idade,
    fps,
    config: { damping: 10, stiffness: 260, mass: 0.6 },
  });
  // pancada: entra grande e bate no tamanho; o normal nasce do zero
  const escala = r.pancada
    ? batida(entra)
    : interpolate(entra, [0, 1], [0.2, 1], { extrapolateRight: "clamp" });
  const some = interpolate(
    idade,
    [r.duracao - 10, r.duracao],
    [1, 0],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
  );
  const aparece = interpolate(idade, [0, 3], [0, 1], {
    extrapolateRight: "clamp",
  });
  // o letreiro respira depois de bater, senao parece colado na tela
  const pulso = 1 + 0.03 * Math.sin(idade * 0.35);
  const x =
    r.lado === 0 ? largura / 2 : r.lado < 0 ? largura * 0.27 : largura * 0.73;
  const inclinacao = r.lado === 0 ? -4 : r.lado * 6;

  return (
    <g
      transform={`translate(${x} ${altura * r.y}) rotate(${inclinacao}) scale(${escala * pulso})`}
      opacity={some * aparece}
    >
      <text
        textAnchor="middle"
        fontFamily={PILHA}
        fontSize={r.tamanho}
        fill={r.cor}
        {...contorno(Math.max(8, r.tamanho * 0.11))}
        letterSpacing={3}
      >
        {r.texto}
      </text>
      {r.sub && (
        <text
          y={r.tamanho * 0.62}
          textAnchor="middle"
          fontFamily={PILHA}
          fontSize={r.tamanho * 0.42}
          fill="#ffffff"
          {...contorno(8)}
          letterSpacing={2}
        >
          {r.sub}
        </text>
      )}
    </g>
  );
};

// ---------------------------------------------------------------------------

const Abertura: React.FC<{
  a: FighterId;
  b: FighterId;
  frame: number;
  fps: number;
  vs: number;
  lute: number;
  fim: number;
  largura: number;
  altura: number;
}> = ({ a, b, frame, fps, vs, lute, fim, largura, altura }) => {
  if (frame > lute + 40) return null;
  const sai = interpolate(frame, [fim - 8, fim], [1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const chega = spring({ frame, fps, config: { damping: 14, stiffness: 180 } });
  const bate = spring({
    frame: frame - vs,
    fps,
    config: { damping: 8, stiffness: 300, mass: 0.5 },
  });
  const luteIdade = frame - lute;
  const lutaEscala = spring({
    frame: luteIdade,
    fps,
    config: { damping: 9, stiffness: 280, mass: 0.5 },
  });
  const y = altura * 0.27;
  return (
    <g>
      {frame < fim && (
        <g opacity={sai}>
          {/* faixas diagonais atras dos nomes */}
          <polygon
            points={`0,${y - 150} ${largura * 0.62},${y - 190} ${largura * 0.5},${y + 10} 0,${y + 40}`}
            fill={corDe(a) === "#dfe5f5" ? "#1b1f2c" : corDe(a)}
            opacity={0.92}
            transform={`translate(${interpolate(chega, [0, 1], [-largura, 0])} 0)`}
          />
          <polygon
            points={`${largura},${y + 30} ${largura * 0.38},${y + 70} ${largura * 0.5},${y + 250} ${largura},${y + 220}`}
            fill={PRESETS[b].stroke}
            opacity={0.92}
            transform={`translate(${interpolate(chega, [0, 1], [largura, 0])} 0)`}
          />
          <text
            x={interpolate(chega, [0, 1], [-400, 60])}
            y={y - 50}
            fontFamily={PILHA}
            fontSize={120}
            fill="#ffffff"
            {...contorno(12)}
          >
            {NOMES[a]}
          </text>
          <text
            x={interpolate(chega, [0, 1], [largura + 400, largura - 60])}
            y={y + 175}
            textAnchor="end"
            fontFamily={PILHA}
            fontSize={120}
            fill="#ffffff"
            {...contorno(12)}
          >
            {NOMES[b]}
          </text>
          {frame >= vs && (
            <text
              x={largura / 2}
              y={y + 95}
              textAnchor="middle"
              fontFamily={PILHA}
              fontSize={200}
              fill="#ffd23f"
              {...contorno(16)}
              transform={`translate(${largura / 2} ${y + 30}) scale(${batida(bate)}) translate(${-largura / 2} ${-(y + 30)})`}
            >
              VS
            </text>
          )}
        </g>
      )}
      {luteIdade >= 0 && luteIdade < 40 && (
        <g
          transform={`translate(${largura / 2} ${altura * 0.25}) rotate(-5) scale(${batida(lutaEscala)})`}
          opacity={interpolate(luteIdade, [30, 40], [1, 0], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
          })}
        >
          <text
            textAnchor="middle"
            fontFamily={PILHA}
            fontSize={210}
            fill="#ff2e2e"
            {...contorno(18)}
            letterSpacing={4}
          >
            LUTE!
          </text>
        </g>
      )}
    </g>
  );
};

// ---------------------------------------------------------------------------

export const Espetaculo: React.FC<{ timeline: Timeline }> = ({ timeline }) => {
  const frame = useCurrentFrame();
  const { width, height, fps } = useVideoConfig();
  const e = espetaculoDe(timeline);
  const { fighterA, fighterB } = timeline.spec;

  // placar: entra junto com o LUTE!
  // e sai quando a placa do vencedor sobe: a placa ocupa o alto da tela
  const entrada =
    interpolate(
      frame,
      [e.entradaDoPlacar, e.entradaDoPlacar + 12],
      [0, 1],
      { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
    ) *
    interpolate(
      frame,
      [e.saidaDoPlacar - 14, e.saidaDoPlacar],
      [1, 0],
      { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
    );

  // letreiros: em cada vaga so aparece o mais recente
  const porVaga = new Map<string, Rotulo>();
  for (const r of e.rotulos) {
    if (frame < r.inicio || frame >= r.inicio + r.duracao) continue;
    const atual = porVaga.get(r.vaga);
    if (!atual || r.inicio >= atual.inicio) porVaga.set(r.vaga, r);
  }
  // o K.O. apaga o resto do centro e dos lados
  const koNaTela = e.rotulos.some(
    (r) => r.texto === "K.O.!" && frame >= r.inicio,
  );

  // selo no meio do placar: acende em vermelho no nocaute
  const koAceso = koNaTela && Math.floor((frame - (e.ko?.real ?? 0)) / 6) % 2 === 0;

  return (
    <AbsoluteFill style={{ pointerEvents: "none" }}>
      <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
        {entrada > 0 && (
          <g>
            {([fighterA, fighterB] as FighterId[]).map((id, i) => {
              const v = vidaNoQuadro(e, id, frame);
              return (
                <Barra
                  key={id}
                  id={id}
                  lado={i === 0 ? -1 : 1}
                  vida={v.vida}
                  fantasma={v.fantasma}
                  atingido={v.atingido}
                  entrada={entrada}
                  largura={width}
                />
              );
            })}
            <g opacity={entrada}>
              <circle
                cx={width / 2}
                cy={TOPO + 29}
                r={52}
                fill={koAceso ? "#ff2e2e" : "#0b0c12"}
                stroke="#ffffff"
                strokeWidth={5}
              />
              <text
                x={width / 2}
                y={TOPO + 52}
                textAnchor="middle"
                fontFamily={PILHA}
                fontSize={62}
                fill={koAceso ? "#ffffff" : "#ffd23f"}
              >
                {koNaTela ? "KO" : "VS"}
              </text>
            </g>
          </g>
        )}

        <Abertura
          a={fighterA}
          b={fighterB}
          frame={frame}
          fps={fps}
          {...e.abertura}
          largura={width}
          altura={height}
        />

        {[...porVaga.values()]
          .filter(
            (r) =>
              !koNaTela || r.vaga === "centro" || r.vaga === "vence",
          )
          .map((r) => (
            <Letreiro
              key={`${r.vaga}-${r.inicio}`}
              r={r}
              idade={frame - r.inicio}
              fps={fps}
              largura={width}
              altura={height}
            />
          ))}
      </svg>
    </AbsoluteFill>
  );
};
