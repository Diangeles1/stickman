/**
 * PERSEGUICAO NO AR: o golpe lanca, o outro SOBE ATRAS, e a troca acontece
 * la em cima.
 *
 * O roteiro pede "vermelho lanca azul para o alto e persegue; azul revida no
 * ar". Montado com os beats comuns -- um `attack` com uppercut, depois um
 * `airborne`, depois um `airAttack` -- isso produzia outra coisa, e a
 * medicao quadro a quadro mostrou o que:
 *
 *   13,1s  o azul e lancado e sobe 142 unidades
 *   13,9s  ja esta no chao, em `downed`
 *   14,4s  continua deitado
 *   14,5s  PULA DO CHAO ate 790 unidades de altura
 *
 * Um corpo deitado que de repente salta sozinho. E nao era ajuste de numero:
 * um golpe que LANCA toca a queda inteira dentro do proprio beat -- voo,
 * costas no chao, deslizada, assentamento (ver a fase 4 em core/timeline).
 * Quando o beat termina, a vitima ja aterrissou. Qualquer `airborne` depois
 * disso so pode comecar um pulo NOVO, do chao.
 *
 * Os beats sao sequenciais por construcao, e uma perseguicao no ar e dois
 * corpos SOBREPOSTOS no tempo: enquanto um sobe, o outro decola atras. Isso
 * nao se escreve em beats, se escreve aqui.
 *
 * A ALTURA VEM DA DURACAO. Um trecho no ar e uma parabola cujo tamanho sai do
 * tempo que o corpo passa nele: H = g T^2 / 8 (ver alturaDoVoo em
 * animation/sampler). Nao ha como pedir "suba mais" -- pede-se "fique mais
 * tempo no ar", e a altura vem junto. E por isso que o arco do lancado aqui e
 * declarado de uma vez, longo, em vez de ser a soma de pulinhos.
 */

import type { Tecnica } from "./contexto";

export const perseguicaoNoAr: Tecnica = (ctx) => {
  const { G, F, c, s, estado, pose, poder, cameraKeys, impacts, ALTURA_QUADRIL } =
    ctx;

  const xG = estado[G].x;
  const xF = estado[F].x;
  /** para onde o lancado e jogado: para longe de quem bateu */
  const rumo: 1 | -1 = xG >= xF ? 1 : -1;

  // ---- 1. O GOLPE QUE LANCA ------------------------------------------------
  pose(F, "advance", c + s(0.2), xG - rumo * 210);
  pose(F, "coil", c + s(0.38));
  pose(G, "guard", c + s(0.38));
  const bate = c + s(0.55);
  pose(F, "uppercut", bate);
  pose(G, "hitHead", bate);
  impacts.push({
    frame: bate,
    at: { x: xG, y: ALTURA_QUADRIL - 300 },
    tier: "extreme",
    direction: rumo,
    hitStop: 9,
    cracksGround: false,
    attacker: F,
    victim: G,
    sound: "impact",
  });
  cameraKeys.push({
    frame: bate,
    center: { x: xG, y: ALTURA_QUADRIL - 280 },
    zoom: 1.35,
    ease: 0,
    shake: 20,
    cena: true,
  });

  /*
    O ARCO DO LANCADO, DECLARADO DE UMA VEZ.

    Entre a primeira chave com `airborne` e a primeira sem ele existe UM
    trecho, e e ele que vira a parabola. Escrever o voo em pedacos (sobe,
    pousa, sobe de novo) daria varios trechos curtos -- que e exatamente o
    defeito que esta cena veio corrigir.
  */
  const decola = bate + s(0.12);
  const pousa = decola + s(1.75);
  estado[G].airborne = true;
  pose(G, "launched", decola, xG + rumo * 90);
  pose(G, "launched", decola + s(0.5), xG + rumo * 240);

  // ---- 2. A PERSEGUICAO ----------------------------------------------------
  /*
    O PERSEGUIDOR DECOLA DEPOIS E POUSA ANTES.

    Depois porque perseguir e sair atras: saindo junto, os dois sobem lado a
    lado e ninguem esta perseguindo ninguem. E antes porque quem leva o golpe
    la em cima tem que continuar caindo sozinho -- se os dois descem juntos, a
    troca no ar nao teve consequencia.
  */
  const saltaF = decola + s(0.3);
  const pousaF = saltaF + s(1.15);
  pose(F, "coil", saltaF - s(0.12));
  estado[F].airborne = true;
  pose(F, "airborne", saltaF, xG + rumo * 40);
  pose(F, "airborne", saltaF + s(0.4), xG + rumo * 200);

  // ---- 3. O ENCONTRO -------------------------------------------------------
  const alcanca = saltaF + s(0.55);
  pose(F, "airAttack", alcanca, xG + rumo * 250);
  pose(G, "hitChest", alcanca, xG + rumo * 330);
  impacts.push({
    frame: alcanca,
    at: { x: xG + rumo * 290, y: ALTURA_QUADRIL - 620 },
    tier: "medium",
    direction: rumo,
    hitStop: 6,
    cracksGround: false,
    attacker: F,
    victim: G,
    sound: "punch",
  });
  poder({
    tipo: "choque",
    a: { x: xG + rumo * 290, y: ALTURA_QUADRIL - 620 },
    from: alcanca,
    to: alcanca + s(0.4),
    forca: 150,
    dir: rumo,
  });
  /*
    A CAMERA SOBE COM ELES. Deixada onde estava, a troca acontece acima da
    borda superior: medido no render anterior, os corpos apareciam pela metade
    no alto da tela durante o trecho aereo.
  */
  cameraKeys.push({
    frame: alcanca,
    center: { x: xG + rumo * 270, y: ALTURA_QUADRIL - 600 },
    zoom: 0.78,
    ease: s(0.3),
    shake: 14,
    cena: true,
  });

  // ---- 4. O REVIDE ---------------------------------------------------------
  const revida = alcanca + s(0.34);
  pose(G, "airAttack", revida, xG + rumo * 310);
  pose(F, "hitHead", revida, xG + rumo * 235);
  impacts.push({
    frame: revida,
    at: { x: xG + rumo * 265, y: ALTURA_QUADRIL - 640 },
    tier: "medium",
    direction: (-rumo) as 1 | -1,
    hitStop: 7,
    cracksGround: false,
    attacker: G,
    victim: F,
    sound: "punch",
  });
  poder({
    tipo: "choque",
    a: { x: xG + rumo * 265, y: ALTURA_QUADRIL - 640 },
    from: revida,
    to: revida + s(0.45),
    forca: 190,
    dir: (-rumo) as 1 | -1,
  });

  // ---- 5. AS DUAS QUEDAS ---------------------------------------------------
  pose(F, "launched", revida + s(0.16), xG - rumo * 60);
  estado[F].airborne = false;
  pose(F, "groundHit", pousaF, xG - rumo * 130);
  pose(F, "sitUp", pousaF + s(0.45));
  pose(F, "guard", pousaF + s(0.9));

  pose(G, "launched", revida + s(0.2), xG + rumo * 430);
  estado[G].airborne = false;
  pose(G, "groundHit", pousa, xG + rumo * 520);
  pose(G, "downed", pousa + s(0.22), xG + rumo * 560);
  pose(G, "sitUp", pousa + s(0.7));
  pose(G, "guard", pousa + s(1.15));

  cameraKeys.push({
    frame: pousaF,
    center: { x: xG + rumo * 200, y: ALTURA_QUADRIL - 120 },
    zoom: 0.62,
    ease: s(0.45),
    shake: 10,
    cena: true,
  });

  const fim = pousa + s(1.3);
  cameraKeys.push({
    frame: fim - s(0.4),
    center: { x: xG + rumo * 240, y: ALTURA_QUADRIL - 100 },
    zoom: 0.7,
    ease: s(0.5),
    cena: true,
  });
  return fim;
};
