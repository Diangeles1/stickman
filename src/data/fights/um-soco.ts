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
    // Entram em distancia de combate, ja em movimento.
    //
    // toX curto de proposito: com -520 a aproximacao levava 1,17s num teste de
    // 3s, ou seja 37% do video era corrida. O golpe e o assunto.
    { type: "approach", who: "black", toX: -80, duration: s(0.35) },

    // o unico golpe do teste, mirado no PEITO
    {
      type: "attack",
      attacker: "black",
      target: "red",
      move: "punch",
      targetPoint: "chest",
    },

    // Tempo para a reacao e o cambaleio terminarem na tela, e nada mais.
    // Com 0,5 + 0,5 sobrava um segundo inteiro dos dois parados no fim.
    { type: "recover", who: "red", duration: s(0.3) },
    { type: "hold", duration: s(0.2), label: "respiro para avaliar" },
  ],
};
