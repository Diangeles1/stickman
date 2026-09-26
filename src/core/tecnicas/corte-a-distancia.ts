/**
 * CORTE A DISTANCIA. O marcado varre a mao no ar e o corte chega do
 * outro lado da arena. O golpe nao tem projetil: o que o olho ve e o
 * gesto, o vazio entre os dois, e a marca abrindo no corpo do alvo.
 */

import type { Tecnica } from "./contexto";

export const corteADistancia: Tecnica = (ctx) => {
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
    DISTANCIA_DE_ESPERA,
  } = ctx;

      const xG = estado[G].x;
      const xF = estado[F].x;
      // close no gesto: o quadro segue a mao, nao o corpo
      pose(F, "guard", c + 6);
      cameraKeys.push({ frame: c + 4, center: { x: xF, y: ALTURA_QUADRIL - 260 }, zoom: 1.5, ease: 10, cena: true });
      const varre = c + s(0.45);
      pose(F, "corteDesce", varre);
      nome("CORTE", F, varre - 6);
      // o corte viaja: tres marcas no ar entre os dois, uma depois da outra
      for (let k = 0; k < 3; k++) {
        const t = (k + 1) / 4;
        poder({
          tipo: "marcaDeCorte",
          a: { x: xF + (xG - xF) * t, y: ALTURA_QUADRIL - 180 - k * 40 },
          from: varre + k * 3,
          to: varre + 16 + k * 3,
          forca: 220,
          paleta: "sombra",
          vetor: { x: -lado, y: 0.25 },
        });
      }
      // corta o quadro para o ALVO no momento em que a marca chega nele
      const chega = varre + s(0.22);
      cameraKeys.push({ frame: chega - 3, center: { x: xG, y: ALTURA_QUADRIL - 220 }, zoom: 1.35, ease: 0, cena: true });
      pose(G, "knockback", chega, xG - lado * 90);
      impacts.push({
        frame: chega,
        at: { x: xG, y: ALTURA_QUADRIL - 200 },
        tier: "medium",
        direction: -lado,
        hitStop: 7,
        cracksGround: false,
        sound: "corte",
      });
      poder({ tipo: "marcaDeCorte", quem: G, a: { x: xG, y: ALTURA_QUADRIL - 200 }, from: chega, to: chega + 26, forca: 260, vetor: { x: -lado, y: 0.3 } });
      // forca do sangue nao e quantidade em centenas: o motor usa ~1 (ver o
      // corte do duelo). Com 150 o jato virava mancha solida cobrindo o alvo.
      poder({ tipo: "sangue", quem: G, a: { x: xG, y: ALTURA_QUADRIL - 200 }, from: chega, to: chega + 34, forca: 1, vetor: { x: -lado, y: -0.2 } });
      /*
        Fecha a distancia antes de devolver o controle.

        Esta cena termina com os dois LONGE, porque o golpe dela e a
        distancia. O beat seguinte e corpo a corpo e assume que eles estao
        em distancia de combate -- sem esta aproximacao o golpe nascia fora
        de alcance e o scripts/contato.mts reprovava por 54 unidades.

        Quem anda e o marcado: ele cortou de longe, funcionou, e agora vem
        cobrar de perto.
      */
      const fim = chega + s(0.85);
      pose(G, "guard", chega + s(0.35));
      pose(F, "advance", chega + s(0.3));
      pose(F, "advance", fim - 6, xG + lado * DISTANCIA_DE_ESPERA);
      pose(F, "guard", fim);
      cameraKeys.push({ frame: chega + 10, center: { x: (xG + xF) / 2, y: ALTURA_QUADRIL - 160 }, zoom: 0.95, ease: 16, fit: true, cena: true });
      return fim;
};
