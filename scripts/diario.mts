/**
 * O VIDEO DO DIA: de uma data a um arquivo pronto para publicar.
 *
 * Um comando. Ele escolhe o duelo da data (nomes, roteiro, vencedor e
 * chamada -- ver src/data/fights/diario.ts), AUDITA antes de gastar minutos
 * renderizando, renderiza, normaliza o audio para o nivel das plataformas e
 * deixa capa e textos prontos ao lado do arquivo.
 *
 * A AUDITORIA VEM PRIMEIRO, e e isso que torna a producao diaria possivel:
 * os validadores rodam sobre a timeline compilada em segundos, e um duelo
 * reprovado e pulado com o motivo no relatorio. Nenhum video precisa ser
 * assistido para ser conferido -- se tivesse que ser, "um por dia" seria uma
 * promessa que ninguem cumpre.
 *
 * PUBLICAR E OPCIONAL: com `--publicar` ele sobe pela YouTube Data API (ver
 * scripts/youtube.mts, que precisa de um cadastro unico no Google Cloud).
 * Sem a flag ele so produz, porque um comando que renderiza nao deve publicar
 * de surpresa: erro de render se descarta, video publicado ja foi visto.
 *
 * Uso:
 *   npx tsx scripts/diario.mts                 o duelo de hoje
 *   npx tsx scripts/diario.mts 2026-10-05      o de uma data
 *   npx tsx scripts/diario.mts --proximos=7    audita a proxima semana
 *   npx tsx scripts/diario.mts --so-auditar
 *   npx tsx scripts/diario.mts --publicar             produz E publica
 *   npx tsx scripts/diario.mts --publicar --privado   sobe para conferir
 */

import { execFileSync, spawnSync } from "node:child_process";
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { compilar } from "../src/core/timeline";
import { duelo, dueloDoDia, type Duelo } from "../src/data/fights/diario";
import { duracaoDoPrototipo } from "../src/compositions/Prototype";

const RAIZ = join(import.meta.dirname, "..");
const SAIDA = join(RAIZ, "out", "diario");

/**
 * Os validadores que BLOQUEIAM a producao.
 *
 * `pes` e `cadeia` ficam de fora de proposito, e nao por conveniencia: os
 * dois tem defeito conhecido, medido e documentado (ver a nota em
 * scripts/cadeia.mts e o conflito entre pose segurada e apoio em
 * animation/estilo). Bloquear por eles pararia a producao todo dia sem
 * informacao nova; o relatorio continua imprimindo os dois.
 */
const BLOQUEIAM = ["contato", "qualidade", "arcos", "coreografia"];
const INFORMAM = ["pes", "cadeia"];

const args = process.argv.slice(2);
const opcao = (n: string, p: string) =>
  args.find((a) => a.startsWith(`--${n}=`))?.split("=")[1] ?? p;
const temFlag = (n: string) => args.includes(`--${n}`);
const soAuditar = temFlag("so-auditar");
const proximos = Number(opcao("proximos", "1"));

const dataPedida = args.find((a) => /^\d{4}-\d{2}-\d{2}$/.test(a));
const base = dataPedida ? new Date(`${dataPedida}T12:00:00Z`) : new Date();

const npx = process.platform === "win32" ? "npx.cmd" : "npx";

const audita = (chave: string, validador: string) => {
  const r = spawnSync(npx, ["tsx", join("scripts", `${validador}.mts`), chave], {
    cwd: RAIZ,
    encoding: "utf8",
    shell: process.platform === "win32",
  });
  const saida = `${r.stdout ?? ""}${r.stderr ?? ""}`;
  const linha = saida.split("\n").reverse().find((l) => /APROVADO|REPROVADO/.test(l)) ?? "(sem veredito)";
  return { ok: /APROVADO/.test(linha), linha: linha.trim() };
};

const titulo = (d: Duelo) => `${d.nomeA} vs ${d.nomeB} — quem vence? #shorts`;
const descricao = (d: Duelo) =>
  [
    `${d.nomeA} contra ${d.nomeB} no Duelo do Vale!`,
    "",
    "Escolhe o teu personagem no comecinho e comenta quem voce acha que ganha.",
    "Comenta tambem o nome de quem voce quer ver lutar no proximo — a gente usa!",
    "",
    "Novo duelo todo dia no Palitanos.",
  ].join("\n");

if (!existsSync(SAIDA)) mkdirSync(SAIDA, { recursive: true });

for (let k = 0; k < Math.max(1, proximos); k++) {
  const data = new Date(base.getTime() + k * 86400000);
  const iso = data.toISOString().slice(0, 10);
  const q = dueloDoDia(data);
  const spec = duelo(q);
  const t = compilar(spec);
  const dur = duracaoDoPrototipo(spec, { escolha: true }) / spec.fps;
  const vencedor = q.venceA ? q.nomeA : q.nomeB;

  console.log(`\n=== ${iso}  ${q.nomeA} vs ${q.nomeB}  (roteiro ${q.roteiro}, vence ${vencedor})`);
  console.log(`    ${dur.toFixed(1)}s com a tela de escolha, ${t.poderes.length} efeitos`);
  if (dur > 60) console.log("    ATENCAO: passa de 60s");

  // a auditoria le a luta pela chave "dia:<roteiro>", e so vale para HOJE;
  // para outras datas ela confere o ROTEIRO, que e o que pode quebrar
  const chave = `dia:${q.roteiro}`;
  let bloqueado = false;
  for (const v of BLOQUEIAM) {
    const { ok, linha } = audita(chave, v);
    console.log(`    ${ok ? "ok  " : "FALHA"} ${v.padEnd(12)} ${linha}`);
    if (!ok) bloqueado = true;
  }
  for (const v of INFORMAM) {
    const { linha } = audita(chave, v);
    console.log(`    nota  ${v.padEnd(12)} ${linha}`);
  }

  const nome = `palitanos-${iso}`;
  writeFileSync(
    join(SAIDA, `${nome}.txt`),
    [
      `DATA        ${iso}`,
      `ARQUIVO     out/diario/${nome}.mp4`,
      `CAPA        out/diario/${nome}.png`,
      `DURACAO     ${dur.toFixed(1)}s`,
      `VENCE       ${vencedor}`,
      `ROTEIRO     ${q.roteiro}`,
      "",
      "TITULO",
      titulo(q),
      "",
      "DESCRICAO",
      descricao(q),
      "",
      "PUBLICO-ALVO  Nao, nao e feito para criancas",
      "  (conteudo marcado como infantil tem os comentarios DESATIVADOS, e a",
      "   chamada do video inteiro pede comentario)",
      "VISIBILIDADE  Publico",
    ].join("\n"),
    "utf8",
  );

  if (bloqueado) {
    console.log("    PULADO: um validador que bloqueia reprovou.");
    continue;
  }
  if (soAuditar) continue;

  const mp4 = join(SAIDA, `${nome}.mp4`);
  const cru = join(SAIDA, `${nome}-cru.mp4`);
  console.log("    renderizando...");
  execFileSync(
    npx,
    ["remotion", "render", "src/index.ts", "DueloDoDia", cru, "--concurrency=4", "--log=error"],
    { cwd: RAIZ, stdio: "inherit", shell: process.platform === "win32" },
  );

  /*
    O AUDIO SOBE PARA -14 LUFS, que e onde YouTube e TikTok normalizam. O
    motor entrega por volta de -20, e a 6 LU abaixo do feed o video toca mais
    baixo que os vizinhos -- o espectador le isso como "fraco" sem saber por
    que.
  */
  const ffmpeg = execFileSync(
    process.execPath,
    ["-e", "try{console.log(require('@remotion/compositor-win32-x64-msvc/ffmpeg').ffmpegPath)}catch(e){console.log('ffmpeg')}"],
    { encoding: "utf8" },
  ).trim();
  execFileSync(
    ffmpeg,
    ["-y", "-i", cru, "-c:v", "copy", "-af", "loudnorm=I=-14:TP=-1.5:LRA=11", "-c:a", "aac", "-b:a", "320k", mp4, "-loglevel", "error"],
    { stdio: "inherit" },
  );
  /*
    A CAPA E A TELA DE ESCOLHA, e nao um quadro da luta. O quadro automatico
    do YouTube ja saiu uma vez com o vencedor caido -- entregando o final na
    miniatura. A tela de escolha faz o oposto: mostra os dois nomes e a
    pergunta.
  */
  execFileSync(
    ffmpeg,
    ["-y", "-ss", "2.6", "-i", mp4, "-frames:v", "1", join(SAIDA, `${nome}.png`), "-loglevel", "error"],
    { stdio: "inherit" },
  );
  console.log(`    pronto: out/diario/${nome}.mp4`);

  /*
    PUBLICAR E OPCIONAL E EXPLICITO.

    `--publicar` sobe pela YouTube Data API (scripts/youtube.mts). Sem a
    flag, o script so produz -- porque publicar e irreversivel e um comando
    que renderiza NAO deve publicar de surpresa. Um erro de render se
    descarta; um video publicado por engano ja foi visto.
  */
  if (temFlag("publicar")) {
    console.log("    publicando...");
    const extra = args.filter((a) => a === "--privado" || a.startsWith("--agendar="));
    spawnSync(npx, ["tsx", join("scripts", "youtube.mts"), "publicar", mp4, ...extra], {
      cwd: RAIZ,
      stdio: "inherit",
      shell: process.platform === "win32",
    });
  }
}

console.log(`\nTextos e instrucoes de cada dia em out/diario/*.txt`);
