/**
 * Medidor de RITMO: contraste entre pausa e explosao.
 *
 * Le um video (ou uma pasta de quadros) e mede, quadro a quadro, quanto a
 * imagem MUDOU. Disso saem tres numeros que descrevem o ritmo da animacao:
 *
 *   - quanto por cento dos quadros estao praticamente PARADOS;
 *   - a razao entre o pico de movimento e a mediana;
 *   - o tamanho das corridas de quadros parados.
 *
 * Existe para comparar este motor com a referencia no MESMO pe. Eu havia
 * SUPOSTO que faltava contraste de tempo; supor nao serve, e este script
 * transforma a suposicao em numero.
 *
 * Amostra sempre a 10 quadros por segundo, porque a referencia so existe
 * nessa taxa: comparar 60fps com 10fps daria vantagem artificial a quem tem
 * mais quadros para distribuir o movimento.
 *
 * Uso: npx tsx scripts/ritmo.mts <video.mp4 | pasta/padrao-%03d.jpg> [rotulo]
 */

import { execFileSync } from "node:child_process";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const entrada = process.argv[2];
const rotulo = process.argv[3] ?? entrada;
if (!entrada) {
  console.log("passe um video ou um padrao de quadros");
  process.exit(1);
}

const L = 80;
const A = 45;
const N = L * A;

const bruto = join(mkdtempSync(join(tmpdir(), "ritmo-")), "cinza.raw");
const entradaArgs = entrada.includes("%")
  ? ["-framerate", "10", "-i", entrada]
  : ["-i", entrada];

execFileSync(
  "ffmpeg",
  ["-y", ...entradaArgs,
   "-vf", `fps=10,scale=${L}:${A},format=gray`,
   "-f", "rawvideo", bruto, "-loglevel", "error"],
  { maxBuffer: 1024 * 1024 },
);

const dados = execFileSync("cat", [bruto], { maxBuffer: 256 * 1024 * 1024 });
const q = Math.floor(dados.length / N);

const difs: number[] = [];
for (let i = 1; i < q; i++) {
  let soma = 0;
  const a = i - 1;
  for (let k = 0; k < N; k++) {
    soma += Math.abs(dados[a * N + k] - dados[i * N + k]);
  }
  difs.push(soma / N);
}

const pico = Math.max(...difs);
const ordenado = [...difs].sort((x, y) => x - y);
const mediana = ordenado[Math.floor(ordenado.length / 2)];
/** "parado" e relativo ao pico: 5% do maior movimento da propria animacao */
const LIMITE_PARADO = pico * 0.05;
const parados = difs.filter((d) => d < LIMITE_PARADO).length;

// corridas de quadros parados: pausa de um quadro nao e pausa, e ruido
const corridas: number[] = [];
let atual = 0;
for (const d of difs) {
  if (d < LIMITE_PARADO) atual++;
  else {
    if (atual > 0) corridas.push(atual);
    atual = 0;
  }
}
if (atual > 0) corridas.push(atual);

console.log(`${rotulo}`);
console.log(`  ${q} quadros a 10 fps (${(q / 10).toFixed(1)}s)`);
console.log(
  `  quadros parados:        ${parados}/${difs.length} = ${Math.round((parados / difs.length) * 100)}%`,
);
console.log(`  pico / mediana:         ${(pico / Math.max(0.01, mediana)).toFixed(1)}x`);
console.log(
  `  pausas (corridas):      ${corridas.length}` +
    `${corridas.length ? `, a maior de ${Math.max(...corridas)} quadros (${(Math.max(...corridas) / 10).toFixed(1)}s)` : ""}`,
);
console.log(
  `  tamanhos das pausas:    ${corridas.length ? corridas.join(", ") : "nenhuma"}`,
);
