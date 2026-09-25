/**
 * Medidor de contato: TODO golpe da luta encosta?
 *
 * Percorre as miras que o compilador emitiu e, no quadro de contato de cada
 * uma, mede a distancia entre a ponta do membro atacante e o ponto mirado.
 * Roda pela MESMA funcao que a cena usa para desenhar (corpoNoQuadro), porque
 * medidor que monta a transformacao por conta mede um corpo que a tela nao
 * mostra: foi assim que "o golpe nao encosta" sobreviveu a tres rodadas de
 * analise visual.
 *
 * Imprime tambem a vizinhanca do contato, para dar para ver se o membro CHEGA
 * acelerando ou se passa e volta.
 *
 * Uso: npx tsx scripts/contato.mts [benchmark|um-soco]
 */

import { corpoNoQuadro, juntasDoCorpo } from "../src/animation/corpo";
import { geometriaDaLamina } from "../src/characters/Katana";
import { ATAQUES } from "../src/attacks/registry";
import { folgaDesejada, pontoDoAlvo, type PontoAlvo } from "../src/core/contact";
import { compilar } from "../src/core/timeline";
import { BENCHMARK } from "../src/data/fights/benchmark";
import { BENCHMARK2 } from "../src/data/fights/benchmark2";
import { LUTA_COMPLETA } from "../src/data/fights/luta-completa";
import { GELO_VS_FOGO } from "../src/data/fights/gelo-vs-fogo";
import { trocarVencedor } from "../src/data/trocar";
import { gerarLuta } from "../src/data/gerador";
import { UM_SOCO } from "../src/data/fights/um-soco";
import type { FighterId, JointName } from "../src/core/types";

/**
 * Erro maximo aceito, em unidades de mundo.
 *
 * Deixou de ser 90 fixo, que era calibrado para membro fino. O que se cobra e
 * o ERRO em relacao ao contato pretendido, que e a SUPERFICIE do corpo, e nao
 * a distancia crua ate o eixo da junta: cobrar a distancia crua puniria um
 * golpe que encostou certo e premiaria um que afundou.
 */
const ENCOSTOU = 40;

const qual = process.argv[2] ?? "benchmark";
/**
 * Qual luta auditar. "gerada:7" audita a luta que a semente 7 produz.
 *
 * E este o ponto de ter auditoria automatica: uma luta gerada pode ser
 * conferida SEM ninguem assistir a ela. Sem isso, gerar cem lutas seria gerar
 * cem lutas nao verificadas.
 */
const spec = qual.startsWith("gerada:")
  ? gerarLuta(Number(qual.split(":")[1]) || 1, { segundos: 30 })
  : qual === "gelofogo"
    ? GELO_VS_FOGO
  : qual === "completa-vermelho"
    ? trocarVencedor(LUTA_COMPLETA)
  : qual === "completa"
    ? LUTA_COMPLETA
    : qual === "benchmark2"
    ? BENCHMARK2
    : qual === "um-soco"
    ? UM_SOCO
    : BENCHMARK;
const t = compilar(spec);

const real = (f: number) => {
  let soma = 0;
  for (const i of t.impacts) if (i.hitStop > 0 && i.frame < f) soma += i.hitStop;
  return ((f + soma) / spec.fps).toFixed(2);
};

const medir = (
  quem: FighterId,
  alvoId: FighterId,
  junta: JointName,
  ponto: PontoAlvo,
  frame: number,
  comLamina = false,
) => {
  const a = corpoNoQuadro(t, quem, frame);
  const b = corpoNoQuadro(t, alvoId, frame);
  // GOLPE DE ARMA: quem encosta e a PONTA DA LAMINA, nao a mao. A mao para
  // `lamina` antes de proposito (ver AttackDef.lamina); medindo a mao, todo
  // corte de katana era reprovado com exatamente o comprimento da espada de
  // erro.
  const p = comLamina
    ? (() => {
        const g = geometriaDaLamina(a);
        return { x: g.mao.x + g.dir.x * g.comprimento, y: g.mao.y + g.dir.y * g.comprimento };
      })()
    : juntasDoCorpo(a)[junta];
  const q = pontoDoAlvo(ponto, juntasDoCorpo(b));
  const folga = folgaDesejada(quem, alvoId);
  // de que lado o golpe vem: a folga fica ENTRE os dois, entao o sinal dela
  // depende de quem esta a esquerda. Com o sinal fixo, todo golpe da direita
  // para a esquerda era reprovado com o dobro da folga de erro.
  const direcao = Math.sign(b.x - a.x) || 1;
  return {
    dist: Math.hypot(q.x - p.x, q.y - p.y),
    // erro contra a superficie: dx deveria valer a folga, dy deveria ser zero
    erro: Math.hypot(q.x - p.x - folga * direcao, q.y - p.y),
    dx: q.x - p.x,
    dy: q.y - p.y,
    separacao: Math.abs(a.x - b.x),
    poseA: a.poseNome,
    poseB: b.poseNome,
    correcao: a.correcaoDaMira,
  };
};

console.log(`luta: ${qual}`);
console.log(
  `folga perseguida: ${folgaDesejada(spec.fighterA, spec.fighterB).toFixed(0)} unidades\n`,
);

let reprovados = 0;

for (const mira of t.aims) {
  const def = Object.values(ATAQUES).find((a) => a.contactJoint === mira.joint);
  const golpe = def?.name ?? mira.joint;
  const temImpacto = t.impacts.some((i) => i.frame === mira.contact);

  console.log(
    `--- ${mira.who} (${golpe}) -> ${mira.alvo} ${mira.ponto}  ` +
      `contato em ${real(mira.contact)}s` +
      `${temImpacto ? "" : "  [ESQUIVADO: sem impacto, de proposito]"}`,
  );
  console.log("  quadro | dist |   dx |   dy | separacao | poses");
  for (let f = mira.contact - 4; f <= mira.contact + 3; f++) {
    const m = medir(mira.who, mira.alvo, mira.joint, mira.ponto as PontoAlvo, f, Boolean(mira.recuo));
    const marca = f === mira.contact ? " <== CONTATO" : "";
    const toca = m.erro < ENCOSTOU ? "toca" : "    ";
    console.log(
      `  ${String(f).padStart(6)} | ${String(Math.round(m.dist)).padStart(4)} ${toca} | ` +
        `${String(Math.round(m.dx)).padStart(4)} | ${String(Math.round(m.dy)).padStart(4)} | ` +
        `${String(Math.round(m.separacao)).padStart(9)} | ${m.poseA}/${m.poseB}${marca}`,
    );
  }
  const m = medir(
    mira.who,
    mira.alvo,
    mira.joint,
    mira.ponto as PontoAlvo,
    mira.contact,
    Boolean(mira.recuo),
  );
  // Golpe ESQUIVADO nao precisa encostar: o alvo saiu do caminho de proposito
  // e a mira aponta para onde ele estava.
  if (temImpacto && m.erro >= ENCOSTOU) reprovados++;
  console.log(
    `  no contato: erro ${Math.round(m.erro)} contra a superficie ` +
      `(dist ate o eixo ${Math.round(m.dist)}, folga esperada ` +
      `${Math.round(folgaDesejada(mira.who, mira.alvo))}), ` +
      `correcao do IK ${m.correcao.toFixed(0)}` +
      `${temImpacto && m.erro >= ENCOSTOU ? "   <<< NAO ENCOSTA" : ""}\n`,
  );
}

console.log(
  reprovados === 0
    ? "APROVADO: todos os golpes que deveriam encostar encostam."
    : `REPROVADO: ${reprovados} golpes nao encostam.`,
);
