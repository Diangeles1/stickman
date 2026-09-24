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

import { logicoParaReal, realParaLogico } from "../core/tempo";
import { interpolate } from "remotion";
import { POSES } from "../characters/poses";
import {
  ATRASO_DA_REACAO,
  ATRASO_DO_ATAQUE,
  ATRASO_DO_CHUTE,
  ATRASO_DO_UPPERCUT,
  ATRASO_REACAO_CABECA,
  ATRASO_REACAO_PEITO,
  ATRASO_REACAO_PERNA,
  ATRASO_REACAO_TRONCO,
  ESCALA_POSE,
  completar,
  exagerar,
  misturar,
  type PerfilDeAtraso,
} from "../characters/skeleton";
import type {
  FighterId,
  FighterTrack,
  JointName,
  Pose,
  PoseName,
  Timeline,
} from "../core/types";

/** Aceleracao e desaceleracao suaves. Serve para quase tudo. */
export const suave = (t: number): number => t * t * (3 - 2 * t);

/** Sai rapido e desacelera: corpo empurrado, mao que dispara. */
export const saidaRapida = (t: number): number => 1 - (1 - t) * (1 - t);

/** Comeca devagar e acelera: preparacao de golpe, queda. */
export const entradaLenta = (t: number): number => t * t;

/**
 * DISPARO: quase parado no comeco, explosivo no fim.
 *
 * E a curva do golpe: pouca coisa acontece logo depois da carga, e a maior
 * parte do caminho e percorrida nos ultimos quadros antes do contato. Com
 * t^2 o pico de velocidade da ponta caia 2 quadros antes do contato; com t^3
 * ele cai no contato, que e onde o golpe precisa ter a maior velocidade.
 */
export const disparo = (t: number): number => t * t * t;

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
    // corpo atingido: a forca entra no PONTO DO GOLPE e se espalha a partir
    // dele (ver ATRASO_REACAO_*)
    case "hitHead":
      return ATRASO_REACAO_CABECA;
    case "hitChest":
      return ATRASO_REACAO_PEITO;
    case "hitBody":
    case "launched":
      return ATRASO_REACAO_TRONCO;
    case "hitLeg":
      return ATRASO_REACAO_PERNA;
    case "knockback":
    case "groundHit":
    case "stagger":
    case "downed":
    case "land":
    case "squash":
      return ATRASO_DA_REACAO;
    case "uppercut":
      return ATRASO_DO_UPPERCUT;
    // chute: a mesma corrente, terminando no pe
    case "kick":
    case "kickLow":
    case "kickHigh":
    case "spinKick":
    case "knee":
    case "diveAttack":
      return ATRASO_DO_CHUTE;
    // golpe e locomocao: o movimento nasce no chao e sobe
    case "punch":
    case "punchFast":
    case "punchHeavy":
    case "elbow":
    case "airAttack":
    case "charge":
    case "coil":
      return ATRASO_DO_ATAQUE;
    // Locomocao NAO usa a corrente do golpe. Com ela, o pe chegava no destino
    // nos primeiros 36% da transicao: ao frear de uma corrida, o pe da frente
    // saltava 78 unidades num quadro. Passo e passo; corrente e para golpe.
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
    case "launched":
    case "groundHit":
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
      return disparo;
    default:
      return suave;
  }
};

/**
 * Poses de GOLPE: o que o corpo faz ate elas e o disparo.
 */
const POSES_DE_GOLPE = new Set<PoseName>([
  "punch", "punchFast", "punchHeavy", "uppercut",
  "kick", "kickLow", "kickHigh", "spinKick",
  "knee", "elbow", "charge", "airAttack", "diveAttack",
]);

/**
 * Curva do DESLOCAMENTO do corpo (o x do quadril), que pode diferir da curva
 * da pose.
 *
 * No golpe, o corpo avanca PRIMEIRO e para antes do contato: o pe planta, o
 * quadril chega, e so entao o braco termina de disparar. Com a mesma curva da
 * pose (que acelera ate o contato), o quadril chegava junto com o punho, e o
 * soco era um bloco empurrado para frente.
 */
const curvaDoDeslocamento = (destino: PoseName): ((t: number) => number) =>
  POSES_DE_GOLPE.has(destino)
    ? (t: number) => suave(Math.min(1, t / 0.6))
    : curvaPara(destino);

/**
 * A pose que uma chave pede: a escrita, a fase do ciclo de locomocao, ou a
 * escrita EXAGERADA em relacao a guarda (carga mais funda, follow-through).
 */
const poseDaChave = (
  track: FighterTrack,
  k: FighterTrack["keys"][number],
): Pose => {
  if (CICLOS[k.pose]) {
    return poseDoCiclo(k.pose, distanciaPercorrida(track, k.frame)).pose;
  }
  if (k.exagero !== undefined && k.exagero !== 1) {
    return exagerar(POSES.guard, POSES[k.pose], k.exagero);
  }
  return POSES[k.pose];
};

/**
 * Sai rapido, PASSA um pouco do destino e volta (easeOutBack).
 *
 * E o "settle" da animacao profissional: nenhum corpo com massa para
 * exatamente onde queria parar. Quem volta de um golpe para a guarda passa um
 * pouco do ponto e se acomoda. Sem isto o corpo chega na guarda e trava, que
 * e a assinatura de animacao interpolada.
 *
 * `folga` controla quanto passa: 1.2 da ~6% de ultrapassagem, que se sente sem
 * parecer mola.
 */
export const acomodar = (t: number, folga = 1.2): number => {
  const u = t - 1;
  return 1 + (folga + 1) * u * u * u + folga * u * u;
};

/**
 * Poses de onde a volta para a guarda ganha acomodacao.
 *
 * So golpe e reacao: sao as poses em que o corpo gastou energia e precisa
 * dissipa-la. Voltar para a guarda depois de um passo nao tem o que acomodar.
 */
const POSES_QUE_ACOMODAM = new Set<PoseName>([
  "punch", "punchFast", "punchHeavy", "uppercut",
  "kick", "kickLow", "kickHigh", "spinKick",
  "knee", "elbow", "charge", "airAttack", "diveAttack",
  "hitHead", "hitChest", "hitBody", "hitLeg",
  "knockback", "stagger", "block", "dodge", "duck",
  "land", "getUp",
]);

/**
 * Curva usada na MISTURA DE POSE, que pode diferir da curva do deslocamento.
 *
 * Separada de curvaPara porque o que acomoda e o corpo, nao a posicao: se o x
 * tambem passasse do ponto, o personagem deslizaria para frente e para tras no
 * chao, e a distancia de combate calculada deixaria de valer.
 */
const curvaDaPose = (
  origem: PoseName,
  destino: PoseName,
): ((t: number) => number) =>
  destino === "guard" && POSES_QUE_ACOMODAM.has(origem)
    ? acomodar
    : curvaPara(destino);

/**
 * Quanto o pe que esta AVANCANDO sobe no meio da passada, em unidades de pose.
 *
 * E o que faltava para o ciclo parecer passada: misturar duas poses de corrida
 * leva o pe de tras ate a frente em linha reta, ARRASTANDO no chao. Numa
 * passada de verdade a perna que avanca dobra, o joelho sobe e o pe passa por
 * cima. Corrida levanta mais que caminhada, sprint mais que corrida.
 */
const ELEVACAO_DA_PASSADA: Partial<Record<PoseName, number>> = {
  walk1: 14, walk2: 14,
  run1: 28, run2: 28,
  sprint1: 34, sprint2: 34,
};

/**
 * Pose CONTINUA do ciclo de locomocao, dada a distancia percorrida.
 *
 * A versao anterior escolhia run1 OU run2 conforme a fase, entao a cada passo
 * as pernas trocavam de lugar num unico quadro: um estalo por passada, que e
 * o que mais denuncia animacao amadora. Agora a fase e continua: entre as duas
 * poses extremas a perna percorre o caminho, e a perna que avanca levanta.
 *
 * As duas poses extremas continuam sendo as escritas a mao, entao o ciclo nos
 * extremos e exatamente o de antes; o que mudou e o caminho entre eles.
 */
const poseDoCiclo = (
  nome: PoseName,
  distancia: number,
): { pose: Pose; nome: PoseName } => {
  const ciclo = CICLOS[nome];
  if (!ciclo) return { pose: POSES[nome], nome };
  const [a, b, passo] = ciclo;
  const fase = distancia / passo;
  const i = Math.floor(fase);
  const de = i % 2 === 0 ? a : b;
  const para = i % 2 === 0 ? b : a;
  // LINEAR, de proposito: com o passo derivado das poses, fase linear faz o
  // pe de apoio recuar exatamente na velocidade do corpo, ou seja parado no
  // mundo. Uma curva aqui fazia o pe ir e voltar em volta do ponto pregado.
  const t = fase - i;
  const pose = misturar(POSES[de], POSES[para], t);

  const elevacao = ELEVACAO_DA_PASSADA[nome] ?? 0;
  const arco = Math.sin(Math.PI * t) * elevacao;
  const pa = completar(POSES[de]);
  const pb = completar(POSES[para]);
  const levantar = (joelho: JointName, pe: JointName) => {
    // so a perna que vai para FRENTE levanta; a outra e a de apoio
    if (pb[pe].x <= pa[pe].x) return;
    pose[pe] = { x: pose[pe].x, y: pose[pe].y - arco };
    // o joelho puxa a perna: sobe menos que o pe e vai um pouco a frente
    pose[joelho] = {
      x: pose[joelho].x + arco * 0.35,
      y: pose[joelho].y - arco * 0.55,
    };
  };
  levantar("kneeFront", "footFront");
  levantar("kneeBack", "footBack");

  return { pose, nome: t > 0.5 ? para : de };
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
/**
 * PASSO DO CICLO, em unidades de mundo: quanto o corpo anda enquanto as
 * pernas vao de uma pose extrema a outra.
 *
 * E DERIVADO das proprias poses, e nao escolhido: e exatamente o quanto o pe
 * de apoio recua em relacao ao quadril entre as duas poses. So assim o pe no
 * chao fica parado no mundo enquanto o corpo passa por cima dele. Os valores
 * anteriores (96, 132, 152) eram um terco disso: a perna dava tres passadas
 * no espaco de uma e o pe de apoio deslizava para tras, o "moonwalk" que a
 * auditoria de pes mediu.
 */
const passoDoCiclo = (a: PoseName, b: PoseName): number =>
  Math.abs(POSES[a].footFront!.x - POSES[b].footFront!.x) * ESCALA_POSE;

const CICLOS: Partial<Record<PoseName, [PoseName, PoseName, number]>> = {
  walk1: ["walk1", "walk2", passoDoCiclo("walk1", "walk2")],
  walk2: ["walk1", "walk2", passoDoCiclo("walk1", "walk2")],
  run1: ["run1", "run2", passoDoCiclo("run1", "run2")],
  run2: ["run1", "run2", passoDoCiclo("run1", "run2")],
  sprint1: ["sprint1", "sprint2", passoDoCiclo("sprint1", "sprint2")],
  sprint2: ["sprint1", "sprint2", passoDoCiclo("sprint1", "sprint2")],
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
    soma += Math.abs(b.x - a.x) * curvaDoDeslocamento(b.pose)(bruto);
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
    const t = curvaDoDeslocamento(b.pose)(Math.min(1, Math.max(0, bruto)));
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
      x: k.x, pose: poseDaChave(track, k), poseNome: k.pose, airborne: k.airborne,
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
        x: b.x, pose: poseDaChave(track, b), poseNome: b.pose, airborne: b.airborne,
        velocidade, aceleracao, inclinacao,
      };
    }

    const bruto = (frame - a.frame) / (b.frame - a.frame);
    const t = curvaDoDeslocamento(b.pose)(Math.min(1, Math.max(0, bruto)));

    // Quando as duas chaves sao do MESMO ciclo (corrida, caminhada), nao ha o
    // que interpolar entre elas: o que vale e a fase do ciclo neste quadro.
    const cicloA = CICLOS[a.pose];
    if (cicloA && CICLOS[b.pose] && cicloA[0] === CICLOS[b.pose]![0]) {
      const ciclo = poseDoCiclo(a.pose, distanciaPercorrida(track, frame));
      return {
        x: a.x + (b.x - a.x) * t,
        pose: ciclo.pose,
        poseNome: ciclo.nome,
        airborne: a.airborne,
        velocidade, aceleracao, inclinacao,
      };
    }

    // Chave de CICLO entra e sai pela fase em que o ciclo estava naquele
    // quadro, e nao pela pose pura: ao parar de andar no meio da passada, a
    // perna saltava da fase atual para "walk1" num quadro (medido: pe
    // deslocando 192 unidades de uma vez).
    return {
      x: a.x + (b.x - a.x) * t,
      pose: misturar(
        poseDaChave(track, a),
        poseDaChave(track, b),
        Math.min(1, Math.max(0, bruto)),
        atrasoPara(b.pose),
        curvaDaPose(a.pose, b.pose),
      ),
      poseNome: t > 0.5 ? b.pose : a.pose,
      airborne: t > 0.5 ? b.airborne : a.airborne,
      velocidade, aceleracao, inclinacao,
    };
  }

  const ultima = keys[keys.length - 1];
  return {
    x: ultima.x,
    pose: poseDaChave(track, ultima),
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
    // PARABOLA DE VERDADE, com a altura dada pelo TEMPO no ar: H = g T^2 / 8.
    // Antes a altura era fixa (520) para qualquer voo: um pulo curto de ataque
    // subia tanto quanto um arremesso, e o corpo ainda ficava parado no chao
    // nos ultimos 10% do trecho. Com gravidade constante, voo curto e baixo e
    // voo longo e alto, que e o que o olho espera.
    const altura = Math.min(alturaMaxima, (GRAVIDADE * dur * dur) / 8);
    return 4 * altura * p * (1 - p);
  }
  return 0;
};

/** Gravidade do mundo, em unidades de mundo por quadro ao quadrado. */
export const GRAVIDADE = 1.0;

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
export const quadroEfetivo = (timeline: Timeline, frame: number): number =>
  realParaLogico(timeline, frame);

/**
 * TREMOR DO HIT STOP, em unidades de mundo no eixo x.
 *
 * Tecnica de jogo de luta: durante o congelamento do impacto quem apanhou
 * VIBRA no lugar, e quem bateu vibra menos. Congelar tudo parado le como
 * travamento do video; congelar vibrando le como "a forca esta entrando".
 *
 * Recebe o quadro REAL, nao o efetivo: durante o hit stop o quadro efetivo e
 * constante, e e justamente o quadro real que avanca e faz a vibracao andar.
 */
export const tremorDoHitStop = (
  timeline: Timeline,
  frameReal: number,
  id: FighterId,
): number => {
  for (const imp of timeline.impacts) {
    if (imp.hitStop <= 0) continue;
    // o congelamento comeca no quadro REAL do impacto: os hit stops e as
    // cameras lentas anteriores empurram esse quadro para frente
    const k = frameReal - Math.ceil(logicoParaReal(timeline, imp.frame) - 1e-6);
    if (k < 0 || k >= imp.hitStop) continue;
    const base =
      imp.tier === "extreme" ? 18 : imp.tier === "medium" ? 11 : 6;
    const vitima = imp.victim === id;
    const amplitude = base * (vitima ? 1 : 0.35) * (1 - k / imp.hitStop);
    return (k % 2 === 0 ? 1 : -1) * amplitude;
  }
  return 0;
};

export { interpolate };
