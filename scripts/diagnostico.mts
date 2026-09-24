/**
 * Diagnostico da timeline compilada.
 *
 * Ferramenta de trabalho: imprime cada beat com o SEGUNDO real em que ele
 * acontece (ja somando o hit stop) e onde cada lutador esta. Serve para achar
 * enquadramento vazio e beat fora de tempo sem ficar caçando no video.
 *
 * Uso: npx tsx scripts/diagnostico.mts
 */

import { amostrar } from "../src/animation/sampler";
import { compilar } from "../src/core/timeline";
import { PROTOTIPO } from "../src/data/fights/prototype";

const t = compilar(PROTOTIPO);
const congelados = t.impacts.reduce((n, i) => n + i.hitStop, 0);

/** quadro logico -> segundo real no video */
const real = (f: number): string => {
  let soma = 0;
  for (const i of t.impacts) if (i.hitStop > 0 && i.frame < f) soma += i.hitStop;
  return ((f + soma) / PROTOTIPO.fps).toFixed(2);
};

console.log(
  `duracao: ${t.durationInFrames} logicos + ${congelados} congelados = ` +
    `${((t.durationInFrames + congelados) / PROTOTIPO.fps).toFixed(2)}s`,
);

console.log("\n=== BEATS ===");
for (const sb of t.scheduled) {
  const b = sb.beat as Record<string, unknown>;
  const extra = b.move ? ` ${b.move}` : b.who ? ` (${b.who})` : "";
  console.log(
    `${real(sb.from).padStart(5)}s -> ${real(sb.to).padStart(5)}s  ` +
      `${sb.beat.type}${extra}`,
  );
}

console.log("\n=== IMPACTOS ===");
for (const i of t.impacts) {
  console.log(
    `${real(i.frame).padStart(5)}s  ${i.tier.padEnd(7)} ${i.sound.padEnd(10)} ` +
      `x=${Math.round(i.at.x).toString().padStart(6)}  hitStop=${i.hitStop}`,
  );
}

console.log("\n=== ENQUADRAMENTO: os dois estao visiveis? ===");
console.log("  (separacao acima de ~1800 unidades nao cabe na tela)");
const A = PROTOTIPO.fighterA;
const B = PROTOTIPO.fighterB;
for (let f = 0; f <= t.durationInFrames; f += 15) {
  const a = amostrar(t.tracks[A], f);
  const b = amostrar(t.tracks[B], f);
  const sep = Math.abs(a.x - b.x);
  const alerta = sep > 1800 ? "  <<< LONGE DEMAIS" : "";
  console.log(
    `${real(f).padStart(5)}s  ${A}=${Math.round(a.x).toString().padStart(6)} ` +
      `${B}=${Math.round(b.x).toString().padStart(6)}  sep=${Math.round(sep)
        .toString()
        .padStart(5)}  ${a.poseNome}/${b.poseNome}${alerta}`,
  );
}

console.log("\n=== CAMERA: ela aponta para onde os lutadores estao? ===");
const { cameraNoQuadro } = await import("../src/camera/camera");
const { ALTURA_QUADRIL } = await import("../src/characters/skeleton");
const padrao = { center: { x: 0, y: -ALTURA_QUADRIL - 120 }, zoom: 0.95 };
for (let f = 150; f <= 260; f += 10) {
  const cam = cameraNoQuadro(t, f, padrao, {
    largura: PROTOTIPO.width,
    alturaQuadril: -ALTURA_QUADRIL,
  });
  const a = amostrar(t.tracks[A], f);
  const b = amostrar(t.tracks[B], f);
  const meiaTela = PROTOTIPO.width / 2 / cam.zoom;
  const dentro = (x: number) => Math.abs(x - cam.center.x) <= meiaTela;
  console.log(
    `${real(f).padStart(5)}s cam.x=${Math.round(cam.center.x).toString().padStart(6)} ` +
      `zoom=${cam.zoom.toFixed(2)} | ${A}=${Math.round(a.x).toString().padStart(6)}${dentro(a.x) ? " ok " : " FORA"} | ` +
      `${B}=${Math.round(b.x).toString().padStart(6)}${dentro(b.x) ? " ok " : " FORA"}`,
  );
}
