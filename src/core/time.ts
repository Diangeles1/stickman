/**
 * Tempo em segundos, nao em quadros.
 *
 * POR QUE ISSO EXISTE: ja erramos isso duas vezes. As duracoes do registro de
 * golpes foram escritas como se o projeto fosse 30fps, e a 60fps um soco com
 * "5 quadros de preparacao" durava 0,08s, imperceptivel, e a luta inteira saia
 * pela metade do tempo.
 *
 * Regra do projeto: pense em SEGUNDOS e converta aqui. Nao escreva numero de
 * quadro na mao em arquivo de coreografia nem de golpe.
 */

/** Taxa de quadros do projeto. Um lugar so. */
export const FPS = 60;

/** Segundos para quadros, arredondado. `s(0.5)` = 30. */
export const s = (segundos: number): number => Math.round(segundos * FPS);

/** Quadros para segundos, util em log e diagnostico. */
export const emSegundos = (quadros: number): number => quadros / FPS;

/**
 * Referencia rapida, para quem estiver lendo a coreografia:
 *   s(0.1) =  6 quadros   um piscar, quase imperceptivel
 *   s(0.2) = 12 quadros   preparacao de golpe rapido
 *   s(0.3) = 18 quadros   golpe medio completo
 *   s(0.5) = 30 quadros   golpe forte completo
 *   s(1.0) = 60 quadros   uma batida de ritmo
 *   s(2.0) = 120 quadros  um beat inteiro de coreografia
 */

/**
 * Altura do corpo em unidades de mundo, para calibrar deslocamento.
 *
 * Fica aqui, e nao no esqueleto, porque quem calibra knockback e camera pensa
 * em "quantos corpos de distancia", nao em pose. Ver ESCALA_POSE.
 */
export const ALTURA_CORPO = 597;

/** Quantos corpos de distancia, em unidades de mundo. `corpos(2)` = 1194. */
export const corpos = (quantidade: number): number =>
  Math.round(quantidade * ALTURA_CORPO);
