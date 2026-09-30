/**
 * DUELO DO VALE: verde contra roxo, com placar e vencedor.
 *
 * A luta dos ninjas termina em aberto de proposito e por isso nao tem placar:
 * barra de vida que nunca chega a zero e enfeite, e ainda promete um desfecho
 * que o video nao entrega. Esta e o contrario -- ela existe para ter um
 * vencedor, e dai `cinematico` ficar de fora (ver effects/EspetaculoNaTela,
 * que so desenha as barras quando o espetaculo nao e cinematico).
 *
 * A TROCA E MEDIDA, nao intencionada. A conta esta em scripts/coreografia.mts,
 * e a licao que ela deu na luta anterior vale aqui: ataques marcados como
 * `blocked` ou `dodged` NAO CONTAM, e uma sequencia em que um dos dois so
 * defende conta uma surra mesmo que cada beat pareca razoavel sozinho. Aqui o
 * placar acompanha a troca: o verde abre vantagem, o roxo empata no meio, e a
 * decisao vem no fim.
 *
 * O QUE ELA USA DO QUE FOI CONSTRUIDO:
 *
 *   cercoEmProfundidade   o unico uso do eixo z ate agora: um recua para o
 *                         fundo do vale e volta em diagonal
 *   perseguicaoNoAr       o golpe lanca e o outro SOBE ATRAS, com a troca
 *                         acontecendo no alto
 *   arremessoNoParedao    o corpo bate na rocha e ela racha
 *
 * As tres sao cenas escritas a mao, e as tres devolvem os dois na distancia
 * de combate -- que e obrigacao de qualquer cena, e nao detalhe: terminando
 * longe, o golpe da cena seguinte atravessa o vao com o adversario fora da
 * tela.
 */

import type { FightSpec } from "../../core/types";
import { trocarVencedor } from "../trocar";

/*
  A LUTA E UMA FABRICA, e nao uma constante.

  O canal publica a MESMA coreografia com nomes e vencedor diferentes: e o
  que faz a tela de escolha valer, porque quem apostou num nome precisa
  poder errar. Escrever duas lutas para isso seria manter duas coreografias
  em sincronia na mao; aqui e a mesma, com dois parametros.
*/
const duelo = (nomeA: string, nomeB: string): FightSpec => ({
  fighterA: "green",
  /*
    O ADVERSARIO E O LARANJA, e nao o preset chamado "purple".
    Aquele id engana: o corpo dele e PALIDO (#e8cbc0), pensado para receber
    marcas pretas. Renderizado, saiu um boneco creme com a barra escrita
    "ROXO" -- nome e cor discordando na tela. O dourado (#d8a63a) contrasta
    com o verde e com o vale noturno sem precisar de contorno extra.
  */
  fighterB: "gold",
  seed: 4127,
  fps: 60,
  width: 1080,
  height: 1920,
  intensity: 9,
  scenario: "vale",
  // o mesmo preset da luta dos ninjas: pose segurada em 2, janela de golpe
  // alargada e preparacao com tempo (ver animation/estilo.ts)
  estilo: "animeDesenhado",
  nomes: { green: nomeA, gold: nomeB },
  poderes: { green: "MARE", gold: "TEMPESTADE" },
  /*
    A COR DO EFEITO SEGUE A COR DO CORPO. Sem isto a ciano lancava uma esfera
    AZUL e o laranja uma VERMELHA, porque as cenas fixavam a paleta no proprio
    nome.  e a paleta ciano do motor e  a laranja: as duas ja
    existiam, so ninguem podia pedi-las.
  */
  paletas: { green: "gelo", gold: "fogo" },
  // SEM `cinematico`: e ele que apaga o placar, e esta luta existe para ter um
  beats: [
    // ---- ABERTURA: somem e colidem ---------------------------------------
    { type: "tecnica", tecnica: "sumirEColidir", gelo: "green", fogo: "gold" },

    // ---- PRIMEIRA TROCA: o verde abre vantagem ---------------------------
    { type: "attack", attacker: "green", target: "gold", move: "punchFast" },
    /*
      SAIRAM UM BLOQUEIO E UMA ESQUIVA para caber em Shorts.

      Foram escolhidos por NAO CONECTAREM: o placar continua 6 a 8, que e o
      de uma luta decidida no fim. Cortar golpe que acerta teria mexido no
      equilibrio, e uma luta que vira surra perde a graca do finalizador
      (foi o que scripts/coreografia.mts acusou quando eu montei esta luta).
    */
    /*
      A COTOVELADA VAI NO TRONCO, e nao na cabeca (que e o alvo padrao). O
      cotovelo tem alcance curto, e com os membros afinados a distancia de
      combate encurtou junto: mirando a cabeca ele parava a 83 unidades do
      eixo quando precisava de 62, e scripts/contato.mts reprovava com razao.
      Cotovelada e golpe de corpo mesmo.
    */
    { type: "attack", attacker: "green", target: "gold", move: "elbow", targetPoint: "chest" },

    { type: "combo", attacker: "green", target: "gold", moves: ["punchFast", "punch", "knee"] },

    // ---- O LARANJA USA O MAPA -----------------------------------------------
    /*
      Ele nao revida na linha: recua para o fundo do vale e volta cortando o
      palco em diagonal. E a virada da luta, e e por isso que ela esta aqui --
      profundidade usada como TATICA, nao como enfeite.
    */
    { type: "tecnica", tecnica: "cercoEmProfundidade", gelo: "gold", fogo: "green" },

    // ---- SEGUNDA TROCA: o roxo empata ------------------------------------
    { type: "attack", attacker: "gold", target: "green", move: "punchHeavy" },
    /*
      ERA UM `kickLow` MIRANDO AS PERNAS, e ele reprovava em arcos: o pe
      percorria 116 unidades com curvatura 0,06, praticamente em linha reta.
      Nao e defeito do motor -- um chute a altura do joelho e quase
      horizontal mesmo, e nao tem para onde arquear. O golpe que arqueia e o
      que sobe.
    */
    { type: "dodged", attacker: "green", target: "gold", move: "kickHigh", targetPoint: "head", pulo: true },
    /*
      O CIANO ACERTA UM AQUI, e a razao e a mesma de sempre: sem ele o roxo
      emenda CINCO golpes seguidos entre os quadros 775 e 1413
      (scripts/coreografia.mts), e cinco sem resposta nao e virada, e
      atropelo. A virada precisa ser disputada para valer como virada.
    */
    { type: "attack", attacker: "green", target: "gold", move: "kickHigh", targetPoint: "head" },
    { type: "combo", attacker: "gold", target: "green", moves: ["punchFast", "elbow", "spinKick"] },
    { type: "recover", who: "green", duration: 34 },

    // ---- O LANCAMENTO E A PERSEGUICAO ------------------------------------
    { type: "tecnica", tecnica: "perseguicaoNoAr", gelo: "green", fogo: "gold" },

    // ---- TERCEIRA TROCA: os dois trocam de igual --------------------------
    { type: "attack", attacker: "gold", target: "green", move: "knee" },

    /*
      O RESPIRO ANTES DO ARREMESSO. `golpear` escreve chaves do alvo ALEM do
      cursor que devolve, entao uma cena que comece antes disso tem as chaves
      descartadas em silencio pela amostragem. Aqui o espaco e preenchido com
      luta em vez de com um `hold` parado -- foi o que a luta dos ninjas
      ensinou: o tempo tem que ser gasto do mesmo jeito, so nao precisa ser
      gasto parado.
    */
    /*
      O RESPIRO ENCOLHEU, e nao pode sumir. Ele existe porque `golpear`
      escreve chaves do alvo ALEM do cursor que devolve: uma cena que comece
      antes disso tem as chaves descartadas em silencio pela amostragem, e o
      arremesso simplesmente nao acontece. Eram dois beats (3,1s); um
      bloqueio rapido cobre a mesma necessidade em menos de um segundo.
    */
    { type: "blocked", attacker: "green", target: "gold", move: "punchFast" },

    // ---- O ARREMESSO CONTRA A ROCHA --------------------------------------
    { type: "tecnica", tecnica: "arremessoNoParedao", gelo: "green", fogo: "gold" },
    { type: "recover", who: "green", duration: 40 },

    // ---- A LIBERACAO E A DECISAO -----------------------------------------
    /*
      AQUI HAVIA UM `liberarVermelho`: 4,4 segundos para UMA aura.

      Trocado por duas cenas que rendem muito mais na mesma faixa de tempo --
      a esfera que atravessa o vale e a liberacao do outro lado. A luta tinha
      13 efeitos contra os 46 da luta dos ninjas, e a diferenca nao era de
      motor: era de quais cenas estavam sendo chamadas.
    */
    { type: "tecnica", tecnica: "azulVermelho", gelo: "green", fogo: "gold" },
    { type: "tecnica", tecnica: "liberarAzul", gelo: "green", fogo: "gold" },
    /*
      SAIU UM `punchHeavy` DO GOLD AQUI, para caber em Shorts com folga: eram
      2,55 segundos, e o `uppercut` logo abaixo ja e o golpe pesado que
      prepara o finalizador. Dois pesados seguidos do mesmo lutador nao
      somam -- o segundo so adia o desfecho.
    */
    /*
      O CIANO DEVOLVE UM ANTES DE CAIR, e isso nao e generosidade com ele: e
      o que separa luta de surra. scripts/coreografia.mts acusou o roxo
      encadeando CINCO golpes sem resposta aqui, e uma sequencia assim tira a
      graca do finalizador -- quem ja estava ganhando de lavada nao precisa
      de um golpe final.
    */
    { type: "attack", attacker: "green", target: "gold", move: "punchFast" },
    { type: "attack", attacker: "gold", target: "green", move: "uppercut", targetPoint: "queixo" },

    // ---- FINALIZADOR ------------------------------------------------------
    { type: "finisher", attacker: "gold", target: "green", move: "spinKick", targetPoint: "chest" },
    { type: "hold", duration: 38, label: "desfecho" },

    // ---- E O PEDIDO PARA A PLATEIA ----------------------------------------
    { type: "danca", who: "gold", duration: 104 },
    {
      type: "placa",
      who: "gold",
      duration: 200,
      linhas: ["DÁ LIKE", "E SE INSCREVE", "NO CANAL!"],
    },
  ],
});

/** Miguel contra Ravi: vence o laranja. */
export const DUELO_DO_VALE: FightSpec = duelo("MIGUEL", "RAVI");

/**
 * Lucas contra Gabriel: a MESMA luta com o outro vencedor.
 *
 * `trocarVencedor` inverte quem ataca, quem esquiva, quem cai, quem
 * finaliza e quem levanta a placa -- inclusive os papeis das cenas, entao
 * quem e arremessado contra a rocha tambem muda. Os lados da tela nao
 * mudam: o ciano segue a esquerda.
 */
export const DUELO_DO_VALE_2: FightSpec = trocarVencedor(
  duelo("LUCAS", "GABRIEL"),
);
