/**
 * ARENA DESTRUIDA A NOITE, COM CHUVA.
 *
 * Ceu azul-escuro com lua, colunas quebradas em silhueta (parallax) e
 * chuva fina em diagonal. A chuva e desenhada na TELA (fora da camera), por
 * cima de tudo, bem fraca: ela e atmosfera, nao pode esconder os corpos.
 *
 * Com o ZERO ABSOLUTE a chuva CONGELA no ar: as gotas param onde estavam e
 * viram cristais. E a leitura mais direta de "a temperatura caiu".
 */

import React from "react";

const ruido = (n: number): number => {
  const x = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
};

/** Ceu, lua e ruinas: dentro da camera, antes do piso */
export const CeuNoturno: React.FC<{ camX: number; extensao?: number }> = ({ camX, extensao = 3400 }) => {
  const camada = (p: number) => `translate(${(camX * (1 - p)).toFixed(1)} 0)`;
  return (
    <g data-layer="ceu-noturno">
      <g transform={camada(0.08)}>
        <circle cx={260} cy={-1150} r={120} fill="#dfe8ff" opacity={0.9} />
        <circle cx={260} cy={-1150} r={190} fill="#9fb4ff" opacity={0.12} />
      </g>
      {/* ruinas ao longe: colunas quebradas e arcos em silhueta */}
      <g transform={camada(0.35)} fill="#141a2c">
        {Array.from({ length: 16 }, (_, i) => {
          const x = -extensao + i * 440 + ruido(i) * 120;
          const h = 260 + ruido(i * 3) * 380;
          const w = 70 + ruido(i * 5) * 40;
          const quebra = ruido(i * 7) * 40;
          return (
            <path
              key={i}
              d={`M${x} 0 L${x} ${-h} L${x + w * 0.4} ${-h - quebra} L${x + w} ${-h + 20} L${x + w} 0 Z`}
            />
          );
        })}
      </g>
      <g transform={camada(0.6)} fill="#0e1322">
        {Array.from({ length: 12 }, (_, i) => {
          const x = -extensao + 200 + i * 600 + ruido(i * 11) * 200;
          const h = 120 + ruido(i * 13) * 160;
          return <path key={i} d={`M${x} 0 L${x + 20} ${-h} L${x + 90} ${-h + 30} L${x + 150} ${-h * 0.4} L${x + 170} 0 Z`} />;
        })}
      </g>
    </g>
  );
};

/** Chuva na tela. `congelada` (0 a 1) para as gotas e as vira cristais. */
export const Chuva: React.FC<{
  frame: number;
  largura: number;
  altura: number;
  congelada: number;
  /** quadro em que a chuva congelou (as gotas param ali) */
  quadroDoCongelamento: number;
}> = ({ frame, largura, altura, congelada, quadroDoCongelamento }) => {
  const N = 70;
  // o tempo da chuva para quando ela congela
  const t = congelada > 0.5 ? quadroDoCongelamento : frame;
  return (
    <g data-layer="chuva">
      {Array.from({ length: N }, (_, i) => {
        const vel = 38 + ruido(i) * 20;
        const x0 = ruido(i * 3) * (largura + 400) - 200;
        const ciclo = altura + 200;
        const y = ((ruido(i * 7) * ciclo + t * vel) % ciclo) - 100;
        const x = x0 - (y / altura) * 160;
        if (congelada > 0.5) {
          const r = 4 + 3 * ruido(i * 5);
          return (
            <path
              key={i}
              d={`M${x} ${y - r} L${x + r * 0.6} ${y} L${x} ${y + r} L${x - r * 0.6} ${y} Z`}
              fill="#dff6ff"
              opacity={0.85}
            />
          );
        }
        return <line key={i} x1={x} y1={y} x2={x - 10} y2={y + 46} stroke="#a9bddf" strokeWidth={2} opacity={0.35} />;
      })}
    </g>
  );
};
