/**
 * METROPOLE A NOITE: cruzamento urbano, telao, letreiro vertical e asfalto
 * molhado.
 *
 * Existe porque ruina nao da o que usar numa luta. Cidade da: predio para
 * atravessar, fachada para quebrar, poste para derrubar, e sobretudo ESCALA --
 * com predio atras, um arremesso de mil unidades le como mil unidades. Contra
 * silhueta de coluna, o mesmo arremesso parecia um empurrao.
 *
 * O desenho e todo procedural a partir de ruido determinista: o mesmo indice
 * sempre da o mesmo predio, entao nada treme entre quadros e nao ha arquivo de
 * dados para manter.
 *
 * DISCIPLINA DE CONTRASTE: cidade de noite quer ser cheia de luz, e luz demais
 * no fundo come os lutadores. Aqui as massas sao escuras e dessaturadas e a luz
 * fica concentrada em poucos pontos pequenos (janela, telao, letreiro). Medido
 * com scripts/contraste.mts: o fundo fica na faixa de 1.0 a 1.6 contra o ceu, e
 * os corpos continuam acima de 4.0.
 */

import React from "react";

const ruido = (n: number): number => {
  const x = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
};

/** cores das luzes: poucas e saturadas, para o neon ler como neon */
const NEON = ["#ff3d6e", "#2ee6ff", "#ffd23d", "#b06bff", "#3dff9e"];

/**
 * Ceu, predios e letreiros. Tudo dentro da camera, antes do piso.
 *
 * `camX` e a posicao da camera; cada camada anda uma fracao dela. Camada de
 * profundidade `p`: 0 nao anda (infinito), 1 anda junto com o chao.
 */
export const CeuDeMetropole: React.FC<{ camX: number; extensao?: number }> = ({
  camX,
  extensao = 4200,
}) => {
  const camada = (p: number) => `translate(${(camX * (1 - p)).toFixed(1)} 0)`;
  return (
    <g data-layer="metropole">
      {/*
        BRILHO NO HORIZONTE. Cidade grande nao tem ceu preto: a luz que sobe
        das ruas acende a base do ceu. E esse degrade que faz a silhueta dos
        predios existir -- sem ele, predio escuro sobre ceu escuro some.
      */}
      <defs>
        <linearGradient id="mp-ceu" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#0a0d18" />
          <stop offset="62%" stopColor="#141a30" />
          <stop offset="88%" stopColor="#2a2340" />
          <stop offset="100%" stopColor="#3d2a42" />
        </linearGradient>
      </defs>
      <rect x={-extensao * 2} y={-2600} width={extensao * 4} height={2700} fill="url(#mp-ceu)" />

      {/* TORRES AO LONGE: quase paradas, so massa e janela */}
      <g transform={camada(0.12)}>
        {Array.from({ length: 26 }, (_, i) => {
          const x = -extensao + i * 340 + ruido(i) * 120;
          const h = 700 + ruido(i * 3) * 1500;
          const w = 150 + ruido(i * 5) * 130;
          return (
            <g key={i}>
              <rect x={x} y={-h} width={w} height={h} fill="#10142a" />
              {/* janelas: grade esparsa, so uma fracao acesa */}
              {Array.from({ length: Math.floor(h / 95) }, (_, l) =>
                Array.from({ length: Math.max(1, Math.floor(w / 46)) }, (_, cIdx) => {
                  const r = ruido(i * 31 + l * 7 + cIdx * 3);
                  if (r < 0.62) return null;
                  return (
                    <rect
                      key={`${l}-${cIdx}`}
                      x={x + 12 + cIdx * 46}
                      y={-h + 26 + l * 95}
                      width={20}
                      height={30}
                      fill={r > 0.93 ? "#ffe9a8" : "#7f93d6"}
                      opacity={0.5 + r * 0.4}
                    />
                  );
                }),
              )}
            </g>
          );
        })}
      </g>

      {/* PREDIOS DO MEIO: ja com telao e letreiro vertical */}
      <g transform={camada(0.42)}>
        {Array.from({ length: 16 }, (_, i) => {
          const x = -extensao + i * 520 + ruido(i * 11) * 160;
          const h = 620 + ruido(i * 13) * 900;
          const w = 250 + ruido(i * 17) * 150;
          const cor = NEON[Math.floor(ruido(i * 19) * NEON.length)];
          const temTelao = ruido(i * 23) > 0.45;
          return (
            <g key={i}>
              <rect x={x} y={-h} width={w} height={h} fill="#0c1020" />
              <rect x={x} y={-h} width={w} height={5} fill="#1d2440" />
              {temTelao && (
                /*
                  TELAO. Um retangulo aceso com faixas horizontais: sugere
                  painel de LED sem desenhar conteudo nenhum, que e o que
                  mantem a atencao nos lutadores.
                */
                <g>
                  <rect x={x + w * 0.14} y={-h + 90} width={w * 0.72} height={h * 0.3} fill={cor} opacity={0.16} />
                  <rect x={x + w * 0.16} y={-h + 96} width={w * 0.68} height={h * 0.28} fill="#060912" />
                  {Array.from({ length: 5 }, (_, k) => (
                    <rect
                      key={k}
                      x={x + w * 0.19}
                      y={-h + 108 + k * (h * 0.28) / 6}
                      width={w * 0.62 * (0.35 + ruido(i * 29 + k) * 0.65)}
                      height={(h * 0.28) / 11}
                      fill={cor}
                      opacity={0.55 + ruido(i * 37 + k) * 0.35}
                    />
                  ))}
                </g>
              )}
              {/*
                LETREIRO VERTICAL. Coluna estreita de blocos acesos descendo
                pela fachada -- e a forma que mais diz "rua comercial densa",
                e sao blocos abstratos, nunca texto.
              */}
              {ruido(i * 41) > 0.35 && (
                <g>
                  {Array.from({ length: 4 + Math.floor(ruido(i * 43) * 4) }, (_, k) => {
                    const corK = NEON[Math.floor(ruido(i * 47 + k) * NEON.length)];
                    return (
                      <rect
                        key={k}
                        x={x + (ruido(i * 53) > 0.5 ? w - 46 : 12)}
                        y={-h + 150 + k * 78}
                        width={34}
                        height={58}
                        fill={corK}
                        opacity={0.75}
                      />
                    );
                  })}
                </g>
              )}
            </g>
          );
        })}
      </g>

      {/*
        FACHADAS DE RUA: a camada que passa rapido. Sao baixas de proposito --
        alto aqui cobriria os lutadores. Servem para dar velocidade ao
        deslocamento: e nelas que o olho mede o quanto alguem foi arremessado.
      */}
      <g transform={camada(0.82)}>
        {Array.from({ length: 22 }, (_, i) => {
          const x = -extensao + i * 420 + ruido(i * 59) * 90;
          const h = 210 + ruido(i * 61) * 190;
          const w = 300 + ruido(i * 67) * 120;
          const cor = NEON[Math.floor(ruido(i * 71) * NEON.length)];
          return (
            <g key={i}>
              <rect x={x} y={-h} width={w} height={h} fill="#080b16" />
              <rect x={x} y={-h} width={w} height={4} fill={cor} opacity={0.5} />
              {/* vitrine acesa na base */}
              <rect x={x + 22} y={-64} width={w - 44} height={52} fill={cor} opacity={0.13} />
              <rect x={x + 30} y={-58} width={w - 60} height={40} fill="#0e1424" />
              {/* toldo/letreiro horizontal */}
              <rect x={x + 16} y={-h + 34} width={w - 32} height={26} fill={cor} opacity={0.62} />
            </g>
          );
        })}
      </g>
    </g>
  );
};

/**
 * ASFALTO MOLHADO com faixa de pedestres.
 *
 * O reflexo nao e enfeite: e o que integra os letreiros coloridos a rua. Sem
 * ele o neon fica flutuando no fundo e o chao parece de outro cenario.
 */
export const RuaMolhada: React.FC<{ camX: number; extensao?: number }> = ({
  camX,
  extensao = 4200,
}) => (
  <g data-layer="rua-molhada">
    <rect x={-extensao * 1.5} y={0} width={extensao * 3} height={900} fill="#090c15" />
    {/* faixa de pedestres: barras claras, em perspectiva achatada */}
    {Array.from({ length: 30 }, (_, i) => {
      const x = -extensao + i * 300 + (camX % 300) * 0;
      return (
        <rect key={i} x={x} y={18} width={130} height={26} fill="#c9d2e8" opacity={0.17} rx={3} />
      );
    })}
    {/* pocas: elipses escuras com brilho de neon dentro */}
    {Array.from({ length: 26 }, (_, i) => {
      const x = -extensao + i * 340 + ruido(i * 73) * 160;
      const w = 150 + ruido(i * 79) * 200;
      const cor = NEON[Math.floor(ruido(i * 83) * NEON.length)];
      return (
        <g key={i}>
          <ellipse cx={x} cy={30 + ruido(i * 89) * 40} rx={w} ry={16 + ruido(i * 97) * 12} fill="#05070e" opacity={0.75} />
          <ellipse cx={x} cy={30 + ruido(i * 89) * 40} rx={w * 0.5} ry={6} fill={cor} opacity={0.22} />
        </g>
      );
    })}
  </g>
);
