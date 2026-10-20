/**
 * RELOGIO DE TEMPO REAL com passo fixo.
 *
 * Este e o unico arquivo do projeto que sabe o que e "agora". O motor de luta
 * nao sabe: `compilar()` roda uma vez e `corpoNoQuadro(timeline, id, quadro)`
 * e puro no quadro. O Remotion tambem nao -- ele manda o numero do quadro. A
 * pagina de tempo real e o hospedeiro que precisa TRADUZIR milissegundos de
 * parede em numero de quadro, e e so aqui que essa traducao acontece.
 *
 * POR QUE PASSO FIXO, E NAO `delta * fps`
 *
 * O caminho curto seria `quadro += (dt / 1000) * fps`, com quadro fracionario.
 * Isso quebra duas coisas de uma vez:
 *
 *   - `corpoNoQuadro` interpola entre quadros INTEIROS da timeline, e varias
 *     regras do motor sao discretas (`quadroDoDesenho`, o tremor do hit stop,
 *     que troca de sinal a cada quadro). Num quadro fracionario o resultado
 *     depende de como o numero foi arredondado, e a pagina passaria a mostrar
 *     uma animacao que o render do Remotion nunca vai produzir.
 *   - O monitor nao bate com a luta. A 144 Hz, cada quadro de 60 fps dura 2,4
 *     repinturas; a 60 Hz dura 1. Com o acumulador, a pagina mostra o quadro
 *     37 pelo mesmo tempo de parede nos dois monitores, que e exatamente o que
 *     a ferramenta precisa para que "esta rapido demais" seja uma observacao
 *     sobre a ANIMACAO e nao sobre o hardware de quem olha.
 *
 * Entao o tempo entra em milissegundos, e o que sai e um numero INTEIRO de
 * quadros a avancar -- as vezes 0, as vezes 2.
 */

/**
 * Teto de tempo que um unico salto pode consumir, em ms.
 *
 * Trocar de aba, o GC, ou abrir o devtools param o requestAnimationFrame por
 * centenas de ms ou por minutos. Sem teto, o acumulador cobraria a divida toda
 * de uma vez e a luta pularia dois segundos no primeiro retorno. Com 250 ms, o
 * pior salto e 15 quadros a 60 fps: perde-se tempo real, o que e correto numa
 * ferramenta de inspecao, em vez de perder a continuidade.
 */
const MAXIMO_DE_ATRASO = 250;

/** Quantas amostras entram na media de FPS mostrada no painel. */
const AMOSTRAS_DE_FPS = 40;

export type Relogio = {
  /**
   * Avanca o relogio ate `agoraMs` e devolve quantos quadros LOGICOS passaram.
   *
   * `velocidade` 0 congela o tempo sem perder o acumulador, que e o que o
   * pause precisa: ao voltar, nao ha divida acumulada para cobrar.
   */
  avancar: (agoraMs: number, velocidade: number) => number;
  /** repinturas por segundo do navegador, medidas (nao os 60 da luta) */
  fps: () => number;
  /** ms entre as duas ultimas repinturas */
  delta: () => number;
  /** descarta o acumulador: usado ao saltar no tempo (scrub, troca de luta) */
  zerar: () => void;
};

export const criarRelogio = (fps: number): Relogio => {
  const passo = 1000 / fps;
  let anterior: number | null = null;
  let acumulado = 0;
  let delta = 0;
  const amostras: number[] = [];

  return {
    avancar: (agoraMs, velocidade) => {
      if (anterior === null) {
        anterior = agoraMs;
        return 0;
      }
      delta = Math.min(MAXIMO_DE_ATRASO, agoraMs - anterior);
      anterior = agoraMs;

      amostras.push(delta);
      if (amostras.length > AMOSTRAS_DE_FPS) amostras.shift();

      if (velocidade <= 0) return 0;
      acumulado += delta * velocidade;
      let quadros = 0;
      while (acumulado >= passo) {
        acumulado -= passo;
        quadros++;
      }
      return quadros;
    },
    fps: () => {
      if (amostras.length === 0) return 0;
      const soma = amostras.reduce((a, b) => a + b, 0);
      // soma 0 acontece de verdade: dois rAF no mesmo ms logo no inicio
      return soma > 0 ? (amostras.length * 1000) / soma : 0;
    },
    delta: () => delta,
    zerar: () => {
      acumulado = 0;
      anterior = null;
    },
  };
};
