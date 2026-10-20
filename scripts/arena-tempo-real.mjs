/**
 * Gera o bundle da ARENA 3D EM TEMPO REAL e serve a pagina.
 *
 * Uso:
 *
 *   node scripts/arena-tempo-real.mjs              gera out/tempo-real/
 *   node scripts/arena-tempo-real.mjs --servir     gera, serve e recompila
 *   node scripts/arena-tempo-real.mjs --servir --porta=5000
 *   node scripts/arena-tempo-real.mjs --producao   minificado, sem sourcemap
 *
 * NENHUMA DEPENDENCIA NOVA. O esbuild usado aqui e o que ja esta em
 * node_modules porque o Remotion depende dele (ver `allowScripts` no
 * package.json). Vite, webpack ou parcel resolveriam o mesmo problema e cada
 * um traria algumas centenas de pacotes para uma pagina de depuracao de um
 * arquivo -- e, pior, um segundo jeito de compilar o mesmo `src/` ao lado do
 * jeito do Remotion.
 *
 * POR QUE NAO O STUDIO DO REMOTION. O studio ja mostra a composicao Arena3D,
 * e e o lugar certo para ver a cena COMPLETA. O que ele nao pode dar e o que
 * esta pagina existe para dar: laco proprio de requestAnimationFrame (no
 * studio o tempo e a trilha de quadros do player), camera de orbita (a do
 * video e casada com o SVG e nao pode se mover) e FPS de tempo real (o
 * studio mede tempo de render por quadro, que e outra grandeza).
 */

import { cp, mkdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import * as esbuild from "esbuild";

const raiz = join(dirname(fileURLToPath(import.meta.url)), "..");
const origem = join(raiz, "src", "3d", "tempo-real");
const saida = join(raiz, "out", "tempo-real");

const args = process.argv.slice(2);
const servir = args.includes("--servir");
const producao = args.includes("--producao");
const porta = Number(
  args.find((a) => a.startsWith("--porta="))?.split("=")[1] ?? 4321,
);

await mkdir(saida, { recursive: true });

/**
 * `process.env.NODE_ENV` precisa estar DEFINIDO, nao apenas existir.
 *
 * O React e o `remotion` leem essa variavel em tempo de modulo. No navegador
 * nao existe `process`, entao sem a substituicao o bundle quebra na primeira
 * linha com "process is not defined" -- e quebra em runtime, nao na
 * compilacao, que e o pior lugar para descobrir.
 */
const opcoes = {
  entryPoints: [join(origem, "index.tsx")],
  outfile: join(saida, "arena.js"),
  bundle: true,
  format: "iife",
  platform: "browser",
  // alvo de navegador moderno: a pagina roda no Chrome/Edge da maquina de
  // quem desenvolve, nao no navegador de um espectador
  target: ["chrome120"],
  jsx: "automatic",
  sourcemap: !producao,
  minify: producao,
  define: {
    "process.env.NODE_ENV": JSON.stringify(
      producao ? "production" : "development",
    ),
  },
  logLevel: "info",
  logLimit: 20,
};

/** Copia o HTML para junto do bundle; ele referencia ./arena.js. */
const copiarHtml = async () => {
  await cp(join(origem, "index.html"), join(saida, "index.html"));
};

if (!servir) {
  const r = await esbuild.build(opcoes);
  await copiarHtml();
  if (r.warnings.length > 0) {
    console.log(`${r.warnings.length} aviso(s) do esbuild acima.`);
  }
  console.log(`\npronto: ${join(saida, "index.html")}`);
  console.log("abra esse arquivo no navegador, ou rode com --servir.");
  process.exit(0);
}

const ctx = await esbuild.context(opcoes);
await copiarHtml();
await ctx.watch();
const { hosts, port } = await ctx.serve({ servedir: saida, port: porta });

/*
  O `file://` tambem funciona para esta pagina (nao ha fetch nem modulo ES
  carregado por rede -- o bundle e um IIFE unico), mas servir por HTTP e o que
  da recompilacao automatica a cada salvamento, e e para isso que o --servir
  existe.
*/
const host = hosts.includes("127.0.0.1") ? "127.0.0.1" : hosts[0];
console.log(`\narena 3D em tempo real: http://${host}:${port}/`);
console.log("recompila a cada salvamento. ctrl+c para parar.");

// um arquivo com a URL ajuda quem roda isso de dentro de outro script
await writeFile(join(saida, ".url"), `http://${host}:${port}/\n`, "utf8");
