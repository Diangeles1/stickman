/**
 * A luta do prototipo, DESCRITA POR DADOS.
 *
 * Este arquivo e a prova da regra principal do briefing: nao existe luta
 * hardcoded no codigo. Uma luta e um objeto FightSpec. Para criar a segunda,
 * copie este arquivo e troque os beats; nada mais muda.
 *
 * Coreografia pedida (8 a 10s), sem tempo morto:
 *   0.0-0.7  os dois ja se preparando
 *   0.7-1.5  preto DISPARA em direcao ao vermelho
 *   1.5-2.0  soco do preto, vermelho bloqueia, IMPACTO
 *   2.0-2.8  contra-ataque pesado do vermelho, preto esquiva por pouco
 *   2.8-3.6  chute rapido do preto, vermelho leva knockback
 *   3.6-4.5  vermelho recupera e ativa a aura, o ambiente reage
 *   4.5-5.5  vermelho dispara em velocidade
 *   5.5-6.5  preto desvia no ultimo instante
 *   6.5-7.5  chute giratorio do preto
 *   7.5-8.5  vermelho lancado para tras
 *   8.5-9.0  impacto forte
 *   9.0-10.0 plano final com os dois
 *
 * Nao existe beat de "introducao": o primeiro beat ja e movimento, e o
 * primeiro contato acontece antes dos 2s.
 */

import { s } from "../../core/time";
import type { FightSpec } from "../../core/types";

export const PROTOTIPO: FightSpec = {
  fighterA: "black",
  fighterB: "red",
  seed: 20260924,
  fps: 60,
  width: 1080,
  height: 1920,
  intensity: 9,
  scenario: "arena",
  beats: [
    // --- ATO 1: o preto ataca, o vermelho aguenta -----------------------
    // ja em movimento; nao existe beat de apresentacao
    { type: "approach", who: "black", toX: -560, duration: s(0.7) },
    { type: "blocked", attacker: "black", target: "red", move: "punch" },

    // --- ATO 2: o vermelho revira, o preto escapa por pouco -------------
    { type: "attack", attacker: "red", target: "black", move: "punchHeavy" },
    { type: "dodge", who: "black", duration: s(0.28) },

    // --- ATO 3: o preto responde com COMBO e vira o jogo ----------------
    // e o combo que cria a "desvantagem do vermelho" que o briefing pede:
    // dois golpes bloqueados e o terceiro conectando
    {
      type: "combo",
      attacker: "black",
      target: "red",
      moves: ["punchFast", "punchFast", "kickHigh"],
    },

    // --- ATO 4: o vermelho se levanta e liga a aura ---------------------
    { type: "recover", who: "red", duration: s(0.34) },
    { type: "powerUp", who: "red", duration: s(0.7) },

    // --- ATO 5: com a aura, o vermelho recupera a vantagem --------------
    { type: "attack", attacker: "red", target: "black", move: "charge" },

    // --- ATO 6: esquiva extrema e o golpe final -------------------------
    { type: "dodge", who: "black", duration: s(0.3) },
    { type: "finisher", attacker: "black", target: "red", move: "spinKick" },

    // plano final: a camera abre e mostra os dois
    { type: "hold", duration: s(1.1), label: "plano final com os dois" },
  ],
};
