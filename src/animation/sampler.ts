/**
 * Amostragem da timeline: dado o quadro N, onde cada lutador esta e em que
 * pose.
 *
 * Esta e a ponte entre o compilador (que resolveu tudo em quadros-chave) e os
 * componentes (que precisam de um valor por quadro). Funcao pura: mesmo quadro,
 * mesmo resultado, sempre. E o que o Remotion exige.
 *
 * Timing natural, nao robotico: a interpolacao entre chaves NAO e linear.
 * Movimento linear denuncia interpolacao de software; com easing o olho le
 * intencao. Onde o briefing pede reacao fisica (knockback), usamos uma curva
 * que sai rapido e desacelera, que e como corpo empurrado se comporta.
 */

import { interpolate } from "remotion";
import { POSES } from "../characters/poses";
import { misturar } from "../characters/skeleton";
import type { FighterTrack, Pose, PoseName, Timeline } from "../core/types";

/** Aceleracao e desaceleracao suaves. Serve para quase tudo. */
export const suave = (t: number): number => t * t * (3 - 2 * t);

/** Sai rapido e desacelera: corpo empurrado, mao que dispara. */
export const saidaRapida = (t: number): number => 1 - (1 - t) * (1 - t);

/** Comeca devagar e acelera: preparacao de golpe, queda. */
export const entradaLenta = (t: number): number => t * t;

type Amostra = {
  x: number;
  pose: Pose;
  poseNome: PoseName;
  airborne: boolean;
  /** velocidade em unidades de mundo por quadro (com sinal) */
  velocidade: number;
  /** aceleracao em unidades por quadro ao quadrado (com sinal) */
  aceleracao: number;
  /**
   * Inclinacao do corpo em graus, DERIVADA da velocidade.
   *
   * E o que da movimento corporal integrado sem animar cada pose na mao: quem
   * acelera para frente inclina para frente, quem e empurrado tomba para tras.
   * Corrida, knockback e mudanca de direcao ganham peso de graca, e nenhuma
   * pose precisa saber disso.
   */
  inclinacao: number;
};

/**
 * Inclinacao do corpo a partir de velocidade E aceleracao.
 *
 * So a velocidade nao distingue "correndo" de "arrancando" nem de "freando":
 * nos tres casos a velocidade pode ser a mesma. A ACELERACAO e que diz para
 * onde o corpo tomba:
 *
 *   arranca  (a > 0, v > 0)  tomba para FRENTE, forte
 *   correndo (a = 0, v > 0)  tomba para frente, so um pouco
 *   freia    (a < 0, v > 0)  tomba para TRAS, mesmo ainda indo para frente
 *
 * E isso que faz o personagem parecer ter massa em vez de deslizar.
 */
const inclinacaoDoCorpo = (v: number, a: number): number => {
  const porVelocidade = v * 0.34;
  // a aceleracao pesa mais que a velocidade: e ela que da a leitura de esforco
  const porAceleracao = a * 3.4;
  return Math.max(-30, Math.min(30, porVelocidade + porAceleracao));
};

/**
 * Curva usada entre duas chaves, escolhida pela pose de DESTINO.
 *
 * Fazer isso aqui, e nao em cada beat, garante que o mesmo tipo de movimento
 * tenha sempre o mesmo peso no video inteiro.
 */
const curvaPara = (destino: PoseName): ((t: number) => number) => {
  switch (destino) {
    case "knockback":
    case "downed":
      return saidaRapida;
    case "punchHeavy":
    case "spinKick":
    case "uppercut":
    case "charge":
      return entradaLenta;
    default:
      return suave;
  }
};

/**
 * Ciclo de locomocao.
 *
 * Marcar a pose como "run1" e deixar a interpolacao ir de run1 a run2 daria UMA
 * passada de perna em 40 quadros, o que nao le como corrida. O ciclo troca de
 * pose a cada poucos quadros, e o par (run1, run2) alterna.
 *
 * O periodo e curto de proposito: perna que troca a cada 4 quadros a 60fps da
 * uma passada a cada 0,13s, que e o ritmo de corrida em fuga. Ciclo lento
 * parece caminhada.
 */
const CICLOS: Partial<Record<PoseName, [PoseName, PoseName, number]>> = {
  walk1: ["walk1", "walk2", 9],
  walk2: ["walk1", "walk2", 9],
  run1: ["run1", "run2", 5],
  run2: ["run1", "run2", 5],
  sprint1: ["sprint1", "sprint2", 4],
  sprint2: ["sprint1", "sprint2", 4],
};

/** Se a pose faz parte de um ciclo, devolve a fase certa para este quadro. */
const faseDoCiclo = (nome: PoseName, frame: number): PoseName => {
  const ciclo = CICLOS[nome];
  if (!ciclo) return nome;
  const [a, b, periodo] = ciclo;
  return Math.floor(frame / periodo) % 2 === 0 ? a : b;
};

/**
 * Posicao pura num quadro, sem os extras. Usada internamente para medir
 * velocidade por diferenca finita entre dois quadros vizinhos.
 */
const posicaoEm = (track: FighterTrack, frame: number): number => {
  const keys = track.keys;
  if (keys.length === 0) return 0;
  if (frame <= keys[0].frame) return keys[0].x;
  for (let i = 0; i < keys.length - 1; i++) {
    const a = keys[i];
    const b = keys[i + 1];
    if (frame > b.frame) continue;
    if (b.frame <= a.frame) return b.x;
    const bruto = (frame - a.frame) / (b.frame - a.frame);
    const t = curvaPara(b.pose)(Math.min(1, Math.max(0, bruto)));
    return a.x + (b.x - a.x) * t;
  }
  return keys[keys.length - 1].x;
};

/** Estado de um lutador no quadro pedido. */
export const amostrar = (track: FighterTrack, frame: number): Amostra => {
  // velocidade por diferenca central: mais estavel que olhar so para tras,
  // e e dela que sai a inclinacao do corpo
  const velocidade = (posicaoEm(track, frame + 1) - posicaoEm(track, frame - 1)) / 2;
  // segunda derivada pela mesma diferenca central: p(f+1) - 2p(f) + p(f-1)
  const aceleracao =
    posicaoEm(track, frame + 1) -
    2 * posicaoEm(track, frame) +
    posicaoEm(track, frame - 1);
  const inclinacao = inclinacaoDoCorpo(velocidade, aceleracao);
  const keys = track.keys;
  if (keys.length === 0) {
    return {
      x: 0, pose: POSES.idle, poseNome: "idle", airborne: false,
      velocidade: 0, aceleracao: 0, inclinacao: 0,
    };
  }
  if (frame <= keys[0].frame) {
    const k = keys[0];
    return {
      x: k.x, pose: POSES[k.pose], poseNome: k.pose, airborne: k.airborne,
      velocidade, aceleracao, inclinacao,
    };
  }

  for (let i = 0; i < keys.length - 1; i++) {
    const a = keys[i];
    const b = keys[i + 1];
    if (frame > b.frame) continue;

    // duas chaves no mesmo quadro = corte seco, nao interpolacao
    if (b.frame <= a.frame) {
      return {
        x: b.x, pose: POSES[b.pose], poseNome: b.pose, airborne: b.airborne,
        velocidade, aceleracao, inclinacao,
      };
    }

    const bruto = (frame - a.frame) / (b.frame - a.frame);
    const t = curvaPara(b.pose)(Math.min(1, Math.max(0, bruto)));

    // Quando as duas chaves sao do MESMO ciclo (corrida, caminhada), nao ha o
    // que interpolar entre elas: o que vale e a fase do ciclo neste quadro.
    const cicloA = CICLOS[a.pose];
    if (cicloA && CICLOS[b.pose] && cicloA[0] === CICLOS[b.pose]![0]) {
      const fase = faseDoCiclo(a.pose, frame);
      return {
        x: a.x + (b.x - a.x) * t,
        pose: POSES[fase],
        poseNome: fase,
        airborne: a.airborne,
        velocidade, aceleracao, inclinacao,
      };
    }

    return {
      x: a.x + (b.x - a.x) * t,
      pose: misturar(POSES[a.pose], POSES[b.pose], t),
      poseNome: t > 0.5 ? b.pose : a.pose,
      airborne: t > 0.5 ? b.airborne : a.airborne,
      velocidade, aceleracao, inclinacao,
    };
  }

  const ultima = keys[keys.length - 1];
  return {
    x: ultima.x,
    pose: POSES[ultima.pose],
    poseNome: ultima.pose,
    airborne: ultima.airborne,
    velocidade, aceleracao, inclinacao,
  };
};

/**
 * Altura do quadril no quadro pedido.
 *
 * Quem esta no ar sobe e desce numa parabola. O topo fica um pouco depois do
 * meio de proposito: subida mais rapida que a descida e o que da sensacao de
 * peso, em vez de flutuacao.
 */
export const alturaNoAr = (
  track: FighterTrack,
  frame: number,
  alturaQuadril: number,
  alturaMaxima = 520,
): number => {
  const trechos: { de: number; ate: number }[] = [];
  let inicio: number | null = null;
  for (const k of track.keys) {
    if (k.airborne && inicio === null) inicio = k.frame;
    if (!k.airborne && inicio !== null) {
      trechos.push({ de: inicio, ate: k.frame });
      inicio = null;
    }
  }
  if (inicio !== null) {
    trechos.push({ de: inicio, ate: track.keys[track.keys.length - 1].frame });
  }

  for (const t of trechos) {
    if (frame < t.de || frame > t.ate) continue;
    const dur = Math.max(1, t.ate - t.de);
    const p = (frame - t.de) / dur;
    // parabola com o topo em 0,45: sobe rapido, desce mais devagar
    const altura = Math.sin(Math.PI * Math.min(1, p / 0.9)) * alturaMaxima;
    return -alturaQuadril - altura;
  }
  return -alturaQuadril;
};

/**
 * Fator de tempo do quadro: 1 = normal, menor = camera lenta.
 *
 * Nao altera a duracao do video. O que ele faz e ser consultado por quem
 * desenha para reduzir a AMPLITUDE do movimento por quadro, o que o olho le
 * como camera lenta sem precisar reamostrar a timeline.
 */
export const fatorDeTempo = (timeline: Timeline, frame: number): number => {
  for (const t of timeline.slowMo) {
    if (frame >= t.from && frame <= t.to) return t.factor;
  }
  return 1;
};

/** Hit stop: quadros em que a acao congela para o golpe "pesar". */
export const congelado = (timeline: Timeline, frame: number): boolean =>
  timeline.impacts.some(
    (i) => frame >= i.frame && frame < i.frame + i.hitStop && i.hitStop > 0,
  );

/**
 * Quadro efetivo depois do hit stop.
 *
 * Em vez de repetir quadros (o que exigiria mexer na duracao da composicao),
 * o tempo PARA: durante o hit stop devolvemos sempre o quadro do impacto.
 * O resultado na tela e o mesmo e a timeline continua intacta.
 */
export const quadroEfetivo = (timeline: Timeline, frame: number): number => {
  let ajuste = 0;
  for (const i of timeline.impacts) {
    if (i.hitStop <= 0) continue;
    if (frame >= i.frame + i.hitStop) {
      ajuste += i.hitStop;
    } else if (frame >= i.frame) {
      return i.frame - ajuste;
    }
  }
  return frame - ajuste;
};

export { interpolate };
