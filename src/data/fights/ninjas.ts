/**
 * NINJA VERMELHO vs NINJA AZUL: sessenta segundos, do encarar ao nocaute duplo.
 *
 * Roteiro do autor, beat a beat:
 *
 *   0-5    se encaram num vale destruído; somem e colidem no centro
 *   5-12   corpo a corpo rápido: socos, bloqueios, chutes, esquivas
 *   12-18  vermelho lança azul para o alto e persegue; azul revida no ar
 *   18-25  azul dispara uma esfera; vermelho atravessa e surge atrás
 *   25-32  combo aéreo; azul é lançado contra a montanha
 *   32-40  silêncio; vermelho libera aura; o chão racha e pedras flutuam
 *   40-48  azul libera o poder dele; os dois avançam e colidem
 *   48-55  ataques máximos; as rajadas se chocam e o cenário desmorona
 *   55-60  explosão, tela branca, os dois caídos tentando levantar
 *
 * NINGUÉM VENCE, e isso é escolha do roteiro -- nenhum impacto leva
 * `finalizador`, então o motor não monta K.O. nem placa de vencedor (ver
 * effects/espetaculo). O fim fica aberto, com a pergunta para a plateia.
 *
 * Os papéis das técnicas são `gelo` = azul e `fogo` = vermelho. São papéis e
 * não elementos: o azul é quem luta com energia à distância, o vermelho é
 * quem fecha a distância. A mesma convenção das outras lutas do projeto.
 */

import type { FightSpec } from "../../core/types";

export const NINJAS: FightSpec = {
  fighterA: "blue",
  fighterB: "red",
  seed: 909,
  fps: 60,
  width: 1080,
  height: 1920,
  intensity: 9,
  // o vale destruído do roteiro (ver backgrounds/Vale.tsx)
  scenario: "vale",
  // silhueta mais aberta e timing mais agressivo: é o que o roteiro pede na
  // direção ("antecipação, poses fortes, aceleração"). Ver animation/estilo.
  // a POSE SEGURADA em 2s, que e o que aproxima da animacao desenhada a mao.
  // Vive num preset proprio porque tem conflito aberto com o apoio dos pes em
  // cenas de locomocao longa -- ver a nota em animation/estilo.ts
  estilo: "animeDesenhado",
  nomes: { blue: "AZUL", red: "VERMELHO" },
  poderes: { blue: "VAZIO", red: "CHAMA" },
  cinematico: true,
  beats: [
    // ---- 0-5: encaram, somem, colidem -----------------------------------
    { type: "tecnica", tecnica: "sumirEColidir", gelo: "blue", fogo: "red" },

    // ---- 5-12: corpo a corpo --------------------------------------------
    /*
      A TROCA ALTERNA QUEM ACERTA, e isso precisou ser MEDIDO para ser
      verdade.

      A intencao sempre esteve escrita aqui, e mesmo assim a luta terminava
      OITO A TRES para o vermelho (scripts/coreografia.mts). O motivo nao
      estava em nenhum beat isolado: os ataques do azul eram quase todos
      `blocked` ou `dodged` e os do vermelho eram `attack`. Cada beat parecia
      razoavel sozinho; somados, contavam uma surra.

      Num roteiro que termina em aberto -- ninguem vence -- isso e uma
      contradicao que o espectador sente antes de saber nomear: o azul apanha
      a luta inteira e de repente empata.
    */
    { type: "attack", attacker: "red", target: "blue", move: "punchFast" },
    { type: "blocked", attacker: "blue", target: "red", move: "punch" },
    { type: "dodged", attacker: "red", target: "blue", move: "kickHigh", targetPoint: "head" },
    { type: "combo", attacker: "blue", target: "red", moves: ["punchFast", "punch", "knee"] },
    { type: "blocked", attacker: "red", target: "blue", move: "elbow" },
    { type: "dodged", attacker: "blue", target: "red", move: "kickLow", targetPoint: "legs", pulo: true },

    // ---- 12-18: lança para o alto e persegue ----------------------------
    /*
      QUEM LEVA O UPPERCUT E QUEM SOBE.

      Estava `airborne: "red"` -- o proprio atacante. Medido quadro a quadro:
      o vermelho acertava o queixo do azul, o azul caia no chao em 40 quadros,
      e entao o VERMELHO pulava sozinho ate y -660 e ficava 40 quadros no ar
      com o adversario deitado embaixo. Depois descia, e so entao o azul se
      levantava para pular nele.

      Ninguem pula sozinho no meio de uma luta. O roteiro pede outra coisa e e
      a coisa que se entende: o golpe lanca o azul, o vermelho SOBE ATRAS
      dele, e o azul revida la em cima.
    */
    { type: "tecnica", tecnica: "perseguicaoNoAr", gelo: "blue", fogo: "red" },

    // ---- 18-25: a esfera do azul ----------------------------------------
    { type: "tecnica", tecnica: "azulVermelho", gelo: "blue", fogo: "red" },

    // ---- 25-32: combo aéreo, azul arremessado ---------------------------
    { type: "combo", attacker: "red", target: "blue", moves: ["punchFast", "knee", "spinKick"] },
    /*
      O arremesso agora BATE em alguma coisa. Com `knockback` ele era distância
      percorrida, e distância sozinha não tem consequência -- o corpo
      desacelerava e parava. A rocha que racha é a testemunha do golpe.
    */
    /*
      O RESPIRO ENTRE O COMBO E O ARREMESSO NAO E PAUSA: e espaco para as
      chaves do combo terminarem.

      `golpear` escreve chaves do alvo ALEM do cursor que devolve -- o combo
      acima escreve ate o quadro 715 e devolve o cursor em ~532. Sem este
      respiro a tecnica inteira comecava no passado e a amostragem, que
      percorre as chaves em sequencia, descartava todas elas em silencio: o
      arremesso nao acontecia e o que se via era a queda do proprio combo.
    */
    /*
      O ESPACO ENTRE O COMBO E O ARREMESSO E PREENCHIDO POR LUTA.

      Ele existe por uma razao tecnica: `golpear` escreve chaves do alvo ALEM
      do cursor que devolve -- o combo acima escreve ate bem depois de onde
      termina, e uma cena que comece antes disso tem as chaves descartadas em
      silencio pela amostragem, que percorre chaves em sequencia.

      A primeira solucao foi um `hold` de 190 quadros. Resolvia o descarte e
      criava outro problema: TRES SEGUNDOS E MEIO em que nada acontece, bem
      no ponto em que a luta deveria estar mais apertada. O tempo tem que ser
      gasto do mesmo jeito; so nao precisa ser gasto parado.
    */
    { type: "attack", attacker: "blue", target: "red", move: "punchFast" },
    { type: "attack", attacker: "red", target: "blue", move: "punch" },
    { type: "dodged", attacker: "blue", target: "red", move: "kickHigh", targetPoint: "head" },
    { type: "dodged", attacker: "red", target: "blue", move: "kickHigh", targetPoint: "head" },
    { type: "tecnica", tecnica: "arremessoNoParedao", gelo: "blue", fogo: "red" },

    // ---- 32-40: vermelho libera tudo ------------------------------------
    { type: "tecnica", tecnica: "liberarVermelho", gelo: "blue", fogo: "red" },

    // ---- 40-48: azul responde, e os dois colidem ------------------------
    { type: "tecnica", tecnica: "liberarAzul", gelo: "blue", fogo: "red" },
    /*
      AQUI HAVIA UM SEGUNDO `sumirEColidir`, IGUAL AO DA ABERTURA.

      A mesma tecnica, a mesma camera, as mesmas poses, 3,4 segundos --
      repetida a 36 segundos de distancia num video de 53. E o trecho ficava
      ainda mais exposto porque dele ate o fim nao ha nenhum golpe que
      conecte: medido, a luta inteira tem CINCO socos que acertam, e todos
      acontecem nos primeiros vinte segundos. O resto sao poderes.

      Depois de os dois liberarem tudo, o que falta ver e os dois LUTANDO com
      o que liberaram -- e nao a abertura de novo.
    */
    { type: "combo", attacker: "blue", target: "red", moves: ["punchFast", "elbow", "spinKick"] },
    { type: "attack", attacker: "red", target: "blue", move: "spinKick" },
    { type: "attack", attacker: "blue", target: "red", move: "punchHeavy" },
    { type: "attack", attacker: "blue", target: "red", move: "uppercut", targetPoint: "queixo" },

    // ---- 48-60: o choque de rajadas e os dois caídos --------------------
    // A técnica já termina com os dois no chão e a arena desmoronando.
    { type: "tecnica", tecnica: "choqueDeRajadas", gelo: "blue", fogo: "red" },
    /*
      A tentativa de levantar agora mora DENTRO da técnica (ela tem as poses e
      a câmera). O `hold` de 260 quadros que havia aqui virava 4,3 segundos
      sem nada mudar -- a maior pausa do vídeo, medida com scripts/ritmo.mts
      contra 1,2s da maior pausa da referência.
    */
    { type: "hold", duration: 40, label: "respiro final" },
  ],
};
