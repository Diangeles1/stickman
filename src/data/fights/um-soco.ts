/**
 * Teste de UM soco.
 *
 * Existe para responder uma pergunta so: o punho encosta no adversario?
 * Nenhum outro golpe entra aqui, para nao haver o que distrair a analise.
 *
 * Roteiro pedido:
 *   0.0-0.6  entram em distancia de combate
 *   0.6-1.0  o preto prepara o soco
 *   1.0-1.3  o punho avanca
 *   1.3      CONTATO
 *   1.3-1.4  hit stop, flash, impacto, tremor
 *   1.4-2.0  o vermelho reage: cabeca e tronco acompanham
 *   2.0-2.6  o vermelho e empurrado
 *   2.6-3.0  recupera o equilibrio
 */

import { s } from "../../core/time";
import type { FightSpec } from "../../core/types";

export const UM_SOCO: FightSpec = {
  fighterA: "black",
  fighterB: "red",
  seed: 7,
  fps: 60,
  width: 1080,
  height: 1920,
  // intensidade baixa de proposito: o objetivo aqui e LER o golpe, nao
  // acelera-lo. Golpe rapido demais esconde justamente o que estamos testando.
  intensity: 4,
  scenario: "arena",
  beats: [
    // entram em distancia de combate, ja em movimento
    { type: "approach", who: "black", toX: -520, duration: s(0.6) },

    // o unico golpe do teste, mirado no PEITO
    {
      type: "attack",
      attacker: "black",
      target: "red",
      move: "punch",
      targetPoint: "chest",
    },

    // tempo para a reacao e o knockback terminarem na tela
    { type: "recover", who: "red", duration: s(0.5) },
    { type: "hold", duration: s(0.5), label: "respiro para avaliar" },
  ],
};
