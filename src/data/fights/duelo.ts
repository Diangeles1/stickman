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
    // ---- 0-1,4 CONFRONTO -------------------------------------------------
    // Os dois se medem. Aqui o espectador aprende quem e cada um so pelo
    // jeito de ficar de pe (ver aplicarPostura em animation/corpo.ts).
    { type: "hold", duration: s(1.2), label: "confronto" },

    // ---- TROCA RAPIDA ----------------------------------------------------
    // Tres cortes rapidos seguidos, os dois primeiros aparados. E o trecho
    // que estabelece o RITMO: golpe curto, resposta curta, sem pausa.
    { type: "approach", who: "black", toX: -170, duration: s(0.4) },
    { type: "blocked", attacker: "black", target: "red", move: "corteRapido" },
    { type: "blocked", attacker: "red", target: "black", move: "corteRapido" },
    // e o terceiro passa: o preto desvia jogando o corpo para tras
    { type: "dodged", attacker: "red", target: "black", move: "corteLateral" },

    // ---- PAUSA E GOLPE PESADO -------------------------------------------
    // Depois da troca rapida, o contraste: uma carga longa que se ve chegar.
    // O vermelho apara, mas o corpo dele SENTE (pose absorver).
    { type: "blocked", attacker: "black", target: "red", move: "corteSobe" },

    // ---- VARREDURA E PULO ------------------------------------------------
    // Corte baixo: o unico jeito de escapar e sair do chao.
    { type: "dodged", attacker: "black", target: "red", move: "corteDesce", targetPoint: "legs", pulo: true },

    // ---- CONTRA-ATAQUE QUE ENTRA ----------------------------------------
    // O vermelho cai do pulo ja cortando, e este entra: sangue na direcao da
    // lamina e marca no corpo do preto.
    { type: "attack", attacker: "red", target: "black", move: "corteLateral" },

    // ---- RESPOSTA DO PRETO ----------------------------------------------
    // Ele nao fica so apanhando: dois rapidos, o segundo entra.
    { type: "recover", who: "black", duration: s(0.5) },
    { type: "blocked", attacker: "black", target: "red", move: "corteRapido" },
    { type: "attack", attacker: "black", target: "red", move: "corteRapido" },

    { type: "recover", who: "red", duration: s(0.5) },
    { type: "hold", duration: s(0.5), label: "respiro" },
  ],
};
