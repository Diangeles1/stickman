/**
 * O DUELO DO DIA: a mesma luta, nunca igual duas vezes.
 *
 * O canal publica um duelo por dia, e um video diario tem uma exigencia que
 * um video avulso nao tem: ele nao pode parecer o de ontem. Mas tambem nao
 * pode ser escrito do zero toda vez -- coreografia escrita a mao e o que
 * custa caro aqui, e manter sete delas em sincronia com o motor seria pior
 * que ter uma so.
 *
 * A saida e separar o que varia do que nao varia:
 *
 *   O QUE NAO VARIA   o cenario, o estilo, o placar, a tela de escolha, a
 *                     estrutura de tres atos (troca -> virada -> decisao).
 *   O QUE VARIA       os nomes, quem vence, e o ROTEIRO -- qual das cenas
 *                     grandes entra em que momento.
 *
 * Tres roteiros bastam para o espectador nao reconhecer o de ontem, porque o
 * que ele guarda de um Short e a CENA GRANDE (o arremesso contra a rocha, a
 * perseguicao no ar, o recuo para o fundo do vale), e nao a ordem dos socos.
 * Trocar qual delas abre e qual fecha muda o video inteiro de lugar na
 * memoria.
 *
 * O VENCEDOR TAMBEM GIRA, e isso nao e detalhe: a tela de escolha pede uma
 * aposta, e aposta que sempre da no mesmo lado deixa de ser aposta. Quem
 * acertou ontem precisa poder errar hoje.
 */

import type { Beat, FightSpec } from "../../core/types";
import { trocarVencedor } from "../trocar";

/**
 * Nomes de crianca, e sao eles que fazem o video ser clicado.
 *
 * Os mais registrados no Brasil (Arpen/IBGE). Uma crianca que ve o proprio
 * nome na tela de escolha nao esta assistindo a dois bonecos: esta
 * assistindo a si mesma. E o motivo de a lista ser de nomes comuns e nao de
 * nomes bonitos -- o que vale e a chance de acertar o de quem assiste.
 */
export const NOMES = [
  "MIGUEL", "RAVI", "HEITOR", "ARTHUR", "THEO", "GAEL", "DAVI", "BERNARDO",
  "NOAH", "GABRIEL", "LUCAS", "SAMUEL", "PEDRO", "ANTHONY", "ISAAC", "BENICIO",
  "ENZO", "MATHEUS", "RAFAEL", "JOAO", "LORENZO", "BENJAMIN", "NICOLAS", "VICENTE",
] as const;

/**
 * As chamadas do fim, giradas junto com o resto.
 *
 * Pedir sempre a mesma coisa cansa, e cada uma pede uma acao diferente do
 * espectador -- comentar um nome rende mais que comentar um lado, porque dá
 * ao canal a proxima luta de graca.
 */
export const CHAMADAS = [
  ["COMENTA", "QUEM VOCE QUER", "VER LUTAR!"],
  ["DA LIKE", "E SE INSCREVE", "NO CANAL!"],
  ["COMENTA O NOME", "DO PROXIMO", "LUTADOR!"],
  ["QUEM VOCE", "ACHA QUE", "GANHA?"],
] as const;

type Papel = "green" | "gold";
const A: Papel = "green";
const B: Papel = "gold";

/**
 * Os roteiros. Cada um e a MESMA luta em tres atos, com as cenas grandes em
 * posicoes diferentes.
 *
 * Todos terminam com o finalizador no mesmo lugar porque o desfecho e o que
 * menos pode variar: a barra de vida precisa chegar a zero junto com o golpe,
 * e isso e calibrado (ver a escala de dano em effects/espetaculo).
 */
const ROTEIROS: Record<string, Beat[]> = {
  /** O VALE: recuo para o fundo, perseguicao no ar, arremesso na rocha. */
  vale: [
    { type: "tecnica", tecnica: "sumirEColidir", gelo: A, fogo: B },
    { type: "attack", attacker: A, target: B, move: "punchFast" },
    { type: "attack", attacker: A, target: B, move: "elbow", targetPoint: "chest" },
    { type: "combo", attacker: A, target: B, moves: ["punchFast", "punch", "knee"] },
    { type: "tecnica", tecnica: "cercoEmProfundidade", gelo: B, fogo: A },
    { type: "attack", attacker: B, target: A, move: "punchHeavy" },
    { type: "dodged", attacker: A, target: B, move: "kickHigh", targetPoint: "head", pulo: true },
    { type: "attack", attacker: A, target: B, move: "kickHigh", targetPoint: "head" },
    { type: "combo", attacker: B, target: A, moves: ["punchFast", "elbow", "spinKick"] },
    { type: "recover", who: A, duration: 34 },
    { type: "tecnica", tecnica: "perseguicaoNoAr", gelo: A, fogo: B },
    { type: "attack", attacker: B, target: A, move: "knee" },
    { type: "blocked", attacker: A, target: B, move: "punchFast" },
    { type: "tecnica", tecnica: "arremessoNoParedao", gelo: A, fogo: B },
    { type: "recover", who: A, duration: 40 },
    { type: "tecnica", tecnica: "azulVermelho", gelo: A, fogo: B },
    { type: "tecnica", tecnica: "liberarAzul", gelo: A, fogo: B },
    { type: "attack", attacker: A, target: B, move: "punchFast" },
    { type: "attack", attacker: B, target: A, move: "uppercut", targetPoint: "queixo" },
  ],

  /**
   * O AR: a perseguicao abre a luta, e a rocha fica para o clima do fim.
   *
   * Comecar pelo lancamento muda a leitura do duelo inteiro: aqui um dos dois
   * ja sai perdendo, e a virada vem do chao.
   */
  ar: [
    { type: "tecnica", tecnica: "sumirEColidir", gelo: A, fogo: B },
    { type: "attack", attacker: B, target: A, move: "punchFast" },
    { type: "tecnica", tecnica: "perseguicaoNoAr", gelo: A, fogo: B },
    { type: "recover", who: A, duration: 30 },
    { type: "combo", attacker: B, target: A, moves: ["punchFast", "elbow", "spinKick"] },
    { type: "attack", attacker: A, target: B, move: "kickHigh", targetPoint: "head" },
    { type: "dodged", attacker: B, target: A, move: "kickHigh", targetPoint: "head" },
    { type: "attack", attacker: A, target: B, move: "punchHeavy" },
    { type: "tecnica", tecnica: "cercoEmProfundidade", gelo: A, fogo: B },
    { type: "attack", attacker: A, target: B, move: "elbow", targetPoint: "chest" },
    /*
      B DEVOLVE UM AQUI. Sem este golpe, A encadeia CINCO sem resposta ate o
      finalizador (scripts/coreografia.mts, quadro 2112) -- e cinco sem
      resposta nao e virada, e atropelo. Vale para todo roteiro: a decisao do
      fim so tem peso se os dois chegarem nela.
    */
    { type: "attack", attacker: B, target: A, move: "knee" },
    { type: "blocked", attacker: B, target: A, move: "punchFast" },
    { type: "tecnica", tecnica: "arremessoNoParedao", gelo: A, fogo: B },
    { type: "recover", who: A, duration: 40 },
    { type: "tecnica", tecnica: "azulVermelho", gelo: A, fogo: B },
    { type: "tecnica", tecnica: "liberarAzul", gelo: A, fogo: B },
    { type: "attack", attacker: A, target: B, move: "punchFast" },
    { type: "attack", attacker: B, target: A, move: "uppercut", targetPoint: "queixo" },
  ],

  /**
   * A ROCHA: o arremesso vem cedo e a luta acontece DEPOIS dele.
   *
   * E o roteiro em que o perdedor do meio vira o vencedor do fim -- levar a
   * cena mais pesada logo no comeco deixa o resto da luta sendo a recuperacao
   * de quem apanhou.
   */
  rocha: [
    { type: "tecnica", tecnica: "sumirEColidir", gelo: A, fogo: B },
    { type: "combo", attacker: B, target: A, moves: ["punchFast", "punch", "knee"] },
    { type: "blocked", attacker: A, target: B, move: "punchFast" },
    { type: "tecnica", tecnica: "arremessoNoParedao", gelo: A, fogo: B },
    { type: "recover", who: A, duration: 44 },
    { type: "attack", attacker: A, target: B, move: "punchHeavy" },
    { type: "dodged", attacker: B, target: A, move: "kickHigh", targetPoint: "head" },
    { type: "tecnica", tecnica: "cercoEmProfundidade", gelo: A, fogo: B },
    { type: "attack", attacker: A, target: B, move: "kickHigh", targetPoint: "head" },
    { type: "combo", attacker: B, target: A, moves: ["punchFast", "elbow", "spinKick"] },
    { type: "recover", who: A, duration: 30 },
    { type: "tecnica", tecnica: "perseguicaoNoAr", gelo: A, fogo: B },
    { type: "attack", attacker: B, target: A, move: "knee" },
    { type: "tecnica", tecnica: "azulVermelho", gelo: A, fogo: B },
    { type: "tecnica", tecnica: "liberarAzul", gelo: A, fogo: B },
    { type: "attack", attacker: A, target: B, move: "elbow", targetPoint: "chest" },
    { type: "attack", attacker: B, target: A, move: "uppercut", targetPoint: "queixo" },
  ],
};

export const ROTEIROS_DISPONIVEIS = Object.keys(ROTEIROS);

export type Duelo = {
  nomeA: string;
  nomeB: string;
  /** qual roteiro usar (ver ROTEIROS_DISPONIVEIS) */
  roteiro: string;
  /** o da esquerda vence? false inverte os papeis com trocarVencedor */
  venceA: boolean;
  /** qual chamada do fim (indice em CHAMADAS) */
  chamada: number;
  semente: number;
};

/** Monta o FightSpec de um duelo. */
export const duelo = (d: Duelo): FightSpec => {
  const corpo = ROTEIROS[d.roteiro] ?? ROTEIROS.vale;
  const spec: FightSpec = {
    fighterA: A,
    fighterB: B,
    seed: d.semente,
    fps: 60,
    width: 1080,
    height: 1920,
    intensity: 9,
    scenario: "vale",
    estilo: "animeDesenhado",
    nomes: { [A]: d.nomeA, [B]: d.nomeB },
    poderes: { [A]: "MARE", [B]: "TEMPESTADE" },
    // a cor do efeito segue a cor do corpo (ver a nota em core/types)
    paletas: { [A]: "gelo", [B]: "fogo" },
    // SEM `cinematico`: e ele que apaga o placar
    beats: [
      ...corpo,
      /*
        O DESFECHO E IGUAL EM TODOS OS ROTEIROS, e de proposito: a barra de
        vida precisa chegar a zero junto com o finalizador, e essa calibragem
        (ver a escala de dano em effects/espetaculo) depende de quantos golpes
        conectam antes dele.
      */
      { type: "finisher", attacker: B, target: A, move: "spinKick", targetPoint: "chest" },
      { type: "hold", duration: 38, label: "desfecho" },
      { type: "danca", who: B, duration: 76 },
      {
        type: "placa",
        who: B,
        duration: 150,
        linhas: [...CHAMADAS[d.chamada % CHAMADAS.length]],
      },
    ],
  };
  // `trocarVencedor` inverte quem ataca, quem cai, quem finaliza e os papeis
  // das cenas -- inclusive quem e arremessado contra a rocha
  return d.venceA ? trocarVencedor(spec) : spec;
};

/**
 * O duelo de uma data, sempre o mesmo para a mesma data.
 *
 * Determinismo importa aqui: o video de ontem tem que continuar sendo
 * reproduzivel (para corrigir um defeito e re-renderizar sem virar outro
 * video), e o de amanha tem que poder ser conferido hoje. Sorteio com estado
 * daria um video diferente a cada execucao.
 *
 * Os nomes andam de DOIS em dois pelo calendario para o par nunca repetir no
 * mesmo ciclo, e o roteiro e a chamada giram em periodos diferentes do
 * vencedor -- assim a combinacao demora a se repetir mesmo com poucas partes.
 */
export const dueloDoDia = (data: Date): Duelo => {
  const dia = Math.floor(
    Date.UTC(data.getUTCFullYear(), data.getUTCMonth(), data.getUTCDate()) / 86400000,
  );
  const i = (dia * 2) % NOMES.length;
  const j = (dia * 2 + 1 + Math.floor(dia / NOMES.length)) % NOMES.length;
  return {
    nomeA: NOMES[i],
    nomeB: NOMES[j === i ? (j + 1) % NOMES.length : j],
    roteiro: ROTEIROS_DISPONIVEIS[dia % ROTEIROS_DISPONIVEIS.length],
    venceA: dia % 2 === 0,
    chamada: dia % CHAMADAS.length,
    semente: 4000 + (dia % 997),
  };
};
