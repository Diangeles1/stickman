/**
 * Particulas sem simulacao.
 *
 * O Remotion renderiza o quadro 900 sem ter renderizado o 899, entao nao da
 * para guardar estado de particula entre quadros. A solucao: cada particula
 * tem velocidade inicial FIXA (derivada da semente) e a posicao dela no quadro
 * f e calculada por balistica.
 *
 *   p(t) = p0 + v0*t + (g*t^2)/2
 *
 * Resultado: a particula 7 do impacto 3 esta sempre no mesmo lugar no quadro
 * 412, em qualquer render e em qualquer processo. E mais barato que simular,
 * porque nao precisa dos quadros anteriores.
 */

import { entre, hashRng } from "../core/rng";
import type { ImpactTier, Vec2 } from "../core/types";

export type Particula = {
  pos: Vec2;
  raio: number;
  opacidade: number;
};

/**
 * Quantas particulas e com que forca, por peso de impacto.
 *
 * O briefing e explicito: nao usar todos os efeitos ao mesmo tempo, e um soco
 * normal tem que ser diferente de um golpe final. Esta tabela e onde isso mora.
 */
export const PERFIL_IMPACTO: Record<
  ImpactTier,
  {
    particulas: number;
    velocidade: number;
    vida: number;
    raio: [number, number];
    /** poeira que sobe do chao, alem dos estilhacos do golpe */
    poeiraDoChao: number;
    flash: number;
    ondas: number;
    speedLines: boolean;
  }
> = {
  light: {
    particulas: 14,
    velocidade: 620,
    vida: 20,
    raio: [3, 8],
    poeiraDoChao: 0,
    // o clarao radial no ponto de contato substituiu o flash de tela
    flash: 0,
    ondas: 1,
    speedLines: false,
  },
  medium: {
    // 40 particulas por 40 quadros deixavam uma nuvem parada no ar por dois
    // tercos de segundo depois de um soco. Estilhaco tem que sumir rapido.
    particulas: 15,
    velocidade: 1150,
    vida: 18,
    raio: [4, 13],
    // soco no peito nao levanta poeira do CHAO. Isso e para golpe que bate
    // no solo, e era o que fazia uma bola branca aparecer aos pes do alvo.
    poeiraDoChao: 0,
    // 0.2 de branco sobre um fundo quase preto clareia a cena inteira, e com
    // o hit stop a lavagem durava 7 quadros. Quem marca o golpe agora e o
    // clarao radial no ponto de contato (ver Clarao). Tela cheia ficou so
    // para o golpe final.
    flash: 0,
    ondas: 1,
    speedLines: true,
  },
  extreme: {
    // 96 estilhacos por 52 quadros mais 46 de poeira viravam uma nuvem branca
    // que cobria o corpo do lutador lancado. A regra e dura na diretiva: o
    // efeito reforca a animacao, nao esconde uma animacao ruim, e aqui a
    // animacao e justamente o que se quer ver.
    particulas: 46,
    velocidade: 2100,
    vida: 32,
    raio: [5, 16],
    poeiraDoChao: 22,
    // 0.14 de branco sobre a tela inteira lavava a imagem por 0,2s, porque o
    // hit stop de 8 quadros congela o quadro logico e o flash fica parado
    // junto. Quem marca o impacto e o clarao radial no ponto de contato; a
    // tela cheia so da a piscada, e piscada e curta.
    flash: 0.07,
    ondas: 2,
    speedLines: true,
  },
};

const GRAVIDADE = 2600; // unidades de mundo por segundo ao quadrado

/**
 * Particulas de um impacto no quadro pedido.
 *
 * idade e em quadros desde o contato. Devolve lista vazia quando o impacto ja
 * passou, entao o custo cai a zero sozinho.
 */
export const particulasDoImpacto = (
  chave: string,
  semente: number,
  origem: Vec2,
  tier: ImpactTier,
  direcao: number,
  idade: number,
  fps: number,
): Particula[] => {
  const perfil = PERFIL_IMPACTO[tier];
  if (idade < 0 || idade > perfil.vida) return [];

  const saida: Particula[] = [];
  const t = idade / fps;

  for (let i = 0; i < perfil.particulas; i++) {
    const id = `${chave}-p${i}`;
    // o leque abre para o lado do golpe, nao em circulo: golpe empurra
    const ang =
      entre(`${id}-a`, semente, -1.15, 1.15) + (direcao > 0 ? 0 : Math.PI);
    const vel = entre(`${id}-v`, semente, 0.35, 1) * perfil.velocidade;
    const vidaDesta = perfil.vida * entre(`${id}-l`, semente, 0.55, 1);
    if (idade > vidaDesta) continue;

    const v0: Vec2 = { x: Math.cos(ang) * vel, y: Math.sin(ang) * vel * 0.8 };
    const pos: Vec2 = {
      x: origem.x + v0.x * t,
      y: origem.y + v0.y * t + (GRAVIDADE * t * t) / 2,
    };
    // nao atravessa o chao
    if (pos.y > 0) pos.y = 0;

    const restante = 1 - idade / vidaDesta;
    saida.push({
      pos,
      raio: entre(`${id}-r`, semente, perfil.raio[0], perfil.raio[1]),
      opacidade: Math.max(0, restante) * 0.9,
    });
  }

  // poeira do chao: sobe devagar e quase nao cai, o que da volume ao impacto
  for (let i = 0; i < perfil.poeiraDoChao; i++) {
    const id = `${chave}-d${i}`;
    const vidaDesta = perfil.vida * entre(`${id}-l`, semente, 0.8, 1.5);
    if (idade > vidaDesta) continue;
    const ang = entre(`${id}-a`, semente, -Math.PI, 0);
    const vel = entre(`${id}-v`, semente, 0.2, 0.7) * perfil.velocidade * 0.5;
    // espalhamento inicial: sem ele as particulas nascem TODAS no mesmo ponto
    // e no quadro do impacto a nuvem e uma bola solida
    const espalha = entre(`${id}-e`, semente, -90, 90);
    const pos: Vec2 = {
      x: origem.x + espalha + Math.cos(ang) * vel * t,
      y: Math.min(0, Math.sin(ang) * vel * t + (GRAVIDADE * 0.12 * t * t) / 2),
    };
    saida.push({
      pos,
      raio: entre(`${id}-r`, semente, 10, 26),
      opacidade: Math.max(0, 1 - idade / vidaDesta) * 0.2,
    });
  }

  return saida;
};

/** Poeira ambiente flutuando no ar, para o cenario nao ficar morto. */
export const poeiraAmbiente = (
  semente: number,
  frame: number,
  fps: number,
  quantidade = 40,
  extensao = 2200,
): Particula[] => {
  const t = frame / fps;
  return Array.from({ length: quantidade }, (_, i) => {
    const id = `amb-${i}`;
    const x0 = entre(`${id}-x`, semente, -extensao, extensao);
    const y0 = entre(`${id}-y`, semente, -1500, -60);
    const deriva = entre(`${id}-d`, semente, -18, 18);
    const subida = entre(`${id}-s`, semente, -26, -8);
    const periodo = entre(`${id}-p`, semente, 7, 16);
    // sobe e volta, em loop, para nunca sumir da tela
    const fase = (t / periodo) % 1;
    return {
      pos: { x: x0 + deriva * t, y: y0 + subida * periodo * fase },
      raio: entre(`${id}-r`, semente, 2.5, 6.5),
      opacidade: 0.1 + hashRng(`${id}-o`, semente) * 0.16,
    };
  });
};
