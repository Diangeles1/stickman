/**
 * CHOQUE DE RAJADAS: os dois ataques máximos se encontram no meio.
 *
 * É o clímax do gênero, e o que o define não é o tamanho das rajadas -- é o
 * PONTO DE ENCONTRO. Duas rajadas que simplesmente se cruzam não têm disputa;
 * o que prende é a bolha de energia crescendo entre elas enquanto nenhum dos
 * dois cede, e o empurra-empurra do ponto de equilíbrio.
 *
 * Quatro camadas, e cada uma existe por um motivo diferente:
 *
 *   AS DUAS RAJADAS   feixes vindo de lados opostos, cada um parando no ponto
 *                     de encontro -- e não atravessando o outro. É o que
 *                     transforma dois disparos em uma disputa.
 *   O NÚCLEO          a esfera que cresce onde eles se tocam. Ela é o placar
 *                     da cena: quanto maior, mais perto do estouro.
 *   O CABO DE GUERRA  o ponto de encontro oscila, cedendo para um lado e
 *                     voltando. Ponto parado seria empate declarado no
 *                     primeiro quadro, e aí não há mais o que assistir.
 *   O DESMORONAMENTO  a arena reage: rachaduras e tremor que crescem junto.
 *
 * O ponto de encontro fica DESLOCADO do meio geométrico em favor de quem tem
 * mais `power` no preset. Não é enfeite: é a única coisa na cena que informa
 * quem está ganhando antes do resultado.
 */

import type { Tecnica } from "./contexto";

export const choqueDeRajadas: Tecnica = (ctx) => {
  const { G, F, c, lado, s, estado, pose, poder, nome, cameraKeys, impacts, ALTURA_QUADRIL } = ctx;

  const m = (estado[G].x + estado[F].x) / 2;
  const ALTURA = ALTURA_QUADRIL - 210;

  // ---- 1. AFASTAM-SE E CARREGAM -------------------------------------------
  /*
    A DISTANCIA ENTRE ELES E O QUE DECIDE SE OS DOIS CABEM NO QUADRO.

    A 700 de cada lado eles ficavam 1400 unidades separados, e nessa
    distancia a camera so cabe um: o azul saia de quadro e o que se via era o
    vermelho com um feixe chegando do nada pelo outro lado. A cena inteira
    depende de ver OS DOIS empurrando.

    A 430 eles cabem juntos com o nucleo entre eles, que e o enquadramento que
    esta cena existe para ter.
  */
  pose(G, "retreat", c + s(0.5), m - lado * 430);
  pose(F, "retreat", c + s(0.5), m + lado * 430);
  pose(G, "cargaBaixa", c + s(0.9));
  pose(F, "cargaBaixa", c + s(0.9));
  cameraKeys.push({ frame: c, center: { x: m, y: ALTURA_QUADRIL - 180 }, zoom: 0.5, ease: s(0.6), cena: true });

  /*
    A energia junta nas mãos dos dois ao mesmo tempo. Ancorada, então presa a
    elas: é o que liga o poder ao corpo em vez de deixá-lo flutuando ao lado.
  */
  const carrega = c + s(1.0);
  const postoG = m - lado * 430;
  const postoF = m + lado * 430;
  pose(G, "bracosFrente", carrega, postoG);
  pose(F, "bracosFrente", carrega, postoF);
  for (const [quem, paleta] of [[G, "azul"], [F, "vermelho"]] as const) {
    poder({
      tipo: "esferaInferno",
      quem,
      ancora: "entreMaos",
      a: { x: 70, y: -8 },
      from: carrega,
      to: carrega + s(1.1),
      forca: 78,
      paleta,
    });
  }
  nome("MAXIMO", F, carrega + s(0.3));
  cameraKeys.push({ frame: carrega + s(0.2), center: { x: m, y: ALTURA_QUADRIL - 160 }, zoom: 0.72, ease: s(0.7), shake: 8, cena: true });

  // ---- 2. DISPARAM --------------------------------------------------------
  const dispara = carrega + s(1.05);
  /*
    CADA RAJADA PARA NO PONTO DE ENCONTRO. Se elas atravessassem uma a outra,
    o que se veria seriam dois disparos que erraram; parando no mesmo ponto,
    o que se vê é força contra força.
  */
  const DESLOCA = 90; // a favor do mais forte (ver o cabo de guerra abaixo)
  poder({
    tipo: "feixeFogo",
    quem: G,
    ancora: "entreMaos",
    a: { x: 70, y: -8 },
    b: { x: m + lado * DESLOCA, y: ALTURA },
    from: dispara,
    to: dispara + s(5.2),
    forca: 210,
    paleta: "azul",
  });
  poder({
    tipo: "feixeFogo",
    quem: F,
    ancora: "entreMaos",
    a: { x: 70, y: -8 },
    b: { x: m + lado * DESLOCA, y: ALTURA },
    from: dispara,
    to: dispara + s(5.2),
    forca: 210,
    paleta: "vermelho",
  });
  poder({ tipo: "telaBranca", from: dispara, to: dispara + 5 });
  // fit: a camera calcula o zoom a partir da separacao e garante os dois
  cameraKeys.push({ frame: dispara, center: { x: m, y: ALTURA }, zoom: 0.78, ease: 0, shake: 22, fit: true, cena: true });

  /*
    ---- 3. O CABO DE GUERRA ------------------------------------------------

    O núcleo cresce em degraus e o ponto de encontro oscila. Cada etapa é uma
    esfera nova, maior e mais deslocada que a anterior: é assim que a cena
    conta que a disputa está escalando sem precisar de um só letreiro.

    O tremor sobe junto e a rachadura acompanha -- o cenário cedendo é o que
    dá escala ao que está acontecendo no ar.
  */
  const ETAPAS = 5;
  for (let k = 0; k < ETAPAS; k++) {
    const q = dispara + s(0.5) + k * s(0.85);
    const avanco = k % 2 === 0 ? 1 : -1;
    const onde = { x: m + lado * DESLOCA + avanco * (40 + k * 26), y: ALTURA };
    poder({
      tipo: "esferaInferno",
      a: onde,
      from: q,
      to: q + s(0.9),
      forca: 120 + k * 42,
      paleta: k % 2 === 0 ? "azul" : "vermelho",
    });
    poder({ tipo: "rachadura", a: { x: m + avanco * 120, y: 0 }, from: q, to: q + s(1.4), forca: 260 + k * 110 });

    /*
      OS CORPOS TAMBEM DISPUTAM.

      Medido com scripts/ritmo.mts: a primeira versao desta cena eram CINCO
      SEGUNDOS com os dois em `bracosFrente` sem uma chave sequer -- so a
      energia mudava. O video inteiro deu 67% de quadros parados contra 47%
      da referencia, e as pausas mais longas estavam todas aqui.

      Num choque assim o corpo e a coisa que mais trabalha: quem esta cedendo
      e EMPURRADO para tras e afunda na base; quem esta ganhando avanca e se
      estica. Duas chaves por etapa, alternando de lado junto com o nucleo --
      entao a posicao dos corpos conta a mesma historia que a esfera, e nao
      ha um so trecho em que nada muda.

      O deslocamento e pequeno (26 por etapa) de proposito: cabo de guerra se
      perde em centimetros, e passos grandes leriam como recuo voluntario.
    */
    const cedendo = avanco > 0 ? F : G;
    const ganhando = avanco > 0 ? G : F;
    const recuo = 26;
    pose(cedendo, "cargaBaixa", q, estado[cedendo].x + (cedendo === G ? -lado : lado) * recuo);
    pose(ganhando, "bracosFrente", q, estado[ganhando].x + (ganhando === G ? lado : -lado) * (recuo * 0.55));
    // e no meio da etapa os dois se firmam de novo: a disputa nao e uma queda
    pose(cedendo, "bracosFrente", q + s(0.42));
    pose(ganhando, "cargaBaixa", q + s(0.42));
    /*
      A camera alterna: plano dos DOIS (com fit) e close no nucleo. So o close
      perderia quem esta empurrando; so o plano aberto perderia a escalada da
      esfera. Alternar mostra as duas coisas sem cortar nenhuma.
    */
    cameraKeys.push(
      k % 2 === 0
        ? { frame: q, center: { x: m, y: ALTURA + 20 }, zoom: 0.8, ease: s(0.3), shake: 14 + k * 6, fit: true, cena: true }
        : { frame: q, center: { x: onde.x, y: ALTURA }, zoom: 1.15 + k * 0.08, ease: s(0.25), shake: 14 + k * 6, cena: true },
    );
  }

  // ---- 4. O ESTOURO -------------------------------------------------------
  const estoura = dispara + s(5.2);
  /*
    CHAVE DE POSICAO SEGURANDO OS DOIS ATE O ESTOURO.

    Sem ela os dois ESCORREGAM durante a rajada inteira. Nao por causa de
    nenhuma pose: a proxima chave de posicao e o arremesso da explosao, a 860
    de cada lado, e a amostragem interpola do posto ate la ao longo de todos
    os cinco segundos do feixe. Medido: eles comecavam a 860 de separacao e
    chegavam a 1632, e nessa distancia a camera perde um dos dois -- que era o
    "o azul sumiu do quadro".

    E o mesmo defeito que este motor ja teve noutros lugares: chave distante
    no futuro vira deriva lenta em tudo que vem antes dela. Quem precisa ficar
    parado precisa de uma chave dizendo isso.
  */
  pose(G, "bracosFrente", estoura - 2, postoG);
  pose(F, "bracosFrente", estoura - 2, postoF);
  poder({ tipo: "explosaoFogo", a: { x: m + lado * DESLOCA, y: ALTURA }, from: estoura, to: estoura + s(1.2), forca: 620, paleta: "azul" });
  poder({ tipo: "explosaoFogo", a: { x: m + lado * DESLOCA, y: ALTURA }, from: estoura + 3, to: estoura + s(1.2), forca: 560, paleta: "vermelho" });
  poder({ tipo: "telaBranca", from: estoura, to: estoura + s(0.55), forca: 1 });
  poder({ tipo: "rachadura", a: { x: m, y: 0 }, from: estoura, to: estoura + s(2.5), forca: 900 });
  cameraKeys.push({ frame: estoura, center: { x: m, y: ALTURA }, zoom: 0.42, ease: 0, shake: 40, cena: true });

  /*
    OS DOIS SÃO ARREMESSADOS, cada um para o seu lado. Impacto para os dois e
    não só para um: nesta cena ninguém venceu, e o motor precisa saber disso
    para o tremor e o som saírem dos dois lados.
  */
  for (const [quem, sinal] of [[G, -1], [F, 1]] as const) {
    impacts.push({
      frame: estoura,
      at: { x: estado[quem].x, y: ALTURA_QUADRIL - 120 },
      tier: "extreme",
      direction: (sinal * lado) as 1 | -1,
      hitStop: 12,
      cracksGround: true,
      sound: "explosion",
    });
    pose(quem, "launched", estoura + s(0.2), m + sinal * lado * 860);
    pose(quem, "groundHit", estoura + s(0.7));
    pose(quem, "downed", estoura + s(0.95), m + sinal * lado * 960);
  }

  /*
    ---- 5. OS DOIS TENTAM LEVANTAR -----------------------------------------

    O roteiro pede isto com todas as letras ("ambos tentam levantar") e a
    primeira versao entregou um `hold` de 260 quadros com os dois parados.
    Medido depois com scripts/ritmo.mts: 4,3 segundos sem um pixel mudar --
    a maior pausa do video inteiro, contra 1,2s da maior pausa da referencia.

    Corpo exausto nao fica imovel: ele tenta, nao consegue, e cede. Cada um
    tenta no seu tempo (o vermelho antes, o azul depois) porque sincronizados
    leriam como coreografia em vez de esgotamento.

    A tentativa vai ate `sitUp` e VOLTA para `downed`: o meio do caminho e o
    que conta a historia. Chegar a ficar de pe diria que ainda ha luta.
  */
  const tenta = estoura + s(1.6);
  pose(F, "sitUp", tenta);
  pose(F, "downed", tenta + s(0.75));
  pose(G, "sitUp", tenta + s(1.1));
  pose(G, "downed", tenta + s(1.85));
  // a segunda tentativa e mais curta: a forca esta acabando
  pose(F, "sitUp", tenta + s(2.3));
  pose(F, "downed", tenta + s(2.8));
  cameraKeys.push({ frame: tenta, center: { x: estado[F].x, y: ALTURA_QUADRIL - 40 }, zoom: 0.92, ease: s(0.8), cena: true });
  cameraKeys.push({ frame: tenta + s(1.1), center: { x: estado[G].x, y: ALTURA_QUADRIL - 40 }, zoom: 0.92, ease: s(0.7), cena: true });
  cameraKeys.push({ frame: tenta + s(2.4), center: { x: m, y: ALTURA_QUADRIL - 60 }, zoom: 0.5, ease: s(1.2), fit: true, cena: true });

  /*
    O MARCADOR DE FIM. Esta cena E o fim da luta: os dois ficam no chao e
    ninguem se levanta. Sem este letreiro o video simplesmente para -- o
    fecho (logo, os dois nomes, "QUEM DEVE VENCER?" e a narracao) so existe
    a partir dele (ver effects/espetaculo, montarCinematico).

    "FINAL" nao aparece escrito na tela: o espetaculo le o texto como sinal e
    desenha o fecho no lugar dele.
  */
  nome("FINAL", F, tenta + s(3.2));

  const fim = tenta + s(3.5);
  cameraKeys.push({ frame: estoura + s(0.8), center: { x: m, y: ALTURA_QUADRIL - 90 }, zoom: 0.46, ease: s(0.8), shake: 10, cena: true });
  return fim;
};
