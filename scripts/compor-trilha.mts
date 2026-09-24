/**
 * COMPOE A TRILHA de fundo: batalha no estilo anime, original, sem direitos
 * de terceiros. Tudo sintetizado aqui, amostra por amostra: nenhum trecho de
 * musica existente entra.
 *
 * Estilo: rock de batalha de anime. Bateria acelerada, baixo em colcheias,
 * "guitarra" em power chords (serra distorcida) e uma melodia heroica em la
 * menor sobre a progressao i-VI-III-VII (Am-F-C-G), a mais usada em abertura
 * de anime de luta.
 *
 * Andamento: o MESMO da danca da vitoria (TEMPO_DA_DANCA = 22 quadros a
 * 60fps, ~164 bpm). Assim a batida da danca cai em cima da batida da musica.
 *
 * Uso:
 *   npx tsx scripts/compor-trilha.mts saida.wav
 *   (depois converter para mp3 em public/assets/audio/music)
 */

import { writeFileSync } from "node:fs";

const TAXA = 44100;
const BPM = (60 * 60) / 22; // 163,6: o tempo da danca
const TEMPO = 60 / BPM; // segundos por tempo
const COMPASSO = TEMPO * 4;
const COMPASSOS = 24;
const DURACAO = COMPASSOS * COMPASSO + 2;
const N = Math.ceil(DURACAO * TAXA);

const esq = new Float32Array(N);
const dir = new Float32Array(N);

// ruido deterministico: a mesma trilha sempre
let semente = 12345;
const ruido = () => {
  semente = (semente * 1103515245 + 12345) & 0x7fffffff;
  return (semente / 0x7fffffff) * 2 - 1;
};

const freq = (midi: number) => 440 * Math.pow(2, (midi - 69) / 12);
const NOTA: Record<string, number> = {
  C: 0, "C#": 1, D: 2, "D#": 3, E: 4, F: 5, "F#": 6, G: 7, "G#": 8, A: 9, "A#": 10, B: 11,
};
/** "A4" -> midi */
const m = (n: string) => {
  const nome = n.slice(0, -1);
  const oitava = Number(n.slice(-1));
  return 12 * (oitava + 1) + NOTA[nome];
};

/** soma um sinal mono no mix, com panorama (-1 esquerda, 1 direita) */
const somar = (inicio: number, amostras: Float32Array, vol: number, pan = 0) => {
  const i0 = Math.floor(inicio * TAXA);
  const ge = vol * Math.sqrt((1 - pan) / 2);
  const gd = vol * Math.sqrt((1 + pan) / 2);
  for (let i = 0; i < amostras.length; i++) {
    const k = i0 + i;
    if (k < 0 || k >= N) continue;
    esq[k] += amostras[i] * ge;
    dir[k] += amostras[i] * gd;
  }
};

const buffer = (seg: number) => new Float32Array(Math.ceil(seg * TAXA));

// ---- instrumentos ----------------------------------------------------------

const bumbo = (): Float32Array => {
  const b = buffer(0.35);
  let fase = 0;
  for (let i = 0; i < b.length; i++) {
    const t = i / TAXA;
    const f = 45 + 110 * Math.exp(-t * 28);
    fase += (2 * Math.PI * f) / TAXA;
    const clique = t < 0.004 ? ruido() * (1 - t / 0.004) * 0.6 : 0;
    b[i] = Math.tanh(1.8 * Math.sin(fase) * Math.exp(-t * 9)) + clique;
  }
  return b;
};

const caixa = (): Float32Array => {
  const b = buffer(0.25);
  let lp = 0;
  for (let i = 0; i < b.length; i++) {
    const t = i / TAXA;
    const n = ruido();
    lp += (n - lp) * 0.35;
    const corpo = Math.sin(2 * Math.PI * 190 * t) * Math.exp(-t * 30);
    b[i] = (n - lp * 0.5) * Math.exp(-t * 17) * 0.8 + corpo * 0.6;
  }
  return b;
};

const chimbal = (aberto = false): Float32Array => {
  const b = buffer(aberto ? 0.3 : 0.06);
  let lp = 0;
  for (let i = 0; i < b.length; i++) {
    const t = i / TAXA;
    const n = ruido();
    lp += (n - lp) * 0.2;
    b[i] = (n - lp) * Math.exp(-t * (aberto ? 12 : 70));
  }
  return b;
};

const prato = (): Float32Array => {
  const b = buffer(2.2);
  let lp = 0;
  for (let i = 0; i < b.length; i++) {
    const t = i / TAXA;
    const n = ruido();
    lp += (n - lp) * 0.15;
    b[i] = (n - lp) * Math.exp(-t * 2.2);
  }
  return b;
};

/** serra com filtro passa-baixa de um polo */
const serra = (f: number, seg: number, corte: number, ataque = 0.005, soltura = 0.05) => {
  const b = buffer(seg);
  let fase = 0;
  let lp = 0;
  const a = 1 - Math.exp((-2 * Math.PI * corte) / TAXA);
  for (let i = 0; i < b.length; i++) {
    const t = i / TAXA;
    fase = (fase + f / TAXA) % 1;
    const s = 2 * fase - 1;
    lp += (s - lp) * a;
    const env = Math.min(1, t / ataque) * Math.min(1, (seg - t) / soltura);
    b[i] = lp * Math.max(0, env);
  }
  return b;
};

const baixo = (midi: number, seg: number) => {
  const b = serra(freq(midi), seg, 420, 0.004, 0.03);
  for (let i = 0; i < b.length; i++) b[i] = Math.tanh(b[i] * 1.6);
  return b;
};

/** power chord: fundamental + quinta + oitava, desafinadas e distorcidas */
const guitarra = (midi: number, seg: number, abafada: boolean) => {
  const b = buffer(seg);
  const notas = [midi, midi + 7, midi + 12];
  for (const n of notas) {
    for (const d of [-0.08, 0.08]) {
      const s = serra(freq(n) * Math.pow(2, d / 12), seg, abafada ? 900 : 2600, 0.003, 0.03);
      for (let i = 0; i < b.length; i++) b[i] += s[i];
    }
  }
  for (let i = 0; i < b.length; i++) {
    const t = i / TAXA;
    const env = abafada ? Math.exp(-t * 14) : 1;
    b[i] = Math.tanh(b[i] * 2.4) * env;
  }
  return b;
};

/** lider: serra + quadrada com vibrato, o "sintetizador heroico" */
const lider = (midi: number, seg: number) => {
  const b = buffer(seg + 0.08);
  let f1 = 0;
  let f2 = 0;
  let lp = 0;
  const f = freq(midi);
  for (let i = 0; i < b.length; i++) {
    const t = i / TAXA;
    const vib = 1 + 0.006 * Math.sin(2 * Math.PI * 5.5 * t) * Math.min(1, t / 0.15);
    f1 = (f1 + (f * vib) / TAXA) % 1;
    f2 = (f2 + (f * vib * 1.004) / TAXA) % 1;
    const s = (2 * f1 - 1) * 0.6 + (f2 < 0.5 ? 0.5 : -0.5);
    lp += (s - lp) * 0.25;
    const env = Math.min(1, t / 0.01) * (t > seg ? Math.max(0, 1 - (t - seg) / 0.08) : 1);
    b[i] = lp * env;
  }
  return b;
};

// ---- partitura --------------------------------------------------------------

const BUMBO = bumbo();
const CAIXA = caixa();
const CHIMBAL = chimbal();
const CHIMBAL_ABERTO = chimbal(true);
const PRATO = prato();

// Am F C G: fundamental de cada compasso (baixo e guitarra)
const ACORDES = ["A2", "F2", "C3", "G2"].map(m);

// melodia de 8 compassos: [nota, duracao em tempos]
const MELODIA: [string, number][][] = [
  [["A4", 1], ["C5", 0.5], ["E5", 0.5], ["A5", 1.5], ["G5", 0.5]],
  [["F5", 1], ["E5", 0.5], ["C5", 0.5], ["A4", 2]],
  [["G4", 0.5], ["C5", 0.5], ["E5", 1], ["G5", 1], ["E5", 1]],
  [["D5", 1], ["G5", 1], ["B5", 1], ["D6", 1]],
  [["E6", 1.5], ["D6", 0.5], ["C6", 1], ["B5", 1]],
  [["A5", 1], ["C6", 1], ["F5", 2]],
  [["G5", 1], ["E5", 1], ["C6", 1], ["G5", 1]],
  [["B5", 1], ["D6", 1], ["E6", 2]],
];

for (let c = 0; c < COMPASSOS; c++) {
  const t0 = c * COMPASSO;
  const raiz = ACORDES[c % 4];
  const intro = c < 2;
  // secoes: intro (2), A (8), A' (8, melodia uma oitava acima nos 4 finais),
  // final (6, repete A)
  if (c === 0 || c === 2 || c === 10 || c === 18) somar(t0, PRATO, 0.35, -0.3);

  // BATERIA
  for (let k = 0; k < 8; k++) {
    const t = t0 + (k * TEMPO) / 2;
    if (intro) {
      // intro: so pancadas no tempo 1 e uma virada de caixa no fim
      if (k === 0) somar(t, BUMBO, 0.9);
      if (c === 1 && k >= 4) {
        somar(t, CAIXA, 0.45 + k * 0.05, 0.1);
        somar(t + TEMPO / 4, CAIXA, 0.4 + k * 0.05, 0.1);
      }
      continue;
    }
    // bumbo: 1, "e" do 2, 3, com dobra no fim do compasso
    if (k === 0 || k === 3 || k === 4 || (k === 7 && c % 2 === 1)) somar(t, BUMBO, 0.95);
    if (k === 2 || k === 6) somar(t, CAIXA, 0.7, 0.1);
    somar(t, k % 2 === 1 ? CHIMBAL_ABERTO : CHIMBAL, k % 2 === 1 ? 0.12 : 0.18, 0.4);
    somar(t + TEMPO / 4, CHIMBAL, 0.1, 0.4);
  }

  // BAIXO e GUITARRA em colcheias
  for (let k = 0; k < 8; k++) {
    const t = t0 + (k * TEMPO) / 2;
    const nota = raiz + (k === 3 || k === 7 ? 12 : 0);
    if (intro) {
      if (k === 0) {
        somar(t, baixo(raiz, COMPASSO * 0.9), 0.35);
        somar(t, guitarra(raiz + 12, COMPASSO * 0.9, false), 0.1, -0.5);
        somar(t, guitarra(raiz + 12, COMPASSO * 0.9, false), 0.1, 0.5);
      }
      continue;
    }
    somar(t, baixo(nota, TEMPO * 0.45), 0.32);
    const aberta = k === 0;
    const g = guitarra(raiz + 12, aberta ? TEMPO * 1.4 : TEMPO * 0.42, !aberta);
    somar(t, g, aberta ? 0.1 : 0.075, -0.55);
    somar(t, g, aberta ? 0.1 : 0.075, 0.55);
  }

  // MELODIA
  if (!intro) {
    const frase = MELODIA[(c - 2) % 8];
    const oitava = c >= 14 && c < 18 ? 12 : 0;
    let t = t0;
    for (const [n, d] of frase) {
      const s = lider(m(n) + oitava, d * TEMPO * 0.95);
      somar(t, s, 0.16, 0);
      // eco: da largura sem embolar
      somar(t + TEMPO * 0.75, s, 0.05, -0.6);
      somar(t + TEMPO * 1.5, s, 0.03, 0.6);
      t += d * TEMPO;
    }
  }
}

// final: acorde de Am segurado com prato
{
  const t = COMPASSOS * COMPASSO;
  somar(t, PRATO, 0.4);
  somar(t, BUMBO, 0.9);
  somar(t, baixo(ACORDES[0], 1.6), 0.35);
  somar(t, guitarra(ACORDES[0] + 12, 1.8, false), 0.12, -0.5);
  somar(t, guitarra(ACORDES[0] + 12, 1.8, false), 0.12, 0.5);
}

// ---- master: normaliza e grava WAV 16 bits ---------------------------------
let pico = 0;
for (let i = 0; i < N; i++) pico = Math.max(pico, Math.abs(esq[i]), Math.abs(dir[i]));
const ganho = 0.89 / pico;
const dados = Buffer.alloc(44 + N * 4);
dados.write("RIFF", 0);
dados.writeUInt32LE(36 + N * 4, 4);
dados.write("WAVE", 8);
dados.write("fmt ", 12);
dados.writeUInt32LE(16, 16);
dados.writeUInt16LE(1, 20);
dados.writeUInt16LE(2, 22);
dados.writeUInt32LE(TAXA, 24);
dados.writeUInt32LE(TAXA * 4, 28);
dados.writeUInt16LE(4, 32);
dados.writeUInt16LE(16, 34);
dados.write("data", 36);
dados.writeUInt32LE(N * 4, 40);
for (let i = 0; i < N; i++) {
  // leve saturacao no master: cola o mix como uma trilha gravada
  const e = Math.tanh(esq[i] * ganho * 1.2) / Math.tanh(1.2);
  const d = Math.tanh(dir[i] * ganho * 1.2) / Math.tanh(1.2);
  dados.writeInt16LE(Math.round(e * 32767), 44 + i * 4);
  dados.writeInt16LE(Math.round(d * 32767), 46 + i * 4);
}
const saida = process.argv[2] ?? "trilha.wav";
writeFileSync(saida, dados);
console.log(`${saida}: ${DURACAO.toFixed(1)}s, ${BPM.toFixed(1)} bpm`);
