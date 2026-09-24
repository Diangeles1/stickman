/**
 * BENCHMARK DO MOTOR: a sequencia de 15 passos da diretiva, em 5 a 8 segundos.
 *
 * Nao e uma luta para publicar. E o teste que diz se o motor esta pronto para
 * uma luta, e o criterio e o da diretiva: se eu remover efeitos, camera e
 * audio, os personagens ainda parecem estar lutando?
 *
 * Tudo aqui e DADO. Nenhuma coreografia mora em codigo: os 15 passos sao a
 * lista de beats abaixo, e o compilador deriva distancia, contato, reacao,
 * camera e tempo a partir dela. Uma luta nova e outro arquivo como este.
 *
 * Os passos da diretiva e onde cada um acontece:
 *
 *    1 IDLE            beat hold, com respiracao procedural nos dois
 *    2 CORRIDA         beat approach
 *    3 DESACELERACAO   dentro do approach (ultimos 12% do caminho)
 *    4 ANTICIPATION    dentro do attack (pose coil)
 *    5 SOCO            attack punch
 *    6 CONTATO REAL    IK poe o punho no peito (medido: 10 unidades)
 *    7 HIT STOP        dentro do attack (3 quadros)
 *    8 REACAO          dentro do attack (absorcao, deslocamento, cambaleio)
 *    9 KNOCKBACK       dentro do attack
 *   11 RECOVERY        beat recover, que tambem traz o outro de volta
 *   12 CONTRA-ATAQUE   attack do vermelho
 *   13 ESQUIVA         beat dodged: o golpe do vermelho PASSA
 *   14 CHUTE           attack spinKick
 *   15 REACAO          dentro do attack
 *   10 POUSO           dentro do spinKick, que e de intensidade extrema e
 *                      lanca o corpo, entao tem pouso em quatro tempos
 *
 * Sobre a ordem do passo 10: o pouso acontece depois do CHUTE, e nao depois do
 * soco. Um soco reto que jogasse o adversario no ar seria exatamente o
 * "knockback exagerado" que a diretiva proibe no item 35. Pouso pede golpe que
 * lanca, e quem lanca aqui e o chute giratorio.
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
  // 5 de 10: intensidade media. O benchmark existe para LER o movimento, e
  // intensidade alta encurta os golpes ate esconder o que se quer avaliar.
  intensity: 5,
  // Cenario LIMPO, no estilo da referencia: fundo branco e uma linha de chao.
  // Trocar o cenario e trocar UM campo de dado, nao codigo, que era o ponto
  // de tudo isto ser um motor.
  scenario: "limpo",
  beats: [
    // 1. IDLE. Nada acontece de proposito: e aqui que se ve se o lutador
    //    parado tem vida ou e um manequim.
    { type: "hold", duration: s(0.55), label: "idle" },

    // 2 e 3. CORRIDA e DESACELERACAO. O approach corre 88% do caminho e gasta
    //    os ultimos 12% freando, com o corpo tombando para tras sozinho.
    { type: "approach", who: "black", toX: -140, duration: s(0.4) },

    // 4 a 9. O soco completo: carga, disparo, contato, hit stop, reacao em
    //    quatro fases, knockback e cambaleio.
    {
      type: "attack",
      attacker: "black",
      target: "red",
      move: "punch",
      targetPoint: "chest",
    },

    // 11. RECOVERY. O vermelho se recompoe e o preto fecha a distancia.
    { type: "recover", who: "red", duration: s(0.45) },

    // 12 e 13. CONTRA-ATAQUE e ESQUIVA. O vermelho revida na cabeca e o preto
    //     ABAIXA: sem impacto, com o ritmo caindo para a esquiva se ler.
    {
      type: "dodged",
      attacker: "red",
      target: "black",
      move: "punchHeavy",
      targetPoint: "head",
    },

    // 14, 15 e 10. CHUTE que lanca, reacao, e o pouso em quatro tempos.
    {
      type: "attack",
      attacker: "black",
      target: "red",
      move: "spinKick",
      targetPoint: "chest",
    },

    // 11 de novo, agora levantando de verdade: o vermelho caiu, entao o
    //    recover toca getUp. Quem nao caiu nunca passa por essa pose.
    { type: "recover", who: "red", duration: s(0.6) },

    // respiro final para avaliar o quadro parado
    { type: "hold", duration: s(0.3), label: "respiro" },
  ],
};
