/**
 * ARCO DO GOLPE (smear): o rastro em forma de lamina que o membro deixa ao
 * disparar.
 *
 * E a assinatura das lutas de stickman profissionais. A 60fps um soco leva
 * poucos quadros entre a carga e o contato, e o olho nao registra o caminho:
 * ve o punho recolhido e depois o punho esticado. O arco desenha o CAMINHO,
 * afinando da ponta do membro para tras, e e isso que se le como velocidade e
 * como direcao do golpe.
 *
 * O rastro de corpo inteiro (StickmanTrail) nao resolve isto: ele depende da
 * velocidade do CORPO, e num soco o corpo quase nao anda. Quem anda e o punho.
 *
 * Tudo lido de corpoNoQuadro, o mesmo que desenha o personagem: o arco passa
 * exatamente por onde o membro esteve, nunca por uma aproximacao.
 */

import React from "react";
import { corpoNoQuadro, juntasDoCorpo } from "../animation/corpo";
import type { FighterId, Timeline, Vec2 } from "../core/types";

/** Quantas amostras formam o arco. Mais amostras, curva mais lisa. */
const AMOSTRAS = 10;
/** Distancia entre amostras, em quadros. Meio quadro deixa o arco continuo. */
const PASSO = 0.5;
/** Quadros depois do contato em que o arco some. */
const QUADROS_DE_SAIDA = 5;
/** Arco mais curto que isto (em unidades de mundo) nao e golpe, e ruido. */
const COMPRIMENTO_MINIMO = 70;

export const ArcoDoGolpe: React.FC<{
  timeline: Timeline;
  frame: number;
  id: FighterId;
  cor: string;
  /** espessura da ponta do arco, em unidades de mundo */
  largura: number;
  opacidade: number;
}> = ({ timeline, frame, id, cor, largura, opacidade }) => {
  const aim = timeline.aims.find(
    (m) =>
      // golpe de arma tem o rastro da lamina (ArcoDaKatana), nao o do braco
      m.who === id &&
      !m.recuo &&
      frame >= m.from &&
      frame <= m.contact + QUADROS_DE_SAIDA,
  );
  if (!aim) return null;

  const pontos: Vec2[] = [];
  for (let k = 0; k < AMOSTRAS; k++) {
    const f = frame - k * PASSO;
    // o arco nao comeca antes do disparo: a carga e movimento para TRAS e
    // nao pode aparecer como rastro do golpe
    if (f < aim.from) break;
    const c = corpoNoQuadro(timeline, id, f);
    pontos.push(juntasDoCorpo(c)[aim.joint]);
  }
  if (pontos.length < 3) return null;

  let comprimento = 0;
  for (let i = 1; i < pontos.length; i++) {
    comprimento += Math.hypot(
      pontos[i].x - pontos[i - 1].x,
      pontos[i].y - pontos[i - 1].y,
    );
  }
  if (comprimento < COMPRIMENTO_MINIMO) return null;

  // some depois do contato: o golpe ja chegou, o caminho deixa de importar
  const saida =
    frame <= aim.contact
      ? 1
      : 1 - (frame - aim.contact) / QUADROS_DE_SAIDA;
  if (saida <= 0) return null;

  // lamina: larga na ponta do membro (i = 0) e zero na cauda
  const esquerda: Vec2[] = [];
  const direita: Vec2[] = [];
  for (let i = 0; i < pontos.length; i++) {
    const a = pontos[Math.max(0, i - 1)];
    const b = pontos[Math.min(pontos.length - 1, i + 1)];
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const n = Math.hypot(dx, dy) || 1;
    const nx = -dy / n;
    const ny = dx / n;
    const w = (largura / 2) * (1 - i / (pontos.length - 1));
    esquerda.push({ x: pontos[i].x + nx * w, y: pontos[i].y + ny * w });
    direita.push({ x: pontos[i].x - nx * w, y: pontos[i].y - ny * w });
  }
  const contorno = [...esquerda, ...direita.reverse()]
    .map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`)
    .join(" ");

  return (
    <polygon
      data-layer="arco-do-golpe"
      points={contorno}
      fill={cor}
      opacity={opacidade * saida}
      strokeLinejoin="round"
    />
  );
};
