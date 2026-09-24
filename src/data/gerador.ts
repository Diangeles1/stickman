/**
 * GERADOR DE LUTAS: uma semente entra, uma luta inteira sai.
 *
 * E aqui que o motor deixa de ser um jeito trabalhoso de fazer um video e
 * passa a ser um jeito de fazer cem. Nenhuma coreografia e escrita a mao:
 * dada a semente, este arquivo monta a lista de beats e o compilador deriva
 * distancia, contato, reacao, camera e tempo a partir dela.
 *
 * TUDO vem do PRNG com semente, nunca de Math.random(). O Remotion renderiza
 * cada quadro isolado e possivelmente em processos paralelos: valor aleatorio
 * de verdade faria a luta tremer na tela. Mesma semente, mesma luta, sempre.
 *
 * O ARCO. Uma luta que prende nao e uma fila de golpes iguais; ela cresce:
 *
 *   entrada -> trocas leves -> escalada -> finalizador -> desfecho
 *
 * A escalada aparece em tres coisas ao mesmo tempo: os golpes ficam mais
 * pesados, as defesas ficam mais raras, e o intervalo entre eles diminui. Isso
 * e o que faz o fim parecer o fim.
 */

import { criarRng } from "../core/rng";
import { s } from "../core/time";
import { compilar } from "../core/timeline";
import type { PontoAlvo } from "../core/contact";
import type { AttackName, Beat, FightSpec } from "../core/types";

/**
 * Golpes de troca, por fase da luta.
 *
 * Nenhum de intensidade extrema entra aqui: extremo LANCA o adversario, e
 * lancamento no meio da luta gasta o efeito que o finalizador precisa ter.
 */
const LEVES: AttackName[] = ["punchFast", "punch", "kickLow", "knee"];
const MEDIOS: AttackName[] = ["punch", "kick", "kickHigh", "knee", "charge"];

/** Golpes que fecham a luta. Todos de intensidade extrema: lancam. */
const FINALIZADORES: AttackName[] = ["uppercut", "spinKick", "punchHeavy"];

/** Golpes que so tem um alvo possivel (o padrao deles, ver ALVO_PADRAO). */
const GOLPES_DE_ALVO_FIXO = new Set<AttackName>(["charge", "kickLow", "knee"]);

/** Alvos alternativos, para o golpe nao mirar sempre no mesmo lugar. */
const ALVOS: PontoAlvo[] = ["head", "chest", "torso"];

export type OpcoesDaLuta = {
  /** duracao alvo em segundos. O gerador para na primeira troca que passar. */
  segundos?: number;
  fighterA?: FightSpec["fighterA"];
  fighterB?: FightSpec["fighterB"];
  scenario?: FightSpec["scenario"];
};

/**
 * Monta uma luta a partir da semente.
 *
 * A duracao nao e calculada, e ATINGIDA: o gerador acrescenta trocas e vai
 * medindo, porque o custo em quadros de cada troca depende do golpe, do
 * lutador e da intensidade, e estimar isso daria erro acumulado. Quem sabe
 * quanto uma troca dura e o compilador, entao e ele quem responde.
 */
export const gerarLuta = (
  semente: number,
  opcoes: OpcoesDaLuta = {},
): FightSpec => {
  const {
    segundos = 30,
    fighterA = "black",
    fighterB = "red",
    scenario = "limpo",
  } = opcoes;

  const rng = criarRng(semente);
  const sorteia = <T,>(lista: readonly T[]): T =>
    lista[Math.floor(rng() * lista.length) % lista.length];

  // Sorteada ANTES de tudo porque a duracao de cada golpe depende dela: e o
  // que faz duas lutas com os mesmos golpes terem ritmos diferentes.
  const intensity = 4 + Math.floor(rng() * 4);

  const beats: Beat[] = [];

  // ---- ENTRADA ----------------------------------------------------------
  // Curta de proposito. Em Shorts o primeiro segundo decide se alguem fica,
  // entao a luta comeca quase junto com o video.
  beats.push({ type: "hold", duration: s(0.4), label: "entrada" });
  beats.push({
    type: "approach",
    who: fighterA,
    toX: -140 - Math.round(rng() * 80),
    duration: s(0.35),
  });

  // ---- TROCAS -----------------------------------------------------------
  // Quem ataca alterna, mas nao em turnos fixos: turno fixo le como jogo de
  // tabuleiro. De vez em quando o mesmo lutador emenda duas.
  let atacante = fighterA;
  let alvo = fighterB;
  let troca = 0;

  /**
   * Duracao REAL da luta montada ate aqui, ja com o desfecho no fim.
   *
   * O custo em quadros de uma troca depende do golpe, do lutador, da
   * intensidade e de a defesa ter entrado ou nao. Estimar isso acumula erro:
   * a primeira versao estimava 2,4s por troca e entregava 16s quando pedia
   * 30. Quem sabe quanto uma troca dura e o compilador, entao e ele quem
   * responde, e o gerador so vai somando trocas ate chegar la.
   */
  const duracaoCom = (extras: Beat[]): number => {
    const t = compilar({
      fighterA, fighterB, seed: semente, fps: 60,
      width: 1080, height: 1920, intensity, scenario,
      beats: [...beats, ...extras],
    });
    const congelados = t.impacts.reduce((n, i) => n + i.hitStop, 0);
    return (t.durationInFrames + congelados) / 60;
  };

  /** o desfecho custa tempo e precisa caber dentro do alvo */
  const desfecho = (quem: FightSpec["fighterB"]): Beat[] => [
    { type: "recover", who: quem, duration: s(0.9) },
    { type: "hold", duration: s(0.5), label: "desfecho" },
  ];

  /** teto de trocas, so para nao existir laco sem fim */
  const MAXIMO = 40;

  while (troca < MAXIMO && duracaoCom(desfecho(alvo)) < segundos) {
    // a escalada e estimada pela fracao do tempo ja gasto, e nao pelo numero
    // de trocas: assim ela acompanha a duracao pedida
    const escalada = Math.min(
      1,
      Math.max(0, duracaoCom([]) / Math.max(1, segundos - 3)),
    );

    // golpe mais pesado conforme a luta avanca
    const move = sorteia(escalada < 0.45 ? LEVES : MEDIOS);

    // defesa fica mais rara no fim: no comeco metade dos golpes nao entra,
    // no fim quase todos entram, e e isso que da a sensacao de que um esta
    // vencendo o outro
    const chanceDeEntrar = 0.45 + escalada * 0.45;
    const sorte = rng();
    // Golpe de alvo FIXO nao sorteia ponto: investida na cabeca, chute baixo
    // no rosto ou joelhada na cabeca nao sao golpes que um corpo consegue dar,
    // e o sorteio produzia exatamente esses (o ombro da investida parava 43
    // unidades abaixo da cabeca). Eles usam o ponto padrao do golpe.
    const sorteado = rng() < 0.35 ? sorteia(ALVOS) : undefined;
    const ponto = GOLPES_DE_ALVO_FIXO.has(move) ? undefined : sorteado;

    if (sorte < chanceDeEntrar) {
      beats.push(
        ponto
          ? { type: "attack", attacker: atacante, target: alvo, move, targetPoint: ponto }
          : { type: "attack", attacker: atacante, target: alvo, move },
      );
      // respiro depois do golpe que entra: e nele que o atingido se recompoe
      // e o outro volta a distancia neutra
      beats.push({
        type: "recover",
        who: alvo,
        duration: s(0.3 + (1 - escalada) * 0.25),
      });
    } else if (sorte < chanceDeEntrar + (1 - chanceDeEntrar) / 2) {
      beats.push({ type: "blocked", attacker: atacante, target: alvo, move });
    } else {
      beats.push({ type: "dodged", attacker: atacante, target: alvo, move });
    }

    // troca de quem ataca em 70% das vezes: os outros 30% viram emenda
    if (rng() < 0.7) {
      const t = atacante;
      atacante = alvo;
      alvo = t;
    }
    troca++;
  }

  // ---- FINALIZADOR ------------------------------------------------------
  // Sempre de intensidade extrema, sempre lancando: e o unico lancamento da
  // luta, e por isso ele pesa.
  beats.push({
    type: "attack",
    attacker: atacante,
    target: alvo,
    move: sorteia(FINALIZADORES),
    targetPoint: "chest",
  });

  // ---- DESFECHO ---------------------------------------------------------
  // Tempo para o atingido cair, ficar caido e levantar. Sem isso o video
  // termina no ar e o golpe final perde a consequencia.
  beats.push(...desfecho(alvo));

  return {
    fighterA,
    fighterB,
    seed: semente,
    fps: 60,
    width: 1080,
    height: 1920,
    intensity,
    scenario,
    beats,
  };
};
