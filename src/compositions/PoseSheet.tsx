/**
 * Folha de poses: grade com varias poses lado a lado, cada uma rotulada.
 *
 * Nao entra em video nenhum. E ferramenta de trabalho: serve para validar pose
 * nova sem renderizar uma luta inteira, e para comparar duas poses que deveriam
 * ser distintas (por exemplo, um plano aberto e um fechado precisam ter
 * silhueta diferente, senao o corte entre eles nao le como corte).
 */

import React from "react";
import { PRESETS } from "../characters/presets";
import { POSES } from "../characters/poses";
import { ALTURA_QUADRIL } from "../characters/skeleton";
import { Stickman } from "../characters/Stickman";
import type { FighterId, PoseName } from "../core/types";

export type PoseSheetProps = {
  poses: PoseName[];
  fighter: FighterId;
  colunas: number;
};

export const PoseSheet: React.FC<PoseSheetProps> = ({
  poses,
  fighter,
  colunas,
}) => {
  const preset = PRESETS[fighter];
  const linhas = Math.ceil(poses.length / colunas);
  // A celula precisa caber o personagem inteiro com folga. Depois da
  // ESCALA_POSE ele tem ~600 unidades do pe ao topo da cabeca, e o membro
  // estendido de um golpe forte chega a ~300 para o lado.
  const largura = 900;
  const altura = 860;

  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        background: "#0e0f13",
        display: "grid",
        gridTemplateColumns: `repeat(${colunas}, 1fr)`,
        gridTemplateRows: `repeat(${linhas}, 1fr)`,
      }}
    >
      {poses.map((nome) => (
        <div
          key={nome}
          style={{
            position: "relative",
            display: "flex",
            flexDirection: "column",
            minHeight: 0,
          }}
        >
          {/* rotulo em cima: embaixo ele encostava na figura da linha
              seguinte e ficava ambiguo na hora de validar */}
          <div
            style={{
              color: "#8b93a6",
              fontFamily: "monospace",
              fontSize: 24,
              textAlign: "center",
              paddingTop: 8,
            }}
          >
            {nome}
          </div>
          <svg
            width="100%"
            height="100%"
            style={{ flex: 1, minHeight: 0 }}
            viewBox={`${-largura / 2} ${-altura + 110} ${largura} ${altura}`}
          >
            {/* linha do chao, para conferir se o pe esta plantado */}
            <line
              x1={-largura / 2}
              y1={0}
              x2={largura / 2}
              y2={0}
              stroke="#2b2f3a"
              strokeWidth={4}
            />
            <Stickman
              preset={preset}
              pose={POSES[nome]}
              baseX={0}
              baseY={-ALTURA_QUADRIL}
              facing={1}
            />
          </svg>
        </div>
      ))}
    </div>
  );
};
