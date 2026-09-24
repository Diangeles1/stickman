/**
 * Wrapper do CLI do Remotion que coloca os arquivos temporarios DENTRO do
 * projeto.
 *
 * POR QUE: o Remotion grava cada quadro como imagem num diretorio temporario
 * antes de montar o MP4, e o Node usa os.tmpdir(), que no Windows aponta para
 * C:\Users\...\AppData\Local\Temp. A 1080x1920 em PNG cada quadro pesa ~2 MB,
 * entao uma luta de 50s a 60fps (3.000 quadros) pede cerca de 6 GB de
 * temporario. No disco onde este projeto nasceu isso enchia o C: no meio do
 * render.
 *
 * Apontando TEMP/TMP para <projeto>/.tmp, o temporario cai no mesmo disco do
 * projeto. Sem caminho absoluto: funciona em qualquer maquina.
 *
 * Uso: node scripts/remotion.mjs render Prototype out/prototype.mp4
 */

import { spawn } from "node:child_process";
import { mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const raiz = join(dirname(fileURLToPath(import.meta.url)), "..");
const tmp = join(raiz, ".tmp");
mkdirSync(tmp, { recursive: true });

const args = process.argv.slice(2);
if (args.length === 0) {
  console.error("uso: node scripts/remotion.mjs <comando do remotion> [...]");
  process.exit(1);
}

const filho = spawn("npx", ["remotion", ...args], {
  cwd: raiz,
  stdio: "inherit",
  shell: true,
  env: {
    ...process.env,
    TEMP: tmp,
    TMP: tmp,
    TMPDIR: tmp, // macOS e Linux
  },
});

filho.on("exit", (codigo) => process.exit(codigo ?? 0));
