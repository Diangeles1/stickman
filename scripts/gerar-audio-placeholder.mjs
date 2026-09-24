/**
 * Gera sons PLACEHOLDER sinteticos com ffmpeg.
 *
 * POR QUE: o sistema de audio precisa ser testavel agora. Placeholder vazio
 * nao permite verificar sincronia; som sintetizado permite. Cada arquivo tem a
 * duracao e o carater aproximados do som final, entao a sincronia que eu
 * validar agora continua valendo quando voce trocar por gravacao de verdade.
 *
 * Substituir depois: basta sobrescrever o arquivo com mesmo nome. A logica da
 * animacao nao muda nada.
 *
 * Uso: node scripts/gerar-audio-placeholder.mjs
 */

import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const raiz = join(dirname(fileURLToPath(import.meta.url)), "..");
const base = join(raiz, "public", "assets", "audio");

/**
 * Cada som e descrito por um filtro do ffmpeg.
 *
 * whoosh  = ruido filtrado com envelope crescente (ar cortado)
 * punch   = clique curto com corpo medio
 * heavy   = impacto com frequencia baixa (o "corpo" que o briefing pede)
 * boom    = sub-grave, quase so sentido
 * crack   = estalo seco e curto
 * debris  = ruido decaindo longo (cascalho)
 * energy  = tom subindo (aura carregando)
 * ambience = ruido grave continuo
 */
const SONS = [
  // --- whoosh: ar cortado, envelope crescente ---
  ["whoosh/whoosh_light.wav", 0.22,
    "anoisesrc=c=pink:r=48000:a=0.5,highpass=f=700,lowpass=f=5000,afade=t=in:st=0:d=0.16:curve=exp,afade=t=out:st=0.17:d=0.05"],
  ["whoosh/whoosh_medium.wav", 0.3,
    "anoisesrc=c=pink:r=48000:a=0.62,highpass=f=450,lowpass=f=4200,afade=t=in:st=0:d=0.22:curve=exp,afade=t=out:st=0.24:d=0.06"],
  ["whoosh/whoosh_heavy.wav", 0.5,
    "anoisesrc=c=brown:r=48000:a=0.72,highpass=f=220,lowpass=f=3000,afade=t=in:st=0:d=0.38:curve=exp,afade=t=out:st=0.4:d=0.1"],

  // --- punches ---
  ["punches/punch_01.wav", 0.16,
    "anoisesrc=c=white:r=48000:a=0.8,lowpass=f=2200,highpass=f=160,afade=t=out:st=0:d=0.15:curve=exp"],
  ["punches/punch_light_01.wav", 0.1,
    "anoisesrc=c=white:r=48000:a=0.6,lowpass=f=3200,highpass=f=300,afade=t=out:st=0:d=0.09:curve=exp"],

  // --- kicks ---
  ["kicks/kick_01.wav", 0.2,
    "anoisesrc=c=brown:r=48000:a=0.85,lowpass=f=1500,highpass=f=110,afade=t=out:st=0:d=0.19:curve=exp"],
  ["kicks/kick_light_01.wav", 0.13,
    "anoisesrc=c=white:r=48000:a=0.6,lowpass=f=2600,highpass=f=220,afade=t=out:st=0:d=0.12:curve=exp"],

  // --- impacts ---
  ["impacts/impact_light_01.wav", 0.14,
    "anoisesrc=c=white:r=48000:a=0.5,lowpass=f=2800,afade=t=out:st=0:d=0.13:curve=exp"],
  ["impacts/impact_body_01.wav", 0.26,
    "anoisesrc=c=brown:r=48000:a=0.8,lowpass=f=1100,afade=t=out:st=0:d=0.25:curve=exp"],
  ["impacts/block_01.wav", 0.15,
    "anoisesrc=c=white:r=48000:a=0.7,highpass=f=900,lowpass=f=6000,afade=t=out:st=0:d=0.14:curve=exp"],

  // --- heavy: o corpo do golpe forte ---
  ["heavy/heavy_hit_01.wav", 0.42,
    "anoisesrc=c=brown:r=48000:a=0.95,lowpass=f=900,afade=t=out:st=0:d=0.4:curve=exp"],
  ["heavy/low_boom_01.wav", 0.7,
    "sine=frequency=52:r=48000,volume=0.9,afade=t=out:st=0.04:d=0.64:curve=exp"],
  ["heavy/camera_rumble_01.wav", 0.9,
    "anoisesrc=c=brown:r=48000:a=0.5,lowpass=f=140,afade=t=in:st=0:d=0.05,afade=t=out:st=0.2:d=0.68"],

  // --- energy: aura ---
  ["energy/aura_charge_01.wav", 1.1,
    "sine=frequency=110:r=48000,volume=0.5,afade=t=in:st=0:d=0.5,afade=t=out:st=0.8:d=0.3"],
  ["energy/aura_burst_01.wav", 0.55,
    "anoisesrc=c=violet:r=48000:a=0.6,highpass=f=300,afade=t=out:st=0:d=0.53:curve=exp"],

  // --- explosions ---
  ["explosions/explosion_01.wav", 1.0,
    "anoisesrc=c=brown:r=48000:a=1.0,lowpass=f=1400,afade=t=out:st=0.02:d=0.95:curve=exp"],

  // --- debris ---
  ["debris/debris_01.wav", 1.2,
    "anoisesrc=c=white:r=48000:a=0.35,highpass=f=1200,lowpass=f=9000,afade=t=in:st=0:d=0.06,afade=t=out:st=0.2:d=0.98"],
  ["debris/crack_01.wav", 0.24,
    "anoisesrc=c=white:r=48000:a=0.8,highpass=f=1400,lowpass=f=7000,afade=t=out:st=0:d=0.22:curve=exp"],

  // --- ambience: grave continuo, nao deve competir com os golpes ---
  ["ambience/wind_low_01.wav", 12.0,
    "anoisesrc=c=brown:r=48000:a=0.28,lowpass=f=420,afade=t=in:st=0:d=2,afade=t=out:st=10:d=2"],

  // --- transitions ---
  ["transitions/whoosh_transition_01.wav", 0.6,
    "anoisesrc=c=pink:r=48000:a=0.55,highpass=f=280,afade=t=in:st=0:d=0.3:curve=exp,afade=t=out:st=0.34:d=0.24"],
];

let criados = 0;
let existentes = 0;

for (const [caminho, duracao, filtro] of SONS) {
  const destino = join(base, caminho);
  mkdirSync(dirname(destino), { recursive: true });

  // NAO sobrescreve: se voce trocou por um som de verdade, ele fica
  if (existsSync(destino)) {
    existentes++;
    continue;
  }

  execFileSync("ffmpeg", [
    "-y", "-loglevel", "error",
    "-f", "lavfi", "-i", `${filtro}`,
    "-t", String(duracao),
    "-ac", "2", "-ar", "48000",
    destino,
  ]);
  criados++;
}

console.log(`placeholders criados: ${criados} | preservados: ${existentes}`);
console.log(`pasta: ${base}`);
console.log("Para trocar por som de verdade: sobrescreva o arquivo. Nada no codigo muda.");
