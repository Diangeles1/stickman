/**
 * PRODUZIR: de uma semente a um video pronto para publicar, sem ninguem no
 * meio do caminho.
 *
 * Este script existe por uma razao pratica: o motor nao precisa de IA para
 * fazer video. A coreografia inteira sai de `gerarLuta(semente)` -- os
 * golpes, as defesas, a escalada, o finalizador, a camera e o tempo. O que
 * uma conversa com IA resolve e MUDAR o motor; usar o motor e rodar isto.
 *
 * O que ele faz para cada semente:
 *
 *   1. AUDITA a luta antes de gastar minutos renderizando. Os validadores
 *      rodam sobre a timeline compilada, em segundos. Semente reprovada e
 *      pulada e o motivo fica no relatorio -- nenhuma luta gerada precisa
 *      ser assistida para ser conferida, e e isso que torna possivel produzir
 *      dez de uma vez.
 *   2. RENDERIZA em qualidade de publicacao.
 *   3. Gera uma COPIA LEVE, so para conferir no celular. A que sobe e a
 *      pesada: as plataformas reencodam por cima, e o que se perde aqui se
 *      perde de novo la.
 *
 * Uso:
 *   npx tsx scripts/produzir.mts 7              uma semente
 *   npx tsx scripts/produzir.mts 1 2 3 4 5      varias
 *   npx tsx scripts/produzir.mts 10..20         um intervalo
 *   npx tsx scripts/produzir.mts 7 --segundos=25 --so-auditar
 *
 * Os arquivos saem em out/producao/luta-<semente>.mp4.
 */

import { execFileSync, spawnSync } from "node:child_process";
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const RAIZ = join(import.meta.dirname, "..");
const SAIDA = join(RAIZ, "out", "producao");

/** Validadores que rodam antes do render, na ordem em que reprovam mais. */
const VALIDADORES = ["qualidade", "pes", "contato", "cadeia", "arcos"];

const args = process.argv.slice(2);
const opcao = (nome: string, padrao: string): string =>
  args.find((a) => a.startsWith(`--${nome}=`))?.split("=")[1] ?? padrao;
const temFlag = (nome: string) => args.includes(`--${nome}`);

const segundos = Number(opcao("segundos", "30"));
const soAuditar = temFlag("so-auditar");
/*
  RENDERIZAR MESMO COM REPROVACAO.

  Existe porque hoje NENHUMA semente passa nos cinco validadores: `cadeia`
  reprova em todas, sempre pelo mesmo motivo (o quadril, o pescoco e o ombro
  atingem a velocidade maxima no MESMO quadro nos golpes rapidos, entao a
  corrente do corpo nao tem espalhamento para ser lida).

  Sem esta opcao o script seria honesto e inutil ao mesmo tempo. Com ela, o
  relatorio continua dizendo exatamente o que esta errado em cada semente e
  quem produz decide se aquilo aparece no video.
*/
const ignorarAuditoria = temFlag("mesmo-assim");

/** "10..20" vira 10,11,...,20; numeros soltos entram como estao. */
const sementes: number[] = [];
for (const a of args) {
  if (a.startsWith("--")) continue;
  const intervalo = a.match(/^(\d+)\.\.(\d+)$/);
  if (intervalo) {
    for (let i = Number(intervalo[1]); i <= Number(intervalo[2]); i++) sementes.push(i);
  } else if (/^\d+$/.test(a)) {
    sementes.push(Number(a));
  }
}

if (sementes.length === 0) {
  console.error("uso: npx tsx scripts/produzir.mts <semente> [mais sementes] [10..20]");
  console.error("     --segundos=30   duracao alvo da luta");
  console.error("     --so-auditar    audita e nao renderiza");
  console.error("     --mesmo-assim   renderiza mesmo com reprovacao");
  process.exit(1);
}

mkdirSync(SAIDA, { recursive: true });

/** Roda um validador e devolve a ultima linha (o veredito) mais se passou. */
const auditar = (semente: number, validador: string) => {
  const r = spawnSync(
    "npx",
    ["tsx", `scripts/${validador}.mts`, `gerada:${semente}`],
    { cwd: RAIZ, encoding: "utf8", shell: true },
  );
  const saida = `${r.stdout ?? ""}${r.stderr ?? ""}`.trim().split("\n");
  const veredito = saida.filter((l) => l.trim()).pop() ?? "(sem saida)";
  /*
    O VEREDITO E O TEXTO, e nao so o codigo de saida.

    Com `shell: true` o codigo que chega aqui e o do shell e nao o do script,
    e vinha zero mesmo com o validador escrevendo REPROVADO. Na primeira
    rodada isto aprovou doze sementes que os validadores tinham reprovado --
    exatamente o erro que este script existe para evitar.
  */
  const reprovou = /REPROVADO/i.test(saida.join("\n"));
  return { ok: r.status === 0 && !reprovou, veredito };
};

const rodar = (cmd: string, argv: string[]) =>
  execFileSync(cmd, argv, { cwd: RAIZ, stdio: "inherit", shell: true });

const aprovadas: number[] = [];
const reprovadas: { semente: number; motivo: string }[] = [];

for (const semente of sementes) {
  console.log(`\n=== semente ${semente} ===`);
  let passou = true;
  for (const v of VALIDADORES) {
    const { ok, veredito } = auditar(semente, v);
    console.log(`  ${v.padEnd(10)} ${ok ? "ok" : "REPROVOU"}  ${veredito}`);
    if (!ok) {
      passou = false;
      reprovadas.push({ semente, motivo: `${v}: ${veredito}` });
      if (!ignorarAuditoria) break;
    }
  }
  if (!passou && !ignorarAuditoria) {
    console.log(`  -> pulada (use --mesmo-assim para renderizar assim mesmo)`);
    continue;
  }
  if (!passou) console.log(`  -> reprovou, mas renderizando (--mesmo-assim)`);
  aprovadas.push(semente);
  if (soAuditar) continue;

  const mp4 = join(SAIDA, `luta-${semente}.mp4`);
  const leve = join(SAIDA, `luta-${semente}-leve.mp4`);
  /*
    AS PROPS VAO POR ARQUIVO, e nao na linha de comando.

    `--props={"seed":3}` entre aspas nao sobrevive: o comando roda com
    `shell: true` e o shell come as aspas do JSON antes do Remotion ver. O
    Remotion aceita um caminho de arquivo no lugar do JSON, e arquivo nao tem
    problema de escape em shell nenhum.
  */
  const propsJson = join(SAIDA, `props-${semente}.json`);
  writeFileSync(propsJson, JSON.stringify({ seed: semente, segundos }));
  console.log(`  renderizando -> ${mp4}`);
  rodar("node", [
    "scripts/remotion.mjs",
    "render",
    "src/index.ts",
    "Luta",
    mp4,
    `--props=${propsJson}`,
    "--concurrency=4",
  ]);
  /*
    A copia leve e so para conferir. CRF 26 contra o 12 do master: o arquivo
    cai para cerca de um quarto e continua legivel num celular.
  */
  console.log(`  copia leve -> ${leve}`);
  rodar("ffmpeg", [
    "-y", "-v", "error", "-i", mp4,
    "-c:v", "libx264", "-crf", "26", "-preset", "slow",
    "-c:a", "aac", "-b:a", "128k", leve,
  ]);
}

console.log(`\n================ RESUMO ================`);
console.log(`aprovadas: ${aprovadas.length}/${sementes.length}  ${aprovadas.join(", ")}`);
if (reprovadas.length) {
  console.log(`reprovadas:`);
  for (const r of reprovadas) console.log(`  ${r.semente}: ${r.motivo}`);
}
if (!soAuditar && aprovadas.length) {
  console.log(`\narquivos em ${SAIDA}`);
  console.log(`sobe o luta-<n>.mp4; o -leve e so para conferir.`);
}
if (existsSync(SAIDA) && aprovadas.length === 0) {
  console.log(`\nnenhuma semente passou. tente outras: npx tsx scripts/produzir.mts 100..120 --so-auditar`);
}
