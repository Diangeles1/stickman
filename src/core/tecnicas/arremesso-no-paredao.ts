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

/** onde a face da rocha encontra o corpo, em mundo */
const FACE_X = PAREDAO_X - 60;
/** altura do ponto de impacto na parede */
const FACE_Y = -430;

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
  const NO_CORPO = FACE_X + 95; // o corpo encosta na face, nao entra nela
  const CAIDO = FACE_X + 165;

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
  pose(quem, "groundHit", bate, NO_CORPO);
  impacts.push({
    frame: bate,
    at: { x: FACE_X + 40, y: FACE_Y },
    tier: "extreme",
    direction: -1,
    hitStop: 13,
    cracksGround: true,
    sound: "impact",
  });
  poder({ tipo: "explosaoFogo", a: { x: FACE_X + 40, y: FACE_Y }, from: bate, to: bate + s(0.5), forca: 220, paleta: "sombra" });
  poder({ tipo: "pedrasFlutuantes", a: { x: FACE_X + 120, y: 0 }, from: bate, to: bate + s(1.1), forca: 380, paleta: "sombra" });
  poder({ tipo: "rachadura", a: { x: FACE_X + 160, y: 0 }, from: bate, to: bate + s(1.6), forca: 520 });
  cameraKeys.push({
    frame: bate,
    center: { x: FACE_X + 200, y: FACE_Y + 150 },
    zoom: 1.0,
    ease: 0,
    shake: 34,
    cena: true,
  });

  /*
    COLADO NA PAREDE. Um punhado de quadros em que ele nao desce: e o que
    separa "bateu na rocha" de "passou perto dela".
  */
  pose(quem, "groundHit", bate + s(0.24), NO_CORPO);

  // ---- 3. A QUEDA ---------------------------------------------------------
  const cai = bate + s(0.32);
  pose(quem, "downed", cai + s(0.4), CAIDO);
  cameraKeys.push({
    frame: cai,
    center: { x: FACE_X + 260, y: ALTURA_QUADRIL - 60 },
    zoom: 0.8,
    ease: s(0.5),
    shake: 10,
    cena: true,
  });

  const fim = cai + s(0.9);
  pose(quem, "sitUp", fim - s(0.2));
  return fim;
};
