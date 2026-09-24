/**
 * Camera cinematografica.
 *
 * Converte mundo em tela. Trabalhar em coordenadas de mundo e deixar a camera
 * resolver no fim significa que mover a camera NAO exige recalcular pose,
 * particula nem cenario.
 *
 * Dois cuidados que vieram do prototipo:
 *
 * 1. A camera persegue o alvo com atraso. Camera que chega no lugar no mesmo
 *    quadro parece corte, nao movimento.
 * 2. O tremor inverte de sinal a cada quadro. Tremor que sempre empurra para o
 *    mesmo lado desliza a imagem em vez de vibrar.
 */

import { interpolate } from "remotion";
import { amostrar } from "../animation/sampler";
import { hashRng } from "../core/rng";
import type { CameraKey, Timeline, Vec2 } from "../core/types";

export type EstadoCamera = {
  center: Vec2;
  zoom: number;
  shake: Vec2;
};

/**
 * Estado da camera no quadro pedido.
 *
 * Funcao pura do quadro: percorre as chaves e interpola. Nao guarda estado
 * entre quadros, o que o Remotion exige e o que permite renderizar o quadro
 * 900 sem ter renderizado o 899.
 */
/**
 * Plano de dois: centro e zoom que fazem os DOIS lutadores caberem na tela.
 *
 * Calculado no quadro, a partir da posicao real de cada um. O zoom tem teto
 * para a camera nao fechar demais quando eles estao colados, e piso para nao
 * afastar tanto que o boneco vire formiga.
 */
export const enquadrarDois = (
  timeline: Timeline,
  frame: number,
  larguraTela: number,
  alturaQuadril: number,
): { center: Vec2; zoom: number } => {
  const { fighterA, fighterB } = timeline.spec;
  const a = amostrar(timeline.tracks[fighterA], frame);
  const b = amostrar(timeline.tracks[fighterB], frame);

  const meio = (a.x + b.x) / 2;
  const separacao = Math.abs(a.x - b.x);
  // a folga inclui o corpo de cada um e o membro estendido de um golpe
  const larguraNecessaria = separacao + 900;
  // piso 0.42 deixava o corpo com 8% da tela quando eles se separavam muito.
  // 0.58 e o limite em que a silhueta ainda se le num celular.
  const zoom = Math.min(1.15, Math.max(0.58, larguraTela / larguraNecessaria));

  return { center: { x: meio, y: alturaQuadril - 120 }, zoom };
};

export const cameraNoQuadro = (
  timeline: Timeline,
  frame: number,
  padrao: { center: Vec2; zoom: number },
  /** necessarios para o plano de dois */
  tela?: { largura: number; alturaQuadril: number },
): EstadoCamera => {
  const keys = timeline.cameraKeys;
  let atual: CameraKey | null = null;
  let anterior: { center: Vec2; zoom: number } = padrao;

  /** resolve uma chave: plano de dois, seguir alguem, ou centro fixo */
  const resolver = (k: CameraKey): { center: Vec2; zoom: number } => {
    if (k.fit && tela) {
      return enquadrarDois(timeline, frame, tela.largura, tela.alturaQuadril);
    }
    if (k.follow && timeline.tracks[k.follow]) {
      // posicao REAL no quadro, nao a congelada na compilacao
      const alvo = amostrar(timeline.tracks[k.follow], frame);
      return { center: { x: alvo.x, y: k.center.y }, zoom: k.zoom };
    }
    return { center: k.center, zoom: k.zoom };
  };

  for (const k of keys) {
    if (k.frame > frame) break;
    if (atual) anterior = resolver(atual);
    atual = k;
  }

  if (!atual) {
    const base = tela
      ? enquadrarDois(timeline, frame, tela.largura, tela.alturaQuadril)
      : padrao;
    return { center: base.center, zoom: base.zoom, shake: { x: 0, y: 0 } };
  }

  const alvo = resolver(atual);
  const dur = Math.max(1, atual.ease);
  const t = interpolate(frame, [atual.frame, atual.frame + dur], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  // suavizacao na entrada e na saida: e o que faz a camera parecer operada
  const s = t * t * (3 - 2 * t);

  const center: Vec2 = {
    x: anterior.center.x + (alvo.center.x - anterior.center.x) * s,
    y: anterior.center.y + (alvo.center.y - anterior.center.y) * s,
  };
  const zoom = anterior.zoom + (alvo.zoom - anterior.zoom) * s;

  return { center, zoom, shake: tremorNoQuadro(timeline, frame) };
};

/**
 * Tremor de tela no quadro pedido.
 *
 * Decai ao longo de ~12 quadros e troca de direcao a cada quadro. A direcao vem
 * do PRNG com semente (nunca de Math.random), senao cada quadro sortearia um
 * valor diferente a cada render e a imagem tremeria de forma inconsistente.
 */
export const tremorNoQuadro = (timeline: Timeline, frame: number): Vec2 => {
  let x = 0;
  let y = 0;
  const DURACAO = 12;

  for (const k of timeline.cameraKeys) {
    if (!k.shake) continue;
    const idade = frame - k.frame;
    if (idade < 0 || idade > DURACAO) continue;
    const decaimento = 1 - idade / DURACAO;
    const sinal = idade % 2 === 0 ? 1 : -1;
    const ang = hashRng(`shake-${k.frame}-${idade}`, timeline.spec.seed) * Math.PI * 2;
    x += Math.cos(ang) * k.shake * decaimento * sinal;
    y += Math.sin(ang) * k.shake * decaimento * sinal * 0.6;
  }
  return { x, y };
};

/**
 * Transformacao SVG que aplica a camera.
 *
 * Um unico atributo transform num <g> move o mundo inteiro, o que e muito mais
 * barato que transformar cada elemento.
 */
export const transformDaCamera = (
  cam: EstadoCamera,
  larguraTela: number,
  alturaTela: number,
): string => {
  const cx = larguraTela / 2 + cam.shake.x;
  const cy = alturaTela / 2 + cam.shake.y;
  return `translate(${cx} ${cy}) scale(${cam.zoom}) translate(${-cam.center.x} ${-cam.center.y})`;
};
