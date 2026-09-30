/**
 * Auditoria dos PES: o personagem pisa ou patina?
 *
 * Um pe que esta no chao e nao esta dando passo tem que ficar PARADO no
 * mundo. Qualquer deslocamento horizontal dele enquanto encosta no chao e
 * patinacao, e patinacao e o que mais denuncia "boneco sendo arrastado por
 * codigo" em vez de corpo com peso.
 *
 * Mede, quadro a quadro, quanto cada pe apoiado anda no eixo x. Deslizamento
 * sob knockback forte e permitido (o corpo esta sendo arrastado de verdade),
 * e o relatorio separa os dois casos.
 *
 * Uso: npx tsx scripts/pes.mts [benchmark|um-soco|gerada:N]
 */

import {
  POSES_DE_APOIO,
  corpoNoQuadro,
  juntasDoCorpo,
  ehQuadroDeDesenho,
} from "../src/animation/corpo";
import { compilar } from "../src/core/timeline";
import type { FighterId, JointName } from "../src/core/types";
import { escolherLuta } from "./lutas.mjs";

/**
 * Pe a menos disto do chao (unidades de mundo) conta como apoiado.
 *
 * Com os pes plantados, o pe apoiado fica EXATAMENTE no chao (y = 0). Um pe
 * a 5 ou 10 unidades esta saindo ou chegando de um passo, e anda de proposito:
 * com a tolerancia antiga de 10, o inicio e o fim de cada passo eram contados
 * como patinacao.
 */
const NO_CHAO = 1.5;
/** Deslocamento por quadro abaixo disto e ruido de arredondamento. */
const TOLERANCIA = 1.5;
const DEBUG = process.env.PES_DEBUG === "1";
/** Acima desta velocidade do quadril o corpo esta sendo ARRASTADO. */
const ARRASTO = 16;

const { nome: qual, spec } = escolherLuta(process.argv[2], "benchmark");
const t = compilar(spec);

/*
  O PASSO DA MEDICAO E O PASSO DO DESENHO.

  Quando o estilo segura a pose por dois quadros (ver animation/estilo,
  quadrosPorDesenho), os quadros do meio NUNCA SAO DESENHADOS -- o corpo
  neles e identico ao do quadro anterior. Andar de um em um mede a troca de
  desenho como se fosse escorregao: na luta do dominio isso acusava 29
  unidades de patinacao e 5 estalos que nao existem na tela.

  Medir no passo do desenho compara o que o espectador ve com o que ele ve em
  seguida, que e a unica comparacao que significa alguma coisa aqui.
*/
/*
  O PASSO NAO E MAIS UM NUMERO: E PERGUNTADO AO MOTOR.

  Este script supunha o passo fixo do estilo. Isso valia enquanto o motor
  segurava a pose sempre o mesmo tanto; quando golpe e reacao passaram a
  ganhar desenho em todo quadro, a suposicao virou o defeito.

  Medido no vermelho entre os quadros 127 e 132: o pe percorre
  574 -> 459 -> 240 -> 22 -> -82 -> -85, que desenhado quadro a quadro sao
  passos de 115, 219, 218, 104 e 3. Comparando de dois em dois, o script
  pulava o quadro do meio e reportava "estalo de 107 unidades" num trecho em
  que o espectador ve passos MENORES do que antes.

  O estalo era da regua. Perguntar quais quadros mudam de desenho e a unica
  forma de comparar o que se ve com o que se ve em seguida.
*/
const quadrosDesenhados = (id: FighterId): number[] => {
  const fs: number[] = [];
  for (let f = 0; f <= t.durationInFrames; f++) {
    if (ehQuadroDeDesenho(t, id, f)) fs.push(f);
  }
  return fs;
};

console.log(`luta: ${qual}\n`);
let totalRuim = 0;

/**
 * ESTALO: pe perto do chao que salta mais que isto num quadro.
 *
 * Nao e patinacao (o pe nao esta apoiado), e e pior: e o pe teleportando.
 * Passo de verdade anda no maximo ~25 unidades por quadro perto do chao.
 */
/*
  O LIMITE E POR TIQUE DE DESENHO, e nao por quadro.

  30 unidades pressupoe um desenho por quadro. Quando o estilo segura a pose
  em 2s, o intervalo entre dois desenhos vale dois quadros, e o pe pode andar
  o dobro nele -- pela mesma razao que um corpo anda o dobro (ver o limite de
  teleporte em scripts/qualidade.mts).

  O QUE NAO MUDA E A VELOCIDADE FISICA. O planejador limita o pe a 28 unidades
  por tique (PASSO_MAXIMO_POR_QUADRO em animation/corpo), e com dois quadros
  por tique isso e 28 por quadro -- exatamente o mesmo de antes. Comparar
  deslocamento de tique duplo contra limite de tique simples reprova o tempo
  do desenho, nao o movimento do pe.
*/
const ESTALO_POR_QUADRO = 30;
const PERTO = 15;
let estalos = 0;
for (const id of [spec.fighterA, spec.fighterB] as FighterId[]) {
  for (const pe of ["footFront", "footBack"] as JointName[]) {
    const desenhos = quadrosDesenhados(id);
    for (let i = 1; i < desenhos.length; i++) {
      const f = desenhos[i];
      const passo = f - desenhos[i - 1];
      void passo;
      const a = corpoNoQuadro(t, id, desenhos[i - 1]);
      const b = corpoNoQuadro(t, id, f);
      if (a.noAr || b.noAr) continue;
      if (!POSES_DE_APOIO.has(a.poseNome) || !POSES_DE_APOIO.has(b.poseNome)) continue;
      if (Math.abs(b.velocidade) > ARRASTO) continue;
      const pa = juntasDoCorpo(a)[pe];
      const pb = juntasDoCorpo(b)[pe];
      if (pa.y < -PERTO || pb.y < -PERTO) continue;
      const d = Math.hypot(pb.x - pa.x, pb.y - pa.y);
      if (d > ESTALO_POR_QUADRO * passo) {
        estalos++;
        console.log(
          `  ESTALO ${id} ${pe} quadro ${f}: ${d.toFixed(0)} unidades (${a.poseNome} -> ${b.poseNome})`,
        );
      }
    }
  }
}

for (const id of [spec.fighterA, spec.fighterB] as FighterId[]) {
  for (const pe of ["footFront", "footBack"] as JointName[]) {
    let patinado = 0;
    let arrastado = 0;
    let quadrosRuins = 0;
    let pior = { d: 0, f: 0 };
    const desenhos = quadrosDesenhados(id);
    for (let i = 1; i < desenhos.length; i++) {
      const f = desenhos[i];
      const passo = f - desenhos[i - 1];
      void passo;
      const a = corpoNoQuadro(t, id, desenhos[i - 1]);
      const b = corpoNoQuadro(t, id, f);
      if (a.noAr || b.noAr) continue;
      // corpo deitado, caindo ou levantando nao esta de pe: membro que se move
      // no chao ali e a queda acontecendo, nao patinacao
      if (!POSES_DE_APOIO.has(a.poseNome) || !POSES_DE_APOIO.has(b.poseNome)) continue;
      const pa = juntasDoCorpo(a)[pe];
      const pb = juntasDoCorpo(b)[pe];
      if (pa.y < -NO_CHAO || pb.y < -NO_CHAO) continue;
      const d = Math.abs(pb.x - pa.x);
      if (d <= TOLERANCIA) continue;
      if (Math.abs(b.velocidade) > ARRASTO) {
        arrastado += d;
        continue;
      }
      patinado += d;
      if (DEBUG) console.log("  ", id, pe, f, a.poseNome, "->", b.poseNome, d.toFixed(1), "y", pb.y.toFixed(0));
      quadrosRuins++;
      if (d > pior.d) pior = { d, f };
    }
    totalRuim += patinado;
    console.log(
      `${id.padEnd(6)} ${pe.padEnd(10)} patinou ${patinado.toFixed(0).padStart(5)} ` +
        `em ${String(quadrosRuins).padStart(3)} quadros ` +
        `(pior ${pior.d.toFixed(1)} no quadro ${pior.f}), ` +
        `arrastado sob golpe ${arrastado.toFixed(0)}`,
    );
  }
}

console.log(`\nestalos de pe perto do chao: ${estalos}`);
console.log(
  totalRuim < 60 && estalos === 0
    ? `APROVADO: pes apoiados patinaram ${totalRuim.toFixed(0)} unidades, nenhum estalo.`
    : `REPROVADO: pes apoiados patinaram ${totalRuim.toFixed(0)} unidades, ${estalos} estalos.`,
);
