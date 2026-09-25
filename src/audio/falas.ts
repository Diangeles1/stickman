/**
 * Falas do narrador, geradas por scripts/narrar.py (Kokoro, voz
 * pm_santa). NAO editar a mao: rode o script de novo.
 */

export const FALAS = {
  "escolha": {
    "arquivo": "assets/audio/narrador/escolha.wav",
    "segundos": 1.555,
    "texto": "Rápido, escolha um personagem!"
  },
  "tres": {
    "arquivo": "assets/audio/narrador/tres.wav",
    "segundos": 0.438,
    "texto": "Três!"
  },
  "dois": {
    "arquivo": "assets/audio/narrador/dois.wav",
    "segundos": 0.337,
    "texto": "Dois!"
  },
  "um": {
    "arquivo": "assets/audio/narrador/um.wav",
    "segundos": 0.398,
    "texto": "Um!"
  },
  "lutem": {
    "arquivo": "assets/audio/narrador/lutem.wav",
    "segundos": 0.641,
    "texto": "Lutem!"
  },
  "nocaute": {
    "arquivo": "assets/audio/narrador/nocaute.wav",
    "segundos": 0.676,
    "texto": "Nocaute!"
  },
  "venceu_black": {
    "arquivo": "assets/audio/narrador/venceu_black.wav",
    "segundos": 1.025,
    "texto": "O Preto venceu!"
  },
  "venceu_red": {
    "arquivo": "assets/audio/narrador/venceu_red.wav",
    "segundos": 1.149,
    "texto": "O Vermelho venceu!"
  },
  "like": {
    "arquivo": "assets/audio/narrador/like.wav",
    "segundos": 1.597,
    "texto": "Dá like e se inscreve no canal!"
  },
  "quem": {
    "arquivo": "assets/audio/narrador/quem.wav",
    "segundos": 1.238,
    "texto": "Quem deve vencer?"
  }
} as const;

export type Fala = keyof typeof FALAS;
