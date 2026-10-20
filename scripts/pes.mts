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
  GIRO_MINIMO_PARA_APOIAR,
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
/**
 * Poses em que o pe DA FRENTE golpeia, e portanto nao apoia nada.
 *
 * Elas estao em POSES_DE_APOIO com razao -- o pe de TRAS continua plantado e
 * segurando o corpo. O erro era cobrar apoio dos DOIS.
 *
 * Medido: os tres estalos do duelo do vale eram todos `kickHigh -> kickHigh`
 * no pe da frente, com 157, 89 e 162 unidades. Um chute alto move o pe mais
 * de cem unidades por desenho: isso nao e patinacao, e o golpe. O medidor
 * estava cobrando que o chute ficasse parado.
 *
 * A mesma regra vale no motor (PE_DA_FRENTE_GOLPEIA em animation/corpo), e as
 * duas tem que concordar: o planejador nao prega esse pe e o medidor nao
 * cobra dele. Note que ela NAO afrouxa o resto -- o pe de tras continua
 * cobrado em toda pose de chute, e dominio e benchmark seguem em zero.
 */
const PE_DA_FRENTE_GOLPEIA = new Set<string>([
  "kick", "kickLow", "kickHigh", "knee", "spinKick", "diveAttack", "corteMergulho",
]);

const apoiaDeVerdade = (pe: JointName, pose: string): boolean =>
  !(pe === "footFront" && PE_DA_FRENTE_GOLPEIA.has(pose));

/**
 * O CORPO GIRANDO NO EIXO VERTICAL NAO TEM PE APOIADO: ele PIVOTA.
 *
 * O planejador nao prega pe nenhum abaixo de GIRO_MINIMO_PARA_APOIAR -- nao
 * ha onde pregar, o pe gira em torno do eixo do corpo (ver `girando` e
 * `podeApoiar` em animation/corpo). Este medidor nao tinha a mesma isencao e
 * cobrava que o pe ficasse parado durante a volta do chute giratorio, que e
 * exatamente o movimento que o golpe e.
 *
 * MEDIDO no duelo do vale, gold footBack, chute giratorio com contato em
 * 2546: entre os quadros 2530 e 2531 o `giro` vai de 0.81 para 0.26 -- 39
 * graus num quadro -- e o pe, a ~45 unidades do eixo, anda 31. E o arco do
 * pivo, nao um teleporte: r * dteta da exatamente essa ordem de grandeza.
 *
 * E ELE JA ESTAVA LA ANTES DE O MEDIDOR ACUSAR. Com a preparacao em 2s o
 * mesmo pivo andava 47 unidades por desenho contra um limite de 60 (porque o
 * limite e 30 por quadro vezes o passo) e passava; com a preparacao em 1s ele
 * anda 31 contra 30 e reprova. O movimento ficou MAIS suave por desenho --
 * 47 virou 31 -- e o veredito piorou. Era a regua mudando de tamanho, nao o
 * pe piorando.
 *
 * A isencao e so para o giro: fora dele o pe continua cobrado como antes.
 */
const pivotando = (giro: number): boolean => giro < GIRO_MINIMO_PARA_APOIAR;

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
      // o pe que GOLPEIA nao apoia (ver PE_DA_FRENTE_GOLPEIA)
      if (!apoiaDeVerdade(pe, a.poseNome) || !apoiaDeVerdade(pe, b.poseNome)) continue;
      // o pe PIVOTA quando o corpo gira: o planejador nao o prega (ver acima)
      if (pivotando(a.giro) || pivotando(b.giro)) continue;
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
      // o pe que GOLPEIA nao apoia (ver PE_DA_FRENTE_GOLPEIA)
      if (!apoiaDeVerdade(pe, a.poseNome) || !apoiaDeVerdade(pe, b.poseNome)) continue;
      // nem o pe que PIVOTA: a mesma isencao do laco de estalo, pelo mesmo
      // motivo -- o planejador nao prega pe nenhum durante a volta
      if (pivotando(a.giro) || pivotando(b.giro)) continue;
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
