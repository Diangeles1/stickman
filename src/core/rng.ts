/**
 * Aleatoriedade com semente.
 *
 * POR QUE ISSO EXISTE: o Remotion renderiza cada quadro de forma independente,
 * possivelmente em processos paralelos. Usar Math.random() dentro de um
 * componente daria um valor diferente por quadro e a luta tremeria na tela.
 * Toda variacao precisa ser funcao pura da semente.
 *
 * Regra do projeto: nenhum arquivo em src/ chama Math.random(). Variacao vem
 * daqui, com a semente vinda das props da composicao.
 */

/** mulberry32: gerador pequeno, rapido e de qualidade suficiente para visual. */
export const criarRng = (semente: number): (() => number) => {
  let a = semente >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};

/**
 * Valor estavel a partir de uma chave de texto e uma semente.
 *
 * Serve para "esta particula sempre nasce neste lugar" sem guardar estado:
 * a chave identifica a particula, a semente identifica a luta, e o resultado
 * e o mesmo em qualquer quadro e em qualquer processo de render.
 */
export const hashRng = (chave: string, semente: number): number => {
  let h = semente >>> 0;
  for (let i = 0; i < chave.length; i++) {
    h = Math.imul(h ^ chave.charCodeAt(i), 0x01000193) >>> 0;
  }
  return criarRng(h)();
};

/** Numero entre min e max, estavel para a chave dada. */
export const entre = (
  chave: string,
  semente: number,
  min: number,
  max: number,
): number => min + hashRng(chave, semente) * (max - min);

/** Escolhe um item da lista de forma estavel para a chave dada. */
export const escolher = <T,>(chave: string, semente: number, itens: readonly T[]): T =>
  itens[Math.floor(hashRng(chave, semente) * itens.length) % itens.length];
