/**
 * Auditoria de PES E CHAO.
 *
 * Mede, em TODOS os quadros da luta e para os DOIS lutadores, a altura do pe
 * mais baixo em coordenadas de mundo. Apoiado no chao significa y = 0.
 *
 * A primeira versao media as POSES, e isso media a coisa errada: as poses
 * escritas a mao continuam com o pe em alturas variadas, e quem resolve isso e
 * o apoio em corpoNoQuadro, na hora de desenhar. O que importa e o corpo que
 * vai para a tela, nao o dado que o alimenta.
 *
 * Roda pela MESMA funcao que a cena usa para desenhar, entao o que passa aqui
 * e o que aparece no video.
 *
 * Uso: npx tsx scripts/chao.mts
 */

import { corpoNoQuadro, juntasDoCorpo } from "../src/animation/corpo";
import { amostrar } from "../src/animation/sampler";
import { compilar } from "../src/core/timeline";
import { BENCHMARK } from "../src/data/fights/benchmark";
import { BENCHMARK2 } from "../src/data/fights/benchmark2";
import { gerarLuta } from "../src/data/gerador";
import { UM_SOCO } from "../src/data/fights/um-soco";
import type { FighterId, PoseName } from "../src/core/types";

/** Poses em que o personagem NAO esta apoiado nos pes. */
const NO_AR = new Set<PoseName>([
  "jump", "airborne", "airAttack", "diveAttack",
  "downed", "getUp", "squash",
]);

/** Tolerancia em unidades de mundo. 12 e menos de meia espessura de membro. */
const TOLERANCIA = 12;

const qual = process.argv[2] ?? "benchmark";
/**
 * Qual luta auditar. "gerada:7" audita a luta que a semente 7 produz.
 *
 * E este o ponto de ter auditoria automatica: uma luta gerada pode ser
 * conferida SEM ninguem assistir a ela. Sem isso, gerar cem lutas seria gerar
 * cem lutas nao verificadas.
 */
const spec = qual.startsWith("gerada:")
  ? gerarLuta(Number(qual.split(":")[1]) || 1, { segundos: 30 })
  : qual === "benchmark2"
    ? BENCHMARK2
    : qual === "um-soco"
    ? UM_SOCO
    : BENCHMARK;
const t = compilar(spec);
console.log(`luta: ${qual}`);

const medir = (id: FighterId, _outroId: FighterId, frame: number) => {
  const c = corpoNoQuadro(t, id, frame);
  const j = juntasDoCorpo(c);
  return {
    pe: Math.max(j.footFront.y, j.footBack.y),
    pose: c.poseNome,
    agachamento: c.agachamento,
    airborne: amostrar(t.tracks[id], frame).airborne,
  };
};

const pares: [FighterId, FighterId][] = [
  [spec.fighterA, spec.fighterB],
  [spec.fighterB, spec.fighterA],
];

let ruins = 0;
let total = 0;
let pior = { erro: 0, quadro: -1, quem: "", pose: "" };
const porPose = new Map<string, { n: number; pior: number }>();

for (const [id, outro] of pares) {
  for (let f = 0; f <= t.durationInFrames; f++) {
    const m = medir(id, outro, f);
    if (m.airborne || NO_AR.has(m.pose)) continue;
    total++;
    const erro = Math.abs(m.pe);
    if (erro > TOLERANCIA) {
      ruins++;
      const atual = porPose.get(m.pose) ?? { n: 0, pior: 0 };
      porPose.set(m.pose, { n: atual.n + 1, pior: Math.max(atual.pior, erro) });
    }
    if (erro > pior.erro) {
      pior = { erro, quadro: f, quem: id, pose: m.pose };
    }
  }
}

console.log(`${total} quadros apoiados medidos (dois lutadores)`);
console.log(
  `pior desvio do chao: ${pior.erro.toFixed(1)} unidades de mundo ` +
    `(${pior.quem} f${pior.quadro}, pose ${pior.pose})`,
);
if (porPose.size > 0) {
  console.log("\npor pose:");
  for (const [pose, v] of [...porPose.entries()].sort((a, b) => b[1].pior - a[1].pior)) {
    console.log(`  ${pose.padEnd(12)} ${v.n} quadros, pior ${v.pior.toFixed(0)}`);
  }
}
console.log(
  ruins === 0
    ? "\nAPROVADO: nenhum pe fora do chao."
    : `\nREPROVADO: ${ruins}/${total} quadros com pe fora do chao.`,
);

// AGACHAMENTO: e o movimento vertical que o apoio produz de graca. Zero em
// todos os quadros significaria que o corpo nao sobe nem desce nunca.
let minA = Infinity;
let maxA = -Infinity;
for (const [id, outro] of pares) {
  for (let f = 0; f <= t.durationInFrames; f++) {
    const a = medir(id, outro, f).agachamento;
    minA = Math.min(minA, a);
    maxA = Math.max(maxA, a);
  }
}
console.log(
  `\noscilacao vertical do quadril: ${(maxA - minA).toFixed(0)} unidades de mundo ` +
    `(${(((maxA - minA) / 597) * 100).toFixed(0)}% de uma altura de corpo)`,
);
