/**
 * DOMINIO. A arena escurece, o nome entra, e a tela se enche de cortes
 * vindos de todo lado: nenhum deles precisa de alvo, o dominio acerta
 * porque acerta.
 */

import type { Tecnica } from "./contexto";

export const dominio: Tecnica = (ctx) => {
  const {
    G,
    F,
    c,
    lado,
    s,
    estado,
    pose,
    poder,
    nome,
    cameraKeys,
    impacts,
    ALTURA_QUADRIL,
  } = ctx;

      const m = (estado[G].x + estado[F].x) / 2;
      // andando para a marca, nao deslizando ate ela
      pose(G, "retreat", c + 10, m - lado * 250);
      pose(F, "advance", c + 10, m + lado * 250);
      const abre = c + s(0.5);
      poder({ tipo: "telaBranca", from: abre, to: abre + 10 });
      nome("DOMINIO", F, abre + 6);
      cameraKeys.push({ frame: c + 6, center: { x: m, y: ALTURA_QUADRIL - 260 }, zoom: 0.72, ease: s(0.5), cena: true, fit: true });
      // chuva de cortes, em cadencia irregular para nao virar metronomo
      for (let k = 0; k < 14; k++) {
        const q = abre + 12 + k * 4 + (k % 3);
        poder({
          tipo: "marcaDeCorte",
          a: {
            x: m + ((k % 5) - 2) * 220 + (k % 2 ? 70 : -60),
            y: ALTURA_QUADRIL - 120 - (k % 4) * 150,
          },
          from: q,
          to: q + 18,
          forca: 200 + (k % 3) * 60,
          paleta: "sombra",
          vetor: { x: k % 2 ? 1 : -1, y: 0.4 },
        });
      }
      const golpeia = abre + s(0.85);
      impacts.push({
        frame: golpeia,
        at: { x: m - lado * 180, y: ALTURA_QUADRIL - 220 },
        tier: "extreme",
        direction: -lado,
        hitStop: 10,
        cracksGround: true,
        sound: "corte",
      });
      pose(G, "knockback", golpeia, m - lado * 380);
      poder({ tipo: "sangue", quem: G, a: { x: m - lado * 300, y: ALTURA_QUADRIL - 210 }, from: golpeia, to: golpeia + 40, forca: 1.2, vetor: { x: -lado, y: -0.3 } });
      for (let k = 0; k < 3; k++) {
        cameraKeys.push({ frame: golpeia + k * 9, center: { x: m, y: ALTURA_QUADRIL - 200 }, zoom: 0.8 + k * 0.05, ease: 8, shake: 22 - k * 6, cena: true });
      }
      const fim = golpeia + s(1.0);
      pose(G, "getUp", fim);
      pose(F, "guard", fim);
      cameraKeys.push({ frame: golpeia + 24, center: { x: m, y: ALTURA_QUADRIL - 150 }, zoom: 0.9, ease: 20, fit: true, cena: true });
      return fim;
};
