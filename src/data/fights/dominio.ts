/**
 * DOMINIO: O DE BRANCO contra O DE MARCAS.
 *
 * Homenagem ao genero de batalha de feiticeiros, com personagens e nomes de
 * tecnica PROPRIOS. O visual evoca os arquetipos (o de cabelo claro que luta a
 * distancia; o marcado que corta de longe e queima de perto) sem reproduzir o
 * desenho de nenhum personagem existente: as marcas do rosto sao padrao deste
 * projeto e os nomes de golpe sao deste projeto.
 *
 * Roteiro:
 *
 *   ENCONTRO        os dois se medem; o olho aceso de um lado, as marcas do
 *                   outro
 *   INVESTIDA       primeira troca, ninguem cede
 *   CORTE A DISTANCIA  o marcado corta sem encostar
 *   CHAMAS          a resposta de fogo, tres vezes
 *   VAZIO vs CHAMA  a esfera contra o feixe: o choque que decide
 *   CHOQUE FINAL    as laminas cruzam e quebram
 *   ENCARAR         a pergunta para a plateia
 *
 * O de branco tem speed alto e power baixo (ver presets): ele responde antes,
 * mas nao derruba. O marcado e o contrario. A diferenca aparece no ritmo da
 * luta sem precisar coreografar isso aqui.
 */

import type { FightSpec } from "../../core/types";

export const DOMINIO: FightSpec = {
  fighterA: "black",
  fighterB: "red",
  seed: 616,
  fps: 60,
  width: 1080,
  height: 1920,
  intensity: 8,
  scenario: "metropole",
  // silhueta mais aberta: tronco baixo no avanco, passada longa, poses que
  // passam do ponto. Ver animation/estilo.ts.
  estilo: "anime",
  // SEM ARMAS, de proposito: os dois lutam de mao limpa. O corte do marcado
  // e a distancia, entao o movimento de corte sem lamina na mao le como
  // "cortou sem encostar" -- que e exatamente o golpe dele. Tirar a katana
  // faz o compilador voltar as poses desarmadas sozinho (ver timeline.ts).
  nomes: { black: "PRETO", red: "VERMELHO" },
  poderes: { black: "VAZIO", red: "CHAMA" },
  cinematico: true,
  beats: [
    // Nas tecnicas, `gelo` e quem luta com energia a distancia (o de branco)
    // e `fogo` e quem corta e queima (o marcado). Sao papeis, nao elementos.
    //
    // A ordem conta uma escalada: ele testa, nao passa; ele testa de longe,
    // acerta; o outro responde com o que tem; e o ultimo golpe decide.
    // ABERTURA: a rua vazia, um entra andando, o outro ja estava la. E o
    // que faz o primeiro golpe significar alguma coisa.
    { type: "tecnica", tecnica: "chegada", gelo: "black", fogo: "red" },
    { type: "tecnica", tecnica: "encontroFeiticeiros", gelo: "black", fogo: "red" },
    // 1. o marcado entra na porrada e a barreira para o soco no ar
    { type: "tecnica", tecnica: "barreira", gelo: "black", fogo: "red" },
    // 2. entao ele para de encostar: corta de longe, e funciona
    { type: "tecnica", tecnica: "corteADistancia", gelo: "black", fogo: "red" },
    // troca curta de perto, para a luta nao virar so poder
    // Golpes de MAO LIMPA. corteSobe/corteDesce sao golpes de lamina: o motor
    // mede a distancia de combate pelo alcance da katana (ver distanciaDeCombate
    // com def.lamina), e numa luta sem arma a mao parava a 106 unidades do alvo
    // com folga esperada de 83 -- scripts/contato.mts reprovava.
    { type: "blocked", attacker: "red", target: "black", move: "punchHeavy" },
    {
      type: "dodged",
      attacker: "red",
      target: "black",
      move: "kickLow",
      targetPoint: "legs",
      pulo: true,
    },
    // 3. a resposta: puxa e arremessa
    { type: "tecnica", tecnica: "azulVermelho", gelo: "black", fogo: "red" },
    // 4. o marcado abre o dominio e cobre a tela de cortes
    { type: "tecnica", tecnica: "dominio", gelo: "black", fogo: "red" },
    // 5. o ultimo golpe: as duas esferas viram uma so
    { type: "tecnica", tecnica: "vazioRoxo", gelo: "black", fogo: "red" },
    { type: "tecnica", tecnica: "encarar", gelo: "black", fogo: "red" },
  ],
};
