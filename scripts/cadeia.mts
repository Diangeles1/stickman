/**
 * Auditoria da CADEIA CINETICA: o corpo se move como corrente ou como bloco?
 *
 * Num golpe real o movimento nasce no chao e sobe: o quadril acelera primeiro,
 * o tronco depois, o ombro depois, e o punho por ultimo. Em animacao
 * interpolada acontece o oposto: TODAS as juntas partem e chegam no mesmo
 * instante, porque a mistura de poses usa um unico fator de tempo para o corpo
 * inteiro. E isso que faz o olho ler "posicoes sendo trocadas" em vez de
 * "corpo se movendo".
 *
 * Este script mede, para cada golpe da luta, em que quadro cada junta atinge a
 * VELOCIDADE MAXIMA. Se todas atingem no mesmo quadro, o corpo e um bloco.
 *
 * Uso: npx tsx scripts/cadeia.mts [benchmark|um-soco]
 */

import { corpoNoQuadro, juntasDoCorpo } from "../src/animation/corpo";
import { CADEIA_DO_MEMBRO } from "../src/characters/skeleton";
import { compilar } from "../src/core/timeline";
import { BENCHMARK } from "../src/data/fights/benchmark";
import { DOMINIO } from "../src/data/fights/dominio";
import { BENCHMARK2 } from "../src/data/fights/benchmark2";
import { LUTA_COMPLETA } from "../src/data/fights/luta-completa";
import { GELO_VS_FOGO } from "../src/data/fights/gelo-vs-fogo";
import { trocarVencedor } from "../src/data/trocar";
import { gerarLuta } from "../src/data/gerador";
import { UM_SOCO } from "../src/data/fights/um-soco";
import type { FighterId, JointName } from "../src/core/types";

/**
 * Cadeia a auditar, da raiz para a ponta do membro que DE FATO golpeia.
 *
 * A primeira versao media sempre o braco da frente, e por isso reprovava todo
 * chute: media um membro que nao estava atacando. A cadeia do soco e
 * quadril -> tronco -> ombro -> cotovelo -> punho; a do chute e
 * quadril -> tronco -> joelho -> pe.
 */
const cadeiaDe = (ponta: JointName): JointName[] => {
  const membro = CADEIA_DO_MEMBRO[ponta] ?? ["hip", ponta];
  const lista: JointName[] = ["hip", "neck"];
  for (const j of membro) if (!lista.includes(j)) lista.push(j);
  return lista;
};

const qual = process.argv[2] ?? "benchmark";
/**
 * Qual luta auditar. "gerada:7" audita a luta que a semente 7 produz.
 *
 * E este o ponto de ter auditoria automatica: uma luta gerada pode ser
 * conferida SEM ninguem assistir a ela. Sem isso, gerar cem lutas seria gerar
 * cem lutas nao verificadas.
 */
const spec = qual === "dominio"
  ? DOMINIO
  : qual.startsWith("gerada:")
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

/** Posicao de uma junta no mundo, no quadro pedido. */
const juntaEm = (id: FighterId, frame: number, junta: JointName) =>
  juntasDoCorpo(corpoNoQuadro(t, id, frame))[junta];

console.log(`luta: ${qual}\n`);

let blocos = 0;

for (const mira of t.aims) {
  // A janela comeca na PREPARACAO, nao no disparo.
  //
  // A primeira versao comecava em mira.from, que e o inicio do disparo, e por
  // isso media a coisa errada: o passo a frente acontece durante a preparacao,
  // entao o pico do quadril caia fora da janela e o medidor acusava "cadeia
  // invertida" num corpo que estava certo.
  const de = Math.max(0, mira.from - 24);
  const ate = mira.contact + 4;

  console.log(
    `--- ${mira.who} -> ${mira.alvo} ${mira.ponto}, contato no quadro ${mira.contact}`,
  );
  console.log("  junta            pico  desvio do contato  velocidade");

  const CADEIA = cadeiaDe(mira.joint);
  const picos: { junta: JointName; frame: number; v: number }[] = [];
  for (const junta of CADEIA) {
    let melhor = { v: 0, f: de };
    for (let f = de + 1; f <= ate; f++) {
      const a = juntaEm(mira.who, f - 1, junta);
      const b = juntaEm(mira.who, f, junta);
      const v = Math.hypot(b.x - a.x, b.y - a.y);
      if (v > melhor.v) melhor = { v, f };
    }
    picos.push({ junta, frame: melhor.f, v: melhor.v });
    console.log(
      `  ${junta.padEnd(15)} ${String(melhor.f).padStart(4)}  ` +
        `${String(melhor.f - mira.contact).padStart(8)}          ` +
        `${melhor.v.toFixed(0).padStart(5)}`,
    );
  }

  // O corpo e um BLOCO quando quase todas as juntas picam no mesmo quadro.
  const unicos = new Set(picos.map((p) => p.frame));
  const espalhamento =
    Math.max(...picos.map((p) => p.frame)) -
    Math.min(...picos.map((p) => p.frame));

  // Ordem da cadeia: o punho tem que picar DEPOIS do quadril.
  /**
   * ORDEM: so vale para juntas que de fato se MOVERAM.
   *
   * No chute giratorio o atacante nao da passo, entao o quadril dele pica a 14
   * unidades por quadro, que e ruido. Ordenar dois eventos quando um deles nao
   * aconteceu nao diz nada, e o medidor acusava cadeia invertida por isso.
   */
  const MOVEU = 25;
  const quadril = picos.find((p) => p.junta === "hip")!;
  const ponta = picos.find((p) => p.junta === mira.joint)!;
  const ordemOk =
    quadril.v < MOVEU || ponta.v < MOVEU || ponta.frame >= quadril.frame;

  // Bloco = no maximo dois picos distintos, ou todos dentro de um quadro.
  //
  // Antes era "espalhamento <= 2", escrito quando os disparos tinham 8 a 10
  // quadros. O jab do lutador rapido tem 5 quadros (83 ms), e dentro dele a
  // corrente cabe em tres quadros consecutivos: quadril e tronco, cotovelo,
  // punho. Exigir mais que isso reprovava a resolucao do video, nao o corpo.
  // O que continua reprovado e o que importa: picos coincidentes e cadeia
  // invertida (abaixo).
  const bloco = unicos.size <= 2 || espalhamento < 2;
  if (bloco || !ordemOk) blocos++;
  console.log(
    `  picos distintos: ${unicos.size}/${CADEIA.length}, ` +
      `espalhamento ${espalhamento} quadros, ` +
      `${
        quadril.v < MOVEU
          ? "quadril parado (sem passo)"
          : `ponta ${ponta.frame >= quadril.frame ? "depois" : "ANTES"} do quadril`
      }` +
      `${bloco ? "   <<< CORPO SE MOVENDO COMO BLOCO" : ""}` +
      `${ordemOk ? "" : "   <<< CADEIA INVERTIDA"}\n`,
  );
}

console.log(
  blocos === 0
    ? "APROVADO: nenhum golpe move o corpo como bloco nem com a cadeia invertida."
    : `REPROVADO: ${blocos}/${t.aims.length} golpes com bloco ou cadeia invertida.`,
);
