/**
 * Auditoria de ARCOS: o membro que golpeia viaja em curva ou em linha reta?
 *
 * Membro de verdade gira em volta de uma articulacao, entao a ponta dele
 * descreve um arco. Ponto que desliza em linha reta de A ate B e a
 * assinatura de interpolacao de posicao, e o olho le isso como mecanico.
 *
 * Para cada golpe mede o caminho da ponta do membro (punho, pe, joelho...)
 * da carga ate o contato, em relacao ao QUADRIL (sem o deslocamento do corpo
 * inteiro, que nao e arco de membro). A curvatura e o maior afastamento da
 * reta entre o inicio e o fim, dividido pelo comprimento dessa reta.
 *
 *   0.00        linha reta
 *   0.10-0.35   arco que se le
 *
 * Uso: npx tsx scripts/arcos.mts [benchmark|um-soco|gerada:N]
 */

import { corpoNoQuadro, juntasDoCorpo } from "../src/animation/corpo";
import { compilar } from "../src/core/timeline";
import { BENCHMARK } from "../src/data/fights/benchmark";
import { DOMINIO } from "../src/data/fights/dominio";
import { BENCHMARK2 } from "../src/data/fights/benchmark2";
import { LUTA_COMPLETA } from "../src/data/fights/luta-completa";
import { GELO_VS_FOGO } from "../src/data/fights/gelo-vs-fogo";
import { trocarVencedor } from "../src/data/trocar";
import { gerarLuta } from "../src/data/gerador";
import { UM_SOCO } from "../src/data/fights/um-soco";

/** Abaixo disto o caminho conta como reto. */
const MINIMO = 0.08;

const qual = process.argv[2] ?? "benchmark";
const spec = qual === "dominio"
  ? DOMINIO
  : qual.startsWith("gerada:")
  ? gerarLuta(Number(qual.split(":")[1]) || 1, { segundos: 30 })
  : qual === "gelofogo"
    ? GELO_VS_FOGO
  : qual === "completa-vermelho"
    ? trocarVencedor(LUTA_COMPLETA)
  : qual === "completa"
    ? LUTA_COMPLETA
    : qual === "benchmark2"
    ? BENCHMARK2
    : qual === "um-soco"
    ? UM_SOCO
    : BENCHMARK;
const t = compilar(spec);

console.log(`luta: ${qual}\n`);
let retos = 0;
for (const mira of t.aims) {
  const pontos: { x: number; y: number }[] = [];
  // da metade da carga ate o contato: e o trecho que o olho le como golpe
  for (let f = mira.from - 6; f <= mira.contact; f++) {
    const c = corpoNoQuadro(t, mira.who, f);
    const j = juntasDoCorpo(c);
    pontos.push({
      x: (j[mira.joint].x - j.hip.x) * c.facing,
      y: j[mira.joint].y - j.hip.y,
    });
  }
  const a = pontos[0];
  const b = pontos[pontos.length - 1];
  const corda = Math.hypot(b.x - a.x, b.y - a.y) || 1;
  let desvio = 0;
  for (const p of pontos) {
    const d =
      Math.abs((b.x - a.x) * (a.y - p.y) - (a.x - p.x) * (b.y - a.y)) / corda;
    desvio = Math.max(desvio, d);
  }
  const curvatura = desvio / corda;
  const reto = curvatura < MINIMO;
  if (reto) retos++;
  console.log(
    `${mira.who.padEnd(6)} ${mira.joint.padEnd(14)} -> ${mira.ponto.padEnd(7)} ` +
      `corda ${corda.toFixed(0).padStart(4)}  curvatura ${curvatura.toFixed(2)}` +
      `${reto ? "   <<< LINHA RETA" : ""}`,
  );
}
console.log(
  retos === 0
    ? "\nAPROVADO: todo golpe viaja em arco."
    : `\nREPROVADO: ${retos}/${t.aims.length} golpes em linha reta.`,
);
