/**
 * BENCHMARK #1: a troca completa, em cerca de 7 segundos.
 *
 * Nao e uma luta para publicar. E o teste que diz se a ANIMACAO esta pronta, e
 * o criterio e o da diretiva: sem efeitos, camera e audio (composicao
 * Benchmark-SemEfeitos), os personagens ainda parecem estar lutando?
 *
 * Tudo aqui e DADO. O compilador deriva distancia, contato, reacao, camera e
 * tempo a partir desta lista. A sequencia pedida e onde cada passo acontece:
 *
 *   PRETO + VERMELHO    hold (respiracao, ginga)
 *   CONFRONTO           hold
 *   PRETO SE APROXIMA   approach
 *   VERMELHO SE PREPARA dentro do approach (o outro entra em guarda)
 *   PRETO ATACA         dodged: jab no peito...
 *   VERMELHO ESQUIVA    ...que o vermelho deixa passar jogando o corpo
 *                       para tras
 *   VERMELHO CONTRA     blocked: o vermelho sai da esquiva com o soco pesado...
 *   PRETO BLOQUEIA      ...que o preto segura na guarda
 *   PRETO CONTRA-ATACA  attack: o soco pesado deixou o vermelho aberto, e o
 *                       preto entra com o uppercut
 *   VERMELHO E ATINGIDO dentro do attack (reacao a partir da cabeca)
 *   KNOCKBACK           dentro do attack (o uppercut lanca)
 *   POUSO               dentro do attack (costas no chao, desliza, para)
 *   RECUPERACAO         recover (levanta e volta a guarda)
 *
 * A logica de combate e a da diretiva: cada acao nasce da anterior. O
 * vermelho erra porque o preto atacou alto; o preto bloqueia porque o
 * vermelho contra-atacou com forca; e o preto acerta porque o soco pesado
 * bloqueado deixou o vermelho sem guarda.
 */

import { s } from "../../core/time";
import type { FightSpec } from "../../core/types";

export const BENCHMARK: FightSpec = {
  fighterA: "black",
  fighterB: "red",
  seed: 11,
  fps: 60,
  width: 1080,
  height: 1920,
  intensity: 5,
  scenario: "limpo",
  beats: [
    { type: "hold", duration: s(0.5), label: "confronto" },

    { type: "approach", who: "black", toX: -130, duration: s(0.55) },

    {
      type: "dodged",
      attacker: "black",
      target: "red",
      move: "punch",
      // no peito, e nao na cabeca: para alcancar a cabeca do vermelho (mais
      // alto) o preto teria que colar o quadril a 229 unidades do dele, e as
      // duas silhuetas virariam uma. No peito a esquiva e o corpo indo para
      // TRAS, que de perfil e a leitura mais clara de "passou perto"
      targetPoint: "chest",
    },

    {
      type: "blocked",
      attacker: "red",
      target: "black",
      move: "punchHeavy",
      targetPoint: "head",
    },

    {
      type: "attack",
      attacker: "black",
      target: "red",
      move: "uppercut",
      targetPoint: "queixo",
    },

    { type: "recover", who: "red", duration: s(1.1) },

    { type: "hold", duration: s(0.4), label: "respiro" },
  ],
};
