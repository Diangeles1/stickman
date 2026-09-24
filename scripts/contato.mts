/**
 * Medidor de contato.
 *
 * Responde a UMA pergunta, com numero: no quadro do contato, a que distancia o
 * membro atacante esta do ponto mirado?
 *
 * Existe porque analise visual falhou tres vezes seguidas neste bug. No video o
 * braco esticado PARECE alcancar; so a medida mostra que nao alcanca. Daqui
 * para frente nenhum golpe entra no motor sem passar por aqui.
 *
 * Uso: npx tsx scripts/contato.mts
 */

import { corpoNoQuadro } from "../src/animation/corpo";
import { ATAQUES } from "../src/attacks/registry";
import { PRESETS } from "../src/characters/presets";
import { juntasNoMundo } from "../src/characters/skeleton";
import {
  ALVO_PADRAO,
  distanciaDeCombate,
  folgaDesejada,
  pontoDoAlvo,
  type PontoAlvo,
} from "../src/core/contact";
import { compilar } from "../src/core/timeline";
import { UM_SOCO } from "../src/data/fights/um-soco";

/** Distancia a partir da qual consideramos que encostou. */
const ENCOSTOU = 90;

const spec = UM_SOCO;
const t = compilar(spec);

const ataque = spec.beats.find((b) => b.type === "attack")!;
const move = "move" in ataque ? ataque.move : "punch";
const ponto = ("targetPoint" in ataque && ataque.targetPoint) || ALVO_PADRAO[move];
const atacante = "attacker" in ataque ? ataque.attacker : spec.fighterA;
const alvo = "target" in ataque ? ataque.target : spec.fighterB;
const def = ATAQUES[move];

const juntaAtacante = def.contactJoint;

/**
 * Mede o quadro usando corpoNoQuadro, que e a MESMA funcao que a cena usa
 * para desenhar. Medidor que monta a transformacao por conta propria mede um
 * corpo que a tela nao mostra, e foi assim que o bug original sobreviveu a
 * tres rodadas de analise visual.
 */
const medir = (frame: number) => {
  const a = corpoNoQuadro({
    track: t.tracks[atacante], outro: t.tracks[alvo], frame,
    preset: PRESETS[atacante],
  });
  const b = corpoNoQuadro({
    track: t.tracks[alvo], outro: t.tracks[atacante], frame,
    preset: PRESETS[alvo], defasagem: Math.PI,
  });
  const ja = juntasNoMundo(a.pose, {
    baseX: a.x, baseY: a.baseY, facing: a.facing, scale: a.scale, spin: a.spin,
  });
  const jb = juntasNoMundo(b.pose, {
    baseX: b.x, baseY: b.baseY, facing: b.facing, scale: b.scale, spin: b.spin,
  });
  const p = ja[juntaAtacante];
  const q = pontoDoAlvo(ponto as PontoAlvo, jb);
  return {
    a,
    b,
    dist: Math.hypot(p.x - q.x, p.y - q.y),
    dx: q.x - p.x,
    dy: q.y - p.y,
    separacao: Math.abs(a.x - b.x),
  };
};

console.log(`golpe: ${move}  ponto mirado: ${ponto}`);
console.log(`junta atacante: ${juntaAtacante}`);
console.log(
  `folga perseguida: ${folgaDesejada(atacante, alvo).toFixed(0)} unidades`,
);
console.log(
  `distancia de combate calculada: ${Math.round(
    distanciaDeCombate(def, atacante, alvo, ponto as never),
  )}`,
);

const impacto = t.impacts[0];
if (!impacto) {
  console.log("NENHUM IMPACTO NA TIMELINE");
  process.exit(1);
}

console.log(`\nquadro do contato: ${impacto.frame}`);
console.log("\nquadro | dist | separacao | poses");
let melhor = { frame: -1, dist: Infinity };
for (let f = Math.max(0, impacto.frame - 14); f <= impacto.frame + 14; f++) {
  const m = medir(f);
  if (m.dist < melhor.dist) melhor = { frame: f, dist: m.dist };
  const marca = f === impacto.frame ? " <== CONTATO" : "";
  const status = m.dist < ENCOSTOU ? "toca" : "    ";
  console.log(
    `${String(f).padStart(6)} | ${String(Math.round(m.dist)).padStart(4)} ${status} | ` +
      `${String(Math.round(m.dx)).padStart(4)} | ${String(Math.round(m.dy)).padStart(4)} | ` +
      `${String(Math.round(m.separacao)).padStart(9)} | ${m.a.poseNome}/${m.b.poseNome}${marca}`,
  );
}

const noContato = medir(impacto.frame).dist;
console.log(
  `\nmais perto que o punho chega: ${Math.round(melhor.dist)} no quadro ${melhor.frame}`,
);
console.log(`distancia NO QUADRO DO CONTATO: ${Math.round(noContato)}`);
console.log(
  noContato < ENCOSTOU
    ? "APROVADO: o punho encosta no quadro do contato."
    : `REPROVADO: faltam ${Math.round(noContato - ENCOSTOU)} unidades.`,
);

// as chaves precisam estar em ordem crescente, senao a amostragem pula trechos
for (const id of [spec.fighterA, spec.fighterB]) {
  const keys = t.tracks[id].keys;
  for (let i = 1; i < keys.length; i++) {
    if (keys[i].frame < keys[i - 1].frame) {
      console.log(
        `CHAVE FORA DE ORDEM em ${id}: ${keys[i - 1].frame} -> ${keys[i].frame}`,
      );
    }
  }
}
