/**
 * O CORPO NO QUADRO: fonte unica da verdade sobre como um lutador e desenhado.
 *
 * Existe por dois motivos, os dois tirados de bugs reais deste projeto:
 *
 * 1. A cena, o overlay de depuracao e os medidores montavam a transformacao
 *    do personagem cada um por conta. Quando divergiam, o medidor aprovava um
 *    corpo que a tela nao desenhava, e foi assim que "o golpe nao encosta"
 *    sobreviveu a tres rodadas de analise visual.
 *
 * 2. A altura do quadril era uma CONSTANTE. Toda pose de perna dobrada ficava
 *    flutuando: medido, sprint1 flutuava 106 unidades de mundo, 18% de uma
 *    altura de corpo, e no video os pes do lutador nao tocavam o chao em
 *    nenhum quadro da corrida.
 *
 * Ordem do que e resolvido aqui:
 *
 *   amostragem -> respiracao -> apoio no chao -> compressao do impacto -> IK
 *
 * APOIO: a altura do quadril e derivada do pe mais baixo. Isso da de graca o
 * que antes faltava, porque perna que dobra baixa o quadril: oscilacao vertical
 * na corrida, corpo que afunda ao carregar o golpe, centro de massa coerente
 * com as pernas, sem ninguem animar nada disso na mao.
 *
 * IK: a distancia de combate resolve o eixo horizontal por construcao, mas o
 * vertical vinha da pose escrita a mao. O compilador declara a intencao
 * (AimEvent) e aqui ela e resolvida por cinematica inversa de dois ossos.
 */

import {
  alturaDoVoo,
  amostrar,
  entradaLenta,
  inclinacaoDesenhada,
  progressoDoVoo,
  suave,
} from "./sampler";
import { PRESETS } from "../characters/presets";
import {
  ALTURA_QUADRIL,
  PE_NO_CHAO,
  escalaDoMundo,
  juntasNoMundo,
  mirarMembro,
  paraLocal,
  peMaisBaixo,
  type Transformacao,
} from "../characters/skeleton";
import {
  folgaDesejada,
  pontoDoAlvo,
  type PontoAlvo,
} from "../core/contact";
import type {
  AimEvent,
  FighterId,
  Pose,
  PoseName,
  Timeline,
  Vec2,
} from "../core/types";

/** Poses em que o corpo respira. Postura de espera, nunca durante a acao. */
const POSES_QUE_RESPIRAM = new Set<PoseName>(["idle", "guard"]);

/**
 * RESPIRACAO: o peito sobe e desce e os bracos acompanham.
 *
 * Sem isto o lutador que espera fica LITERALMENTE parado. Medido no
 * diagnostico: o vermelho ficava com velocidade 0,00 por 0,35s antes de levar
 * o golpe, ou seja um manequim em cena.
 *
 * Feito comprimindo o TRONCO, nao subindo o corpo: os pes ficam plantados e o
 * peito se move, que e como respiracao funciona. Os ombros acompanham sozinhos
 * porque agora sao derivados do tronco (ver skeleton.completar).
 *
 * 1.6 unidades de pose davam 4px na tela: invisivel, e o lutador continuava
 * lendo como manequim. 4.2 da ~12 unidades de mundo, que se percebe sem virar
 * balanco. O limite e o squash do tronco (20% de 74 = 14.8).
 */
const AMPLITUDE_DO_PEITO = 4.2;
const AMPLITUDE_DOS_BRACOS = 2.6;
/** Periodo em quadros. 96 a 60fps = 1,6s por ciclo, ritmo de quem espera. */
const PERIODO_DA_RESPIRACAO = 96;

const respirar = (pose: Pose, frame: number, defasagem: number): Pose => {
  const fase = (frame / PERIODO_DA_RESPIRACAO) * Math.PI * 2 + defasagem;
  const sobe = Math.sin(fase);
  const neck = pose.neck;
  const handFront = pose.handFront;
  const handBack = pose.handBack;
  return {
    ...pose,
    ...(neck
      ? { neck: { x: neck.x, y: neck.y - sobe * AMPLITUDE_DO_PEITO } }
      : {}),
    ...(handFront
      ? {
          handFront: {
            x: handFront.x,
            y: handFront.y - sobe * AMPLITUDE_DOS_BRACOS,
          },
        }
      : {}),
    ...(handBack
      ? {
          handBack: {
            x: handBack.x,
            y: handBack.y - sobe * AMPLITUDE_DOS_BRACOS * 0.7,
          },
        }
      : {}),
  };
};

/**
 * GIRO DA QUEDA, em graus.
 *
 * Corpo lancado nao viaja reto: ele roda. Sem isto o lancamento era translacao
 * pura seguida de uma troca para pose horizontal, que e exatamente o que a
 * diretiva chama de "personagem simplesmente mudando para uma pose deitada".
 *
 * O giro vai a zero no fim do arco, entao o corpo chega ao chao alinhado com a
 * pose de pouso: girar ate o ultimo quadro faria o pe aterrissar de lado e o
 * apoio colocaria o personagem torto.
 */
const GIRO_DA_QUEDA = 52;

/** Em quantos quadros o membro completa o avanco e volta. */
const QUADROS_DO_AVANCO = 6;

/** Duracao da absorcao do impacto, em quadros logicos. */
const DUR_COMPRESSAO = 5;

/**
 * ABSORCAO DO IMPACTO: o corpo do atingido comprime por alguns quadros.
 *
 * E o squash da animacao classica aplicado ao corpo inteiro. Sem ele a reacao
 * era so troca de pose, e troca de pose sozinha nao comunica que uma forca
 * entrou no corpo.
 */
const compressaoDe = (
  timeline: Timeline,
  id: FighterId,
  frame: number,
): number => {
  let fator = 1;
  for (const imp of timeline.impacts) {
    if (imp.victim !== id) continue;
    const idade = frame - imp.frame;
    if (idade < 0 || idade > DUR_COMPRESSAO) continue;
    const forca = 1 - idade / DUR_COMPRESSAO;
    const fundo =
      imp.tier === "extreme" ? 0.11 : imp.tier === "medium" ? 0.065 : 0.03;
    fator = Math.min(fator, 1 - fundo * forca);
  }
  return fator;
};

/**
 * Peso da correcao de mira neste quadro.
 *
 * Entra durante o disparo, vale 1 EXATAMENTE no quadro do contato, e sai
 * depois. Sem essa janela a correcao apareceria de um quadro para o outro e o
 * membro daria um estalo.
 */
const pesoDaMira = (aim: AimEvent, frame: number): number => {
  if (frame < aim.from || frame > aim.to) return 0;
  if (frame <= aim.contact) {
    const dur = Math.max(1, aim.contact - aim.from);
    // ACELERA ate o contato. Com curva suave a correcao tinha a maior taxa no
    // MEIO do caminho, e o punho atingia a velocidade maxima 2 quadros ANTES
    // do contato: o golpe chegava e o corpo vinha atras, cadeia invertida.
    return entradaLenta((frame - aim.from) / dur);
  }
  const dur = Math.max(1, aim.to - aim.contact);
  return 1 - suave((frame - aim.contact) / dur);
};

export type Corpo = {
  /** posicao do quadril no mundo */
  x: number;
  baseY: number;
  facing: 1 | -1;
  /** escala ja pronta para juntasNoMundo */
  scale: number;
  spin: number;
  pose: Pose;
  poseNome: PoseName;
  velocidade: number;
  aceleracao: number;
  /** quanto o quadril baixou em relacao ao apoio neutro, em unidades de mundo */
  agachamento: number;
  /** quanto o IK precisou corrigir a ponta do membro, em unidades de pose */
  correcaoDaMira: number;
  /** false quando o alvo estava fora do alcance do membro */
  alcancou: boolean;
};

/** A transformacao de desenho de um corpo. */
export const transformDoCorpo = (c: Corpo): Transformacao => ({
  baseX: c.x,
  baseY: c.baseY,
  facing: c.facing,
  scale: c.scale,
  spin: c.spin,
});

/** Juntas do corpo em coordenadas de mundo. */
export const juntasDoCorpo = (c: Corpo) =>
  juntasNoMundo(c.pose, transformDoCorpo(c));

/**
 * Corpo SEM correcao de mira.
 *
 * Separado porque o IK de um lutador precisa saber onde esta o ponto do outro,
 * e resolver os dois com IK ao mesmo tempo seria dependencia circular. O ponto
 * do alvo e lido do corpo sem mira, que nao depende de ninguem.
 */
const corpoBase = (
  timeline: Timeline,
  id: FighterId,
  frame: number,
): Corpo => {
  const { fighterA, fighterB } = timeline.spec;
  const outroId = id === fighterA ? fighterB : fighterA;
  const preset = PRESETS[id];

  const a = amostrar(timeline.tracks[id], frame);
  const b = amostrar(timeline.tracks[outroId], frame);

  // cada um sempre encara o outro: sem isso o golpe sai de costas
  const facing: 1 | -1 = a.x <= b.x ? 1 : -1;

  // meia volta de defasagem para o segundo lutador: os dois respirando em
  // sincronia denunciaria que a respiracao e a mesma funcao
  const defasagem = id === fighterA ? 0 : Math.PI;
  const pose = POSES_QUE_RESPIRAM.has(a.poseNome)
    ? respirar(a.pose, frame, defasagem)
    : a.pose;

  // Em pose de ataque ou de reacao a inclinacao e zerada: a pose ja tem a
  // atitude do corpo desenhada, e girar o corpo no quadro do contato tirava o
  // punho do ponto onde a geometria calculou o contato.
  let spin = inclinacaoDesenhada(a) * facing;

  // GIRO DA QUEDA. Sobe e volta a zero ao longo do arco (meia volta de seno),
  // no sentido em que o corpo esta viajando.
  const arco = progressoDoVoo(timeline.tracks[id], frame);
  if (arco >= 0) {
    spin += Math.sin(arco * Math.PI) * GIRO_DA_QUEDA * Math.sign(a.velocidade || 1);
  }

  const compressao = compressaoDe(timeline, id, frame);
  const escala = escalaDoMundo(preset.scale);

  // APOIO: o pe mais baixo encosta no chao. Medido no corpo JA INCLINADO E
  // ESPELHADO, e nao na pose crua: o spin gira o esqueleto em volta do
  // quadril, entao o pe mais baixo da pose deixa de ser o pe mais baixo na
  // tela. A primeira versao usava a pose crua e deixava 20 quadros com o pe
  // fora do chao, o pior a 53 unidades.
  const local = juntasNoMundo(pose, {
    baseX: 0,
    baseY: 0,
    facing,
    scale: preset.scale,
    spin,
  });
  const apoio = Math.max(local.footFront.y, local.footBack.y);
  const voo = alturaDoVoo(timeline.tracks[id], frame);

  return {
    x: a.x,
    baseY: (-apoio - voo) * compressao,
    facing,
    scale: preset.scale * compressao,
    spin,
    pose,
    poseNome: a.poseNome,
    velocidade: a.velocidade,
    aceleracao: a.aceleracao,
    agachamento: apoio - PE_NO_CHAO * escala,
    correcaoDaMira: 0,
    alcancou: true,
  };
};

/** A mira ativa deste lutador neste quadro, se houver. */
const miraAtiva = (
  timeline: Timeline,
  id: FighterId,
  frame: number,
): AimEvent | undefined =>
  timeline.aims.find((m) => m.who === id && frame >= m.from && frame <= m.to);

/**
 * Resolve o corpo de um lutador no quadro pedido, ja com a mira corrigida.
 *
 * O APOIO e calculado antes do IK de proposito: o IK move apenas o membro
 * atacante, e o membro atacante nunca e o pe de apoio. Assim a altura do
 * quadril continua valida e o personagem nao sai do chao ao golpear.
 */
export const corpoNoQuadro = (
  timeline: Timeline,
  id: FighterId,
  frame: number,
): Corpo => {
  const eu = corpoBase(timeline, id, frame);
  const aim = miraAtiva(timeline, id, frame);
  if (!aim) return eu;

  const peso = pesoDaMira(aim, frame);
  if (peso <= 0.001) return eu;

  const alvo = corpoBase(timeline, aim.alvo, frame);
  const noMundo = pontoDoAlvo(aim.ponto as PontoAlvo, juntasDoCorpo(alvo));

  // O ALVO DO IK E A SUPERFICIE DO CORPO, NAO O EIXO DA JUNTA.
  //
  // pontoDoAlvo devolve o eixo do tronco; a superficie fica meia espessura de
  // membro a frente, dos dois lados. Com membro fino a diferenca passava
  // despercebida, mas ao triplicar a espessura para bater com a referencia ela
  // virou 68 unidades: o punho mirava no EIXO e afundava o membro inteiro
  // dentro do adversario.
  const folga = folgaDesejada(id, aim.alvo);
  noMundo.x -= folga * aim.direcao;

  // FOLLOW-THROUGH: depois do contato o alvo da mira avanca, entao o membro
  // PASSA do ponto antes de voltar. Membro que para exatamente onde acertou
  // le como golpe sem massa; o que da peso e ele continuar e ser recolhido.
  const depois = frame - aim.contact;
  if (depois > 0) {
    const t = Math.min(1, depois / QUADROS_DO_AVANCO);
    // sobe rapido e volta: sin de meia volta
    noMundo.x += Math.sin(t * Math.PI) * aim.avanco * aim.direcao;
  }

  const alvoLocal = paraLocal(noMundo, transformDoCorpo(eu));

  const r = mirarMembro(eu.pose, aim.joint, alvoLocal, peso);
  return {
    ...eu,
    pose: r.pose,
    correcaoDaMira: r.erro,
    alcancou: r.alcancou,
  };
};

/** Altura do quadril neutra, para quem so precisa de uma referencia. */
export const BASE_Y_NEUTRO = -ALTURA_QUADRIL;

/**
 * Altura do quadril de uma pose APOIADA, sem consultar trilha nenhuma.
 * O compilador precisa disto e roda antes de existir trilha.
 */
export const baseYDaPose = (pose: Pose, escalaDoLutador: number): number =>
  -peMaisBaixo(pose) * escalaDoMundo(escalaDoLutador);

/** Ponto do mundo no meio do corpo, util para camera e efeitos. */
export const centroDoCorpo = (c: Corpo): Vec2 => ({
  x: c.x,
  y: c.baseY - 120,
});
