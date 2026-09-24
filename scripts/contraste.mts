/**
 * Medidor de contraste.
 *
 * Varre um quadro renderizado, agrupa as cores presentes e calcula a razao de
 * contraste WCAG de cada uma contra a cor mais frequente (que num quadro
 * destes e sempre o fundo).
 *
 * Existe porque "esta escuro demais" e uma impressao, e impressao nao diz
 * quanto falta nem quando parar de mexer. Varre a imagem inteira de proposito:
 * escolher pixel na mao ja me fez medir o contorno achando que era o braco.
 *
 * Referencia: forma grafica precisa de 3.0 para se ler com folga.
 *
 * Uso: npx tsx scripts/contraste.mts out/quadro.png
 */

import { execFileSync } from "node:child_process";

const arquivo = process.argv[2] ?? "out/contraste.png";
/** cores que ocupem menos que isto da imagem sao ruido de antialias */
const MINIMO = 0.0015;

const bruto = execFileSync(
  "ffmpeg",
  ["-v", "error", "-i", arquivo, "-vf", "scale=270:480",
   "-f", "rawvideo", "-pix_fmt", "rgb24", "-"],
  { maxBuffer: 64 * 1024 * 1024 },
);

const contagem = new Map<string, number>();
for (let i = 0; i < bruto.length; i += 3) {
  const chave = `${bruto[i]},${bruto[i + 1]},${bruto[i + 2]}`;
  contagem.set(chave, (contagem.get(chave) ?? 0) + 1);
}

const total = bruto.length / 3;
const luminancia = (r: number, g: number, b: number): number => {
  const canal = (c: number) => {
    const v = c / 255;
    return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * canal(r) + 0.7152 * canal(g) + 0.0722 * canal(b);
};
const razao = (a: number, b: number) => {
  const [alto, baixo] = a > b ? [a, b] : [b, a];
  return (alto + 0.05) / (baixo + 0.05);
};

const cores = [...contagem.entries()]
  .filter(([, n]) => n / total >= MINIMO)
  .sort((x, y) => y[1] - x[1])
  .map(([chave, n]) => {
    const [r, g, b] = chave.split(",").map(Number);
    return {
      hex: "#" + [r, g, b].map((c) => c.toString(16).padStart(2, "0")).join(""),
      area: (n / total) * 100,
      lum: luminancia(r, g, b),
    };
  });

const fundo = cores[0];
console.log(`${arquivo}`);
console.log(`fundo: ${fundo.hex} (${fundo.area.toFixed(1)}% da imagem)\n`);
console.log("cor       area%   razao");
for (const c of cores) {
  if (c === fundo) continue;
  const r = razao(c.lum, fundo.lum);
  const marca = r >= 3 ? "ok" : r >= 2 ? "fraco" : "some no fundo";
  console.log(
    `${c.hex}  ${c.area.toFixed(1).padStart(5)}  ${r.toFixed(2).padStart(5)}  ${marca}`,
  );
}
