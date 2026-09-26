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
  /** posicao e pose atuais de cada lutador */
  estado: Record<string, { x: number; pose: PoseName; airborne: boolean }>;
  /** escreve uma pose (e opcionalmente uma posicao) num quadro */
  pose: (quem: FighterId, p: PoseName, quadro: number, x?: number) => void;
  /** agenda um efeito de poder */
  poder: (e: PoderEvent) => void;
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
