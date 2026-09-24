/**
 * Presets de lutador.
 *
 * Adicionar uma cor nova (azul, dourado, roxo...) e acrescentar uma entrada
 * aqui. Nenhum outro arquivo muda: o compilador, o desenho, a aura e o audio
 * leem do preset.
 *
 * O "profile" nao e enfeite. O compilador usa speed para escalar a duracao dos
 * golpes e power para escalar o knockback, entao a diferenca entre os dois
 * lutadores aparece no ritmo da luta, nao so na cor.
 */

import type { FighterId, FighterPreset } from "../core/types";

/*
 * ESPESSURA DOS MEMBROS: medida contra a referencia, nao escolhida.
 *
 * scripts/estilo.mts mede a espessura do membro como fracao da altura do
 * corpo, na referencia e no render:
 *
 *   referencia (StickNodes)   12.4%
 *   luta1, o projeto do autor  20.8%
 *   este motor, antes           4.2%
 *
 * Membro fino le como esqueleto de arame; os dois de cima leem como corpo
 * porque a silhueta tem massa. O alvo e o luta1, que e o estilo pedido: com
 * 597 unidades de corpo, 98 de espessura medem 20.8% na tela: as pontas
 * arredondadas somam espessura, entao o numero da pose fica abaixo do medido.
 * O alvo e o MEDIDO, e quem decide e scripts/estilo, nao a conta.
 *
 * A distancia de combate se ajusta sozinha a isso, porque ela deriva da
 * espessura do traco (ver distanciaDeCombate): membro mais grosso significa
 * superficie mais a frente do eixo, e os dois param mais longe um do outro.
 */
export const PRESETS: Record<FighterId, FighterPreset> = {
  // O "preto" NAO pode ser preto de verdade: contra o fundo escuro da arena
  // ele desaparece. Este cinza-azulado le como preto na tela. Descoberto no
  // prototipo em Python (ver references/prototipo-python).
  black: {
    id: "black",
    // Medido com scripts/contraste.mts contra o fundo da arena:
    //   #464b58  razao 2.10  (abaixo do minimo de 3.0 para uma forma se ler)
    //   #5b6278  razao 3.07  (passa, mas o membro de tras cai para 2.07)
    //   #6d7590  razao 4.04  (membro de tras sobe para 2.87)
    //
    // O que obriga a subir tanto e o membro de TRAS: ele e escurecido para dar
    // profundidade, entao a cor principal precisa de folga acima do limite
    // para o membro escurecido nao afundar no fundo.
    //
    // Continua lendo como "o preto" porque e cinza-azulado dessaturado: a
    // diferenca para o vermelho e de matiz, nao de claridade.
    stroke: "#4a5170",
    auraColor: "#8fa2c8",
    // 98 dava membros com 16% da altura do corpo: dois corpos encostados
    // viravam uma mancha so, e o joelho e o cotovelo sumiam dentro do traco.
    // Nesta espessura a silhueta le as articulacoes e o espaco entre os dois.
    limbWidth: 62,
    headRadius: 85,
    scale: 1,
    profile: { speed: 0.9, power: 0.45 },
  },
  red: {
    id: "red",
    stroke: "#d6403a",
    auraColor: "#e2483c",
    // um pouco mais grosso que o preto: o pesado tambem se le no traco
    limbWidth: 68,
    headRadius: 88,
    scale: 1.06,
    profile: { speed: 0.42, power: 0.95 },
  },
  blue: {
    id: "blue",
    stroke: "#3f7fd6",
    auraColor: "#4aa8ff",
    limbWidth: 98,
    headRadius: 85,
    scale: 1,
    profile: { speed: 0.7, power: 0.65 },
  },
  gold: {
    id: "gold",
    stroke: "#d8a63a",
    auraColor: "#ffd45e",
    limbWidth: 100,
    headRadius: 86,
    scale: 1.02,
    profile: { speed: 0.75, power: 0.8 },
  },
  green: {
    id: "green",
    stroke: "#46a85e",
    auraColor: "#63d97f",
    limbWidth: 98,
    headRadius: 85,
    scale: 1,
    profile: { speed: 0.65, power: 0.6 },
  },
  white: {
    id: "white",
    stroke: "#e6e9f0",
    auraColor: "#ffffff",
    limbWidth: 94,
    headRadius: 84,
    scale: 0.98,
    profile: { speed: 0.85, power: 0.5 },
  },
  purple: {
    id: "purple",
    stroke: "#8a52cc",
    auraColor: "#b478ff",
    limbWidth: 100,
    headRadius: 86,
    scale: 1.03,
    profile: { speed: 0.6, power: 0.78 },
  },
};
