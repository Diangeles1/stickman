/**
 * CERCO EM PROFUNDIDADE: a luta deixa de acontecer numa linha.
 *
 * Esta cena existe primeiro como PROVA. O motor ganhou um eixo de
 * profundidade (ver FighterTrack.keys.z e escalaDaProfundidade em
 * animation/corpo), e um eixo que nenhuma cena usa e um eixo que ninguem sabe
 * se funciona. Aqui ele e exercitado nas tres coisas que fazem profundidade
 * ser lida, e as tres tem que aparecer juntas:
 *
 *   TAMANHO   o corpo ao fundo e menor
 *   CHAO      e esta mais alto na tela, mais perto do horizonte
 *   ORDEM     e passa ATRAS do outro quando se cruzam
 *
 * Qualquer uma sozinha falha. So o tamanho faz o lutador parecer um
 * brinquedo; so a altura faz ele flutuar; so a ordem faz dois adesivos
 * trocarem de lugar. E o conjunto que convence.
 *
 * A COREOGRAFIA. Um dos dois recua para o fundo do vale e ataca em diagonal,
 * cortando o palco em vez de atravessar a linha de sempre. O outro o segue
 * com o corpo, nao so com o olhar, e os dois se encontram de volta na frente
 * -- que e onde o golpe tem que acontecer, porque golpe ao fundo e golpe
 * pequeno.
 *
 * O CUIDADO QUE ESTA CENA TEM QUE TER, e que vale para toda cena que use
 * profundidade: o contato acontece com os dois NO MESMO PLANO. A cinematica
 * inversa mira num ponto de TELA, entao dois corpos em planos diferentes
 * podem se sobrepor perfeitamente no quadro estando longe um do outro no
 * palco -- e o golpe "acerta" atravessando o cenario. scripts/coreografia.mts
 * reprova isso, mas a cena e quem tem que evitar.
 */

import type { Tecnica } from "./contexto";

/** o quanto o palco tem de profundidade util, para os dois lados */
const FUNDO = 520;

export const cercoEmProfundidade: Tecnica = (ctx) => {
  const { G, F, c, s, estado, pose, cameraKeys, impacts, ALTURA_QUADRIL } =
    ctx;

  const xG = estado[G].x;
  const xF = estado[F].x;
  const rumo: 1 | -1 = xG <= xF ? 1 : -1;
  const meio = (xG + xF) / 2;

  // ---- 1. UM RECUA PARA O FUNDO -------------------------------------------
  /*
    O RECUO E DIAGONAL, e nao reto para tras.

    Andando so em z o corpo encolhe no lugar, e encolher no lugar nao le como
    afastar-se: le como o personagem estar diminuindo. Com x mudando junto, o
    corpo descreve um caminho no palco e a mudanca de tamanho vira consequencia
    de ir a algum lugar.
  */
  pose(G, "retreat", c + s(0.45), xG - rumo * 120, FUNDO * 0.45);
  pose(G, "sprint1", c + s(0.8), meio - rumo * 640, FUNDO);
  pose(G, "guard", c + s(1.15), meio - rumo * 700, FUNDO);
  // o outro acompanha com o corpo, e nao so com o olhar
  pose(F, "walk1", c + s(0.9), xF - rumo * 180, FUNDO * 0.2);
  pose(F, "guard", c + s(1.2), xF - rumo * 220, FUNDO * 0.25);

  /*
    A CAMERA NAO ABRE ENQUANTO ELE RECUA -- e essa foi a primeira licao desta
    cena.

    A versao anterior abria para zoom 0,46 no mesmo movimento, e o resultado
    medido no render foi profundidade INVISIVEL: a camera encolhe os DOIS
    corpos por igual, e a diferenca de tamanho entre quem foi ao fundo (escala
    0,73) e quem ficou (0,99) desaparece dentro do encolhimento geral. O mesmo
    vale para a subida na linha do chao: 84 unidades viram 39 pixels a 0,46.

    Perspectiva so e lida contra uma referencia estavel. Quem tem que mudar de
    tamanho no quadro e o corpo, nao o quadro.
  */
  cameraKeys.push({
    frame: c + s(0.5),
    center: { x: meio - rumo * 240, y: ALTURA_QUADRIL - 230 },
    zoom: 0.84,
    ease: s(0.7),
    cena: true,
  });

  // ---- 2. A INVESTIDA EM DIAGONAL -----------------------------------------
  /*
    ELE CORTA O PALCO. Sai do fundo e chega na frente ao mesmo tempo em que
    atravessa a arena: as duas coordenadas mudam juntas, entao o corpo cresce
    ENQUANTO avanca, que e a leitura de alguem vindo para cima da camera.
  */
  const investe = c + s(1.5);
  pose(G, "coil", investe - s(0.15));
  pose(G, "sprint1", investe, meio - rumo * 420, FUNDO * 0.7);
  pose(G, "sprint1", investe + s(0.3), meio + rumo * 40, FUNDO * 0.25);
  /*
    AQUI HAVIA UMA RACHADURA NO CHAO durante a corrida, para marcar a
    partida. `qualidade` reprovou com a regra certa -- "efeito depois da
    causa": o chao rachava no quadro 675 e o impacto que rachava o chao so
    acontecia depois.

    Nao foi um erro de tempo, foi de escolha: rachadura e consequencia de
    pancada, e ninguem racha o chao por comecar a correr. O que marca a
    partida aqui e a propria velocidade, que ja acende o rastro e as linhas
    (ver LIMITE_SMEAR em scenes/FightScene).
  */
  cameraKeys.push({
    frame: investe,
    center: { x: meio - rumo * 120, y: ALTURA_QUADRIL - 190 },
    zoom: 0.80,
    ease: s(0.3),
    cena: true,
  });

  // ---- 3. O ENCONTRO, OS DOIS NA MESMA LINHA ------------------------------
  /*
    O GOLPE ACONTECE NA FRENTE, e com os dois no mesmo plano.

    Na frente porque golpe ao fundo e golpe pequeno -- a profundidade serve
    para ir e voltar, nao para brigar la atras. E no mesmo plano porque um
    golpe que atravessa profundidade acerta sem encostar.
  */
  /*
    A ANTECIPACAO NAO E ENFEITE: sem ela o punho viaja em LINHA RETA.

    A primeira versao ia de `sprint1` direto para `punchHeavy`, e `arcos`
    reprovou com curvatura 0,14 numa corda de 426 unidades -- o punho
    atravessava quase meio palco em linha reta, porque nao havia pose entre a
    corrida e o golpe para o braco recuar. Um braco que nunca volta nunca faz
    curva.
  */
  const arma = investe + s(0.3);
  pose(G, "coil", arma, meio + rumo * 105, 0);
  // um quadro de meio-caminho: com duas chaves so, a interpolacao entre coil e
  // punchHeavy e uma RETA no espaco das juntas, e o punho nao descreve curva
  pose(G, "punch", arma + s(0.11), meio + rumo * 120, 0);
  const bate = arma + s(0.22);
  pose(G, "punchHeavy", bate, meio + rumo * 130, 0);
  pose(F, "hitChest", bate, meio + rumo * 330, 0);
  impacts.push({
    frame: bate,
    at: { x: meio + rumo * 250, y: ALTURA_QUADRIL - 220 },
    tier: "extreme",
    direction: rumo,
    hitStop: 11,
    cracksGround: true,
    attacker: G,
    victim: F,
    sound: "impact",
  });
  cameraKeys.push({
    frame: bate,
    center: { x: meio + rumo * 200, y: ALTURA_QUADRIL - 180 },
    zoom: 1.15,
    ease: 0,
    shake: 26,
    cena: true,
  });

  // ---- 4. O RECUO DE QUEM LEVOU -------------------------------------------
  const recua = bate + s(0.3);
  pose(F, "knockback", recua, meio + rumo * 560, 0);
  pose(F, "stagger", recua + s(0.35), meio + rumo * 640, 0);
  /*
    A CENA DEVOLVE OS DOIS NA DISTANCIA DE COMBATE, e isso e obrigacao de toda
    cena, nao detalhe de acabamento.

    Terminando com 450 unidades entre eles, o golpe da cena SEGUINTE tinha que
    atravessar o vao inteiro durante a preparacao -- medido em arcos.mts: o
    punho percorria uma corda de 429 unidades com curvatura 0,13, ou seja, em
    linha reta. O defeito aparecia num golpe que esta a beats de distancia
    daqui, e nao neste arquivo.
  */
  pose(F, "guard", recua + s(0.8), meio + rumo * 400, 0);
  pose(G, "guard", recua + s(0.5), meio + rumo * 90, 0);

  const fim = recua + s(1.1);
  cameraKeys.push({
    frame: recua + s(0.4),
    center: { x: meio + rumo * 350, y: ALTURA_QUADRIL - 120 },
    zoom: 0.72,
    ease: s(0.6),
    cena: true,
  });
  return fim;
};
