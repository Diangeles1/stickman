/**
 * Biblioteca de poses.
 *
 * Cada pose declara SO o que muda em relacao a base (ver skeleton.ts), entao a
 * diferenca entre duas poses fica visivel na leitura.
 *
 * Muitos destes valores vieram do prototipo em Python (references/) e ja foram
 * ajustados olhando o resultado na tela, nao chutados. Dois aprendizados que
 * estao embutidos aqui:
 *
 * 1. Golpe precisa de EXTENSAO grande para ser lido em tela de celular. Soco
 *    com a mao a 44 de distancia (a base) nao se ve; a 92 se ve.
 * 2. Pose de plano fechado precisa mirar o terco superior do corpo. No
 *    prototipo, enquadrar pela altura errada cortava a cabeca do personagem.
 */

import type { Pose, PoseName } from "../core/types";

const p = (pose: Pose): Pose => pose;

export const POSES: Record<PoseName, Pose> = {
  idle: p({}),

  guard: p({
    neck: { x: 4, y: -74 },
    head: { x: 6, y: -114 },
    elbowBack: { x: -6, y: -38 },
    handBack: { x: 10, y: -52 },
    elbowFront: { x: 14, y: -38 },
    handFront: { x: 30, y: -56 },
    kneeBack: { x: -22, y: 46 },
    footBack: { x: -40, y: 92 },
    kneeFront: { x: 18, y: 46 },
    footFront: { x: 34, y: 92 },
  }),

  // --- locomocao -----------------------------------------------------------
  // duas poses por ciclo, alternadas. Tres ou mais nao melhoraram a leitura no
  // prototipo e so aumentaram o trabalho de ajuste.
  walk1: p({
    neck: { x: 6, y: -74 },
    kneeFront: { x: 30, y: 44 },
    footFront: { x: 52, y: 88 },
    kneeBack: { x: -26, y: 50 },
    footBack: { x: -54, y: 90 },
    elbowFront: { x: 10, y: -34 },
    handFront: { x: -6, y: -22 },
    elbowBack: { x: -16, y: -36 },
    handBack: { x: 6, y: -24 },
  }),
  walk2: p({
    neck: { x: 6, y: -74 },
    kneeFront: { x: -14, y: 50 },
    footFront: { x: -42, y: 90 },
    kneeBack: { x: 26, y: 44 },
    footBack: { x: 48, y: 88 },
    elbowFront: { x: -14, y: -34 },
    handFront: { x: 4, y: -22 },
    elbowBack: { x: 14, y: -36 },
    handBack: { x: -4, y: -24 },
  }),
  run1: p({
    neck: { x: 22, y: -70 },
    head: { x: 32, y: -108 },
    kneeFront: { x: 46, y: 30 },
    footFront: { x: 74, y: 62 },
    kneeBack: { x: -34, y: 54 },
    footBack: { x: -72, y: 76 },
    elbowFront: { x: 30, y: -52 },
    handFront: { x: 14, y: -80 },
    elbowBack: { x: -24, y: -44 },
    handBack: { x: -46, y: -24 },
  }),
  run2: p({
    neck: { x: 22, y: -70 },
    head: { x: 32, y: -108 },
    kneeFront: { x: -16, y: 40 },
    footFront: { x: -58, y: 74 },
    kneeBack: { x: 34, y: 34 },
    footBack: { x: 66, y: 60 },
    elbowFront: { x: -20, y: -44 },
    handFront: { x: -42, y: -26 },
    elbowBack: { x: 28, y: -50 },
    handBack: { x: 12, y: -78 },
  }),
  sprint1: p({
    neck: { x: 34, y: -62 },
    head: { x: 52, y: -96 },
    kneeFront: { x: 58, y: 22 },
    footFront: { x: 92, y: 54 },
    kneeBack: { x: -44, y: 58 },
    footBack: { x: -88, y: 72 },
    elbowFront: { x: 38, y: -58 },
    handFront: { x: 20, y: -92 },
    elbowBack: { x: -34, y: -40 },
    handBack: { x: -62, y: -14 },
  }),
  sprint2: p({
    neck: { x: 34, y: -62 },
    head: { x: 52, y: -96 },
    kneeFront: { x: -22, y: 36 },
    footFront: { x: -70, y: 70 },
    kneeBack: { x: 44, y: 26 },
    footBack: { x: 84, y: 56 },
    elbowFront: { x: -26, y: -40 },
    handFront: { x: -54, y: -16 },
    elbowBack: { x: 36, y: -56 },
    handBack: { x: 18, y: -90 },
  }),

  // --- ar ------------------------------------------------------------------
  jump: p({
    neck: { x: 4, y: -78 },
    kneeFront: { x: 26, y: 18 },
    footFront: { x: 40, y: 58 },
    kneeBack: { x: -20, y: 22 },
    footBack: { x: -36, y: 62 },
    elbowFront: { x: 20, y: -74 },
    handFront: { x: 12, y: -110 },
    elbowBack: { x: -18, y: -72 },
    handBack: { x: -10, y: -108 },
  }),
  airborne: p({
    neck: { x: -6, y: -76 },
    head: { x: -12, y: -116 },
    kneeFront: { x: 34, y: 24 },
    footFront: { x: 58, y: 48 },
    kneeBack: { x: -28, y: 34 },
    footBack: { x: -58, y: 58 },
    elbowFront: { x: 24, y: -60 },
    handFront: { x: 34, y: -94 },
    elbowBack: { x: -26, y: -56 },
    handBack: { x: -44, y: -84 },
  }),
  land: p({
    neck: { x: 0, y: -60 },
    head: { x: 0, y: -98 },
    kneeFront: { x: 34, y: 54 },
    footFront: { x: 44, y: 92 },
    kneeBack: { x: -32, y: 56 },
    footBack: { x: -48, y: 92 },
    elbowFront: { x: 26, y: -26 },
    handFront: { x: 40, y: 4 },
    elbowBack: { x: -24, y: -24 },
    handBack: { x: -38, y: 6 },
  }),

  // --- defensivas ----------------------------------------------------------
  dodge: p({
    neck: { x: -18, y: -68 },
    head: { x: -34, y: -102 },
    kneeBack: { x: -34, y: 58 },
    footBack: { x: -52, y: 92 },
    kneeFront: { x: 26, y: 60 },
    footFront: { x: 44, y: 92 },
    elbowFront: { x: -4, y: -34 },
    handFront: { x: -22, y: -48 },
  }),
  duck: p({
    hip: { x: 0, y: 46 },
    neck: { x: 6, y: -40 },
    head: { x: 14, y: -74 },
    kneeFront: { x: 34, y: 30 },
    footFront: { x: 44, y: 48 },
    kneeBack: { x: -32, y: 32 },
    footBack: { x: -48, y: 48 },
  }),
  advance: p({
    neck: { x: 12, y: -72 },
    head: { x: 18, y: -112 },
    kneeFront: { x: 30, y: 44 },
    footFront: { x: 48, y: 90 },
    elbowFront: { x: 18, y: -40 },
    handFront: { x: 34, y: -58 },
  }),
  retreat: p({
    neck: { x: -12, y: -72 },
    head: { x: -18, y: -112 },
    kneeBack: { x: -32, y: 44 },
    footBack: { x: -54, y: 90 },
    elbowFront: { x: -4, y: -40 },
    handFront: { x: 2, y: -54 },
  }),
  block: p({
    neck: { x: -6, y: -74 },
    head: { x: -8, y: -114 },
    elbowFront: { x: 26, y: -78 },
    handFront: { x: 34, y: -114 },
    elbowBack: { x: 6, y: -64 },
    handBack: { x: 18, y: -98 },
    kneeFront: { x: 22, y: 48 },
    footFront: { x: 38, y: 92 },
  }),

  /**
   * CARGA: o corpo se enrola antes de golpear.
   *
   * A antecipacao era so um passo de 46 unidades para tras, com o corpo na
   * guarda: nao havia arco nenhum para o punho percorrer, e um golpe sem arco
   * e um braco que aparece esticado. Aqui o punho recua ate o ombro e o peso
   * vai para a perna de tras. E o arco entre esta pose e a do golpe que o olho
   * le como velocidade.
   *
   * Uma pose para todos os golpes: o compilador usa esta na preparacao de
   * qualquer ataque, entao melhorar aqui melhora a luta inteira.
   */
  coil: p({
    hip: { x: -12, y: 6 },
    neck: { x: -16, y: -70 },
    head: { x: -22, y: -108 },
    // o punho volta para junto do ombro
    elbowFront: { x: -6, y: -52 },
    handFront: { x: -28, y: -62 },
    elbowBack: { x: -24, y: -44 },
    handBack: { x: -6, y: -58 },
    // peso e joelho na perna de tras: energia guardada
    kneeBack: { x: -32, y: 50 },
    footBack: { x: -54, y: 92 },
    kneeFront: { x: 18, y: 50 },
    footFront: { x: 30, y: 92 },
  }),

  // --- socos ---------------------------------------------------------------
  punch: p({
    // o quadril gira para dentro do golpe
    hip: { x: 8, y: 2 },
    neck: { x: 10, y: -72 },
    head: { x: 16, y: -110 },
    elbowFront: { x: 40, y: -62 },
    handFront: { x: 86, y: -72 },
    elbowBack: { x: -18, y: -46 },
    handBack: { x: -26, y: -60 },
    kneeFront: { x: 34, y: 46 },
    footFront: { x: 58, y: 92 },
    // a perna de tras ESTICA: e ela que empurra o corpo para dentro do soco.
    // Antes ficava na pose base, e o soco saia so do braco.
    kneeBack: { x: -36, y: 54 },
    footBack: { x: -76, y: 92 },
  }),
  punchFast: p({
    neck: { x: 8, y: -72 },
    elbowFront: { x: 36, y: -64 },
    handFront: { x: 74, y: -70 },
    elbowBack: { x: -12, y: -44 },
    handBack: { x: -18, y: -56 },
  }),
  punchHeavy: p({
    neck: { x: 18, y: -68 },
    head: { x: 28, y: -104 },
    elbowFront: { x: 46, y: -58 },
    handFront: { x: 104, y: -66 },
    elbowBack: { x: -26, y: -48 },
    handBack: { x: -44, y: -62 },
    kneeFront: { x: 44, y: 44 },
    footFront: { x: 74, y: 92 },
    kneeBack: { x: -34, y: 52 },
    footBack: { x: -66, y: 92 },
  }),
  uppercut: p({
    neck: { x: 6, y: -78 },
    head: { x: 10, y: -118 },
    elbowFront: { x: 34, y: -60 },
    handFront: { x: 54, y: -136 },
    elbowBack: { x: -14, y: -44 },
    handBack: { x: -20, y: -58 },
    kneeFront: { x: 26, y: 40 },
    footFront: { x: 40, y: 92 },
  }),

  // --- chutes --------------------------------------------------------------
  kick: p({
    neck: { x: -12, y: -72 },
    head: { x: -20, y: -110 },
    kneeFront: { x: 52, y: 4 },
    footFront: { x: 104, y: -18 },
    kneeBack: { x: -20, y: 52 },
    footBack: { x: -34, y: 92 },
    elbowFront: { x: -14, y: -44 },
    handFront: { x: -36, y: -58 },
    elbowBack: { x: -26, y: -40 },
    handBack: { x: -52, y: -50 },
  }),
  kickLow: p({
    neck: { x: -8, y: -72 },
    kneeFront: { x: 44, y: 52 },
    footFront: { x: 92, y: 74 },
    kneeBack: { x: -18, y: 52 },
    footBack: { x: -32, y: 92 },
    elbowFront: { x: -10, y: -42 },
    handFront: { x: -28, y: -54 },
  }),
  kickHigh: p({
    neck: { x: -18, y: -70 },
    head: { x: -30, y: -106 },
    kneeFront: { x: 48, y: -34 },
    footFront: { x: 96, y: -96 },
    kneeBack: { x: -18, y: 54 },
    footBack: { x: -30, y: 92 },
    elbowFront: { x: -18, y: -44 },
    handFront: { x: -42, y: -56 },
  }),
  spinKick: p({
    neck: { x: -16, y: -68 },
    head: { x: -28, y: -104 },
    kneeFront: { x: 40, y: -28 },
    footFront: { x: 100, y: -60 },
    kneeBack: { x: -16, y: 50 },
    footBack: { x: -28, y: 92 },
    elbowFront: { x: -22, y: -50 },
    handFront: { x: -52, y: -62 },
    elbowBack: { x: -30, y: -36 },
    handBack: { x: -58, y: -42 },
  }),

  // --- curtos --------------------------------------------------------------
  knee: p({
    neck: { x: 8, y: -74 },
    kneeFront: { x: 44, y: -18 },
    footFront: { x: 40, y: 26 },
    kneeBack: { x: -18, y: 52 },
    footBack: { x: -32, y: 92 },
    elbowFront: { x: 22, y: -48 },
    handFront: { x: 36, y: -30 },
  }),
  elbow: p({
    neck: { x: 14, y: -72 },
    head: { x: 22, y: -108 },
    elbowFront: { x: 62, y: -74 },
    handFront: { x: 30, y: -96 },
    elbowBack: { x: -16, y: -46 },
    handBack: { x: -24, y: -58 },
    kneeFront: { x: 32, y: 46 },
    footFront: { x: 54, y: 92 },
  }),

  // --- aereos e especiais --------------------------------------------------
  airAttack: p({
    neck: { x: 10, y: -74 },
    head: { x: 18, y: -112 },
    elbowFront: { x: 42, y: -58 },
    handFront: { x: 92, y: -66 },
    kneeFront: { x: 30, y: 26 },
    footFront: { x: 48, y: 54 },
    kneeBack: { x: -24, y: 32 },
    footBack: { x: -50, y: 56 },
  }),
  diveAttack: p({
    neck: { x: 16, y: -66 },
    head: { x: 28, y: -100 },
    kneeFront: { x: 50, y: 34 },
    footFront: { x: 104, y: 56 },
    kneeBack: { x: -22, y: 20 },
    footBack: { x: -46, y: 40 },
    elbowFront: { x: 20, y: -70 },
    handFront: { x: 10, y: -104 },
  }),
  charge: p({
    neck: { x: 0, y: -80 },
    head: { x: 0, y: -120 },
    elbowBack: { x: -30, y: -46 },
    handBack: { x: -18, y: -18 },
    elbowFront: { x: 30, y: -46 },
    handFront: { x: 18, y: -18 },
    kneeBack: { x: -30, y: 50 },
    footBack: { x: -50, y: 92 },
    kneeFront: { x: 30, y: 50 },
    footFront: { x: 50, y: 92 },
  }),

  // --- reacoes -------------------------------------------------------------
  /**
   * REACOES POR REGIAO ATINGIDA.
   *
   * O briefing e explicito: golpe no rosto nao pode produzir a mesma reacao de
   * golpe na perna. Cada uma dobra o corpo de um jeito reconhecivel, e todas
   * sao mais extremas do que pareceria certo numa pose parada: elas ficam na
   * tela por poucos quadros, e reacao timida simplesmente nao se le.
   */

  /** Soco no rosto: a cabeca CHICOTEIA para tras e o tronco vem atras. */
  hitHead: p({
    neck: { x: -22, y: -70 },
    head: { x: -76, y: -96 },
    elbowFront: { x: -6, y: -54 },
    handFront: { x: -30, y: -78 },
    elbowBack: { x: -30, y: -44 },
    handBack: { x: -54, y: -58 },
    kneeFront: { x: 26, y: 50 },
    footFront: { x: 44, y: 92 },
    kneeBack: { x: -34, y: 54 },
    footBack: { x: -64, y: 90 },
  }),

  /**
   * Soco no peito: ele DOBRA SOBRE O GOLPE.
   *
   * A versao anterior jogava tronco e cabeca para TRAS, que e o que um golpe no
   * ROSTO faz, e por isso as duas reacoes saiam parecidas. Golpe no peito faz o
   * contrario: o quadril foge para tras, o peito afunda, e cabeca e ombros caem
   * para FRENTE, por cima do punho. E a leitura de "ficou sem ar", nao a de
   * "levou um tapa".
   */
  hitChest: p({
    hip: { x: -26, y: 16 },
    neck: { x: -6, y: -46 },
    head: { x: 12, y: -78 },
    // os bracos caem: nao ha ar para segurar a guarda
    elbowFront: { x: -12, y: -32 },
    handFront: { x: -28, y: -16 },
    elbowBack: { x: -40, y: -26 },
    handBack: { x: -62, y: -10 },
    kneeFront: { x: 20, y: 56 },
    footFront: { x: 40, y: 92 },
    kneeBack: { x: -34, y: 54 },
    footBack: { x: -66, y: 90 },
  }),

  /** Chute no tronco: o corpo GIRA e e deslocado de lado. */
  hitBody: p({
    hip: { x: -16, y: 10 },
    neck: { x: -44, y: -58 },
    head: { x: -84, y: -78 },
    elbowFront: { x: -34, y: -30 },
    handFront: { x: -66, y: -18 },
    elbowBack: { x: -56, y: -34 },
    handBack: { x: -88, y: -26 },
    kneeFront: { x: 24, y: 56 },
    footFront: { x: 30, y: 92 },
    kneeBack: { x: -44, y: 58 },
    footBack: { x: -78, y: 88 },
  }),

  /** Chute na perna: o joelho cede e o corpo perde o equilibrio. */
  hitLeg: p({
    hip: { x: -6, y: 40 },
    neck: { x: -16, y: -36 },
    head: { x: -30, y: -70 },
    elbowFront: { x: 18, y: -16 },
    handFront: { x: 34, y: 14 },
    elbowBack: { x: -30, y: -14 },
    handBack: { x: -54, y: 12 },
    // a perna atingida dobra para dentro
    kneeFront: { x: 10, y: 48 },
    footFront: { x: -14, y: 90 },
    kneeBack: { x: -40, y: 44 },
    footBack: { x: -70, y: 88 },
  }),

  knockback: p({
    neck: { x: -24, y: -70 },
    head: { x: -44, y: -104 },
    elbowFront: { x: -6, y: -50 },
    handFront: { x: -24, y: -74 },
    elbowBack: { x: -34, y: -42 },
    handBack: { x: -58, y: -52 },
    kneeFront: { x: 30, y: 52 },
    footFront: { x: 52, y: 90 },
    kneeBack: { x: -38, y: 56 },
    footBack: { x: -72, y: 88 },
  }),
  /**
   * Caido, derrotado.
   *
   * A primeira versao punha tudo colado no chao e o resultado era um vulto:
   * nao se lia cabeca, nem tronco, nem perna. Esta versao se le porque tem
   * TRES alturas diferentes:
   *   - a cabeca fica ERGUIDA do chao, apoiada no ombro
   *   - o tronco sai na diagonal, nao deitado
   *   - uma perna dobrada e a outra estendida, para a silhueta nao virar barra
   * A leitura vale mais que o realismo, que e o que o briefing pede.
   */
  downed: p({
    // Deitado de costas, cabeca a esquerda e pes a direita.
    //
    // A versao anterior ainda saia como vulto porque os membros SE CRUZAVAM.
    // Aqui cada membro aponta para uma direcao distinta, e nenhum passa por
    // cima do tronco:
    //   cabeca   -> acima e a esquerda (identifica o personagem na hora)
    //   braco 1  -> levantado, para cima
    //   braco 2  -> caido no chao, para a esquerda
    //   perna 1  -> dobrada, joelho para cima
    //   perna 2  -> estendida no chao, para a direita
    hip: { x: 0, y: 72 },
    neck: { x: -56, y: 44 },
    head: { x: -106, y: 26 },
    // braco levantado: e o que diz "acabou de cair", nao "esta deitado"
    elbowFront: { x: -34, y: 4 },
    handFront: { x: -6, y: -34 },
    // braco caido no chao
    elbowBack: { x: -76, y: 72 },
    handBack: { x: -120, y: 90 },
    // perna dobrada, joelho para cima
    kneeFront: { x: 50, y: 30 },
    footFront: { x: 36, y: 90 },
    // perna estendida no chao
    kneeBack: { x: 74, y: 80 },
    footBack: { x: 142, y: 91 },
  }),

  /**
   * Compressao do pouso: joelho e tronco cedem no contato com o chao.
   *
   * Entra entre "land" e "downed" para o corpo nao trocar de pose de um quadro
   * para o outro. E a diferenca entre "caiu" e "virou outra pose".
   */
  squash: p({
    hip: { x: 0, y: 56 },
    neck: { x: -6, y: -14 },
    head: { x: -14, y: -44 },
    elbowFront: { x: 30, y: 34 },
    handFront: { x: 48, y: 72 },
    elbowBack: { x: -28, y: 32 },
    handBack: { x: -46, y: 70 },
    kneeFront: { x: 48, y: 58 },
    footFront: { x: 40, y: 92 },
    kneeBack: { x: -44, y: 60 },
    footBack: { x: -38, y: 92 },
  }),
  /**
   * Cambaleio: ele FREIA o proprio deslizamento.
   *
   * E a fase que faltava na reacao. Sem ela o corpo empurrado voltava direto
   * para a guarda, o que le como "teleportou de volta ao normal". Aqui o pe de
   * tras esta plantado longe, o quadril baixo e os bracos abertos: o corpo
   * gastou energia para nao cair, e isso e o que conta a forca do golpe depois
   * que o golpe ja passou.
   */
  stagger: p({
    hip: { x: -14, y: 20 },
    neck: { x: -8, y: -56 },
    head: { x: -2, y: -96 },
    elbowFront: { x: 24, y: -46 },
    handFront: { x: 46, y: -72 },
    elbowBack: { x: -36, y: -40 },
    handBack: { x: -64, y: -60 },
    kneeFront: { x: 12, y: 54 },
    footFront: { x: 20, y: 92 },
    // o pe de tras plantado longe e o que FREIA: o resto do corpo se apoia nele
    kneeBack: { x: -54, y: 46 },
    footBack: { x: -96, y: 92 },
  }),

  getUp: p({
    hip: { x: 0, y: 44 },
    neck: { x: -12, y: -18 },
    head: { x: -20, y: -54 },
    elbowFront: { x: 10, y: 20 },
    handFront: { x: 24, y: 58 },
    kneeFront: { x: 38, y: 50 },
    footFront: { x: 56, y: 48 },
    kneeBack: { x: -20, y: 54 },
    footBack: { x: -40, y: 48 },
  }),
};
