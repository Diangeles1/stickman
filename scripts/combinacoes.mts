/**
 * TODAS AS COMBINACOES QUE O CALENDARIO PODE PRODUZIR.
 *
 * O video diario passou a girar quatro eixos (roteiro, palco, elenco e
 * vencedor, ver data/fights/diario). Auditar "o duelo de hoje" deixou de
 * dizer alguma coisa sobre o de depois de amanha: corpos diferentes tem
 * velocidade diferente, a duracao de cada golpe escala com ela, e golpe que
 * encosta com um elenco chega um quadro atrasado com outro -- o que o
 * validador de contato acusa, com razao.
 *
 * Isto foi medido, e nao suposto. Na primeira varredura, 7 das 48
 * combinacoes reprovavam, TODAS em roteiro novo, e nenhuma delas aparecia
 * auditando so o dia de hoje. Uma delas so cai no calendario daqui a
 * semanas.
 *
 * O que este script faz:
 *   - enumera as combinacoes validas (as invalidas nem sao montadas: ver as
 *     restricoes de rocha e de contraste em data/fights/diario)
 *   - mede a duracao de cada uma contra os 60s do Shorts
 *   - imprime a chave de auditoria de cada uma, para o validador rodar
 *
 * Uso:
 *   npx tsx scripts/combinacoes.mts            a tabela e o veredito de duracao
 *   npx tsx scripts/combinacoes.mts --chaves   so as chaves, uma por linha
 *
 * Para auditar tudo (demora, e para rodar depois de mexer em roteiro, preset
 * ou cena):
 *   npx tsx scripts/combinacoes.mts --chaves | while read c; do \
 *     npx tsx scripts/contato.mts "$c" | tail -1; done
 */

import { duracaoDoPrototipo } from "../src/compositions/Prototype";
import {
  duelo,
  dueloDoDia,
  elencosDoPalco,
  palcosDoRoteiro,
  roteiroPorNome,
  ROTEIROS_DISPONIVEIS,
} from "../src/data/fights/diario";

/** o Shorts corta aqui: 61s nao e um Short um segundo mais longo */
const LIMITE = 60;

const soChaves = process.argv.includes("--chaves");
const hoje = dueloDoDia(new Date());

let combinacoes = 0;
let longas = 0;

for (const nome of ROTEIROS_DISPONIVEIS) {
  const roteiro = roteiroPorNome(nome);
  if (!roteiro) continue;
  /*
    UM PALCO DE CADA CLARIDADE BASTA PARA A FISICA.

    Os validadores olham corpos e golpes, e nao o fundo: dois palcos escuros
    dao exatamente a mesma luta. O que muda de verdade entre palcos e QUAL
    ELENCO pode pisar neles, e isso a claridade ja decide. Varrer os sete
    multiplicaria o tempo por dois sem auditar nada novo.
  */
  const vistos = new Set<boolean>();
  for (const palco of palcosDoRoteiro(roteiro)) {
    if (vistos.has(palco.claro)) continue;
    vistos.add(palco.claro);
    for (const elenco of elencosDoPalco(palco)) {
      for (const venceA of [true, false]) {
        const chave = `dia:${nome}/${palco.nome}/${elenco.nome}/${venceA ? "A" : "B"}`;
        if (soChaves) {
          console.log(chave);
          combinacoes++;
          continue;
        }
        const spec = duelo({
          ...hoje,
          roteiro: nome,
          palco: palco.nome,
          elenco: elenco.nome,
          venceA,
        });
        const dur = duracaoDoPrototipo(spec, { escolha: true }) / spec.fps;
        const ok = dur <= LIMITE;
        if (!ok) longas++;
        combinacoes++;
        console.log(
          `${ok ? "ok   " : "FALHA"} ${`${dur.toFixed(1)}s`.padStart(6)}  ${chave}`,
        );
      }
    }
  }
}

if (soChaves) process.exit(0);

console.log(
  longas === 0
    ? `\nAPROVADO: ${combinacoes} combinacoes, nenhuma passa dos ${LIMITE}s do Shorts.`
    : `\nREPROVADO: ${longas} de ${combinacoes} passam dos ${LIMITE}s.`,
);
process.exit(longas === 0 ? 0 : 1);
