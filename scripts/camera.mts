/**
 * Auditoria de CAMERA: o combate fica grande e legivel na tela?
 *
 * Mede, em todos os quadros, o zoom, quanto o corpo ocupa da altura da tela, e
 * se cada lutador cabe no quadro. A diretiva e explicita no item 15: nao abrir
 * a camera ao ponto de os personagens virarem pontos pequenos.
 *
 * Um lutador cortado nao e sempre erro: no fechamento do impacto, e a
 * intencao. O relatorio diz QUANDO acontece para dar para julgar.
 *
 * Uso: npx tsx scripts/camera.mts [benchmark|um-soco]
 */

import { corpoNoQuadro } from "../src/animation/corpo";
import { amostrar } from "../src/animation/sampler";
import { cameraNoQuadro } from "../src/camera/camera";
import { ALTURA_QUADRIL } from "../src/characters/skeleton";
import { compilar } from "../src/core/timeline";
import { BENCHMARK } from "../src/data/fights/benchmark";
import { BENCHMARK2 } from "../src/data/fights/benchmark2";
import { LUTA_COMPLETA } from "../src/data/fights/luta-completa";
import { GELO_VS_FOGO } from "../src/data/fights/gelo-vs-fogo";
import { trocarVencedor } from "../src/data/trocar";
import { gerarLuta } from "../src/data/gerador";
import { UM_SOCO } from "../src/data/fights/um-soco";

/** Altura do corpo em unidades de mundo, para virar porcentagem de tela. */
const CORPO = 597;
/** Meia largura do corpo com os membros abertos. */
const MEIO_CORPO = 150;
/** Abaixo disto o corpo fica pequeno demais para Shorts. */
const MINIMO_LEGIVEL = 25;
/**
 * Luta ARMADA: a katana acrescenta quase meio corpo de silhueta, entao o
 * corpo pode ficar menor na tela sem deixar de ser lido (ver
 * ZOOM_MINIMO_ARMADO em camera.ts).
 */
const MINIMO_ARMADO = 20;

const qual = process.argv[2] ?? "benchmark";
/**
 * Qual luta auditar. "gerada:7" audita a luta que a semente 7 produz.
 *
 * E este o ponto de ter auditoria automatica: uma luta gerada pode ser
 * conferida SEM ninguem assistir a ela. Sem isso, gerar cem lutas seria gerar
 * cem lutas nao verificadas.
 */
const spec = qual.startsWith("gerada:")
  ? gerarLuta(Number(qual.split(":")[1]) || 1, { segundos: 30 })
  : qual === "gelofogo"
    ? GELO_VS_FOGO
  : qual === "completa-vermelho"
    ? trocarVencedor(LUTA_COMPLETA)
  : qual === "completa"
    ? LUTA_COMPLETA
    : qual === "benchmark2"
    ? BENCHMARK2
    : qual === "um-soco"
    ? UM_SOCO
    : BENCHMARK;
const t = compilar(spec);
const padrao = { center: { x: 0, y: -ALTURA_QUADRIL - 120 }, zoom: 0.95 };

const real = (f: number) => {
  let soma = 0;
  for (const i of t.impacts) if (i.hitStop > 0 && i.frame < f) soma += i.hitStop;
  return ((f + soma) / spec.fps).toFixed(2);
};

/** quadros dentro de 0,25s de um impacto: fechar ali e a intencao */
const noImpacto = (f: number) =>
  t.impacts.some((i) => Math.abs(f - i.frame) <= spec.fps * 0.25);

/**
 * Alguem esta no ar.
 *
 * Cortar um lutador enquanto o outro VOA e o comportamento que a diretiva
 * pede no item 15: "se um personagem for lancado, acompanhe o personagem". O
 * que ela proibe e o contrario, abrir a camera ate os dois virarem pontos, e
 * isso e coberto pelo minimo de porcentagem de tela.
 *
 * Isto e criterio, nao concessao: o corte e aceitavel exatamente enquanto o
 * corpo esta no ar, e volta a ser erro no quadro seguinte ao pouso.
 */
/**
 * Enquadramento declarado como CENA pelo compilador (close no olho, na
 * katana, plano aberto do feixe). Ali o corte e a escolha, nao o defeito.
 */
const emCena = (f: number) => {
  let atual: (typeof t.cameraKeys)[number] | undefined;
  let anterior: (typeof t.cameraKeys)[number] | undefined;
  for (const k of t.cameraKeys) {
    if (k.frame > f) break;
    anterior = atual;
    atual = k;
  }
  if (atual?.cena) return true;
  // A TRANSICAO DE SAIDA ainda e da cena anterior: no quadro em que a chave
  // nova entra, a camera ainda mostra o enquadramento antigo (a suavizacao
  // comeca em zero). Sem isto, o quadro do corte era cobrado da chave nova.
  return Boolean(
    anterior?.cena && atual && f <= atual.frame + Math.max(1, atual.ease),
  );
};

const emVoo = (f: number) =>
  amostrar(t.tracks[spec.fighterA], f).airborne ||
  amostrar(t.tracks[spec.fighterB], f).airborne;

let minPct = Infinity;
let maxPct = 0;
let cortados = 0;
let cortadosForaDoImpacto = 0;
const trechos: string[] = [];
let inicioDoCorte = -1;

for (let f = 0; f <= t.durationInFrames; f++) {
  const cam = cameraNoQuadro(t, f, padrao, {
    largura: spec.width,
    alturaQuadril: -ALTURA_QUADRIL,
  });
  const pct = ((CORPO * cam.zoom) / spec.height) * 100;
  // plano aberto declarado como cena nao entra no minimo: la os dois PRECISAM
  // caber com a arena inteira em volta
  if (!emCena(f)) minPct = Math.min(minPct, pct);
  maxPct = Math.max(maxPct, pct);

  const meiaTela = spec.width / 2 / cam.zoom;
  const dentro = (x: number) => Math.abs(x - cam.center.x) <= meiaTela - MEIO_CORPO;
  const a = corpoNoQuadro(t, spec.fighterA, f);
  const b = corpoNoQuadro(t, spec.fighterB, f);
  const corte = !dentro(a.x) || !dentro(b.x);

  if (corte) {
    cortados++;
    if (!noImpacto(f) && !emVoo(f) && !emCena(f)) { cortadosForaDoImpacto++; if (process.env.CAM_DEBUG) console.log("  corte", f); }
    if (inicioDoCorte < 0) inicioDoCorte = f;
  } else if (inicioDoCorte >= 0) {
    const dur = (f - inicioDoCorte) / spec.fps;
    if (dur >= 0.1) {
      trechos.push(
        `  ${real(inicioDoCorte)}s a ${real(f)}s (${dur.toFixed(2)}s)` +
          `${
          noImpacto(inicioDoCorte)
            ? "  no impacto, intencional"
            : emVoo(inicioDoCorte)
              ? "  corpo no ar, a camera acompanha"
              : emCena(inicioDoCorte)
                ? "  enquadramento de cena, intencional"
                : "  <<< SEM MOTIVO"
        }`,
      );
    }
    inicioDoCorte = -1;
  }
}

const total = t.durationInFrames + 1;
console.log(`luta: ${qual}`);
console.log(
  `corpo na tela: de ${minPct.toFixed(0)}% a ${maxPct.toFixed(0)}% da altura`,
);
console.log(
  `quadros com alguem cortado: ${cortados}/${total} ` +
    `(${cortadosForaDoImpacto} fora de um impacto)`,
);
if (trechos.length > 0) {
  console.log("\ntrechos de corte acima de 0,1s:");
  for (const l of trechos) console.log(l);
}
const minimoExigido = spec.armas ? MINIMO_ARMADO : MINIMO_LEGIVEL;
const ok = minPct >= minimoExigido && cortadosForaDoImpacto === 0;
console.log(
  ok
    ? `\nAPROVADO: corpo nunca abaixo de ${minimoExigido}% e ninguem cortado fora de impacto.`
    : `\nREPROVADO: ${minPct < minimoExigido ? `corpo chega a ${minPct.toFixed(0)}%. ` : ""}` +
        `${cortadosForaDoImpacto > 0 ? `${cortadosForaDoImpacto} quadros cortados sem motivo.` : ""}`,
);
