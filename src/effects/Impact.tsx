/**
 * Camada de impacto: flash, onda de choque, particulas e linhas de velocidade.
 *
 * Tudo dirigido pelos ImpactEvent da timeline. Cada efeito consulta o quadro
 * atual, calcula a idade do impacto e desenha o que corresponde aquela idade.
 * Nenhum estado, nenhum efeito colateral.
 *
 * Regra do briefing respeitada aqui: os efeitos DEPENDEM da intensidade. Um
 * soco leve nao ganha onda de choque nem poeira; o golpe final ganha tudo.
 * A tabela mora em particles/particles.ts (PERFIL_IMPACTO).
 */

import React from "react";
import { entre } from "../core/rng";
import type { ImpactEvent, Vec2 } from "../core/types";
import { PERFIL_IMPACTO, particulasDoImpacto } from "../particles/particles";

/** Duracao da onda de choque, em quadros. Curta: onda lenta parece bolha. */
const DUR_ONDA = 16;
/** Duracao do flash. Precisa ser MUITO curto, senao vira piscada de tela. */
const DUR_FLASH = 4;

export const Ondas: React.FC<{ impactos: ImpactEvent[]; frame: number }> = ({
  impactos,
  frame,
}) => (
  <g data-layer="shockwaves">
    {impactos.flatMap((imp) => {
      const idade = frame - imp.frame;
      if (idade < 0 || idade > DUR_ONDA) return [];
      const perfil = PERFIL_IMPACTO[imp.tier];
      const t = idade / DUR_ONDA;
      const forca = 1 - t;

      return Array.from({ length: perfil.ondas }, (_, k) => {
        const atraso = k * 0.22;
        const tk = Math.max(0, t - atraso);
        if (tk <= 0 || tk >= 1) return null;
        const raio = 60 + tk * (imp.tier === "extreme" ? 1500 : 620);
        return (
          <ellipse
            key={`${imp.frame}-${k}`}
            cx={imp.at.x}
            cy={imp.at.y}
            rx={raio}
            ry={raio * 0.82}
            fill="none"
            stroke={k === 0 ? "#fffdf4" : "#ffe08a"}
            strokeWidth={Math.max(2, 26 * forca * (1 - atraso))}
            opacity={Math.max(0, forca * (1 - atraso)) * 0.9}
          />
        );
      }).filter(Boolean);
    })}
  </g>
);

export const Particulas: React.FC<{
  impactos: ImpactEvent[];
  frame: number;
  seed: number;
  fps: number;
}> = ({ impactos, frame, seed, fps }) => (
  <g data-layer="particles">
    {impactos.flatMap((imp) => {
      const idade = frame - imp.frame;
      const lista = particulasDoImpacto(
        `imp-${imp.frame}`,
        seed,
        imp.at,
        imp.tier,
        imp.direction,
        idade,
        fps,
      );
      return lista.map((p, i) => (
        <circle
          key={`${imp.frame}-${i}`}
          cx={p.pos.x}
          cy={p.pos.y}
          r={p.raio}
          fill="#b9c0d0"
          opacity={p.opacidade}
        />
      ));
    })}
  </g>
);

/**
 * Linhas de velocidade: riscos atras de quem se move rapido.
 *
 * E o truque de anime que comunica velocidade sem precisar de mais quadros de
 * animacao. Desenhadas em coordenada de MUNDO, para acompanharem a camera.
 */
export const LinhasDeVelocidade: React.FC<{
  origem: Vec2;
  direcao: number;
  forca: number;
  seed: number;
  chave: string;
}> = ({ origem, direcao, forca, seed, chave }) => {
  if (forca <= 0.05) return null;
  const quantidade = Math.round(18 * forca);
  return (
    <g data-layer="speedlines">
      {Array.from({ length: quantidade }, (_, i) => {
        const id = `${chave}-${i}`;
        const y = origem.y + entre(`${id}-y`, seed, -420, 180);
        const comp = entre(`${id}-c`, seed, 160, 900) * forca;
        const x0 = origem.x - direcao * entre(`${id}-o`, seed, 30, 220);
        return (
          <line
            key={i}
            x1={x0}
            y1={y}
            x2={x0 - direcao * comp}
            y2={y}
            stroke="#c9d2e6"
            strokeWidth={entre(`${id}-w`, seed, 3, 9)}
            opacity={entre(`${id}-a`, seed, 0.12, 0.42) * forca}
            strokeLinecap="round"
          />
        );
      })}
    </g>
  );
};

/**
 * Flash de tela.
 *
 * Fica FORA do grupo da camera, porque cobre a tela inteira e nao o mundo.
 * Intensidade vem do perfil do impacto: o briefing pede flash pequeno no golpe
 * leve e forte no golpe final.
 */
export const Flash: React.FC<{
  impactos: ImpactEvent[];
  frame: number;
  largura: number;
  altura: number;
}> = ({ impactos, frame, largura, altura }) => {
  let intensidade = 0;
  for (const imp of impactos) {
    const idade = frame - imp.frame;
    if (idade < 0 || idade > DUR_FLASH) continue;
    const perfil = PERFIL_IMPACTO[imp.tier];
    intensidade = Math.max(
      intensidade,
      perfil.flash * (1 - idade / DUR_FLASH),
    );
  }
  if (intensidade <= 0.004) return null;
  return (
    <rect
      data-layer="flash"
      width={largura}
      height={altura}
      fill="#ffffff"
      opacity={intensidade}
    />
  );
};

/**
 * Aura do personagem forte.
 *
 * Camadas concentricas com pulso. O pulso vem do quadro (nao de tempo real),
 * senao o video ficaria diferente a cada render.
 */
export const Aura: React.FC<{
  centro: Vec2;
  cor: string;
  forca: number;
  frame: number;
  raio?: number;
}> = ({ centro, cor, forca, frame, raio = 320 }) => {
  if (forca <= 0.02) return null;
  const pulso = 1 + Math.sin(frame * 0.38) * 0.07;
  return (
    <g data-layer="aura">
      {[5, 4, 3, 2, 1].map((k) => (
        <ellipse
          key={k}
          cx={centro.x}
          cy={centro.y}
          rx={raio * (0.42 + 0.17 * k) * pulso}
          ry={raio * (0.52 + 0.19 * k) * pulso}
          fill={cor}
          opacity={forca * (0.03 + 0.022 * (5 - k))}
        />
      ))}
    </g>
  );
};
