/**
 * Auditoria dos PES: o personagem pisa ou patina?
 *
 * Um pe que esta no chao e nao esta dando passo tem que ficar PARADO no
 * mundo. Qualquer deslocamento horizontal dele enquanto encosta no chao e
 * patinacao, e patinacao e o que mais denuncia "boneco sendo arrastado por
 * codigo" em vez de corpo com peso.
 *
 * Mede, quadro a quadro, quanto cada pe apoiado anda no eixo x. Deslizamento
 * sob knockback forte e permitido (o corpo esta sendo arrastado de verdade),
 * e o relatorio separa os dois casos.
 *
 * Uso: npx tsx scripts/pes.mts [benchmark|um-soco|gerada:N]
 */

import {
  POSES_DE_APOIO,
  corpoNoQuadro,
  juntasDoCorpo,
} from "../src/animation/corpo";
import { compilar } from "../src/core/timeline";
import { BENCHMARK } from "../src/data/fights/benchmark";
import { BENCHMARK2 } from "../src/data/fights/benchmark2";
import { LUTA_COMPLETA } from "../src/data/fights/luta-completa";
import { gerarLuta } from "../src/data/gerador";
import { UM_SOCO } from "../src/data/fights/um-soco";
import type { FighterId, JointName } from "../src/core/types";

/**
 * Pe a menos disto do chao (unidades de mundo) conta como apoiado.
 *
 * Com os pes plantados, o pe apoiado fica EXATAMENTE no chao (y = 0). Um pe
 * a 5 ou 10 unidades esta saindo ou chegando de um passo, e anda de proposito:
 * com a tolerancia antiga de 10, o inicio e o fim de cada passo eram contados
 * como patinacao.
 */
const NO_CHAO = 1.5;
/** Deslocamento por quadro abaixo disto e ruido de arredondamento. */
const TOLERANCIA = 1.5;
const DEBUG = process.env.PES_DEBUG === "1";
/** Acima desta velocidade do quadril o corpo esta sendo ARRASTADO. */
const ARRASTO = 16;

const qual = process.argv[2] ?? "benchmark";
const spec = qual.startsWith("gerada:")
  ? gerarLuta(Number(qual.split(":")[1]) || 1, { segundos: 30 })
  : qual === "completa"
    ? LUTA_COMPLETA
    : qual === "benchmark2"
    ? BENCHMARK2
    : qual === "um-soco"
    ? UM_SOCO
    : BENCHMARK;
const t = compilar(spec);

console.log(`luta: ${qual}\n`);
let totalRuim = 0;

/**
 * ESTALO: pe perto do chao que salta mais que isto num quadro.
 *
 * Nao e patinacao (o pe nao esta apoiado), e e pior: e o pe teleportando.
 * Passo de verdade anda no maximo ~25 unidades por quadro perto do chao.
 */
const ESTALO = 30;
const PERTO = 15;
let estalos = 0;
for (const id of [spec.fighterA, spec.fighterB] as FighterId[]) {
  for (const pe of ["footFront", "footBack"] as JointName[]) {
    for (let f = 1; f <= t.durationInFrames; f++) {
      const a = corpoNoQuadro(t, id, f - 1);
      const b = corpoNoQuadro(t, id, f);
      if (a.noAr || b.noAr) continue;
      if (!POSES_DE_APOIO.has(a.poseNome) || !POSES_DE_APOIO.has(b.poseNome)) continue;
      if (Math.abs(b.velocidade) > ARRASTO) continue;
      const pa = juntasDoCorpo(a)[pe];
      const pb = juntasDoCorpo(b)[pe];
      if (pa.y < -PERTO || pb.y < -PERTO) continue;
      const d = Math.hypot(pb.x - pa.x, pb.y - pa.y);
      if (d > ESTALO) {
        estalos++;
        console.log(
          `  ESTALO ${id} ${pe} quadro ${f}: ${d.toFixed(0)} unidades (${a.poseNome} -> ${b.poseNome})`,
        );
      }
    }
  }
}

for (const id of [spec.fighterA, spec.fighterB] as FighterId[]) {
  for (const pe of ["footFront", "footBack"] as JointName[]) {
    let patinado = 0;
    let arrastado = 0;
    let quadrosRuins = 0;
    let pior = { d: 0, f: 0 };
    for (let f = 1; f <= t.durationInFrames; f++) {
      const a = corpoNoQuadro(t, id, f - 1);
      const b = corpoNoQuadro(t, id, f);
      if (a.noAr || b.noAr) continue;
      // corpo deitado, caindo ou levantando nao esta de pe: membro que se move
      // no chao ali e a queda acontecendo, nao patinacao
      if (!POSES_DE_APOIO.has(a.poseNome) || !POSES_DE_APOIO.has(b.poseNome)) continue;
      const pa = juntasDoCorpo(a)[pe];
      const pb = juntasDoCorpo(b)[pe];
      if (pa.y < -NO_CHAO || pb.y < -NO_CHAO) continue;
      const d = Math.abs(pb.x - pa.x);
      if (d <= TOLERANCIA) continue;
      if (Math.abs(b.velocidade) > ARRASTO) {
        arrastado += d;
        continue;
      }
      patinado += d;
      if (DEBUG) console.log("  ", id, pe, f, a.poseNome, "->", b.poseNome, d.toFixed(1), "y", pb.y.toFixed(0));
      quadrosRuins++;
      if (d > pior.d) pior = { d, f };
    }
    totalRuim += patinado;
    console.log(
      `${id.padEnd(6)} ${pe.padEnd(10)} patinou ${patinado.toFixed(0).padStart(5)} ` +
        `em ${String(quadrosRuins).padStart(3)} quadros ` +
        `(pior ${pior.d.toFixed(1)} no quadro ${pior.f}), ` +
        `arrastado sob golpe ${arrastado.toFixed(0)}`,
    );
  }
}

console.log(`\nestalos de pe perto do chao: ${estalos}`);
console.log(
  totalRuim < 60 && estalos === 0
    ? `APROVADO: pes apoiados patinaram ${totalRuim.toFixed(0)} unidades, nenhum estalo.`
    : `REPROVADO: pes apoiados patinaram ${totalRuim.toFixed(0)} unidades, ${estalos} estalos.`,
);
