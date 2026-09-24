/**
 * Registro de som, em CAMADAS.
 *
 * Um golpe nunca usa um som so. O briefing e explicito e a razao e acustica:
 * "POW" sozinho soa a desenho; o que faz parecer que algo bateu de verdade e a
 * soma de tres coisas em frequencias diferentes:
 *
 *   whoosh  (agudo, ANTES do contato)  = o ar sendo cortado
 *   impact  (medio, NO contato)        = a colisao
 *   low     (grave, NO contato)        = o corpo, o peso
 *
 * Cada camada tem volume proprio e um deslocamento em SEGUNDOS em relacao ao
 * quadro de contato. Deslocamento negativo = comeca antes do contato, que e o
 * caso do whoosh: ele tem que terminar quando o golpe encosta, senao o som
 * chega depois da imagem.
 *
 * Trocar um arquivo por gravacao de verdade nao exige mexer em nada aqui,
 * desde que o nome do arquivo seja o mesmo.
 */

import type { ImpactTier } from "../core/types";

export type CamadaDeSom = {
  /** caminho dentro de public/assets/audio */
  arquivo: string;
  /** 0 a 1 */
  volume: number;
  /**
   * Deslocamento em segundos em relacao ao quadro de CONTATO.
   * Negativo comeca antes; zero e exatamente no contato.
   */
  offset: number;
};

/** Um som composto: varias camadas tocadas juntas. */
export type SomComposto = CamadaDeSom[];

const A = "assets/audio";

/**
 * Sons por chave de golpe. A chave vem de AttackDef.sound, entao adicionar um
 * golpe com som novo e acrescentar uma entrada aqui.
 */
export const SONS: Record<string, SomComposto> = {
  /** soco medio: ar + colisao + um pouco de corpo */
  punch: [
    { arquivo: `${A}/whoosh/whoosh_medium.wav`, volume: 0.5, offset: -0.3 },
    { arquivo: `${A}/punches/punch_01.wav`, volume: 0.9, offset: 0 },
    { arquivo: `${A}/impacts/impact_light_01.wav`, volume: 0.55, offset: 0 },
  ],

  /** soco leve: mais agudo, sem grave, para contrastar com o pesado */
  punchLight: [
    { arquivo: `${A}/whoosh/whoosh_light.wav`, volume: 0.42, offset: -0.22 },
    { arquivo: `${A}/punches/punch_light_01.wav`, volume: 0.8, offset: 0 },
  ],

  /** chute: whoosh mais longo e corpo mais grave que o soco */
  kick: [
    { arquivo: `${A}/whoosh/whoosh_medium.wav`, volume: 0.55, offset: -0.3 },
    { arquivo: `${A}/kicks/kick_01.wav`, volume: 0.9, offset: 0 },
    { arquivo: `${A}/impacts/impact_body_01.wav`, volume: 0.6, offset: 0 },
  ],

  kickLight: [
    { arquivo: `${A}/whoosh/whoosh_light.wav`, volume: 0.45, offset: -0.22 },
    { arquivo: `${A}/kicks/kick_light_01.wav`, volume: 0.78, offset: 0 },
  ],

  /**
   * Golpe pesado: quatro camadas. O low_boom e o que da a sensacao de peso,
   * e ele entra um tiquinho DEPOIS do impacto de proposito: grave chega ao
   * ouvido como consequencia, nao como parte do estalo.
   */
  heavyHit: [
    { arquivo: `${A}/whoosh/whoosh_heavy.wav`, volume: 0.6, offset: -0.5 },
    { arquivo: `${A}/heavy/heavy_hit_01.wav`, volume: 0.95, offset: 0 },
    { arquivo: `${A}/impacts/impact_body_01.wav`, volume: 0.6, offset: 0 },
    { arquivo: `${A}/heavy/low_boom_01.wav`, volume: 0.85, offset: 0.02 },
  ],

  /** bloqueio: metalico e curto, sem grave. Nao e golpe limpo. */
  block: [
    { arquivo: `${A}/whoosh/whoosh_medium.wav`, volume: 0.4, offset: -0.3 },
    { arquivo: `${A}/impacts/block_01.wav`, volume: 0.9, offset: 0 },
  ],

  /** investida: so o ar, porque o contato dela e de ombro e nao de golpe */
  whoosh: [
    { arquivo: `${A}/whoosh/whoosh_heavy.wav`, volume: 0.65, offset: -0.4 },
    { arquivo: `${A}/impacts/impact_body_01.wav`, volume: 0.5, offset: 0 },
  ],

  /**
   * Finalizador: a pilha completa que o briefing pede. Whoosh longo, impacto
   * pesado, estalo do chao, grave, cascalho e o ronco de camera.
   */
  explosion: [
    { arquivo: `${A}/whoosh/whoosh_heavy.wav`, volume: 0.7, offset: -0.62 },
    { arquivo: `${A}/heavy/heavy_hit_01.wav`, volume: 1.0, offset: 0 },
    { arquivo: `${A}/debris/crack_01.wav`, volume: 0.7, offset: 0.01 },
    { arquivo: `${A}/heavy/low_boom_01.wav`, volume: 0.95, offset: 0.03 },
    { arquivo: `${A}/explosions/explosion_01.wav`, volume: 0.8, offset: 0.02 },
    { arquivo: `${A}/debris/debris_01.wav`, volume: 0.5, offset: 0.12 },
    { arquivo: `${A}/heavy/camera_rumble_01.wav`, volume: 0.6, offset: 0.02 },
  ],
};

/** Som de aura ligando, disparado pelos beats de powerUp. */
export const SOM_AURA: SomComposto = [
  { arquivo: `${A}/energy/aura_charge_01.wav`, volume: 0.6, offset: 0 },
  { arquivo: `${A}/energy/aura_burst_01.wav`, volume: 0.7, offset: 0.55 },
];

/**
 * Ambiente. Volume MUITO baixo de proposito: o briefing pede que nao compita
 * com os golpes, e ambiente alto e o erro mais comum de mixagem amadora.
 */
export const AMBIENTE: CamadaDeSom = {
  arquivo: `${A}/ambience/wind_low_01.wav`,
  volume: 0.16,
  offset: 0,
};

/**
 * Reforco do hit stop: um grave curto no meio do congelamento, que "sustenta"
 * o silencio visual. Sem ele o hit stop soa como travada de video.
 */
export const REFORCO_HITSTOP: Record<ImpactTier, CamadaDeSom | null> = {
  light: null,
  medium: null,
  extreme: {
    arquivo: `${A}/heavy/low_boom_01.wav`,
    volume: 0.4,
    offset: 0.04,
  },
};

// ---- ESPETACULO ------------------------------------------------------------
// Sons dos letreiros e das quedas (ver effects/espetaculo.ts). Offset em
// relacao ao quadro em que o letreiro aparece.

/** abertura: o ar cortando quando as placas entram e o grave do "VS" */
export const SOM_ABERTURA_VS: SomComposto = [
  { arquivo: `${A}/transitions/whoosh_transition_01.wav`, volume: 0.55, offset: -0.16 },
  { arquivo: `${A}/heavy/low_boom_01.wav`, volume: 0.75, offset: 0 },
  { arquivo: `${A}/impacts/impact_light_01.wav`, volume: 0.5, offset: 0 },
];

/** "LUTE!": uma pancada seca, o gongo da luta */
export const SOM_ABERTURA_LUTE: SomComposto = [
  { arquivo: `${A}/heavy/heavy_hit_01.wav`, volume: 0.55, offset: 0 },
  { arquivo: `${A}/heavy/low_boom_01.wav`, volume: 0.5, offset: 0.02 },
];

/** esquiva: o golpe que passa rente corta o ar e nao encosta em nada */
export const SOM_ESQUIVA: SomComposto = [
  { arquivo: `${A}/whoosh/whoosh_heavy.wav`, volume: 0.55, offset: -0.3 },
  { arquivo: `${A}/whoosh/whoosh_light.wav`, volume: 0.45, offset: -0.05 },
];

/** corpo batendo no chao: baque, grave e um pouco de cascalho */
export const SOM_QUEDA: SomComposto = [
  { arquivo: `${A}/impacts/impact_body_01.wav`, volume: 0.75, offset: 0 },
  { arquivo: `${A}/heavy/low_boom_01.wav`, volume: 0.5, offset: 0.01 },
  { arquivo: `${A}/debris/debris_01.wav`, volume: 0.3, offset: 0.03 },
];

/** nocaute: o grave que segura a camera lenta inteira */
export const SOM_KO: SomComposto = [
  { arquivo: `${A}/heavy/low_boom_01.wav`, volume: 0.9, offset: 0.1 },
  { arquivo: `${A}/heavy/camera_rumble_01.wav`, volume: 0.55, offset: 0.25 },
  { arquivo: `${A}/transitions/whoosh_transition_01.wav`, volume: 0.5, offset: 0.4 },
];

/** o nome do vencedor entrando */
export const SOM_VENCEDOR: SomComposto = [
  { arquivo: `${A}/transitions/whoosh_transition_01.wav`, volume: 0.55, offset: -0.1 },
  { arquivo: `${A}/heavy/heavy_hit_01.wav`, volume: 0.45, offset: 0 },
];

/**
 * BATIDA DO PASSINHO: um tamborzao simples montado com os sons que ja
 * existem (nao e a musica original, que tem direitos). Grave em todo tempo,
 * estalo no contratempo. Tocado no ritmo exato da danca (TEMPO_DA_DANCA).
 */
export const BATIDA_GRAVE: CamadaDeSom = {
  arquivo: `${A}/heavy/low_boom_01.wav`,
  volume: 0.55,
  offset: 0,
};
export const BATIDA_ESTALO: CamadaDeSom = {
  arquivo: `${A}/punches/punch_light_01.wav`,
  volume: 0.4,
  offset: 0,
};

/** a mao vai buscar a placa: o ar cortando */
export const SOM_BUSCA_PLACA: SomComposto = [
  { arquivo: `${A}/whoosh/whoosh_medium.wav`, volume: 0.55, offset: 0 },
];

/** a placa sai de tras e chega no alto: puxao, pancada e grave */
export const SOM_PLACA: SomComposto = [
  { arquivo: `${A}/whoosh/whoosh_heavy.wav`, volume: 0.65, offset: -0.2 },
  { arquivo: `${A}/heavy/heavy_hit_01.wav`, volume: 0.6, offset: 0 },
  { arquivo: `${A}/heavy/low_boom_01.wav`, volume: 0.7, offset: 0.02 },
  { arquivo: `${A}/impacts/impact_light_01.wav`, volume: 0.5, offset: 0.05 },
];

/**
 * TRILHA DE FUNDO: batalha no estilo anime, ORIGINAL (composta por
 * scripts/compor-trilha.mts, sem trecho de musica de terceiros), no mesmo
 * andamento da danca.
 *
 * Volume baixo de proposito e com "ducking" (ver FightAudio): em cada golpe
 * ela abaixa por um instante para o impacto passar por cima. Trilha que
 * compete com o soco tira o peso do soco.
 */
export const TRILHA = {
  arquivo: `${A}/music/batalha_anime_01.mp3`,
  // Medido: o soco tem RMS de ~0,025 nos 80ms do impacto e a trilha 0,26.
  // A 0,11 a trilha fica em ~0,029 e, abaixada no golpe, em ~0,009: o
  // impacto passa uns 8 dB por cima dela.
  volume: 0.11,
  /** quanto sobra da trilha no instante do golpe (0.3 = cai para 30%) */
  duckNoGolpe: 0.3,
  /** quadros ANTES do contato em que ela ja comeca a abaixar (o whoosh) */
  antecipacao: 10,
  /** quadros para voltar ao volume normal depois do golpe */
  retorno: 24,
};

/** volume do narrador e quanto a trilha abaixa enquanto ele fala */
export const NARRADOR = { volume: 0.6, trilhaSobFala: 0.45 };
