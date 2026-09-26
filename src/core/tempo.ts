/**
 * MAPA DO TEMPO: quadro real do video <-> quadro logico da timeline.
 *
 * A timeline e escrita em quadros LOGICOS, em que a luta anda sempre na mesma
 * velocidade. O video tem quadros REAIS, e os dois se separam em dois casos:
 *
 *   hit stop      o tempo PARA: varios quadros reais mostram o mesmo quadro
 *                 logico (o golpe "pesa")
 *   camera lenta  o tempo ANDA DEVAGAR: cada quadro real avanca uma fracao de
 *                 quadro logico (factor 0.25 = um quarto de quadro por quadro)
 *
 * Exemplo: soco com hit stop de 6 no quadro 100 e nocaute em camera lenta de
 * 0.25 entre 300 e 315. O quadro logico 100 aparece em 7 quadros reais, e os
 * 15 quadros logicos do nocaute viram 60 quadros reais.
 *
 * O mapa e uma lista de TRECHOS, cada um com velocidade constante. Calculado
 * uma vez por timeline e guardado: e consultado a cada quadro por varias
 * camadas (cena, som, placar).
 */

import { estiloDe } from "../animation/estilo";
import type { Timeline } from "./types";

type Trecho = {
  /** primeiro quadro real do trecho */
  real: number;
  /** quadro logico no inicio do trecho */
  logico: number;
  /** quadros logicos por quadro real: 1 normal, 0 congelado, <1 lento */
  taxa: number;
  /** duracao em quadros reais */
  duracao: number;
};

type Mapa = { trechos: Trecho[]; total: number };

const CACHE = new WeakMap<Timeline, Mapa>();

const montar = (t: Timeline): Mapa => {
  const lentos = t.camaraLenta ?? [];
  const fim = t.durationInFrames;
  const pontos = new Set<number>([0, fim]);
  for (const i of t.impacts) if (i.hitStop > 0) pontos.add(i.frame);
  for (const l of lentos) {
    pontos.add(l.from);
    pontos.add(l.to);
  }
  const ordenados = [...pontos]
    .filter((p) => p >= 0 && p <= fim)
    .sort((a, b) => a - b);

  const trechos: Trecho[] = [];
  let real = 0;
  for (let k = 0; k < ordenados.length; k++) {
    const p = ordenados[k];
    // congelamento: todos os impactos que caem neste quadro logico
    // O hit stop do golpe, escalado pelo ESTILO. Anime congela mais que a
    // vida real; realista quase nao congela. Multiplicador 1 (o da casa)
    // devolve exatamente o valor que o golpe pediu.
    const escala = estiloDe(t.spec.estilo).hitStop;
    const parado = Math.round(
      t.impacts
        .filter((i) => i.hitStop > 0 && i.frame === p)
        .reduce((soma, i) => soma + i.hitStop, 0) * escala,
    );
    if (parado > 0) {
      trechos.push({ real, logico: p, taxa: 0, duracao: parado });
      real += parado;
    }
    const q = ordenados[k + 1];
    if (q === undefined) break;
    const meio = (p + q) / 2;
    const lento = lentos.find((l) => meio >= l.from && meio < l.to);
    const taxa = lento ? lento.factor : 1;
    const duracao = (q - p) / taxa;
    trechos.push({ real, logico: p, taxa, duracao });
    real += duracao;
  }
  return { trechos, total: Math.ceil(real - 1e-6) };
};

const mapa = (t: Timeline): Mapa => {
  let m = CACHE.get(t);
  if (!m) {
    m = montar(t);
    CACHE.set(t, m);
  }
  return m;
};

/** Quadro real do video -> quadro logico (pode ser fracionario na camera lenta). */
export const realParaLogico = (t: Timeline, real: number): number => {
  const { trechos } = mapa(t);
  for (const tr of trechos) {
    if (real < tr.real + tr.duracao) {
      return tr.logico + Math.max(0, real - tr.real) * tr.taxa;
    }
  }
  const ultimo = trechos[trechos.length - 1];
  return ultimo
    ? ultimo.logico + (real - ultimo.real) * (ultimo.taxa || 1)
    : real;
};

/**
 * Quadro logico -> primeiro quadro real em que ele aparece.
 *
 * Num quadro de impacto devolve o INICIO do congelamento: e ali que o som do
 * golpe tem que entrar.
 */
export const logicoParaReal = (t: Timeline, logico: number): number => {
  const { trechos } = mapa(t);
  for (const tr of trechos) {
    if (tr.taxa === 0) {
      if (logico === tr.logico) return tr.real;
      continue;
    }
    if (logico >= tr.logico && logico < tr.logico + tr.duracao * tr.taxa) {
      return tr.real + (logico - tr.logico) / tr.taxa;
    }
  }
  const { total } = mapa(t);
  return total + (logico - t.durationInFrames);
};

/** Duracao do video em quadros reais: logicos + hit stops + camera lenta. */
export const duracaoReal = (t: Timeline): number => mapa(t).total;
