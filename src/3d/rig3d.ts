/**
 * CAMADA DE COMPATIBILIDADE 2D -> 3D.
 *
 * O motor de luta inteiro (core/timeline, core/contact, data/fights) e
 * agnostico de renderizador: ele produz uma Timeline, e `corpoNoQuadro`
 * resolve o corpo de um lutador num quadro. Este arquivo NAO reimplementa
 * nada disso -- ele le o mesmo corpo e devolve juntas em tres dimensoes.
 *
 * Duas coisas precisam ser DESFEITAS no caminho, e sao a razao de este
 * arquivo existir em vez de um `z: 0` espalhado pela cena.
 *
 * 1. O MOTOR 2D JA FINGE PERSPECTIVA, DENTRO DO DADO.
 *
 *    `corpoNoQuadro` multiplica `scale` e `baseY` por `escalaDaProfundidade(z)`
 *    e ainda soma `alturaDoChao(z)` ao `baseY` -- quem esta ao fundo sai menor
 *    e com os pes mais altos na tela. Isso esta certo para SVG, que nao tem
 *    camera, e esta ERRADO aqui: a camera em perspectiva do Three faz as duas
 *    coisas de verdade. Mantendo as duas, a perspectiva entraria DUAS VEZES --
 *    o corpo ao fundo encolheria pela conta do motor e de novo pela lente.
 *
 *    Entao as duas sao divididas de volta antes de montar o esqueleto.
 *
 * 2. O `giro` ACHATA O CORPO EM 2D; AQUI ELE E ROTACAO DE VERDADE.
 *
 *    Em 2D, girar o corpo no eixo vertical (o chute giratorio) e implementado
 *    espremendo a largura: `juntasNoMundo` multiplica x por `giroVisivel(giro)`,
 *    e por isso existe uma LARGURA_MINIMA_DO_GIRO -- sem ela o esqueleto vira
 *    uma linha e some. Em tres dimensoes isso nao e preciso: a largura
 *    projetada e `cos(angulo)` por construcao, entao o mesmo numero vira um
 *    angulo e o corpo gira de verdade, passando pelo perfil sem desaparecer.
 *
 *      giro =  1  ->  0 rad     de lado para a camera (a leitura padrao)
 *      giro =  0  ->  pi/2      de frente/costas, escorcado
 *      giro = -1  ->  pi        virado
 *
 *    `acos` e o inverso exato do que o 2D faz com a largura, entao os dois
 *    renderizadores concordam sobre QUANTO o corpo girou -- um achata, o
 *    outro gira.
 */

import {
  alturaDoChao,
  corpoNoQuadro,
  escalaDaProfundidade,
  type Corpo,
} from "../animation/corpo";
import { completar, ESCALA_POSE, TODAS_AS_JUNTAS } from "../characters/skeleton";
import type { FighterId, JointName, Timeline } from "../core/types";

export type Ponto3D = { x: number; y: number; z: number };

/**
 * O corpo pronto para a cena: as juntas no espaco LOCAL do lutador, mais a
 * transformacao que leva esse espaco para o mundo.
 *
 * Separado assim porque a rotacao do corpo tem que ser um transform do grupo,
 * e nao posicao junta a junta: aplicada nas juntas, uma esfera de cabeca
 * giraria em torno do quadril em vez de o corpo inteiro girar.
 */
export type Esqueleto3D = {
  /** juntas em torno do quadril, y para CIMA */
  juntas: Record<JointName, Ponto3D>;
  /** onde o quadril esta no mundo */
  posicao: Ponto3D;
  /** rotacao no eixo vertical, em radianos (ver nota 2 no topo) */
  giroY: number;
  /** rotacao no plano da tela, em radianos: o corpo tombando */
  spinZ: number;
  poseNome: string;
  noAr: boolean;
  velocidade: number;
};

const limitar = (v: number, min: number, max: number) =>
  Math.max(min, Math.min(max, v));

/**
 * O mundo 2D cresce para BAIXO (convencao de SVG): `ALTURA_QUADRIL` e
 * negativo e o chao e y = 0. O Three cresce para cima. Daqui para frente,
 * y positivo e altura.
 */
const paraCima = (y: number) => -y;

export const esqueletoDoCorpo = (c: Corpo): Esqueleto3D => {
  // desfaz a perspectiva falsa (nota 1 no topo)
  const fundo = escalaDaProfundidade(c.z);
  const escala = (c.scale / fundo) * ESCALA_POSE;
  const alturaDoQuadril = paraCima((c.baseY - alturaDoChao(c.z)) / fundo);

  const pose = completar(c.pose);
  const juntas = {} as Record<JointName, Ponto3D>;
  for (const junta of TODAS_AS_JUNTAS) {
    /*
      `facing` continua espelhando em x -- ele e para que lado o lutador
      olha, e isso e ortogonal ao giro. `giroVisivel` NAO entra: ele e a
      compressao de largura que aqui virou angulo.
    */
    juntas[junta] = {
      x: pose[junta].x * c.facing * escala,
      y: paraCima(pose[junta].y * escala),
      z: 0,
    };
  }

  return {
    juntas,
    posicao: { x: c.x, y: alturaDoQuadril, z: c.z },
    giroY: Math.acos(limitar(c.giro, -1, 1)),
    spinZ: ((c.spin ?? 0) * Math.PI) / 180,
    poseNome: c.poseNome,
    noAr: c.noAr,
    velocidade: c.velocidade,
  };
};

export const esqueletoNoQuadro = (
  timeline: Timeline,
  id: FighterId,
  frame: number,
): Esqueleto3D => esqueletoDoCorpo(corpoNoQuadro(timeline, id, frame));

/** A junta no MUNDO, com o giro e o spin do corpo ja aplicados. */
export const juntaNoMundo = (e: Esqueleto3D, junta: JointName): Ponto3D => {
  const j = e.juntas[junta];
  // spin primeiro (plano da tela), depois o giro no eixo vertical: e a mesma
  // ordem em que o grupo da cena aplica as duas rotacoes
  const cosS = Math.cos(e.spinZ);
  const senS = Math.sin(e.spinZ);
  const sx = j.x * cosS - j.y * senS;
  const sy = j.x * senS + j.y * cosS;
  const cosG = Math.cos(e.giroY);
  const senG = Math.sin(e.giroY);
  return {
    x: e.posicao.x + sx * cosG,
    y: e.posicao.y + sy,
    z: e.posicao.z + sx * senG,
  };
};

/**
 * Leva um ponto 2D QUE ESTA SOBRE O CORPO `c` para o espaco da cena.
 *
 * Existe para os gizmos de contato da pagina de tempo real: o ponto mirado
 * por um golpe (`core/contact.pontoDoAlvo`) e o impacto registrado pelo
 * compilador (`ImpactEvent.at`) nascem em coordenada de mundo DO MOTOR 2D,
 * com a perspectiva falsa ja embutida pelo corpo a que pertencem. Desenhar
 * esse ponto na cena sem desfazer a perspectiva o colocaria fora do
 * esqueleto, e um gizmo que mente e pior que gizmo nenhum.
 *
 * A conta e a mesma de `esqueletoDoCorpo`, aplicada a um deslocamento
 * arbitrario em vez de a uma junta da pose: o deslocamento do ponto em
 * relacao ao quadril sai dividido por `escalaDaProfundidade`, porque foi
 * multiplicado por ela quando o corpo foi resolvido.
 *
 * EXATO para `giro = 1`, que e a leitura padrao e o caso de toda luta ja
 * escrita. Durante o chute giratorio o 2D ACHATA a largura e a cena GIRA (ver
 * a nota 2 no topo), entao os dois discordam sobre x de proposito -- o ponto
 * cai no lugar certo do plano, nao no corpo girado.
 */
export const pontoDoCorpoEm3D = (
  ponto: { x: number; y: number },
  c: Corpo,
): Ponto3D => {
  const fundo = escalaDaProfundidade(c.z);
  const alturaDoQuadril = paraCima((c.baseY - alturaDoChao(c.z)) / fundo);
  return {
    x: c.x + (ponto.x - c.x) / fundo,
    y: alturaDoQuadril + paraCima((ponto.y - c.baseY) / fundo),
    z: c.z,
  };
};
