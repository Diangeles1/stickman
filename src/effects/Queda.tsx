/**
 * Efeitos de MUNDO que o espetaculo dispara: a poeira do corpo que bate no
 * chao e as linhas de foco do quadro de impacto.
 *
 * Ficam dentro da camera (sao coisas no mundo, nao na tela) e usam o quadro
 * LOGICO: na camera lenta a poeira sobe devagar junto com o corpo.
 */

import React from "react";
import type { Vec2 } from "../core/types";
import type { Queda } from "./espetaculo";

/** ruido deterministico: o mesmo quadro sempre desenha a mesma poeira */
const ruido = (n: number): number => {
  const x = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
};

const DURACAO_DA_POEIRA = 42;
const GRAOS = 16;

/**
 * POEIRA DA QUEDA: o corpo bateu no chao e o chao responde. Uma nuvem que
 * abre para os dois lados rente ao chao e um anel de choque achatado.
 * Sem isto a queda nao tem peso: o corpo so "encosta" no chao.
 */
export const PoeiraDaQueda: React.FC<{
  quedas: Queda[];
  frame: number;
  cor: string;
}> = ({ quedas, frame, cor }) => (
  <g data-layer="poeira-da-queda">
    {quedas.map((q, n) => {
      const idade = frame - q.logico;
      if (idade < 0 || idade > DURACAO_DA_POEIRA) return null;
      const k = idade / DURACAO_DA_POEIRA;
      // desacelera: sai rapido e para, como poeira de verdade
      const abertura = 1 - (1 - k) * (1 - k) * (1 - k);
      const anel = 40 + 300 * abertura;
      return (
        <g key={n}>
          <ellipse
            cx={q.x}
            cy={-4}
            rx={anel}
            ry={anel * 0.1}
            fill="none"
            stroke={cor}
            strokeWidth={10 * (1 - k)}
            opacity={0.6 * (1 - k)}
          />
          {Array.from({ length: GRAOS }, (_, j) => {
            const lado = j % 2 === 0 ? 1 : -1;
            const alcance = 90 + 230 * ruido(n * 31 + j);
            const sobe = 20 + 90 * ruido(n * 17 + j * 3);
            const raio = (16 + 26 * ruido(j * 7 + n)) * (0.6 + 0.9 * abertura);
            return (
              <circle
                key={j}
                cx={q.x + lado * alcance * abertura}
                cy={-raio * 0.5 - sobe * abertura * (1 - 0.4 * k)}
                r={raio}
                fill={cor}
                opacity={0.55 * (1 - k)}
              />
            );
          })}
        </g>
      );
    })}
  </g>
);

const LINHAS = 30;

/**
 * LINHAS DE FOCO do quadro de impacto (estilo anime): triangulos finos que
 * convergem no ponto do golpe. So existem nos um ou dois quadros de impacto,
 * e e o contraste com o quadro normal que faz o golpe "estourar".
 */
export const EstrelaDeImpacto: React.FC<{ at: Vec2; cor: string; semente: number }> = ({
  at,
  cor,
  semente,
}) => (
  <g data-layer="estrela-de-impacto">
    {Array.from({ length: LINHAS }, (_, i) => {
      const a = (i / LINHAS) * Math.PI * 2 + ruido(semente + i) * 0.15;
      const perto = 70 + 160 * ruido(semente * 3 + i);
      const longe = 2600;
      const meia = 0.012 + 0.03 * ruido(semente * 5 + i);
      const p = (r: number, da: number) =>
        `${(at.x + Math.cos(a + da) * r).toFixed(1)},${(at.y + Math.sin(a + da) * r).toFixed(1)}`;
      return (
        <polygon
          key={i}
          points={`${p(perto, 0)} ${p(longe, meia)} ${p(longe, -meia)}`}
          fill={cor}
        />
      );
    })}
    <circle cx={at.x} cy={at.y} r={46} fill={cor} />
  </g>
);
