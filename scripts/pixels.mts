/**
 * Medicao no PIXEL do MP4 renderizado.
 *
 * A diretiva e clara: o MP4 e a fonte da verdade, e nao os calculos. Mas olhar
 * miniatura tambem engana: eu acabei de "ver" pes flutuando numa tira que
 * mentia, porque a camera muda de zoom e a linha do chao muda de altura dentro
 * do corte.
 *
 * Este script le os pixels do video de verdade e responde com numero:
 *
 *   - onde esta a linha do chao (a faixa de luz do horizonte);
 *   - qual o pixel mais baixo de cada lutador;
 *   - logo, a folga entre o pe e o chao, EM PIXELS DA TELA.
 *
 * Uso: npx tsx scripts/pixels.mts out/um-soco.mp4 [quadros...]
 */

import { execFileSync } from "node:child_process";
import { PRESETS } from "../src/characters/presets";

const arquivo = process.argv[2] ?? "out/um-soco.mp4";
const quadros = process.argv.slice(3).map(Number);

const LARGURA = 540;
const ALTURA = 960;

/** cor da faixa de luz do horizonte, definida em backgrounds/Arena.tsx */
const HORIZONTE = [0x33, 0x3a, 0x4e];

const hexPara = (hex: string) => [
  parseInt(hex.slice(1, 3), 16),
  parseInt(hex.slice(3, 5), 16),
  parseInt(hex.slice(5, 7), 16),
];

/** Escurece igual a Stickman.escurecer, para achar tambem o membro de tras. */
const escurecer = (c: number[], f: number) => c.map((v) => Math.round(v * f));

const perto = (a: number[], b: number[], tol: number) =>
  Math.abs(a[0] - b[0]) <= tol &&
  Math.abs(a[1] - b[1]) <= tol &&
  Math.abs(a[2] - b[2]) <= tol;

const quadro = (n: number): Buffer =>
  execFileSync(
    "ffmpeg",
    ["-v", "error", "-i", arquivo,
     "-vf", `select=eq(n\\,${n}),scale=${LARGURA}:${ALTURA}`,
     "-vsync", "0", "-frames:v", "1",
     "-f", "rawvideo", "-pix_fmt", "rgb24", "-"],
    { maxBuffer: 64 * 1024 * 1024 },
  );

const analisar = (n: number) => {
  const buf = quadro(n);
  if (buf.length < LARGURA * ALTURA * 3) {
    console.log(`  f${n}: quadro nao lido`);
    return;
  }
  const px = (x: number, y: number) => {
    const i = (y * LARGURA + x) * 3;
    return [buf[i], buf[i + 1], buf[i + 2]];
  };

  // linha do chao: a linha com mais pixels da cor do horizonte
  let chao = -1;
  let melhor = 0;
  for (let y = 0; y < ALTURA; y++) {
    let n2 = 0;
    for (let x = 0; x < LARGURA; x += 3) {
      if (perto(px(x, y), HORIZONTE, 26)) n2++;
    }
    if (n2 > melhor) {
      melhor = n2;
      chao = y;
    }
  }
  if (chao < 0 || melhor < LARGURA / 12) {
    console.log(`  f${n}: linha do chao nao encontrada`);
    return;
  }

  const saida: string[] = [];
  for (const id of ["black", "red"] as const) {
    const cor = hexPara(PRESETS[id].stroke);
    const tras = escurecer(cor, 0.8);
    let maisBaixo = -1;
    for (let y = ALTURA - 1; y >= 0; y--) {
      for (let x = 0; x < LARGURA; x++) {
        const p = px(x, y);
        if (perto(p, cor, 20) || perto(p, tras, 20)) {
          maisBaixo = y;
          break;
        }
      }
      if (maisBaixo >= 0) break;
    }
    if (maisBaixo < 0) {
      saida.push(`${id}: nao visivel`);
      continue;
    }
    // o membro e um traco de ponta redonda: o pe "encosta" quando o pixel mais
    // baixo passa da linha do chao por cerca de meia espessura
    const folga = maisBaixo - chao;
    const estado =
      folga >= -4 ? "no chao" : `FLUTUA ${Math.abs(folga)}px`;
    saida.push(`${id}: ${estado}`);
  }
  console.log(`  f${String(n).padStart(3)}  chao y=${chao}  ${saida.join("  |  ")}`);
};

const lista = quadros.length > 0 ? quadros : [4, 10, 16, 22, 28, 34, 40, 46, 52, 60, 70, 80];
console.log(`${arquivo} (amostrado em ${LARGURA}x${ALTURA})`);
for (const n of lista) analisar(n);
