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
    stroke: "#6d7590",
    auraColor: "#8fa2c8",
    limbWidth: 26,
    headRadius: 62,
    scale: 1,
    profile: { speed: 0.9, power: 0.45 },
  },
  red: {
    id: "red",
    stroke: "#d6403a",
    auraColor: "#e2483c",
    limbWidth: 28,
    headRadius: 64,
    scale: 1.06,
    profile: { speed: 0.42, power: 0.95 },
  },
  blue: {
    id: "blue",
    stroke: "#3f7fd6",
    auraColor: "#4aa8ff",
    limbWidth: 26,
    headRadius: 62,
    scale: 1,
    profile: { speed: 0.7, power: 0.65 },
  },
  gold: {
    id: "gold",
    stroke: "#d8a63a",
    auraColor: "#ffd45e",
    limbWidth: 27,
    headRadius: 63,
    scale: 1.02,
    profile: { speed: 0.75, power: 0.8 },
  },
  green: {
    id: "green",
    stroke: "#46a85e",
    auraColor: "#63d97f",
    limbWidth: 26,
    headRadius: 62,
    scale: 1,
    profile: { speed: 0.65, power: 0.6 },
  },
  white: {
    id: "white",
    stroke: "#e6e9f0",
    auraColor: "#ffffff",
    limbWidth: 25,
    headRadius: 61,
    scale: 0.98,
    profile: { speed: 0.85, power: 0.5 },
  },
  purple: {
    id: "purple",
    stroke: "#8a52cc",
    auraColor: "#b478ff",
    limbWidth: 27,
    headRadius: 63,
    scale: 1.03,
    profile: { speed: 0.6, power: 0.78 },
  },
};
