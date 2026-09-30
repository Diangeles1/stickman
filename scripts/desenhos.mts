/**
 * QUANTOS DESENHOS DISTINTOS uma luta usa.
 *
 * Numa animacao desenhada a mao cada quadro e um desenho novo -- uma luta de
 * referencia tem centenas. Aqui o corpo vem de uma biblioteca de poses, entao
 * o numero de desenhos DISTINTOS e finito e mensuravel. Ele e o teto da
 * variedade: se a luta usa doze poses, o espectador ve doze silhuetas, por
 * mais que elas apareçam em ordens diferentes.
 *
 * Repeticao e o que mais denuncia motor. Este script mede ela.
 *
 * Uso: npx tsx scripts/desenhos.mts [luta]
 */
import { desenhoDaChave } from "../src/animation/sampler";
import { compilar } from "../src/core/timeline";
import type { FighterId, PoseName } from "../src/core/types";
import { escolherLuta } from "./lutas.mjs";

const { nome: qual, spec } = escolherLuta(process.argv[2], "ninjas");
const t = compilar(spec);

console.log(`luta: ${qual}\n`);
const geral = new Map<PoseName, number>();
for (const id of [spec.fighterA, spec.fighterB] as FighterId[]) {
  const usos = new Map<PoseName, number>();
  for (const k of t.tracks[id]?.keys ?? []) {
    /*
      O DESENHO, e nao o nome declarado. Uma chave pode dizer "guard" e ser
      desenhada como uma das variantes da guarda (ver sampler,
      desenhoDaChave): contar o nome mediria a intencao do compilador, e o
      que interessa aqui e o que o espectador ve.
    */
    const d = desenhoDaChave(k);
    usos.set(d, (usos.get(d) ?? 0) + 1);
    geral.set(d, (geral.get(d) ?? 0) + 1);
  }
  const ord = [...usos.entries()].sort((a, b) => b[1] - a[1]);
  console.log(`${id}: ${usos.size} desenhos distintos em ${[...usos.values()].reduce((a, b) => a + b, 0)} chaves`);
  console.log(`   mais repetidos: ${ord.slice(0, 5).map(([p, n]) => `${p}x${n}`).join("  ")}`);
}
const total = [...geral.values()].reduce((a, b) => a + b, 0);
const ord = [...geral.entries()].sort((a, b) => b[1] - a[1]);
console.log(`\nna luta inteira: ${geral.size} desenhos distintos em ${total} chaves`);
console.log(`repeticao media: ${(total / geral.size).toFixed(1)}x por desenho`);
console.log(`o mais repetido responde por ${Math.round((ord[0][1] / total) * 100)}% das chaves (${ord[0][0]})`);
