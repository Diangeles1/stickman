/**
 * ROTEIRO DO ESPETACULO: o que o placar, os letreiros e os sons extras
 * mostram, e QUANDO.
 *
 * Nada aqui e escrito a mao por luta. Tudo sai dos eventos que o compilador
 * ja produziu (impactos, miras, chaves de pose), entao uma luta nova ganha o
 * espetaculo de graca e ele nunca discorda do que acontece na tela:
 *
 *   impacto limpo       tira vida, conta combo
 *   impacto na guarda   "BLOQUEIO!" e um arranhao na vida
 *   mira congelada      o golpe passou rente: "ESQUIVA!"
 *   acerto logo depois
 *   de esquivar         "CONTRA-ATAQUE!"
 *   impacto finalizador "K.O.!" e o nome do vencedor
 *   chave groundHit     o corpo bateu no chao: poeira e baque
 *
 * Os tempos estao em quadros REAIS (ver core/tempo.ts): o letreiro continua
 * pulsando durante o hit stop e a camera lenta, em vez de congelar junto.
 */

import { corpoNoQuadro } from "../animation/corpo";
import { PUXA } from "../animation/placa";
import { FALAS, type Fala } from "../audio/falas";
import { logicoParaReal } from "../core/tempo";
import { s } from "../core/time";
import type { FighterId, Timeline, Vec2 } from "../core/types";

export const NOMES: Record<FighterId, string> = {
  black: "PRETO",
  red: "VERMELHO",
  blue: "AZUL",
  gold: "DOURADO",
  green: "VERDE",
  white: "BRANCO",
  purple: "ROXO",
};

export type Rotulo = {
  /** quadro real em que aparece */
  inicio: number;
  /** quadros reais na tela */
  duracao: number;
  texto: string;
  /** linha menor embaixo */
  sub?: string;
  cor: string;
  /** altura da letra, em pixels da tela */
  tamanho: number;
  /** -1 esquerda, 0 centro, 1 direita */
  lado: -1 | 0 | 1;
  /** altura na tela, 0 (topo) a 1 (base) */
  y: number;
  /**
   * Letreiros da mesma vaga se substituem: o "3 HITS" apaga o "2 HITS" em
   * vez de empilhar em cima dele.
   */
  vaga: string;
  /** entra batendo (grande -> normal) em vez de so crescer */
  pancada?: boolean;
};

export type Golpe = { real: number; vitima: FighterId; vida: number };
export type ImpactoAnime = { real: number; quadros: number; at: Vec2 };
export type Queda = { logico: number; real: number; x: number };

export type Espetaculo = {
  rotulos: Rotulo[];
  /** vida de cada lutador depois de cada golpe, em ordem */
  golpes: Golpe[];
  /** quadros em negativo (estilo anime) nos golpes mais fortes */
  impactosAnime: ImpactoAnime[];
  quedas: Queda[];
  /** esquivas: quadro real em que o golpe passa rente */
  esquivas: number[];
  ko?: { real: number; vencedor: FighterId };
  /** abertura: placas de nome, VS e LUTE! */
  abertura: { vs: number; lute: number; fim: number };
  /** quando o placar entra */
  entradaDoPlacar: number;
  /** quando a placa do vencedor comeca: o placar e os letreiros saem */
  saidaDoPlacar: number;
  /** o que o narrador fala e quando (quadro real), sem uma fala encavalar */
  falas: { real: number; fala: Fala }[];
};

/** Dano por golpe limpo. Bloqueio so arranha. */
const DANO = { light: 8, medium: 13, extreme: 24 } as const;
const ARRANHAO = 2;
/** Ninguem cai a zero antes do finalizador: o K.O. e dele. */
const VIDA_MINIMA = 12;
/** Golpes do mesmo atacante com menos que isto entre eles sao combo. */
const JANELA_DO_COMBO = s(1.25);
/** Acerto ate isto depois de esquivar conta como contra-ataque. */
const JANELA_DO_CONTRA = s(1.6);

const COR = {
  combo: "#ffd23f",
  bloqueio: "#9fd8ff",
  esquiva: "#7dff9a",
  contra: "#ff8a3d",
  brutal: "#ff4d4d",
  ko: "#ff2e2e",
  vence: "#ffffff",
};

const CACHE = new WeakMap<Timeline, Espetaculo>();

export const espetaculoDe = (t: Timeline): Espetaculo => {
  const pronto = CACHE.get(t);
  if (pronto) return pronto;
  const e = montar(t);
  CACHE.set(t, e);
  return e;
};

const montar = (t: Timeline): Espetaculo => {
  const { fighterA, fighterB } = t.spec;
  const real = (logico: number) =>
    Math.ceil(logicoParaReal(t, logico) - 1e-6);
  /** de que lado da tela o lutador esta neste quadro */
  const ladoDe = (id: FighterId, logico: number): -1 | 1 => {
    const outro = id === fighterA ? fighterB : fighterA;
    return corpoNoQuadro(t, id, logico).x <= corpoNoQuadro(t, outro, logico).x
      ? -1
      : 1;
  };

  const rotulos: Rotulo[] = [];
  const golpes: Golpe[] = [];
  const impactosAnime: ImpactoAnime[] = [];
  const vida: Record<string, number> = { [fighterA]: 100, [fighterB]: 100 };

  // ---- abertura ------------------------------------------------------------
  const abertura = { vs: 8, lute: 46, fim: 44 };

  // ---- esquivas --------------------------------------------------------------
  const esquivas = t.aims
    .filter((m) => m.congelarEm !== undefined)
    .map((m) => ({ quem: m.alvo, logico: m.contact }));
  for (const q of esquivas) {
    rotulos.push({
      inicio: real(q.logico) - 4,
      duracao: 42,
      texto: "ESQUIVA!",
      cor: COR.esquiva,
      tamanho: 92,
      lado: ladoDe(q.quem, q.logico),
      y: 0.26,
      vaga: `def-${q.quem}`,
    });
  }

  // ---- impactos --------------------------------------------------------------
  const impactos = [...t.impacts].sort((a, b) => a.frame - b.frame);
  let combo = { quem: "", n: 0, ultimo: -Infinity };
  let ko: Espetaculo["ko"];
  for (const imp of impactos) {
    const vitima = imp.victim;
    const quem = imp.attacker;
    if (!vitima || !quem) continue;
    const r = real(imp.frame);

    // combo: golpes seguidos do mesmo atacante, sem resposta no meio. A
    // guarda conta: o combo que termina passando pela defesa e justamente o
    // que se quer ver somando na tela
    combo =
      combo.quem === quem && imp.frame - combo.ultimo <= JANELA_DO_COMBO
        ? { quem, n: combo.n + 1, ultimo: imp.frame }
        : { quem, n: 1, ultimo: imp.frame };
    if (combo.n >= 2 && !imp.finalizador) {
      rotulos.push({
        inicio: r,
        duracao: 55,
        texto: `${combo.n} HITS`,
        sub: "COMBO!",
        cor: COR.combo,
        tamanho: 118,
        lado: ladoDe(quem, imp.frame),
        y: 0.25,
        vaga: `combo-${quem}`,
        pancada: true,
      });
    }

    if (imp.bloqueado) {
      vida[vitima] = Math.max(VIDA_MINIMA, vida[vitima] - ARRANHAO);
      golpes.push({ real: r, vitima, vida: vida[vitima] });
      rotulos.push({
        inicio: r,
        duracao: 36,
        texto: "BLOQUEIO!",
        cor: COR.bloqueio,
        tamanho: 84,
        lado: ladoDe(vitima, imp.frame),
        y: 0.26,
        vaga: `def-${vitima}`,
      });
      continue;
    }

    vida[vitima] = imp.finalizador
      ? 0
      : Math.max(VIDA_MINIMA, vida[vitima] - DANO[imp.tier]);
    golpes.push({ real: r, vitima, vida: vida[vitima] });

    if (imp.finalizador) {
      ko = { real: r, vencedor: quem };
      impactosAnime.push({ real: r, quadros: 5, at: imp.at });
      continue;
    }
    if (imp.tier === "extreme") {
      impactosAnime.push({ real: r, quadros: 2, at: imp.at });
    }

    const esquivou = esquivas.some(
      (q) =>
        q.quem === quem &&
        imp.frame > q.logico &&
        imp.frame - q.logico <= JANELA_DO_CONTRA,
    );
    if (esquivou) {
      rotulos.push({
        inicio: r,
        duracao: 50,
        texto: "CONTRA-ATAQUE!",
        cor: COR.contra,
        tamanho: 100,
        lado: 0,
        y: 0.29,
        vaga: "centro",
        pancada: true,
      });
    } else if (imp.tier === "extreme") {
      rotulos.push({
        inicio: r,
        duracao: 48,
        texto: "BRUTAL!",
        cor: COR.brutal,
        tamanho: 130,
        lado: 0,
        y: 0.29,
        vaga: "centro",
        pancada: true,
      });
    }
  }

  // ---- finalizador -----------------------------------------------------------
  const final = t.scheduled.find((b) => b.beat.type === "finisher");
  if (final) {
    rotulos.push({
      inicio: real(final.from),
      duracao: 40,
      texto: "GOLPE FINAL",
      cor: COR.brutal,
      tamanho: 96,
      lado: 0,
      y: 0.215,
      vaga: "centro",
    });
  }
  const fimReal = real(t.durationInFrames);
  const cenaDaPlaca = t.scheduled.find((b) => b.beat.type === "placa");
  // o K.O. e o nome do vencedor saem quando a placa comeca: a tela e dela
  const ateAPlaca = cenaDaPlaca ? real(cenaDaPlaca.from) + 20 : fimReal;
  if (ko) {
    // o K.O. espera o voo abrir: no quadro do golpe a camera esta fechada
    // nos dois e o letreiro cobria justamente a cabeca que levou o chute
    const koNaTela = ko.real + 45;
    rotulos.push({
      inicio: koNaTela,
      duracao: ateAPlaca - koNaTela,
      texto: "K.O.!",
      cor: COR.ko,
      tamanho: 290,
      lado: 0,
      y: 0.28,
      vaga: "centro",
      pancada: true,
    });
    const vence = Math.min(ateAPlaca - 50, koNaTela + 70);
    rotulos.push({
      inicio: vence,
      duracao: ateAPlaca - vence,
      texto: `${NOMES[ko.vencedor]} VENCE!`,
      sub: "QUEM GANHA A REVANCHE?",
      cor: COR.vence,
      tamanho: 124,
      lado: 0,
      y: 0.745,
      vaga: "vence",
      pancada: true,
    });
  }

  // ---- quedas ----------------------------------------------------------------
  const quedas: Queda[] = [];
  for (const id of [fighterA, fighterB]) {
    const chaves = t.tracks[id]?.keys ?? [];
    for (let i = 1; i < chaves.length; i++) {
      if (chaves[i].pose !== "groundHit" || chaves[i - 1].pose === "groundHit") {
        continue;
      }
      const f = chaves[i].frame;
      quedas.push({ logico: f, real: real(f), x: corpoNoQuadro(t, id, f).x });
    }
  }

  return {
    rotulos,
    golpes,
    impactosAnime,
    quedas,
    esquivas: esquivas.map((q) => real(q.logico)),
    ko,
    abertura,
    entradaDoPlacar: abertura.lute,
    saidaDoPlacar: ateAPlaca,
    falas: narrar(t, rotulos, abertura.lute, real),
  };
};

/** Vida de um lutador no quadro real, e o "fantasma" que desce atrasado. */
export const vidaNoQuadro = (
  e: Espetaculo,
  id: FighterId,
  r: number,
): { vida: number; fantasma: number; atingido: number } => {
  let vida = 100;
  let fantasma = 100;
  let atingido = Infinity;
  for (const g of e.golpes) {
    if (g.vitima !== id) continue;
    if (g.real > r) break;
    // o fantasma parte de onde estava no instante do golpe
    const antes = fantasmaEm(fantasma, vida, g.real - atingidoAnterior(e, id, g.real));
    fantasma = antes;
    vida = g.vida;
    atingido = r - g.real;
  }
  return {
    vida,
    fantasma: fantasmaEm(fantasma, vida, atingido),
    atingido,
  };
};

/** o fantasma segura 12 quadros e desce em 24 */
const fantasmaEm = (de: number, para: number, idade: number): number => {
  if (idade < 12) return de;
  if (idade >= 36) return para;
  const k = (idade - 12) / 24;
  return de + (para - de) * (1 - (1 - k) * (1 - k));
};

const atingidoAnterior = (e: Espetaculo, id: FighterId, r: number): number => {
  let ultimo = -Infinity;
  for (const g of e.golpes) {
    if (g.vitima !== id || g.real >= r) continue;
    ultimo = g.real;
  }
  return ultimo;
};

// ---- narrador ---------------------------------------------------------------

/** a fala entra logo DEPOIS do golpe: o impacto soa limpo e o locutor reage */
const REACAO = 8;
/** folga minima entre o fim de uma fala e o comeco da proxima */
const RESPIRO = 8;
/** falas que nunca sao cortadas por outra: os momentos da historia */
const IMPORTANTES = new Set<Fala>(["agora", "nocaute", "venceu_black", "venceu_red", "like"]);

/**
 * Escolhe as falas do narrador a partir dos letreiros. Ele nao comenta tudo:
 * so a primeira de cada coisa e os momentos grandes, e nunca fala por cima
 * de si mesmo. Locutor que fala sem parar vira ruido.
 */
const narrar = (
  t: Timeline,
  rotulos: Rotulo[],
  lute: number,
  real: (logico: number) => number,
): { real: number; fala: Fala }[] => {
  const candidatas: { real: number; fala: Fala }[] = [{ real: lute + 2, fala: "lutem" }];
  const ja = new Set<Fala>();
  for (const r of [...rotulos].sort((a, b) => a.inicio - b.inicio)) {
    let fala: Fala | null = null;
    if (r.texto === "3 HITS") fala = "combo";
    else if (r.texto === "ESQUIVA!") fala = "desviou";
    else if (r.texto === "CONTRA-ATAQUE!") fala = "contra";
    else if (r.texto === "BRUTAL!") fala = "pancada";
    else if (r.texto === "GOLPE FINAL") fala = "agora";
    else if (r.texto === "K.O.!") fala = "nocaute";
    else if (r.texto.endsWith("VENCE!")) {
      const vencedor = Object.entries(NOMES).find(([, n]) => r.texto.startsWith(n))?.[0];
      fala = vencedor === "red" ? "venceu_red" : "venceu_black";
    }
    if (!fala) continue;
    // combo e esquiva: so na primeira vez, senao o narrador se repete
    if ((fala === "combo" || fala === "desviou") && ja.has(fala)) continue;
    ja.add(fala);
    candidatas.push({ real: r.inicio + REACAO, fala });
  }
  const placa = t.scheduled.find((b) => b.beat.type === "placa");
  if (placa) candidatas.push({ real: real(placa.from + PUXA) + 4, fala: "like" });

  candidatas.sort((a, b) => a.real - b.real);
  const fim = (c: { real: number; fala: Fala }) =>
    c.real + Math.ceil(FALAS[c.fala].segundos * 60) + RESPIRO;
  const aceitas: { real: number; fala: Fala }[] = [];
  for (const c of candidatas) {
    const choca = aceitas.filter((a) => c.real < fim(a) && a.real < fim(c));
    if (choca.length === 0) {
      aceitas.push(c);
    } else if (IMPORTANTES.has(c.fala) && choca.every((a) => !IMPORTANTES.has(a.fala))) {
      // o momento grande tira a fala pequena do caminho
      for (const a of choca) aceitas.splice(aceitas.indexOf(a), 1);
      aceitas.push(c);
    }
  }
  return aceitas.sort((a, b) => a.real - b.real);
};
