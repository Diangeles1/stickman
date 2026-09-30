/**
 * QUAL LUTA AUDITAR: um lugar so, e nome errado nao passa.
 *
 * Cada validador tinha a sua propria escada de ternarios terminando num
 * padrao: `... : BENCHMARK`. Um nome fora da escada nao dava erro -- caia no
 * padrao e o script auditava OUTRA LUTA, imprimindo APROVADO com a mesma
 * cara de sempre.
 *
 * Foi o que aconteceu: uma sessao inteira rodando
 * `npx tsx scripts/contato.mts ninjas` e lendo aprovacoes que se referiam ao
 * benchmark, porque `ninjas` nunca esteve em nenhuma das escadas. Cinco
 * validadores, nenhum deles olhando o video que estava sendo publicado.
 *
 * Um padrao silencioso e pior que nao ter padrao: ele transforma erro de
 * digitacao em falso positivo, e falso positivo em video publicado. Aqui um
 * nome desconhecido PARA o script e lista o que existe.
 */

import { BENCHMARK } from "../src/data/fights/benchmark";
import { BENCHMARK2 } from "../src/data/fights/benchmark2";
import { DOMINIO } from "../src/data/fights/dominio";
import { DUELO } from "../src/data/fights/duelo";
import { DUELO_DO_VALE, DUELO_DO_VALE_2 } from "../src/data/fights/duelo-do-vale";
import { GELO_VS_FOGO } from "../src/data/fights/gelo-vs-fogo";
import { LUTA_COMPLETA } from "../src/data/fights/luta-completa";
import { NINJAS } from "../src/data/fights/ninjas";
import { PROTOTIPO } from "../src/data/fights/prototype";
import { TESTE_KATANA } from "../src/data/fights/teste-katana";
import { UM_SOCO } from "../src/data/fights/um-soco";
import type { FightSpec } from "../src/core/types";

export const LUTAS: Record<string, FightSpec> = {
  benchmark: BENCHMARK,
  benchmark2: BENCHMARK2,
  dominio: DOMINIO,
  duelo: DUELO,
  vale: DUELO_DO_VALE,
  vale2: DUELO_DO_VALE_2,
  gelofogo: GELO_VS_FOGO,
  completa: LUTA_COMPLETA,
  ninjas: NINJAS,
  prototipo: PROTOTIPO,
  katana: TESTE_KATANA,
  "um-soco": UM_SOCO,
};

/**
 * Resolve o argumento de linha de comando numa luta.
 *
 * Aceita `gerada:7` para auditar a luta que a semente 7 produz -- e este o
 * ponto de ter auditoria automatica: uma luta gerada pode ser conferida SEM
 * ninguem assistir a ela.
 */
export const escolherLuta = (
  arg: string | undefined,
  padrao: string,
): { nome: string; spec: FightSpec } => {
  const nome = arg ?? padrao;
  if (nome.startsWith("gerada:")) {
    // import tardio: gerarLuta puxa o gerador inteiro, e a maioria das
    // chamadas nao precisa dele
    const { gerarLuta } = require("../src/data/gerador");
    return { nome, spec: gerarLuta(Number(nome.split(":")[1]) || 1, { segundos: 30 }) };
  }
  if (nome === "completa-vermelho") {
    const { trocarVencedor } = require("../src/data/trocar");
    return { nome, spec: trocarVencedor(LUTA_COMPLETA) };
  }
  const spec = LUTAS[nome];
  if (!spec) {
    console.error(
      `\nluta desconhecida: "${nome}"\n\n` +
        `conhecidas: ${Object.keys(LUTAS).join(", ")}, gerada:<semente>, completa-vermelho\n\n` +
        `(este script NAO cai num padrao: auditar a luta errada e pior que nao auditar)\n`,
    );
    process.exit(2);
  }
  return { nome, spec };
};
