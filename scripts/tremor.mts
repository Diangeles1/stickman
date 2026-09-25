/**
 * Auditoria de TREMOR: o lutador parado fica parado?
 *
 * Mede a ACELERACAO vertical dos pes quadro a quadro. Pe apoiado de alguem
 * que nao esta se deslocando tem aceleracao zero; qualquer oscilacao ali e
 * perna tremendo, e perna tremendo e a primeira coisa que denuncia boneco
 * feito por codigo.
 *
 * O defeito que deu origem a esta auditoria: a base das poses era mais larga
 * do que a perna alcanca, entao o planejamento dos pes achava a perna
 * "esticada demais" e mandava dar um passo; o passo caia no mesmo lugar, e o
 * lutador PARADO marchava no lugar duas vezes por segundo.
 *
 * Uso: npx tsx scripts/tremor.mts [luta]
 */

import { corpoNoQuadro, juntasDoCorpo } from "../src/animation/corpo";
import { compilar } from "../src/core/timeline";
import { BENCHMARK } from "../src/data/fights/benchmark";
import { BENCHMARK2 } from "../src/data/fights/benchmark2";
import { LUTA_COMPLETA } from "../src/data/fights/luta-completa";
import { GELO_VS_FOGO } from "../src/data/fights/gelo-vs-fogo";
import { DUELO } from "../src/data/fights/duelo";
import { UM_SOCO } from "../src/data/fights/um-soco";
import { trocarVencedor } from "../src/data/trocar";
import { gerarLuta } from "../src/data/gerador";
import type { FighterId, JointName } from "../src/core/types";

/** abaixo desta velocidade o corpo conta como parado */
const PARADO = 3;

/**
 * Poses de ESPERA: e so nelas que "parado" quer dizer parado.
 *
 * Num golpe a perna se move rapido de proposito (o pe de tras empurra o
 * chao), e uma reacao joga o corpo inteiro: medir aceleracao de pe ali
 * acusaria justamente a animacao que a gente quer.
 */
/** trecho parado mais curto que isto nao da para julgar */
const TRECHO_MINIMO = 30;
/** quadros do fim do trecho que ja pertencem ao movimento seguinte */
const SAIDA = 5;

const POSES_PARADAS = new Set([
  "idle",
  "guard",
  "guardaKatana",
  "block",
  "bloqueioKatana",
]);

const qual = process.argv[2] ?? "duelo";
const spec = qual.startsWith("gerada:")
  ? gerarLuta(Number(qual.split(":")[1]) || 1, { segundos: 30 })
  : qual === "duelo"
    ? DUELO
    : qual === "gelofogo"
      ? GELO_VS_FOGO
      : qual === "completa-vermelho"
        ? trocarVencedor(LUTA_COMPLETA)
        : qual === "completa"
          ? LUTA_COMPLETA
          : qual === "benchmark2"
            ? BENCHMARK2
            : qual === "um-soco"
              ? UM_SOCO
              : BENCHMARK;
const t = compilar(spec);

console.log(`luta: ${qual}\n`);

/**
 * TREMOR e oscilacao REPETIDA.
 *
 * Um pe que levanta uma vez e assenta esta corrigindo a posicao: e o passo
 * que o corpo da ao parar, e ele deve existir. O que nao pode e o pe subir e
 * descer de novo e de novo com o lutador parado no mesmo lugar.
 *
 * E passo que LEVA O PE A ALGUM LUGAR tambem nao e tremor: saindo de um
 * cambaleio o pe esta 260 unidades atras do corpo, e ele precisa de dois
 * passos para voltar para debaixo do quadril. Isso e o lutador recuperando a
 * base, e e exatamente o que se quer ver.
 *
 * A diferenca entre os dois e simples: ACOMODACAO PARA, TREMOR NAO PARA. O
 * lutador que se recompoe da dois passos no comeco e depois fica imovel; o
 * que treme continua levantando o pe ate o fim do trecho.
 *
 * Entao a medida e: num trecho em que o lutador fica na MESMA pose de espera,
 * o pe levantou duas ou mais vezes, terminou praticamente onde comecou, E
 * ainda estava levantando o pe na segunda metade do trecho.
 */
const ALTURA_DE_LEVANTAR = 4;
/**
 * Deslocamento total que faz os passos serem "ir a algum lugar", em unidades
 * de mundo. Abaixo disto o pe voltou para onde estava: tremor.
 */
const PASSO_QUE_LEVA = 60;
let reprovados = 0;
let piorTrecho = { levantadas: 0, id: "", de: 0, ate: 0 };

for (const id of [spec.fighterA, spec.fighterB] as FighterId[]) {
  let inicio = -1;
  let poseDoTrecho = "";
  const fechar = (fimCru: number) => {
    // O corpo comeca a sair ANTES de a pose mudar de nome: os ultimos quadros
    // de um trecho parado ja sao o comeco do proximo movimento, e o pe que
    // levanta ali e o primeiro passo dele, nao tremor.
    const fim = fimCru - SAIDA;
    if (inicio < 0 || fim - inicio < TRECHO_MINIMO) return;
    for (const pe of ["footFront", "footBack"] as JointName[]) {
      let levantadas = 0;
      let noAlto = false;
      const xInicial = juntasDoCorpo(corpoNoQuadro(t, id, inicio))[pe].x;
      let xFinal = xInicial;
      let ultimaLevantada = inicio;
      for (let f = inicio; f <= fim; f++) {
        const j = juntasDoCorpo(corpoNoQuadro(t, id, f))[pe];
        xFinal = j.x;
        if (!noAlto && j.y < -ALTURA_DE_LEVANTAR) {
          noAlto = true;
          levantadas++;
          ultimaLevantada = f;
        } else if (noAlto && j.y > -1) {
          noAlto = false;
        }
      }
      const andou = Math.abs(xFinal - xInicial);
      // ainda levantava o pe depois da metade do trecho: nao parou
      const naoParou = ultimaLevantada > inicio + (fim - inicio) / 2;
      if (levantadas >= 2 && andou < PASSO_QUE_LEVA && naoParou) {
        reprovados++;
        if (levantadas > piorTrecho.levantadas) {
          piorTrecho = { levantadas, id, de: inicio, ate: fim };
        }
        console.log(
          `  ${id} ${pe}: ${levantadas} levantadas entre os quadros ${inicio} e ${fim} ` +
            `(${poseDoTrecho}), andou so ${andou.toFixed(0)}`,
        );
      }
    }
  };
  for (let f = 0; f < t.durationInFrames; f++) {
    const c = corpoNoQuadro(t, id, f);
    const parado =
      !c.noAr && POSES_PARADAS.has(c.poseNome) && Math.abs(c.velocidade) <= PARADO;
    if (parado && c.poseNome === poseDoTrecho) continue;
    fechar(f - 1);
    inicio = parado ? f : -1;
    poseDoTrecho = parado ? c.poseNome : "";
  }
  fechar(t.durationInFrames - 1);
}

console.log(
  reprovados === 0
    ? "\nAPROVADO: lutador parado fica parado."
    : `\nREPROVADO: ${reprovados} trechos com perna tremendo ` +
        `(pior: ${piorTrecho.levantadas} levantadas em ${piorTrecho.id}).`,
);
process.exit(0);
