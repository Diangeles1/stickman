/**
 * CONTEXTO DE UMA TECNICA.
 *
 * Uma tecnica cinematografica e uma cena coreografada: ela escreve poses,
 * camera, impactos e poderes de uma vez. Ate aqui todas viviam dentro de um
 * unico switch em core/timeline.ts, que passou de 2000 linhas -- cada cena
 * nova somava umas 60, e nao havia como reaproveitar nada entre elas porque
 * tudo dependia do escopo da funcao que as continha.
 *
 * Este tipo e o que permite mover uma cena para fora: em vez de depender de
 * variaveis livres, ela recebe um objeto com as mesmas ferramentas.
 *
 * O compilador continua sendo o dono de tudo -- as funcoes aqui ESCREVEM nos
 * arrays que ele passa, e devolvem o quadro em que a cena termina. Nenhuma
 * tecnica guarda estado proprio.
 */

import type {
  CameraKey,
  FighterId,
  ImpactEvent,
  NomeDePaleta,
  PoderEvent,
  PoseName,
} from "../types";

/** Ferramentas que o compilador empresta a uma cena. */
export type ContextoDeTecnica = {
  /** quem faz o papel de energia a distancia */
  G: FighterId;
  /** quem faz o papel de forca e corte */
  F: FighterId;
  /** quadro em que a cena comeca */
  c: number;
  /** 1 quando G esta a esquerda de F; -1 quando esta a direita */
  lado: number;
  /** segundos para quadros, ja na taxa do episodio */
  s: (segundos: number) => number;
  /** posicao, profundidade e pose atuais de cada lutador */
  estado: Record<
    string,
    { x: number; z: number; pose: PoseName; airborne: boolean }
  >;
  /**
   * Escreve uma pose, e opcionalmente uma posicao no palco.
   *
   * `z` e a PROFUNDIDADE: 0 e a linha em que a luta sempre aconteceu,
   * positivo afasta da camera, negativo aproxima. Quem nao passa z mantem a
   * profundidade em que o corpo ja estava, entao uma cena move um lutador
   * para o fundo uma vez e as poses seguintes continuam la.
   *
   * Um corpo mais ao fundo fica MENOR e MAIS ALTO na tela, e passa ATRAS do
   * outro (ver escalaDaProfundidade em animation/corpo e a ordenacao em
   * scenes/FightScene). Nenhuma dessas tres coisas e opcional: sozinhas elas
   * nao leem como profundidade.
   */
  pose: (
    quem: FighterId,
    p: PoseName,
    quadro: number,
    x?: number,
    z?: number,
  ) => void;
  /** agenda um efeito de poder */
  poder: (e: PoderEvent) => void;
  /**
   * A paleta de cada papel, ja resolvida (ver `paletas` em FightSpec).
   *
   * Uma cena deve usar estas em vez de escrever "azul"/"vermelho" na mao: e
   * o que faz a cor do efeito seguir a cor do personagem.
   */
  paletaG: NomeDePaleta;
  paletaF: NomeDePaleta;
  /** letreiro com o nome do golpe */
  nome: (texto: string, quem: FighterId, quadro: number) => void;
  cameraKeys: CameraKey[];
  impacts: ImpactEvent[];
  /** altura do quadril no mundo, negativa (acima do chao) */
  ALTURA_QUADRIL: number;
  /** altura tipica da mao, para posicionar efeito de contato */
  MAO_Y: number;
  /** distancia padrao entre os dois na espera */
  DISTANCIA_DE_ESPERA: number;
  /** marcador de efeito que nao acaba */
  PARA_SEMPRE: number;
};

/**
 * Uma cena. Recebe as ferramentas, escreve nos arrays, devolve o quadro final.
 */
export type Tecnica = (ctx: ContextoDeTecnica) => number;
