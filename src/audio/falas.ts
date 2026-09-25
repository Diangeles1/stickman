/**
 * Falas do narrador, geradas por scripts/narrar.py (Kokoro, voz
 * pm_santa). NAO editar a mao: rode o script de novo.
 */

export const FALAS = {
  "escolha": {
    "arquivo": "assets/audio/narrador/escolha.wav",
    "segundos": 2.074,
    "texto": "Rápido, escolha um personagem!"
  },
  "tres": {
    "arquivo": "assets/audio/narrador/tres.wav",
    "segundos": 0.535,
    "texto": "Três!"
  },
  "dois": {
    "arquivo": "assets/audio/narrador/dois.wav",
    "segundos": 0.466,
    "texto": "Dois!"
  },
  "um": {
    "arquivo": "assets/audio/narrador/um.wav",
    "segundos": 0.45,
    "texto": "Um!"
  },
  "lutem": {
    "arquivo": "assets/audio/narrador/lutem.wav",
    "segundos": 0.787,
    "texto": "Lutem!"
  },
  "combo": {
    "arquivo": "assets/audio/narrador/combo.wav",
    "segundos": 0.844,
    "texto": "Que combo!"
  },
  "desviou": {
    "arquivo": "assets/audio/narrador/desviou.wav",
    "segundos": 0.823,
    "texto": "Desviou!"
  },
  "contra": {
    "arquivo": "assets/audio/narrador/contra.wav",
    "segundos": 1.074,
    "texto": "Contra-ataque!"
  },
  "pancada": {
    "arquivo": "assets/audio/narrador/pancada.wav",
    "segundos": 0.972,
    "texto": "Que pancada!"
  },
  "agora": {
    "arquivo": "assets/audio/narrador/agora.wav",
    "segundos": 0.808,
    "texto": "É agora!"
  },
  "nocaute": {
    "arquivo": "assets/audio/narrador/nocaute.wav",
    "segundos": 0.85,
    "texto": "Nocaute!"
  },
  "venceu_black": {
    "arquivo": "assets/audio/narrador/venceu_black.wav",
    "segundos": 1.293,
    "texto": "O Preto venceu!"
  },
  "venceu_red": {
    "arquivo": "assets/audio/narrador/venceu_red.wav",
    "segundos": 1.337,
    "texto": "O Vermelho venceu!"
  },
  "like": {
    "arquivo": "assets/audio/narrador/like.wav",
    "segundos": 1.995,
    "texto": "Dá like e se inscreve no canal!"
  }
} as const;

export type Fala = keyof typeof FALAS;
