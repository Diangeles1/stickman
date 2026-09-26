/**
 * ENCONTRO dos feiticeiros. Igual em ritmo ao encontro de gelo vs fogo
 * -- os dois parados, closes alternados, silencio antes da luta -- mas
 * sem nada de gelo: nenhum cristal no chao, e as auras saem nas cores
 * dos dois (vazio de um lado, carmesim do outro).
 *
 * Existe separado em vez de parametrizar o outro porque o que muda nao
 * e so cor: o encontro de gelo congela o piso, e piso congelado numa
 * luta sem gelo e exatamente o defeito que esta cena veio corrigir.
 */

import type { Tecnica } from "./contexto";

export const encontroFeiticeiros: Tecnica = (ctx) => {
  const {
    G,
    F,
    c,
    s,
    pose,
    poder,
    cameraKeys,
    ALTURA_QUADRIL,
    PARA_SEMPRE,
  } = ctx;

      const dur = s(2.2);
      /*
        Chegam ANDANDO a marca, e com TEMPO para isso.
        
        Sao dois defeitos diferentes, medidos por scripts diferentes:
        pose de apoio (guard) faz o pe deslizar e o pes.mts acusa; chave de
        posicao sem quadros entre ela e a anterior faz o corpo saltar e o
        qualidade.mts acusa. Trocar so a pose resolvia metade.
        
        Aqui a posicao ATUAL e chaveada primeiro, e a marca so e alcancada
        24 quadros depois -- o deslocamento se espalha em vez de acontecer
        de um quadro para o outro.
      */
      pose(G, "retreat", c);
      pose(F, "retreat", c);
      pose(G, "retreat", c + 24, -380);
      pose(F, "retreat", c + 24, 380);
      pose(G, "guard", c + 32);
      pose(F, "guard", c + 32);
      pose(G, "guard", c + dur);
      pose(F, "guard", c + dur);
      // auras PARA_SEMPRE: e o que da presenca aos dois pelo resto da luta
      poder({ tipo: "auraGelo", quem: G, from: c + 6, to: PARA_SEMPRE, forca: 0.75, paleta: "vazio" });
      poder({ tipo: "auraFogo", quem: F, from: c + 24, to: PARA_SEMPRE, forca: 0.85, paleta: "sombra" });
      // o chao queima do lado do marcado, e so dele
      poder({ tipo: "chaoQueimado", a: { x: 380, y: 0 }, from: c + 26, to: PARA_SEMPRE, forca: 150 });
      const perto = (x: number, quadro: number, y = ALTURA_QUADRIL - 260) =>
        cameraKeys.push({ frame: quadro, center: { x, y }, zoom: 2.1, ease: 4, cena: true });
      // abre no de branco, corta para o marcado, e abre nos dois
      cameraKeys.push({ frame: c, center: { x: -380, y: ALTURA_QUADRIL - 120 }, zoom: 1.1, ease: 1, cena: true });
      perto(-380, c + s(0.45));
      perto(380, c + s(1.05));
      cameraKeys.push({ frame: c + s(1.6), center: { x: 0, y: ALTURA_QUADRIL - 140 }, zoom: 0.85, ease: s(0.5), fit: true, cena: true });
      return c + dur;
};
