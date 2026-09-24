/**
 * A PLACA GIGANTE que o vencedor puxa das costas (ver animation/placa.ts).
 *
 * Desenhada no MUNDO, presa a mao da frente: o cabo sai da mao e a placa
 * fica em cima dele. Enquanto sai de tras do corpo ela cresce de quase nada
 * ate o tamanho real (a graca de desenho animado: a placa nao cabia ali).
 * Fica atras do corpo, entao nasce escondida atras da cabeca.
 */

import React from "react";
import { juntasDoCorpo, type Corpo } from "../animation/corpo";
import { placaNoQuadro } from "../animation/placa";
import type { Timeline } from "../core/types";

const LARGURA = 960;
const ALTURA = 600;
/** da mao ate a base da placa, em unidades de mundo */
const CABO = 250;
const FONTE = `Bangers, "Arial Black", "DejaVu Sans", sans-serif`;

/** coracao simples, centrado na origem, ~100 de largura */
const CORACAO =
  "M0,30 C-10,20 -50,0 -50,-25 C-50,-45 -35,-55 -22,-55 C-10,-55 -3,-47 0,-40 C3,-47 10,-55 22,-55 C35,-55 50,-45 50,-25 C50,0 10,20 0,30 Z";

export const Placa: React.FC<{
  timeline: Timeline;
  frame: number;
  lutadores: { id: string; corpo: Corpo }[];
}> = ({ timeline, frame, lutadores }) => {
  const beat = timeline.scheduled.find(
    (b) => b.beat.type === "placa" && frame >= b.from,
  );
  if (!beat || beat.beat.type !== "placa") return null;
  const { who, linhas } = beat.beat;
  const estado = placaNoQuadro(frame - beat.from);
  if (!estado) return null;
  const corpo = lutadores.find((l) => l.id === who)?.corpo;
  if (!corpo) return null;

  const j = juntasDoCorpo(corpo);
  const mao = j.handFront;
  // de onde a placa sai: atras da cabeca
  const esconderijo = { x: j.neck.x, y: j.neck.y - 30 };
  const alvo = { x: mao.x, y: mao.y - CABO - ALTURA / 2 };
  const centro = {
    x: esconderijo.x + (alvo.x - esconderijo.x) * estado.saida,
    y: esconderijo.y + (alvo.y - esconderijo.y) * estado.saida,
  };
  const e = estado.escala;
  // balanca de leve no ritmo, como placa de verdade segurada no alto
  const balanco = estado.saida >= 1 ? Math.sin(frame * 0.12) * 2.5 : (1 - estado.saida) * -25;

  const tamanhos = [185, 142, 142];
  return (
    <g data-layer="placa">
      {/* cabo: da mao ate a placa, passando um pouco abaixo da mao */}
      <line
        x1={mao.x}
        y1={mao.y + 60}
        x2={centro.x}
        y2={centro.y + (ALTURA / 2) * e}
        stroke="#6d4020"
        strokeWidth={26}
        strokeLinecap="round"
      />
      <g transform={`translate(${centro.x} ${centro.y}) rotate(${balanco}) scale(${e})`}>
        {/* sombra, madeira, borda */}
        <rect
          x={-LARGURA / 2 + 14}
          y={-ALTURA / 2 + 16}
          width={LARGURA}
          height={ALTURA}
          rx={30}
          fill="#000"
          opacity={0.18}
        />
        <rect
          x={-LARGURA / 2}
          y={-ALTURA / 2}
          width={LARGURA}
          height={ALTURA}
          rx={30}
          fill="#ffd66b"
          stroke="#1a1a1a"
          strokeWidth={16}
        />
        <rect
          x={-LARGURA / 2 + 26}
          y={-ALTURA / 2 + 26}
          width={LARGURA - 52}
          height={ALTURA - 52}
          rx={18}
          fill="none"
          stroke="#e0a52e"
          strokeWidth={8}
        />
        {linhas.map((texto, i) => (
          <text
            key={i}
            x={0}
            y={-ALTURA / 2 + 200 + i * 152}
            textAnchor="middle"
            fontFamily={FONTE}
            fontSize={tamanhos[i] ?? 110}
            fill={i === 0 ? "#e8232a" : "#141414"}
            stroke="#ffffff"
            strokeWidth={i === 0 ? 10 : 6}
            strokeLinejoin="round"
            paintOrder="stroke"
            letterSpacing={3}
          >
            {texto}
          </text>
        ))}
        {/* coracao batendo ao lado do "DA LIKE" */}
        <g
          transform={`translate(${-LARGURA / 2 + 110} ${-ALTURA / 2 + 120}) scale(${0.9 + 0.12 * Math.abs(Math.sin(frame * 0.14))})`}
        >
          <path d={CORACAO} fill="#e8232a" stroke="#1a1a1a" strokeWidth={8} />
        </g>
        <g
          transform={`translate(${LARGURA / 2 - 110} ${-ALTURA / 2 + 120}) scale(${0.9 + 0.12 * Math.abs(Math.sin(frame * 0.14 + 1.5))})`}
        >
          <path d={CORACAO} fill="#e8232a" stroke="#1a1a1a" strokeWidth={8} />
        </g>
      </g>
    </g>
  );
};
