/**
 * ENQUADRAMENTO: os corpos cabem no quadro.
 *
 * O motor ja auditava se o IMPACTO cai dentro da tela (regra "impacto dentro
 * do quadro", em qualidade.mts). Isso cobre o instante do golpe e mais nada:
 * um corpo pode passar segundos com a cabeca cortada pela borda superior sem
 * que nenhuma regra reclame, porque nenhum impacto acontece ali.
 *
 * E a borda de cima e justamente a que corta, porque o video e vertical e
 * quem sobe sobe muito: um arremesso ou uma perseguicao no ar leva o corpo
 * para fora antes de a camera reagir.
 *
 * O QUE ESTE SCRIPT NAO FAZ: reprovar todo corte. Cortar e uma escolha
 * legitima -- um close no rosto corta o corpo inteiro de proposito, e a luta
 * inteira seria chapada se a camera tivesse que caber os dois sempre. As
 * chaves de camera marcadas com `cena: true` dizem exatamente isso, e aqui
 * elas sao respeitadas.
 *
 * O que ele acha e o corte NAO INTENCIONAL: o corpo saindo pela borda num
 * enquadramento que nao pediu close, que e sempre a camera chegando tarde.
 *
 * Uso: npx tsx scripts/enquadramento.mts [luta]
 */

import { corpoNoQuadro } from "../src/animation/corpo";
import { cameraNoQuadro } from "../src/camera/camera";
import { ALTURA_QUADRIL, juntasNoMundo } from "../src/characters/skeleton";
import { PRESETS } from "../src/characters/presets";
import { compilar } from "../src/core/timeline";
import type { FighterId } from "../src/core/types";
import { escolherLuta } from "./lutas.mjs";

const { nome: qual, spec } = escolherLuta(process.argv[2], "ninjas");
const t = compilar(spec);
const ids = [spec.fighterA, spec.fighterB] as FighterId[];

/**
 * Quanto do corpo pode ficar de fora sem que o corte seja um defeito.
 *
 * Nao e zero: um pe ou uma mao passando da borda num golpe amplo e normal, e
 * cobrar o corpo inteiro dentro do quadro empurraria toda a luta para planos
 * abertos. O que nao pode sair e a CABECA, que e por onde o espectador segue
 * o personagem.
 */
const MARGEM = 12;

type Corte = {
  frame: number;
  quem: FighterId;
  lado: "cima" | "baixo" | "esquerda" | "direita";
  quanto: number;
};

const cortes: Corte[] = [];
/** trechos em que a camera pediu enquadramento proprio */
const deCena = new Set<number>();
for (let i = 0; i < t.cameraKeys.length; i++) {
  const k = t.cameraKeys[i];
  if (!k.cena) continue;
  const fim = t.cameraKeys[i + 1]?.frame ?? t.durationInFrames;
  for (let f = k.frame; f < fim; f++) deCena.add(f);
}

for (let f = 0; f < t.durationInFrames; f += 2) {
  /*
    OS MESMOS PARAMETROS QUE A CENA USA, e isto nao e detalhe.

    A primeira versao deste script passava `alturaQuadril: 600`, copiado de
    qualidade.mts. A cena passa `-ALTURA_QUADRIL`, que vale -266,8 -- e
    `enquadrarDois` devolve o centro em `alturaQuadril - 120`, entao os dois
    valores dao alturas de camera separadas por 887 unidades.

    Medindo com a camera 887 unidades abaixo da real, TUDO parece cortado: o
    script acusou 2516 quadros com a cabeca fora da tela, e os quadros
    renderizados mostravam os dois lutadores inteiros e centrados. O numero
    era do medidor, nao do video.

    (qualidade.mts passa o mesmo 600 e nao sofre com isso porque a regra dele
    so usa o eixo x, onde alturaQuadril nao entra. O valor esta errado la
    tambem; so nao tem consequencia.)
  */
  const cam = cameraNoQuadro(t, f, { center: { x: 0, y: -300 }, zoom: 1 }, {
    largura: spec.width,
    alturaQuadril: -ALTURA_QUADRIL,
  });
  const meiaL = spec.width / 2 / cam.zoom;
  const meiaA = spec.height / 2 / cam.zoom;
  for (const id of ids) {
    const c = corpoNoQuadro(t, id, f);
    const p = PRESETS[id];
    const j = juntasNoMundo(c.pose, {
      baseX: c.x,
      baseY: c.baseY,
      facing: c.facing,
      scale: p.scale,
      spin: c.spin,
      giro: c.giro as 1 | -1,
    });
    // a cabeca e o que nao pode sair: e por ela que se segue o personagem
    const r = p.headRadius * p.scale;
    const topo = j.head.y - r;
    const base = j.head.y + r;
    const esq = j.head.x - r;
    const dir = j.head.x + r;
    const acima = cam.center.y - meiaA - topo;
    const abaixo = base - (cam.center.y + meiaA);
    const aEsq = cam.center.x - meiaL - esq;
    const aDir = dir - (cam.center.x + meiaL);
    const pior = Math.max(acima, abaixo, aEsq, aDir);
    if (pior <= MARGEM) continue;
    const lado =
      pior === acima ? "cima" : pior === abaixo ? "baixo" : pior === aEsq ? "esquerda" : "direita";
    cortes.push({ frame: f, quem: id, lado, quanto: Math.round(pior) });
  }
}

console.log(`${qual}: ${t.durationInFrames} quadros logicos\n`);

const naoIntencionais = cortes.filter((c) => !deCena.has(c.frame));

/** agrupa cortes seguidos num trecho so */
const trechos: { de: number; ate: number; quem: FighterId; lado: string; pior: number }[] = [];
for (const c of naoIntencionais) {
  const ultimo = trechos[trechos.length - 1];
  if (ultimo && ultimo.quem === c.quem && ultimo.lado === c.lado && c.frame - ultimo.ate <= 6) {
    ultimo.ate = c.frame;
    ultimo.pior = Math.max(ultimo.pior, c.quanto);
  } else {
    trechos.push({ de: c.frame, ate: c.frame, quem: c.quem, lado: c.lado, pior: c.quanto });
  }
}

if (cortes.length > 0) {
  console.log(`cabeca fora do quadro em ${cortes.length} amostras`);
  console.log(`  ${cortes.length - naoIntencionais.length} em enquadramento de cena (intencional)`);
  console.log(`  ${naoIntencionais.length} fora de enquadramento de cena\n`);
}

if (trechos.length === 0) {
  console.log("APROVADO: nenhuma cabeca sai do quadro fora de enquadramento de cena.");
} else {
  console.log("TRECHOS EM QUE A CABECA SAI DO QUADRO:\n");
  console.log("quadros          quem   lado      pior");
  for (const tr of trechos.sort((a, b) => b.pior - a.pior).slice(0, 14)) {
    console.log(
      `${String(tr.de).padStart(5)}-${String(tr.ate).padEnd(6)} ${String(tr.quem).padEnd(7)}${tr.lado.padEnd(10)}${String(tr.pior).padStart(5)}`,
    );
  }
  if (trechos.length > 14) console.log(`... e mais ${trechos.length - 14} trechos`);
  const total = trechos.reduce((n, tr) => n + (tr.ate - tr.de + 2), 0);
  console.log(
    `\nREPROVADO: ${trechos.length} trecho(s), ${total} quadros com a cabeca fora do quadro.`,
  );
  process.exit(1);
}
