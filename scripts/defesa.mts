/**
 * A DEFESA RENDE ALGUMA COISA, ou e enfeite?
 *
 * O que faz um lutador parecer que esta PENSANDO nao e quanto ele se mexe --
 * medido com scripts/palco.mts, os roteiros ja atravessam de 3800 a 6600
 * unidades de cenario. E se as acoes dele tem MOTIVO.
 *
 * O caso mais visivel disso e a defesa. Bloquear ou esquivar so significa
 * alguma coisa se abrir uma janela, e a janela e o defensor agir em seguida.
 * Quando o atacante simplesmente continua atacando, o espectador le a defesa
 * como animacao de enchimento e os dois como bonecos revezando.
 *
 * Medido antes desta regra existir, nos seis roteiros do duelo diario: 5 das
 * 10 defesas nao viravam nada, e o roteiro `rua` nao tinha defesa NENHUMA em
 * dezesseis beats -- troca pura do inicio ao fim.
 *
 * O QUE ISTO NAO COBRA. Nao exige defesa: luta de puro poder (ver o roteiro
 * `feiticeiros`) pode ter pouca, e o numero certo e do roteiro. Cobra que a
 * defesa que EXISTE leve a alguma coisa.
 *
 * Nao custa tempo nem muda o placar fazer a defesa render: golpe bloqueado ou
 * esquivado ja nao conta como acerto (ver scripts/coreografia.mts). O que
 * muda e de quem e o golpe que nao conecta.
 *
 * Uso: npx tsx scripts/defesa.mts
 */

import {
  roteiroPorNome,
  ROTEIROS_DISPONIVEIS,
} from "../src/data/fights/diario";
import type { Beat, FighterId } from "../src/core/types";

/** quem age neste beat, se alguem age */
const quemAge = (b: Beat): FighterId | undefined => {
  if ("attacker" in b) return b.attacker;
  // numa cena coreografada quem conduz e o papel `gelo` (ver core/tecnicas)
  if (b.type === "tecnica") return b.gelo;
  return undefined;
};

let total = 0;
let renderam = 0;

for (const nome of ROTEIROS_DISPONIVEIS) {
  const roteiro = roteiroPorNome(nome);
  if (!roteiro) continue;
  const beats = roteiro.beats;
  let defesas = 0;
  let contras = 0;
  const falhas: string[] = [];

  beats.forEach((beat, i) => {
    if (beat.type !== "blocked" && beat.type !== "dodged") return;
    defesas++;
    const defensor = beat.target;
    const proxima = beats.slice(i + 1).find((b) => quemAge(b) !== undefined);
    const age = proxima ? quemAge(proxima) : undefined;
    if (age === defensor) contras++;
    else
      falhas.push(
        `    beat ${i}: ${beat.type} de ${beat.attacker}, e quem age em ` +
          `seguida e ${age ?? "ninguem"} -- a defesa de ${defensor} nao abriu nada`,
      );
  });

  total += defesas;
  renderam += contras;
  console.log(
    `${nome.padEnd(12)} ${contras}/${defesas} defesas viraram contra-ataque` +
      (defesas === 0 ? "   << roteiro sem defesa nenhuma" : ""),
  );
  falhas.forEach((l) => console.log(l));
  if (defesas === 0) total++;
}

console.log(
  renderam === total
    ? `\nAPROVADO: as ${total} defesas dos roteiros abrem a acao de quem defendeu.`
    : `\nREPROVADO: ${total - renderam} de ${total} defesas nao rendem nada.`,
);
process.exit(renderam === total ? 0 : 1);
