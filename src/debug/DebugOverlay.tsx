/**
 * Overlay de depuracao.
 *
 * Mostra na tela o que normalmente so existe em numero: onde esta o punho,
 * onde esta o ponto do alvo, a linha entre os dois, e a distancia que falta
 * para encostar.
 *
 * Existe porque o bug mais grave do projeto ("o golpe nao encosta") passou por
 * tres rodadas de analise visual sem ser notado: no video, o braco esticado
 * PARECE alcancar. So medindo da para ver que faltavam 294 unidades.
 *
 * Ele calcula a posicao das juntas EXATAMENTE como o Stickman calcula, com a
 * mesma altura de quadril e o mesmo facing. Se o overlay e o boneco
 * discordassem, o overlay nao serviria para nada.
 *
 * Desligado no render final (prop `debug` da composicao).
 */

import React from "react";
import {
  alturaNoAr,
  amostrar,
  inclinacaoDesenhada,
} from "../animation/sampler";
import { ATAQUES } from "../attacks/registry";
import { PRESETS } from "../characters/presets";
import { ALTURA_QUADRIL, juntasNoMundo } from "../characters/skeleton";
import { ALVO_PADRAO } from "../core/contact";
import type { JointName, Timeline } from "../core/types";

export type DebugOverlayProps = {
  timeline: Timeline;
  frame: number;
};

/** Junta do alvo correspondente a cada ponto. Espelha JUNTA_DO_ALVO. */
const JUNTA_DO_PONTO: Record<string, JointName> = {
  head: "head",
  chest: "neck",
  torso: "hip",
  legs: "kneeFront",
  center: "hip",
};

/** Abaixo desta distancia consideramos que encostou (mao mais volume do corpo). */
const ENCOSTOU = 90;

export const DebugOverlay: React.FC<DebugOverlayProps> = ({
  timeline,
  frame,
}) => {
  const { fighterA, fighterB, beats } = timeline.spec;

  // qual golpe e qual ponto estao sendo medidos: vem dos DADOS da luta, para o
  // overlay nao medir uma coisa enquanto o compilador anima outra
  const ataque = beats.find(
    (b) => b.type === "attack" || b.type === "blocked" || b.type === "finisher",
  );
  const move = ataque && "move" in ataque ? ataque.move : "punch";
  const ponto =
    (ataque && "targetPoint" in ataque && ataque.targetPoint) ||
    ALVO_PADRAO[move] ||
    "chest";
  const juntaAtacante = ATAQUES[move]?.contactJoint ?? "handFront";
  const juntaAlvo = JUNTA_DO_PONTO[ponto] ?? "neck";

  const atacante = ataque && "attacker" in ataque ? ataque.attacker : fighterA;
  const alvo = ataque && "target" in ataque ? ataque.target : fighterB;

  const a = amostrar(timeline.tracks[atacante], frame);
  const b = amostrar(timeline.tracks[alvo], frame);

  const juntasA = juntasNoMundo(a.pose, {
    baseX: a.x,
    baseY: alturaNoAr(timeline.tracks[atacante], frame, ALTURA_QUADRIL),
    facing: a.x <= b.x ? 1 : -1,
    scale: PRESETS[atacante].scale,
    spin: inclinacaoDesenhada(a) * (a.x <= b.x ? 1 : -1),
  });
  const juntasB = juntasNoMundo(b.pose, {
    baseX: b.x,
    baseY: alturaNoAr(timeline.tracks[alvo], frame, ALTURA_QUADRIL),
    facing: b.x <= a.x ? 1 : -1,
    scale: PRESETS[alvo].scale,
    spin: inclinacaoDesenhada(b) * (b.x <= a.x ? 1 : -1),
  });

  const punho = juntasA[juntaAtacante];
  const mira = juntasB[juntaAlvo];
  const distancia = Math.hypot(punho.x - mira.x, punho.y - mira.y);
  const tocando = distancia < ENCOSTOU;

  // o impacto registrado pelo compilador, para conferir se ele marcou o
  // contato no MESMO lugar em que o punho de fato esta
  const impacto = timeline.impacts.find((i) => Math.abs(i.frame - frame) <= 3);
  const noContato = timeline.impacts.some((i) => i.frame === frame);

  const textoY = -ALTURA_QUADRIL - 700;
  const textoX = (a.x + b.x) / 2 - 420;

  return (
    <g data-layer="debug" pointerEvents="none">
      {/* linha entre o membro atacante e o ponto mirado: verde quando encosta */}
      <line
        x1={punho.x}
        y1={punho.y}
        x2={mira.x}
        y2={mira.y}
        stroke={tocando ? "#39e07a" : "#ff5a4d"}
        strokeWidth={5}
        strokeDasharray="18 12"
      />

      <circle
        cx={mira.x}
        cy={mira.y}
        r={ENCOSTOU}
        fill="none"
        stroke={tocando ? "#39e07a" : "#5a6478"}
        strokeWidth={3}
      />

      <circle cx={punho.x} cy={punho.y} r={20} fill="#ffd34d" />
      <text x={punho.x + 28} y={punho.y - 16} fill="#ffd34d" fontSize={34}>
        {juntaAtacante}
      </text>

      <circle cx={mira.x} cy={mira.y} r={16} fill="#4dc8ff" />
      <text x={mira.x + 28} y={mira.y - 16} fill="#4dc8ff" fontSize={34}>
        {ponto}
      </text>

      {impacto && (
        <>
          <circle
            cx={impacto.at.x}
            cy={impacto.at.y}
            r={26}
            fill="none"
            stroke="#ff4df0"
            strokeWidth={6}
          />
          <text
            x={impacto.at.x + 34}
            y={impacto.at.y + 40}
            fill="#ff4df0"
            fontSize={32}
          >
            contato
          </text>
        </>
      )}

      {/* o quadro do contato ganha uma moldura: e o quadro que precisa passar */}
      {noContato && (
        <text x={textoX} y={textoY - 62} fill="#ff4df0" fontSize={52} fontFamily="monospace">
          QUADRO DO CONTATO
        </text>
      )}

      <text
        x={textoX}
        y={textoY}
        fill={tocando ? "#39e07a" : "#ff5a4d"}
        fontSize={46}
        fontFamily="monospace"
      >
        {`f${frame}  dist ${Math.round(distancia)}  ${tocando ? "ENCOSTOU" : "longe"}`}
      </text>
      <text
        x={textoX}
        y={textoY + 58}
        fill="#8b93a6"
        fontSize={38}
        fontFamily="monospace"
      >
        {`${atacante} ${a.poseNome} x=${Math.round(a.x)} | ${alvo} ${b.poseNome} x=${Math.round(b.x)}`}
      </text>
    </g>
  );
};
