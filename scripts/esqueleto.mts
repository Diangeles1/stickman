/**
 * Auditoria do esqueleto.
 *
 * Mede cada osso em TODAS as poses e em TODAS as misturas entre pares de
 * poses, e reprova se algum comprimento sair do que a pose base define.
 *
 * Existe porque pose escrita a mao e uma lista de posicoes sem restricao
 * entre elas: o braco de tras chegou a 400% do comprimento sem ninguem notar,
 * porque parado isso passa por estilo. O problema aparece EM MOVIMENTO, e a
 * mistura entre poses e onde ele aparece pior.
 *
 * Uso: npx tsx scripts/esqueleto.mts
 */

import { POSES } from "../src/characters/poses";
import { completar, misturar } from "../src/characters/skeleton";
import type { JointName, PoseName, Vec2 } from "../src/core/types";

const OSSOS: [JointName, JointName][] = [
  ["neck", "head"],
  ["shoulderFront", "elbowFront"], ["elbowFront", "handFront"],
  ["shoulderBack", "elbowBack"], ["elbowBack", "handBack"],
  ["hip", "kneeFront"], ["kneeFront", "footFront"],
  ["hip", "kneeBack"], ["kneeBack", "footBack"],
  // o ombro tem que ficar pendurado no pescoco, nao solto no espaco
  ["neck", "shoulderFront"], ["neck", "shoulderBack"],
];

const d = (a: Vec2, b: Vec2) => Math.hypot(b.x - a.x, b.y - a.y);
const base = completar({});
const esperado = OSSOS.map(([a, b]) => d(base[a], base[b]));
const nomes = Object.keys(POSES) as PoseName[];

let pior = 0;
let onde = "";
let reprovados = 0;
const TOLERANCIA = 0.02;

/*
 * PRIMEIRO a prova de identidade, e ela vem antes de proposito.
 *
 * completar() sobre a pose vazia tem que devolver a pose base sem mover nada.
 * Se mover, a derivacao do esqueleto esta errada em algum lugar.
 *
 * Isto existe porque a conferencia de comprimento sozinha JA deixou passar um
 * sinal invertido que espelhava o ombro para o outro lado do pescoco: mesma
 * distancia, lugar errado. Comprimento certo nao prova posicao certa.
 */
{
  const BASE_ESPERADA = {
    hip: { x: 0, y: 0 }, neck: { x: 0, y: -74 }, head: { x: 0, y: -114 },
    shoulderBack: { x: -14, y: -68 }, elbowBack: { x: -20, y: -38 },
    handBack: { x: -4, y: -52 },
    shoulderFront: { x: 14, y: -68 }, elbowFront: { x: 28, y: -38 },
    handFront: { x: 44, y: -56 },
    kneeBack: { x: -22, y: 46 }, footBack: { x: -40, y: 92 },
    kneeFront: { x: 18, y: 46 }, footFront: { x: 34, y: 92 },
  } as Record<JointName, Vec2>;
  let falhou = false;
  for (const junta of Object.keys(BASE_ESPERADA) as JointName[]) {
    const erro = d(base[junta], BASE_ESPERADA[junta]);
    if (erro > 0.01) {
      console.log(`  IDENTIDADE QUEBRADA em ${junta}: esperado (${BASE_ESPERADA[junta].x},${BASE_ESPERADA[junta].y}), veio (${base[junta].x.toFixed(1)},${base[junta].y.toFixed(1)})`);
      falhou = true;
    }
  }
  console.log(
    falhou
      ? "REPROVADO: completar() move juntas da pose base."
      : "identidade: completar() nao move nenhuma junta da pose base.",
  );
  if (falhou) process.exitCode = 1;
}

const conferir = (p: Record<JointName, Vec2>, rotulo: string) => {
  for (let i = 0; i < OSSOS.length; i++) {
    const [a, b] = OSSOS[i];
    const desvio = Math.abs(d(p[a], p[b]) - esperado[i]) / esperado[i];
    if (desvio > pior) {
      pior = desvio;
      onde = `${a}->${b} em ${rotulo}`;
    }
    if (desvio > TOLERANCIA) reprovados++;
  }
};

for (const n of nomes) conferir(completar(POSES[n]), n);

// as misturas: e nelas que o comprimento variavel viraria mao de borracha
for (const x of nomes) {
  for (const y of nomes) {
    if (x === y) continue;
    for (const t of [0.15, 0.35, 0.5, 0.65, 0.85]) {
      conferir(completar(misturar(POSES[x], POSES[y], t)), `${x}->${y} t=${t}`);
    }
  }
}

const total = nomes.length * OSSOS.length + nomes.length * (nomes.length - 1) * 5 * OSSOS.length;
console.log(`${nomes.length} poses, ${total} medidas de osso (poses e misturas)`);
console.log(`pior desvio: ${(pior * 100).toFixed(2)}%  (${onde})`);
console.log(
  reprovados === 0
    ? "APROVADO: nenhum osso muda de comprimento."
    : `REPROVADO: ${reprovados} medidas acima de ${TOLERANCIA * 100}%.`,
);
