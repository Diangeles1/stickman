/**
 * SOMEM E COLIDEM NO CENTRO: a abertura.
 *
 * O roteiro pede "os dois se encaram, vento, ambos desaparecem e colidem no
 * centro". O truque todo está em COMO eles desaparecem, e a resposta não é
 * apagar os corpos -- é a velocidade fazer isso sozinha.
 *
 * O motor já acende rastro fantasma e linhas de velocidade acima de um
 * limiar (ver scenes/FightScene): deslocar os dois pela arena inteira em
 * poucos quadros passa MUITO desse limiar, e o que aparece na tela é um
 * borrão atravessando o quadro. Some porque é rápido, não porque sumiu --
 * que é a diferença entre um efeito e uma consequência.
 *
 * A colisão no centro não é um golpe de nenhum dos dois: é um impacto
 * simétrico, com os dois recuando. Dar o golpe a um deles decidiria a troca
 * no primeiro segundo, e esta cena existe justamente para não decidir nada.
 */

import type { Tecnica } from "./contexto";

export const sumirEColidir: Tecnica = (ctx) => {
  const { G, F, c, lado, s, estado, pose, poder, cameraKeys, impacts, ALTURA_QUADRIL } = ctx;

  const m = (estado[G].x + estado[F].x) / 2;

  // ---- 1. SE ENCARAM ------------------------------------------------------
  pose(G, "retreat", c + s(0.4), m - lado * 820);
  pose(F, "retreat", c + s(0.4), m + lado * 820);
  pose(G, "guard", c + s(0.7));
  pose(F, "guard", c + s(0.7));
  cameraKeys.push({ frame: c, center: { x: m, y: ALTURA_QUADRIL - 120 }, zoom: 0.5, ease: s(0.8), cena: true });
  // um close em cada um, seco: é a apresentação
  cameraKeys.push({ frame: c + s(1.0), center: { x: estado[G].x, y: ALTURA_QUADRIL - 250 }, zoom: 2.0, ease: 0, cena: true });
  cameraKeys.push({ frame: c + s(1.5), center: { x: estado[F].x, y: ALTURA_QUADRIL - 250 }, zoom: 2.0, ease: 0, cena: true });

  // ---- 2. SOMEM -----------------------------------------------------------
  /*
    A PARTIDA. Poses de locomoção em sprint: o motor só dá passada em pose de
    ciclo, e deslocar em guarda faria os dois escorregarem de pé (ver
    POSES_DE_APOIO em animation/corpo).

    Os quadros entre a saída e o encontro são poucos DE PROPÓSITO -- é o que
    leva a velocidade acima do limiar do rastro.
  */
  const parte = c + s(2.0);
  pose(G, "coil", parte - s(0.2));
  pose(F, "coil", parte - s(0.2));
  pose(G, "sprint1", parte);
  pose(F, "sprint1", parte);
  cameraKeys.push({ frame: parte - s(0.15), center: { x: m, y: ALTURA_QUADRIL - 140 }, zoom: 0.62, ease: s(0.2), cena: true });

  // ---- 3. COLIDEM ---------------------------------------------------------
  const colide = parte + s(0.32);
  pose(G, "punch", colide, m - lado * 120);
  pose(F, "punch", colide, m + lado * 120);
  poder({ tipo: "telaBranca", from: colide - 1, to: colide + 4 });
  poder({ tipo: "choque", a: { x: m, y: ALTURA_QUADRIL - 150 }, from: colide, to: colide + s(0.8), forca: 260, dir: lado });
  /*
    IMPACTO SIMÉTRICO: um para cada, sem vítima nem atacante. Esta troca não
    decide nada, e marcar um deles como quem acertou daria a resposta que a
    cena inteira existe para adiar.
  */
  for (const sinal of [-1, 1] as const) {
    impacts.push({
      frame: colide,
      at: { x: m, y: ALTURA_QUADRIL - 150 },
      tier: "extreme",
      direction: (sinal * lado) as 1 | -1,
      hitStop: 9,
      cracksGround: true,
      sound: "impact",
    });
  }
  cameraKeys.push({ frame: colide, center: { x: m, y: ALTURA_QUADRIL - 150 }, zoom: 1.5, ease: 0, shake: 30, cena: true });

  // ---- 4. RECUAM ----------------------------------------------------------
  const recua = colide + s(0.35);
  pose(G, "saltoParaTras", recua, m - lado * 420);
  pose(F, "saltoParaTras", recua, m + lado * 420);
  pose(G, "guard", recua + s(0.45));
  pose(F, "guard", recua + s(0.45));
  cameraKeys.push({ frame: recua, center: { x: m, y: ALTURA_QUADRIL - 130 }, zoom: 0.78, ease: s(0.4), fit: true, cena: true });

  const fim = recua + s(0.7);
  return fim;
};
