/**
 * ARREMESSO CONTRA O PAREDÃO: o corpo atravessa o vale e bate na rocha.
 *
 * O roteiro pede "é lançado contra uma montanha", e a diferença entre isso e
 * um empurrão longo é ter ALGO NO FIM. Sem a parede o arremesso é distância
 * percorrida, e distância sozinha não tem consequência: o corpo desacelera e
 * para, e o que o espectador vê é que ele andou muito.
 *
 * Com a parede há um segundo impacto, e é ele que conta o tamanho do
 * primeiro. A rocha que racha é a testemunha.
 *
 * TRÊS TEMPOS, e o do meio é o que costuma ser cortado:
 *
 *   VOO      ele atravessa em linha, rápido o bastante para o rastro acender
 *            (ver LIMITE_SMEAR em scenes/FightScene) -- é nesse trecho que o
 *            corpo vira borrão.
 *   BATIDA   o corpo PARA de uma vez contra a pedra, a rocha racha e o pó
 *            sai dos dois lados. O corpo fica COLADO na parede por um
 *            instante: é a pausa que diz que a parede ganhou.
 *   QUEDA    só então ele escorrega e cai. Cair junto com a batida jogaria
 *            fora o instante em que a colisão acontece.
 *
 * O paredão vive num X fixo do mundo (PAREDAO_X em backgrounds/Vale), e não
 * na montanha do fundo: aquela tem paralaxe, então a posição dela na tela
 * depende da câmera e não existe um ponto do mundo em que um corpo bata nela.
 */

import { PAREDAO_X } from "../../backgrounds/Vale";
import type { FighterId } from "../types";
import type { ContextoDeTecnica } from "./contexto";

/**
 * A SUPERFICIE da rocha, em mundo. PAREDAO_X e a quina direita do paredao ao
 * nivel do chao (ver backgrounds/Vale): a massa fica toda a ESQUERDA disso.
 *
 * A primeira versao punha a face em PAREDAO_X - 60, ou seja SESSENTA UNIDADES
 * DENTRO DA PEDRA, e as marcas daqui posicionam o QUADRIL. Somando as duas
 * coisas, o corpo terminava enterrado ate os ombros na rocha.
 */
const FACE_X = PAREDAO_X;
/** altura do contato: onde as costas e a cabeca encontram a pedra */
const FACE_Y = -300;

/*
  AS MARCAS SAO MEDIDAS, e nao escolhidas no olho.

  Um corpo nao e um ponto: medido em characters/skeleton, `knockback` com o
  rosto para a parede estende 263 unidades do quadril ate a ponta mais
  proxima da rocha, e `downed` estende 272. O quadril tem que ficar ao menos
  isso longe da superficie para o corpo ENCOSTAR nela em vez de entrar.

  Nao e uma folga: com estes valores a ponta do corpo cai exatamente na
  pedra. Afastar menos enterra, afastar mais deixa ele parando no ar.
*/
const NO_CORPO_DA_FACE = 275; // knockback: extremo a 263
const DEITADO_NA_FACE = 175; // deitado, o corpo vira e a ponta fica a ~150

export const arremessoNoParedao = (
  ctx: ContextoDeTecnica,
  quem: FighterId,
): number => {
  const { c, s, pose, poder, cameraKeys, impacts, ALTURA_QUADRIL } = ctx;
  const outro = quem === ctx.G ? ctx.F : ctx.G;

  /*
    A CENA POSICIONA OS DOIS ANTES DE COMECAR.

    Medido: a cena anterior deixava o arremessado em x = -1506 e a face da
    rocha esta em -1510. O voo tinha QUATRO unidades -- nao havia arremesso
    nenhum, so um corpo ja encostado na pedra.

    Uma cena que depende de distancia nao pode herdar a distancia que sobrou
    da anterior. Aqui ela poe os dois na marca, com mil e quatrocentas
    unidades entre o corpo e a rocha, e so entao arremessa.
  */
  const PARTIDA = FACE_X + 1400;
  /*
    A MARCA E ALCANCADA COM FOLGA DE TEMPO, e isso nao e margem: e a segunda
    vez nesta sessao que uma chave escrita cedo demais foi ignorada.

    A cena anterior continua escrevendo chaves do corpo depois do quadro em
    que esta comeca. A amostragem percorre as chaves EM SEQUENCIA, entao uma
    chave escrita antes da ultima que ja existe simplesmente nao e vista --
    e o TypeScript nao tem como avisar. Medido: com a marca em c + 0.45s o
    corpo nem saia do lugar, ficava em -1506 e o "voo" comecava dali.
  */
  pose(quem, "retreat", c + s(1.15), PARTIDA);
  pose(outro, "advance", c + s(1.15), PARTIDA + 260);
  pose(quem, "stagger", c + s(1.35));

  /*
    AS POSICOES SAO EXPLICITAS, e nao derivadas de um "rumo".

    A primeira versao calculava a direcao a partir de onde o corpo estava e
    somava deslocamentos relativos. Com a cena anterior deixando o corpo ja
    colado na rocha, o sinal invertia e o voo atravessava a pedra em vez de
    parar nela -- medido, o corpo ia de -1506 a -2236, quatrocentas unidades
    ALEM da parede.

    O paredao mora num X fixo. A cena inteira pode falar em X fixo tambem: e
    uma linha reta, da marca de partida ate a face da rocha, e nao ha nada a
    derivar.
  */
  const NO_CORPO = FACE_X + NO_CORPO_DA_FACE;
  const CAIDO = FACE_X + DEITADO_NA_FACE;

  // ---- 1. O VOO -----------------------------------------------------------
  pose(quem, "launched", c + s(1.5));
  pose(quem, "launched", c + s(1.95), NO_CORPO);
  /*
    A CAMERA ACOMPANHA sem alcancar. Seguindo exatamente, o corpo fica parado
    no centro do quadro e o voo some -- e o cenario passando atras que conta a
    distancia. Aqui ela fica um pouco para tras e so encontra a parede no fim.
  */
  cameraKeys.push({
    frame: c + s(1.45),
    center: { x: (PARTIDA + FACE_X) / 2, y: ALTURA_QUADRIL - 180 },
    zoom: 0.5,
    ease: s(0.42),
    cena: true,
  });

  // ---- 2. A BATIDA --------------------------------------------------------
  const bate = c + s(2.0);
  /*
    DE COSTAS NA PEDRA, e nao deitado no chao.

    Isto usava `groundHit`, que e a pose de quem caiu: cabeca no chao, corpo
    espalhado na horizontal. Contra uma parede ela nao descreve nada -- o
    corpo aparecia jogado no chao ao lado da rocha no mesmo quadro em que
    deveria estar se esmagando contra ela.

    `knockback` deixa o corpo EM PE e recuado, com a cabeca no alto e as
    costas na direcao da pedra. E a queda vem depois, no seu tempo.
  */
  pose(quem, "knockback", bate, NO_CORPO);
  impacts.push({
    frame: bate,
    at: { x: FACE_X + 20, y: FACE_Y },
    tier: "extreme",
    direction: -1,
    hitStop: 13,
    cracksGround: true,
    /*
      SEM O CLARAO. Esta colisao existe para mostrar a ROCHA, e o flash de
      tela cheia dos golpes extremos cobria o paredao inteiro justamente no
      quadro do contato: sobrava um clarao branco do qual o corpo saia caido,
      sem nada que explicasse por que. A forca do golpe continua a mesma.
    */
    semFlash: true,
    sound: "impact",
  });
  poder({ tipo: "explosaoFogo", a: { x: FACE_X + 20, y: FACE_Y }, from: bate, to: bate + s(0.5), forca: 220, paleta: "sombra" });
  poder({ tipo: "pedrasFlutuantes", a: { x: FACE_X + 40, y: 0 }, from: bate, to: bate + s(1.1), forca: 380, paleta: "sombra" });
  poder({ tipo: "rachadura", a: { x: FACE_X + 70, y: 0 }, from: bate, to: bate + s(1.6), forca: 520 });
  /*
    O QUADRO PRECISA CABER A PEDRA. Fechado no corpo, o que se ve e alguem
    parando no ar: a rocha fica fora de quadro e a colisao perde o outro
    lado. A camera abre e desloca o centro PARA A DIREITA da face, de modo
    que a massa ocupe a metade esquerda do quadro.

    Medido: com o centro em FACE_X + 420 a pedra ficava com 216 dos 1080
    pixels, espremida na borda. Trazendo o centro para FACE_X + 180 ela passa
    de um quinto para mais de um terco do quadro -- deixa de ser cenario ao
    fundo e vira a coisa em que se bateu.
  */
  cameraKeys.push({
    frame: bate,
    center: { x: FACE_X + 180, y: FACE_Y + 60 },
    zoom: 0.72,
    ease: 0,
    shake: 34,
    cena: true,
  });

  /*
    COLADO NA PAREDE. Um punhado de quadros em que ele nao desce: e o que
    separa "bateu na rocha" de "passou perto dela".
  */
  pose(quem, "knockback", bate + s(0.24), NO_CORPO);

  // ---- 3. A QUEDA ---------------------------------------------------------
  const cai = bate + s(0.32);
  pose(quem, "downed", cai + s(0.4), CAIDO);
  cameraKeys.push({
    frame: cai,
    center: { x: FACE_X + 300, y: ALTURA_QUADRIL - 60 },
    zoom: 0.8,
    ease: s(0.5),
    shake: 10,
    cena: true,
  });

  /*
    O DEPOIS TEM QUE CABER. Com 0,9s a tecnica devolvia o cursor e a cena
    seguinte cortava para um close do outro lutador antes de o corpo caido
    aparecer ao pe da pedra -- a consequencia inteira do arremesso ficava
    fora do video.
  */
  const fim = cai + s(1.5);
  pose(quem, "sitUp", fim - s(0.2));
  return fim;
};
