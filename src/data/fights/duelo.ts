/**
 * BENCHMARK #3: OITO SEGUNDOS DE DUELO.
 *
 * Existe por causa de um diagnostico: o motor sabe fazer o golpe ENCOSTAR (as
 * auditorias provam), mas nao sabia fazer o corpo parecer que POE PESO nele.
 * Efeito nenhum conserta isso; efeito so esconde.
 *
 * A regra desta luta e uma so:
 *
 *   SE ELA NAO CONVENCER SEM NENHUM EFEITO, NAO ADIANTA POR EFEITO.
 *
 * Por isso ela e curta e e sempre julgada na composicao Duelo-SemEfeitos:
 * sem particula, sem flash, sem rastro, sem tremor, sem movimento de camera,
 * sem som. So corpo, espada e chao.
 *
 * Os oito segundos, um por trecho:
 *
 *   0-2  CONFRONTO      os dois se medem, respirando, distancia longa
 *   2-3  AVANCO         o preto fecha a distancia e corta
 *   3-4  BLOQUEIO       o vermelho apara e o corpo dele SENTE
 *   4-5  ESQUIVA        o vermelho corta, o preto sai do caminho
 *   5-6  CONTRA-ATAQUE  o vermelho aproveita a abertura
 *   6-7  ACERTO         o corte entra no preto
 *   7-8  REACAO         o preto cambaleia e se recompoe
 */

import { s } from "../../core/time";
import type { FightSpec } from "../../core/types";

export const DUELO: FightSpec = {
  fighterA: "black",
  fighterB: "red",
  seed: 3,
  fps: 60,
  width: 1080,
  height: 1920,
  intensity: 6,
  scenario: "limpo",
  armas: {
    black: { tipo: "katana", elemento: "gelo" },
    red: { tipo: "katana", elemento: "fogo" },
  },
  nomes: { black: "BLACK", red: "RED" },
  cinematico: true,
  beats: [
    // 0-2 CONFRONTO: distancia longa, ninguem ataca. E aqui que o espectador
    // aprende quem e cada um pelo jeito de ficar de pe.
    { type: "hold", duration: s(1.6), label: "confronto" },

    // 2-3 AVANCO e corte que o vermelho apara
    { type: "approach", who: "black", toX: -150, duration: s(0.45) },
    { type: "blocked", attacker: "black", target: "red", move: "corteSobe" },

    // 4-5 o vermelho devolve e o preto sai do caminho
    { type: "dodged", attacker: "red", target: "black", move: "corteLateral" },

    // 5-7 contra-ataque que ENTRA
    { type: "attack", attacker: "red", target: "black", move: "corteDesce", targetPoint: "legs" },

    // 7-8 reacao e volta a guarda
    { type: "recover", who: "black", duration: s(0.9) },
    { type: "hold", duration: s(0.4), label: "respiro" },
  ],
};
