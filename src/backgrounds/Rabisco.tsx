/**
 * CENARIO EM RABISCO: um vilarejo (ou uma cidade) desenhado a caneta, que se
 * mexe.
 *
 * Tres coisas fazem ele parecer desenho a mao e vivo:
 *
 *  1. TRACO QUE FERVE ("line boil"): cada linha e redesenhada com um tremor
 *     novo a cada QUADROS_DO_TREMOR quadros, como animacao feita a mao em que
 *     cada desenho e refeito. Tremor a cada quadro vira chuvisco; a cada 5
 *     quadros (12 por segundo) le como desenho.
 *  2. TRACO DUPLO E PASSANDO DO CANTO: toda linha e desenhada duas vezes com
 *     tremores diferentes e passa um pouco das pontas, o jeito de quem
 *     rabisca rapido.
 *  3. COISAS SE MEXENDO: nuvens andando, passaros batendo asa, fumaca subindo
 *     das chamines, moinho girando, sol girando devagar.
 *
 * E PROFUNDIDADE por parallax: o fundo (morros, sol, nuvens) anda 20% do que
 * a camera anda, as casas 55%. Quando a camera segue um golpe, o cenario
 * desliza em camadas.
 *
 * Tudo em cinza claro e fino: o cenario e moldura, nunca pode competir com a
 * silhueta dos lutadores.
 */

import React from "react";
import { entre, hashRng } from "../core/rng";
import type { Vec2 } from "../core/types";

export type TemaDoRabisco = "vilarejo" | "cidade";

const QUADROS_DO_TREMOR = 5;
/** amplitude do tremor, em unidades de mundo */
const TREMOR = 3.2;
const COR_FUNDO = "#cfd3db";
const COR_MEIO = "#a9afbb";
const TRACO_FUNDO = 3.5;
const TRACO_MEIO = 4.5;

// ---- traco -------------------------------------------------------------------

/**
 * Uma linha rabiscada: subdivide, treme perpendicular ao traco e passa um
 * pouco das pontas. `chave` identifica a linha, `quadro` o desenho da vez.
 */
const linha = (
  pontos: Vec2[],
  chave: string,
  quadro: number,
  amp = TREMOR,
  passa = 7,
): string => {
  if (pontos.length < 2) return "";
  const pts = [...pontos];
  // passa do comeco e do fim
  const ext = (a: Vec2, b: Vec2): Vec2 => {
    const dx = a.x - b.x;
    const dy = a.y - b.y;
    const n = Math.hypot(dx, dy) || 1;
    return { x: a.x + (dx / n) * passa, y: a.y + (dy / n) * passa };
  };
  pts[0] = ext(pts[0], pts[1]);
  pts[pts.length - 1] = ext(pts[pts.length - 1], pts[pts.length - 2]);

  let d = "";
  let k = 0;
  for (let i = 0; i < pts.length - 1; i++) {
    const a = pts[i];
    const b = pts[i + 1];
    const comp = Math.hypot(b.x - a.x, b.y - a.y);
    const n = Math.max(1, Math.round(comp / 28));
    const nx = -(b.y - a.y) / (comp || 1);
    const ny = (b.x - a.x) / (comp || 1);
    for (let j = 0; j <= n; j++) {
      if (i > 0 && j === 0) continue;
      const t = j / n;
      const r = (hashRng(`${chave}-${quadro}-${k++}`, 7) * 2 - 1) * amp;
      const x = a.x + (b.x - a.x) * t + nx * r;
      const y = a.y + (b.y - a.y) * t + ny * r;
      d += `${d ? " L" : "M"} ${x.toFixed(1)} ${y.toFixed(1)}`;
    }
  }
  return d;
};

/** traco duplo: duas passadas com tremores diferentes */
const Traco: React.FC<{
  pontos: Vec2[];
  chave: string;
  quadro: number;
  cor: string;
  largura: number;
  fechado?: boolean;
}> = ({ pontos, chave, quadro, cor, largura, fechado }) => {
  const pts = fechado ? [...pontos, pontos[0]] : pontos;
  return (
    <>
      <path
        d={linha(pts, chave, quadro)}
        fill="none"
        stroke={cor}
        strokeWidth={largura}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d={linha(pts, `${chave}b`, quadro, TREMOR * 1.4, 4)}
        fill="none"
        stroke={cor}
        strokeWidth={largura * 0.55}
        strokeLinecap="round"
        strokeLinejoin="round"
        opacity={0.7}
      />
    </>
  );
};

/** retangulo de rabisco: quatro linhas soltas que passam dos cantos */
const Caixa: React.FC<{
  x: number;
  y: number;
  w: number;
  h: number;
  chave: string;
  quadro: number;
  cor: string;
  largura: number;
}> = ({ x, y, w, h, chave, quadro, cor, largura }) => (
  <>
    <Traco pontos={[{ x, y }, { x: x + w, y }]} chave={`${chave}t`} quadro={quadro} cor={cor} largura={largura} />
    <Traco pontos={[{ x: x + w, y }, { x: x + w, y: y + h }]} chave={`${chave}d`} quadro={quadro} cor={cor} largura={largura} />
    <Traco pontos={[{ x: x + w, y: y + h }, { x, y: y + h }]} chave={`${chave}b`} quadro={quadro} cor={cor} largura={largura} />
    <Traco pontos={[{ x, y: y + h }, { x, y }]} chave={`${chave}e`} quadro={quadro} cor={cor} largura={largura} />
  </>
);

/** circulo de rabisco: pouco mais de uma volta, com o raio variando */
const circulo = (c: Vec2, r: number, chave: string, voltas = 1.15): Vec2[] => {
  const n = Math.max(10, Math.round((r * voltas) / 9));
  return Array.from({ length: n + 1 }, (_, i) => {
    const a = (i / n) * Math.PI * 2 * voltas + hashRng(`${chave}-ini`, 3) * 6;
    const rr = r * (0.92 + 0.12 * hashRng(`${chave}-r${i}`, 3));
    return { x: c.x + Math.cos(a) * rr, y: c.y + Math.sin(a) * rr };
  });
};

// ---- elementos ---------------------------------------------------------------

const Nuvem: React.FC<{ c: Vec2; s: number; chave: string; quadro: number }> = ({ c, s, chave, quadro }) => {
  // tres arcos por cima e uma base reta: a nuvem de caderno
  const arco = (cx: number, cy: number, r: number): Vec2[] =>
    Array.from({ length: 10 }, (_, i) => {
      const a = Math.PI + (i / 9) * Math.PI;
      return { x: cx + Math.cos(a) * r, y: cy + Math.sin(a) * r * 0.9 };
    });
  return (
    <>
      <Traco pontos={arco(c.x - 60 * s, c.y, 45 * s)} chave={`${chave}a`} quadro={quadro} cor={COR_FUNDO} largura={TRACO_FUNDO} />
      <Traco pontos={arco(c.x, c.y - 20 * s, 60 * s)} chave={`${chave}b`} quadro={quadro} cor={COR_FUNDO} largura={TRACO_FUNDO} />
      <Traco pontos={arco(c.x + 65 * s, c.y, 42 * s)} chave={`${chave}c`} quadro={quadro} cor={COR_FUNDO} largura={TRACO_FUNDO} />
      <Traco pontos={[{ x: c.x - 110 * s, y: c.y }, { x: c.x + 112 * s, y: c.y }]} chave={`${chave}d`} quadro={quadro} cor={COR_FUNDO} largura={TRACO_FUNDO} />
    </>
  );
};

const Passaro: React.FC<{ c: Vec2; bate: number; chave: string; quadro: number }> = ({ c, bate, chave, quadro }) => {
  const asa = 14 + 12 * bate;
  return (
    <Traco
      pontos={[{ x: c.x - 26, y: c.y - asa }, { x: c.x, y: c.y }, { x: c.x + 26, y: c.y - asa }]}
      chave={chave}
      quadro={quadro}
      cor={COR_MEIO}
      largura={3.5}
    />
  );
};

/** fumaca: bolinhas que sobem, crescem e somem, em ciclo */
const Fumaca: React.FC<{ base: Vec2; frame: number; chave: string; quadro: number }> = ({ base, frame, chave, quadro }) => (
  <>
    {Array.from({ length: 4 }, (_, i) => {
      const ciclo = 150;
      const t = ((frame + i * (ciclo / 4)) % ciclo) / ciclo;
      const c = {
        x: base.x + Math.sin(t * 5 + i) * 14 + t * 40,
        y: base.y - t * 190,
      };
      const r = 10 + t * 26;
      return (
        <g key={i} opacity={1 - t}>
          <Traco pontos={circulo(c, r, `${chave}-${i}`)} chave={`${chave}-${i}`} quadro={quadro} cor={COR_FUNDO} largura={3} />
        </g>
      );
    })}
  </>
);

type Casa = { x: number; w: number; h: number; telhado: number; chamine: boolean; janelas: number };
type Predio = { x: number; w: number; h: number; colunas: number; antena: boolean };

const Moinho: React.FC<{ x: number; frame: number; quadro: number }> = ({ x, frame, quadro }) => {
  const topo = { x, y: -330 };
  const ang = frame * 0.02;
  return (
    <>
      <Traco pontos={[{ x: x - 55, y: -20 }, { x: x - 22, y: -330 }, { x: x + 22, y: -330 }, { x: x + 55, y: -20 }]} chave={`moinho-${x}`} quadro={quadro} cor={COR_MEIO} largura={TRACO_MEIO} />
      <Caixa x={x - 14} y={-80} w={28} h={60} chave={`moinho-p-${x}`} quadro={quadro} cor={COR_MEIO} largura={TRACO_MEIO * 0.8} />
      {[0, 1, 2, 3].map((i) => {
        const a = ang + (i * Math.PI) / 2;
        const ponta = { x: topo.x + Math.cos(a) * 150, y: topo.y + Math.sin(a) * 150 };
        const lado = { x: -Math.sin(a) * 26, y: Math.cos(a) * 26 };
        return (
          <Traco
            key={i}
            pontos={[topo, ponta, { x: ponta.x + lado.x, y: ponta.y + lado.y }, { x: topo.x + lado.x * 0.4 + Math.cos(a) * 40, y: topo.y + lado.y * 0.4 + Math.sin(a) * 40 }]}
            chave={`moinho-pa-${x}-${i}`}
            quadro={quadro}
            cor={COR_MEIO}
            largura={TRACO_MEIO * 0.8}
          />
        );
      })}
      <Traco pontos={circulo(topo, 12, `moinho-c-${x}`)} chave={`moinho-c-${x}`} quadro={quadro} cor={COR_MEIO} largura={TRACO_MEIO} />
    </>
  );
};

const Arvore: React.FC<{ x: number; s: number; quadro: number }> = ({ x, s, quadro }) => (
  <>
    <Traco pontos={[{ x, y: -10 }, { x: x + 4, y: -110 * s }]} chave={`tronco-${x}`} quadro={quadro} cor={COR_MEIO} largura={TRACO_MEIO} />
    <Traco pontos={circulo({ x: x + 4, y: -170 * s }, 70 * s, `copa-${x}`, 1.3)} chave={`copa-${x}`} quadro={quadro} cor={COR_MEIO} largura={TRACO_MEIO} />
  </>
);

// ---- cenario -----------------------------------------------------------------

export const Rabisco: React.FC<{
  seed: number;
  tema: TemaDoRabisco;
  /** centro x da camera, para o parallax */
  camX: number;
  /** quadro REAL: o traco continua fervendo durante o hit stop */
  frame: number;
  extensao?: number;
  /**
   * "fundo" desenha o que fica acima do chao (vai antes do piso); "chao" o
   * que fica abaixo da linha do chao (vai depois do piso, que e um retangulo
   * branco e cobriria tudo).
   */
  parte?: "fundo" | "chao";
}> = ({ seed, tema, camX, frame, extensao = 3400, parte = "fundo" }) => {
  const quadro = Math.floor(frame / QUADROS_DO_TREMOR);

  const casas = React.useMemo(() => {
    const lista: Casa[] = [];
    let x = -extensao;
    let i = 0;
    while (x < extensao) {
      const w = entre(`casa-w-${i}`, seed, 170, 300);
      lista.push({
        x,
        w,
        h: entre(`casa-h-${i}`, seed, 150, 250),
        telhado: entre(`casa-t-${i}`, seed, 80, 140),
        chamine: hashRng(`casa-c-${i}`, seed) > 0.45,
        janelas: 1 + Math.floor(hashRng(`casa-j-${i}`, seed) * 3),
      });
      x += w + entre(`casa-g-${i}`, seed, 60, 260);
      i++;
    }
    return lista;
  }, [seed, extensao]);

  const predios = React.useMemo(() => {
    const lista: Predio[] = [];
    let x = -extensao;
    let i = 0;
    while (x < extensao) {
      const w = entre(`pr-w-${i}`, seed, 150, 260);
      lista.push({
        x,
        w,
        h: entre(`pr-h-${i}`, seed, 320, 760),
        colunas: 2 + Math.floor(hashRng(`pr-c-${i}`, seed) * 3),
        antena: hashRng(`pr-a-${i}`, seed) > 0.6,
      });
      x += w + entre(`pr-g-${i}`, seed, 20, 90);
      i++;
    }
    return lista;
  }, [seed, extensao]);

  // camadas de parallax: so no eixo x, para o chao continuar no lugar
  const camada = (p: number) => `translate(${(camX * (1 - p)).toFixed(1)} 0)`;

  // o que esta fora da tela nao precisa ser desenhado: com parallax, a
  // posicao visivel de um elemento em x e (x + camX*(1-p))
  const visivel = (x: number, w: number, p: number) => {
    const noMundo = x + camX * (1 - p);
    return noMundo + w > camX - 900 && noMundo < camX + 900;
  };

  if (parte === "chao") {
    // o chao anda junto com o mundo (parallax 1): e onde os pes pisam
    return (
      <g data-layer="rabisco-chao">
        {tema === "cidade" ? (
          <>
            {/* calcada e rua com faixa tracejada */}
            <Traco pontos={[{ x: -extensao, y: 70 }, { x: extensao, y: 70 }]} chave="calcada" quadro={quadro} cor={COR_MEIO} largura={TRACO_MEIO} />
            {Array.from({ length: 34 }, (_, i) => {
              const x = -extensao + i * 200;
              if (Math.abs(x - camX) > 1000) return null;
              return (
                <Traco key={i} pontos={[{ x, y: 240 }, { x: x + 110, y: 240 }]} chave={`faixa-${i}`} quadro={quadro} cor={COR_MEIO} largura={TRACO_MEIO * 1.4} />
              );
            })}
            <Traco pontos={[{ x: -extensao, y: 400 }, { x: extensao, y: 400 }]} chave="meiofio" quadro={quadro} cor={COR_FUNDO} largura={TRACO_MEIO} />
          </>
        ) : (
          <>
            {/* estrada de terra: duas margens onduladas e pedrinhas */}
            <Traco
              pontos={Array.from({ length: 41 }, (_, i) => {
                const x = -extensao + (i / 40) * extensao * 2;
                return { x, y: 90 + 14 * Math.sin(x / 300) };
              })}
              chave="margem1"
              quadro={quadro}
              cor={COR_MEIO}
              largura={TRACO_MEIO}
            />
            <Traco
              pontos={Array.from({ length: 41 }, (_, i) => {
                const x = -extensao + (i / 40) * extensao * 2;
                return { x, y: 330 + 18 * Math.sin(x / 380 + 2) };
              })}
              chave="margem2"
              quadro={quadro}
              cor={COR_FUNDO}
              largura={TRACO_MEIO}
            />
            {Array.from({ length: 60 }, (_, i) => {
              const x = entre(`pedra-x-${i}`, seed, -extensao, extensao);
              if (Math.abs(x - camX) > 1000) return null;
              const y = entre(`pedra-y-${i}`, seed, 130, 300);
              const r = entre(`pedra-r-${i}`, seed, 6, 16);
              return (
                <Traco key={i} pontos={circulo({ x, y }, r, `pedra-${i}`)} chave={`pedra-${i}`} quadro={quadro} cor={COR_FUNDO} largura={3} />
              );
            })}
          </>
        )}
      </g>
    );
  }

  return (
    <g data-layer="rabisco">
      {/* ---- FUNDO: sol, nuvens, morros, passaros (20%) ---- */}
      <g transform={camada(0.2)}>
        <g transform={`rotate(${(frame * 0.15) % 360} 380 -1010)`}>
          <Traco pontos={circulo({ x: 380, y: -1010 }, 80, "sol")} chave="sol" quadro={quadro} cor={COR_FUNDO} largura={TRACO_FUNDO} />
          {Array.from({ length: 10 }, (_, i) => {
            const a = (i / 10) * Math.PI * 2;
            return (
              <Traco
                key={i}
                pontos={[
                  { x: 380 + Math.cos(a) * 110, y: -1010 + Math.sin(a) * 110 },
                  { x: 380 + Math.cos(a) * 150, y: -1010 + Math.sin(a) * 150 },
                ]}
                chave={`raio-${i}`}
                quadro={quadro}
                cor={COR_FUNDO}
                largura={TRACO_FUNDO}
              />
            );
          })}
        </g>
        {Array.from({ length: 7 }, (_, i) => {
          // nuvens andando e dando a volta no mundo
          const vao = 2 * extensao;
          const x0 = entre(`nuvem-x-${i}`, seed, -extensao, extensao);
          const x = ((x0 + frame * (0.35 + 0.15 * (i % 3)) + extensao) % vao) - extensao;
          const y = entre(`nuvem-y-${i}`, seed, -1150, -760);
          const s = entre(`nuvem-s-${i}`, seed, 0.7, 1.2);
          if (!visivel(x, 250 * s, 0.2) && !visivel(x - 250 * s, 250 * s, 0.2)) return null;
          return <Nuvem key={i} c={{ x, y }} s={s} chave={`nuvem-${i}`} quadro={quadro} />;
        })}
        <Traco
          pontos={Array.from({ length: 41 }, (_, i) => {
            const x = -extensao + (i / 40) * extensao * 2;
            return { x, y: -120 - 90 * (0.5 + 0.5 * Math.sin(x / 520 + 1.3)) - 40 * Math.sin(x / 190) };
          })}
          chave="morros"
          quadro={quadro}
          cor={COR_FUNDO}
          largura={TRACO_FUNDO}
        />
        {Array.from({ length: 5 }, (_, i) => {
          const vao = 2 * extensao;
          const x0 = entre(`ave-x-${i}`, seed, -extensao, extensao);
          const x = ((x0 - frame * 1.6 + vao * 10) % vao) - extensao;
          const y = entre(`ave-y-${i}`, seed, -900, -640) + Math.sin(frame * 0.05 + i) * 20;
          const bate = Math.sin(frame * 0.35 + i * 1.7);
          return <Passaro key={i} c={{ x, y }} bate={bate} chave={`ave-${i}`} quadro={quadro} />;
        })}
      </g>

      {/* ---- MEIO: casas ou predios (55%) ---- */}
      <g transform={camada(0.55)}>
        {tema === "vilarejo"
          ? casas.map((c, i) => {
              if (!visivel(c.x, c.w, 0.55)) return null;
              const base = -14;
              const topo = base - c.h;
              const k = `casa-${i}`;
              const jw = 38;
              return (
                <g key={k}>
                  <Caixa x={c.x} y={topo} w={c.w} h={c.h} chave={k} quadro={quadro} cor={COR_MEIO} largura={TRACO_MEIO} />
                  {/* telhado com hachura */}
                  <Traco
                    pontos={[{ x: c.x - 22, y: topo }, { x: c.x + c.w / 2, y: topo - c.telhado }, { x: c.x + c.w + 22, y: topo }]}
                    chave={`${k}-tel`}
                    quadro={quadro}
                    cor={COR_MEIO}
                    largura={TRACO_MEIO}
                  />
                  {Array.from({ length: 4 }, (_, h) => {
                    const t = (h + 1) / 5;
                    const x = c.x - 22 + (c.w + 44) * t;
                    const yTopo = topo - c.telhado * (1 - Math.abs(t - 0.5) * 2);
                    return (
                      <Traco
                        key={h}
                        pontos={[{ x: x - 14, y: topo - 6 }, { x: x + 10, y: yTopo + 14 }]}
                        chave={`${k}-hach-${h}`}
                        quadro={quadro}
                        cor={COR_FUNDO}
                        largura={2.5}
                      />
                    );
                  })}
                  {c.chamine && (
                    <>
                      <Caixa x={c.x + c.w * 0.68} y={topo - c.telhado * 0.75} w={30} h={c.telhado * 0.45} chave={`${k}-ch`} quadro={quadro} cor={COR_MEIO} largura={TRACO_MEIO * 0.8} />
                      <Fumaca base={{ x: c.x + c.w * 0.68 + 15, y: topo - c.telhado * 0.8 }} frame={frame + i * 37} chave={`${k}-fu`} quadro={quadro} />
                    </>
                  )}
                  {/* porta e janelas */}
                  <Caixa x={c.x + c.w * 0.14} y={base - 90} w={46} h={90} chave={`${k}-po`} quadro={quadro} cor={COR_MEIO} largura={TRACO_MEIO * 0.8} />
                  {Array.from({ length: c.janelas }, (_, j) => {
                    const x = c.x + c.w * 0.14 + 70 + j * (jw + 22);
                    if (x + jw > c.x + c.w - 10) return null;
                    const y = topo + c.h * 0.3;
                    return (
                      <g key={j}>
                        <Caixa x={x} y={y} w={jw} h={jw} chave={`${k}-ja-${j}`} quadro={quadro} cor={COR_MEIO} largura={TRACO_MEIO * 0.7} />
                        <Traco pontos={[{ x: x + jw / 2, y }, { x: x + jw / 2, y: y + jw }]} chave={`${k}-jx-${j}`} quadro={quadro} cor={COR_FUNDO} largura={2.5} />
                        <Traco pontos={[{ x, y: y + jw / 2 }, { x: x + jw, y: y + jw / 2 }]} chave={`${k}-jy-${j}`} quadro={quadro} cor={COR_FUNDO} largura={2.5} />
                      </g>
                    );
                  })}
                  {i % 3 === 1 && <Arvore x={c.x + c.w + 50} s={1} quadro={quadro} />}
                  {i % 7 === 3 && <Moinho x={c.x + c.w + 150} frame={frame} quadro={quadro} />}
                </g>
              );
            })
          : predios.map((p, i) => {
              if (!visivel(p.x, p.w, 0.55)) return null;
              const base = -14;
              const topo = base - p.h;
              const k = `pr-${i}`;
              const linhas = Math.floor((p.h - 60) / 70);
              return (
                <g key={k}>
                  <Caixa x={p.x} y={topo} w={p.w} h={p.h} chave={k} quadro={quadro} cor={COR_MEIO} largura={TRACO_MEIO} />
                  {p.antena && (
                    <Traco pontos={[{ x: p.x + p.w * 0.6, y: topo }, { x: p.x + p.w * 0.6, y: topo - 90 }]} chave={`${k}-an`} quadro={quadro} cor={COR_MEIO} largura={3.5} />
                  )}
                  {/* janelas: algumas acendem e apagam, a cidade vive */}
                  {Array.from({ length: linhas }, (_, l) =>
                    Array.from({ length: p.colunas }, (_, c) => {
                      const jw = (p.w - 30) / p.colunas - 14;
                      const x = p.x + 18 + c * (jw + 14);
                      const y = topo + 30 + l * 70;
                      const acesa = hashRng(`${k}-${l}-${c}-${Math.floor((frame + (l * 7 + c) * 40) / 150)}`, seed) > 0.72;
                      return (
                        <g key={`${l}-${c}`}>
                          {acesa && <rect x={x} y={y} width={jw} height={40} fill="#ffe9a8" opacity={0.55} />}
                          <Caixa x={x} y={y} w={jw} h={40} chave={`${k}-j-${l}-${c}`} quadro={quadro} cor={COR_FUNDO} largura={2.5} />
                        </g>
                      );
                    }),
                  )}
                </g>
              );
            })}
      </g>

      {/* ---- PERTO: cerca e tufos de mato (85%), baixos, atras dos pes ---- */}
      <g transform={camada(0.85)}>
        {Array.from({ length: 40 }, (_, i) => {
          const x = -extensao + i * 170 + entre(`tufo-${i}`, seed, -40, 40);
          if (!visivel(x, 60, 0.85)) return null;
          const vento = Math.sin(frame * 0.06 + i) * 6;
          return (
            <Traco
              key={i}
              pontos={[{ x: x - 16, y: -8 }, { x: x - 8 + vento, y: -40 }, { x, y: -8 }, { x: x + 6 + vento, y: -50 }, { x: x + 14, y: -8 }]}
              chave={`tufo-${i}`}
              quadro={quadro}
              cor={COR_MEIO}
              largura={3.5}
            />
          );
        })}
      </g>
    </g>
  );
};
