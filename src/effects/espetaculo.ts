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
  /*
    O elenco de vareta. Estes nomes quase nunca aparecem: o duelo diario
    passa `nomes` no spec e quem sai na tela e LUCAS, SAMUEL. Eles servem de
    rede -- uma luta escrita sem nomes continua tendo o que dizer no lugar de
    "undefined", que foi o que a tabela antiga fazia com qualquer cor nova.
  */
  violeta: "VIOLETA",
  limao: "LIMAO",
  magenta: "MAGENTA",
  carmim: "CARMIM",
  oceano: "OCEANO",
  grafite: "GRAFITE",
  musgo: "MUSGO",
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
  /** efeitos sonoros dos acontecimentos (combo, esquiva, contra...) */
  efeitos: { real: number; som: string }[];
  /** luta cinematica: quadro real em que comeca o final aberto */
  final?: number;
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
  if (t.spec.cinematico) return montarCinematico(t, real);
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
  /*
    O DANO E ESCALADO PELO TAMANHO DA LUTA, e sem isso a barra nao mede nada.

    DANO e ARRANHAO sao valores por golpe, calibrados quando as lutas tinham
    poucos golpes. Numa luta longa eles estouram: medido no duelo do vale,
    sao 24 golpes que conectam, e com `extreme` valendo 24 isso da mais de
    400 de dano sobre 100 de vida. As duas barras batiam no piso antes dos
    30 segundos de um video de 65, e a metade final acontecia com os dois
    lutadores em 12% -- o K.O. chegava sem que a barra tivesse explicado
    nada, porque ela ja estava vazia ha meio minuto.

    Uma barra de vida existe para dizer QUANTO FALTA. Aqui o dano de cada
    golpe e dividido de modo que a soma do que um lutador vai levar durante
    a luta inteira o leve de 100 ate perto do piso -- nem antes nem depois.
    A proporcao entre os golpes nao muda: um `extreme` continua doendo o
    triplo de um `light`.

    O finalizador fica de fora da conta: ele zera a vida por definicao.
  */
  const previsto: Record<string, number> = {};
  for (const imp of impactos) {
    if (!imp.victim || !imp.attacker || imp.finalizador) continue;
    previsto[imp.victim] =
      (previsto[imp.victim] ?? 0) +
      (imp.bloqueado ? ARRANHAO : DANO[imp.tier as keyof typeof DANO]);
  }
  const escala: Record<string, number> = {};
  for (const [id, total] of Object.entries(previsto)) {
    // so ENCOLHE: uma luta curta nao deve ter o dano inflado para a barra
    // esvaziar na marra, porque ali a barra cheia no fim e a verdade
    escala[id] = total > 0 ? Math.min(1, (100 - VIDA_MINIMA - 4) / total) : 1;
  }
  const danoDe = (imp: (typeof impactos)[number]): number =>
    (imp.bloqueado ? ARRANHAO : DANO[imp.tier as keyof typeof DANO]) *
    (escala[imp.victim as string] ?? 1);

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
      vida[vitima] = Math.max(VIDA_MINIMA, vida[vitima] - danoDe(imp));
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
      : Math.max(VIDA_MINIMA, vida[vitima] - danoDe(imp));
    golpes.push({ real: r, vitima, vida: vida[vitima] });

    if (imp.finalizador) {
      ko = { real: r, vencedor: quem };
      // ver a nota sobre duracao em scenes/FightScene (modoAnime)
      impactosAnime.push({ real: r, quadros: 14, at: imp.at });
      continue;
    }
    /*
      TODO GOLPE QUE CONECTA ACENDE UM IMPACT FRAME, e nao so os extremos.

      O guia de animacao da comunidade de stickman trata o impact frame como
      item basico do golpe, nao como enfeite de golpe grande: "impact frames
      are used to give an impact more power behind it, only lasting for a few
      seconds... everything radiates from the source of impact". Numa luta de
      referencia praticamente todo acerto solido tem um.

      Aqui so `extreme` tinha, e extremos sao a minoria: a maior parte dos
      socos conectava sem NENHUMA marca de impacto, e um golpe sem marca le
      como o punho passando pelo corpo.

      A DURACAO E QUE SEPARA OS DOIS. Oito quadros para o golpe pesado, tres
      para o medio -- tempo suficiente para o olho registrar que algo bateu,
      curto demais para roubar a cena. Dar oito a todos transformaria a luta
      numa sequencia de clarões e o golpe grande deixaria de ser grande.

      Leve continua sem: golpe de raspao que acende a tela mente sobre o
      proprio peso.
    */
    if (!imp.semFlash && !imp.bloqueado) {
      if (imp.tier === "extreme") impactosAnime.push({ real: r, quadros: 8, at: imp.at });
      else if (imp.tier === "medium") impactosAnime.push({ real: r, quadros: 3, at: imp.at });
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
  /*
    O ENCERRAMENTO TAMBEM NA LUTA COMUM.

    Ate aqui so a luta CINEMATICA tinha fecho (o vencedor correndo para a
    camera e puxando a lona com o pedido de inscricao). A luta comum -- que e
    o que o GERADOR produz -- terminava no K.O. com o nome do vencedor
    segurando ate o ultimo quadro, sem pedir nada.

    Como toda luta gerada e uma luta comum, isso significava que o caminho
    que existe para fazer cem videos era justamente o que nao chamava para a
    inscricao.

    O fecho comeca depois do nome do vencedor ter sido lido, e os letreiros
    saem quando ele entra: um de cada vez, nunca os dois. So existe quando ha
    K.O. -- luta sem desfecho continua exatamente como era.
  */
  const inicioDoFecho =
    ko && !cenaDaPlaca ? Math.min(ko.real + 190, fimReal - 300) : undefined;
  const ateAPlaca = cenaDaPlaca
    ? real(cenaDaPlaca.from) + 20
    : (inicioDoFecho ?? fimReal);
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
      // o nome do spec tem precedencia sobre a tabela padrao do modulo
      texto: `${t.spec.nomes?.[ko.vencedor] ?? NOMES[ko.vencedor]} VENCE!`,
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

  const falas = narrar(t, real);
  if (inicioDoFecho !== undefined) {
    // o pedido entra junto com a lona, e depois do anuncio do vencedor
    falas.push({ real: inicioDoFecho + ESPERA_DA_PERGUNTA + 40, fala: "like" });
  }

  return {
    rotulos,
    golpes,
    impactosAnime,
    quedas,
    esquivas: esquivas.map((q) => real(q.logico)),
    ko,
    final: inicioDoFecho,
    abertura,
    entradaDoPlacar: abertura.lute,
    saidaDoPlacar: ateAPlaca,
    falas,
    efeitos: efeitosDe(rotulos, ko),
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

/** folga minima entre o fim de uma fala e o comeco da proxima */
const RESPIRO = 8;

/**
 * Escolhe as falas do narrador.
 *
 * O NARRADOR NAO ENTRA NA LUTA. Nem no comeco ("Lutem!"), nem no fim
 * ("Nocaute!", "O Preto venceu!"): durante a briga quem fala sao os sons
 * (ver efeitosDe) e a imagem. Voz por cima de golpe faz duas coisas ruins de
 * uma vez: tapa o impacto, que e o que da peso ao golpe, e conta com palavra
 * o que a tela ja mostrou, o que deixa a cena mais lenta do que ela e.
 *
 * Sobra para ele o que a imagem NAO diz sozinha: a abertura (a tela de
 * escolha, em TelaDeEscolha), a pergunta do final e a chamada da placa de
 * like. Ai a voz nao compete com nada.
 */
const narrar = (
  t: Timeline,
  real: (logico: number) => number,
): { real: number; fala: Fala }[] => {
  const candidatas: { real: number; fala: Fala }[] = [];
  const placa = t.scheduled.find((b) => b.beat.type === "placa");
  if (placa) candidatas.push({ real: real(placa.from + PUXA) + 4, fala: "like" });

  candidatas.sort((a, b) => a.real - b.real);
  const fim = (c: { real: number; fala: Fala }) =>
    c.real + Math.ceil(FALAS[c.fala].segundos * 60) + RESPIRO;
  const aceitas: { real: number; fala: Fala }[] = [];
  for (const c of candidatas) {
    if (aceitas.some((a) => c.real < fim(a) && a.real < fim(c))) continue;
    aceitas.push(c);
  }
  return aceitas.sort((a, b) => a.real - b.real);
};

// ---- efeitos sonoros dos acontecimentos --------------------------------------

/** duracao do som de tensao (efeitos/tensao.wav), em quadros */
const TENSAO = 84;

/**
 * Um som proprio para cada acontecimento, no mesmo quadro do letreiro. O
 * combo sobe de tom a cada golpe, entao o ouvido "conta" junto.
 * Arquivos gerados por scripts/compor-efeitos.mts.
 */
const efeitosDe = (
  rotulos: Rotulo[],
  ko: Espetaculo["ko"],
): { real: number; som: string }[] => {
  const saida: { real: number; som: string }[] = [];
  for (const r of rotulos) {
    const hits = /^(\d+) HITS$/.exec(r.texto);
    if (hits) saida.push({ real: r.inicio + 2, som: `combo_${Math.min(8, Number(hits[1]))}` });
    else if (r.texto === "ESQUIVA!") saida.push({ real: r.inicio, som: "esquiva" });
    else if (r.texto === "CONTRA-ATAQUE!") saida.push({ real: r.inicio + 3, som: "contra" });
    else if (r.texto === "BRUTAL!") saida.push({ real: r.inicio + 2, som: "brutal" });
    else if (r.texto === "BLOQUEIO!") saida.push({ real: r.inicio, som: "bloqueio" });
  }
  // a tensao sobe ate o golpe final e corta seco no impacto
  if (ko) saida.push({ real: Math.max(0, ko.real - TENSAO), som: "tensao" });
  return saida.sort((a, b) => a.real - b.real);
};

// ---- luta cinematica -----------------------------------------------------------

const COR_DO_ELEMENTO = { gelo: "#8fe3ff", fogo: "#ff8a2a" } as const;

/**
 * LUTA CINEMATICA (spec.cinematico): sem placar e sem combo. Os letreiros sao
 * os NOMES DAS TECNICAS, na cor do elemento de quem usa.
 *
 * O FIM PODE SER DOS DOIS JEITOS, e quem decide e a luta:
 *
 *   sem finalizador   fim aberto -- logo, nomes, "QUEM DEVE VENCER?"
 *   com finalizador   K.O., o nome de quem venceu, e a pergunta vira
 *                     "VOCE ACERTOU?"
 *
 * O segundo caso passou a existir quando a luta ganhou um desfecho. Antes
 * este modo ignorava `finalizador` por completo, e o resultado era um video
 * que abre pedindo para o espectador escolher um personagem e termina sem
 * dizer quem ganhou: o gancho fazia uma promessa que o fim nao pagava.
 */
const montarCinematico = (
  t: Timeline,
  real: (logico: number) => number,
): Espetaculo => {
  const rotulos: Rotulo[] = [];
  let final: number | undefined;
  let ko: Espetaculo["ko"];
  /*
    O GOLPE QUE DECIDE. Procurado entre os impactos, e nao entre os letreiros:
    quem sabe que a luta acabou e a coreografia, nao o texto na tela.
  */
  const decisivo = t.impacts.find((i) => i.finalizador && i.victim && i.attacker);
  for (const e of t.poderes) {
    if (e.tipo !== "nomeDaTecnica" || !e.texto) continue;
    if (e.texto === "FINAL") {
      final = real(e.from);
      continue;
    }
    const elemento = e.quem ? t.spec.armas?.[e.quem]?.elemento : undefined;
    rotulos.push({
      inicio: real(e.from),
      duracao: real(e.to) - real(e.from),
      texto: e.texto,
      cor: elemento ? COR_DO_ELEMENTO[elemento] : "#ffffff",
      // cabe na largura da tela: "ZERO ABSOLUTE" tem 13 letras e a 150 saia
      // pelos dois lados. ~62 por letra e o que a Bangers ocupa neste corpo.
      tamanho: Math.min(150, Math.round(940 / (e.texto.length * 0.42))),
      lado: 0,
      y: 0.2,
      vaga: "tecnica",
      pancada: true,
    });
  }
  if (decisivo && decisivo.attacker) {
    const r = real(decisivo.frame);
    ko = { real: r, vencedor: decisivo.attacker };
    /*
      O K.O. espera o corpo cair. No quadro do golpe a camera esta fechada e
      a separacao ainda nem comecou; o letreiro entrando ali cobriria
      exatamente o que o espectador precisa ver.
    */
    const koNaTela = r + 78;
    // o fim comeca quando o K.O. sai: um de cada vez, nunca os dois juntos
    final = koNaTela + 70;
    rotulos.push({
      inicio: koNaTela,
      duracao: 70,
      texto: "K.O.!",
      cor: COR.ko,
      tamanho: 290,
      lado: 0,
      y: 0.28,
      vaga: "centro",
      pancada: true,
    });
  }

  const esquivas = t.aims
    .filter((m) => m.congelarEm !== undefined)
    .map((m) => real(m.contact));
  // o narrador so fala no fim: "Quem deve vencer?", junto com a pergunta na
  // tela. Durante a luta quem conta a historia sao os efeitos.
  /*
    O NARRADOR FALA DUAS VEZES NO FIM, em sequencia e nunca por cima:
    primeiro o resultado, depois o pedido.

    A fala do like ("Da like e se inscreve no canal!") ja existia no motor e
    so era usada em luta com placa de vencedor -- a luta cinematica nunca
    chegava nela. O audio estava gravado e o video nao pedia inscricao.

    O intervalo entre as duas e o comprimento da primeira mais folga: falas
    sobrepostas viram ruido e nenhuma das duas e entendida.
  */
  /*
    O RESULTADO NAO E NARRADO, e isso vem do `main`: o narrador saiu da luta e
    saiu do desfecho (ver o commit "Narrador sai da luta"). Antes aqui se
    escolhia entre a fala de vitoria do vencedor e a pergunta; agora fica
    sempre a PERGUNTA, que e o fecho de uma luta posta em aberto para o
    espectador responder nos comentarios -- e e ela que a chamada do canal
    pede.

    O pedido de like continua, porque ele nao e narracao da luta: e a chamada
    do canal. O atraso dele sai da duracao da fala que de fato toca, e nao de
    uma que talvez nao tocasse, que era a complicacao que a versao anterior
    carregava.
  */
  const falas: { real: number; fala: Fala }[] = [];
  if (final !== undefined) {
    const anuncio = final + ESPERA_DA_PERGUNTA + 6;
    falas.push({ real: anuncio, fala: "quem" });
    falas.push({
      real: anuncio + Math.round(FALAS.quem.segundos * 60) + 26,
      fala: "like",
    });
  }
  return {
    ko,
    rotulos,
    golpes: [],
    /*
      O QUADRO DE IMPACTO VALE PARA TODO GOLPE FORTE, e nao so para o que
      encerra. A versao anterior so o emitia quando havia `decisivo`: numa
      luta cinematica que termina empatada -- como a dos ninjas -- o recurso
      existia no motor e NUNCA acontecia, nem uma vez em cinquenta segundos,
      apesar de a luta ter impacto extremo em quase toda cena.

      O finalizador segura mais tempo porque e o unico golpe que precisa ser
      lembrado; os outros marcam e saem.
    */
    impactosAnime: t.impacts
      .filter(
        (i) =>
          (i.tier === "extreme" || i.tier === "medium") &&
          !i.bloqueado &&
          !i.semFlash,
      )
      .map((i) => ({
        real: real(i.frame),
        quadros: i.finalizador ? 14 : i.tier === "extreme" ? 8 : 3,
        at: i.at,
      })),
    quedas: [],
    esquivas,
    abertura: { vs: -999, lute: -999, fim: -999 },
    entradaDoPlacar: Infinity,
    saidaDoPlacar: Infinity,
    falas,
    efeitos: [],
    final,
  };
};

/** quadros entre o comeco do final e a pergunta (logo, depois nomes) */
export const ESPERA_DA_PERGUNTA = 100;
