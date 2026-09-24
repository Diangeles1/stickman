/**
 * TROCA O VENCEDOR de uma luta: a mesma coreografia com os papeis invertidos.
 *
 * Tudo que o preto fazia o vermelho passa a fazer, e vice-versa: quem ataca,
 * quem esquiva, quem cai, quem finaliza, quem danca e quem levanta a placa.
 * Os lados da tela continuam os mesmos (o preto segue a esquerda), entao a
 * aproximacao que levava o preto ate x = -140 agora leva o vermelho ate
 * x = +140: a posicao espelha junto com o papel.
 *
 * E o que deixa o video "escolha um personagem" ter dois finais sem escrever
 * duas lutas.
 */

import { PRESETS } from "../characters/presets";
import type { Beat, FighterId, FightSpec } from "../core/types";

export const trocarVencedor = (spec: FightSpec): FightSpec => {
  const { fighterA: a, fighterB: b } = spec;
  const t = (id: FighterId): FighterId => (id === a ? b : id === b ? a : id);
  // O ATAQUE AEREO fica com quem ja o fazia (e a recuperacao de quem
  // levou, logo depois). Na mao do pesado o empurrao do soco aereo jogava o
  // leve a 900 unidades de distancia, longe demais para os dois caberem na
  // tela durante a perseguicao; e o perdedor acertar um golpe bonito tambem
  // e bom para a luta.
  const mantidos = new Set<number>();
  spec.beats.forEach((beat, i) => {
    if (
      beat.type === "attack" &&
      (beat.move === "airAttack" || beat.move === "diveAttack")
    ) {
      mantidos.add(i);
      if (spec.beats[i + 1]?.type === "recover") mantidos.add(i + 1);
    }
  });
  const beats = spec.beats.map((beat, i): Beat => {
    if (mantidos.has(i)) return beat;
    const c = { ...beat } as Record<string, unknown>;
    for (const campo of ["attacker", "target", "who"]) {
      if (typeof c[campo] === "string") c[campo] = t(c[campo] as FighterId);
    }
    if (beat.type === "approach") c.toX = -beat.toX;
    return c as Beat;
  }).map((beat): Beat => {
    // PERSONALIDADE: o soco rapido e do lutador leve. Na mao do pesado ele
    // vira soco normal, carregado do jeito dele: o jab encadeado do preto,
    // feito com o peso do vermelho, puxava o corpo inteiro como um bloco
    // (auditoria de cadeia)
    const pesado = (id: FighterId) => PRESETS[id].profile.speed < 0.6;
    if (beat.type === "combo" && pesado(beat.attacker)) {
      return {
        ...beat,
        // e o chute que fecha o combo vira soco: no peso do vermelho ele
        // arremessava o leve para longe demais no meio da luta
        moves: beat.moves.map((m) =>
          m === "punchFast" || m === "kick" ? "punch" : m,
        ),
      };
    }
    if (
      (beat.type === "attack" || beat.type === "blocked" || beat.type === "dodged") &&
      pesado(beat.attacker) &&
      beat.move === "punchFast"
    ) {
      return { ...beat, move: "punch" };
    }
    return beat;
  });
  return { ...spec, beats };
};
