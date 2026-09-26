/**
 * VAZIO ROXO. As duas esferas se encostam e o que sai atravessa a arena
 * inteira. E o golpe mais caro da luta: camera baixa, tela branca no
 * disparo, e o cenario rachado depois.
 */

import type { Tecnica } from "./contexto";

export const vazioRoxo: Tecnica = (ctx) => {
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
      pose(G, "retreat", c + 10, m - lado * 420);
      pose(F, "retreat", c + 10, m + lado * 420);
      const xG = estado[G].x;
      const xF = estado[F].x;
      pose(G, "bracosFrente", c + s(0.4));
      // as duas esferas lado a lado, antes de juntar
      const esq = { x: xG + lado * 300, y: ALTURA_QUADRIL - 270 };
      const dir2 = { x: xG + lado * 430, y: ALTURA_QUADRIL - 270 };
      poder({ tipo: "esferaInferno", a: esq, from: c + s(0.3), to: c + s(1.1), forca: 72, paleta: "azul" });
      poder({ tipo: "esferaInferno", a: dir2, from: c + s(0.3), to: c + s(1.1), forca: 72, paleta: "vermelho" });
      // o quadro pega o lutador E as esferas: zoom alto demais cortava ele
      cameraKeys.push({ frame: c + s(0.35), center: { x: xG + lado * 230, y: ALTURA_QUADRIL - 250 }, zoom: 1.15, ease: 12, cena: true });
      // juntam e viram uma so
      const junta = { x: xG + lado * 365, y: ALTURA_QUADRIL - 270 };
      poder({ tipo: "esferaInferno", a: junta, from: c + s(1.05), to: c + s(1.6), forca: 120, paleta: "vazio" });
      nome("VAZIO", G, c + s(1.15));
      poder({ tipo: "telaBranca", from: c + s(1.5), to: c + s(1.62) });
      const disparo = c + s(1.6);
      const alvoFeixe = { x: xF + lado * 700, y: ALTURA_QUADRIL - 260 };
      poder({ tipo: "feixeFogo", a: junta, b: alvoFeixe, from: disparo, to: disparo + s(1.05), forca: 260, paleta: "vazio" });
      /*
        O quadro tem que conter o PONTO DE IMPACTO, nao so o meio da arena.
        Sem : com ele a camera recalcula o zoom para caber os dois
        corpos e ignora o zoom pedido, e era por isso que o golpe caia fora
        da borda mesmo depois de eu abrir o enquadramento.
      */
      cameraKeys.push({ frame: disparo, center: { x: m + lado * 360, y: ALTURA_QUADRIL - 220 }, zoom: 0.5, ease: 0, shake: 26, cena: true });
      pose(F, "knockback", disparo + 6, xF + lado * 260);
      impacts.push({
        frame: disparo + 6,
        at: { x: xF, y: ALTURA_QUADRIL - 250 },
        tier: "extreme",
        direction: lado,
        hitStop: 11,
        cracksGround: true,
        sound: "explosion",
      });
      pose(F, "launched", disparo + s(0.35), xF + lado * 560);
      for (let k = 0; k < 4; k++) {
        cameraKeys.push({ frame: disparo + 8 + k * 11, center: { x: m + lado * 200, y: ALTURA_QUADRIL - 200 }, zoom: 0.66 + k * 0.03, ease: 10, shake: 30 - k * 6, cena: true });
      }
      poder({ tipo: "rachadura", a: { x: m, y: 0 }, from: disparo + 10, to: disparo + s(1.0), forca: 700 });
      const fim = disparo + s(1.25);
      pose(F, "groundHit", disparo + s(0.6));
      pose(F, "sitUp", fim);
      pose(G, "idle", fim);
      return fim;
};
