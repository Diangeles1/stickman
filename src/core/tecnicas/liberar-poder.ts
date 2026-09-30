/**
 * LIBERAR TODO O PODER: o silêncio, o grito, e o chão soltando pedra.
 *
 * O roteiro pede "silêncio, ele sai dos destroços e libera uma enorme aura; o
 * chão racha e pedras começam a flutuar". O silêncio é a parte que costuma
 * ser cortada e é a que faz o resto valer: sem a pausa antes, a explosão de
 * aura é só mais uma coisa acontecendo numa cena onde tudo já acontece.
 *
 * Três tempos:
 *
 *   PARADO     ele sai dos destroços devagar, e a câmera fecha nele. Nada de
 *              efeito nenhum aqui -- é o vazio que prepara.
 *   ROMPE      a aura estoura de uma vez, não sobe gradualmente. Poder que
 *              cresce suave lê como carregamento; poder que rompe lê como
 *              limite sendo ultrapassado.
 *   SUSTENTA   as pedras sobem e FICAM no ar (ver effects/Poderes,
 *              PedrasFlutuantes), a rachadura se abre e o tremor segura.
 *
 * `quem` é quem libera. A cena inteira é dele: o outro não aparece.
 */

import type { NomeDePaleta, FighterId } from "../types";
import type { ContextoDeTecnica } from "./contexto";

export const liberarPoder = (
  ctx: ContextoDeTecnica,
  quem: FighterId,
  paleta: NomeDePaleta,
): number => {
  const { G, F, c, s, estado, pose, poder, nome, cameraKeys, ALTURA_QUADRIL, DISTANCIA_DE_ESPERA } =
    ctx;
  const x = estado[quem].x;

  // ---- 1. O SILÊNCIO ------------------------------------------------------
  pose(quem, "getUp", c);
  pose(quem, "idle", c + s(0.8));
  cameraKeys.push({ frame: c, center: { x, y: ALTURA_QUADRIL - 120 }, zoom: 1.35, ease: s(0.9), cena: true });

  /*
    A CARGA, ainda contida. O corpo agacha e junta: é a antecipação do que vem,
    e sem ela a aura estouraria a partir de um corpo parado.
  */
  const carrega = c + s(1.1);
  pose(quem, "cargaBaixa", carrega);
  cameraKeys.push({ frame: carrega, center: { x, y: ALTURA_QUADRIL - 90 }, zoom: 1.55, ease: s(0.5), shake: 5, cena: true });

  // ---- 2. ROMPE -----------------------------------------------------------
  const rompe = carrega + s(0.75);
  pose(quem, "charge", rompe);
  poder({ tipo: "telaBranca", from: rompe, to: rompe + 4 });
  poder({
    tipo: paleta === "azul" ? "auraGelo" : "auraFogo",
    quem,
    from: rompe,
    to: rompe + s(4.2),
    forca: 1,
    paleta,
  });
  poder({ tipo: "explosaoFogo", a: { x, y: ALTURA_QUADRIL - 60 }, from: rompe, to: rompe + s(0.7), forca: 300, paleta });
  poder({ tipo: "rachadura", a: { x, y: 0 }, from: rompe, to: rompe + s(4.2), forca: 640 });
  /*
    AS PEDRAS. Entram dois quadros DEPOIS do estouro, nunca junto: o chão
    reage ao poder, então ele tem que existir primeiro. Dois quadros bastam
    para o olho ler causa e efeito em vez de coincidência.
  */
  poder({
    tipo: "pedrasFlutuantes",
    a: { x, y: 0 },
    from: rompe + 2,
    to: rompe + s(4.2),
    forca: 520,
    paleta,
  });
  nome(paleta === "azul" ? "LIMITE" : "FURIA", quem, rompe + 6);
  cameraKeys.push({ frame: rompe, center: { x, y: ALTURA_QUADRIL - 130 }, zoom: 0.72, ease: 0, shake: 34, cena: true });

  // ---- 3. SUSTENTA --------------------------------------------------------
  const sustenta = rompe + s(0.9);
  cameraKeys.push({ frame: sustenta, center: { x, y: ALTURA_QUADRIL - 200 }, zoom: 0.56, ease: s(0.8), shake: 16, cena: true });
  pose(quem, "charge", sustenta + s(1.4));
  /*
    OS DOIS VOLTAM A SE ENCARAR ANTES DE A CENA ACABAR.

    Esta cena so mexia em quem libera o poder; o outro ficava onde a cena
    anterior o deixou. Medido na luta dos ninjas: o arremesso deixa os dois a
    1360 unidades um do outro, e essa distancia ATRAVESSAVA esta cena e a
    seguinte intacta. Quando enfim vinha um combo, o atacante corria 1360
    unidades ate o adversario -- e durante a corrida inteira o adversario
    estava FORA DA TELA, porque a camera nao consegue caber os dois a essa
    distancia num zoom legivel (ver ZOOM_MINIMO_LEGIVEL em camera/camera).

    O espectador via um personagem correndo em direcao a nada.

    Liberar poder e justamente o momento em que o outro se aproxima para
    encarar: a aproximacao ja era o que a cena pedia, e agora e tambem o que
    devolve a luta a distancia de combate.
  */
  const outro = quem === G ? F : G;
  const distancia = Math.abs(estado[outro].x - estado[quem].x);
  if (distancia > DISTANCIA_DE_ESPERA * 1.4) {
    const lado = estado[outro].x >= estado[quem].x ? 1 : -1;
    pose(outro, "walk1", rompe + s(0.6));
    pose(outro, "walk2", rompe + s(1.7), estado[quem].x + lado * DISTANCIA_DE_ESPERA * 1.15);
    pose(outro, "guard", rompe + s(2.2));
  }

  const fim = rompe + s(2.6);
  cameraKeys.push({ frame: fim - s(0.5), center: { x, y: ALTURA_QUADRIL - 150 }, zoom: 0.78, ease: s(0.6), shake: 9, cena: true });
  pose(quem, "guard", fim);
  return fim;
};
