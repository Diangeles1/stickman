/**
 * DOMINIO DO VAZIO: a resposta do outro lado.
 *
 * Vem depois do dominio do marcado, e o ponto e que ele NAO e o mesmo golpe
 * com outra cor. Dois dominios identicos em funcao seriam um repetido; o que
 * faz o segundo valer e ele resolver o problema por um caminho oposto:
 *
 *   o do marcado   domina CORTANDO -- chuva de laminas, sangue, dano
 *   este           domina PARANDO  -- nada corta ninguem, e o adversario
 *                  simplesmente deixa de conseguir agir
 *
 * Um espaco sem fim nao machuca: ele ocupa. Por isso aqui nao ha um unico
 * impacto ate o fim da cena -- o corpo do outro apenas cede, de pe, e depois
 * ajoelha. Cena de poder sem dano e mais dificil de ler, e e por isso que a
 * camera para nele: sem o corpo de quem esta preso, sobra so fundo bonito.
 *
 * O GESTO E O MESMO das maos unidas. De proposito: repetido pelos dois
 * lutadores, ele deixa de ser maneirismo de um e vira a regra do mundo --
 * e assim que se abre um dominio aqui.
 */

import type { Tecnica } from "./contexto";

export const dominioVazio: Tecnica = (ctx) => {
  const { G, F, c, lado, s, estado, pose, poder, nome, cameraKeys, ALTURA_QUADRIL } = ctx;

  const m = (estado[G].x + estado[F].x) / 2;
  /*
    SO G SE DESLOCA. A primeira versao tambem reposicionava F, com
    `pose(F, "guard", c + 10, x)` -- e guard e pose de APOIO que nao e de
    LOCOMOCAO: o motor nao tem passo para dar nela, entao o corpo escorrega
    de pe ate a marca. scripts/pes.mts mediu 21 unidades num quadro so.

    F nao precisa se mover: quem se afasta para fazer o gesto e G, e o
    enquadramento ja separa os dois. Reposicionamento que a cena nao pede e
    onde este defeito costuma entrar.
  */
  pose(F, "guard", c + 10);
  pose(G, "retreat", c + s(0.55), m - lado * 640);

  const reza = c + s(0.72);
  pose(G, "oracao", reza);
  cameraKeys.push({ frame: reza, center: { x: estado[G].x, y: ALTURA_QUADRIL - 110 }, zoom: 1.45, ease: s(0.4), cena: true });

  const carrega = reza + s(0.45);
  poder({
    tipo: "esferaInferno",
    quem: G,
    ancora: "entreMaos",
    a: { x: 44, y: -4 },
    from: carrega,
    to: carrega + s(0.6),
    forca: 20,
    paleta: "vazio",
  });
  poder({ tipo: "rachadura", a: { x: estado[G].x, y: 0 }, from: carrega + s(0.25), to: carrega + s(1.4), forca: 320 });
  cameraKeys.push({ frame: carrega + s(0.3), center: { x: estado[G].x, y: ALTURA_QUADRIL - 130 }, zoom: 1.6, ease: s(0.45), shake: 7, cena: true });

  const abre = carrega + s(0.65);
  pose(G, "bracosFrente", abre);
  poder({ tipo: "telaBranca", from: abre, to: abre + 4 });
  poder({
    tipo: "dominio",
    quem: G,
    ancora: "peito",
    a: { x: 0, y: -40 },
    from: abre,
    to: abre + s(3.2),
    forca: 1900,
    paleta: "vazio",
  });
  nome("VAZIO", G, abre + 8);
  /*
    A camera abre MAIS que no outro dominio (0.38 contra 0.44). O espaco deste
    nao tem construcao para olhar; o que ele tem e profundidade, e profundidade
    so aparece se houver distancia no quadro.
  */
  cameraKeys.push({ frame: abre, center: { x: m, y: ALTURA_QUADRIL - 240 }, zoom: 0.38, ease: 7, shake: 16, cena: true });
  cameraKeys.push({ frame: abre + s(0.9), center: { x: m, y: ALTURA_QUADRIL - 250 }, zoom: 0.56, ease: 22, cena: true });

  /*
    O OUTRO PARA. Nenhum golpe o atinge -- ele cede sozinho, que e o que este
    dominio faz. Tres tempos: primeiro o corpo vacila de pe, depois nao
    sustenta mais a guarda, e por ultimo ajoelha. Cair de uma vez leria como
    golpe recebido, e nao houve golpe nenhum.
  */
  const prende = abre + s(0.55);
  pose(F, "stagger", prende);
  cameraKeys.push({ frame: prende, center: { x: estado[F].x, y: ALTURA_QUADRIL - 160 }, zoom: 1.25, ease: s(0.5), cena: true });
  pose(F, "stagger", prende + s(0.9));
  pose(F, "duck", prende + s(1.25));
  pose(F, "ajoelhado", prende + s(1.8));
  cameraKeys.push({ frame: prende + s(1.5), center: { x: estado[F].x, y: ALTURA_QUADRIL - 90 }, zoom: 1.5, ease: s(0.8), cena: true });

  // o dominio se recolhe e ele volta a ficar de pe: aguentou
  const fim = abre + s(3.6);
  pose(F, "getUp", fim - s(0.5));
  pose(F, "guard", fim);
  pose(G, "guard", fim);
  cameraKeys.push({ frame: fim - s(0.6), center: { x: m, y: ALTURA_QUADRIL - 140 }, zoom: 0.88, ease: s(0.6), fit: true, cena: true });
  return fim;
};
