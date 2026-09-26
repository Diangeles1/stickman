/**
 * BARREIRA: o golpe chega e PARA sozinho a um palmo do corpo.
 *
 * O efeito desta cena e a AUSENCIA. Nao ha explosao, nao ha bloqueio, nao ha
 * reacao do defensor -- so o punho travado no ar e o ar ondulando onde deveria
 * ter havido contato. Quem defende nem se mexe, e e isso que a torna
 * assustadora.
 *
 * Duas escolhas sustentam a leitura:
 *
 *   o quadro fecha no ESPACO entre o punho e o corpo, nao nos dois lutadores.
 *   E ali que a cena acontece; enquadrar os corpos inteiros diluiria o vazio
 *   que e o assunto da tomada.
 *
 *   o hit stop e longo e o impacto e "light" com cracksGround falso: o tempo
 *   trava como se tivesse havido um golpe, mas nada foi atingido. E o
 *   descompasso entre o peso do congelamento e a ausencia de dano que vende a
 *   barreira.
 */

import type { Tecnica } from "./contexto";

export const barreira: Tecnica = ({
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
}) => {
  const xG = estado[G].x;
  const xF = estado[F].x;
  pose(F, "run1", c + 8);
  const soco = c + s(0.5);
  pose(F, "bracosFrente", soco, xG + lado * 300);
  pose(G, "idle", soco);

  // close no espaco entre o punho e o corpo: e ali que a cena acontece
  const entre = { x: xG + lado * 190, y: ALTURA_QUADRIL - 210 };
  cameraKeys.push({
    frame: soco - 8,
    center: entre,
    zoom: 1.9,
    ease: 12,
    cena: true,
  });

  // duas ondas, a segunda maior e mais tarde: o ar cede em camadas
  poder({ tipo: "choque", a: entre, from: soco, to: soco + 30, forca: 150, paleta: "azul" });
  poder({ tipo: "choque", a: entre, from: soco + 6, to: soco + 36, forca: 210, paleta: "azul" });
  nome("INFINITO", G, soco + 4);

  // hitStop longo SEM dano: o tempo trava, mas nada foi atingido
  impacts.push({
    frame: soco,
    at: entre,
    tier: "light",
    direction: lado,
    hitStop: 12,
    cracksGround: false,
    sound: "block",
  });

  const fim = soco + s(0.85);
  // ele recua sozinho, sem ter sido empurrado
  pose(F, "retreat", fim, xF);
  pose(G, "idle", fim);
  cameraKeys.push({
    frame: soco + 20,
    center: { x: (xG + xF) / 2, y: ALTURA_QUADRIL - 180 },
    zoom: 1.0,
    ease: 18,
    fit: true,
    cena: true,
  });
  return fim;
};
