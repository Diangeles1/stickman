/**
 * PUBLICAR NO YOUTUBE sem navegador e sem teto de tamanho.
 *
 * A automacao de navegador nao serve para isto, e nao por falta de tentativa:
 * a ponte de arquivo deste ambiente tem teto de 10 MB e um master tem ~55; um
 * encode que cabe nos 10 MB mede SSIM 0,985 contra o master, a mesma faixa da
 * versao que ja gerou reclamacao de qualidade neste canal. E o proprio
 * dialogo de envio do Studio nao abre sob automacao -- aceita o clique e nao
 * aparece, com dois timeouts de 30s no caminho.
 *
 * A YouTube Data API nao tem nenhum desses problemas: envia o arquivo
 * inteiro, em partes, direto. A cota padrao da 6 envios por dia (cada um
 * custa 1600 de 10.000 unidades), folgada para um video diario.
 *
 * SEM DEPENDENCIA NENHUMA. Tudo aqui e `fetch` e `node:fs` -- OAuth e upload
 * resumivel sao HTTP comum. Instalar um SDK para tres chamadas seria mais
 * coisa para manter e mais coisa para quebrar.
 *
 * ---------------------------------------------------------------------------
 * O QUE SO VOCE PODE FAZER (uma vez, ~3 minutos)
 *
 *   1. console.cloud.google.com -> criar um projeto (nome qualquer)
 *   2. "APIs e servicos" -> "Ativar APIs" -> ativar YOUTUBE DATA API V3
 *   3. "Credenciais" -> "Criar credenciais" -> "ID do cliente OAuth"
 *        tipo de aplicativo: APLICATIVO PARA COMPUTADOR
 *      (se pedir a tela de consentimento antes: tipo EXTERNO, preenche nome
 *       e email, e em "Usuarios de teste" adiciona o seu proprio email --
 *       sem isso o Google recusa a autorizacao de um app nao verificado)
 *   4. baixar o JSON e salvar como  credenciais/youtube-cliente.json
 *
 * Nada disso eu posso fazer por voce: e a sua conta, e credencial nao se
 * cria por procuracao.
 *
 * ---------------------------------------------------------------------------
 * DEPOIS DISSO
 *
 *   npx tsx scripts/youtube.mts login
 *       abre o navegador uma vez, voce autoriza, e o refresh token fica
 *       salvo em credenciais/youtube-token.json. Nao precisa repetir.
 *
 *   npx tsx scripts/youtube.mts publicar out/diario/palitanos-2026-10-02.mp4
 *       envia o video, poe a capa e publica. Le titulo e descricao do .txt
 *       que o scripts/diario.mts deixou ao lado do arquivo.
 *
 *   ...publicar <video> --privado      sobe sem publicar, para conferir antes
 *   ...publicar <video> --agendar=2026-10-05T09:00:00Z
 */

import { createReadStream, existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { createServer } from "node:http";
import { basename, join } from "node:path";
import { spawn } from "node:child_process";

const RAIZ = join(import.meta.dirname, "..");
const PASTA = join(RAIZ, "credenciais");
const CLIENTE = join(PASTA, "youtube-cliente.json");
const TOKEN = join(PASTA, "youtube-token.json");

/**
 * `youtube.upload` envia; `youtube` poe a capa.
 *
 * Sao os dois menores escopos que fazem o trabalho. Pedir `force-ssl` (que
 * da acesso a comentarios, playlists e exclusao) seria pedir muito mais
 * poder do que publicar um Short exige.
 */
const ESCOPOS = [
  "https://www.googleapis.com/auth/youtube.upload",
  "https://www.googleapis.com/auth/youtube",
].join(" ");

const PORTA = 8731;

type Cliente = { client_id: string; client_secret: string };

const lerCliente = (): Cliente => {
  if (!existsSync(CLIENTE)) {
    console.error(
      [
        "",
        `FALTA ${CLIENTE.replace(RAIZ + "\\", "").replace(RAIZ + "/", "")}`,
        "",
        "E o JSON de credenciais do Google Cloud. Como obter esta no cabecalho",
        "deste arquivo (scripts/youtube.mts) -- sao quatro passos e so voce pode",
        "fazer: e a sua conta.",
        "",
      ].join("\n"),
    );
    process.exit(2);
  }
  const bruto = JSON.parse(readFileSync(CLIENTE, "utf8"));
  // o Google entrega o JSON embrulhado em "installed" ou "web"
  const c = bruto.installed ?? bruto.web ?? bruto;
  if (!c.client_id || !c.client_secret) {
    console.error("O JSON nao tem client_id/client_secret. Baixou o arquivo certo?");
    process.exit(2);
  }
  return { client_id: c.client_id, client_secret: c.client_secret };
};

const abrirNavegador = (url: string) => {
  /*
    NO WINDOWS NAO SE ABRE URL COM `cmd /c start`.

    O cmd.exe trata `&` como separador de comando, e uma URL de OAuth e toda
    feita de `&`. Medido: a URL chegava cortada no primeiro parametro e o
    Google respondia "Required parameter is missing: response_type" -- um erro
    que parece de codigo e e de shell.

    `rundll32 url.dll,FileProtocolHandler` recebe a URL inteira como um
    argumento so, sem reinterpretar nada.
  */
  const cmd =
    process.platform === "win32"
      ? "rundll32"
      : process.platform === "darwin"
        ? "open"
        : "xdg-open";
  const args =
    process.platform === "win32" ? ["url.dll,FileProtocolHandler", url] : [url];
  try {
    spawn(cmd, args, { detached: true, stdio: "ignore" }).unref();
  } catch {
    /* sem navegador: o link impresso resolve */
  }
};

/** Primeira autorizacao: devolve e salva o refresh token. */
const login = async () => {
  const cliente = lerCliente();
  const redirect = `http://localhost:${PORTA}`;
  const url =
    "https://accounts.google.com/o/oauth2/v2/auth?" +
    new URLSearchParams({
      client_id: cliente.client_id,
      redirect_uri: redirect,
      response_type: "code",
      scope: ESCOPOS,
      // offline + consent e o que garante o REFRESH token: sem ele a
      // autorizacao vence em uma hora e a publicacao diaria para sozinha
      access_type: "offline",
      /*
        `select_account` FORCA A ESCOLHA DE CONTA, e isso nao e preferencia.
        So com `consent` o Google usa a conta ja ativa no navegador, e quem
        tem mais de uma logada autoriza a errada sem perceber -- o video
        acaba publicado em outro canal. Aconteceu nesta maquina: o
        youtube.com/upload abriu numa conta sem permissao no canal.
      */
      prompt: "select_account consent",
    });

  const codigo = await new Promise<string>((resolve, reject) => {
    const servidor = createServer((req, res) => {
      const q = new URL(req.url ?? "/", redirect).searchParams;
      const erro = q.get("error");
      const code = q.get("code");
      res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
      res.end(
        `<meta charset="utf-8"><body style="font:16px system-ui;padding:40px">${
          code ? "Autorizado. Pode fechar esta aba." : `Falhou: ${erro ?? "sem codigo"}`
        }</body>`,
      );
      servidor.close();
      if (code) resolve(code);
      else reject(new Error(erro ?? "sem codigo"));
    });
    servidor.listen(PORTA, () => {
      console.log("\nAbrindo o navegador para voce autorizar...");
      console.log(`Se nao abrir, cole no navegador:\n${url}\n`);
      abrirNavegador(url);
    });
  });

  const r = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code: codigo,
      client_id: cliente.client_id,
      client_secret: cliente.client_secret,
      redirect_uri: redirect,
      grant_type: "authorization_code",
    }),
  });
  const dados = (await r.json()) as { refresh_token?: string; error_description?: string };
  if (!dados.refresh_token) {
    console.error("O Google nao devolveu refresh_token:", dados.error_description ?? dados);
    process.exit(2);
  }
  if (!existsSync(PASTA)) mkdirSync(PASTA, { recursive: true });
  writeFileSync(TOKEN, JSON.stringify({ refresh_token: dados.refresh_token }, null, 2), "utf8");
  console.log(`\nPronto. Token salvo em credenciais/youtube-token.json`);
  console.log("Nao precisa repetir: a partir daqui o publicar funciona sozinho.\n");
};

/** Troca o refresh token por um access token valido por uma hora. */
const acessar = async (): Promise<string> => {
  if (!existsSync(TOKEN)) {
    console.error("\nFalta autorizar. Rode primeiro:\n  npx tsx scripts/youtube.mts login\n");
    process.exit(2);
  }
  const cliente = lerCliente();
  const { refresh_token } = JSON.parse(readFileSync(TOKEN, "utf8"));
  const r = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: cliente.client_id,
      client_secret: cliente.client_secret,
      refresh_token,
      grant_type: "refresh_token",
    }),
  });
  const d = (await r.json()) as { access_token?: string; error_description?: string };
  if (!d.access_token) {
    console.error("Nao consegui renovar o acesso:", d.error_description ?? d);
    process.exit(2);
  }
  return d.access_token;
};

/**
 * Le o .txt que o scripts/diario.mts deixa ao lado do video.
 *
 * Os textos vivem naquele arquivo e nao aqui porque quem decide o titulo e a
 * producao do dia, nao o transporte. Assim da para corrigir uma descricao sem
 * tocar no codigo de upload.
 */
const lerPacote = (video: string) => {
  const txt = video.replace(/\.mp4$/, ".txt");
  if (!existsSync(txt)) return null;
  const linhas = readFileSync(txt, "utf8").split("\n");
  const secao = (nome: string) => {
    const i = linhas.findIndex((l) => l.trim() === nome);
    if (i < 0) return "";
    const fim = linhas.findIndex((l, k) => k > i && /^[A-Z-]{5,}\s*$/.test(l.trim()));
    return linhas
      .slice(i + 1, fim < 0 ? undefined : fim)
      .join("\n")
      .trim();
  };
  return { titulo: secao("TITULO").split("\n")[0], descricao: secao("DESCRICAO") };
};

const publicar = async (video: string) => {
  if (!existsSync(video)) {
    console.error(`nao achei ${video}`);
    process.exit(2);
  }
  const args = process.argv.slice(2);
  const privado = args.includes("--privado");
  const agendar = args.find((a) => a.startsWith("--agendar="))?.split("=")[1];

  const pacote = lerPacote(video);
  const titulo = pacote?.titulo || basename(video, ".mp4");
  const descricao = pacote?.descricao || "";
  const capa = video.replace(/\.mp4$/, ".png");

  const token = await acessar();
  const tamanho = statSync(video).size;

  const metadados = {
    snippet: {
      title: titulo,
      description: descricao,
      categoryId: "20", // Jogos
      tags: ["shorts", "stickman", "palitanos", "animacao", "luta"],
    },
    status: {
      // agendado entra como privado ate a hora marcada: e assim que a API faz
      privacyStatus: agendar ? "private" : privado ? "private" : "public",
      ...(agendar ? { publishAt: agendar } : {}),
      selfDeclaredMadeForKids: false,
    },
  };

  console.log(`\nenviando ${basename(video)} (${(tamanho / 1048576).toFixed(1)} MB)`);
  console.log(`titulo: ${titulo}`);

  // 1. abre a sessao resumivel
  const inicio = await fetch(
    "https://www.googleapis.com/upload/youtube/v3/videos?uploadType=resumable&part=snippet,status",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        "X-Upload-Content-Length": String(tamanho),
        "X-Upload-Content-Type": "video/mp4",
      },
      body: JSON.stringify(metadados),
    },
  );
  const destino = inicio.headers.get("location");
  if (!inicio.ok || !destino) {
    console.error("falhou ao abrir o envio:", inicio.status, await inicio.text());
    process.exit(1);
  }

  // 2. manda os bytes
  const envio = await fetch(destino, {
    method: "PUT",
    headers: { "Content-Length": String(tamanho), "Content-Type": "video/mp4" },
    body: createReadStream(video) as unknown as BodyInit,
    // @ts-expect-error duplex e exigido pelo Node para corpo em streaming
    duplex: "half",
  });
  const resposta = (await envio.json()) as { id?: string; error?: { message?: string } };
  if (!envio.ok || !resposta.id) {
    console.error("falhou no envio:", envio.status, resposta.error?.message ?? resposta);
    process.exit(1);
  }
  const id = resposta.id;
  console.log(`enviado: https://youtube.com/shorts/${id}`);

  // 3. a capa
  if (existsSync(capa)) {
    const r = await fetch(
      `https://www.googleapis.com/upload/youtube/v3/thumbnails/set?videoId=${id}`,
      {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "image/png" },
        body: readFileSync(capa),
      },
    );
    console.log(r.ok ? "capa trocada" : `capa falhou: ${await r.text()}`);
  } else {
    console.log("sem capa ao lado do video (esperava .png com o mesmo nome)");
  }

  if (agendar) console.log(`agendado para ${agendar}`);
  else if (privado) console.log("subiu como PRIVADO: publique pelo Studio quando quiser");
  else console.log("publicado");
};

const comando = process.argv[2];
if (comando === "login") await login();
else if (comando === "publicar" && process.argv[3]) await publicar(process.argv[3]);
else {
  console.log(
    [
      "",
      "uso:",
      "  npx tsx scripts/youtube.mts login",
      "  npx tsx scripts/youtube.mts publicar <video.mp4> [--privado] [--agendar=ISO]",
      "",
      "O cabecalho deste arquivo explica o cadastro de 3 minutos no Google Cloud",
      "que precisa ser feito uma unica vez.",
      "",
    ].join("\n"),
  );
}
