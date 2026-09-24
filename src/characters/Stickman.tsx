/**
 * O stickman em SVG.
 *
 * Modular de proposito: cada osso e um <line> proprio e a cabeca um <circle>,
 * todos com data-part, entao qualquer parte pode ser controlada, pintada ou
 * animada de forma independente sem reescrever o componente.
 *
 * Componente PURO: recebe pose e transformacao por props e nao guarda estado.
 * Nada de useState, useEffect ou transition de CSS aqui dentro; no Remotion
 * isso causaria flicker, porque cada quadro e renderizado isolado.
 */

import React from "react";
import type { FighterPreset, JointName, Pose, Vec2 } from "../core/types";
import {
  JUNTAS_FUNDO,
  OSSOS,
  juntasNoMundo,
  type Transformacao,
} from "./skeleton";

export type StickmanProps = {
  preset: FighterPreset;
  pose: Pose;
  baseX: number;
  /** altura do quadril no mundo (negativo = acima do chao) */
  baseY: number;
  facing: 1 | -1;
  /** multiplica o scale do preset, para socar em "close" sem mexer na pose */
  scaleExtra?: number;
  /** rotacao do corpo em torno do quadril, em graus (chute giratorio) */
  spin?: number;
  /** giro no eixo vertical: 1 de frente, -1 de costas (ver Transformacao) */
  giro?: number;
  opacity?: number;
  /** escurece o braco e a perna de tras, o que da leitura de volume */
  profundidade?: boolean;
  /**
   * Liga o contorno escuro.
   *
   * Ele existe para separar um corpo do outro quando se encostam sobre fundo
   * ESCURO. Sobre fundo claro ele vira uma borda preta desenhada em volta do
   * personagem, que a referencia nao tem: la a separacao vem do proprio fundo
   * branco aparecendo entre os membros.
   */
  contorno?: boolean;
};

/**
 * Contorno do personagem: espessura extra de cada lado, em unidades de mundo.
 *
 * Pequeno de proposito. O que ele precisa fazer e separar um corpo do outro
 * quando se encostam, nao virar uma borda de adesivo.
 */
const CONTORNO = 5;

/**
 * Cor do contorno: mais escura que o fundo da arena.
 *
 * Contra o fundo ele some (e e o que se quer, senao vira borda desenhada);
 * contra o outro lutador ele aparece e corta a silhueta.
 */
const COR_DO_CONTORNO = "#050609";

/** Membros da FRENTE: de costas para a camera eles passam a ficar atras. */
const JUNTAS_FRENTE = new Set<JointName>([
  "shoulderFront",
  "elbowFront",
  "handFront",
  "kneeFront",
  "footFront",
]);

const ehDeFundo = (junta: JointName, deCostas: boolean): boolean =>
  deCostas ? JUNTAS_FRENTE.has(junta) : JUNTAS_FUNDO.has(junta);

/**
 * Ossos na ordem de profundidade para o lado que o corpo mostra.
 *
 * De costas (no meio do chute giratorio) o braco e a perna "de tras" ficam
 * mais perto da camera. Sem trocar a ordem, o membro de tras continuava
 * escuro e por baixo, e o giro lia como corpo achatando, nao virando.
 */
const ossosEmOrdem = (deCostas: boolean): [JointName, JointName][] => {
  if (!deCostas) return OSSOS;
  const fundo = OSSOS.filter(
    ([a, b]) => ehDeFundo(a, true) || ehDeFundo(b, true),
  );
  const resto = OSSOS.filter(
    ([a, b]) => !(ehDeFundo(a, true) || ehDeFundo(b, true)),
  );
  return [...fundo, ...resto];
};

/** Escurece uma cor hex por um fator. Usado no membro de tras. */
const escurecer = (hex: string, fator: number): string => {
  const n = parseInt(hex.slice(1), 16);
  const r = Math.round(((n >> 16) & 255) * fator);
  const g = Math.round(((n >> 8) & 255) * fator);
  const b = Math.round((n & 255) * fator);
  return `rgb(${r},${g},${b})`;
};

export const Stickman: React.FC<StickmanProps> = ({
  preset,
  pose,
  baseX,
  baseY,
  facing,
  scaleExtra = 1,
  spin = 0,
  giro = 1,
  opacity = 1,
  profundidade = true,
  contorno = true,
}) => {
  const transformacao: Transformacao = {
    baseX,
    baseY,
    facing,
    scale: preset.scale * scaleExtra,
    spin,
    giro,
  };
  const deCostas = giro < 0;
  const ossos = ossosEmOrdem(deCostas);
  const j: Record<JointName, Vec2> = juntasNoMundo(pose, transformacao);
  const largura = preset.limbWidth * preset.scale * scaleExtra;
  // 0.62 jogava o membro de tras para razao de contraste 1.8 contra o fundo:
  // ele sumia em vez de ficar atras. Sobre fundo quase preto, escurecer para
  // dar profundidade sempre custa legibilidade, entao aqui a cor cede e a
  // ESPESSURA assume parte do trabalho (ver larguraFundo).
  const corFundo = escurecer(preset.stroke, 0.8);
  // membro de tras tambem e mais FINO. Profundidade por duas vias (cor e
  // espessura) custa menos luminancia do que por uma so, e luminancia e
  // exatamente o que esta escasso contra este fundo.
  const larguraFundo = largura * 0.86;
  const raioCabeca = preset.headRadius * preset.scale * scaleExtra;

  return (
    <g data-fighter={preset.id} opacity={opacity}>
      {/*
        CONTORNO. O mesmo esqueleto desenhado antes, mais grosso e quase preto.
        Resolve o problema que so aparece quando os dois se encostam: no quadro
        do golpe o corpo escuro passava por dentro do vermelho e os dois viravam
        uma mancha so. Com o contorno, cada silhueta tem borda propria.

        Vem por baixo de tudo, entao nao muda a cor de nenhum personagem: so
        aparece onde ha borda.
      */}
      {contorno && (
      <g data-part="contorno" stroke={COR_DO_CONTORNO} fill={COR_DO_CONTORNO}>
        {ossos.map(([de, para]) => (
          <line
            key={`c-${de}-${para}`}
            x1={j[de].x}
            y1={j[de].y}
            x2={j[para].x}
            y2={j[para].y}
            strokeWidth={largura + CONTORNO * 2}
            strokeLinecap="round"
          />
        ))}
        <circle cx={j.head.x} cy={j.head.y} r={raioCabeca + CONTORNO} />
      </g>
      )}

      {ossos.map(([de, para]) => {
        // o osso e "de tras" quando qualquer ponta dele e de tras
        const atras =
          profundidade &&
          (ehDeFundo(de, deCostas) || ehDeFundo(para, deCostas));
        return (
          <line
            key={`${de}-${para}`}
            data-part={`${de}-${para}`}
            x1={j[de].x}
            y1={j[de].y}
            x2={j[para].x}
            y2={j[para].y}
            stroke={atras ? corFundo : preset.stroke}
            strokeWidth={atras ? larguraFundo : largura}
            strokeLinecap="round"
          />
        );
      })}

      <circle
        data-part="head"
        cx={j.head.x}
        cy={j.head.y}
        r={raioCabeca}
        fill={preset.stroke}
      />
    </g>
  );
};

/**
 * Rastro do personagem: copias esmaecidas de poses anteriores.
 *
 * E o "afterimage" que o briefing pede. Fica aqui e nao em effects/ porque
 * depende do desenho do personagem, nao de uma camada de efeito.
 */
export const StickmanTrail: React.FC<{
  preset: FighterPreset;
  quadros: {
    pose: Pose;
    baseX: number;
    baseY: number;
    spin?: number;
    giro?: number;
  }[];
  facing: 1 | -1;
  /** opacidade do rastro mais forte; os demais decaem a partir dela */
  forca?: number;
}> = ({ preset, quadros, facing, forca = 0.22 }) => (
  <g data-layer="trail">
    {quadros.map((q, i) => (
      <Stickman
        key={i}
        preset={preset}
        pose={q.pose}
        baseX={q.baseX}
        baseY={q.baseY}
        facing={facing}
        spin={q.spin}
        giro={q.giro}
        opacity={(forca * (i + 1)) / quadros.length}
        profundidade={false}
      />
    ))}
  </g>
);
