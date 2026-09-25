/**
 * TESTE DE KATANA: so para validar a espada, as poses e os cortes antes da
 * luta de gelo contra fogo. Nao vai para video nenhum.
 */

import { s } from "../../core/time";
import type { FightSpec } from "../../core/types";

export const TESTE_KATANA: FightSpec = {
  fighterA: "black",
  fighterB: "red",
  seed: 5,
  fps: 60,
  width: 1080,
  height: 1920,
  intensity: 6,
  scenario: "limpo",
  armas: {
    black: { tipo: "katana", elemento: "gelo" },
    red: { tipo: "katana", elemento: "fogo" },
  },
  beats: [
    { type: "hold", duration: s(0.4) },
    { type: "blocked", attacker: "black", target: "red", move: "corteSobe" },
    { type: "blocked", attacker: "black", target: "red", move: "corteLateral" },
    { type: "blocked", attacker: "red", target: "black", move: "corteDesce" },
    { type: "attack", attacker: "black", target: "red", move: "corteLateral" },
    { type: "hold", duration: s(0.8) },
  ],
};
