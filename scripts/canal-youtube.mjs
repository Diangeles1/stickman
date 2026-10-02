/**
 * PERSONALIZA O CANAL DO YOUTUBE: sobe banner, avatar e descricao.
 *
 * RODA NA SUA MAQUINA, nao na nuvem. Ele usa o SEU Chrome, com o SEU perfil
 * ja logado: nenhuma senha passa por aqui, e nenhum dado seu sai do seu
 * computador. E por isso mesmo que ele nao roda na sessao da nuvem, que nao
 * tem o seu login.
 *
 * ---------------------------------------------------------------------------
 * ANTES DE RODAR, TRES COISAS
 *
 * 1. FECHE O CHROME POR COMPLETO. O Chrome nao deixa dois programas usarem o
 *    mesmo perfil ao mesmo tempo; com ele aberto, o script abre uma janela
 *    sem o seu login e nada funciona.
 * 2. INSTALE O PLAYWRIGHT:  npm i -D playwright
 * 3. O YouTube muda a tela do Studio de tempos em tempos, e os nomes dos
 *    botoes mudam com o idioma. Este script procura o botao por varios nomes
 *    (portugues e ingles), mas se o YouTube mudar a tela ele PARA e tira uma
 *    foto em canal-youtube-erro.png, em vez de clicar em algo errado.
 *
 * ---------------------------------------------------------------------------
 * COMO USAR
 *
 *   node scripts/canal-youtube.mjs --canal SEU_CHANNEL_ID
 *
 * O CHANNEL_ID esta no endereco do Studio quando voce entra nele:
 *   studio.youtube.com/channel/UCxxxxxxxxxxxxxxxxxx/editing/images
 *                              ^^^^^^^^^^^^^^^^^^^^ e isto
 *
 * Opcoes:
 *   --canal ID        obrigatorio
 *   --perfil CAMINHO  pasta do perfil do Chrome (o padrao acerta na maioria)
 *   --so-imagens      so banner e avatar, nao mexe na descricao
 *   --so-texto        so a descricao
 *   --publicar        publica sem perguntar (o padrao e perguntar antes)
 *   --ver             mostra o navegador trabalhando (recomendado na 1a vez)
 */

import { existsSync } from "node:fs";
import { homedir, platform } from "node:os";
import { join } from "node:path";
import { createInterface } from "node:readline/promises";
import { fileURLToPath } from "node:url";
import { dirname } from "node:path";

const AQUI = dirname(fileURLToPath(import.meta.url));
const RAIZ = join(AQUI, "..");

// ---- o que vai para o canal -------------------------------------------------
// Troque os textos aqui; as imagens sao as que o projeto gera (npm run canal).

const BANNER = join(RAIZ, "out", "canal", "Banner.png");
const AVATAR = join(RAIZ, "out", "canal", "Avatar.png");

const DESCRICAO = `PALITANOS — lutas de stickman animadas quadro a quadro.

Gelo contra fogo, katanas, poderes e nocautes.
Video novo toda semana. Voce escolhe quem vence.

#palitanos #stickman #animation`;

// ---- argumentos --------------------------------------------------------------

const args = process.argv.slice(2);
const opcao = (nome, padrao = undefined) => {
  const i = args.indexOf(`--${nome}`);
  if (i < 0) return padrao;
  const v = args[i + 1];
  return v && !v.startsWith("--") ? v : true;
};
const canal = opcao("canal");
const soImagens = Boolean(opcao("so-imagens"));
const soTexto = Boolean(opcao("so-texto"));
const publicarDireto = Boolean(opcao("publicar"));
const verNavegador = Boolean(opcao("ver"));

if (!canal || canal === true) {
  console.error(
    "Falta o canal. Use:\n" +
      "  node scripts/canal-youtube.mjs --canal UCxxxxxxxxxxxxxxxxxx\n\n" +
      "O ID esta no endereco do YouTube Studio:\n" +
      "  studio.youtube.com/channel/UCxxxxxxxxxxxxxxxxxx/editing/images",
  );
  process.exit(1);
}

/** pasta padrao do perfil do Chrome em cada sistema */
const perfilPadrao = () => {
  const h = homedir();
  switch (platform()) {
    case "win32":
      return join(h, "AppData", "Local", "Google", "Chrome", "User Data");
    case "darwin":
      return join(h, "Library", "Application Support", "Google", "Chrome");
    default:
      return join(h, ".config", "google-chrome");
  }
};
const perfil = opcao("perfil", perfilPadrao());

// ---- conferencias antes de abrir o navegador --------------------------------

const faltando = [];
if (!soTexto) {
  if (!existsSync(BANNER)) faltando.push(BANNER);
  if (!existsSync(AVATAR)) faltando.push(AVATAR);
}
if (faltando.length) {
  console.error(
    "Nao achei as imagens:\n  " +
      faltando.join("\n  ") +
      "\n\nGere com:  npm run canal",
  );
  process.exit(1);
}
if (!existsSync(perfil)) {
  console.error(
    `Nao achei o perfil do Chrome em:\n  ${perfil}\n\n` +
      "Passe o caminho certo com --perfil. Para descobrir, abra o Chrome e\n" +
      "digite chrome://version na barra de endereco: e o 'Caminho do perfil',\n" +
      "SEM a ultima parte (sem /Default).",
  );
  process.exit(1);
}

let chromium;
try {
  ({ chromium } = await import("playwright"));
} catch {
  console.error("Falta o Playwright. Instale com:\n  npm i -D playwright");
  process.exit(1);
}

// ---- ajudantes ---------------------------------------------------------------

const perguntar = async (texto) => {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  const r = (await rl.question(texto)).trim().toLowerCase();
  rl.close();
  return r === "" || r === "s" || r === "sim" || r === "y";
};

/**
 * Acha um elemento por varios nomes possiveis (o YouTube muda os rotulos e
 * eles dependem do idioma). Devolve o primeiro que aparecer, ou null.
 */
const acharPorNome = async (pagina, nomes, tempo = 8000) => {
  const ate = Date.now() + tempo;
  while (Date.now() < ate) {
    for (const nome of nomes) {
      const alvo = pagina.getByRole("button", { name: nome }).first();
      if (await alvo.isVisible().catch(() => false)) return alvo;
      const texto = pagina.getByText(nome, { exact: false }).first();
      if (await texto.isVisible().catch(() => false)) return texto;
    }
    await pagina.waitForTimeout(250);
  }
  return null;
};

const parar = async (pagina, motivo) => {
  const foto = join(RAIZ, "canal-youtube-erro.png");
  await pagina.screenshot({ path: foto, fullPage: true }).catch(() => {});
  console.error(
    `\nPAREI: ${motivo}\n` +
      `Tirei uma foto da tela em:\n  ${foto}\n\n` +
      "Isso quase sempre quer dizer que o YouTube mudou a tela ou que o\n" +
      "navegador nao esta logado. Rode de novo com --ver para acompanhar.",
  );
  process.exit(2);
};

// ---- o trabalho ---------------------------------------------------------------

console.log("Abrindo o Chrome com o seu perfil...");
console.log("(se der erro de perfil em uso, feche o Chrome por completo)\n");

const navegador = await chromium.launchPersistentContext(perfil, {
  channel: "chrome",
  headless: !verNavegador,
  viewport: { width: 1480, height: 950 },
  args: ["--disable-blink-features=AutomationControlled"],
});

const pagina = navegador.pages()[0] ?? (await navegador.newPage());

try {
  const base = `https://studio.youtube.com/channel/${canal}`;

  // ---- imagens ---------------------------------------------------------------
  if (!soTexto) {
    console.log("Abrindo a aba de imagens do canal...");
    await pagina.goto(`${base}/editing/images`, { waitUntil: "domcontentloaded" });
    await pagina.waitForTimeout(3000);

    if (pagina.url().includes("accounts.google.com")) {
      await parar(pagina, "o navegador nao esta logado no YouTube.");
    }

    // O YouTube usa <input type=file> escondidos. Mandar o arquivo direto no
    // input e MUITO mais estavel do que clicar em "Fazer upload" e mexer na
    // janela do sistema, que o Playwright nem sempre alcanca.
    const entradas = pagina.locator('input[type="file"]');
    const quantas = await entradas.count();
    if (quantas < 2) {
      await parar(
        pagina,
        `esperava pelo menos 2 campos de imagem e achei ${quantas}.`,
      );
    }

    // ordem na tela: 1 foto do perfil (avatar), 2 banner, 3 marca d'agua
    console.log("Enviando o avatar...");
    await entradas.nth(0).setInputFiles(AVATAR);
    await pagina.waitForTimeout(2500);
    let concluir = await acharPorNome(pagina, ["Concluído", "Concluir", "Done", "Salvar", "Save"]);
    if (concluir) {
      await concluir.click().catch(() => {});
      await pagina.waitForTimeout(1500);
    }

    console.log("Enviando o banner...");
    await entradas.nth(1).setInputFiles(BANNER);
    await pagina.waitForTimeout(2500);
    concluir = await acharPorNome(pagina, ["Concluído", "Concluir", "Done", "Salvar", "Save"]);
    if (concluir) {
      await concluir.click().catch(() => {});
      await pagina.waitForTimeout(1500);
    }
  }

  // ---- descricao --------------------------------------------------------------
  if (!soImagens) {
    console.log("Abrindo a aba de informacoes basicas...");
    await pagina.goto(`${base}/editing/details`, { waitUntil: "domcontentloaded" });
    await pagina.waitForTimeout(3000);

    const campo = pagina
      .locator('#description textarea, textarea[aria-label*="escri" i], textarea[aria-label*="escription" i]')
      .first();
    if (await campo.isVisible().catch(() => false)) {
      console.log("Escrevendo a descricao...");
      await campo.click();
      await campo.press("Control+A");
      await campo.press("Delete");
      await campo.type(DESCRICAO, { delay: 8 });
      await pagina.waitForTimeout(800);
    } else {
      console.warn(
        "Nao achei o campo de descricao; segui sem mexer nele.\n" +
          "(as imagens, se voce pediu, ja foram)",
      );
    }
  }

  // ---- publicar ---------------------------------------------------------------
  const publicar = await acharPorNome(pagina, ["PUBLICAR", "Publicar", "PUBLISH", "Publish"], 5000);
  if (!publicar) {
    await parar(pagina, "nao achei o botao de publicar.");
  }

  if (!publicarDireto) {
    console.log("\nEsta tudo preenchido, mas AINDA NAO foi publicado.");
    const sim = await perguntar("Publicar agora no seu canal? [S/n] ");
    if (!sim) {
      console.log(
        "Nao publiquei. O navegador segue aberto: confira e clique em\n" +
          "PUBLICAR voce mesmo, ou feche a janela para descartar.",
      );
      await new Promise(() => {});
    }
  }

  console.log("Publicando...");
  await publicar.click();
  await pagina.waitForTimeout(4000);
  console.log("\nPronto. Abra o seu canal e confira como ficou.");
} finally {
  if (!verNavegador) await navegador.close();
}
