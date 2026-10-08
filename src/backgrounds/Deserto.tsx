/**
 * DESERTO AO ENTARDECER: o primeiro palco QUENTE do canal.
 *
 * Os cinco cenarios que existiam eram azul-escuro (vale, noite, metropole,
 * arena) ou branco (o rabisco e o limpo). Girar entre eles muda o desenho do
 * fundo e nao muda a TEMPERATURA da imagem -- dois videos seguidos em palcos
 * diferentes continuavam parecendo o mesmo video. Este entra pelo lado que
 * faltava: ocre, laranja e sombra longa.
 *
 * A LUZ VEM DE BAIXO E DE LADO, que e o que um sol no horizonte faz. Por isso
 * o ceu clareia PARA BAIXO (o contrario do ceu noturno), as dunas tem a
 * crista acesa e a face escura, e o chao e mais claro perto do horizonte.
 *
 * A AREIA E CLARA, E ISSO FOI DECIDIDO MEDINDO.
 *
 * A primeira versao tinha areia #5e3a2a, que e o marrom que se espera de
 * terra na sombra. Medido com scripts/elenco.mts, aquele tom e um MEIO-TOM e
 * meio-tom nao serve a ninguem: cinco dos seis corpos claros reprovavam (o
 * ciano em 2.61, o laranja em 1.94, o magenta em 1.90) e os escuros tambem
 * nao serviriam. Fundo no meio da escala nao tem contra o que contrastar.
 *
 * Clareada, a areia vira palco de corpo ESCURO -- e e esse o ganho real
 * deste cenario: ate agora os palcos claros eram todos brancos ou
 * acinzentados, e este e claro e QUENTE. Carmim e oceano sobre areia dourada
 * e uma imagem que o canal nao tinha.
 *
 * O TOM EXATO FOI CALCULADO e nao escolhido. Com os quatro corpos escuros do
 * elenco, a razao de contraste do PIOR deles contra a areia da:
 *
 *   #d9ac74   2.56   (musgo reprova, carmim 2.78 e oceano 2.94 tambem)
 *   #e2bb88   2.96   (ainda abaixo de 3.0, por pouco)
 *   #ebc99a   3.38   <- escolhido
 *   #f2d6ad   3.79   (ja e creme, perde a leitura de areia)
 *
 * Parar em #ebc99a e ficar com folga de 0.38 sobre o minimo sem lavar a cor.
 */

import React from "react";

const ruido = (n: number): number => {
  const x = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
};

/** Ceu, sol e dunas: dentro da camera, antes do piso. */
export const CeuDoDeserto: React.FC<{ camX: number; extensao?: number }> = ({
  camX,
  extensao = 3400,
}) => {
  const camada = (p: number) => `translate(${(camX * (1 - p)).toFixed(1)} 0)`;
  return (
    <g data-layer="ceu-deserto">
      <defs>
        <linearGradient id="ceu-deserto-grad" x1="0" y1="0" x2="0" y2="1">
          {/* o ceu ESCURECE para cima: o sol esta no horizonte, nao no zenite */}
          <stop offset="0%" stopColor="#3b2a52" />
          <stop offset="45%" stopColor="#8a4a52" />
          <stop offset="75%" stopColor="#d2743f" />
          <stop offset="100%" stopColor="#f0a85c" />
        </linearGradient>
        <radialGradient id="sol-deserto" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#ffe6a8" stopOpacity={0.95} />
          <stop offset="60%" stopColor="#ffb75e" stopOpacity={0.35} />
          <stop offset="100%" stopColor="#ff9a3c" stopOpacity={0} />
        </radialGradient>
      </defs>
      <rect x={-extensao * 2} y={-2200} width={extensao * 4} height={2200} fill="url(#ceu-deserto-grad)" />

      {/*
        O SOL ANDA POUQUISSIMO COM A CAMERA (parallax 0.02) porque esta no
        infinito. Qualquer valor maior faz o horizonte deslizar junto com o
        combate, e o olho le o cenario inteiro como um painel pintado passando
        atras dos bonecos.
      */}
      <g transform={camada(0.02)}>
        <circle cx={-500} cy={-120} r={640} fill="url(#sol-deserto)" />
        <circle cx={-500} cy={-120} r={190} fill="#ffe9bb" opacity={0.92} />
      </g>

      {/* mesas e agulhas de rocha ao longe, chapadas contra o ceu */}
      <g transform={camada(0.3)} fill="#6b3f4a" opacity={0.75}>
        {Array.from({ length: 10 }, (_, i) => {
          const x = -extensao + i * 700 + ruido(i) * 220;
          const h = 220 + ruido(i * 3) * 420;
          const w = 240 + ruido(i * 5) * 300;
          // topo chato: e o que diferencia mesa de montanha
          return <path key={i} d={`M${x} 0 L${x + w * 0.12} ${-h} L${x + w * 0.88} ${-h + 18} L${x + w} 0 Z`} />;
        })}
      </g>

      {/* dunas em duas camadas: a de tras mais clara, a da frente mais densa */}
      <g transform={camada(0.52)} fill="#b4713f">
        {Array.from({ length: 9 }, (_, i) => {
          const x = -extensao + i * 820 + ruido(i * 7) * 200;
          const h = 90 + ruido(i * 11) * 110;
          return (
            <path
              key={i}
              d={`M${x} 0 Q ${x + 240} ${-h} ${x + 520} ${-h * 0.5} T ${x + 980} 0 Z`}
            />
          );
        })}
      </g>
      <g transform={camada(0.72)} fill="#96603a">
        {Array.from({ length: 8 }, (_, i) => {
          const x = -extensao + 300 + i * 900 + ruido(i * 13) * 240;
          const h = 70 + ruido(i * 17) * 90;
          return <path key={i} d={`M${x} 0 Q ${x + 280} ${-h} ${x + 600} ${-h * 0.4} T ${x + 1060} 0 Z`} />;
        })}
      </g>
    </g>
  );
};

/** O piso de areia, com as marcas de vento. */
export const ChaoDoDeserto: React.FC<{ camX: number; extensao?: number }> = ({
  camX,
  extensao = 3400,
}) => {
  void camX;
  return (
    <g data-layer="chao-deserto">
      <rect x={-extensao} y={0} width={extensao * 2} height={1400} fill="#ebc99a" />
      {/* a faixa rente ao horizonte e mais clara: e onde o sol ainda bate */}
      <rect x={-extensao} y={0} width={extensao * 2} height={26} fill="#fbeacb" />
      {/*
        ONDULACOES DO VENTO, e nao textura aleatoria: linhas longas e quase
        horizontais, mais juntas perto do horizonte. E o que faz o chao ler
        como AREIA em vez de piso liso pintado de marrom.
      */}
      {Array.from({ length: 26 }, (_, i) => {
        const y = 30 + i * i * 1.9;
        if (y > 900) return null;
        const x = -extensao + ruido(i * 19) * 600;
        return (
          <path
            key={i}
            d={`M${x} ${y} q 420 ${-10 - ruido(i) * 12} 900 0 t 900 0 t 900 0`}
            stroke="#cfa470"
            strokeWidth={3 + i * 0.4}
            fill="none"
            opacity={0.5}
          />
        );
      })}
    </g>
  );
};

/**
 * AREIA LEVANTADA PELO VENTO, desenhada na TELA e nao no mundo.
 *
 * Fica por cima de tudo e bem fraca, como a chuva da noite: atmosfera nao
 * pode disputar leitura com os corpos. Ela anda sempre para o mesmo lado
 * porque vento tem direcao -- poeira que vai e volta le como fumaca.
 */
export const AreiaAoVento: React.FC<{
  frame: number;
  largura: number;
  altura: number;
}> = ({ frame, largura, altura }) => (
  <g data-layer="areia">
    {Array.from({ length: 46 }, (_, i) => {
      const vel = 9 + ruido(i) * 16;
      const ciclo = largura + 400;
      const x = ((ruido(i * 3) * ciclo + frame * vel) % ciclo) - 200;
      const y = altura * (0.45 + ruido(i * 7) * 0.5);
      const c = 40 + ruido(i * 11) * 90;
      return (
        <path
          key={i}
          d={`M${x} ${y} q ${c * 0.5} ${-6} ${c} 0`}
          stroke="#e8c79a"
          strokeWidth={1 + ruido(i * 13) * 2}
          fill="none"
          opacity={0.1 + ruido(i * 17) * 0.14}
        />
      );
    })}
  </g>
);
