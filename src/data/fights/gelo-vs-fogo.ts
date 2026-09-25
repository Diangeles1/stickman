/**
 * PALITANOS: BLACK ICE vs RED FIRE (versao de 20 segundos).
 *
 * Roteiro do autor, condensado:
 *
 *   ENCONTRO            noite, chuva; cada um no seu elemento, closes
 *   PRIMEIRO CHOQUE     gelo desliza, fogo dispara; as laminas se encontram
 *   KATANAS             dois cortes defendidos, corte baixo (o fogo pula),
 *                       contra-ataque do fogo que empurra o gelo
 *   ICE FIELD           o gelo toma a arena, o fogo escorrega, corte no torso
 *   FIRE BULLETS        tres bolas de fogo, tres esquivas diferentes
 *   INFERNO vs ZERO     a esfera de fogo contra o raio de gelo; tela branca
 *   CHOQUE FINAL        as laminas cruzam e as duas espadas quebram
 *   ENCARAR             rachadura entre os dois; QUEM DEVE VENCER?
 *
 * Gelo = controle, velocidade, precisao. Fogo = forca, explosao, agressividade.
 */

import type { FightSpec } from "../../core/types";

export const GELO_VS_FOGO: FightSpec = {
  fighterA: "black",
  fighterB: "red",
  seed: 77,
  fps: 60,
  width: 1080,
  height: 1920,
  intensity: 7,
  scenario: "noite",
  armas: {
    black: { tipo: "katana", elemento: "gelo" },
    red: { tipo: "katana", elemento: "fogo" },
  },
  nomes: { black: "BLACK", red: "RED" },
  cinematico: true,
  beats: [
    { type: "tecnica", tecnica: "encontro", gelo: "black", fogo: "red" },
    { type: "tecnica", tecnica: "investida", gelo: "black", fogo: "red" },
    { type: "blocked", attacker: "black", target: "red", move: "corteSobe" },
    { type: "blocked", attacker: "black", target: "red", move: "corteLateral" },
    // corte BAIXO: a lamina varre a altura das pernas e o fogo pula por cima
    { type: "dodged", attacker: "black", target: "red", move: "corteDesce", targetPoint: "legs", pulo: true },
    { type: "blocked", attacker: "red", target: "black", move: "corteSobe" },
    { type: "tecnica", tecnica: "campoDeGelo", gelo: "black", fogo: "red" },
    { type: "tecnica", tecnica: "bolasDeFogo", gelo: "black", fogo: "red" },
    { type: "tecnica", tecnica: "infernoVsZero", gelo: "black", fogo: "red" },
    { type: "tecnica", tecnica: "choqueFinal", gelo: "black", fogo: "red" },
    { type: "tecnica", tecnica: "encarar", gelo: "black", fogo: "red" },
  ],
};
