/**
 * ARTE DO CANAL: banner, avatar e capa de video.
 *
 * Feita com as mesmas pecas da luta (os lutadores de verdade, a katana, a
 * marca), e nao com um desenho a parte. Assim a arte do canal e a miniatura
 * mostram exatamente o que o video entrega, que e o que faz alguem clicar e
 * NAO sair no primeiro segundo.
 *
 * Tres formatos, cada um com a sua regra:
 *
 *   banner   2048x1152, mas so o retangulo central de 1235x338 aparece em
 *            TODOS os aparelhos (a TV mostra tudo, o celular so o centro).
 *            Entao nada que importa pode sair dessa area segura.
 *   avatar   800x800, cortado em circulo pelo YouTube: o desenho precisa
 *            caber num circulo, nao num quadrado
 *   capa     1280x720 (16:9), a miniatura do video
 */

import React from "react";
import { AbsoluteFill, Img, staticFile } from "remotion";
import { POSES } from "../characters/poses";
import { PRESETS } from "../characters/presets";
import { ALTURA_QUADRIL } from "../characters/skeleton";
import { Stickman } from "../characters/Stickman";
import { Katana } from "../characters/Katana";
import type { Corpo } from "../animation/corpo";
import type { FighterId, PoseName } from "../core/types";

const PILHA = `Bangers, "Arial Black", "DejaVu Sans", sans-serif`;
const contorno = (px: number) => ({
  stroke: "#08080c",
  strokeWidth: px,
  strokeLinejoin: "round" as const,
  paintOrder: "stroke" as const,
});

/** um lutador posado, com a katana, para usar na arte */
const Lutador: React.FC<{
  id: FighterId;
  pose: PoseName;
  x: number;
  chao: number;
  escala: number;
  facing: 1 | -1;
  elemento: "gelo" | "fogo";
}> = ({ id, pose, x, chao, escala, facing, elemento }) => {
  const preset = PRESETS[id];
  const corpo: Corpo = {
    x,
    baseY: chao - ALTURA_QUADRIL * preset.scale * escala,
    facing,
    scale: preset.scale * escala,
    spin: 0,
    giro: 1,
    pose: POSES[pose],
    poseNome: pose,
    noAr: false,
    velocidade: 0,
    aceleracao: 0,
    agachamento: 0,
    correcaoDaMira: 0,
    alcancou: true,
  };
  return (
    <>
      <Stickman
        preset={preset}
        pose={POSES[pose]}
        baseX={x}
        baseY={corpo.baseY}
        facing={facing}
        scaleExtra={escala}
        contorno
      />
      <Katana corpo={corpo} elemento={elemento} frame={12} />
    </>
  );
};

/** fundo escuro com raios saindo do centro, a cara de capa de luta */
const FundoDeRaios: React.FC<{ largura: number; altura: number; cx: number; cy: number }> = ({
  largura,
  altura,
  cx,
  cy,
}) => (
  <>
    <defs>
      <radialGradient id="fundoCanal" cx="50%" cy="50%" r="72%">
        <stop offset="0%" stopColor="#2b3350" />
        <stop offset="100%" stopColor="#06070d" />
      </radialGradient>
    </defs>
    <rect width={largura} height={altura} fill="url(#fundoCanal)" />
    <g opacity={0.14}>
      {Array.from({ length: 22 }, (_, i) => {
        const a = (i / 22) * Math.PI * 2;
        const d = 0.055;
        const p = (r: number, da: number) =>
          `${cx + Math.cos(a + da) * r},${cy + Math.sin(a + da) * r}`;
        return <polygon key={i} points={`${cx},${cy} ${p(3000, d)} ${p(3000, -d)}`} fill="#ffffff" />;
      })}
    </g>
  </>
);

export const BannerDoCanal: React.FC = () => {
  const L = 2048;
  const A = 1152;
  /**
   * A FAIXA SEGURA. O YouTube mostra o banner inteiro na TV, mas no CELULAR
   * so aparece este retangulo de 1235x338 no centro. Entao tudo que precisa
   * ser visto (marca, frase, os dois lutadores INTEIROS) cabe aqui dentro, e
   * o resto da imagem e so fundo.
   */
  const faixaA = 338;
  const topo = A / 2 - faixaA / 2;
  const base = A / 2 + faixaA / 2;
  // o lutador tem ~597 unidades de altura na escala 1: a 0.40 ele fica com
  // 240, que cabe na faixa com folga para a cabeca nao encostar na borda
  const escala = 0.4;
  const chao = base - 16;
  return (
    <AbsoluteFill>
      <svg width={L} height={A} viewBox={`0 0 ${L} ${A}`}>
        <FundoDeRaios largura={L} altura={A} cx={L / 2} cy={A / 2} />
        <Lutador id="black" pose="guardaKatana" x={L / 2 - 470} chao={chao} escala={escala} facing={1} elemento="gelo" />
        <Lutador id="red" pose="guardaKatana" x={L / 2 + 470} chao={chao} escala={escala} facing={-1} elemento="fogo" />
        <text
          x={L / 2}
          y={base - 26}
          textAnchor="middle"
          fontFamily={PILHA}
          fontSize={52}
          fill="#ffd23f"
          {...contorno(11)}
          letterSpacing={4}
        >
          LUTAS DE STICKMAN TODA SEMANA
        </text>
      </svg>
      {/* a marca fica no ALTO da faixa segura, sozinha: em cima da frase ela
          cobria as duas coisas e nenhuma se lia */}
      <Img
        src={staticFile("assets/marca/palitanos.png")}
        style={{
          position: "absolute",
          left: L / 2 - 240,
          top: topo + 14,
          width: 480,
          height: 480 * (333 / 900),
          filter: "drop-shadow(0 8px 16px rgba(0,0,0,0.8))",
        }}
      />
    </AbsoluteFill>
  );
};

export const AvatarDoCanal: React.FC = () => {
  const S = 800;
  return (
    <AbsoluteFill>
      <svg width={S} height={S} viewBox={`0 0 ${S} ${S}`}>
        <FundoDeRaios largura={S} altura={S} cx={S / 2} cy={S / 2} />
        {/* o YouTube corta em circulo: tudo que importa fica dentro dele */}
        <circle cx={S / 2} cy={S / 2} r={S / 2 - 6} fill="none" stroke="#ffd23f" strokeWidth={12} />
        {/* dentro do circulo: o YouTube corta o avatar em redondo */}
        <Lutador id="black" pose="guardaKatana" x={S / 2 - 130} chao={S * 0.84} escala={0.44} facing={1} elemento="gelo" />
        <Lutador id="red" pose="guardaKatana" x={S / 2 + 130} chao={S * 0.84} escala={0.44} facing={-1} elemento="fogo" />
      </svg>
      <Img
        src={staticFile("assets/marca/palitanos.png")}
        style={{
          position: "absolute",
          left: S / 2 - 320,
          top: S * 0.17,
          width: 640,
          height: 640 * (333 / 900),
          filter: "drop-shadow(0 6px 12px rgba(0,0,0,0.8))",
        }}
      />
    </AbsoluteFill>
  );
};

export const CapaDoVideo: React.FC<{ titulo?: string; subtitulo?: string }> = ({
  titulo = "GELO vs FOGO",
  subtitulo = "QUEM VENCE?",
}) => {
  const L = 1280;
  const A = 720;
  return (
    <AbsoluteFill>
      <svg width={L} height={A} viewBox={`0 0 ${L} ${A}`}>
        <FundoDeRaios largura={L} altura={A} cx={L / 2} cy={A * 0.55} />
        <Lutador id="black" pose="corteSobe" x={L / 2 - 320} chao={A - 40} escala={0.74} facing={1} elemento="gelo" />
        <Lutador id="red" pose="corteDesce" x={L / 2 + 320} chao={A - 40} escala={0.74} facing={-1} elemento="fogo" />
        {/* o VS no meio, onde as duas laminas se cruzam */}
        <text
          x={L / 2}
          y={A * 0.52}
          textAnchor="middle"
          fontFamily={PILHA}
          fontSize={150}
          fill="#ffd23f"
          {...contorno(18)}
        >
          VS
        </text>
        <text
          x={L / 2}
          y={112}
          textAnchor="middle"
          fontFamily={PILHA}
          fontSize={96}
          fill="#ffffff"
          {...contorno(14)}
          letterSpacing={3}
        >
          {titulo}
        </text>
        <text
          x={L / 2}
          y={A - 34}
          textAnchor="middle"
          fontFamily={PILHA}
          fontSize={72}
          fill="#ff2e2e"
          {...contorno(12)}
          letterSpacing={3}
        >
          {subtitulo}
        </text>
      </svg>
    </AbsoluteFill>
  );
};
