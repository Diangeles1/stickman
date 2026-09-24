/**
 * Arena: fundo escuro, chao de concreto rachado e profundidade.
 *
 * O cenario e gerado a partir da SEMENTE, nunca de Math.random(): a mesma luta
 * tem sempre o mesmo chao, em qualquer quadro e em qualquer processo de render.
 *
 * A rachadura e desenhada como galho que se ramifica. Rachadura reta parece
 * risco de caneta; ramificada parece concreto. Aprendido no prototipo.
 */

import React from "react";
import { entre, hashRng } from "../core/rng";
import type { Vec2 } from "../core/types";

const CHAO_Y = 0;

/** Gera uma rachadura ramificada a partir de um ponto no chao. */
const galho = (
  origem: Vec2,
  semente: number,
  chave: string,
  profundidade = 3,
): string[] => {
  const caminhos: string[] = [];
  const pilha: { p: Vec2; ang: number; prof: number; comp: number; id: string }[] = [
    {
      p: origem,
      ang: Math.PI / 2 + entre(`${chave}-a`, semente, -0.5, 0.5),
      prof: profundidade,
      comp: entre(`${chave}-c`, semente, 90, 260),
      id: chave,
    },
  ];

  while (pilha.length > 0) {
    const atual = pilha.pop();
    if (!atual) break;
    const passos = Math.max(2, Math.round(atual.comp / 34));
    let ponto = { ...atual.p };
    let ang = atual.ang;
    let d = `M ${ponto.x.toFixed(1)} ${ponto.y.toFixed(1)}`;

    for (let i = 0; i < passos; i++) {
      ang += entre(`${atual.id}-${i}-ang`, semente, -0.45, 0.45);
      ponto = {
        x: ponto.x + Math.cos(ang) * 34,
        // a rachadura nao sobe do chao: ela corre pelo piso
        y: Math.max(atual.p.y - 6, ponto.y + Math.sin(ang) * 34),
      };
      d += ` L ${ponto.x.toFixed(1)} ${ponto.y.toFixed(1)}`;
    }
    caminhos.push(d);

    if (atual.prof > 0) {
      const ramos = 1 + Math.round(hashRng(`${atual.id}-r`, semente));
      for (let r = 0; r < ramos; r++) {
        pilha.push({
          p: ponto,
          ang: ang + entre(`${atual.id}-${r}-b`, semente, -1.1, 1.1),
          prof: atual.prof - 1,
          comp: atual.comp * 0.55,
          id: `${atual.id}-${r}`,
        });
      }
    }
  }
  return caminhos;
};

export type ArenaProps = {
  seed: number;
  /** rachaduras extras abertas por impacto, em x de mundo */
  rachaduras?: number[];
  /** meia-largura do mundo desenhado */
  extensao?: number;
};

export const Arena: React.FC<ArenaProps> = ({
  seed,
  rachaduras = [],
  extensao = 3000,
}) => {
  const rachadurasBase = React.useMemo(() => {
    const saida: string[] = [];
    for (let i = 0; i < 10; i++) {
      const x = entre(`crack-${i}`, seed, -extensao, extensao);
      saida.push(...galho({ x, y: CHAO_Y }, seed, `crack-${i}`));
    }
    return saida;
  }, [seed, extensao]);

  const rachadurasImpacto = React.useMemo(
    () =>
      rachaduras.flatMap((x, i) =>
        galho({ x, y: CHAO_Y }, seed, `hit-crack-${i}-${Math.round(x)}`),
      ),
    [rachaduras, seed],
  );

  const manchas = React.useMemo(
    () =>
      Array.from({ length: 30 }, (_, i) => ({
        x: entre(`stain-${i}-x`, seed, -extensao, extensao),
        y: entre(`stain-${i}-y`, seed, 10, 260),
        r: entre(`stain-${i}-r`, seed, 60, 240),
      })),
    [seed, extensao],
  );

  return (
    <g data-layer="arena">
      {/* piso */}
      <rect
        x={-extensao}
        y={CHAO_Y}
        width={extensao * 2}
        height={2400}
        fill="#101319"
      />
      {/* faixa de luz no horizonte, que separa o piso do fundo */}
      <rect x={-extensao} y={CHAO_Y - 4} width={extensao * 2} height={8} fill="#333a4e" />

      {manchas.map((m, i) => (
        <ellipse
          key={i}
          cx={m.x}
          cy={m.y}
          rx={m.r}
          ry={m.r * 0.22}
          fill="#0a0b10"
          opacity={0.55}
        />
      ))}

      {rachadurasBase.map((d, i) => (
        <path key={`b${i}`} d={d} stroke="#0c0d11" strokeWidth={5} fill="none" opacity={0.8} />
      ))}
      {rachadurasImpacto.map((d, i) => (
        <path key={`i${i}`} d={d} stroke="#08090c" strokeWidth={9} fill="none" />
      ))}
    </g>
  );
};
