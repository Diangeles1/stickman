/**
 * A luta do prototipo, DESCRITA POR DADOS.
 *
 * Este arquivo e a prova da regra principal do briefing: nao existe luta
 * hardcoded no codigo. Uma luta e um objeto FightSpec. Para criar a segunda,
 * copie este arquivo e troque os beats; nada mais muda.
 *
 * A sequencia segue o roteiro de 8 a 10 segundos pedido:
 *   0-1s  os dois ja em movimento, sem introducao lenta
 *   1-2s  preto corre, vermelho se prepara
 *   2-3s  soco do preto, vermelho bloqueia
 *   3-4s  contra-ataque pesado do vermelho, preto esquiva
 *   4-5s  chute do preto, vermelho leva knockback
 *   5-6s  vermelho recupera o equilibrio, aura comeca
 *   6-7s  vermelho avanca
 *   7-8s  esquiva rapidissima do preto
 *   8-9s  chute giratorio
 *   9-10s vermelho lancado, camera acompanha
 */

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
    // acao no quadro zero: os dois correndo um para o outro
    { type: "approach", who: "black", toX: -240, duration: 40 },

    // primeiro embate: soco bloqueado
    { type: "blocked", attacker: "black", target: "red", move: "punch" },

    // contra-ataque pesado, e o preto esquiva (velocidade contra forca)
    { type: "attack", attacker: "red", target: "black", move: "punchHeavy" },
    { type: "dodge", who: "black", duration: 14 },

    // resposta do preto com chute: o vermelho voa
    { type: "attack", attacker: "black", target: "red", move: "kick" },
    { type: "knockback", who: "red", distance: 260, duration: 18 },

    // o vermelho se levanta e carrega a aura
    { type: "recover", who: "red", duration: 16 },
    { type: "powerUp", who: "red", duration: 34 },

    // investida
    { type: "attack", attacker: "red", target: "black", move: "charge" },

    // esquiva extrema e finalizacao com chute giratorio
    { type: "dodge", who: "black", duration: 12 },
    { type: "finisher", attacker: "black", target: "red", move: "spinKick" },

    // respiro final para a camera acompanhar o corpo voando
    { type: "hold", duration: 30, label: "acompanha o lancamento" },
  ],
};
