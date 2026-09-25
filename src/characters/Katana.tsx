/**
 * KATANA: a lamina na mao da frente.
 *
 * A direcao da lamina e a do ANTEBRACO (cotovelo -> mao): por isso as poses
 * de katana (poses.ts) sao escritas pensando primeiro em para onde o
 * antebraco aponta. Assim a espada acompanha o golpe sem animacao propria:
 * o braco corta, a lamina vai junto.
 *
 * Dois elementos, duas leituras:
 *   gelo  lamina clara e translucida, borda ciano, brilho frio e firme
 *   fogo  lamina incandescente, borda laranja, chamas que tremulam
 *
 * O RASTRO DO CORTE (ArcoDaKatana) e o que vende a velocidade: a 60fps o
 * corte dura poucos quadros, e o olho so le o golpe se ve o caminho que a
 * lamina varreu. Ele e a area entre as posicoes recentes da lamina.
 */

import React from "react";
import { corpoNoQuadro, juntasDoCorpo, type Corpo } from "../animation/corpo";
import type { FighterId, Timeline, Vec2 } from "../core/types";
import { ESCALA_POSE } from "./skeleton";

export type Elemento = "gelo" | "fogo";

/** comprimento da lamina em unidades de pose (o corpo tem ~200 de altura) */
const LAMINA = 100;
const CABO = 22;

export const CORES: Record<Elemento, { lamina: string; borda: string; brilho: string; rastro: string }> = {
  gelo: { lamina: "#eefbff", borda: "#46c6ff", brilho: "#7fe0ff", rastro: "#9be8ff" },
  fogo: { lamina: "#fff1c9", borda: "#ff6a1a", brilho: "#ff3d00", rastro: "#ff8a2a" },
};

/** mao, direcao da lamina e comprimento, em mundo */
export const geometriaDaLamina = (
  corpo: Corpo,
): { mao: Vec2; dir: Vec2; comprimento: number; normal: Vec2 } => {
  const j = juntasDoCorpo(corpo);
  const dx = j.handFront.x - j.elbowFront.x;
  const dy = j.handFront.y - j.elbowFront.y;
  const n = Math.hypot(dx, dy) || 1;
  const dir = { x: dx / n, y: dy / n };
  return {
    mao: j.handFront,
    dir,
    comprimento: LAMINA * ESCALA_POSE * corpo.scale,
    normal: { x: -dir.y, y: dir.x },
  };
};

const ruido = (n: number) => {
  const x = Math.sin(n * 91.7 + 13.1) * 43758.5453;
  return x - Math.floor(x);
};

export const Katana: React.FC<{
  corpo: Corpo;
  elemento: Elemento;
  frame: number;
  /** 0 a 1: quanto da lamina sobrou (1 inteira; a espada quebrada fica curta) */
  inteira?: number;
}> = ({ corpo, elemento, frame, inteira = 1 }) => {
  const { mao, dir, comprimento, normal } = geometriaDaLamina(corpo);
  const cor = CORES[elemento];
  const L = comprimento * inteira;
  // curvatura da katana (sori): a lamina arqueia para o lado do fio
  const lado = corpo.facing;
  const ponto = (t: number, larg: number): Vec2 => {
    const curva = Math.sin(t * Math.PI * 0.9) * comprimento * 0.045 * lado;
    return {
      x: mao.x + dir.x * L * t + normal.x * (curva + larg),
      y: mao.y + dir.y * L * t + normal.y * (curva + larg),
    };
  };
  const esp = 9 * corpo.scale;
  const lamina: Vec2[] = [];
  const N = 10;
  for (let i = 0; i <= N; i++) lamina.push(ponto(i / N, esp * (1 - (i / N) * 0.55)));
  for (let i = N; i >= 0; i--) lamina.push(ponto(i / N, -esp * (1 - (i / N) * 0.55) * 0.4));
  const d = lamina.map((p, i) => `${i ? "L" : "M"}${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(" ") + " Z";
  const cabo = {
    x1: mao.x - dir.x * CABO * ESCALA_POSE * corpo.scale * 0.7,
    y1: mao.y - dir.y * CABO * ESCALA_POSE * corpo.scale * 0.7,
  };
  const tsuba = 14 * corpo.scale;
  const pulso = 0.85 + 0.15 * Math.sin(frame * 0.4);

  return (
    <g data-part="katana">
      {/* brilho: a aura do elemento em volta da lamina */}
      <path d={d} fill="none" stroke={cor.brilho} strokeWidth={26 * corpo.scale} strokeLinejoin="round" opacity={0.22 * pulso} />
      <path d={d} fill="none" stroke={cor.brilho} strokeWidth={12 * corpo.scale} strokeLinejoin="round" opacity={0.35 * pulso} />
      <path d={d} fill={cor.lamina} stroke={cor.borda} strokeWidth={4 * corpo.scale} strokeLinejoin="round" />
      {/* cabo e guarda */}
      <line x1={cabo.x1} y1={cabo.y1} x2={mao.x} y2={mao.y} stroke="#1b1b22" strokeWidth={13 * corpo.scale} strokeLinecap="round" />
      <line
        x1={mao.x - normal.x * tsuba}
        y1={mao.y - normal.y * tsuba}
        x2={mao.x + normal.x * tsuba}
        y2={mao.y + normal.y * tsuba}
        stroke={cor.borda}
        strokeWidth={7 * corpo.scale}
        strokeLinecap="round"
      />
      {elemento === "fogo" &&
        // chamas saindo da lamina e SUBINDO (fogo sobe, nao importa o angulo
        // da espada), pequenas, dos dois lados, trocando de forma a cada 2
        // quadros
        Array.from({ length: 9 }, (_, i) => {
          const t = 0.12 + i * 0.095;
          if (t > inteira) return null;
          const lado2 = i % 2 ? 1 : -0.5;
          const base = ponto(t, esp * 0.6 * lado2);
          const q = Math.floor(frame / 2);
          const alt = (18 + 22 * ruido(i * 7 + q)) * corpo.scale;
          const ond = (ruido(i * 3 + q) - 0.5) * 12 * corpo.scale;
          const topo = { x: base.x + ond, y: base.y - alt };
          const w = 6 * corpo.scale;
          return (
            <path
              key={i}
              d={`M${base.x - w} ${base.y} Q${base.x - w * 0.6 + ond} ${base.y - alt * 0.55} ${topo.x} ${topo.y} Q${base.x + w * 0.6 + ond} ${base.y - alt * 0.55} ${base.x + w} ${base.y} Z`}
              fill={i % 3 === 0 ? "#ffd046" : i % 3 === 1 ? "#ff7a1a" : "#ff4a14"}
              opacity={0.8}
            />
          );
        })}
      {elemento === "gelo" && (
        // cristais de gelo presos na lamina, faiscando
        <>
          {Array.from({ length: 4 }, (_, i) => {
            const t = 0.25 + i * 0.18;
            if (t > inteira) return null;
            const p = ponto(t, esp * 1.2);
            const r = (5 + 5 * ruido(i + Math.floor(frame / 4))) * corpo.scale;
            return (
              <path
                key={i}
                d={`M${p.x} ${p.y - r} L${p.x + r * 0.4} ${p.y} L${p.x} ${p.y + r} L${p.x - r * 0.4} ${p.y} Z`}
                fill="#ffffff"
                opacity={0.6 + 0.4 * ruido(i * 5 + Math.floor(frame / 3))}
              />
            );
          })}
        </>
      )}
    </g>
  );
};

/** quantas amostras formam o rastro, e de quantos em quantos quadros */
const AMOSTRAS = 8;
const PASSO = 0.6;

/**
 * RASTRO DO CORTE: a faixa varrida pela lamina nos ultimos quadros.
 * So existe durante o disparo de um golpe (entre o inicio da mira e alguns
 * quadros depois do contato).
 */
export const ArcoDaKatana: React.FC<{
  timeline: Timeline;
  frame: number;
  id: FighterId;
  elemento: Elemento;
}> = ({ timeline, frame, id, elemento }) => {
  const aim = timeline.aims.find(
    (m) => m.who === id && m.recuo && frame >= m.from && frame <= m.contact + 6,
  );
  if (!aim) return null;
  const pontas: Vec2[] = [];
  const meios: Vec2[] = [];
  for (let k = 0; k < AMOSTRAS; k++) {
    const f = frame - k * PASSO;
    if (f < aim.from) break;
    const g = geometriaDaLamina(corpoNoQuadro(timeline, id, f));
    pontas.push({ x: g.mao.x + g.dir.x * g.comprimento, y: g.mao.y + g.dir.y * g.comprimento });
    meios.push({ x: g.mao.x + g.dir.x * g.comprimento * 0.62, y: g.mao.y + g.dir.y * g.comprimento * 0.62 });
  }
  if (pontas.length < 3) return null;
  let varrido = 0;
  for (let i = 1; i < pontas.length; i++) {
    varrido += Math.hypot(pontas[i].x - pontas[i - 1].x, pontas[i].y - pontas[i - 1].y);
  }
  if (varrido < 60) return null;
  const saida = frame <= aim.contact ? 1 : 1 - (frame - aim.contact) / 6;
  const poli = [...pontas, ...meios.reverse()];
  const d = poli.map((p, i) => `${i ? "L" : "M"}${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(" ") + " Z";
  const cor = CORES[elemento];
  return (
    <g data-part="arco-da-katana" opacity={Math.max(0, saida)}>
      <path d={d} fill={cor.rastro} opacity={0.32} />
      <path
        d={pontas.map((p, i) => `${i ? "L" : "M"}${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(" ")}
        fill="none"
        stroke="#ffffff"
        strokeWidth={6}
        strokeLinecap="round"
        opacity={0.8}
      />
    </g>
  );
};
