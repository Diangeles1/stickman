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
  opacity?: number;
  /** escurece o braco e a perna de tras, o que da leitura de volume */
  profundidade?: boolean;
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
  opacity = 1,
  profundidade = true,
}) => {
  const transformacao: Transformacao = {
    baseX,
    baseY,
    facing,
    scale: preset.scale * scaleExtra,
    spin,
  };
  const j: Record<JointName, Vec2> = juntasNoMundo(pose, transformacao);
  const largura = preset.limbWidth * preset.scale * scaleExtra;
  const corFundo = escurecer(preset.stroke, 0.62);

  return (
    <g data-fighter={preset.id} opacity={opacity}>
      {OSSOS.map(([de, para]) => {
        // o osso e "de tras" quando qualquer ponta dele e de tras
        const atras =
          profundidade && (JUNTAS_FUNDO.has(de) || JUNTAS_FUNDO.has(para));
        return (
          <line
            key={`${de}-${para}`}
            data-part={`${de}-${para}`}
            x1={j[de].x}
            y1={j[de].y}
            x2={j[para].x}
            y2={j[para].y}
            stroke={atras ? corFundo : preset.stroke}
            strokeWidth={largura}
            strokeLinecap="round"
          />
        );
      })}

      <circle
        data-part="head"
        cx={j.head.x}
        cy={j.head.y}
        r={preset.headRadius * preset.scale * scaleExtra}
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
  quadros: { pose: Pose; baseX: number; baseY: number; spin?: number }[];
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
        opacity={(forca * (i + 1)) / quadros.length}
        profundidade={false}
      />
    ))}
  </g>
);
