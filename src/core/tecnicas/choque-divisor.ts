/**
 * O CHOQUE QUE DECIDE.
 *
 * Os dois atravessam a arena correndo, cruzam num quadro so, e a luta acaba
 * ali -- sem troca de golpes, sem revide.
 *
 * A REGRA DESTA CENA e que o resultado acontece DEPOIS do cruzamento, nunca
 * durante. Enquanto eles se cruzam o quadro estoura em branco e nada e
 * mostrado; os dois param de costas um para o outro e por um instante nao ha
 * informacao nenhuma sobre quem acertou. E essa pausa que vale a cena: quem
 * escolheu um personagem no comeco do video esta apostando exatamente aqui.
 *
 * So entao o corte aparece, e o corpo se separa (ver effects/Divisao).
 *
 * `finalizador: true` no impacto e o que faz o resto do motor entender que a
 * luta acabou: dai saem o K.O., o nome do vencedor, a narracao e a placa
 * (ver effects/espetaculo).
 */

import type { Tecnica } from "./contexto";

export const choqueDivisor: Tecnica = (ctx) => {
  const { G, F, c, lado, s, estado, pose, poder, nome, cameraKeys, impacts, ALTURA_QUADRIL } = ctx;

  const m = (estado[G].x + estado[F].x) / 2;

  // 1. AFASTAM-SE. A distancia existe para a corrida ter o que percorrer.
  pose(G, "retreat", c + s(0.5), m - lado * 780);
  pose(F, "retreat", c + s(0.5), m + lado * 780);
  pose(G, "guard", c + s(0.75));
  pose(F, "guard", c + s(0.75));
  cameraKeys.push({ frame: c, center: { x: m, y: ALTURA_QUADRIL - 160 }, zoom: 0.55, ease: s(0.7), cena: true });
  nome("ULTIMO", F, c + s(0.9));

  // 2. CARREGAM, parados. O silencio antes da corrida.
  const carga = c + s(1.35);
  pose(G, "coil", carga);
  pose(F, "coil", carga);
  cameraKeys.push({ frame: carga, center: { x: m, y: ALTURA_QUADRIL - 130 }, zoom: 0.72, ease: s(0.5), cena: true });

  /*
    3. CORRIDA. Poses de locomocao, e nao deslocamento em guarda: o motor so
    da passadas em pose de ciclo, e reposicionar em guarda faz o corpo
    deslizar de pe (ver POSES_DE_APOIO em animation/corpo).
  */
  const corre = carga + s(0.55);
  pose(G, "sprint1", corre);
  pose(F, "sprint1", corre);

  /*
    4. O CRUZAMENTO. Eles TROCAM DE LADO -- e isso que diz que passaram um
    pelo outro, em vez de colidirem e pararem. A direcao em que cada um olha
    vem da posicao relativa, entao a troca de lado inverte os dois sozinha.
  */
  const cruza = corre + s(0.62);
  pose(G, "sprint1", cruza, m + lado * 300);
  pose(F, "sprint1", cruza, m - lado * 300);
  poder({ tipo: "telaBranca", from: cruza - 2, to: cruza + 6 });
  cameraKeys.push({ frame: cruza - s(0.2), center: { x: m, y: ALTURA_QUADRIL - 150 }, zoom: 1.15, ease: s(0.25), shake: 18, cena: true });

  /*
    5. A PAUSA. Os dois de costas, parados, sem sinal de quem acertou. Sem
    este silencio o corte seria a continuacao do movimento; com ele, vira a
    resposta a uma pergunta que ficou no ar.
  */
  const parados = cruza + s(0.18);
  pose(G, "idle", parados, m + lado * 340);
  pose(F, "idle", parados, m - lado * 340);
  pose(G, "idle", parados + s(1.1));
  pose(F, "idle", parados + s(1.1));
  cameraKeys.push({ frame: parados, center: { x: m, y: ALTURA_QUADRIL - 140 }, zoom: 0.82, ease: s(0.4), fit: true, cena: true });
  cameraKeys.push({ frame: parados + s(0.6), center: { x: m + lado * 340, y: ALTURA_QUADRIL - 200 }, zoom: 1.5, ease: s(0.5), cena: true });

  /*
    6. O CORTE. Primeiro a ferida aparece no corpo; so depois ele se separa.
    A ordem importa: ferida antes da separacao le como "foi cortado e agora
    cede"; separacao antes da ferida leria como explosao.
  */
  const revela = parados + s(1.25);
  poder({
    tipo: "marcaDeCorte",
    quem: G,
    from: revela,
    to: revela + 40,
    forca: 360,
    paleta: "sombra",
    vetor: { x: lado, y: -0.9 },
  });
  poder({
    tipo: "sangue",
    quem: G,
    a: { x: m + lado * 340, y: ALTURA_QUADRIL - 200 },
    from: revela + 4,
    to: revela + 50,
    forca: 1.4,
    vetor: { x: lado * 0.3, y: -1 },
  });
  impacts.push({
    frame: revela,
    at: { x: m + lado * 340, y: ALTURA_QUADRIL - 200 },
    tier: "extreme",
    direction: lado,
    hitStop: 14,
    cracksGround: false,
    sound: "corte",
    victim: G,
    attacker: F,
    finalizador: true,
  });
  cameraKeys.push({ frame: revela, center: { x: m + lado * 340, y: ALTURA_QUADRIL - 200 }, zoom: 1.7, ease: 0, shake: 26, cena: true });

  /*
    7. O CORPO SE SEPARA. A pose deixa de importar: o que anima daqui em
    diante sao as duas metades recortadas (ver effects/Divisao).
  */
  const parte = revela + s(0.55);
  poder({
    tipo: "divisao",
    quem: G,
    a: { x: 0, y: -215 },
    /*
      ANGULO DO CORTE: quase vertical, e isso tem conta.

      Um corpo deste motor tem cerca de 400 unidades de altura por 150 de
      largura. A 66 graus a linha do corte anda 400/tan(66) = 178 unidades na
      horizontal enquanto desce o corpo inteiro -- mais que a largura dele.
      Ela ENTRA e SAI pelo mesmo lado, e o que se separa e a cabeca com um
      ombro, nao metade do corpo.

      A 80 graus ela anda 70 unidades, cabe dentro das 150, e o corte
      atravessa a cabeca, o tronco e sai entre as pernas: as duas metades
      ficam com corpo.
    */
    dir: 80,
    from: parte,
    to: parte + s(1.6),
    forca: 150,
  });
  cameraKeys.push({ frame: parte, center: { x: m + lado * 340, y: ALTURA_QUADRIL - 150 }, zoom: 1.1, ease: s(0.5), cena: true });

  /*
    O FIM PRECISA DE TEMPO DEPOIS DA QUEDA, e nao e margem: e o fecho inteiro.

    Depois do corpo cair vem o K.O. (78 quadros apos o golpe), o nome de quem
    venceu e a pergunta que cobra a aposta da tela de escolha -- cerca de
    quatro segundos e meio de coisas acontecendo. Com os 2.4 que havia aqui, o
    video acabava 43 quadros depois de o fecho comecar e cortava no meio dele.
  */
  const fim = parte + s(6.0);
  // o vencedor continua de costas: ele nao precisa olhar para tras
  pose(F, "idle", fim);
  cameraKeys.push({ frame: parte + s(1.2), center: { x: m, y: ALTURA_QUADRIL - 130 }, zoom: 0.78, ease: s(1.0), cena: true });
  return fim;
};
