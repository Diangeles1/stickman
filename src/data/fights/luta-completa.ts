/**
 * LUTA COMPLETA: o arco inteiro, do confronto ao finalizador.
 *
 * Montada a mao (nao gerada) porque e a vitrine do motor: cada trecho mostra
 * uma coisa que os benchmarks provaram separadamente, e a ordem segue a
 * diretiva, crescendo em peso, alcance e movimento ate o fim:
 *
 *   ABERTURA            hold (plano aberto, respiracao, ginga)
 *   CONFRONTO           approach (o preto encurta, o vermelho entra em guarda)
 *   PRIMEIRA TROCA      jab do preto que entra; o vermelho responde e o preto
 *                       segura na guarda
 *   COMBO               tres golpes do preto, o ultimo passa pela guarda
 *   CONTRA-ATAQUE       o vermelho erra o soco pesado (o preto esquiva) e,
 *                       desequilibrado, leva o contra-golpe do preto
 *   ESQUIVAS            cada um faz o outro errar uma vez
 *   GOLPE PESADO        o soco pesado do vermelho encontra o preto: knockback,
 *                       queda e recuperacao
 *   COMBATE AEREO       o preto pula e golpeia de cima
 *   CHOQUE              troca de golpes nas duas guardas
 *   ESCALADA FINAL      combo do vermelho segurado; combo do preto que entra
 *   FINALIZADOR         chute giratorio do preto: o vermelho voa na direcao
 *                       da camera
 *
 * Personalidade sem efeito nenhum: o preto golpeia rapido e em sequencia, o
 * vermelho golpeia uma vez, carregado, e quando acerta derruba.
 */

import { s } from "../../core/time";
import type { FightSpec } from "../../core/types";

export const LUTA_COMPLETA: FightSpec = {
  fighterA: "black",
  fighterB: "red",
  seed: 31,
  fps: 60,
  width: 1080,
  height: 1920,
  intensity: 5,
  scenario: "limpo",
  beats: [
    // ---- ABERTURA E CONFRONTO -------------------------------------------
    { type: "hold", duration: s(0.7), label: "abertura" },
    { type: "approach", who: "black", toX: -140, duration: s(0.55) },

    // ---- PRIMEIRA TROCA --------------------------------------------------
    { type: "attack", attacker: "black", target: "red", move: "punchFast", targetPoint: "chest" },
    { type: "recover", who: "red", duration: s(0.3) },
    { type: "blocked", attacker: "red", target: "black", move: "punch", targetPoint: "chest" },

    // ---- COMBO -----------------------------------------------------------
    {
      type: "combo",
      attacker: "black",
      target: "red",
      moves: ["punchFast", "punch", "kick"],
      targetPoint: "chest",
    },
    { type: "recover", who: "red", duration: s(0.4) },

    // ---- CONTRA-ATAQUE ---------------------------------------------------
    { type: "dodged", attacker: "red", target: "black", move: "punchHeavy", targetPoint: "chest" },
    { type: "attack", attacker: "black", target: "red", move: "punch", targetPoint: "chest" },
    { type: "recover", who: "red", duration: s(0.35) },

    // ---- ESQUIVAS --------------------------------------------------------
    { type: "dodged", attacker: "black", target: "red", move: "kickHigh", targetPoint: "chest" },
    { type: "dodged", attacker: "red", target: "black", move: "punch", targetPoint: "chest" },

    // ---- GOLPE PESADO, QUEDA E RECUPERACAO -------------------------------
    { type: "attack", attacker: "red", target: "black", move: "punchHeavy", targetPoint: "chest" },
    { type: "recover", who: "black", duration: s(1.0) },

    // ---- COMBATE AEREO ---------------------------------------------------
    { type: "attack", attacker: "black", target: "red", move: "diveAttack", targetPoint: "chest" },
    { type: "recover", who: "red", duration: s(1.0) },

    // ---- CHOQUE ----------------------------------------------------------
    { type: "blocked", attacker: "black", target: "red", move: "punch", targetPoint: "chest" },
    { type: "blocked", attacker: "red", target: "black", move: "punch", targetPoint: "chest" },

    // ---- ESCALADA FINAL --------------------------------------------------
    {
      type: "combo",
      attacker: "red",
      target: "black",
      moves: ["punch", "kick"],
      final: "blocked",
      targetPoint: "chest",
    },
    {
      type: "combo",
      attacker: "black",
      target: "red",
      moves: ["punchFast", "punchFast", "punch"],
      targetPoint: "chest",
    },
    { type: "recover", who: "red", duration: s(0.4) },

    // ---- FINALIZADOR -----------------------------------------------------
    { type: "finisher", attacker: "black", target: "red", move: "spinKick", targetPoint: "chest" },
    { type: "hold", duration: s(1.4), label: "desfecho" },
  ],
};
