/**
 * AZUL e VERMELHO. Duas esferas em sequencia: a primeira PUXA, a
 * segunda EMPURRA. O contraste entre as duas e a cena, entao a camera
 * nao corta entre elas.
 */

import type { Tecnica } from "./contexto";

export const azulVermelho: Tecnica = (ctx) => {
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
      // reposicionar com pose de LOCOMOCAO: guard e pose de apoio e o
      // motor nao tem como dar passo nela, entao o corpo desliza de pe
      // parado (ver POSES_DE_LOCOMOCAO em animation/corpo).
      pose(G, "retreat", c + 8, m - lado * 360);
      pose(F, "retreat", c + 8, m + lado * 300);
      const xG = estado[G].x;
      const xF = estado[F].x;
      pose(G, "bracosFrente", c + s(0.35));
      // A esfera nasce NA FRENTE do corpo, nao em cima dele: com offset
      // pequeno ela cobria a cabeca e o tronco e o personagem sumia atras
      // do proprio golpe. O raio tambem cede -- o halo do glow ja soma uns
      // 35% ao tamanho aparente.
      const azul = { x: xG + lado * 330, y: ALTURA_QUADRIL - 250 };
      poder({ tipo: "esferaInferno", a: azul, from: c + s(0.3), to: c + s(1.25), forca: 78, paleta: "azul" });
      nome("AZUL", G, c + s(0.45));
      cameraKeys.push({ frame: c + s(0.3), center: { x: (xG + xF) / 2, y: ALTURA_QUADRIL - 240 }, zoom: 1.1, ease: 14, cena: true });
      // puxado: ele vem para frente sem querer
      pose(F, "retreat", c + s(1.0), xF - lado * 190);
      poder({ tipo: "choque", a: { x: xF, y: ALTURA_QUADRIL - 200 }, from: c + s(0.7), to: c + s(1.2), forca: 120, paleta: "azul" });
      const vermelho = { x: xG + lado * 350, y: ALTURA_QUADRIL - 245 };
      const lanca = c + s(1.35);
      poder({ tipo: "esferaInferno", a: vermelho, from: lanca, to: lanca + s(0.55), forca: 105, paleta: "vermelho" });
      nome("VERMELHO", G, lanca + 4);
      const bate = lanca + s(0.5);
      impacts.push({
        frame: bate,
        at: { x: xF, y: ALTURA_QUADRIL - 210 },
        tier: "extreme",
        direction: lado,
        hitStop: 9,
        cracksGround: true,
        sound: "explosion",
      });
      poder({ tipo: "explosaoFogo", a: { x: xF, y: ALTURA_QUADRIL - 210 }, from: bate, to: bate + 34, forca: 330, paleta: "vermelho" });
      pose(F, "launched", bate, xF + lado * 420);
      for (let k = 0; k < 3; k++) {
        cameraKeys.push({ frame: bate + k * 10, center: { x: m + lado * 120, y: ALTURA_QUADRIL - 160 }, zoom: 0.9 + k * 0.04, ease: 9, shake: 16 + k * 8, cena: true });
      }
      const fim = bate + s(0.7);
      pose(F, "groundHit", bate + 14);
      pose(F, "getUp", fim);
      return fim;
};
