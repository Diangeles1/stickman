/**
 * As lutas que a pagina de tempo real pode carregar.
 *
 * E so um indice de DADOS existentes -- nenhuma luta e escrita aqui, e nenhum
 * `FightSpec` e modificado. A pagina chama `compilar()` nestes especs, o mesmo
 * compilador que as composicoes do Remotion chamam, para que o que aparece na
 * tela seja a MESMA luta e nao uma versao de teste dela.
 *
 * `benchmark` vem primeiro de proposito: ela e a luta que existe para dizer se
 * a animacao esta pronta (ver o cabecalho de data/fights/benchmark.ts), entao
 * e a que faz sentido abrir por padrao numa ferramenta de inspecao.
 */

import { BENCHMARK } from "../../data/fights/benchmark";
import { BENCHMARK2 } from "../../data/fights/benchmark2";
import { DOMINIO } from "../../data/fights/dominio";
import { DUELO_DO_VALE } from "../../data/fights/duelo-do-vale";
import { GELO_VS_FOGO } from "../../data/fights/gelo-vs-fogo";
import { LUTA_COMPLETA } from "../../data/fights/luta-completa";
import { TESTE_KATANA } from "../../data/fights/teste-katana";
import { UM_SOCO } from "../../data/fights/um-soco";
import type { FightSpec } from "../../core/types";

export const LUTAS: Record<string, FightSpec> = {
  benchmark: BENCHMARK,
  benchmark2: BENCHMARK2,
  "um-soco": UM_SOCO,
  "duelo-do-vale": DUELO_DO_VALE,
  "luta-completa": LUTA_COMPLETA,
  dominio: DOMINIO,
  "gelo-vs-fogo": GELO_VS_FOGO,
  "teste-katana": TESTE_KATANA,
};

export const LUTA_INICIAL = "benchmark";
