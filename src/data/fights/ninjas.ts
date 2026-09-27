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
  /*
    O vale destruído ainda não existe como cenário próprio; `noite` é o mais
    perto que o motor tem -- céu escuro, chuva e piso que aceita rachadura.
    A montanha do beat 25-32 fica por fazer.
  */
  scenario: "noite",
  // silhueta mais aberta e timing mais agressivo: é o que o roteiro pede na
  // direção ("antecipação, poses fortes, aceleração"). Ver animation/estilo.
  // anime traz `quadrosPorDesenho: 2` -- a pose segura por dois quadros, que e
  // o que aproxima da animacao desenhada a mao (ver animation/estilo.ts)
  estilo: "anime",
  nomes: { blue: "AZUL", red: "VERMELHO" },
  poderes: { blue: "VAZIO", red: "CHAMA" },
  cinematico: true,
  beats: [
    // ---- 0-5: encaram, somem, colidem -----------------------------------
    { type: "tecnica", tecnica: "sumirEColidir", gelo: "blue", fogo: "red" },

    // ---- 5-12: corpo a corpo --------------------------------------------
    // A troca alterna quem acerta e quem defende: sequência em que só um
    // conecta decide a luta cedo, e este trecho existe para empatar.
    { type: "attack", attacker: "red", target: "blue", move: "punchFast" },
    { type: "blocked", attacker: "blue", target: "red", move: "punch" },
    { type: "dodged", attacker: "red", target: "blue", move: "kickHigh", targetPoint: "head" },
    { type: "combo", attacker: "blue", target: "red", moves: ["punchFast", "punch", "knee"], final: "blocked" },
    { type: "attack", attacker: "red", target: "blue", move: "elbow" },
    { type: "dodged", attacker: "blue", target: "red", move: "kickLow", targetPoint: "legs", pulo: true },

    // ---- 12-18: lança para o alto e persegue ----------------------------
    { type: "attack", attacker: "red", target: "blue", move: "uppercut", targetPoint: "queixo" },
    { type: "airborne", who: "red", duration: 46 },
    { type: "attack", attacker: "blue", target: "red", move: "airAttack" },

    // ---- 18-25: a esfera do azul ----------------------------------------
    { type: "tecnica", tecnica: "azulVermelho", gelo: "blue", fogo: "red" },

    // ---- 25-32: combo aéreo, azul arremessado ---------------------------
    { type: "combo", attacker: "red", target: "blue", moves: ["punchFast", "knee", "spinKick"] },
    { type: "knockback", who: "blue", distance: 760, duration: 40 },

    // ---- 32-40: vermelho libera tudo ------------------------------------
    { type: "tecnica", tecnica: "liberarVermelho", gelo: "blue", fogo: "red" },

    // ---- 40-48: azul responde, e os dois colidem ------------------------
    { type: "tecnica", tecnica: "liberarAzul", gelo: "blue", fogo: "red" },
    { type: "tecnica", tecnica: "sumirEColidir", gelo: "blue", fogo: "red" },

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
