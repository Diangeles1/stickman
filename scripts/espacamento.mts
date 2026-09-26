/**
 * Medidor de ESPACAMENTO: o golpe acelera ou anda em velocidade constante?
 *
 * Timing e quantos quadros uma acao leva. SPACING e como a distancia se
 * distribui entre eles -- e e o spacing, nao o timing, que separa animacao de
 * luta de interpolacao. Um punho que percorre 300 unidades em 10 quadros pode
 * fazer 30 por quadro (leitura de boneco deslizando) ou 4,4,8,40,120,90,20,...
 * (leitura de soco). Mesma duracao, mesmo destino, leitura oposta.
 *
 * A revisao descreveu isso como "bracos, pernas e corpo parecem se deslocar
 * com velocidade constante" e "precisa de slow-in / slow-out + aceleracao
 * brusca". Supor que e verdade nao serve; este script mede.
 *
 * Tres numeros por golpe, sobre a junta que ataca:
 *
 *   PICO/MEDIA   razao entre o maior deslocamento por quadro e a media da
 *                janela. Em 1.0 o movimento e perfeitamente linear. Anime de
 *                luta vive acima de 3: quase tudo acontece em dois ou tres
 *                quadros e o resto e preparacao e assentamento.
 *   RECUO        quanto a ponta anda PARA TRAS antes de sair. Antecipacao que
 *                nao existe da zero, e sem ela o golpe comeca do nada.
 *   HOLD         quadros quase parados depois do contato. A pausa curta no
 *                extremo e o que deixa o olho ler a pose forte; sem ela a
 *                extensao maxima passa sem ser vista.
 *
 * Uso: npx tsx scripts/espacamento.mts [luta]
 */

import { corpoNoQuadro, juntasDoCorpo } from "../src/animation/corpo";
import { logicoParaReal } from "../src/core/tempo";
import { compilar } from "../src/core/timeline";
import { BENCHMARK } from "../src/data/fights/benchmark";
import { BENCHMARK2 } from "../src/data/fights/benchmark2";
import { DOMINIO } from "../src/data/fights/dominio";
import { LUTA_COMPLETA } from "../src/data/fights/luta-completa";
import { UM_SOCO } from "../src/data/fights/um-soco";
import type { FighterId, JointName } from "../src/core/types";

const qual = process.argv[2] ?? "benchmark";
const spec =
  qual === "dominio" ? DOMINIO
  : qual === "completa" ? LUTA_COMPLETA
  : qual === "benchmark2" ? BENCHMARK2
  : qual === "um-soco" ? UM_SOCO
  : BENCHMARK;
const t = compilar(spec);

/** quadro logico aproximado de um quadro real, por busca binaria no mapa */
const realParaLogicoAprox = (real: number): number => {
  let lo = 0;
  let hi = t.durationInFrames;
  while (hi - lo > 0.5) {
    const meio = (lo + hi) / 2;
    if (logicoParaReal(t, meio) < real) lo = meio;
    else hi = meio;
  }
  return Math.round(lo);
};

const juntaEm = (id: FighterId, f: number, j: JointName) =>
  juntasDoCorpo(corpoNoQuadro(t, id, f))[j];

console.log(`luta: ${qual}\n`);
console.log("  golpe                     pico/media   recuo   hold  leitura");

const razoes: number[] = [];
const recuos: number[] = [];

for (const mira of t.aims) {
  const de = mira.from;
  const ate = mira.contact;
  if (ate - de < 3) continue;

  /*
    O deslocamento e medido SO NA DIRECAO DO GOLPE. O total (hypot) mistura
    o avanco com o arco lateral, e um arco largo mascara aceleracao ruim:
    a junta parece rapida porque esta contornando, nao porque esta chegando.
  */
  const p0 = juntaEm(mira.who, de, mira.joint);
  const p1 = juntaEm(mira.who, ate, mira.joint);
  const dx = p1.x - p0.x;
  const dy = p1.y - p0.y;
  const n = Math.hypot(dx, dy) || 1;
  const ux = dx / n;
  const uy = dy / n;

  const passos: number[] = [];
  for (let f = de + 1; f <= ate; f++) {
    const a = juntaEm(mira.who, f - 1, mira.joint);
    const b = juntaEm(mira.who, f, mira.joint);
    passos.push((b.x - a.x) * ux + (b.y - a.y) * uy);
  }
  const pico = Math.max(...passos);
  const media = passos.reduce((s, v) => s + Math.abs(v), 0) / passos.length;
  const razao = media > 0.01 ? pico / media : 0;

  // RECUO: soma do que a ponta andou contra a direcao do golpe, nos quadros
  // anteriores ao disparo. E a antecipacao medida, nao suposta.
  let recuo = 0;
  for (let f = Math.max(1, de - 18); f <= de; f++) {
    const a = juntaEm(mira.who, f - 1, mira.joint);
    const b = juntaEm(mira.who, f, mira.joint);
    const d = (b.x - a.x) * ux + (b.y - a.y) * uy;
    if (d < 0) recuo += -d;
  }

  /*
    HOLD medido em quadros REAIS, e nao logicos.

    A primeira versao media em quadros logicos e dava zero em todo golpe, o
    que teria me feito concluir que nao ha pausa nenhuma no impacto. Errado:
    o hit stop nao para as juntas, ele repete o mesmo quadro LOGICO em varios
    quadros REAIS (ver core/tempo). Na timeline o punho nunca para; na tela
    ele para. Medir no espaco errado inventa um defeito que nao existe.
  */
  const contatoReal = logicoParaReal(t, ate);
  let hold = 0;
  for (let r = contatoReal; r < contatoReal + 24; r++) {
    if (Math.abs(logicoParaReal(t, ate) - r) > 24) break;
    hold++;
    if (realParaLogicoAprox(r + 1) !== realParaLogicoAprox(r)) break;
  }
  hold = Math.max(0, hold - 1);

  razoes.push(razao);
  recuos.push(recuo);
  const leitura =
    razao >= 3 ? "explode" : razao >= 2 ? "acelera" : "LINEAR";
  console.log(
    `  ${`${mira.who}/${mira.joint}`.padEnd(24)} ` +
      `${razao.toFixed(2).padStart(9)}  ${recuo.toFixed(0).padStart(6)}  ` +
      `${String(hold).padStart(4)}  ${leitura}`,
  );
}

const media = (a: number[]) => (a.length ? a.reduce((s, v) => s + v, 0) / a.length : 0);
const lineares = razoes.filter((r) => r < 2).length;
const semRecuo = recuos.filter((r) => r < 8).length;

console.log(`\ngolpes: ${razoes.length}`);
console.log(`pico/media medio: ${media(razoes).toFixed(2)}  (1 = linear, 3+ = anime)`);
console.log(`recuo medio: ${media(recuos).toFixed(0)} unidades`);
console.log(`golpes lineares (<2): ${lineares}`);
console.log(`golpes sem antecipacao (<8 de recuo): ${semRecuo}`);

if (lineares > razoes.length * 0.3 || semRecuo > razoes.length * 0.3) {
  console.log("\nREPROVADO: espacamento uniforme demais para leitura de combate.");
  process.exit(1);
}
console.log("\nAPROVADO: os golpes aceleram e antecipam.");
