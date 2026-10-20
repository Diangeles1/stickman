/**
 * ENQUADRAMENTO DO PALCO 3D: o cenario se comporta quando a camera anda?
 *
 * Um palco 3D tem elementos em posicao FIXA no mundo -- o sol, o torii, um
 * pico de serra. A camera nao: ela persegue os dois lutadores e ABRE quando
 * eles se separam (ver enquadrarDois em camera/camera). Um elemento que
 * compoe bem num quadro pode, trinta segundos depois, estar fora da tela ou
 * exatamente atras da cabeca de quem apanha.
 *
 * Conferir isso renderizando PNG e caro e incompleto: cada quadro leva
 * dezenas de segundos e ninguem olha 2700 deles. Aqui a conta e a mesma que o
 * Three faz, feita fora do navegador, em todos os quadros.
 *
 * A PROJECAO, que e o unico trecho que precisa estar certo:
 *
 *   No plano z = 0 uma unidade de mundo vale `zoom` pixels -- e a definicao
 *   de transformDaCamera. Numa camera pinhole a distancia D do plano, a
 *   escala a profundidade z e `zoom * D / (D - z)`, com z negativo para o
 *   fundo. Em z = 0 isso devolve `zoom`, que e a conferencia de que os dois
 *   renderizadores concordam.
 *
 * Uso: npx tsx scripts/palco3d.mts [luta] [passo]
 */

import { corpoNoQuadro, DISTANCIA_DA_CAMERA } from "../src/animation/corpo";
import { quadroEfetivo } from "../src/animation/sampler";
import { CAMERA_PADRAO, cameraNoQuadro } from "../src/camera/camera";
import { duracaoReal } from "../src/core/tempo";
import { ALTURA_QUADRIL } from "../src/characters/skeleton";
import { compilar } from "../src/core/timeline";
import type { FighterId } from "../src/core/types";
import { escolherLuta } from "./lutas.mjs";

const { nome: qual, spec } = escolherLuta(process.argv[2], "vale");
const PASSO = Number(process.argv[3] ?? 30);
const t = compilar(spec);
const L = spec.width;
const A = spec.height;

/**
 * Os elementos fixos do palco "entardecer", em coordenadas de mundo.
 *
 * Repetidos aqui de proposito, e isso e uma divida consciente: o palco e
 * JSX e os numeros estao dentro dele. Extrair uma tabela compartilhada vale
 * a pena quando existir o segundo palco; com um so, a tabela seria um lugar
 * a mais para divergir sem nenhum ganho. Se estes numeros mudarem la e nao
 * aqui, este script mente -- esta dito para quem mexer saber.
 */
const ELEMENTOS: {
  nome: string;
  raio: number;
  /** varias instancias do MESMO elemento: basta uma aparecer */
  onde: { x: number; y: number; z: number }[];
}[] = [
  { nome: "sol", raio: 3200, onde: [{ x: -3200, y: 4200, z: -24000 }] },
  {
    nome: "torii",
    raio: 2400,
    onde: [
      { x: 5200, y: 1800, z: -11000 },
      { x: 1400, y: 1800, z: -11600 },
      { x: -2400, y: 1800, z: -11000 },
      { x: -6200, y: 1800, z: -11600 },
      { x: -10000, y: 1800, z: -11000 },
    ],
  },
];

type Tela = { x: number; y: number; r: number };

const projetar = (
  cam: ReturnType<typeof cameraNoQuadro>,
  p: { x: number; y: number; z: number; raio: number },
): Tela => {
  const escala = cam.zoom * (DISTANCIA_DA_CAMERA / (DISTANCIA_DA_CAMERA - p.z));
  // o mundo 2D cresce para BAIXO: cam.center.y e negativo acima do chao
  return {
    x: L / 2 + cam.shake.x + (p.x - cam.center.x) * escala,
    y: A / 2 + cam.shake.y + (-p.y - cam.center.y) * escala,
    r: p.raio * escala,
  };
};

/** Fracao do disco que cai dentro do quadro (0 = fora, 1 = inteiro dentro). */
const dentro = (s: Tela): number => {
  const vx = Math.max(0, Math.min(L, s.x + s.r) - Math.max(0, s.x - s.r));
  const vy = Math.max(0, Math.min(A, s.y + s.r) - Math.max(0, s.y - s.r));
  return (vx * vy) / Math.max(1, 4 * s.r * s.r);
};

console.log(`luta: ${qual}   passo: ${PASSO} quadros\n`);
console.log(
  "q.real  zoom   " +
    ELEMENTOS.map((e) => `${e.nome.padEnd(6)} x     visivel  d(corpos)`).join("  "),
);

const lutadores = [spec.fighterA, spec.fighterB] as FighterId[];
const problemas: string[] = [];
/** o que nao reprova, mas aponta um quadro que vale olhar */
const notas: string[] = [];
let amostras = 0;

/*
  O LACO ANDA EM QUADROS REAIS, e isso nao e detalhe.

  `durationInFrames` e a duracao LOGICA. O hit stop e a camera lenta
  acrescentam quadros reais por cima dela, e a cena consulta o quadro logico
  via `quadroEfetivo` (ver scenes/FightScene e 3d/Arena3D). Andando em
  quadros logicos, este script media os corpos certos mas imprimia numeros
  que NAO servem para renderizar: pedir `--frame=1440` ao Remotion devolve
  outro instante da luta.

  Custou um render: o quadro 1440 do relatorio saiu com zoom 0.62 e o PNG
  veio um close de golpe aereo. Agora os dois lados falam a mesma lingua.
*/
const TOTAL_REAL = duracaoReal(t);
for (let real = 0; real < TOTAL_REAL; real += PASSO) {
  const f = quadroEfetivo(t, real);
  const cam = cameraNoQuadro(t, f, CAMERA_PADRAO, {
    largura: L,
    alturaQuadril: -ALTURA_QUADRIL,
  });
  // onde os corpos caem na tela, para medir colisao de composicao
  const corpos = lutadores.map((id) => {
    const c = corpoNoQuadro(t, id, f);
    return {
      x: L / 2 + cam.shake.x + (c.x - cam.center.x) * cam.zoom,
      y: A / 2 + cam.shake.y + (c.baseY - cam.center.y) * cam.zoom,
    };
  });

  const colunas: string[] = [];
  for (const e of ELEMENTOS) {
    /*
      A MELHOR INSTANCIA MANDA. Um caminho de torii nao precisa que TODOS
      apareçam -- precisa que algum apareça. Julgar pela soma reprovaria um
      caminho bem composto so por ele ser comprido.
    */
    const projecoes = e.onde.map((o) => projetar(cam, { ...o, raio: e.raio }));
    const melhor = projecoes.reduce((a, b) => (dentro(b) > dentro(a) ? b : a));
    const s = melhor;
    const vis = dentro(s);
    // distancia do centro do elemento ao corpo mais proximo, em pixels
    const d = Math.min(
      ...corpos.map((c) => Math.hypot(c.x - s.x, c.y - s.y)),
    );
    colunas.push(
      `${s.x.toFixed(0).padStart(6)} ${(vis * 100).toFixed(0).padStart(6)}% ${d.toFixed(0).padStart(9)}`,
    );
    /*
      DOIS DEFEITOS DIFERENTES, e misturar os dois esconde os dois:

      SUMIU  -- o elemento saiu do quadro. Um palco cujo torii aparece em 10%
                dos quadros nao e um palco com torii, e um palco com um
                acidente ocasional. Isto REPROVA.

      ATRAS  -- o elemento esta bem atras de um corpo. Isto NAO reprova, e a
                razao de ele ter deixado de reprovar vale ser registrada.

                A regra chegou a ser "d < raio/2 e defeito". Ela acusou o
                quadro 900 do duelo do vale; o render mostrou o laranja
                emoldurado por um portao, que e composicao BOA e nao ruim.
                Sobreposicao geometrica nao estabelece defeito nenhum --
                fundo fica atras do personagem por definicao.

                O que estabeleceria e CONTRASTE: forma de fundo com valor
                parecido com o do corpo na frente dela. Isso tem medidor
                proprio (scripts/contraste.mts) e nao se deduz de distancia
                em pixels. Aqui fica como informacao, para quem for olhar um
                quadro saber qual olhar.
    */
    if (vis < 0.02) problemas.push(`q${real}: ${e.nome} SUMIU do quadro`);
    else if (d < s.r * 0.5)
      notas.push(
        `q${real}: ${e.nome} atras do corpo (d=${d.toFixed(0)}px, raio=${s.r.toFixed(0)}px) -- conferir contraste`,
      );
  }
  console.log(
    `${String(real).padStart(6)}  ${cam.zoom.toFixed(2)}   ${colunas.join("  ")}`,
  );
  amostras++;
}

console.log("");
for (const n of notas.slice(0, 8)) console.log(`  nota: ${n}`);
if (notas.length > 8) console.log(`  nota: ... e mais ${notas.length - 8}`);
if (notas.length > 0) console.log("");
if (problemas.length === 0) {
  console.log(`APROVADO: o palco se comporta nas ${amostras} amostras.`);
} else {
  // so os primeiros, senao o relatorio vira parede
  for (const p of problemas.slice(0, 14)) console.log(`  ${p}`);
  if (problemas.length > 14) console.log(`  ... e mais ${problemas.length - 14}`);
  console.log(
    `\nREPROVADO: ${problemas.length} ocorrencias em ${amostras} amostras.`,
  );
}
