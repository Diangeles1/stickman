/**
 * Configuracao do Remotion para o STICKMAN FIGHT ENGINE.
 *
 * Nota: ao usar as APIs de Node, este arquivo NAO se aplica; as opcoes vao
 * direto nas chamadas. Ele vale para o Studio e para o `remotion render` do CLI.
 *
 * Todas as opcoes: https://remotion.dev/docs/config
 */

import { Config } from "@remotion/cli/config";

// rspack e o bundler novo do Remotion, mais rapido que o webpack no watch.
Config.setRspack(true);

// O motor desenha SVG sobre fundo escuro com degrade e poeira. JPEG introduz
// banding visivel nesse tipo de imagem; PNG por quadro custa mais tempo de
// render mas mantem o degrade limpo.
Config.setVideoImageFormat("png");

// H.264 com CRF baixo: o alvo e Shorts/TikTok, que re-comprimem o video.
// Entregar ja comprimido empilha perda sobre perda.
Config.setCodec("h264");
Config.setCrf(16);

Config.setOverwriteOutput(true);

// O Tailwind vinha no scaffold (mesmo com --no-tailwind) e foi removido: o
// motor e quase todo SVG, e manter o plugin so adiciona trabalho ao bundler
// no caminho de render. Para reativar: instalar @remotion/tailwind-v4 e
// chamar Config.overrideBundlerConfig(enableTailwind).
