/**
 * A LUTA USA O PALCO, ou acontece em cima de um tapete?
 *
 * O defeito mais comum de coreografia aqui e dois bonecos a tres metros um do
 * outro trocando golpes com o cenario inteiro ignorado atras deles. "Esta
 * parado" e impressao; este script da numero.
 *
 * O que ele mede, por luta:
 *
 *   LARGURA      o quanto de x a luta percorre. Troca de socos no mesmo lugar
 *                gasta umas poucas centenas de unidades; perseguicao gasta
 *                milhares.
 *   PROFUNDIDADE o maior z alcancado. O motor tem eixo de profundidade
 *                (escalaDaProfundidade em animation/corpo) e quase nenhuma
 *                cena o usa.
 *   ALTURA       o quanto o quadril sobe acima do apoio, e quantos quadros os
 *                corpos passam no ar. Luta so na horizontal cansa.
 *   CENARIO      quantos impactos acontecem contra ALGUMA COISA (rachadura no
 *                chao, paredao) em vez de so contra o outro corpo.
 *   TEMPO PARADO quadros em que os dois ficam na mesma faixa de 150 unidades
 *                sem nenhum dos dois sair do lugar.
 *
 * Nao ha limiar de aprovacao aqui de proposito: o numero bom depende do
 * roteiro, e uma cena intima pode ser melhor parada. Ele existe para comparar
 * roteiros entre si e para acusar o roteiro que nao sai do lugar.
 *
 * Uso: npx tsx scripts/palco.mts [luta]
 */

import { corpoNoQuadro, juntasDoCorpo } from "../src/animation/corpo";
import { compilar } from "../src/core/timeline";
import type { FighterId } from "../src/core/types";
import { escolherLuta } from "./lutas.mjs";

const { nome: qual, spec } = escolherLuta(process.argv[2], "dia");
const t = compilar(spec);
const lutadores = [spec.fighterA, spec.fighterB] as FighterId[];

/** os dois estao praticamente colados nesta faixa */
const FAIXA_PARADA = 150;

let xMin = Infinity;
let xMax = -Infinity;
let zMax = 0;
let alturaMax = 0;
let quadrosNoAr = 0;
let quadrosParados = 0;

for (let f = 0; f <= t.durationInFrames; f++) {
  const corpos = lutadores.map((id) => corpoNoQuadro(t, id, f));
  for (const c of corpos) {
    xMin = Math.min(xMin, c.x);
    xMax = Math.max(xMax, c.x);
    zMax = Math.max(zMax, Math.abs(c.z));
    if (c.noAr) quadrosNoAr++;
    // altura do quadril acima do chao daquele plano
    const quadril = juntasDoCorpo(c).hip;
    alturaMax = Math.max(alturaMax, -quadril.y);
  }
  if (Math.abs(corpos[0].x - corpos[1].x) < FAIXA_PARADA) quadrosParados++;
}

/*
  IMPACTO CONTRA O CENARIO. `cracksGround` e o unico sinal que o motor tem de
  que o golpe atingiu ALGUMA COISA alem do corpo do outro. E pouco -- nao
  distingue chao de parede -- mas e o que existe, e serve para separar a luta
  que mexe no lugar da que acontece no vacuo.
*/
const contraCenario = t.impacts.filter((i) => i.cracksGround).length;

const cenas = spec.beats.filter((b) => b.type === "tecnica").length;

console.log(`luta: ${qual}  (${t.durationInFrames} quadros, cenario ${spec.scenario})\n`);
console.log(`  largura usada      ${(xMax - xMin).toFixed(0)} unidades`);
console.log(`  profundidade       ${zMax.toFixed(0)} unidades`);
console.log(`  altura maxima      ${alturaMax.toFixed(0)} unidades`);
console.log(`  quadros no ar      ${quadrosNoAr} (${((quadrosNoAr / (t.durationInFrames * 2)) * 100).toFixed(0)}%)`);
console.log(`  impactos no cenario ${contraCenario} de ${t.impacts.length}`);
console.log(`  cenas coreografadas ${cenas}`);
console.log(
  `  colados (<${FAIXA_PARADA}u)   ${quadrosParados} quadros ` +
    `(${((quadrosParados / t.durationInFrames) * 100).toFixed(0)}% da luta)`,
);
