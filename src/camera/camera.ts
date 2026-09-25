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
 * Folga horizontal do plano de dois, em unidades de mundo.
 *
 * Cobre a largura dos dois corpos mais o membro estendido de um golpe. Estava
 * em 900, o que era quase um corpo e meio de ar desperdicado: num quadro
 * VERTICAL a largura e o recurso escasso, e cada unidade de folga tira tamanho
 * do personagem.
 */
const FOLGA_LATERAL = 620;

/**
 * Zoom minimo em que o corpo ainda se le num celular.
 *
 * Com o corpo de 597 unidades numa tela de 1920, 0.88 deixa o personagem com
 * 27% da altura. Abaixo disso, em Shorts, o boneco vira formiga.
 *
 * E este piso, e nao o enquadramento, que manda. Quando os dois nao cabem
 * juntos neste zoom, a camera PREFERE perder um deles de vista a encolher a
 * acao: era isso que acontecia depois do knockback, com os dois pequenos no
 * meio de uma tela vazia.
 */
const ZOOM_MINIMO_LEGIVEL = 0.88;

/**
 * LUTA ARMADA abre mais. A katana estica a silhueta em quase meio corpo para
 * cada lado, entao a distancia de combate de um corte e ~250 unidades maior
 * que a de um soco, e no zoom minimo do combate desarmado um dos dois ficava
 * fora do quadro. Aqui o corpo fica menor, mas a lamina continua lendo: o que
 * se perde em tamanho se ganha em silhueta.
 */
const ZOOM_MINIMO_ARMADO = 0.74;

/** Teto: acima disso a camera fecha tanto que corta os proprios lutadores. */
const ZOOM_MAXIMO = 1.2;

/**
 * Plano de dois: centro e zoom que fazem os DOIS lutadores caberem na tela.
 *
 * Quando eles nao cabem no zoom minimo legivel, o enquadramento passa a seguir
 * o PONTO DE ACAO (quem levou o ultimo golpe), puxado na direcao do meio para
 * o outro nao sumir de vez. Perder um pedaco do atacante e melhor do que
 * perder a leitura dos dois.
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

  // Corpo DEITADO nao ocupa o quadril: ele se estende para o lado da cabeca
  // (para longe do outro). Enquadrando so o quadril, a cabeca de quem caiu
  // ficava cortada na borda da tela no fim da luta.
  const DEITADO = new Set(["downed", "groundHit", "sitUp"]);
  const centroVisivel = (eu: typeof a, outro: typeof a): number => {
    if (!DEITADO.has(eu.poseNome)) return eu.x;
    const lado = eu.x <= outro.x ? -1 : 1;
    return eu.x + lado * 150;
  };
  const ax = centroVisivel(a, b);
  const bx = centroVisivel(b, a);
  const meio = (ax + bx) / 2;
  const separacao = Math.abs(ax - bx);
  const zoomQueCabe = larguraTela / (separacao + FOLGA_LATERAL);
  const minimo = timeline.spec.armas ? ZOOM_MINIMO_ARMADO : ZOOM_MINIMO_LEGIVEL;

  if (zoomQueCabe >= minimo) {
    return {
      center: { x: meio, y: alturaQuadril - 120 },
      zoom: Math.min(ZOOM_MAXIMO, zoomQueCabe),
    };
  }

  // Nao cabem. Quem manda agora e a acao: o ultimo lutador atingido.
  const ultimo = timeline.impacts
    .filter((i) => i.victim && i.frame <= frame)
    .pop();
  const foco =
    ultimo?.victim === fighterB ? bx : ultimo?.victim === fighterA ? ax : meio;

  // 0.72 no foco e 0.28 no meio: o atingido fica folgado no quadro e o outro
  // entra pela borda, o que mantem a relacao entre os dois legivel.
  return {
    center: { x: foco * 0.72 + meio * 0.28, y: alturaQuadril - 120 },
    zoom: minimo,
  };
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
      const { fighterA, fighterB } = timeline.spec;
      const outroId = k.follow === fighterA ? fighterB : fighterA;
      const outro = amostrar(timeline.tracks[outroId], frame);
      // Segue quem voa, mas puxado na direcao do outro: centrada so em quem
      // voa, a camera deixava o outro lutador meio cortado na borda durante
      // o voo inteiro (a 0.72 ainda cortava o comeco do voo).
      return {
        center: { x: alvo.x * 0.58 + outro.x * 0.42, y: k.center.y },
        zoom: k.zoom,
      };
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
