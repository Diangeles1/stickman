/**
 * CAMPO DE NEVE: o primeiro palco CLARO com cenario de verdade.
 *
 * Os tres palcos claros que existiam eram o `limpo` (branco e nada) e os dois
 * de rabisco (branco com desenho de caderno). Os dois sao estilizados de
 * proposito, e nenhum deles e um LUGAR -- o espectador le "fundo claro", nao
 * "eles estao em algum canto do mundo". Este e claro e e um lugar.
 *
 * E CLARO SEM SER BRANCO, e essa distincao importa para o contraste. Neve de
 * verdade nao e #ffffff: ela e azulada na sombra e quase branca onde a luz
 * bate. Ficar em torno de #d8e4f0 em vez de branco puro devolve uma
 * meia-tinta que o `limpo` nao tem -- e meia-tinta e o que permite desenhar
 * relevo no chao sem sujar a silhueta dos lutadores.
 *
 * QUEM PODE LUTAR AQUI e decidido por medicao, como em todo palco: corpo
 * claro some em fundo claro. Ver scripts/elenco.mts.
 */

import React from "react";

const ruido = (n: number): number => {
  const x = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
};

/** Ceu baixo, montanhas e pinheiros: dentro da camera, antes do piso. */
export const CeuDaNeve: React.FC<{ camX: number; extensao?: number }> = ({
  camX,
  extensao = 3400,
}) => {
  const camada = (p: number) => `translate(${(camX * (1 - p)).toFixed(1)} 0)`;
  return (
    <g data-layer="ceu-neve">
      <defs>
        <linearGradient id="ceu-neve-grad" x1="0" y1="0" x2="0" y2="1">
          {/* ceu de nevasca: cinza-azulado em cima, quase branco no horizonte */}
          <stop offset="0%" stopColor="#9fb4cc" />
          <stop offset="60%" stopColor="#c6d6e6" />
          <stop offset="100%" stopColor="#e8f0f8" />
        </linearGradient>
      </defs>
      <rect x={-extensao * 2} y={-2200} width={extensao * 4} height={2200} fill="url(#ceu-neve-grad)" />

      {/*
        AS MONTANHAS SAO MAIS CLARAS QUANTO MAIS LONGE, e nao mais escuras.
        E o contrario do cenario noturno, e e assim que funciona com neblina:
        o ar entre o olho e a montanha espalha luz e LAVA a cor. Montanha
        distante escura leria como recorte de papel colado no ceu.
      */}
      <g transform={camada(0.24)} fill="#b9c9dc">
        {Array.from({ length: 7 }, (_, i) => {
          const x = -extensao + i * 1050 + ruido(i) * 260;
          const h = 520 + ruido(i * 3) * 460;
          const w = 900 + ruido(i * 5) * 500;
          return <path key={i} d={`M${x} 0 L${x + w * 0.5} ${-h} L${x + w} 0 Z`} />;
        })}
      </g>
      <g transform={camada(0.44)} fill="#a2b6cd">
        {Array.from({ length: 8 }, (_, i) => {
          const x = -extensao + 420 + i * 920 + ruido(i * 7) * 220;
          const h = 300 + ruido(i * 11) * 300;
          const w = 760 + ruido(i * 13) * 320;
          return <path key={i} d={`M${x} 0 L${x + w * 0.46} ${-h} L${x + w} 0 Z`} />;
        })}
      </g>

      {/*
        PINHEIROS: a unica forma ESCURA do palco, e e ela que da escala.
        Sem nada escuro o campo inteiro vira uma mancha clara sem profundidade
        -- e sao eles tambem que impedem o fundo de competir em branco com os
        letreiros da interface.
      */}
      <g transform={camada(0.66)} fill="#3f5468">
        {Array.from({ length: 22 }, (_, i) => {
          const x = -extensao + i * 330 + ruido(i * 17) * 150;
          const h = 180 + ruido(i * 19) * 220;
          const w = h * 0.42;
          return (
            <path
              key={i}
              d={
                `M${x} 0 L${x + w * 0.38} ${-h * 0.34} L${x + w * 0.16} ${-h * 0.32} ` +
                `L${x + w * 0.44} ${-h * 0.66} L${x + w * 0.24} ${-h * 0.64} ` +
                `L${x + w * 0.5} ${-h} L${x + w * 0.76} ${-h * 0.64} ` +
                `L${x + w * 0.56} ${-h * 0.66} L${x + w * 0.84} ${-h * 0.32} ` +
                `L${x + w * 0.62} ${-h * 0.34} L${x + w} 0 Z`
              }
            />
          );
        })}
      </g>
    </g>
  );
};

/** O piso de neve, com relevo em sombra fria. */
export const ChaoDaNeve: React.FC<{ camX: number; extensao?: number }> = ({
  camX,
  extensao = 3400,
}) => {
  void camX;
  return (
    <g data-layer="chao-neve">
      <rect x={-extensao} y={0} width={extensao * 2} height={1400} fill="#d8e4f0" />
      {/* a linha do horizonte e o ponto mais claro: a luz vem de la */}
      <rect x={-extensao} y={0} width={extensao * 2} height={20} fill="#f4f9ff" />
      {/*
        O RELEVO E FEITO DE SOMBRA, nao de linha. Neve nao tem contorno: ela
        tem depressoes azuladas. Traco escuro aqui viraria rabisco, que e
        outro palco.
      */}
      {Array.from({ length: 20 }, (_, i) => {
        const y = 36 + i * i * 2.4;
        if (y > 900) return null;
        const x = -extensao + ruido(i * 23) * 700;
        return (
          <path
            key={i}
            d={`M${x} ${y} q 500 ${14 + ruido(i) * 16} 1040 0 t 1040 0 t 1040 0`}
            stroke="#b9cbe0"
            strokeWidth={10 + i * 1.6}
            fill="none"
            opacity={0.45}
          />
        );
      })}
    </g>
  );
};

/**
 * NEVE CAINDO, na TELA e por cima de tudo.
 *
 * Cai devagar e com deriva lateral, o oposto da chuva da noite, que risca em
 * diagonal rapida. Floco e MANCHA e nao risco -- desenhar neve como linha e o
 * erro que faz nevasca parecer chuva branca.
 */
export const NeveCaindo: React.FC<{
  frame: number;
  largura: number;
  altura: number;
}> = ({ frame, largura, altura }) => (
  <g data-layer="neve">
    {Array.from({ length: 80 }, (_, i) => {
      const vel = 5 + ruido(i) * 7;
      const ciclo = altura + 120;
      const y = ((ruido(i * 7) * ciclo + frame * vel) % ciclo) - 60;
      // a deriva e um seno lento: floco nao desce em linha reta
      const x =
        ruido(i * 3) * (largura + 200) - 100 + Math.sin((frame + i * 37) * 0.012) * (18 + ruido(i * 5) * 26);
      const r = 2 + ruido(i * 11) * 4;
      return <circle key={i} cx={x} cy={y} r={r} fill="#ffffff" opacity={0.35 + ruido(i * 13) * 0.4} />;
    })}
  </g>
);
