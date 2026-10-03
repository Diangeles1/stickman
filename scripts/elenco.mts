/**
 * O ELENCO CABE NO PALCO? Mede, em vez de achar.
 *
 * O video diario passou a girar CORES e CENARIOS, e as duas coisas brigam: um
 * corpo claro sobre fundo claro perde a silhueta, e um corpo escuro sobre
 * fundo escuro some. Enquanto o canal tinha um palco so (o vale, noturno) a
 * pergunta nem existia -- o ciano e o laranja foram escolhidos contra AQUELE
 * fundo e nunca saiam dele.
 *
 * Isto nao e gosto, e uma conta: a razao de contraste WCAG entre a cor do
 * corpo e a cor do fundo. Uma FORMA grafica (nao texto) precisa de 3.0 para
 * se ler com folga, e e o mesmo limite que os presets antigos ja usavam --
 * ver os blocos de medicao em characters/presets, que existem porque o
 * "preto" sumia na arena.
 *
 * O QUE SE MEDE ALEM DO CORPO. A sombra de borda (escurecer 0.72, ver
 * characters/Stickman) e o ponto mais fraco da silhueta sobre fundo escuro, e
 * foi ela que reprovou meio preset na era anterior: olhar so a cor principal
 * engana. Sobre fundo CLARO acontece o contrario -- escurecer aumenta o
 * contraste --, entao a sombra so e cobrada onde ela pode falhar.
 *
 * O FUNDO DE CADA PALCO nao e um pixel escolhido a dedo: sao as cores que o
 * cenario de fato pinta na faixa onde os corpos andam, copiadas dos proprios
 * componentes (backgrounds/*.tsx). Cada palco e julgado pelo SEU PIOR fundo,
 * porque o lutador atravessa o quadro inteiro e nao fica no lugar bom.
 *
 * Uso:
 *   npx tsx scripts/elenco.mts            confere o que o diario declara
 *   npx tsx scripts/elenco.mts --tudo     a tabela inteira, cor por palco
 */

import { PRESETS } from "../src/characters/presets";
import { elencosDoPalco, PALCOS } from "../src/data/fights/diario";
import type { FighterId } from "../src/core/types";

/**
 * O FUNDO DE CADA PALCO, MEDIDO NUM QUADRO DE VERDADE.
 *
 * A primeira versao destes numeros foi lida das paradas de gradiente dos
 * componentes de cenario -- e ESTAVA ERRADA. O ceu do vale termina em laranja
 * de por-do-sol (#a86449); tomando aquilo por fundo, o laranja reprovava com
 * 1.41 e o ciano com 1.90, ou seja, o par que o canal ja publica e que se le
 * bem. A faixa quente e uma TIRA fina no horizonte, nao a area atras dos
 * corpos.
 *
 * Foi a quarta vez neste projeto que a medida, e nao a animacao, era o
 * defeito. Entao os valores abaixo vem de um quadro renderizado de cada
 * cenario, pela cor mais frequente da imagem -- que e o que o olho integra
 * como "o fundo". Para refazer:
 *
 *   npx remotion still src/index.ts Prototype out/fundos/<palco>.png  *     --frame=45 --timeout=120000 --props=<spec com aquele scenario>
 *   npx tsx scripts/contraste.mts out/fundos/<palco>.png
 *
 * O CEU E A TERRA DO VALE SAO O MESMO NUMERO porque FightScene pinta o piso
 * da arena em todos os cenarios escuros menos o vale; os tres compartilham o
 * mesmo tom dominante.
 *
 * O QUE ESTE NUMERO NAO COBRE, e vale dizer: bandas claras menores (a serra
 * de #272f4f no vale, que ocupa 8% do quadro). Um corpo que passe na frente
 * delas se le pior do que a tabela diz. E um desconto conhecido e aceito --
 * o mesmo tipo que o preset `white` ja documenta --, e nao uma medida
 * esquecida.
 */
const FUNDOS: Record<string, string[]> = {
  arena: ["#101319"],
  noite: ["#101319"],
  metropole: ["#101319"],
  vale: ["#141a2e"],
  limpo: ["#ffffff"],
  vilarejo: ["#ffffff"],
  cidade: ["#ffffff"],
};

/** forma grafica precisa disto para se ler com folga */
const MINIMO = 3;

const rgb = (hex: string): [number, number, number] => {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
};
const escurecer = (hex: string, f: number): [number, number, number] =>
  rgb(hex).map((c) => Math.round(c * f)) as [number, number, number];

const luminancia = ([r, g, b]: [number, number, number]): number => {
  const canal = (c: number) => {
    const v = c / 255;
    return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * canal(r) + 0.7152 * canal(g) + 0.0722 * canal(b);
};
const razao = (a: [number, number, number], b: [number, number, number]) => {
  const [x, y] = [luminancia(a), luminancia(b)].sort((p, q) => q - p);
  return (x + 0.05) / (y + 0.05);
};

/** o pior contraste daquele corpo em todo o palco, com a sombra junto */
const medir = (id: FighterId, palco: string) => {
  const cor = PRESETS[id].stroke;
  const fundos = FUNDOS[palco];
  if (!fundos) {
    console.error(`palco sem fundo medido: "${palco}"`);
    process.exit(2);
  }
  let pior = Infinity;
  let onde = "";
  for (const f of fundos) {
    const alvo = rgb(f);
    /*
      A SOMBRA SO E COBRADA ONDE ELA PODE FALHAR. Sobre fundo escuro ela e o
      ponto mais fraco da silhueta; sobre fundo claro, escurecer AFASTA do
      fundo e cobrar a sombra reprovaria justamente a cor que se le melhor.
    */
    const escuro = luminancia(alvo) < 0.2;
    const partes: Array<[string, [number, number, number]]> = escuro
      ? [["corpo", rgb(cor)], ["sombra", escurecer(cor, 0.72)]]
      : [["corpo", rgb(cor)]];
    for (const [nome, c] of partes) {
      const r = razao(c, alvo);
      if (r < pior) {
        pior = r;
        onde = `${nome} sobre ${f}`;
      }
    }
  }
  return { pior, onde };
};

const tudo = process.argv.includes("--tudo");

if (tudo) {
  const palcos = Object.keys(FUNDOS);
  console.log(`\nrazao de contraste de cada corpo contra o pior fundo de cada palco`);
  console.log(`(minimo ${MINIMO.toFixed(1)} para uma forma se ler)\n`);
  console.log(`${"".padEnd(10)}${palcos.map((p) => p.slice(0, 9).padStart(10)).join("")}`);
  for (const id of Object.keys(PRESETS) as FighterId[]) {
    const celulas = palcos.map((p) => {
      const { pior } = medir(id, p);
      return `${pior >= MINIMO ? " " : "!"}${pior.toFixed(2)}`.padStart(10);
    });
    console.log(`${id.padEnd(10)}${celulas.join("")}`);
  }
  console.log(`\n! = abaixo do minimo; aquele corpo some naquele palco.\n`);
  process.exit(0);
}

/*
  O MODO PADRAO AUDITA O QUE O DIARIO DECLARA, e nao a tabela inteira.

  A tabela so informa; o que pode publicar um video ilegivel e um ELENCO
  pisando num PALCO em que ele some. E por isso que este script chama a
  MESMA funcao que o calendario usa para escalar o elenco do dia
  (`elencosDoPalco`, em data/fights/diario) em vez de ter a propria lista:
  uma copia sairia de sincronia no primeiro elenco novo e passaria a aprovar
  uma combinacao que o calendario nem produz mais -- ou, pior, a calar sobre
  uma que ele passou a produzir.
*/
let reprovou = 0;
let conferidos = 0;
for (const palco of Object.values(PALCOS)) {
  for (const elenco of elencosDoPalco(palco)) {
    for (const id of [elenco.a, elenco.b]) {
      const { pior, onde } = medir(id, palco.scenario);
      conferidos++;
      const ok = pior >= MINIMO;
      if (!ok) reprovou++;
      console.log(
        `${ok ? "ok   " : "FALHA"} ${palco.nome.padEnd(11)} ${elenco.nome.padEnd(16)} ` +
          `${id.padEnd(9)} ${pior.toFixed(2)}  (${onde})`,
      );
    }
  }
}

console.log(
  reprovou === 0
    ? `
APROVADO: ${conferidos} corpos conferidos, todos se leem no palco em que atuam.`
    : `
REPROVADO: ${reprovou} de ${conferidos} somem no palco declarado.`,
);
process.exit(reprovou === 0 ? 0 : 1);
