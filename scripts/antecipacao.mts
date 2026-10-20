/**
 * ANTECIPACAO: o corpo ENTRA na pose de carga, e nao aparece nela.
 *
 * Este script existe porque scripts/cadeia.mts vinha acusando "corpo se
 * movendo como bloco" e o diagnostico estava errado -- meu, nao dele. A
 * corrente cinetica nao estava comprimida: o que acontecia era que TODA a
 * preparacao cabia num quadro.
 *
 * Medido num soco rapido antes da correcao, as chaves da trilha eram
 *
 *   412  advance   x -602
 *   415  coil      x -621     <- tres quadros para a antecipacao inteira
 *   417  coil      x -556     <- dois para o passo
 *   422  punchFast x -556
 *
 * e o desenho mostrava quadril, pescoco, ombro, cotovelo e punho se
 * deslocando TODOS no mesmo quadro, dez vezes mais que nos vizinhos. Um corpo
 * que teleporta para a pose de carga.
 *
 * Um medidor de corrente nao consegue distinguir isso de uma corrente
 * comprimida, porque nos dois casos as juntas picam juntas. Dai este, que
 * pergunta outra coisa: DENTRO da preparacao, o deslocamento do corpo esta
 * espalhado pelos quadros ou concentrado num?
 *
 * A conta e a razao entre o maior deslocamento de um quadro e a mediana dos
 * deslocamentos da janela. Perto de 1 o corpo entra na pose; alto, ele salta
 * para ela.
 *
 * Uso: npx tsx scripts/antecipacao.mts [luta]
 */

import {
  corpoNoQuadro,
  ehQuadroDeDesenho,
  juntasDoCorpo,
} from "../src/animation/corpo";
import { compilar } from "../src/core/timeline";
import { escolherLuta } from "./lutas.mjs";
import type { FighterId, JointName } from "../src/core/types";

const { nome: qual, spec } = escolherLuta(process.argv[2], "ninjas");
const t = compilar(spec);

/**
 * Acima disto o corpo SALTA para a pose em vez de entrar nela.
 *
 * Um pico de tres vezes a mediana ainda e aceleracao -- e ate desejavel, e o
 * que da a "chicotada" da preparacao. Seis vezes ja nao e aceleracao: e o
 * movimento inteiro num quadro so, com os vizinhos parados.
 */
const SALTO = 6;

/** juntas que representam o corpo, sem os membros que fazem o golpe */
const TRONCO: JointName[] = ["hip", "neck", "head", "shoulderFront", "shoulderBack"];

/*
  SO OS QUADROS EM QUE O DESENHO MUDA.

  Contar os quadros segurados junto arruina a conta: eles tem deslocamento
  ZERO por construcao, puxam a mediana para o chao e fazem qualquer movimento
  parecer um salto de vinte vezes. Foi o que a primeira versao deste script
  mediu -- razao media de 41 -- e o numero era da regua.

  O espectador compara o desenho que ve com o proximo desenho que ve. E essa
  a unica comparacao que significa alguma coisa.
*/
const deslocamento = (quem: FighterId, f: number, anterior: number): number => {
  const a = juntasDoCorpo(corpoNoQuadro(t, quem, anterior));
  const b = juntasDoCorpo(corpoNoQuadro(t, quem, f));
  let soma = 0;
  for (const j of TRONCO) soma += Math.hypot(b[j].x - a[j].x, b[j].y - a[j].y);
  return soma / TRONCO.length;
};

console.log(`${qual}\n`);
console.log("golpe                    quadros  pico  mediana  razao");
console.log("-".repeat(58));

let ruins = 0;
let total = 0;
const razoes: number[] = [];

for (const mira of t.aims) {
  if (mira.recuo) continue;
  /*
    A JANELA E SO A PREPARACAO: do fim do golpe anterior deste lutador ate o
    inicio do disparo. Incluir o disparo mediria o soco, que DEVE ter um pico
    -- e o pico do soco esconderia o salto da carga.
  */
  const anterior = t.aims
    .filter((m) => m.who === mira.who && m !== mira && m.to < mira.from)
    .reduce<number>((maior, m) => Math.max(maior, m.to), 0);
  /*
    A JANELA COMECA ONDE A PREPARACAO COMECA, e nao 26 quadros antes do
    disparo.

    O 26 era um chute, e ele custou caro. A janela alcancava o fim do golpe
    ANTERIOR e o intervalo parado entre os dois, e isso misturava trechos
    desenhados em resolucoes DIFERENTES: a preparacao e o disparo ganham
    desenho em todo quadro, o intervalo entre golpes nao (ver quadroDoDesenho
    em animation/corpo). Numa janela mista, `/passo` compara delta de um
    quadro com MEDIA de dois -- e media achata pico.

    Medido no duelo do vale, golpe `gold -> green guarda` com disparo em 1038:
    a janela 1012..1038 tinha 1013-1020 em 1s, 1022-1032 em 2s e 1033-1038 em
    1s. Razao 6.39, reprovado. A MESMA motion reamostrada de dois em dois da
    5.01, aprovado. O veredito estava decidindo pela resolucao da medida, nao
    pelo corpo.

    `AimEvent.preparo` existe exatamente para isto (ver core/types) e da a
    janela que este script sempre disse medir: a preparacao, inteira e so ela.

    O QUE A TROCA DE JANELA FEZ COM O TOTAL, somando as nove lutas:

                              janela antiga   janela nova
      motor sem `preparo`          14              2
      motor com `preparo`          18              5

    A janela antiga inflava os dois lados. O numero que vale e a coluna da
    direita, e ela continua mostrando um custo real da mudanca de `preparo`
    (2 -> 5): a janela nova conserta a REGUA, nao o movimento.
  */
  const de = Math.max(1, anterior, mira.preparo ?? mira.from - 26);
  const ate = mira.from;
  const desenhos: number[] = [];
  for (let f = de; f <= ate; f++) if (ehQuadroDeDesenho(t, mira.who, f)) desenhos.push(f);
  if (desenhos.length < 4) continue;
  const ds: number[] = [];
  for (let i = 1; i < desenhos.length; i++) {
    // normalizado POR QUADRO: um desenho segurado dois quadros cobre o dobro
    // do caminho, e comparar o bruto acusaria salto onde so ha passo maior
    const passo = desenhos[i] - desenhos[i - 1];
    ds.push(deslocamento(mira.who, desenhos[i], desenhos[i - 1]) / passo);
  }
  const ordenado = [...ds].sort((a, b) => a - b);
  const mediana = ordenado[Math.floor(ordenado.length / 2)] || 0.001;
  const pico = ordenado[ordenado.length - 1];
  const razao = pico / Math.max(0.5, mediana);
  razoes.push(razao);
  total++;
  const ruim = razao > SALTO;
  if (ruim) ruins++;
  console.log(
    `${mira.who.padEnd(6)}-> ${String(mira.alvo).padEnd(7)} ${String(mira.ponto).padEnd(8)}` +
      `${String(desenhos.length).padStart(5)}  ${pico.toFixed(0).padStart(5)}  ${mediana.toFixed(1).padStart(7)}  ` +
      `${razao.toFixed(1).padStart(5)}${ruim ? "   <<< SALTA PARA A POSE" : ""}`,
  );
}

razoes.sort((a, b) => a - b);
const mediaRazao = razoes.reduce((s, r) => s + r, 0) / Math.max(1, razoes.length);
console.log(
  `\nrazao media: ${mediaRazao.toFixed(2)}   mediana: ${(razoes[Math.floor(razoes.length / 2)] ?? 0).toFixed(2)}   pior: ${(razoes[razoes.length - 1] ?? 0).toFixed(1)}`,
);

if (ruins === 0) {
  console.log(`\nAPROVADO: o corpo entra nas ${total} preparacoes em vez de saltar para elas.`);
} else {
  console.log(`\nREPROVADO: ${ruins}/${total} preparacoes acontecem num quadro so.`);
  process.exit(1);
}
