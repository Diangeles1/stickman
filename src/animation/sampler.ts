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
import {
  ATRASO_DA_REACAO,
  ATRASO_DO_ATAQUE,
  completar,
  misturar,
  type PerfilDeAtraso,
} from "../characters/skeleton";
import type { FighterTrack, Pose, PoseName, Timeline } from "../core/types";

/** Aceleracao e desaceleracao suaves. Serve para quase tudo. */
export const suave = (t: number): number => t * t * (3 - 2 * t);

/** Sai rapido e desacelera: corpo empurrado, mao que dispara. */
export const saidaRapida = (t: number): number => 1 - (1 - t) * (1 - t);

/** Comeca devagar e acelera: preparacao de golpe, queda. */
export const entradaLenta = (t: number): number => t * t;

/**
 * Estalo: quase todo o movimento nos primeiros quadros.
 *
 * Mais agressiva que saidaRapida. Serve para o corpo que LEVA o golpe: a
 * energia chega toda de uma vez e o resto e desaceleracao. E a diferenca entre
 * "assumiu a pose de quem apanhou" e "foi atingido".
 */
export const estalo = (t: number): number => 1 - Math.pow(1 - t, 3.2);

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
  const porAceleracao = a * 2.4;
  // Teto baixado de 30 para 20 graus. 30 graus de rotacao num boneco de traco
  // e quase um corpo deitado, e era o que o pico do empurrao produzia.
  return Math.max(-20, Math.min(20, porVelocidade + porAceleracao));
};

/**
 * Poses que RECEBEM inclinacao procedural do corpo.
 *
 * E uma lista de PERMISSAO, nao de proibicao, e isso e deliberado: pose nova
 * entra sem inclinacao por padrao, e pose sem inclinacao nunca quebra contato.
 * A lista de proibicao ja deixou passar dois bugs.
 *
 * O principio: a inclinacao derivada da velocidade existe para dar peso a
 * LOCOMOCAO. Pose que e resposta a uma forca (golpe, reacao, queda, freada) ja
 * tem a atitude do corpo desenhada nela; somar a inclinacao derivada conta a
 * mesma coisa duas vezes e ainda gira o corpo no quadro errado.
 *
 * Medido: no quadro do contato, o pico de aceleracao do empurrao virava 30
 * graus de rotacao do alvo, e o punho que estava a 16 unidades do peito
 * aparecia a 96 unidades ATRAS dele.
 */
const POSES_COM_INCLINACAO = new Set<PoseName>([
  // "idle" e "guard" NAO entram: sao posturas paradas. Elas deixavam vazar
  // justamente o pico do impacto, porque no quadro do contato o alvo ainda
  // esta rotulado "guard" enquanto o empurrao ja comecou.
  "walk1", "walk2", "run1", "run2", "sprint1", "sprint2",
  "advance", "retreat",
  "jump", "airborne",
  // "charge" NAO entra: ela e uma pose de ATAQUE (o ombro e a junta de
  // contato). A inclinacao procedural movia o ombro depois da distancia de
  // combate ter sido calculada, e a auditoria de mira pegou o resultado: o
  // ombro passava a 93 unidades do alvo em vez de 16.
  "dodge", "duck",
]);

/**
 * Poses de contato: golpe desferido ou golpe recebido.
 *
 * Nelas nao entra sujeira por cima da acao (linha de velocidade), porque sao
 * exatamente os quadros em que o espectador precisa ler o corpo.
 */
const POSES_DE_CONTATO = new Set<PoseName>([
  "punch", "punchFast", "punchHeavy", "uppercut",
  "kick", "kickLow", "kickHigh", "spinKick",
  "knee", "elbow", "airAttack", "diveAttack",
  "hitHead", "hitChest", "hitBody", "hitLeg",
]);

export const poseDeContato = (nome: PoseName): boolean =>
  POSES_DE_CONTATO.has(nome);

/**
 * Inclinacao que de fato vai para a tela.
 *
 * Existe como funcao para que a cena, o overlay de depuracao e o medidor de
 * contato desenhem e MEÇAM o mesmo corpo. Overlay que discorda do desenho e
 * pior que overlay nenhum.
 */
export const inclinacaoDesenhada = (a: {
  poseNome: PoseName;
  inclinacao: number;
}): number => (POSES_COM_INCLINACAO.has(a.poseNome) ? a.inclinacao : 0);

/**
 * Curva usada entre duas chaves, escolhida pela pose de DESTINO.
 *
 * Fazer isso aqui, e nao em cada beat, garante que o mesmo tipo de movimento
 * tenha sempre o mesmo peso no video inteiro.
 */
/**
 * Perfil de atraso das juntas, escolhido pela pose de DESTINO.
 *
 * Feito aqui, e nao em cada beat, para que o mesmo tipo de movimento tenha
 * sempre a mesma cadeia no video inteiro.
 */
const atrasoPara = (destino: PoseName): PerfilDeAtraso | undefined => {
  switch (destino) {
    // corpo atingido: a forca entra no ponto do golpe e se espalha
    case "hitHead":
    case "hitChest":
    case "hitBody":
    case "hitLeg":
    case "knockback":
    case "stagger":
    case "downed":
    case "land":
    case "squash":
      return ATRASO_DA_REACAO;
    // golpe e locomocao: o movimento nasce no chao e sobe
    case "punch":
    case "punchFast":
    case "punchHeavy":
    case "uppercut":
    case "kick":
    case "kickLow":
    case "kickHigh":
    case "spinKick":
    case "knee":
    case "elbow":
    case "charge":
    case "coil":
    case "walk1":
    case "walk2":
    case "run1":
    case "run2":
    case "sprint1":
    case "sprint2":
    case "advance":
    case "retreat":
      return ATRASO_DO_ATAQUE;
    default:
      return undefined;
  }
};

const curvaPara = (destino: PoseName): ((t: number) => number) => {
  switch (destino) {
    // corpo atingido: o movimento NASCE no impacto. Quase todo o deslocamento
    // acontece nos primeiros quadros e depois desacelera, que e como massa
    // empurrada se comporta. Curva suave aqui fazia o alvo "derreter" na pose
    // de reacao em vez de ser atingido por ela.
    case "hitHead":
    case "hitChest":
    case "hitBody":
    case "hitLeg":
      return estalo;
    case "knockback":
    case "downed":
      return saidaRapida;
    // freada: chega devagar, porque ele esta GASTANDO energia para parar
    case "stagger":
    case "land":
      return saidaRapida;
    // golpes ACELERAM ate o contato. Antes o soco comum usava a curva suave,
    // que chega ao alvo ja desacelerando: o oposto do que um soco faz.
    case "punch":
    case "punchFast":
    case "punchHeavy":
    case "spinKick":
    case "uppercut":
    case "kick":
    case "kickLow":
    case "kickHigh":
    case "knee":
    case "elbow":
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
  // o terceiro numero agora e o PASSO em unidades de mundo, nao em quadros
  walk1: ["walk1", "walk2", 96],
  walk2: ["walk1", "walk2", 96],
  run1: ["run1", "run2", 132],
  run2: ["run1", "run2", 132],
  sprint1: ["sprint1", "sprint2", 152],
  sprint2: ["sprint1", "sprint2", 152],
};

/**
 * Fase do ciclo de locomocao, dada pela DISTANCIA PERCORRIDA.
 *
 * Antes vinha do contador de quadros: a perna trocava a cada N quadros
 * independentemente da velocidade do corpo. E exatamente isso que o olho le
 * como personagem PATINANDO, porque a cadencia da perna nao tem relacao com o
 * quanto o corpo andou.
 *
 * Agora um passo acontece a cada tantas unidades de mundo. Corpo lento da
 * passada lenta, corpo rapido da passada rapida, e corpo parado nao mexe a
 * perna, tudo sem ninguem precisar ajustar nada.
 */
const faseDoCiclo = (
  nome: PoseName,
  distancia: number,
): PoseName => {
  const ciclo = CICLOS[nome];
  if (!ciclo) return nome;
  const [a, b, passo] = ciclo;
  return Math.floor(distancia / passo) % 2 === 0 ? a : b;
};

/**
 * Distancia percorrida pela trilha ate o quadro pedido, em unidades de mundo.
 *
 * Calculada de forma exata e barata: entre duas chaves a posicao e monotona,
 * entao o caminho andado naquele trecho e simplesmente |dx|. Soma os trechos
 * completos e a parte do trecho atual.
 *
 * Funcao pura do quadro, como tudo aqui: nao acumula estado entre quadros.
 */
export const distanciaPercorrida = (
  track: FighterTrack,
  frame: number,
): number => {
  const keys = track.keys;
  let soma = 0;
  for (let i = 0; i < keys.length - 1; i++) {
    const a = keys[i];
    const b = keys[i + 1];
    if (frame >= b.frame) {
      soma += Math.abs(b.x - a.x);
      continue;
    }
    if (frame <= a.frame || b.frame <= a.frame) break;
    const bruto = (frame - a.frame) / (b.frame - a.frame);
    soma += Math.abs(b.x - a.x) * curvaPara(b.pose)(bruto);
    break;
  }
  return soma;
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

/** Estado de um lutador no quadro pedido, SEM o movimento secundario. */
const amostrarCru = (track: FighterTrack, frame: number): Amostra => {
  // Velocidade e aceleracao por diferenca central com JANELA LARGA.
  //
  // Com janela de um quadro, um impulso de empurrao aparece como uma
  // aceleracao gigante num unico quadro, e a inclinacao do corpo saltava para
  // o teto exatamente no quadro do contato. A janela larga le a TENDENCIA do
  // movimento, que e o que a atitude do corpo deve seguir.
  const JV = 2;
  const JA = 3;
  const velocidade =
    (posicaoEm(track, frame + JV) - posicaoEm(track, frame - JV)) / (2 * JV);
  const aceleracao =
    (posicaoEm(track, frame + JA) -
      2 * posicaoEm(track, frame) +
      posicaoEm(track, frame - JA)) /
    (JA * JA);
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
      const fase = faseDoCiclo(a.pose, distanciaPercorrida(track, frame));
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
      pose: misturar(POSES[a.pose], POSES[b.pose], t, atrasoPara(b.pose)),
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
 * MOVIMENTO SECUNDARIO: a cabeca chega atrasada.
 *
 * Nenhuma parte do corpo comeca e para no mesmo instante. Quando o tronco
 * dobra por causa de um soco, a cabeca ainda esta onde estava e chega depois:
 * e esse atraso que o olho le como chicote, e e o que separa "assumiu a pose
 * de quem apanhou" de "foi atingido".
 *
 * Feito por ROTACAO da cabeca em volta do pescoco, nunca por deslocamento:
 * assim o pescoco nao estica em nenhuma pose nem em nenhuma mistura. Custa uma
 * amostragem a mais e vale para todas as poses do motor de uma vez.
 */
const ATRASO_DA_CABECA = 3;
/** Quanto do atraso aparece. 1 deixaria a cabeca solta do corpo. */
const PESO_DO_ATRASO = 0.55;

/** Estado de um lutador no quadro pedido, com movimento secundario. */
export const amostrar = (track: FighterTrack, frame: number): Amostra => {
  const agora = amostrarCru(track, frame);
  const antes = amostrarCru(track, frame - ATRASO_DA_CABECA);

  const c = completar(agora.pose);
  const p = completar(antes.pose);

  // vetor pescoco->cabeca agora e no passado
  const vx = c.head.x - c.neck.x;
  const vy = c.head.y - c.neck.y;
  const ax = p.head.x - p.neck.x;
  const ay = p.head.y - p.neck.y;

  // direcao misturada, comprimento preservado: rotaciona, nao estica
  const mx = vx + (ax - vx) * PESO_DO_ATRASO;
  const my = vy + (ay - vy) * PESO_DO_ATRASO;
  const norma = Math.hypot(mx, my);
  if (norma < 0.001) return agora;
  const comprimento = Math.hypot(vx, vy);

  return {
    ...agora,
    pose: {
      ...c,
      head: {
        x: c.neck.x + (mx / norma) * comprimento,
        y: c.neck.y + (my / norma) * comprimento,
      },
    },
  };
};

/**
 * Altura do quadril no quadro pedido.
 *
 * Quem esta no ar sobe e desce numa parabola. O topo fica um pouco depois do
 * meio de proposito: subida mais rapida que a descida e o que da sensacao de
 * peso, em vez de flutuacao.
 */
/**
 * Altura do VOO no quadro pedido: quanto o corpo esta acima do chao por estar
 * no ar. Zero quando ele esta apoiado.
 *
 * Separada de alturaNoAr porque quem desenha precisa somar isto a altura de
 * APOIO da pose (ver animation/corpo.ts). Antes as duas coisas estavam
 * misturadas numa unica funcao e a altura do quadril era uma constante, o que
 * fazia qualquer pose de perna dobrada flutuar.
 */
/**
 * Progresso do voo: 0 ao sair do chao, 1 ao tocar de novo. -1 quando o corpo
 * nao esta no ar.
 *
 * Serve para quem precisa saber ONDE no arco o corpo esta, e nao so a altura:
 * a rotacao da queda depende disso.
 */
export const progressoDoVoo = (
  track: FighterTrack,
  frame: number,
): number => {
  const trechos = trechosNoAr(track);
  for (const t of trechos) {
    if (frame < t.de || frame > t.ate) continue;
    return (frame - t.de) / Math.max(1, t.ate - t.de);
  }
  return -1;
};

/** Trechos em que a trilha esta no ar. */
const trechosNoAr = (track: FighterTrack) => {
  const trechos: { de: number; ate: number }[] = [];
  let inicio: number | null = null;
  for (const k of track.keys) {
    if (k.airborne && inicio === null) inicio = k.frame;
    if (!k.airborne && inicio !== null) {
      trechos.push({ de: inicio, ate: k.frame });
      inicio = null;
    }
  }
  if (inicio !== null && track.keys.length > 0) {
    trechos.push({ de: inicio, ate: track.keys[track.keys.length - 1].frame });
  }
  return trechos;
};

export const alturaDoVoo = (
  track: FighterTrack,
  frame: number,
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
    return Math.sin(Math.PI * Math.min(1, p / 0.9)) * alturaMaxima;
  }
  return 0;
};

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
