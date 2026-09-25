/**
 * EFEITOS SONOROS dos acontecimentos da luta, sintetizados aqui (originais,
 * sem amostra de terceiros). Cada acontecimento tem um som proprio, para o
 * ouvido reconhecer o que aconteceu sem precisar olhar o letreiro:
 *
 *   combo_N    "ding" de fliperama que SOBE de tom a cada golpe do combo
 *   esquiva    "fuip": assobio de ar descendo rapido
 *   contra     "shing": lamina metalica brilhante
 *   brutal     "braam": metal grave de trailer de cinema
 *   tensao     subida de tensao (ruido e tom subindo) antes do golpe final
 *   bloqueio   "tlim" de escudo por cima do som do bloqueio
 *
 * Uso: npx tsx scripts/compor-efeitos.mts
 * (grava em public/assets/audio/efeitos/*.wav)
 */

import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const TAXA = 44100;
const SAIDA = join(import.meta.dirname, "..", "public", "assets", "audio", "efeitos");
mkdirSync(SAIDA, { recursive: true });

let semente = 777;
const ruido = () => {
  semente = (semente * 1103515245 + 12345) & 0x7fffffff;
  return (semente / 0x7fffffff) * 2 - 1;
};

const gravar = (nome: string, s: Float32Array) => {
  let pico = 0;
  for (const v of s) pico = Math.max(pico, Math.abs(v));
  const g = 0.9 / (pico || 1);
  const b = Buffer.alloc(44 + s.length * 2);
  b.write("RIFF", 0);
  b.writeUInt32LE(36 + s.length * 2, 4);
  b.write("WAVE", 8);
  b.write("fmt ", 12);
  b.writeUInt32LE(16, 16);
  b.writeUInt16LE(1, 20);
  b.writeUInt16LE(1, 22);
  b.writeUInt32LE(TAXA, 24);
  b.writeUInt32LE(TAXA * 2, 28);
  b.writeUInt16LE(2, 32);
  b.writeUInt16LE(16, 34);
  b.write("data", 36);
  b.writeUInt32LE(s.length * 2, 40);
  for (let i = 0; i < s.length; i++) b.writeInt16LE(Math.round(s[i] * g * 32767), 44 + i * 2);
  writeFileSync(join(SAIDA, `${nome}.wav`), b);
  console.log(`${nome}.wav ${(s.length / TAXA).toFixed(2)}s`);
};

const buf = (seg: number) => new Float32Array(Math.ceil(seg * TAXA));
const nota = (midi: number) => 440 * Math.pow(2, (midi - 69) / 12);

// ---- combo: "ding" de fliperama, uma nota mais alta a cada golpe -------------
// pentatonica maior: sobe sempre soando "certo", como pontuacao de jogo
const ESCALA = [0, 2, 4, 7, 9, 12, 14, 16];
for (let n = 2; n <= 8; n++) {
  const s = buf(0.45);
  const f = nota(76 + ESCALA[Math.min(ESCALA.length - 1, n - 2)]);
  for (let i = 0; i < s.length; i++) {
    const t = i / TAXA;
    // duas notas rapidas (a segunda uma oitava acima): o "ding-ding" de moeda
    const segunda = t > 0.06;
    const ff = segunda ? f * 2 : f;
    const tt = segunda ? t - 0.06 : t;
    const env = Math.exp(-tt * (segunda ? 7 : 30));
    const onda = Math.sign(Math.sin(2 * Math.PI * ff * t)) * 0.5 + Math.sin(2 * Math.PI * ff * t) * 0.5;
    s[i] = onda * env * 0.6;
  }
  gravar(`combo_${n}`, s);
}

// ---- esquiva: assobio de ar descendo ----------------------------------------
{
  const s = buf(0.4);
  let lp = 0;
  let bp = 0;
  for (let i = 0; i < s.length; i++) {
    const t = i / TAXA;
    const k = t / 0.4;
    // filtro que desce de agudo para medio: o ar passando rente
    const corte = 0.5 * Math.exp(-k * 3.2) + 0.02;
    const n = ruido();
    lp += (n - lp) * corte;
    bp += (lp - bp) * corte * 0.8;
    const env = Math.sin(Math.PI * Math.min(1, k * 1.15)) ** 1.5;
    const assobio = Math.sin(2 * Math.PI * (2400 - 1500 * k) * t) * 0.18;
    s[i] = ((lp - bp) * 2.2 + assobio) * env;
  }
  gravar("esquiva", s);
}

// ---- contra-ataque: "shing" de lamina ---------------------------------------
{
  const s = buf(0.9);
  const parciais = [1, 2.76, 5.4, 8.93, 13.3].map((r) => 1150 * r);
  for (let i = 0; i < s.length; i++) {
    const t = i / TAXA;
    let v = 0;
    parciais.forEach((f, j) => {
      v += Math.sin(2 * Math.PI * f * t * (1 + 0.002 * Math.sin(t * 40))) * Math.exp(-t * (3 + j * 2.5)) / (j + 1);
    });
    // ataque de raspagem: ruido agudo curtissimo
    const raspa = t < 0.04 ? ruido() * (1 - t / 0.04) * 0.8 : 0;
    s[i] = v * 0.7 + raspa;
  }
  gravar("contra", s);
}

// ---- brutal: "braam" grave --------------------------------------------------
{
  const s = buf(1.6);
  const fs = [nota(33), nota(33) * 1.005, nota(40), nota(45)];
  let lp = 0;
  const fases = fs.map(() => 0);
  for (let i = 0; i < s.length; i++) {
    const t = i / TAXA;
    let v = 0;
    fs.forEach((f, j) => {
      fases[j] = (fases[j] + f / TAXA) % 1;
      v += 2 * fases[j] - 1;
    });
    // filtro abre no ataque e fecha devagar: o "bwaaah"
    const corte = 0.02 + 0.2 * Math.exp(-t * 3);
    lp += (v - lp) * corte;
    const env = Math.min(1, t / 0.02) * Math.exp(-t * 1.6);
    s[i] = Math.tanh(lp * 1.8) * env;
  }
  gravar("brutal", s);
}

// ---- tensao: subida antes do golpe final ------------------------------------
{
  const dur = 1.4;
  const s = buf(dur);
  let lp = 0;
  let fase = 0;
  for (let i = 0; i < s.length; i++) {
    const t = i / TAXA;
    const k = t / dur;
    const n = ruido();
    lp += (n - lp) * (0.02 + 0.5 * k * k);
    fase = (fase + (200 + 1400 * k * k) / TAXA) % 1;
    const tom = (2 * fase - 1) * 0.25;
    // cresce e corta seco no fim: o golpe entra no silencio
    const env = k * k * (k < 0.98 ? 1 : (1 - k) / 0.02);
    s[i] = (lp * 1.6 + tom) * env;
  }
  gravar("tensao", s);
}

// ---- bloqueio: "tlim" de escudo ---------------------------------------------
{
  const s = buf(0.5);
  const parciais = [1, 1.58, 2.41, 3.9].map((r) => 1700 * r);
  for (let i = 0; i < s.length; i++) {
    const t = i / TAXA;
    let v = 0;
    parciais.forEach((f, j) => {
      v += Math.sin(2 * Math.PI * f * t) * Math.exp(-t * (9 + j * 5)) / (j + 1);
    });
    s[i] = v;
  }
  gravar("bloqueio", s);
}
