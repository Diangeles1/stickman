/**
 * BENCHMARK #2: combo, contra-ataque, esquiva e queda do PRETO.
 *
 * O #1 testou uma troca de golpes isolados. Este testa o que o #1 nao tinha:
 * golpes ENCADEADOS (a volta de um e a carga do outro) e o lutador pesado
 * impondo a forca dele. A sequencia pedida e onde cada passo acontece:
 *
 *   PRETO COMBO          combo de tres golpes, encadeados...
 *   VERMELHO BLOQUEIA    ...que o vermelho segura na guarda (final "blocked")
 *   VERMELHO CONTRA      dodged: o vermelho sai do bloqueio com o soco pesado...
 *   PRETO ESQUIVA        ...que o preto deixa passar jogando o corpo para tras
 *   VERMELHO CHUTA       attack: o soco que passou desequilibrou o vermelho
 *                        para frente, e ele converte o embalo no chute
 *                        giratorio
 *   PRETO E ATINGIDO     dentro do attack (reacao a partir do peito)
 *   KNOCKBACK / QUEDA    o chute giratorio lanca: voo, costas no chao, desliza
 *   PRETO SE RECUPERA    recover (senta, ajoelha, guarda)
 *
 * A personalidade tem que aparecer sem nenhum efeito: o preto bate rapido e
 * curto, tres vezes; o vermelho bate uma vez so, carregado, e derruba.
 */

import { s } from "../../core/time";
import type { FightSpec } from "../../core/types";

export const BENCHMARK2: FightSpec = {
  fighterA: "black",
  fighterB: "red",
  seed: 23,
  fps: 60,
  width: 1080,
  height: 1920,
  intensity: 5,
  scenario: "limpo",
  beats: [
    { type: "hold", duration: s(0.4), label: "confronto" },

    { type: "approach", who: "black", toX: -130, duration: s(0.55) },

    {
      type: "combo",
      attacker: "black",
      target: "red",
      moves: ["punchFast", "punch", "punchFast"],
      final: "blocked",
      targetPoint: "chest",
    },

    {
      type: "dodged",
      attacker: "red",
      target: "black",
      move: "punchHeavy",
      targetPoint: "chest",
    },

    {
      type: "attack",
      attacker: "red",
      target: "black",
      move: "spinKick",
      targetPoint: "chest",
    },

    { type: "recover", who: "black", duration: s(1.1) },

    { type: "hold", duration: s(0.4), label: "respiro" },
  ],
};
