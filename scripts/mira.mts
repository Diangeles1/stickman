/**
 * Auditoria de MIRA: todo golpe encosta em todo ponto de alvo?
 *
 * Monta uma luta minima para cada combinacao de ataque e ponto de alvo,
 * compila, e mede a distancia entre a ponta do membro atacante e o ponto
 * mirado NO QUADRO DO CONTATO, pela mesma funcao que a cena usa para desenhar.
 *
 * Existe porque ajustar a mira na mao nao escala: eram 16 ataques vezes 5
 * pontos de alvo, e eu corrigi UM (soco no peito) mexendo nos numeros da pose
 * ate a medida fechar. Este script e o que diz se o IK generaliza ou se so
 * funcionou para o caso que eu ajustei.
 *
 * Tambem reporta quanto o IK precisou corrigir. Correcao grande nao e erro,
 * mas e sinal de que a pose escrita a mao esta longe do alvo, e pose longe do
 * alvo aparece na animacao como membro torto.
 *
 * Uso: npx tsx scripts/mira.mts
 */

import { corpoNoQuadro, juntasDoCorpo } from "../src/animation/corpo";
import { ATAQUES } from "../src/attacks/registry";
import { compilar } from "../src/core/timeline";
import {
  ALVO_PADRAO,
  folgaDesejada,
  pontoDoAlvo,
  type PontoAlvo,
} from "../src/core/contact";
import { s } from "../src/core/time";
import type { AttackName, FightSpec } from "../src/core/types";

const PONTOS: PontoAlvo[] = ["head", "chest", "torso", "center", "legs"];

/** Acima disto consideramos que o golpe NAO encostou. */
const ENCOSTOU = 90;

const luta = (move: AttackName, ponto: PontoAlvo): FightSpec => ({
  fighterA: "black",
  fighterB: "red",
  seed: 7,
  fps: 60,
  width: 1080,
  height: 1920,
  intensity: 5,
  scenario: "arena",
  beats: [
    { type: "approach", who: "black", toX: -120, duration: s(0.3) },
    {
      type: "attack",
      attacker: "black",
      target: "red",
      move,
      targetPoint: ponto,
    },
    { type: "recover", who: "red", duration: s(0.3) },
  ],
});

const nomes = Object.keys(ATAQUES) as AttackName[];
const folga = folgaDesejada("black", "red");

console.log(`folga perseguida: ${folga.toFixed(0)} unidades de mundo`);
console.log(`limite de "encostou": ${ENCOSTOU}\n`);
console.log("golpe         alvo     dist   dx    dy   correcao IK  alcance");

let reprovados = 0;
let total = 0;
let piorDist = { v: 0, onde: "" };
let piorCorr = { v: 0, onde: "" };

for (const move of nomes) {
  const def = ATAQUES[move];
  for (const ponto of PONTOS) {
    const padrao = ALVO_PADRAO[move] === ponto;
    if (padrao) total++;
    const t = compilar(luta(move, ponto));
    const imp = t.impacts[0];
    if (!imp) {
      console.log(`${move.padEnd(12)} ${ponto.padEnd(7)}  SEM IMPACTO`);
      reprovados++;
      continue;
    }
    const f = imp.frame;
    const a = corpoNoQuadro(t, "black", f);
    const b = corpoNoQuadro(t, "red", f);
    const p = juntasDoCorpo(a)[def.contactJoint];
    const q = pontoDoAlvo(ponto, juntasDoCorpo(b));

    const dx = q.x - p.x;
    const dy = q.y - p.y;
    const dist = Math.hypot(dx, dy);
    const ok = dist < ENCOSTOU;
    if (padrao && !ok) reprovados++;
    if (dist > piorDist.v) piorDist = { v: dist, onde: `${move}/${ponto}` };
    if (a.correcaoDaMira > piorCorr.v) {
      piorCorr = { v: a.correcaoDaMira, onde: `${move}/${ponto}` };
    }

    // "sem folga" nao e erro: significa que a distancia de combate poe o alvo
    // exatamente no limite do alcance, que e como um golpe deve chegar, no
    // fim da extensao. So vira problema junto com distancia grande.
    console.log(
      `${padrao ? "*" : " "}${move.padEnd(11)} ${ponto.padEnd(7)} ${dist.toFixed(0).padStart(5)} ` +
        `${dx.toFixed(0).padStart(5)} ${dy.toFixed(0).padStart(5)} ` +
        `${a.correcaoDaMira.toFixed(0).padStart(7)}  ` +
        `${a.alcancou ? "sobra " : "no fim"}` +
        `${padrao && !ok ? "  <<< NAO ENCOSTA" : ""}`,
    );
  }
}

console.log(
  `\npior distancia: ${piorDist.v.toFixed(0)} (${piorDist.onde})`,
);
console.log(
  `maior correcao do IK: ${piorCorr.v.toFixed(1)} unidades de pose (${piorCorr.onde})`,
);
console.log(
  reprovados === 0
    ? `APROVADO: os ${total} alvos padrao encostam.`
    : `REPROVADO: ${reprovados}/${total} alvos padrao nao encostam.`,
);
