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
import { anatomizar } from "./skeleton";

const p = (pose: Pose): Pose => pose;

const ESCRITAS: Record<PoseName, Pose> = {
  idle: p({}),

  /**
   * GUARDA DE LUTA.
   *
   * A anterior era um corpo em pe com os bracos dobrados: pernas quase retas,
   * base estreita, tronco vertical. Nas lutas de stickman profissionais a
   * guarda e uma BASE: pes afastados, joelhos dobrados, peso levemente a
   * frente e o punho da frente na altura do queixo. E a pose em que o
   * personagem passa mais tempo, entao e a que mais diz se ele e um lutador.
   */
  guard: p({
    neck: { x: 9, y: -72 },
    head: { x: 14, y: -111 },
    // punho de tras colado ao queixo, cotovelo fechando a costela
    elbowBack: { x: 2, y: -40 },
    handBack: { x: 18, y: -64 },
    // punho da frente adiantado, na altura do queixo
    elbowFront: { x: 30, y: -44 },
    handFront: { x: 46, y: -70 },
    // base larga e joelhos dobrados: o peso fica pronto para sair. Os DOIS
    // joelhos apontam para frente, como num corpo de verdade; o de tras
    // apontava para tras e, com a ginga, a base virava um arco de pernas
    // abertas para fora
    kneeBack: { x: -16, y: 48 },
    footBack: { x: -52, y: 92 },
    kneeFront: { x: 32, y: 44 },
    footFront: { x: 46, y: 92 },
  }),

  /**
   * DANCA: ponto de partida da danca da vitoria. A danca em si e calculada
   * quadro a quadro em animation/danca.ts; esta pose e so a base (a guarda
   * relaxada) de onde ela sai.
   */
  danca: p({
    neck: { x: 6, y: -73 },
    head: { x: 10, y: -112 },
    elbowBack: { x: -6, y: -40 },
    handBack: { x: 12, y: -56 },
    elbowFront: { x: 24, y: -42 },
    handFront: { x: 40, y: -60 },
    kneeBack: { x: -16, y: 48 },
    footBack: { x: -44, y: 92 },
    kneeFront: { x: 28, y: 46 },
    footFront: { x: 40, y: 92 },
  }),

  /**
   * DE FRENTE PARA A TELA, base da cena da placa (ver animation/placa.ts):
   * tudo simetrico em volta do quadril.
   */
  placa: p({
    neck: { x: 0, y: -74 },
    head: { x: 0, y: -114 },
    elbowFront: { x: 24, y: -44 },
    handFront: { x: 30, y: -18 },
    elbowBack: { x: -24, y: -44 },
    handBack: { x: -30, y: -18 },
    kneeFront: { x: 22, y: 46 },
    footFront: { x: 36, y: 92 },
    kneeBack: { x: -22, y: 46 },
    footBack: { x: -36, y: 92 },
  }),

  // --- KATANA ---------------------------------------------------------------
  // A lamina sai da mao da frente na direcao do ANTEBRACO (cotovelo -> mao).
  // Entao cada pose de katana e, antes de tudo, a direcao do antebraco: e ela
  // que diz para onde a espada aponta. As duas maos ficam no cabo.

  /** guarda de katana: lamina para cima e para frente, como no kendo */
  guardaKatana: p({
    neck: { x: 8, y: -72 },
    head: { x: 13, y: -111 },
    elbowFront: { x: 24, y: -36 },
    handFront: { x: 40, y: -54 },
    elbowBack: { x: 6, y: -38 },
    handBack: { x: 32, y: -48 },
    kneeBack: { x: -18, y: 48 },
    footBack: { x: -56, y: 92 },
    kneeFront: { x: 34, y: 44 },
    footFront: { x: 50, y: 92 },
  }),
  /** defesa: lamina quase em pe na frente do rosto, base firme */
  bloqueioKatana: p({
    neck: { x: 2, y: -72 },
    head: { x: 5, y: -111 },
    elbowFront: { x: 26, y: -46 },
    handFront: { x: 36, y: -70 },
    elbowBack: { x: 6, y: -44 },
    handBack: { x: 28, y: -62 },
    kneeBack: { x: -22, y: 46 },
    footBack: { x: -62, y: 92 },
    kneeFront: { x: 36, y: 44 },
    footFront: { x: 54, y: 92 },
  }),
  /** carga alta: lamina por cima do ombro, apontando para tras */
  cargaKatana: p({
    neck: { x: -6, y: -72 },
    head: { x: -10, y: -110 },
    elbowFront: { x: 22, y: -96 },
    handFront: { x: 2, y: -108 },
    elbowBack: { x: 4, y: -92 },
    handBack: { x: -4, y: -104 },
    kneeBack: { x: -22, y: 50 },
    footBack: { x: -56, y: 92 },
    kneeFront: { x: 30, y: 40 },
    footFront: { x: 50, y: 92 },
  }),
  /** carga baixa: lamina baixa e para tras, pronta para subir */
  cargaBaixa: p({
    neck: { x: 12, y: -70 },
    head: { x: 18, y: -108 },
    elbowFront: { x: -4, y: -32 },
    handFront: { x: -22, y: 2 },
    elbowBack: { x: -8, y: -30 },
    handBack: { x: -18, y: -4 },
    kneeBack: { x: -24, y: 52 },
    footBack: { x: -60, y: 92 },
    kneeFront: { x: 36, y: 38 },
    footFront: { x: 54, y: 92 },
  }),
  /** corte que sobe (baixo-esquerda para alto-direita): lamina subindo */
  corteSobe: p({
    // o TRONCO desenrola junto: o corte que sobe nasce no quadril e abre o
    // peito. Com o tronco parado (ele quase nao mudava da carga para ca), o
    // corte saia so do braco e a auditoria de cadeia acusava "corpo se
    // movendo como bloco".
    neck: { x: -6, y: -74 },
    head: { x: -2, y: -112 },
    // o arco termina A FRENTE, nao acima. A ponta da lamina fica 290 unidades
    // alem da mao, entao uma inclinacao pequena aqui vira muita altura la: com
    // a mao 6 unidades mais alta, a ponta passava 60 acima do queixo e o corte
    // "ascendente" nao encostava em ninguem.
    elbowFront: { x: 40, y: -72 },
    handFront: { x: 72, y: -72 },
    elbowBack: { x: 22, y: -50 },
    handBack: { x: 44, y: -70 },
    kneeBack: { x: -30, y: 56 },
    footBack: { x: -68, y: 92 },
    kneeFront: { x: 44, y: 40 },
    footFront: { x: 70, y: 92 },
  }),
  /** corte que desce (alto para diagonal baixa): lamina descendo */
  corteDesce: p({
    neck: { x: 20, y: -66 },
    head: { x: 30, y: -102 },
    elbowFront: { x: 44, y: -50 },
    handFront: { x: 64, y: -30 },
    elbowBack: { x: 28, y: -40 },
    handBack: { x: 50, y: -26 },
    kneeBack: { x: -30, y: 56 },
    footBack: { x: -68, y: 92 },
    kneeFront: { x: 46, y: 40 },
    footFront: { x: 72, y: 92 },
  }),
  /** corte horizontal: lamina reta para frente, braco esticado */
  corteLateral: p({
    neck: { x: 16, y: -70 },
    head: { x: 24, y: -108 },
    elbowFront: { x: 42, y: -58 },
    handFront: { x: 66, y: -58 },
    elbowBack: { x: -8, y: -50 },
    handBack: { x: -28, y: -40 },
    kneeBack: { x: -30, y: 56 },
    footBack: { x: -68, y: 92 },
    kneeFront: { x: 44, y: 40 },
    footFront: { x: 70, y: 92 },
  }),

  // --- PODERES ---------------------------------------------------------------

  /** ajoelhado com a mao espalmada no chao: o gelo sai dali */
  maoNoChao: p({
    neck: { x: 40, y: -58 },
    head: { x: 62, y: -88 },
    elbowFront: { x: 52, y: -20 },
    handFront: { x: 70, y: 8 },
    elbowBack: { x: 10, y: -40 },
    handBack: { x: -10, y: -26 },
    kneeFront: { x: 36, y: 20 },
    footFront: { x: 40, y: 60 },
    kneeBack: { x: -10, y: 44 },
    footBack: { x: -56, y: 50 },
  }),
  /** lanca com uma mao: braco da frente esticado, o outro puxado para tras */
  lancar: p({
    neck: { x: 12, y: -72 },
    head: { x: 18, y: -110 },
    elbowFront: { x: 40, y: -62 },
    handFront: { x: 66, y: -68 },
    elbowBack: { x: -20, y: -50 },
    handBack: { x: -36, y: -32 },
    kneeBack: { x: -26, y: 52 },
    footBack: { x: -64, y: 92 },
    kneeFront: { x: 40, y: 42 },
    footFront: { x: 62, y: 92 },
  }),
  /** as duas maos para frente, corpo segurando o coice do feixe */
  bracosFrente: p({
    neck: { x: -4, y: -72 },
    head: { x: 0, y: -111 },
    elbowFront: { x: 36, y: -62 },
    handFront: { x: 62, y: -64 },
    elbowBack: { x: 30, y: -58 },
    handBack: { x: 56, y: -60 },
    kneeBack: { x: -30, y: 50 },
    footBack: { x: -74, y: 92 },
    kneeFront: { x: 40, y: 44 },
    footFront: { x: 60, y: 92 },
  }),
  /** katana erguida na vertical sobre a cabeca */
  katanaErguida: p({
    neck: { x: 0, y: -74 },
    head: { x: 2, y: -113 },
    elbowFront: { x: 26, y: -100 },
    handFront: { x: 16, y: -126 },
    elbowBack: { x: -10, y: -100 },
    handBack: { x: 10, y: -120 },
    kneeBack: { x: -22, y: 46 },
    footBack: { x: -48, y: 92 },
    kneeFront: { x: 24, y: 46 },
    footFront: { x: 46, y: 92 },
  }),
  /** patinando: agachado, inclinado para frente, lamina baixa para tras */
  deslizar: p({
    neck: { x: 34, y: -60 },
    head: { x: 50, y: -94 },
    elbowFront: { x: 6, y: -34 },
    handFront: { x: -18, y: -14 },
    elbowBack: { x: 30, y: -44 },
    handBack: { x: 50, y: -30 },
    kneeFront: { x: 42, y: 32 },
    footFront: { x: 54, y: 80 },
    kneeBack: { x: -40, y: 50 },
    footBack: { x: -92, y: 70 },
  }),
  /** ajoelhado, exausto, apoiado na katana fincada no chao */
  ajoelhado: p({
    neck: { x: 10, y: -68 },
    head: { x: 22, y: -100 },
    elbowFront: { x: 30, y: -36 },
    handFront: { x: 44, y: -12 },
    elbowBack: { x: 4, y: -36 },
    handBack: { x: 26, y: -24 },
    kneeFront: { x: 36, y: 20 },
    footFront: { x: 40, y: 60 },
    kneeBack: { x: -10, y: 44 },
    footBack: { x: -56, y: 50 },
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
  /**
   * ABAIXAR: agachamento de lutador, pes plantados, tronco para frente e
   * guarda alta.
   *
   * A versao anterior tinha as pernas abertas para fora (joelho de tras
   * invertido em 69 graus); corrigido para a dobra anatomica, o joelho ia ao
   * chao e o lutador parecia AJOELHAR em vez de passar por baixo do golpe.
   */
  duck: p({
    hip: { x: -10, y: 30 },
    neck: { x: 20, y: -30 },
    head: { x: 44, y: -58 },
    elbowFront: { x: 36, y: -4 },
    handFront: { x: 52, y: -34 },
    elbowBack: { x: 14, y: -2 },
    handBack: { x: 34, y: -32 },
    kneeFront: { x: 38, y: 40 },
    footFront: { x: 48, y: 92 },
    kneeBack: { x: 14, y: 58 },
    footBack: { x: -30, y: 92 },
  }),
  /**
   * PASSO DE LUTA para frente e para tras: a guarda andando.
   *
   * As versoes anteriores eram um corpo em pe com as pernas quase retas, e
   * cada passo de ajuste "levantava" o lutador 38 unidades acima da guarda
   * (medido no quadril). Quem da passo em luta continua na base: joelhos
   * dobrados, guarda alta, e so o peso vai para o lado do passo.
   */
  advance: p({
    neck: { x: 14, y: -71 },
    head: { x: 20, y: -110 },
    elbowBack: { x: 4, y: -40 },
    handBack: { x: 20, y: -64 },
    elbowFront: { x: 32, y: -44 },
    handFront: { x: 50, y: -68 },
    kneeBack: { x: -12, y: 48 },
    footBack: { x: -44, y: 92 },
    kneeFront: { x: 36, y: 44 },
    footFront: { x: 52, y: 92 },
  }),
  retreat: p({
    neck: { x: 2, y: -72 },
    head: { x: 4, y: -111 },
    elbowBack: { x: -2, y: -40 },
    handBack: { x: 14, y: -64 },
    elbowFront: { x: 24, y: -44 },
    handFront: { x: 40, y: -68 },
    kneeBack: { x: -20, y: 46 },
    footBack: { x: -58, y: 92 },
    kneeFront: { x: 28, y: 46 },
    footFront: { x: 40, y: 92 },
  }),
  /**
   * DEFESA ALTA: antebracos na vertical na frente do rosto, cotovelos
   * fechando o tronco, queixo recolhido.
   *
   * A versao anterior esticava os dois bracos para cima da cabeca: no video
   * o lutador parecia estar se rendendo, nao defendendo.
   */
  block: p({
    neck: { x: -4, y: -72 },
    head: { x: -4, y: -110 },
    elbowFront: { x: 34, y: -48 },
    handFront: { x: 38, y: -88 },
    elbowBack: { x: 22, y: -44 },
    handBack: { x: 26, y: -84 },
    kneeFront: { x: 28, y: 46 },
    footFront: { x: 40, y: 92 },
    kneeBack: { x: -18, y: 48 },
    footBack: { x: -56, y: 92 },
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
    // O CORPO DESCE para carregar: joelhos dobram, peso na perna de tras.
    // A versao anterior deixava o quadril 20 unidades MAIS ALTO que na
    // guarda (pernas quase retas), ou seja o lutador se esticava para
    // carregar, o contrario de juntar energia.
    hip: { x: -14, y: 16 },
    // o TRONCO gira para tras: e o tronco que carrega o golpe, nao o braco
    neck: { x: -30, y: -58 },
    head: { x: -40, y: -94 },
    // o punho volta para junto do ombro
    elbowFront: { x: -18, y: -42 },
    handFront: { x: -42, y: -50 },
    elbowBack: { x: -34, y: -34 },
    handBack: { x: -14, y: -48 },
    // peso e joelho na perna de tras: energia guardada
    kneeBack: { x: -26, y: 54 },
    footBack: { x: -60, y: 92 },
    kneeFront: { x: 24, y: 48 },
    footFront: { x: 38, y: 92 },
  }),

  // --- socos ---------------------------------------------------------------
  punch: p({
    // O CORPO INTEIRO ENTRA NO GOLPE.
    //
    // A versao anterior tinha o tronco quase reto (pescoco em x=10) e todo o
    // alcance vinha do braco. Duas consequencias medidas: o soco nao tinha
    // corpo atras dele, e a distancia de combate derivada ficava em 260
    // unidades, perto o bastante para as bases das pernas dos dois se
    // sobreporem na tela.
    //
    // Agora a cadeia e a que a diretiva pede: pe de tras estica, quadril gira,
    // tronco gira, ombro vai junto (derivado do tronco), braco estende. Isso
    // leva o punho mais longe do quadril e afasta os dois corpos.
    hip: { x: 10, y: 2 },
    neck: { x: 34, y: -66 },
    head: { x: 44, y: -102 },
    elbowFront: { x: 60, y: -78 },
    handFront: { x: 106, y: -86 },
    // o braco de tras vem para tras como contrapeso
    elbowBack: { x: 6, y: -44 },
    handBack: { x: -16, y: -54 },
    kneeFront: { x: 46, y: 46 },
    footFront: { x: 74, y: 92 },
    // a perna de tras ESTICA: e ela que empurra o corpo para dentro do soco
    kneeBack: { x: -34, y: 54 },
    footBack: { x: -80, y: 92 },
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
  /**
   * UPPERCUT: o punho sobe na frente do rosto com o cotovelo a 90 graus.
   *
   * A pose anterior pedia o punho 64 unidades acima do ombro, com um braco
   * que mede 57. Travado no comprimento real, o braco saia HORIZONTAL com o
   * antebraco curto para cima, e no video o uppercut era um jab alto. Aqui
   * as medidas cabem no braco: braco para frente, antebraco na vertical, e
   * as pernas se esticando, porque a forca do uppercut vem de baixo.
   */
  uppercut: p({
    // o tronco SOBE e abre um pouco para tras: e o corpo inteiro que sobe
    neck: { x: 4, y: -77 },
    head: { x: 4, y: -117 },
    // braco a 45 graus para cima, antebraco na vertical: punho na altura da
    // cabeca, na frente dela (medidas dentro do comprimento do braco)
    elbowFront: { x: 38, y: -92 },
    handFront: { x: 40, y: -118 },
    elbowBack: { x: 0, y: -42 },
    handBack: { x: 16, y: -64 },
    kneeFront: { x: 26, y: 42 },
    footFront: { x: 40, y: 92 },
    kneeBack: { x: -20, y: 46 },
    footBack: { x: -46, y: 92 },
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
  /**
   * INVESTIDA DE OMBRO.
   *
   * A pose anterior tinha o tronco RETO (pescoco em x=0), e a junta de contato
   * deste golpe e o ombro. Duas consequencias medidas pela auditoria de mira:
   *
   *   - o ombro nao se projetava para frente, entao a distancia derivada dava
   *     80 unidades e caia no piso de 120. O piso somava 40 unidades de erro
   *     horizontal, que nenhum IK corrige, porque o ombro e RAIZ de cadeia e
   *     nao ponta: nao ha membro para esticar.
   *   - o ombro ficava 124 unidades ACIMA do tronco do adversario.
   *
   * Agora e uma investida BAIXA: o tronco mergulha para frente e para baixo, o
   * quadril recua como contrapeso e as pernas empurram. O ombro vai a frente e
   * na altura do tronco do outro, que e onde uma investida acerta.
   */
  charge: p({
    hip: { x: -16, y: 14 },
    neck: { x: 24, y: -56 },
    head: { x: 40, y: -84 },
    // bracos recolhidos junto ao corpo, como quem protege a entrada
    elbowBack: { x: -14, y: -30 },
    handBack: { x: 6, y: -14 },
    elbowFront: { x: 16, y: -28 },
    handFront: { x: 38, y: -20 },
    // as duas pernas empurram para tras: e delas que vem a investida
    kneeBack: { x: -44, y: 46 },
    footBack: { x: -84, y: 92 },
    kneeFront: { x: 16, y: 52 },
    footFront: { x: 34, y: 92 },
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
   * LANCADO: o corpo voa para tras dobrado em "C".
   *
   * A forca entrou pelo tronco, entao e o tronco que vai primeiro; cabeca,
   * bracos e pernas ficam para tras (para o lado de quem bateu), atrasados
   * pela inercia. A pose anterior do voo era um corpo em pe com um braco e
   * uma perna esticados, e no video lia como um "T" flutuando, nao como um
   * corpo arremessado.
   */
  launched: p({
    neck: { x: 16, y: -70 },
    head: { x: 42, y: -100 },
    elbowFront: { x: 44, y: -46 },
    handFront: { x: 74, y: -62 },
    elbowBack: { x: 34, y: -36 },
    handBack: { x: 62, y: -24 },
    kneeFront: { x: 40, y: 36 },
    footFront: { x: 64, y: 82 },
    kneeBack: { x: 26, y: 44 },
    footBack: { x: 40, y: 90 },
  }),

  /**
   * AS COSTAS BATEM NO CHAO: quadril e costas encostam, pernas ainda no ar.
   *
   * E o quadro que vende a queda. Sem ele o corpo trocava de "voando" para
   * "deitado", e o peso do corpo chegando ao chao nunca aparecia.
   */
  groundHit: p({
    hip: { x: 0, y: 72 },
    neck: { x: -58, y: 50 },
    head: { x: -100, y: 34 },
    elbowFront: { x: -30, y: 18 },
    handFront: { x: -8, y: -16 },
    elbowBack: { x: -74, y: 72 },
    handBack: { x: -110, y: 84 },
    kneeFront: { x: 30, y: 20 },
    footFront: { x: 62, y: -22 },
    kneeBack: { x: 42, y: 40 },
    footBack: { x: 88, y: 8 },
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

  /**
   * SENTANDO: primeiro tempo do levantar. O tronco sobe apoiado na mao de
   * tras, a perna da frente dobra para buscar o chao.
   *
   * Sem este tempo, a mistura ia direto de "deitado" para "ajoelhado", e no
   * meio o corpo girava inteiro com as pernas para cima: medido no video, um
   * quadro de pernas esticadas no ar e o corpo de cabeca para baixo.
   */
  sitUp: p({
    hip: { x: 0, y: 72 },
    neck: { x: -24, y: 4 },
    head: { x: -28, y: -34 },
    elbowBack: { x: -50, y: 40 },
    handBack: { x: -66, y: 86 },
    elbowFront: { x: 8, y: 38 },
    handFront: { x: 34, y: 30 },
    kneeFront: { x: 40, y: 34 },
    footFront: { x: 70, y: 88 },
    kneeBack: { x: 48, y: 80 },
    footBack: { x: 98, y: 90 },
  }),

  /**
   * AJOELHADO: segundo tempo do levantar. Joelho de tras no chao, pe da
   * frente plantado, mao no joelho para empurrar o corpo para cima.
   */
  getUp: p({
    hip: { x: 0, y: 30 },
    neck: { x: 6, y: -42 },
    head: { x: 10, y: -80 },
    elbowFront: { x: 24, y: -6 },
    handFront: { x: 36, y: 18 },
    elbowBack: { x: -10, y: -8 },
    handBack: { x: 2, y: -32 },
    kneeFront: { x: 32, y: 40 },
    footFront: { x: 40, y: 92 },
    kneeBack: { x: -6, y: 86 },
    footBack: { x: -54, y: 92 },
  }),
};

/**
 * A biblioteca que o motor usa: as poses escritas acima, completas e com
 * joelho e cotovelo dobrando para o lado anatomico (ver anatomizar). Escrever
 * a pose continua sendo so o que muda; a garantia de corpo possivel vem daqui.
 */
export const POSES = Object.fromEntries(
  (Object.entries(ESCRITAS) as [PoseName, Pose][]).map(([nome, pose]) => [
    nome,
    anatomizar(pose),
  ]),
) as Record<PoseName, Required<Pose>>;
