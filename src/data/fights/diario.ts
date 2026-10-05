/**
 * O DUELO DO DIA: a mesma maquina, nunca o mesmo video.
 *
 * O canal publica um duelo por dia, e um video diario tem uma exigencia que
 * um avulso nao tem: ele nao pode parecer o de ontem. Mas tambem nao pode ser
 * escrito do zero toda vez -- coreografia escrita a mao e o que custa caro
 * aqui, e manter uma duzia delas em sincronia com o motor seria pior que ter
 * uma so.
 *
 * A saida e girar QUATRO EIXOS INDEPENDENTES. Cada um sozinho e barato; o que
 * o espectador ve e o produto deles.
 *
 *   ELENCO    quais dois corpos, com que cores e que poderes
 *   PALCO     onde a luta acontece
 *   ROTEIRO   a coreografia: quais cenas grandes, em que ordem
 *   HISTORIA  o que o video diz que esta acontecendo (titulo, descricao)
 *
 * E mais os nomes, o vencedor e a chamada do fim, que ja giravam.
 *
 * OS EIXOS NAO SAO LIVRES, e e disso que trata metade deste arquivo:
 *
 *   COR CONTRA FUNDO   corpo claro some em palco claro, e vice-versa. Medido,
 *                      nao achado: scripts/elenco.mts calcula a razao de
 *                      contraste de cada corpo contra o fundo de cada palco e
 *                      reprova o par que some. Foi assim que se descobriu que
 *                      o ciano da 2.03 contra o branco -- abaixo do 3.0 de que
 *                      uma forma precisa para se ler.
 *   CENA CONTRA PALCO  `arremessoNoParedao` joga um corpo contra a rocha do
 *                      vale. Em qualquer outro cenario a rocha nao existe, e o
 *                      corpo bate no ar. O roteiro declara que precisa dela.
 *
 * Declarar a restricao e o que permite girar o resto sem medo: uma combinacao
 * impossivel nao chega a ser renderizada, e o motivo fica escrito.
 */

import type {
  Beat,
  FighterId,
  FightSpec,
  NomeDePaleta,
} from "../../core/types";
import { trocarVencedor } from "../trocar";

/**
 * Nomes de crianca, e sao eles que fazem o video ser clicado.
 *
 * Os mais registrados no Brasil (Arpen/IBGE). Uma crianca que ve o proprio
 * nome na tela de escolha nao esta assistindo a dois bonecos: esta
 * assistindo a si mesma. E o motivo de a lista ser de nomes comuns e nao de
 * nomes bonitos -- o que vale e a chance de acertar o de quem assiste.
 */
export const NOMES = [
  "MIGUEL", "RAVI", "HEITOR", "ARTHUR", "THEO", "GAEL", "DAVI", "BERNARDO",
  "NOAH", "GABRIEL", "LUCAS", "SAMUEL", "PEDRO", "ANTHONY", "ISAAC", "BENICIO",
  "ENZO", "MATHEUS", "RAFAEL", "JOAO", "LORENZO", "BENJAMIN", "NICOLAS", "VICENTE",
] as const;

/**
 * As chamadas do fim, giradas junto com o resto.
 *
 * Pedir sempre a mesma coisa cansa, e cada uma pede uma acao diferente do
 * espectador -- comentar um nome rende mais que comentar um lado, porque da
 * ao canal a proxima luta de graca.
 */
export const CHAMADAS = [
  ["COMENTA", "QUEM VOCE QUER", "VER LUTAR!"],
  ["DA LIKE", "E SE INSCREVE", "NO CANAL!"],
  ["COMENTA O NOME", "DO PROXIMO", "LUTADOR!"],
  ["QUEM VOCE", "ACHA QUE", "GANHA?"],
] as const;

/*
  ============================ OS PALCOS ============================

  `claro` nao e descricao, e a restricao: ele decide qual elenco pode pisar
  ali (ver ELENCOS e scripts/elenco.mts). `rocha` diz se o cenario tem o
  paredao do vale -- sem ele, `arremessoNoParedao` arremessa contra o nada.

  A LISTA E CURTA DE PROPOSITO. Cenario novo nao e so um fundo: e um fundo
  contra o qual todo corpo precisa ser remedido, e uma cena de contato que
  precisa continuar fazendo sentido nele.
*/
export type Palco = {
  nome: string;
  scenario: FightSpec["scenario"];
  /** fundo claro? decide qual elenco se le aqui */
  claro: boolean;
  /** tem o paredao do vale? decide quais cenas cabem */
  rocha: boolean;
  /** como a descricao do video chama o lugar */
  lugar: string;
};

export const PALCOS: Record<string, Palco> = {
  vale: {
    nome: "vale",
    scenario: "vale",
    claro: false,
    rocha: true,
    lugar: "no Vale Partido",
  },
  noite: {
    nome: "noite",
    scenario: "noite",
    claro: false,
    rocha: false,
    lugar: "na montanha, de madrugada",
  },
  metropole: {
    nome: "metropole",
    scenario: "metropole",
    claro: false,
    rocha: false,
    lugar: "nos telhados da cidade grande",
  },
  arena: {
    nome: "arena",
    scenario: "arena",
    claro: false,
    rocha: false,
    lugar: "na arena subterranea",
  },
  vilarejo: {
    nome: "vilarejo",
    scenario: "vilarejo",
    claro: true,
    rocha: false,
    lugar: "na praca do vilarejo",
  },
  cidade: {
    nome: "cidade",
    scenario: "cidade",
    claro: true,
    rocha: false,
    lugar: "no meio da rua",
  },
  limpo: {
    nome: "limpo",
    scenario: "limpo",
    claro: true,
    rocha: false,
    lugar: "no vazio",
  },
};

/*
  ============================ OS ELENCOS ============================

  Um elenco e um PAR: duas cores que se separam entre si e do fundo, com os
  poderes que aparecem embaixo do nome na tela de escolha.

  `claro` aqui quer dizer "serve a palco claro", e nao "e de cor clara" -- um
  elenco de palco claro e feito de corpos ESCUROS. A confusao custaria um
  video inteiro ilegivel, entao vale o nome esquisito.

  O par tambem nao e so estetica: os dois corpos tem perfis de velocidade e
  forca diferentes, e `trocarVencedor` reescreve combos de lutador lento (ver
  data/trocar). Nenhum destes esta abaixo de 0.6 de velocidade de proposito --
  o rodizio de elenco nao deve mudar a coreografia pelas costas.
*/
export type Elenco = {
  nome: string;
  a: FighterId;
  b: FighterId;
  paletaA: NomeDePaleta;
  paletaB: NomeDePaleta;
  poderA: string;
  poderB: string;
  /** serve a palco de fundo claro? */
  claro: boolean;
};

export const ELENCOS: Elenco[] = [
  // ---- para palco ESCURO: corpos claros ---------------------------------
  {
    nome: "mare-tempestade",
    a: "green",
    b: "gold",
    paletaA: "gelo",
    paletaB: "fogo",
    poderA: "MARE",
    poderB: "TEMPESTADE",
    claro: false,
  },
  {
    nome: "vazio-floresta",
    a: "violeta",
    b: "limao",
    paletaA: "vazio",
    paletaB: "gelo",
    poderA: "VAZIO",
    poderB: "FLORESTA",
    claro: false,
  },
  {
    nome: "brasa-gelo",
    a: "magenta",
    b: "green",
    paletaA: "vermelho",
    paletaB: "gelo",
    poderA: "BRASA",
    poderB: "GELO",
    claro: false,
  },
  // ---- para palco CLARO: corpos escuros ---------------------------------
  {
    nome: "sangue-mar",
    a: "carmim",
    b: "oceano",
    paletaA: "vermelho",
    paletaB: "azul",
    poderA: "SANGUE",
    poderB: "MAR",
    claro: true,
  },
  {
    nome: "sombra-raiz",
    a: "grafite",
    b: "musgo",
    paletaA: "sombra",
    paletaB: "gelo",
    poderA: "SOMBRA",
    poderB: "RAIZ",
    claro: true,
  },
];

/*
  ============================ OS ROTEIROS ============================

  Os papeis sao escritos como `green` e `gold` e so viram o elenco do dia no
  fim (ver `trocarElenco`). Antes disso trocar de elenco seria reescrever cada
  beat na mao -- com o risco calado de deixar UM para tras e ter um lutador
  atacando a si mesmo.
*/
type Papel = "green" | "gold";
const A: Papel = "green";
const B: Papel = "gold";

export type Roteiro = {
  nome: string;
  /** precisa do paredao do vale? */
  rocha: boolean;
  /** o que esta acontecendo, para o titulo e a descricao */
  tema: string;
  beats: Beat[];
};

/**
 * Os roteiros. Cada um e a MESMA luta em tres atos (troca, virada, decisao),
 * com cenas grandes diferentes em posicoes diferentes.
 *
 * Todos terminam no mesmo finalizador porque o desfecho e o que menos pode
 * variar: a barra de vida precisa chegar a zero junto com o golpe, e isso e
 * calibrado contra quantos golpes conectam antes (ver a escala de dano em
 * effects/espetaculo).
 */
const ROTEIROS: Record<string, Roteiro> = {
  /** O VALE: recuo para o fundo, perseguicao no ar, arremesso na rocha. */
  vale: {
    nome: "vale",
    rocha: true,
    tema: "duelo no vale",
    beats: [
      { type: "tecnica", tecnica: "sumirEColidir", gelo: A, fogo: B },
      { type: "attack", attacker: A, target: B, move: "punchFast" },
      { type: "attack", attacker: A, target: B, move: "elbow", targetPoint: "chest" },
      { type: "combo", attacker: A, target: B, moves: ["punchFast", "punch", "knee"] },
      { type: "tecnica", tecnica: "cercoEmProfundidade", gelo: B, fogo: A },
      { type: "attack", attacker: B, target: A, move: "punchHeavy" },
      /*
        A ESQUIVA PERDEU O PULO -- e isso NAO foi o que consertou o contato.

        Eu tirei o pulo achando que o problema era o corpo pousar longe: o
        chute de resposta parava a 54 unidades do eixo precisando de 29, com
        a cinematica inversa no maximo. Medido sem o pulo: exatamente as
        mesmas 54 unidades. A distancia vinha do `cercoEmProfundidade` tres
        beats antes, que termina com os dois afastados, e nao do salto.

        Quem consertou foi baixar o alvo do contra-ataque para o TRONCO (ver
        o beat logo abaixo). O pulo ficou de fora assim mesmo, por leitura e
        nao por medida: quem pula para tras fugiu; quem inclina o corpo e
        devolve na sequencia leu o golpe -- e e disso que esta sequencia
        trata.
      */
      { type: "dodged", attacker: B, target: A, move: "kickHigh", targetPoint: "head" },
      { type: "attack", attacker: A, target: B, move: "kickHigh", targetPoint: "chest" },
      { type: "combo", attacker: B, target: A, moves: ["punchFast", "elbow", "spinKick"] },
      { type: "recover", who: A, duration: 34 },
      { type: "tecnica", tecnica: "perseguicaoNoAr", gelo: A, fogo: B },
      { type: "attack", attacker: B, target: A, move: "knee" },
      /*
        A DEFESA TEM QUE RENDER ALGUMA COISA.

        Quem bloqueia ou esquiva aqui e quem age em seguida. Estava ao
        contrario: o defensor segurava o golpe e o atacante simplesmente
        continuava -- medido, 5 das 10 defesas dos seis roteiros nao viravam
        nada. Defesa que nao abre nada le como enfeite, e lutador que se
        defende para nada le como burro.

        Nao custa tempo nem muda o placar: golpe bloqueado ou esquivado ja
        nao contava como acerto (ver scripts/coreografia.mts). O que muda e
        de quem e o golpe que nao conecta.
      */
      { type: "blocked", attacker: B, target: A, move: "punchFast" },
      { type: "tecnica", tecnica: "arremessoNoParedao", gelo: A, fogo: B },
      { type: "recover", who: A, duration: 40 },
      { type: "tecnica", tecnica: "azulVermelho", gelo: A, fogo: B },
      { type: "tecnica", tecnica: "liberarAzul", gelo: A, fogo: B },
      { type: "attack", attacker: A, target: B, move: "punchFast" },
      { type: "attack", attacker: B, target: A, move: "uppercut", targetPoint: "queixo" },
    ],
  },

  /**
   * O AR: a perseguicao abre a luta, e a rocha fica para o clima do fim.
   *
   * Comecar pelo lancamento muda a leitura do duelo inteiro: aqui um dos dois
   * ja sai perdendo, e a virada vem do chao.
   */
  ar: {
    nome: "ar",
    rocha: true,
    tema: "a luta que comeca no ar",
    beats: [
      { type: "tecnica", tecnica: "sumirEColidir", gelo: A, fogo: B },
      { type: "attack", attacker: B, target: A, move: "punchFast" },
      { type: "tecnica", tecnica: "perseguicaoNoAr", gelo: A, fogo: B },
      { type: "recover", who: A, duration: 30 },
      { type: "combo", attacker: B, target: A, moves: ["punchFast", "elbow", "spinKick"] },
      { type: "attack", attacker: A, target: B, move: "kickHigh", targetPoint: "head" },
      { type: "dodged", attacker: B, target: A, move: "kickHigh", targetPoint: "head" },
      { type: "attack", attacker: A, target: B, move: "punchHeavy" },
      { type: "tecnica", tecnica: "cercoEmProfundidade", gelo: A, fogo: B },
      { type: "attack", attacker: A, target: B, move: "elbow", targetPoint: "chest" },
      /*
        B DEVOLVE UM AQUI. Sem este golpe, A encadeia CINCO sem resposta ate o
        finalizador (scripts/coreografia.mts, quadro 2112) -- e cinco sem
        resposta nao e virada, e atropelo. Vale para todo roteiro: a decisao
        do fim so tem peso se os dois chegarem nela.
      */
      { type: "attack", attacker: B, target: A, move: "knee" },
      { type: "blocked", attacker: B, target: A, move: "punchFast" },
      { type: "tecnica", tecnica: "arremessoNoParedao", gelo: A, fogo: B },
      { type: "recover", who: A, duration: 40 },
      { type: "tecnica", tecnica: "azulVermelho", gelo: A, fogo: B },
      { type: "tecnica", tecnica: "liberarAzul", gelo: A, fogo: B },
      { type: "attack", attacker: A, target: B, move: "punchFast" },
      { type: "attack", attacker: B, target: A, move: "uppercut", targetPoint: "queixo" },
    ],
  },

  /**
   * A ROCHA: o arremesso vem cedo e a luta acontece DEPOIS dele.
   *
   * E o roteiro em que o perdedor do meio vira o vencedor do fim -- levar a
   * cena mais pesada logo no comeco deixa o resto da luta sendo a recuperacao
   * de quem apanhou.
   */
  rocha: {
    nome: "rocha",
    rocha: true,
    tema: "arremessado contra a montanha",
    beats: [
      { type: "tecnica", tecnica: "sumirEColidir", gelo: A, fogo: B },
      { type: "combo", attacker: B, target: A, moves: ["punchFast", "punch", "knee"] },
      /*
        A DEFESA TEM QUE RENDER ALGUMA COISA.

        Quem bloqueia ou esquiva aqui e quem age em seguida. Estava ao
        contrario: o defensor segurava o golpe e o atacante simplesmente
        continuava -- medido, 5 das 10 defesas dos seis roteiros nao viravam
        nada. Defesa que nao abre nada le como enfeite, e lutador que se
        defende para nada le como burro.

        Nao custa tempo nem muda o placar: golpe bloqueado ou esquivado ja
        nao contava como acerto (ver scripts/coreografia.mts). O que muda e
        de quem e o golpe que nao conecta.
      */
      { type: "blocked", attacker: B, target: A, move: "punchFast" },
      { type: "tecnica", tecnica: "arremessoNoParedao", gelo: A, fogo: B },
      { type: "recover", who: A, duration: 44 },
      { type: "attack", attacker: A, target: B, move: "punchHeavy" },
      { type: "dodged", attacker: B, target: A, move: "kickHigh", targetPoint: "head" },
      { type: "tecnica", tecnica: "cercoEmProfundidade", gelo: A, fogo: B },
      { type: "attack", attacker: A, target: B, move: "kickHigh", targetPoint: "head" },
      { type: "combo", attacker: B, target: A, moves: ["punchFast", "elbow", "spinKick"] },
      { type: "recover", who: A, duration: 30 },
      { type: "tecnica", tecnica: "perseguicaoNoAr", gelo: A, fogo: B },
      { type: "attack", attacker: B, target: A, move: "knee" },
      { type: "tecnica", tecnica: "azulVermelho", gelo: A, fogo: B },
      { type: "tecnica", tecnica: "liberarAzul", gelo: A, fogo: B },
      { type: "attack", attacker: A, target: B, move: "elbow", targetPoint: "chest" },
      { type: "attack", attacker: B, target: A, move: "uppercut", targetPoint: "queixo" },
    ],
  },

  /**
   * OS TELHADOS: a luta de ninja sem a rocha.
   *
   * E o primeiro roteiro que NAO precisa do vale, e por isso o primeiro que
   * pode acontecer em qualquer lugar. No lugar do arremesso entra o choque de
   * rajadas: um climax que acontece entre os dois, e nao contra o cenario --
   * que e o que torna a cena portatil.
   */
  telhados: {
    nome: "telhados",
    rocha: false,
    tema: "perseguicao pelos telhados",
    beats: [
      { type: "tecnica", tecnica: "sumirEColidir", gelo: A, fogo: B },
      { type: "attack", attacker: A, target: B, move: "punchFast" },
      { type: "combo", attacker: A, target: B, moves: ["punchFast", "punch", "knee"] },
      /*
        ERA UMA COTOVELADA, e virou soco porque o cotovelo nao alcanca daqui.

        Com um dos elencos ele chegava a guarda um quadro atrasado -- 70
        unidades do eixo no quadro do contato, 15 no seguinte --, e golpe
        atrasado e golpe que nao encosta. A pose e segurada de dois em dois
        quadros e o tempo de cada golpe escala com a velocidade do atacante,
        entao a paridade muda de elenco para elenco.

        MIRAR O TRONCO NAO RESOLVE AQUI, e isso foi medido: num golpe
        BLOQUEADO o alvo e a GUARDA, e nao um ponto do corpo. Forcando
        `targetPoint: "chest"` eu reprovei os dez elencos de uma vez, no lugar
        de um. O remedio da cotovelada do duelo do vale nao vale para golpe
        que o outro segura.
      */
      { type: "blocked", attacker: B, target: A, move: "punch" },
      { type: "tecnica", tecnica: "perseguicaoNoAr", gelo: A, fogo: B },
      { type: "recover", who: A, duration: 30 },
      // o cotovelo do meio virou soco pela mesma medida do roteiro `rua`: num
      // combo que vem logo depois de uma cena grande ele chega um quadro
      // atrasado, e um quadro atrasado e golpe que nao encosta
      { type: "combo", attacker: B, target: A, moves: ["punchFast", "punch", "spinKick"] },
      /*
        O RECUO PRECISA DE UM BEAT PARA VOLTAR.

        `contato` reprovou o golpe logo abaixo: ele parava a 64 unidades do
        eixo precisando de 29, com a correcao de cinematica inversa ja no
        maximo -- ou seja, a perna simplesmente nao alcanca. Nao e defeito do
        golpe nem do corpo: o golpe anterior ARREMESSA, e quem foi arremessado
        comeca o proximo ataque de longe demais.

        Os roteiros antigos ja faziam isto e eu nao tinha percebido que era
        regra: todo golpe pesado deles e seguido de `recover`. O respiro nao e
        descanso, e a volta a distancia de combate.
      */
      { type: "recover", who: A, duration: 26 },
      { type: "attack", attacker: A, target: B, move: "kickHigh", targetPoint: "head" },
      { type: "tecnica", tecnica: "cercoEmProfundidade", gelo: B, fogo: A },
      { type: "attack", attacker: B, target: A, move: "punchHeavy" },
      /*
        A DEFESA TEM QUE RENDER ALGUMA COISA.

        Quem bloqueia ou esquiva aqui e quem age em seguida. Estava ao
        contrario: o defensor segurava o golpe e o atacante simplesmente
        continuava -- medido, 5 das 10 defesas dos seis roteiros nao viravam
        nada. Defesa que nao abre nada le como enfeite, e lutador que se
        defende para nada le como burro.

        Nao custa tempo nem muda o placar: golpe bloqueado ou esquivado ja
        nao contava como acerto (ver scripts/coreografia.mts). O que muda e
        de quem e o golpe que nao conecta.
      */
      { type: "dodged", attacker: B, target: A, move: "kickHigh", targetPoint: "head", pulo: true },
      /*
        SAIU UM `liberarAzul` DAQUI, e o motivo e o relogio: com ele o roteiro
        dava 61,7s no pior elenco, e Shorts corta em 60. A duracao depende do
        ELENCO -- o perfil de velocidade de cada corpo escala a duracao dos
        golpes (ver `speed` em characters/presets) --, entao o limite tem que
        ser medido no par mais lento, e nao no do dia.

        Saiu a aura, e nao uma cena: ela e a unica aqui que nao e troca entre
        os dois. O choque de rajadas logo abaixo ja e a liberacao de poder, e
        com os dois lados dentro dela.
      */
      { type: "tecnica", tecnica: "choqueDeRajadas", gelo: A, fogo: B },
      { type: "attack", attacker: A, target: B, move: "punchFast" },
      { type: "attack", attacker: B, target: A, move: "uppercut", targetPoint: "queixo" },
    ],
  },

  /**
   * OS FEITICEIROS: a luta que quase nao tem soco.
   *
   * O oposto dos outros roteiros, e de proposito -- aqui a troca acontece a
   * distancia: um poder e testado, barrado, trocado por outro. Os poucos
   * golpes de mao limpa existem para o duelo nao virar so luz na tela.
   *
   * De MAO LIMPA mesmo: `corteSobe` e `corteDesce` sao golpes de lamina, e o
   * motor mede a distancia de combate pelo alcance da katana -- numa luta sem
   * arma a mao para longe do alvo e `contato` reprova (ver data/fights/dominio,
   * onde isso aconteceu).
   */
  feiticeiros: {
    nome: "feiticeiros",
    rocha: false,
    tema: "duelo de feiticeiros",
    beats: [
      { type: "tecnica", tecnica: "chegada", gelo: A, fogo: B },
      { type: "tecnica", tecnica: "encontroFeiticeiros", gelo: A, fogo: B },
      { type: "tecnica", tecnica: "barreira", gelo: A, fogo: B },
      { type: "tecnica", tecnica: "corteADistancia", gelo: A, fogo: B },
      /*
        A DEFESA TEM QUE RENDER ALGUMA COISA.

        Quem bloqueia ou esquiva aqui e quem age em seguida. Estava ao
        contrario: o defensor segurava o golpe e o atacante simplesmente
        continuava -- medido, 5 das 10 defesas dos seis roteiros nao viravam
        nada. Defesa que nao abre nada le como enfeite, e lutador que se
        defende para nada le como burro.

        Nao custa tempo nem muda o placar: golpe bloqueado ou esquivado ja
        nao contava como acerto (ver scripts/coreografia.mts). O que muda e
        de quem e o golpe que nao conecta.
      */
      { type: "blocked", attacker: A, target: B, move: "punchHeavy" },
      /*
        ERA UM `kickLow` NAS PERNAS, e `arcos` reprovou: o pe percorria 142
        unidades com curvatura 0,06, praticamente em linha reta. Nao e defeito
        do motor -- chute a altura do joelho e quase horizontal mesmo, e nao
        tem para onde arquear. O golpe que arqueia e o que sobe. (A mesma
        troca ja tinha sido feita em data/fights/duelo-do-vale; eu copiei o
        beat de data/fights/dominio sem lembrar disso.)
      */
      { type: "dodged", attacker: B, target: A, move: "kickHigh", targetPoint: "head", pulo: true },
      { type: "combo", attacker: A, target: B, moves: ["punchFast", "punch", "knee"] },
      { type: "tecnica", tecnica: "azulVermelho", gelo: A, fogo: B },
      { type: "attack", attacker: B, target: A, move: "punchHeavy" },
      { type: "tecnica", tecnica: "dominioVazio", gelo: A, fogo: B },
      /*
        O DOMINIO PRENDE E O ESMAGAMENTO APROVEITA, e e essa emenda que faz a
        dupla valer mais que as duas cenas soltas: `dominioVazio` nao corta,
        ele PARA quem esta dentro -- e quem para o outro e vai buscar o corpo
        esta executando um plano.

        Este roteiro tambem era o mais pobre de espaco dos seis (medido com
        scripts/palco.mts: profundidade ZERO, 461 de altura e 3% dos quadros
        no ar, contra 520 / 779 / 7% do roteiro do vale). Era luta de luz
        trocada no mesmo lugar.
      */
      { type: "tecnica", tecnica: "esmagarNoChao", gelo: A, fogo: B },
      /*
        O CHUTE DEPOIS DO DOMINIO MIRA O TRONCO, e nao a cabeca. A cena larga
        os dois mais afastados do que uma troca de socos deixaria, e mirando a
        cabeca o pe parava a 63 unidades do eixo precisando de 29, com a
        cinematica inversa no maximo -- a perna nao chega la em cima E la na
        frente ao mesmo tempo. E a mesma licao da cotovelada do duelo do vale:
        alvo mais baixo custa menos alcance.
      */
      { type: "attack", attacker: A, target: B, move: "kickHigh", targetPoint: "chest" },
      { type: "tecnica", tecnica: "vazioRoxo", gelo: A, fogo: B },
      { type: "attack", attacker: B, target: A, move: "knee" },
      { type: "attack", attacker: A, target: B, move: "punchFast" },
      { type: "attack", attacker: B, target: A, move: "uppercut", targetPoint: "queixo" },
    ],
  },

  /**
   * A RUA: comeca devagar, sem ninguem aparecendo de lugar nenhum.
   *
   * `chegada` abre com a rua vazia e um dos dois entrando andando -- e a
   * abertura mais lenta que o canal tem, e e o que faz o primeiro golpe
   * significar alguma coisa. Os outros roteiros abrem com os dois ja sumindo
   * e colidindo, que e o oposto.
   */
  rua: {
    nome: "rua",
    rocha: false,
    tema: "briga de rua",
    beats: [
      { type: "tecnica", tecnica: "chegada", gelo: A, fogo: B },
      { type: "attack", attacker: B, target: A, move: "punchFast" },
      { type: "attack", attacker: A, target: B, move: "elbow", targetPoint: "chest" },
      { type: "combo", attacker: B, target: A, moves: ["punchFast", "punch", "knee"] },
      { type: "tecnica", tecnica: "cercoEmProfundidade", gelo: A, fogo: B },
      /*
        AQUI HAVIA UMA `barreira`, que e cena de FEITICEIRO: o golpe chega e
        para sozinho a um palmo do corpo. Numa briga de rua ela nunca fez
        sentido -- entrou porque estava disponivel, que e a pior razao para
        uma cena existir.

        `esmagarNoChao` conta o que este roteiro quer contar: os dois sobem
        juntos, o alvo e cravado no piso e o piso racha. E a unica cena de
        cenario que serve a qualquer palco, porque chao todo palco tem (ver
        core/tecnicas/esmagar-no-chao).
      */
      { type: "tecnica", tecnica: "esmagarNoChao", gelo: A, fogo: B },
      { type: "attack", attacker: A, target: B, move: "punchHeavy" },
      /*
        ERA UMA ESQUIVA, e virou golpe que ACERTA. `coreografia` reprovou com
        cinco golpes de A sem devolucao entre o cerco e a perseguicao: golpe
        esquivado nao conta como resposta, entao a esquiva que estava aqui
        deixava a conta em cinco sem que a cena parecesse errada lendo beat a
        beat. Cinco sem resposta nao e virada, e atropelo -- e tira a graca do
        finalizador, porque quem ja ganhava de lavada nao precisa dele.
      */
      { type: "attack", attacker: B, target: A, move: "kickHigh", targetPoint: "head" },
      // o mesmo respiro do roteiro `telhados`, pela mesma razao medida
      { type: "recover", who: A, duration: 26 },
      /*
        O COTOVELO DO MEIO VIROU SOCO, e so neste roteiro.

        O combo `punchFast + elbow + spinKick` dos outros roteiros reprovava
        aqui com dois dos quatro elencos, e a medida contava uma historia
        estranha: no quadro de contato o cotovelo estava a 70 unidades do
        eixo precisando de 30, e no quadro SEGUINTE estava a 15. Ou seja, ele
        alcanca -- chega um quadro depois da hora.

        A pose e segurada de dois em dois quadros (`quadrosPorDesenho`, ver
        animation/estilo), entao o quadro de contato pode cair na metade
        errada do desenho; o tempo de cada golpe escala com a velocidade do
        atacante, e e isso que muda a paridade de um elenco para outro. Aqui
        o combo vem logo depois de um golpe que arremessa, que e a situacao
        com menos folga de todas -- e o cotovelo e o golpe de alcance mais
        curto do motor, o primeiro a acusar.

        O soco alcanca mais e absorve o deslocamento de um quadro sem drama.
        Nao e remendo do validador: e escolher, nesta posicao, o golpe que
        nao depende de chegar no quadro exato.
      */
      { type: "combo", attacker: A, target: B, moves: ["punchFast", "punch", "spinKick"] },
      { type: "recover", who: B, duration: 30 },
      /*
        A UNICA DEFESA DESTE ROTEIRO, e ele estava sem nenhuma.

        `rua` era troca pura: dezesseis beats e nenhum bloqueio, nenhuma
        esquiva. Dois lutadores que so trocam golpes nao leem como dois
        lutadores -- leem como dois bonecos revezando.

        Ela esta aqui e nao em outro lugar porque e daqui que sai a cena
        seguinte: B deixa o chute passar e emenda a perseguicao no ar. A
        esquiva vira a PARTIDA da cena, em vez de um beat solto.
      */
      { type: "dodged", attacker: A, target: B, move: "kickHigh", targetPoint: "head", pulo: true },
      { type: "tecnica", tecnica: "perseguicaoNoAr", gelo: B, fogo: A },
      { type: "tecnica", tecnica: "azulVermelho", gelo: A, fogo: B },
      { type: "attack", attacker: B, target: A, move: "knee" },
      { type: "attack", attacker: A, target: B, move: "punchFast" },
      { type: "attack", attacker: B, target: A, move: "uppercut", targetPoint: "queixo" },
    ],
  },
};

export const ROTEIROS_DISPONIVEIS = Object.keys(ROTEIROS);

/** Um roteiro pelo nome, para quem audita um roteiro especifico. */
export const roteiroPorNome = (nome: string): Roteiro | undefined => ROTEIROS[nome];

/** Os palcos em que um roteiro pode acontecer sem mentir. */
export const palcosDoRoteiro = (r: Roteiro): Palco[] =>
  Object.values(PALCOS).filter((p) => !r.rocha || p.rocha);

/** Os elencos que se leem num palco (ver scripts/elenco.mts). */
export const elencosDoPalco = (p: Palco): Elenco[] =>
  ELENCOS.filter((e) => e.claro === p.claro);

/**
 * Troca quem sao os dois corpos, sem mexer na coreografia.
 *
 * Os roteiros sao escritos com `green` e `gold` como PAPEIS. Esta funcao e o
 * unico lugar que sabe disso, e a troca e SIMULTANEA (um mapa, nao duas
 * substituicoes em sequencia) -- senao um elenco que incluisse `green` veria
 * o primeiro passo trocar tudo para `green` e o segundo trocar de volta.
 *
 * A lista de campos e a mesma de data/trocar, e pela mesma razao: uma cena
 * tambem tem papeis dentro dela (`gelo` e `fogo`), e esquecer um campo produz
 * uma luta em que o mesmo lutador ataca a si mesmo.
 */
const trocarElenco = (beats: Beat[], de: Record<string, FighterId>): Beat[] =>
  beats.map((beat): Beat => {
    const c = { ...beat } as Record<string, unknown>;
    for (const campo of ["attacker", "target", "who", "gelo", "fogo"]) {
      const v = c[campo];
      if (typeof v === "string" && de[v]) c[campo] = de[v];
    }
    return c as Beat;
  });

export type Duelo = {
  nomeA: string;
  nomeB: string;
  /** qual roteiro usar (ver ROTEIROS_DISPONIVEIS) */
  roteiro: string;
  /** onde (ver PALCOS) */
  palco: string;
  /** quem luta (ver ELENCOS) */
  elenco: string;
  /** o da esquerda vence? false inverte os papeis com trocarVencedor */
  venceA: boolean;
  /** qual chamada do fim (indice em CHAMADAS) */
  chamada: number;
  semente: number;
};

/** O que o video diz que esta acontecendo. */
export const historiaDe = (d: Duelo): { tema: string; lugar: string } => {
  const r = ROTEIROS[d.roteiro] ?? ROTEIROS.vale;
  const p = PALCOS[d.palco] ?? PALCOS.vale;
  return { tema: r.tema, lugar: p.lugar };
};

/**
 * Monta o FightSpec de um duelo.
 *
 * PARA ALTO EM COMBINACAO IMPOSSIVEL. Um roteiro que precisa da rocha num
 * palco que nao a tem renderiza sem erro nenhum: o corpo voa e bate no ar, a
 * auditoria aprova (nenhum validador olha o cenario) e o defeito so aparece
 * para quem assistir. Erro que renderiza limpo e o pior tipo que este projeto
 * tem -- ver a data pedida que virava a luta de hoje, em scripts/diario.
 */
export const duelo = (d: Duelo): FightSpec => {
  const roteiro = ROTEIROS[d.roteiro] ?? ROTEIROS.vale;
  const palco = PALCOS[d.palco] ?? PALCOS.vale;
  const elenco = ELENCOS.find((e) => e.nome === d.elenco) ?? ELENCOS[0];

  if (roteiro.rocha && !palco.rocha) {
    throw new Error(
      `o roteiro "${roteiro.nome}" arremessa um corpo contra o paredao, e o ` +
        `palco "${palco.nome}" nao tem paredao: o corpo bateria no ar`,
    );
  }
  if (elenco.claro !== palco.claro) {
    throw new Error(
      `o elenco "${elenco.nome}" nao se le no palco "${palco.nome}" ` +
        `(ver scripts/elenco.mts, que mede o contraste de cada corpo)`,
    );
  }

  const { a, b } = elenco;
  const beats = trocarElenco(roteiro.beats, { [A]: a, [B]: b });
  const spec: FightSpec = {
    fighterA: a,
    fighterB: b,
    seed: d.semente,
    fps: 60,
    width: 1080,
    height: 1920,
    intensity: 9,
    scenario: palco.scenario,
    estilo: "animeDesenhado",
    nomes: { [a]: d.nomeA, [b]: d.nomeB },
    poderes: { [a]: elenco.poderA, [b]: elenco.poderB },
    // a cor do efeito segue a cor do corpo (ver a nota em core/types)
    paletas: { [a]: elenco.paletaA, [b]: elenco.paletaB },
    // SEM `cinematico`: e ele que apaga o placar
    beats: [
      ...beats,
      /*
        O DESFECHO E IGUAL EM TODOS OS ROTEIROS, e de proposito: a barra de
        vida precisa chegar a zero junto com o finalizador, e essa calibragem
        (ver a escala de dano em effects/espetaculo) depende de quantos golpes
        conectam antes dele.
      */
      { type: "finisher", attacker: b, target: a, move: "spinKick", targetPoint: "chest" },
      { type: "hold", duration: 38, label: "desfecho" },
      { type: "danca", who: b, duration: 76 },
      {
        type: "placa",
        who: b,
        duration: 150,
        linhas: [...CHAMADAS[d.chamada % CHAMADAS.length]],
      },
    ],
  };
  // `trocarVencedor` inverte quem ataca, quem cai, quem finaliza e os papeis
  // das cenas -- inclusive quem e arremessado contra a rocha
  return d.venceA ? trocarVencedor(spec) : spec;
};

/**
 * O duelo de uma data, sempre o mesmo para a mesma data.
 *
 * Determinismo importa aqui: o video de ontem tem que continuar sendo
 * reproduzivel (para corrigir um defeito e re-renderizar sem virar outro
 * video), e o de amanha tem que poder ser conferido hoje. Sorteio com estado
 * daria um video diferente a cada execucao.
 *
 * A ORDEM EM QUE OS EIXOS SAO SORTEADOS NAO E LIVRE. Roteiro primeiro, porque
 * ele e quem exige a rocha; depois o palco, dentre os que o roteiro aceita; e
 * so entao o elenco, dentre os que se leem naquele palco. Sorteando os tres de
 * forma independente, a maioria das combinacoes seria invalida e precisaria
 * ser descartada -- e descarte em sorteio deterministico vira um calendario
 * cheio de buracos.
 *
 * Os periodos sao diferentes entre si para a combinacao demorar a se repetir
 * mesmo com poucas partes.
 */
export const dueloDoDia = (data: Date): Duelo => {
  const dia = Math.floor(
    Date.UTC(data.getUTCFullYear(), data.getUTCMonth(), data.getUTCDate()) / 86400000,
  );
  const roteiro = ROTEIROS[ROTEIROS_DISPONIVEIS[dia % ROTEIROS_DISPONIVEIS.length]];
  const palcos = palcosDoRoteiro(roteiro);
  const palco = palcos[Math.floor(dia / 3) % palcos.length];
  const elencos = elencosDoPalco(palco);
  const elenco = elencos[Math.floor(dia / 5) % elencos.length];

  // os nomes andam de dois em dois para o par nunca repetir no mesmo ciclo
  const i = (dia * 2) % NOMES.length;
  const j = (dia * 2 + 1 + Math.floor(dia / NOMES.length)) % NOMES.length;
  return {
    nomeA: NOMES[i],
    nomeB: NOMES[j === i ? (j + 1) % NOMES.length : j],
    roteiro: roteiro.nome,
    palco: palco.nome,
    elenco: elenco.nome,
    venceA: dia % 2 === 0,
    chamada: dia % CHAMADAS.length,
    semente: 4000 + (dia % 997),
  };
};
