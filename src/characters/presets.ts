/**
 * Presets de lutador.
 *
 * Adicionar uma cor nova (azul, dourado, roxo...) e acrescentar uma entrada
 * aqui. Nenhum outro arquivo muda: o compilador, o desenho, a aura e o audio
 * leem do preset.
 *
 * O "profile" nao e enfeite. O compilador usa speed para escalar a duracao dos
 * golpes e power para escalar o knockback, entao a diferenca entre os dois
 * lutadores aparece no ritmo da luta, nao so na cor.
 */

import type { FighterId, FighterPreset } from "../core/types";

/*
 * ESPESSURA DOS MEMBROS: medida contra a referencia, nao escolhida.
 *
 * scripts/estilo.mts mede a espessura do membro como fracao da altura do
 * corpo, na referencia e no render:
 *
 *   referencia (StickNodes)   12.4%
 *   luta1, o projeto do autor  20.8%
 *   este motor, antes           4.2%
 *
 * Membro fino le como esqueleto de arame; os dois de cima leem como corpo
 * porque a silhueta tem massa. O alvo e o luta1, que e o estilo pedido: com
 * 597 unidades de corpo, 98 de espessura medem 20.8% na tela: as pontas
 * arredondadas somam espessura, entao o numero da pose fica abaixo do medido.
 * O alvo e o MEDIDO, e quem decide e scripts/estilo, nao a conta.
 *
 * A distancia de combate se ajusta sozinha a isso, porque ela deriva da
 * espessura do traco (ver distanciaDeCombate): membro mais grosso significa
 * superficie mais a frente do eixo, e os dois param mais longe um do outro.
 */
export const PRESETS: Record<FighterId, FighterPreset> = {
  // O "preto" NAO pode ser preto de verdade: contra o fundo escuro da arena
  // ele desaparece. Este cinza-azulado le como preto na tela. Descoberto no
  // prototipo em Python (ver references/prototipo-python).
  black: {
    id: "black",
    // Medido com scripts/contraste.mts contra o fundo da arena:
    //   #464b58  razao 2.10  (abaixo do minimo de 3.0 para uma forma se ler)
    //   #5b6278  razao 3.07  (passa, mas o membro de tras cai para 2.07)
    //   #6d7590  razao 4.04  (membro de tras sobe para 2.87)
    //
    // O que obriga a subir tanto e o membro de TRAS: ele e escurecido para dar
    // profundidade, entao a cor principal precisa de folga acima do limite
    // para o membro escurecido nao afundar no fundo.
    //
    // A NOITE (backgrounds/Noite) e mais escura que a arena: fundo #0e1118.
    // Remedido ali, com o membro de tras no fator 0.8 de Stickman.tsx:
    //   #4a5170  principal 2.43  tras 1.86   (os dois reprovam)
    //   #6a74a0  principal 4.15  tras 2.90   (tras ainda no limite)
    //   #707baa  principal 4.59  tras 3.17   (passa com folga)
    //
    // Clarear o FUNDO em vez do corpo foi testado e piora: fundo e corpo sao
    // os dois azul-escuros, entao aproximar um do outro derruba a razao para
    // 1.33. Quem tem de subir e o corpo.
    //
    // #707baa tambem passa no cenario claro (Rabisco, fundo quase branco):
    // principal 3.84, tras 5.55 -- escurecer o membro AUMENTA o contraste
    // sobre fundo claro, entao o mesmo preset serve aos dois cenarios e o
    // personagem mantem a mesma cor em todos os episodios.
    //
    // Continua lendo como "o preto" porque e cinza-azulado dessaturado: a
    // diferenca para o vermelho e de matiz, nao de claridade.
    stroke: "#707baa",
    auraColor: "#8fa2c8",
    // 98 dava membros com 16% da altura do corpo: dois corpos encostados
    // viravam uma mancha so, e o joelho e o cotovelo sumiam dentro do traco.
    // Nesta espessura a silhueta le as articulacoes e o espaco entre os dois.
    limbWidth: 62,
    headRadius: 85,
    scale: 1,
    tracos: {
      // acabamento, nao identidade: volume da leitura de cilindro ao
      // membro, e a luz de contorno responde ao neon do cenario.
      volume: true,
      luzDeContorno: "#8fa8e0",
    },
    profile: { speed: 0.9, power: 0.45 },
  },
  red: {
    id: "red",
    // Mesma conta do preto, medida na noite (fundo #101319) com o membro de
    // tras no fator 0.8:
    //   #d6403a  principal 4.07  tras 2.84  (o principal passa, o tras nao)
    //   #eb463f  principal 4.85  tras 3.32  (os dois passam com folga)
    //
    // O principal sozinho enganava: so o membro de tras revela que falta.
    // No Rabisco continua folgado (principal 3.57, tras 5.22).
    stroke: "#eb463f",
    auraColor: "#e2483c",
    // um pouco mais grosso que o preto: o pesado tambem se le no traco
    limbWidth: 68,
    headRadius: 88,
    scale: 1.06,
    tracos: {
      volume: true,
      luzDeContorno: "#ff9a86",
    },
    profile: { speed: 0.42, power: 0.95 },
  },
  blue: {
    id: "blue",
    // clareado de #3f7fd6: naquele tom a razao de contraste contra o ceu
    // noturno ficava abaixo do minimo de 3.0 que uma forma precisa para se
    // ler (mesma conta dos outros presets, ver o bloco do preto acima)
    stroke: "#5b9bf0",
    auraColor: "#4aa8ff",
    // 98 deixava dois corpos encostados virando uma mancha so; na espessura
    // do preto e do vermelho a silhueta le as articulacoes
    limbWidth: 66,
    headRadius: 86,
    scale: 1,
    tracos: {
      volume: true,
      luzDeContorno: "#a8cfff",
    },
    profile: { speed: 0.78, power: 0.6 },
  },
  /*
    OS DOIS DO DUELO DO VALE, refeitos MAIS MAGROS.
    Com membro de 100 contra 267 do quadril ao pe, o membro era mais de um
    terco do comprimento da perna -- e a espessura ainda e multiplicada pelo
    calibre do tronco (ver CALIBRE em characters/Stickman). O resultado lia
    como boneco inflado, nao como lutador.
    E DEPOIS AFINARAM DE NOVO, para 40, a pedido de "mais parecidos com
    stickman". A medida que importa ali nao e contra a perna: e contra o
    DIAMETRO DA CABECA. Um boneco de vareta classico tem o membro entre 12% e
    22% dele; com 72 contra 144 estavamos em 50%, que e proporcao de
    personagem cheio, nao de traco. 40 poe em 28% -- ainda com presenca em
    tela de celular, e ja lendo como vareta.
  */
  gold: {
    id: "gold",
    // LARANJA e nao dourado: o dourado (#d8a63a) e o amarelo da barra de vida
    // e o do letreiro de combo sao a mesma familia, e o lutador se perdia
    // dentro do proprio placar. O laranja separa dos tres.
    stroke: "#f2743a",
    auraColor: "#ffb067",
    limbWidth: 42,
    // a cabeca desce junto, so que menos: com membro de 74 e cabeca de 86 o
    // diametro dela virava 2,3 vezes a espessura do corpo e o boneco lia como
    // cabecudo. 74 poe em 2,0, que e a proporcao de um atleta estilizado.
    headRadius: 74,
    scale: 1.02,
    profile: { speed: 0.75, power: 0.8 },
  },
  green: {
    id: "green",
    // CIANO contra o laranja: complementares, e os dois se separam do vale
    // noturno (azul-arroxeado escuro) sem contorno extra. O verde #46a85e
    // era escuro demais para um fundo escuro.
    stroke: "#2fc8d6",
    auraColor: "#74e8f2",
    limbWidth: 40,
    headRadius: 72,
    scale: 1,
    profile: { speed: 0.65, power: 0.6 },
  },
  /*
   * O DE BRANCO: cabelo claro, olhos acesos, luta a distancia.
   *
   * O corpo NAO e branco apesar do id: corpo claro com cabelo claro vira uma
   * mancha so, e o cabelo deixa de ser traco para virar contorno. O corpo fica
   * no azul-acinzentado (mesma familia do "preto", ver a conta la em cima) e
   * quem carrega a identidade e o cabelo e o olho.
   */
  white: {
    id: "white",
    // Uniforme escuro de gola alta. Medido na noite (fundo #101319):
    //   #565d7d  principal 2.88  tras 2.13  (reprova nos dois)
    //   #6b739b  principal 4.03  tras 2.84  (principal passa com folga)
    //   #727ba5  principal 4.51  tras 3.12  (passa nos dois, mas ja e cinza
    //                                        medio e perde a leitura de escuro)
    //
    // Fica no do meio. O membro de tras em 2.84 e abaixo do alvo de 3.0 e
    // isso e escolha, nao descuido: subir ate o valor do tras custaria o
    // uniforme escuro, que e o traco do personagem. O desconto e coberto
    // pelo mesmo mecanismo que o resto do motor ja usa -- larguraFundo deixa
    // o membro de tras mais grosso, entao a espessura paga o que a cor deve.
    //
    // O corpo tambem nao carrega a silhueta sozinho aqui: cabelo claro, olho
    // aceso e gola dao tres pontos de alto contraste na metade de cima, que
    // e onde o olho procura a figura.
    stroke: "#6b739b",
    auraColor: "#8fd6ff",
    // SILHUETA: esguio e alto contra o outro, que e baixo e largo. Dois
    // corpos de mesma proporcao so se distinguem pela cor, e em movimento
    // rapido a cor chega depois da forma.
    limbWidth: 86,
    headRadius: 80,
    scale: 1.04,
    profile: { speed: 0.85, power: 0.5 },
  },
  /*
   * O DE MARCAS: mais pesado e mais lento, briga de perto e corta de longe.
   * As marcas sao padrao proprio (duas faixas na testa, uma na face), nao
   * copia de nenhum personagem existente.
   */
  purple: {
    id: "purple",
    // Corpo palido: o oposto do outro de proposito. Um escuro contra um claro
    // resolve a leitura dos dois de uma vez -- eles se separam entre si e do
    // fundo sem precisar de contorno extra. Medido: principal 8.9.
    // As marcas pretas so se leem sobre corpo claro, entao a escolha de
    // deixar este palido e o que torna as faixas possiveis.
    stroke: "#e8cbc0",
    auraColor: "#ff7b9c",
    // 112 de membro deixava o corpo mais largo que alto e as marcas nao
    // tinham pele em volta para respirar. Continua o mais pesado dos dois,
    // so que por proporcao e nao por inchaco.
    limbWidth: 102,
    headRadius: 88,
    scale: 0.99,
    profile: { speed: 0.6, power: 0.78 },
  },
};
