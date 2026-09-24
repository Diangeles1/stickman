/**
 * Medidor de contato: TODO golpe da luta encosta?
 *
 * Percorre as miras que o compilador emitiu e, no quadro de contato de cada
 * uma, mede a distancia entre a ponta do membro atacante e o ponto mirado.
 * Roda pela MESMA funcao que a cena usa para desenhar (corpoNoQuadro), porque
 * medidor que monta a transformacao por conta mede um corpo que a tela nao
 * mostra: foi assim que "o golpe nao encosta" sobreviveu a tres rodadas de
 * analise visual.
 *
 * Imprime tambem a vizinhanca do contato, para dar para ver se o membro CHEGA
 * acelerando ou se passa e volta.
 *
 * Uso: npx tsx scripts/contato.mts [benchmark|um-soco]
 */

import { corpoNoQuadro, juntasDoCorpo } from "../src/animation/corpo";
import { ATAQUES } from "../src/attacks/registry";
import { folgaDesejada, pontoDoAlvo, type PontoAlvo } from "../src/core/contact";
import { compilar } from "../src/core/timeline";
import { BENCHMARK } from "../src/data/fights/benchmark";
import { UM_SOCO } from "../src/data/fights/um-soco";
import type { FighterId, JointName } from "../src/core/types";

/** Abaixo disto o golpe encostou (mao mais volume do corpo). */
const ENCOSTOU = 90;

const qual = process.argv[2] ?? "benchmark";
const spec = qual === "um-soco" ? UM_SOCO : BENCHMARK;
const t = compilar(spec);

const real = (f: number) => {
  let soma = 0;
  for (const i of t.impacts) if (i.hitStop > 0 && i.frame < f) soma += i.hitStop;
  return ((f + soma) / spec.fps).toFixed(2);
};

const medir = (
  quem: FighterId,
  alvoId: FighterId,
  junta: JointName,
  ponto: PontoAlvo,
  frame: number,
) => {
  const a = corpoNoQuadro(t, quem, frame);
  const b = corpoNoQuadro(t, alvoId, frame);
  const p = juntasDoCorpo(a)[junta];
  const q = pontoDoAlvo(ponto, juntasDoCorpo(b));
  return {
    dist: Math.hypot(q.x - p.x, q.y - p.y),
    dx: q.x - p.x,
    dy: q.y - p.y,
    separacao: Math.abs(a.x - b.x),
    poseA: a.poseNome,
    poseB: b.poseNome,
    correcao: a.correcaoDaMira,
  };
};

console.log(`luta: ${qual}`);
console.log(
  `folga perseguida: ${folgaDesejada(spec.fighterA, spec.fighterB).toFixed(0)} unidades\n`,
);

let reprovados = 0;

for (const mira of t.aims) {
  const def = Object.values(ATAQUES).find((a) => a.contactJoint === mira.joint);
  const golpe = def?.name ?? mira.joint;
  const temImpacto = t.impacts.some((i) => i.frame === mira.contact);

  console.log(
    `--- ${mira.who} (${golpe}) -> ${mira.alvo} ${mira.ponto}  ` +
      `contato em ${real(mira.contact)}s` +
      `${temImpacto ? "" : "  [ESQUIVADO: sem impacto, de proposito]"}`,
  );
  console.log("  quadro | dist |   dx |   dy | separacao | poses");
  for (let f = mira.contact - 4; f <= mira.contact + 3; f++) {
    const m = medir(mira.who, mira.alvo, mira.joint, mira.ponto as PontoAlvo, f);
    const marca = f === mira.contact ? " <== CONTATO" : "";
    const toca = m.dist < ENCOSTOU ? "toca" : "    ";
    console.log(
      `  ${String(f).padStart(6)} | ${String(Math.round(m.dist)).padStart(4)} ${toca} | ` +
        `${String(Math.round(m.dx)).padStart(4)} | ${String(Math.round(m.dy)).padStart(4)} | ` +
        `${String(Math.round(m.separacao)).padStart(9)} | ${m.poseA}/${m.poseB}${marca}`,
    );
  }
  const m = medir(
    mira.who,
    mira.alvo,
    mira.joint,
    mira.ponto as PontoAlvo,
    mira.contact,
  );
  // Golpe ESQUIVADO nao precisa encostar: o alvo saiu do caminho de proposito
  // e a mira aponta para onde ele estava.
  if (temImpacto && m.dist >= ENCOSTOU) reprovados++;
  console.log(
    `  no contato: ${Math.round(m.dist)} unidades, correcao do IK ${m.correcao.toFixed(0)}` +
      `${temImpacto && m.dist >= ENCOSTOU ? "   <<< NAO ENCOSTA" : ""}\n`,
  );
}

console.log(
  reprovados === 0
    ? "APROVADO: todos os golpes que deveriam encostar encostam."
    : `REPROVADO: ${reprovados} golpes nao encostam.`,
);
