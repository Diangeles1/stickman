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
import { dirname, join } from "node:path";
import { compilar } from "../src/core/timeline";
import { duelo, dueloDoDia, historiaDe, type Duelo } from "../src/data/fights/diario";
import { duracaoDoPrototipo } from "../src/compositions/Prototype";

const RAIZ = join(import.meta.dirname, "..");
const SAIDA = join(RAIZ, "out", "diario");

/**
 * Os validadores que BLOQUEIAM a producao.
 *
 * `pes` ENTROU na lista. Ele ficava de fora porque reprovava em todo video
 * publicado -- 60 a 132 unidades de patinacao -- e bloquear por ele pararia a
 * producao todo dia sem informacao nova. Isso deixou de ser verdade quando a
 * soltura do pe virou passo e o limitador rente ao chao foi separado em dois
 * (ver animation/corpo): as 48 combinacoes que o calendario pode produzir
 * passam. Validador que passa sempre tem que bloquear, senao a melhoria se
 * perde na primeira regressao.
 *
 * `cadeia` continua de fora, e nao por conveniencia: o defeito e conhecido,
 * medido e documentado, e a causa e o preset de pose segurada em 2s (ver a
 * nota em scripts/cadeia.mts e em animation/estilo). Trocar o preset custaria
 * o visual de desenho a mao, que e o que o canal quer.
 */
/*
  `defesa` NAO OLHA A DATA: ele audita os ROTEIROS, que sao os mesmos todo
  dia. Roda aqui mesmo assim, e de proposito -- validador que nao esta no
  caminho de ninguem apodrece, e o custo de repeti-lo e de milissegundos.
*/
const BLOQUEIAM = ["contato", "qualidade", "arcos", "coreografia", "pes", "defesa"];
const INFORMAM = ["cadeia"];

const args = process.argv.slice(2);
const opcao = (n: string, p: string) =>
  args.find((a) => a.startsWith(`--${n}=`))?.split("=")[1] ?? p;
const temFlag = (n: string) => args.includes(`--${n}`);
const soAuditar = temFlag("so-auditar");
const proximos = Number(opcao("proximos", "1"));

const dataPedida = args.find((a) => /^\d{4}-\d{2}-\d{2}$/.test(a));
const base = dataPedida ? new Date(`${dataPedida}T12:00:00Z`) : new Date();

/*
  NADA AQUI PASSA POR SHELL, e isso nao e preferencia de estilo.

  As chamadas eram `npx.cmd ... { shell: true }` e morriam com
  `spawnSync C:\Windows\system32\cmd.exe ENOENT`: no Windows `shell: true`
  manda tudo para o cmd.exe, e um ambiente cujo PATH nao tem System32 nao tem
  cmd.exe. O erro chegava como "o render falhou, status 1, stdout null" --
  acusando a ferramenta que nem tinha sido chamada.
  E quando o cmd.exe existe ele reparte os argumentos de novo: foi ele que
  cortou a URL do OAuth no `&` (ver scripts/youtube.mts).

  Chamar o JS da ferramenta com o proprio node nao depende de shell, nem de
  PATH, nem de como o cmd.exe entende aspas.
*/
const node = process.execPath;
/** o CLI do Remotion e dependencia do projeto: da para chamar o arquivo */
const REMOTION = join(RAIZ, "node_modules", "@remotion", "cli", "remotion-cli.js");
/** o tsx vem pelo npx, e o npx tambem e um .js ao lado do node */
const NPX = join(dirname(node), "node_modules", "npm", "bin", "npx-cli.js");
const comTsx = (args: string[]) => [NPX, "tsx", ...args];

const audita = (chave: string, validador: string) => {
  const r = spawnSync(node, comTsx([join("scripts", `${validador}.mts`), chave]), {
    cwd: RAIZ,
    encoding: "utf8",
  });
  const saida = `${r.stdout ?? ""}${r.stderr ?? ""}`;
  const linha = saida.split("\n").reverse().find((l) => /APROVADO|REPROVADO/.test(l)) ?? "(sem veredito)";
  return { ok: /APROVADO/.test(linha), linha: linha.trim() };
};

const titulo = (d: Duelo) => `${d.nomeA} vs ${d.nomeB} — quem vence? #shorts`;
/*
  A DESCRICAO CONTA A HISTORIA DO DIA, e nao "o Duelo do Vale" sempre.

  Enquanto havia um cenario so, a frase fixa era verdade. Com os palcos
  girando ela viraria mentira em seis dias de cada sete -- e descricao que
  nao bate com o video e a primeira coisa que o espectador usa para decidir
  que o canal e automatico.
*/
const descricao = (d: Duelo) => {
  const { tema, lugar } = historiaDe(d);
  return [
    `${d.nomeA} contra ${d.nomeB} ${lugar}: ${tema}!`,
    "",
    "Escolhe o teu personagem no comecinho e comenta quem voce acha que ganha.",
    "Comenta tambem o nome de quem voce quer ver lutar no proximo — a gente usa!",
    "",
    "Novo duelo todo dia no Palitanos.",
  ].join("\n");
};

if (!existsSync(SAIDA)) mkdirSync(SAIDA, { recursive: true });

/** dias que renderizaram mas nao subiram (ver o veredito no fim do arquivo) */
const naoPublicados: string[] = [];

for (let k = 0; k < Math.max(1, proximos); k++) {
  const data = new Date(base.getTime() + k * 86400000);
  const iso = data.toISOString().slice(0, 10);
  const q = dueloDoDia(data);
  const spec = duelo(q);
  const t = compilar(spec);
  const dur = duracaoDoPrototipo(spec, { escolha: true }) / spec.fps;
  const vencedor = q.venceA ? q.nomeA : q.nomeB;

  console.log(`\n=== ${iso}  ${q.nomeA} vs ${q.nomeB}  (vence ${vencedor})`);
  console.log(`    roteiro ${q.roteiro}  palco ${q.palco}  elenco ${q.elenco}`);
  console.log(`    ${dur.toFixed(1)}s com a tela de escolha, ${t.poderes.length} efeitos`);

  /*
    A AUDITORIA LE A LUTA PELA DATA, e nao mais pelo roteiro.

    Enquanto so o roteiro girava, auditar "o roteiro de amanha com o elenco
    de hoje" dava a mesma resposta. Com o elenco girando nao da: corpos
    diferentes tem espessura diferente, e a distancia de combate deriva da
    espessura do traco (ver distanciaDeCombate). Auditar outro elenco e
    auditar outra luta -- e "auditei a luta errada" e o erro que fez
    scripts/lutas.mts existir.
  */
  const chave = `dia:${iso}`;
  let bloqueado = false;

  /*
    PASSAR DE 60s BLOQUEIA, e nao avisa.

    Era um aviso impresso no meio do relatorio, e aviso em producao
    automatica e a mesma coisa que nada: ninguem le a saida de um comando
    que deu certo. O Shorts corta em 60 -- um video de 61s nao fica um
    segundo mais longo, ele deixa de ser Short.
  */
  if (dur > 60) {
    console.log(`    FALHA duracao     ${dur.toFixed(1)}s passa dos 60s do Shorts`);
    bloqueado = true;
  }
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
      `PALCO       ${q.palco}`,
      `ELENCO      ${q.elenco}`,
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
  const propsJson = join(SAIDA, `${nome}-props.json`);
  writeFileSync(propsJson, JSON.stringify({ data: iso }), "utf8");
  console.log("    renderizando...");
  /*
    A DATA VAI NAS PROPS. A composicao usa o relogio quando ninguem pede, e
    isso renderizaria a luta de HOJE com o titulo da data pedida -- um erro
    que nao aparece em lugar nenhum ate o video estar publicado.
  */
  /*
    O RENDER TEM TRES TENTATIVAS, e isto nasceu de falhas de verdade.

    O duelo de 2026-10-05 morreu com status 1 e nenhuma saida; rodando o MESMO
    comando em seguida, funcionou. Numa execucao manual isso e um
    aborrecimento: roda de novo. Numa tarefa diaria e um dia sem video, e
    ninguem fica sabendo ate olhar o canal.

    E NAO E O `--timeout` ABAIXO QUE RESOLVE ISSO -- aqui estava escrito que
    era, e o log do agendador desmente: a flag vai em 180000 e o erro continua
    sendo "Timed out after 25000 ms while trying to connect to the browser".
    Sao dois limites diferentes. `--timeout` e o de delayRender; o que estoura
    e o de CONECTAR no Chrome, que esta fixo em 25000 dentro de
    @remotion/renderer (open-browser.js) e nao tem flag nem variavel de
    ambiente. Nao da para levantar sem remendar a dependencia.

    Entao a repeticao e a unica alavanca, e ela e medida: em sete dias de
    agendador, CINCO primeiras tentativas estouraram esse limite e quatro
    foram salvas pela segunda. A que nao foi, 09/10, perdeu o dia inteiro --
    ficou so o .txt na pasta, sem mp4. Com tres tentativas aquele dia teria
    saido; o custo quando nada trava continua sendo zero.
  */
  const renderizar = () =>
    execFileSync(
      node,
      [
        REMOTION,
        "render",
        "src/index.ts",
        "DueloDoDia",
        cru,
        // as props vao por ARQUIVO, e nao na linha de comando: no Windows o
        // shell come as aspas do JSON e o render morre sem explicar
        `--props=${propsJson}`,
        "--concurrency=4",
        // limite do delayRender: o padrao de 30s nao chega com a maquina
        // ocupada, e o custo de um limite alto e zero quando nada trava.
        // (NAO e este o limite que derruba o render aqui -- ver a nota acima)
        "--timeout=180000",
        "--log=error",
      ],
      { cwd: RAIZ, stdio: "inherit" },
    );
  const TENTATIVAS = 3;
  for (let tentativa = 1; ; tentativa++) {
    try {
      renderizar();
      break;
    } catch (erro) {
      if (tentativa >= TENTATIVAS) {
        console.error(`    o render falhou ${TENTATIVAS} vezes; ${nome} ficou sem video.`);
        throw erro;
      }
      console.log(`    o render falhou; tentativa ${tentativa + 1} de ${TENTATIVAS}...`);
    }
  }

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
    const envio = spawnSync(
      node,
      comTsx([join("scripts", "youtube.mts"), "publicar", mp4, ...extra]),
      { cwd: RAIZ, stdio: "inherit" },
    );
    /*
      UM ENVIO QUE FALHA TEM QUE DOER.

      O resultado deste spawnSync era descartado, e `youtube.mts` sai com 2
      quando nao consegue nem renovar o acesso. O produtor seguia em frente e
      terminava com "codigo 0": o log do agendador dizia que o dia tinha dado
      certo logo abaixo da linha que dizia que o token estava revogado.

      Custou SEIS DIAS sem post. O refresh token foi criado em 02/10 e expirou
      em 09/10 -- sete dias, que e o prazo do Google para app com a tela de
      consentimento em "Testing". Os dias 10, 11 e 13 renderizaram, falharam
      ao subir e foram registrados como sucesso; ninguem tinha motivo para
      abrir o log.

      Render que falha se descarta e se tenta de novo. ENVIO que falha deixa o
      canal sem post naquele dia, e e a unica etapa aqui cujo prejuizo nao da
      para recuperar depois sem alguem perceber. Entao ela grita, e o codigo
      de saida leva a falha para quem chamou -- inclusive para o agendador.
    */
    if (envio.status !== 0) {
      console.error(
        `    FALHOU AO PUBLICAR ${nome}.mp4 (codigo ${envio.status ?? "?"}).` +
          `
    O video esta pronto em out/diario/${nome}.mp4 e NAO foi para o canal.`,
      );
      naoPublicados.push(nome);
    }
  }
}

/*
  O VEREDITO FINAL, depois de todos os dias.

  Vem no fim e nao no meio do laco porque `--proximos=7` produz uma semana: o
  que importa saber e quantos dias ficaram sem subir, nao parar no primeiro.
*/
if (naoPublicados.length > 0) {
  console.error(
    `
${naoPublicados.length} video(s) NAO foram publicados: ${naoPublicados.join(", ")}` +
      `
Os arquivos estao em out/diario/. Se a causa foi o acesso do Google,` +
      `
reautorize com: npx tsx scripts/youtube.mts login`,
  );
  process.exitCode = 1;
}

console.log(`\nTextos e instrucoes de cada dia em out/diario/*.txt`);
