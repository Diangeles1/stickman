/**
 * COREOGRAFIA: a luta faz sentido como TROCA, e nao so como sequencia de
 * poses bem desenhadas.
 *
 * Os validadores que ja existem olham cada golpe por dentro -- se o punho
 * encosta (contato), se a cadeia sai do quadril (cadeia), se o membro viaja
 * em arco (arcos), se o pe escorrega (pes). Todos podem aprovar uma luta que
 * nao se entende, porque nenhum deles pergunta se os DOIS corpos estao numa
 * conversa.
 *
 * O que quebra a leitura de uma troca, na ordem em que o espectador percebe:
 *
 *   DE COSTAS    quem bate tem que estar virado para quem leva. Um soco
 *                desferido de costas le como erro de montagem, por mais
 *                correto que o braco esteja.
 *   DISTANCIA    um soco acontece ao alcance do braco. Conectar de longe
 *                faz o golpe parecer telecinese; conectar colado faz os
 *                corpos se atravessarem.
 *   REVIDE SECO  quem acabou de levar um golpe pesado nao ataca no quadro
 *                seguinte. Entre levar e devolver existe recuperacao, e sem
 *                ela os dois parecem estar lutando em turnos separados.
 *   SEM REACAO   um golpe que conecta tem que mudar o que a vitima estava
 *                fazendo. Se ela segue na mesma pose, ninguem acredita que
 *                doeu.
 *   TURNO LONGO  se um deles leva quatro, cinco golpes seguidos sem
 *                devolver nada, a luta deixa de ser troca e vira surra.
 *
 * Uso: npx tsx scripts/coreografia.mts [luta]
 */

import { compilar } from "../src/core/timeline";
import { corpoNoQuadro } from "../src/animation/corpo";
import { juntasNoMundo } from "../src/characters/skeleton";
import { PRESETS } from "../src/characters/presets";
import { escolherLuta } from "./lutas.mjs";
import type { FighterId } from "../src/core/types";

const { nome, spec } = escolherLuta(process.argv[2], "ninjas");
const t = compilar(spec);

/**
 * O VAO MAXIMO entre o membro que bate e o corpo que leva.
 *
 * A primeira versao deste script media QUADRIL A QUADRIL e reprovava tudo
 * acima de 300 unidades. Reprovou cinco golpes -- e os cinco estavam
 * corretos: medido junta a junta, o vao real era de 14 a 70 unidades, com
 * membro de ~25 de espessura. Distancia entre quadris nao e alcance, porque
 * o corpo se inclina e o braco se estende; um soco legitimo cobre 389
 * unidades de quadril a quadril sem nada de errado.
 *
 * Nao foi a animacao que falhou, foi a regua. A pergunta que importa e se o
 * membro ENCOSTA, e isso so se responde olhando o membro.
 */
const VAO_MAXIMO = 75;
/** abaixo disto os corpos se atravessam */
const COLADO = 55;
/** quadros minimos entre levar um golpe pesado e devolver */
const RECUPERACAO = 12;

type Falha = { frame: number; tipo: string; texto: string };
const falhas: Falha[] = [];

const golpes = t.impacts
  .filter((i) => i.attacker && i.victim && !i.bloqueado)
  .sort((a, b) => a.frame - b.frame);

console.log(`${nome}: ${golpes.length} golpes que conectam\n`);
console.log("quadro  quem -> quem    vao  virado  vitima estava      reacao");
console.log("-".repeat(74));

let ultimoAcerto: Record<string, number> = {};
let sequencia: { quem: FighterId; n: number } | null = null;

for (const g of golpes) {
  const a = g.attacker as FighterId;
  const v = g.victim as FighterId;
  const ca: any = corpoNoQuadro(t, a, g.frame);
  const cv: any = corpoNoQuadro(t, v, g.frame);
  const dx = cv.x - ca.x;
  const dist = Math.abs(dx);
  const pa: any = (PRESETS as any)[a];
  const pv: any = (PRESETS as any)[v];
  const ja: any = juntasNoMundo(ca.pose, { baseX: ca.x, baseY: ca.baseY, facing: ca.facing, scale: pa.scale, spin: ca.spin, giro: ca.giro });
  const jv: any = juntasNoMundo(cv.pose, { baseX: cv.x, baseY: cv.baseY, facing: cv.facing, scale: pv.scale, spin: cv.spin, giro: cv.giro });
  let vao = Infinity;
  for (const pA of Object.values(ja) as any[])
    for (const pV of Object.values(jv) as any[])
      vao = Math.min(vao, Math.hypot(pA.x - pV.x, pA.y - pV.y));
  // facing 1 = olhando para +x
  const viradoPara = Math.sign(dx) === Math.sign(ca.facing) || dist < COLADO;

  const antes: any = corpoNoQuadro(t, v, Math.max(0, g.frame - 3));
  const depois: any = corpoNoQuadro(t, v, g.frame + 8);
  const reagiu = depois.poseNome !== antes.poseNome;

  console.log(
    String(g.frame).padStart(6) +
      `  ${a.padEnd(5)}-> ${v.padEnd(6)}` +
      String(Math.round(vao)).padStart(5) +
      (viradoPara ? "   sim  " : "   NAO  ") +
      ` ${String(antes.poseNome).padEnd(16)} ${reagiu ? depois.poseNome : "NENHUMA"}`,
  );

  if (!viradoPara) falhas.push({ frame: g.frame, tipo: "de costas", texto: `${a} acerta ${v} estando virado para o outro lado` });
  if (vao > VAO_MAXIMO) falhas.push({ frame: g.frame, tipo: "nao encosta", texto: `${a} acerta ${v} com ${Math.round(vao)} unidades de vao entre os corpos` });
  if (vao < COLADO && dist < COLADO) falhas.push({ frame: g.frame, tipo: "colado", texto: `${a} e ${v} a ${Math.round(dist)} unidades de quadril: os corpos se atravessam` });
  if (!reagiu) falhas.push({ frame: g.frame, tipo: "sem reacao", texto: `${v} leva o golpe e segue em ${antes.poseNome}` });

  const levouEm = ultimoAcerto[a];
  if (levouEm !== undefined && g.frame - levouEm < RECUPERACAO && g.tier !== "light") {
    falhas.push({ frame: g.frame, tipo: "revide seco", texto: `${a} levou no quadro ${levouEm} e devolve ${g.frame - levouEm} quadros depois` });
  }
  ultimoAcerto[v] = g.frame;

  if (sequencia && sequencia.quem === a) sequencia.n++;
  else sequencia = { quem: a, n: 1 };
  if (sequencia.n === 5) falhas.push({ frame: g.frame, tipo: "turno longo", texto: `${a} encadeia 5 golpes sem devolucao` });
}

console.log("\n=== BEATS E QUEM ATACA ===");
for (const sb of t.scheduled) {
  const b = sb.beat as any;
  const quem = b.attacker ?? b.who ?? "";
  const alvo = b.target ?? "";
  const mv = b.move ?? (b.moves ? b.moves.join("+") : b.tecnica ?? b.label ?? "");
  console.log(
    String(sb.from).padStart(6) + "-" + String(sb.to).padEnd(6) +
      ` ${String(b.type).padEnd(9)} ${String(quem).padEnd(6)}${alvo ? "-> " + alvo.padEnd(6) : "        "} ${mv}`,
  );
}

/*
  O EQUILIBRIO DA TROCA. O roteiro desta luta termina em aberto -- ninguem
  vence -- e uma troca que termina em aberto nao pode ter um dos dois
  acertando o dobro do outro pelo caminho.
*/
console.log("\n" + "=== EQUILIBRIO ===");
const porQuem: Record<string, number> = {};
for (const g of golpes) porQuem[g.attacker as string] = (porQuem[g.attacker as string] ?? 0) + 1;
const contas = Object.entries(porQuem);
for (const [q, n] of contas) console.log(`  ${q.padEnd(6)} acerta ${n}`);
if (contas.length === 2) {
  const ns = contas.map(([, n]) => n).sort((p, q) => q - p);
  if (ns[0] >= ns[1] * 2 && ns[0] - ns[1] >= 3) {
    falhas.push({ frame: 0, tipo: "desequilibrio", texto: `a troca termina ${ns[0]} a ${ns[1]}: um dos dois acerta o dobro` });
  }
}

console.log("\n=== O QUE NAO FECHA ===");
if (falhas.length === 0) {
  console.log("APROVADO: a troca se sustenta.");
} else {
  const porTipo: Record<string, Falha[]> = {};
  for (const f of falhas) (porTipo[f.tipo] ??= []).push(f);
  for (const [tipo, fs] of Object.entries(porTipo)) {
    console.log(`\n${tipo.toUpperCase()} (${fs.length}):`);
    for (const f of fs.slice(0, 6)) console.log(`  quadro ${String(f.frame).padStart(5)}  ${f.texto}`);
    if (fs.length > 6) console.log(`  ... e mais ${fs.length - 6}`);
  }
  console.log(`\nREPROVADO: ${falhas.length} quebras de logica na troca.`);
  process.exit(1);
}
