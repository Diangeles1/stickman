/**
 * PODERES: gelo e fogo como SISTEMAS, nao como enfeite.
 *
 * Cada efeito le um PoderEvent da timeline (quando, onde, de quem) e desenha
 * o resultado no quadro pedido, deterministico. O compilador decide a
 * coreografia; aqui so se decide a aparencia.
 *
 * A regra visual do roteiro:
 *   GELO  = controle, velocidade, precisao: formas retas e afiadas
 *           (estilhacos, cristais, rachaduras), cores frias, movimento limpo
 *   FOGO  = forca, explosao, agressividade: formas redondas e caoticas
 *           (labaredas, bolas, fumaca), cores quentes, tudo tremendo
 *
 * E os dois INTERAGEM: fogo em cima de gelo vira vapor, o chao congelado
 * derrete onde o fogo passa, o gelo apaga as brasas.
 *
 * Camadas:
 *   "chao"   o que fica no piso (gelo, brasa, rachadura, poca de sangue)
 *   "atras"  auras, atras dos corpos
 *   "frente" projeteis, explosoes, feixes, vapor, gotas de sangue
 */

import React from "react";
import type { Corpo } from "../animation/corpo";
import { juntasDoCorpo } from "../animation/corpo";
import type { AncoraDePoder, FighterId, NomeDePaleta, PoderEvent, TipoPoder, Timeline, Vec2 } from "../core/types";

// ---- utilidades --------------------------------------------------------------

const ruido = (n: number): number => {
  const x = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
};
const clamp01 = (v: number) => Math.max(0, Math.min(1, v));
const saiRapido = (t: number) => 1 - (1 - clamp01(t)) ** 3;
const progresso = (e: PoderEvent, f: number) => clamp01((f - e.from) / Math.max(1, e.to - e.from));
const ativo = (e: PoderEvent, f: number, antes = 0, depois = 0) => f >= e.from - antes && f <= e.to + depois;

const GELO = { claro: "#e9fbff", medio: "#8fe3ff", forte: "#38b8ff", fundo: "#1d6fb8" };
const FOGO = { claro: "#fff3b0", medio: "#ffb02e", forte: "#ff5a14", fundo: "#b3200e" };
const SANGUE = "#d4141f";

/**
 * PALETAS. Um efeito e uma forma; a cor decide de quem ele e. Manter as cores
 * aqui, e nao dentro de cada componente, e o que permite o mesmo feixe servir
 * ao fogo e a energia sem duplicar o desenho.
 */
const PALETAS: Record<NomeDePaleta, { claro: string; medio: string; forte: string; fundo: string }> = {
  fogo: FOGO,
  gelo: GELO,
  // energia do vazio: violeta com nucleo quase branco, o mais brilhante de
  // todas -- e o golpe que encerra a troca
  vazio: { claro: "#f6e9ff", medio: "#c77dff", forte: "#8b2fd6", fundo: "#4a108a" },
  azul: { claro: "#e6f4ff", medio: "#6fb7ff", forte: "#1f6bff", fundo: "#0b2f8a" },
  vermelho: { claro: "#ffe6e6", medio: "#ff7a6b", forte: "#e01f1f", fundo: "#7a0a0a" },
  // corte e chama do marcado: carmesim escuro puxando para o preto
  sombra: { claro: "#ffd9cf", medio: "#ff6b4a", forte: "#c2181b", fundo: "#3d0710" },
};

/** Paleta de um efeito: a declarada, ou a natural do tipo. */
const paletaDe = (e: PoderEvent, padrao: typeof FOGO) =>
  e.paleta ? PALETAS[e.paleta] : padrao;

// ---- ancoragem ---------------------------------------------------------------

type Juntas = ReturnType<typeof juntasDoCorpo>;

const PONTO_DE_ANCORA: Record<AncoraDePoder, (j: Juntas) => Vec2> = {
  maoFrente: (j) => j.handFront,
  maoTras: (j) => j.handBack,
  entreMaos: (j) => ({
    x: (j.handFront.x + j.handBack.x) / 2,
    y: (j.handFront.y + j.handBack.y) / 2,
  }),
  peito: (j) => ({
    x: j.neck.x + (j.hip.x - j.neck.x) * 0.3,
    y: j.neck.y + (j.hip.y - j.neck.y) * 0.3,
  }),
  cabeca: (j) => j.head,
};

/**
 * Origem do efeito LIDA DO CORPO VIVO, quando ele declara uma ancora.
 *
 * O compilador nao tem como saber onde a mao vai estar: ele roda antes da
 * amostragem, com a posicao que o lutador tinha no beat. Entre um e outro o
 * corpo respirou, trocou de pose e andou -- e a esfera nascia longe da mao que
 * devia estar segurando ela.
 *
 * Aqui `a` vira deslocamento em relacao a junta, com x espelhado pelo facing
 * para o offset acompanhar quem virou de lado. Sem ancora nada muda: quem tem
 * lugar no mundo (rachadura, gelo na rua) continua com posicao absoluta.
 */
const ancorado = (e: PoderEvent, corpo?: Corpo): PoderEvent => {
  if (!e.ancora || !corpo) return e;
  const base = PONTO_DE_ANCORA[e.ancora](juntasDoCorpo(corpo));
  const d = e.a ?? { x: 0, y: 0 };
  return { ...e, a: { x: base.x + d.x * corpo.facing, y: base.y + d.y } };
};

/**
 * BRILHO. Energia sem glow le como adesivo recortado e colado na cena: a
 * forma esta certa mas nao EMITE luz, e o olho cobra isso. Dois desfoques
 * somados sob o desenho original dao halo largo e nucleo quente ao mesmo
 * tempo, que e como fonte de luz se comporta.
 *
 * Os ids sao globais no documento; os defs entram em toda camada porque
 * qualquer uma pode ser a primeira a desenhar.
 */
const DefsDePoder: React.FC = () => (
  <defs>
    <filter id="pw-glow-forte" x="-90%" y="-90%" width="280%" height="280%">
      <feGaussianBlur stdDeviation="30" result="largo" />
      <feGaussianBlur stdDeviation="10" result="perto" />
      <feMerge>
        <feMergeNode in="largo" />
        <feMergeNode in="perto" />
        <feMergeNode in="perto" />
        <feMergeNode in="SourceGraphic" />
      </feMerge>
    </filter>
    <filter id="pw-glow-medio" x="-70%" y="-70%" width="240%" height="240%">
      <feGaussianBlur stdDeviation="14" result="largo" />
      <feGaussianBlur stdDeviation="5" result="perto" />
      <feMerge>
        <feMergeNode in="largo" />
        <feMergeNode in="perto" />
        <feMergeNode in="SourceGraphic" />
      </feMerge>
    </filter>
  </defs>
);

/**
 * FAISCAS com fisica. Cada uma sai numa direcao propria, desacelera no ar e
 * CAI -- a gravidade e o que separa faisca de confete. Determinista pela
 * semente, entao o mesmo quadro sempre da o mesmo desenho.
 */
const Faiscas: React.FC<{
  a: Vec2;
  idade: number;
  forca: number;
  cor: { claro: string; medio: string; forte: string; fundo: string };
  semente: number;
  quantidade?: number;
  espalha?: number;
}> = ({ a, idade, forca, cor, semente, quantidade = 22, espalha = Math.PI * 2 }) => {
  if (idade < 0) return null;
  const t = idade / 60;
  return (
    <g data-poder="faiscas">
      {Array.from({ length: quantidade }, (_, i) => {
        const r1 = ruido(semente + i * 7.3);
        const r2 = ruido(semente + i * 3.1 + 11);
        const r3 = ruido(semente + i * 5.7 + 23);
        // vida propria: faisca que morre toda junta denuncia o laco
        const vida = 0.35 + r3 * 0.75;
        const k = t / vida;
        if (k >= 1) return null;
        const ang = (r1 - 0.5) * espalha - Math.PI / 2;
        const vel = forca * (0.5 + r2 * 1.5);
        // arrasto: a faisca perde velocidade em vez de seguir reta
        const arrasto = 1 - Math.exp(-t * 3.2);
        const x = a.x + Math.cos(ang) * vel * arrasto;
        const y = a.y + Math.sin(ang) * vel * arrasto + 900 * t * t;
        const some = 1 - k * k;
        const comp = 6 + r2 * 16;
        return (
          <line
            key={i}
            x1={x}
            y1={y}
            x2={x - Math.cos(ang) * comp * arrasto}
            y2={y - Math.sin(ang) * comp * arrasto - 60 * t * t}
            stroke={r1 > 0.6 ? cor.claro : cor.medio}
            strokeWidth={1.5 + r3 * 2.5}
            strokeLinecap="round"
            opacity={some}
          />
        );
      })}
    </g>
  );
};

/**
 * ONDA DE CHOQUE: anel fino que abre rapido e some. O ar deslocado e o que
 * vende o tamanho do golpe -- sem ele a explosao fica do tamanho do desenho,
 * com ele fica do tamanho do espaco que ela empurrou.
 *
 * Achatado na vertical de proposito: onda no chao abre mais na horizontal.
 */
const OndaDeChoque: React.FC<{
  a: Vec2;
  idade: number;
  forca: number;
  cor: { claro: string; medio: string; forte: string; fundo: string };
  duracao?: number;
}> = ({ a, idade, forca, cor, duracao = 22 }) => {
  if (idade < 0 || idade > duracao) return null;
  const t = idade / duracao;
  const r = forca * saiRapido(t) * 1.6;
  const some = (1 - t) ** 1.6;
  return (
    <g data-poder="onda-de-choque" opacity={some}>
      <ellipse cx={a.x} cy={a.y} rx={r} ry={r * 0.72} fill="none" stroke={cor.claro} strokeWidth={9 * (1 - t) + 1} />
      <ellipse cx={a.x} cy={a.y} rx={r * 0.82} ry={r * 0.58} fill="none" stroke={cor.medio} strokeWidth={5 * (1 - t) + 1} opacity={0.7} />
    </g>
  );
};

// ---- efeitos no chao ---------------------------------------------------------

/** faixa de gelo no piso que se espalha de a.x ate b.x, com rachaduras */
const GeloNoChao: React.FC<{ e: PoderEvent; f: number }> = ({ e, f }) => {
  if (f < e.from) return null;
  const x0 = e.a?.x ?? 0;
  const x1 = e.b?.x ?? x0;
  const alcance = saiRapido((f - e.from) / Math.max(1, e.to - e.from));
  // derrete: forca guarda o quadro em que o fogo acaba com ele (0 = nunca)
  const derrete = e.forca ? clamp01((f - e.forca) / 40) : 0;
  if (derrete >= 1) return null;
  const esq = Math.min(x0, x0 + (x1 - x0) * alcance, x0 - Math.abs(x1 - x0) * alcance * 0.35);
  const dir = Math.max(x0, x0 + (x1 - x0) * alcance, x0 + Math.abs(x1 - x0) * alcance * 0.35);
  const op = 1 - derrete;
  const semente = Math.round(x0);
  const cristais = Math.floor((dir - esq) / 38);
  return (
    <g data-poder="gelo-no-chao" opacity={op}>
      <rect x={esq} y={-6} width={dir - esq} height={46} fill={GELO.medio} opacity={0.45} />
      <rect x={esq} y={-6} width={dir - esq} height={10} fill={GELO.claro} opacity={0.8} />
      {/* rachaduras brancas no gelo */}
      {Array.from({ length: Math.floor((dir - esq) / 90) }, (_, i) => {
        const x = esq + 40 + i * 90 + ruido(semente + i) * 30;
        return (
          <path
            key={i}
            d={`M${x} 2 L${x + 14} 14 L${x + 6} 24 L${x + 26} 36`}
            stroke="#ffffff"
            strokeWidth={3}
            fill="none"
            opacity={0.8}
          />
        );
      })}
      {/* cristais espetados saindo do chao */}
      {Array.from({ length: cristais }, (_, i) => {
        const x = esq + 20 + i * 38 + ruido(semente * 3 + i) * 20;
        const h = 18 + 34 * ruido(semente * 7 + i);
        const inclina = (ruido(semente * 11 + i) - 0.5) * 16;
        return (
          <path
            key={`c${i}`}
            d={`M${x - 7} 0 L${x + inclina} ${-h} L${x + 7} 0 Z`}
            fill={i % 2 ? GELO.claro : GELO.medio}
            stroke={GELO.forte}
            strokeWidth={2}
            opacity={0.9}
          />
        );
      })}
    </g>
  );
};

/** chao queimado: brasa vermelha com rachaduras que brilham */
const ChaoQueimado: React.FC<{ e: PoderEvent; f: number }> = ({ e, f }) => {
  if (f < e.from) return null;
  const x0 = e.a?.x ?? 0;
  const raio = (e.forca ?? 160) * saiRapido((f - e.from) / 30);
  const pulso = 0.7 + 0.3 * Math.sin(f * 0.25);
  const semente = Math.round(x0);
  return (
    <g data-poder="chao-queimado">
      <ellipse cx={x0} cy={6} rx={raio} ry={raio * 0.12} fill="#2a0c06" opacity={0.75} />
      <ellipse cx={x0} cy={4} rx={raio * 0.8} ry={raio * 0.08} fill={FOGO.fundo} opacity={0.35 * pulso} />
      {Array.from({ length: 6 }, (_, i) => {
        const x = x0 + (ruido(semente + i) - 0.5) * raio * 1.6;
        return (
          <path
            key={i}
            d={`M${x} 2 l${10 + ruido(i) * 20} 6 l${-6} 8 l${18} 4`}
            stroke={FOGO.medio}
            strokeWidth={3}
            fill="none"
            opacity={pulso}
          />
        );
      })}
    </g>
  );
};

/** trilha de gelo deixada por quem desliza: placas que somem devagar */
const TrilhaGelo: React.FC<{ e: PoderEvent; f: number; xs: (q: number) => number }> = ({ e, f, xs }) => {
  const placas: React.ReactNode[] = [];
  for (let q = e.from; q <= Math.min(f, e.to); q += 4) {
    const idade = f - q;
    if (idade > 110) continue;
    const x = xs(q);
    const op = 1 - idade / 110;
    const w = 44 + 20 * ruido(q);
    placas.push(
      <g key={q} opacity={op}>
        <path d={`M${x - w} 2 L${x - w * 0.3} -10 L${x + w * 0.4} -4 L${x + w} 4 Z`} fill={GELO.claro} stroke={GELO.forte} strokeWidth={2} />
        <path d={`M${x - 6} -2 L${x + 3} -22 L${x + 8} -2 Z`} fill={GELO.medio} />
      </g>,
    );
  }
  return <g data-poder="trilha-gelo">{placas}</g>;
};

/** rachadura no chao que cresce para os dois lados */
const Rachadura: React.FC<{ e: PoderEvent; f: number }> = ({ e, f }) => {
  if (f < e.from) return null;
  const x0 = e.a?.x ?? 0;
  const cresce = saiRapido((f - e.from) / Math.max(1, e.to - e.from));
  const comp = (e.forca ?? 360) * cresce;
  const pts = (lado: number) => {
    let d = `M${x0} 0`;
    for (let i = 1; i <= 8; i++) {
      const x = x0 + lado * (comp * i) / 8;
      const y = (ruido(i * 13 + lado) - 0.3) * 14;
      d += ` L${x.toFixed(1)} ${y.toFixed(1)}`;
    }
    return d;
  };
  return (
    <g data-poder="rachadura">
      <path d={pts(1)} stroke="#0a0a0f" strokeWidth={9} fill="none" strokeLinejoin="round" />
      <path d={pts(-1)} stroke="#0a0a0f" strokeWidth={9} fill="none" strokeLinejoin="round" />
      <path d={pts(1)} stroke="#5d6a86" strokeWidth={2} fill="none" opacity={0.6} />
      <path d={pts(-1)} stroke="#5d6a86" strokeWidth={2} fill="none" opacity={0.6} />
    </g>
  );
};

// ---- auras -------------------------------------------------------------------

/** aura de gelo: nevoa fria nos pes e cristais subindo pelo corpo */
const AuraGelo: React.FC<{ e: PoderEvent; f: number; corpo: Corpo }> = ({ e, f, corpo }) => {
  const forca = e.forca ?? 1;
  const entra = clamp01((f - e.from) / 20) * forca;
  if (entra <= 0) return null;
  const j = juntasDoCorpo(corpo);
  const cor = paletaDe(e, GELO);
  return (
    <g data-poder="aura-gelo" opacity={entra}>
      <ellipse cx={corpo.x} cy={-6} rx={150} ry={22} fill={cor.medio} opacity={0.35} />
      {Array.from({ length: 12 }, (_, i) => {
        const ciclo = 70;
        const t = ((f + i * 23) % ciclo) / ciclo;
        const base = i % 3 === 0 ? j.handFront : i % 3 === 1 ? j.footFront : j.footBack;
        const x = base.x + (ruido(i * 5) - 0.5) * 120;
        const y = base.y - t * 170;
        const r = 5 + 5 * ruido(i * 9);
        return (
          <path
            key={i}
            d={`M${x} ${y - r} L${x + r * 0.5} ${y} L${x} ${y + r} L${x - r * 0.5} ${y} Z`}
            fill={i % 2 ? "#ffffff" : GELO.medio}
            opacity={1 - t}
          />
        );
      })}
    </g>
  );
};

/** aura de fogo: fagulhas subindo e o calor em volta */
const AuraFogo: React.FC<{ e: PoderEvent; f: number; corpo: Corpo }> = ({ e, f, corpo }) => {
  const forca = e.forca ?? 1;
  const entra = clamp01((f - e.from) / 20) * forca;
  if (entra <= 0) return null;
  const j = juntasDoCorpo(corpo);
  const cor = paletaDe(e, FOGO);
  return (
    <g data-poder="aura-fogo" opacity={entra}>
      <ellipse cx={corpo.x} cy={-4} rx={140 + 10 * Math.sin(f * 0.3)} ry={20} fill={cor.forte} opacity={0.3} />
      {Array.from({ length: 16 }, (_, i) => {
        const ciclo = 50;
        const t = ((f + i * 17) % ciclo) / ciclo;
        const x = corpo.x + (ruido(i * 3) - 0.5) * 160 + Math.sin(t * 6 + i) * 18;
        const y = j.hip.y + 200 - t * 520;
        return <circle key={i} cx={x} cy={y} r={3 + 3 * ruido(i)} fill={i % 2 ? FOGO.medio : FOGO.claro} opacity={(1 - t) * 0.9} />;
      })}
      {/* chama pequena na mao de tras */}
      <Chama x={j.handBack.x} y={j.handBack.y} tamanho={34 * forca} f={f} semente={7} />
    </g>
  );
};

/** uma labareda: tres camadas que tremem */
const Chama: React.FC<{ x: number; y: number; tamanho: number; f: number; semente: number }> = ({ x, y, tamanho, f, semente }) => {
  const q = Math.floor(f / 2);
  const camadas = [
    { cor: FOGO.forte, k: 1 },
    { cor: FOGO.medio, k: 0.7 },
    { cor: FOGO.claro, k: 0.4 },
  ];
  return (
    <g>
      {camadas.map(({ cor, k }, i) => {
        const h = tamanho * k * (1.6 + 0.5 * ruido(semente + q + i));
        const w = tamanho * k * 0.55;
        const ond = (ruido(semente * 3 + q + i) - 0.5) * w;
        return (
          <path
            key={i}
            d={`M${x - w} ${y} Q${x - w} ${y - h * 0.5} ${x + ond} ${y - h} Q${x + w} ${y - h * 0.5} ${x + w} ${y} Q${x} ${y + w * 0.6} ${x - w} ${y} Z`}
            fill={cor}
            opacity={0.9}
          />
        );
      })}
    </g>
  );
};

// ---- explosoes e estilhacos --------------------------------------------------

const ExplosaoFogo: React.FC<{ a: Vec2; idade: number; forca: number; semente: number; paleta?: NomeDePaleta }> = ({ a, idade, forca, semente, paleta }) => {
  const dur = 34;
  if (idade < 0 || idade > dur + 30) return null;
  const k = clamp01(idade / dur);
  const r = forca * (0.3 + 0.9 * saiRapido(k));
  const cor = paleta ? PALETAS[paleta] : FOGO;
  return (
    <g data-poder="explosao">
      {/* o ar empurrado: abre antes do fogo e vende o tamanho do golpe */}
      <OndaDeChoque a={a} idade={idade} forca={forca} cor={cor} />
      {/*
        Estilhacos com gravidade. Poucos e LONGE: com 30 particulas saindo do
        mesmo ponto e alcance curto, elas se sobrepoem e viram um tufo solido
        que cobre quem levou o golpe -- o oposto de faisca, que e rala e deixa
        ver atraves. O alcance maior tambem espalha as vidas, entao elas nao
        morrem todas no mesmo quadro.
      */}
      <Faiscas a={a} idade={idade} forca={forca * 4.2} cor={cor} semente={semente} quantidade={14} />
      {/* fumaca que fica depois */}
      {Array.from({ length: 7 }, (_, i) => {
        const ang = (i / 7) * Math.PI * 2 + ruido(semente + i);
        const d = r * (0.6 + 0.5 * ruido(semente * 2 + i));
        const tf = clamp01((idade - 6) / (dur + 24));
        return (
          <circle
            key={`f${i}`}
            cx={a.x + Math.cos(ang) * d}
            cy={a.y + Math.sin(ang) * d * 0.7 - tf * 60}
            r={forca * 0.35 * (0.6 + tf)}
            fill="#3a3336"
            opacity={0.5 * (1 - tf)}
          />
        );
      })}
      {k < 1 && (
        <>
          <circle cx={a.x} cy={a.y} r={r * 1.15} fill="none" stroke={FOGO.medio} strokeWidth={10 * (1 - k)} opacity={1 - k} />
          {Array.from({ length: 9 }, (_, i) => {
            const ang = (i / 9) * Math.PI * 2 + ruido(semente * 5 + i) * 0.6;
            const d = r * 0.55;
            return (
              <circle
                key={i}
                cx={a.x + Math.cos(ang) * d}
                cy={a.y + Math.sin(ang) * d}
                r={r * (0.45 + 0.2 * ruido(semente + i * 3)) * (1 - k * 0.5)}
                fill={i % 3 === 0 ? FOGO.claro : i % 3 === 1 ? FOGO.medio : FOGO.forte}
                opacity={0.85 * (1 - k)}
              />
            );
          })}
          <circle cx={a.x} cy={a.y} r={r * 0.5 * (1 - k)} fill="#ffffff" opacity={1 - k} />
        </>
      )}
    </g>
  );
};

const EstilhacosGelo: React.FC<{ a: Vec2; idade: number; forca: number; semente: number; dir?: number }> = ({ a, idade, forca, semente, dir = 0 }) => {
  const dur = 36;
  if (idade < 0 || idade > dur) return null;
  const k = idade / dur;
  return (
    <g data-poder="estilhacos">
      <circle cx={a.x} cy={a.y} r={forca * saiRapido(k) * 1.1} fill="none" stroke={GELO.medio} strokeWidth={8 * (1 - k)} opacity={1 - k} />
      {Array.from({ length: 14 }, (_, i) => {
        // com dir, os estilhacos voam so para aquele lado (meia-lua)
        const base = dir ? (dir > 0 ? 0 : Math.PI) : 0;
        const leque = dir ? Math.PI * 0.9 : Math.PI * 2;
        const ang = base - leque / 2 + (i / 13) * leque + (ruido(semente + i) - 0.5) * 0.3;
        const v = forca * (1 + ruido(semente * 3 + i));
        const x = a.x + Math.cos(ang) * v * saiRapido(k);
        const y = a.y + Math.sin(ang) * v * saiRapido(k) + 120 * k * k;
        const s = 10 + 12 * ruido(semente * 5 + i);
        const rot = (ang * 180) / Math.PI + idade * 12;
        return (
          <path
            key={i}
            d={`M${-s} 0 L0 ${-s * 0.35} L${s} 0 L0 ${s * 0.35} Z`}
            transform={`translate(${x} ${y}) rotate(${rot})`}
            fill={i % 2 ? GELO.claro : GELO.medio}
            stroke={GELO.forte}
            strokeWidth={1.5}
            opacity={1 - k * 0.8}
          />
        );
      })}
    </g>
  );
};

/** choque de laminas: gelo para um lado, fogo para o outro, onda no meio */
const Choque: React.FC<{ e: PoderEvent; f: number }> = ({ e, f }) => {
  const a = e.a ?? { x: 0, y: -400 };
  const idade = f - e.from;
  if (idade < 0 || idade > 60) return null;
  const k = clamp01(idade / 28);
  // dir = lado do gelo (quem tem gelo esta daquele lado)
  const ladoGelo = e.dir ?? -1;
  return (
    <g data-poder="choque">
      <ellipse cx={a.x} cy={a.y} rx={60 + 520 * saiRapido(k)} ry={(60 + 520 * saiRapido(k)) * 0.35} fill="none" stroke="#ffffff" strokeWidth={14 * (1 - k)} opacity={1 - k} />
      <EstilhacosGelo a={a} idade={idade} forca={e.forca ?? 220} semente={e.from} dir={ladoGelo} />
      <ExplosaoFogo a={{ x: a.x - ladoGelo * 70, y: a.y }} idade={idade} forca={(e.forca ?? 220) * 0.7} semente={e.from + 3} />
      {idade < 8 && <circle cx={a.x} cy={a.y} r={90 * (1 - idade / 8)} fill="#ffffff" />}
    </g>
  );
};

// ---- sangue ------------------------------------------------------------------

/**
 * SANGUE DE UM CORTE.
 *
 * O spray sai na DIRECAO EM QUE A LAMINA VIAJAVA (e.vetor), aberto num leque
 * estreito em volta dela. Saindo para um lado qualquer, o sangue vira enfeite
 * colado por cima do golpe; saindo na direcao do corte, ele conta de onde o
 * corte veio.
 *
 * Tres tamanhos de gota, porque sangue nao e uma nuvem uniforme: umas poucas
 * grandes perto do corte, muitas pequenas longe. A gota estica na direcao em
 * que esta indo e, quando encosta no chao, vira mancha e fica.
 */
const Sangue: React.FC<{ e: PoderEvent; f: number }> = ({ e, f }) => {
  const a = e.a ?? { x: 0, y: -400 };
  const idade = f - e.from;
  if (idade < 0) return null;
  const v = e.vetor ?? { x: e.dir ?? 1, y: -0.3 };
  const n = Math.hypot(v.x, v.y) || 1;
  const ux = v.x / n;
  const uy = v.y / n;
  const quantas = Math.round(14 + 12 * (e.forca ?? 1));
  return (
    <g data-poder="sangue">
      {Array.from({ length: quantas }, (_, i) => {
        // leque estreito em volta da direcao do corte
        const desvio = (ruido(e.from * 3 + i) - 0.5) * 0.9;
        const cos = Math.cos(desvio);
        const sin = Math.sin(desvio);
        const dx = ux * cos - uy * sin;
        const dy = ux * sin + uy * cos;
        const vel = 5 + 13 * ruido(e.from + i);
        const vx = dx * vel;
        const vy = dy * vel;
        const t = idade;
        const x = a.x + vx * t;
        const y = a.y + vy * t + 0.5 * 0.55 * t * t;
        const r = 2.5 + 7 * ruido(e.from * 7 + i) ** 2;
        if (y >= -2) {
          // caiu: vira mancha no chao e fica
          const tc = (-vy + Math.sqrt(Math.max(0, vy * vy + 4 * 0.275 * -a.y))) / (2 * 0.275);
          return (
            <ellipse
              key={i}
              cx={a.x + vx * tc}
              cy={3}
              rx={r * 2}
              ry={r * 0.5}
              fill="#8e0b13"
              opacity={0.8}
            />
          );
        }
        const vyAgora = vy + 0.55 * t;
        const ang = (Math.atan2(vyAgora, vx) * 180) / Math.PI;
        const estica = 1 + Math.min(2.2, Math.hypot(vx, vyAgora) / 9);
        return (
          <ellipse
            key={i}
            cx={x}
            cy={y}
            rx={r * estica}
            ry={r * 0.85}
            transform={`rotate(${ang} ${x} ${y})`}
            fill={i % 4 === 0 ? "#ff2a34" : SANGUE}
          />
        );
      })}
    </g>
  );
};

/**
 * CORTE. O golpe passando, a ferida abrindo e o sangue saindo -- um evento com
 * comeco, e nao uma marca que aparece.
 *
 * O que havia aqui era duas linhas retas de 34 unidades no meio do tronco,
 * surgindo em 6 quadros. Tres coisas erradas de uma vez, e todas foram
 * descritas como "so um traco": reta (lamina viaja em arco), fina (ferida e
 * abertura, nao risco) e SEM O CORTE -- a marca existia, o instante de cortar
 * nao. Sangue nenhum.
 *
 * Quatro tempos, e a ordem importa mais que cada peca:
 *
 *   0-3    CLARAO passando, mais comprido que a ferida e brilhante o
 *          suficiente para estourar. E o unico momento em que se ve a lamina;
 *          se ele nao existe, a ferida simplesmente aparece.
 *   0-7    a FENDA abre do centro para as pontas, curvada no arco do golpe
 *   1-30   SANGUE saindo na direcao em que a lamina viajou
 *   7+     a ferida FICA, com o vermelho escuro assentando
 *
 * Serve solto no ar (chuva de cortes do dominio) ou preso a um corpo, e nesse
 * caso acompanha o tronco de quem levou.
 */
const Corte: React.FC<{ e: PoderEvent; f: number; corpo?: Corpo }> = ({ e, f, corpo }) => {
  const idade = f - e.from;
  if (idade < 0) return null;

  // preso a um corpo, o corte mora no tronco; solto, onde o compilador pediu
  let c: Vec2;
  if (corpo) {
    const j = juntasDoCorpo(corpo);
    c = { x: j.hip.x + (j.neck.x - j.hip.x) * 0.55, y: j.hip.y + (j.neck.y - j.hip.y) * 0.55 };
  } else {
    c = e.a ?? { x: 0, y: -400 };
  }

  const cor = paletaDe(e, { ...FOGO, forte: SANGUE, medio: "#ff2a34", claro: "#fff4f4" });
  // forca e o COMPRIMENTO do corte; no corpo ele nao passa do tronco
  const L = (corpo ? 78 : (e.forca ?? 220)) * 0.5;
  const v = e.vetor ?? { x: e.dir ?? 1, y: 0.45 };
  const n = Math.hypot(v.x, v.y) || 1;
  const ux = v.x / n;
  const uy = v.y / n;
  // perpendicular: e nela que a fenda tem espessura e o clarao tem barriga
  const px = -uy;
  const py = ux;

  const abre = saiRapido(idade / 7);
  const p1 = { x: c.x - ux * L * abre, y: c.y - uy * L * abre };
  const p2 = { x: c.x + ux * L * abre, y: c.y + uy * L * abre };
  // a barriga do arco: lamina nao viaja reto, e uma fenda reta acusa isso
  const barriga = L * 0.16;
  const meio = { x: c.x + px * barriga, y: c.y + py * barriga };

  /** fenda como forma fechada, com espessura `w` no centro afinando nas pontas */
  const fenda = (w: number) =>
    `M${p1.x.toFixed(1)} ${p1.y.toFixed(1)}` +
    ` Q${(meio.x + px * w).toFixed(1)} ${(meio.y + py * w).toFixed(1)} ${p2.x.toFixed(1)} ${p2.y.toFixed(1)}` +
    ` Q${(meio.x - px * w).toFixed(1)} ${(meio.y - py * w).toFixed(1)} ${p1.x.toFixed(1)} ${p1.y.toFixed(1)}Z`;

  const largura = L * 0.09;

  return (
    <g data-poder="corte">
      {/*
        CLARAO DO GOLPE. Estoura em 4 quadros e vai embora. Ele passa de
        `abre`: o corte visivel e mais comprido que a ferida que sobra, porque
        a lamina atravessa e sai do outro lado.
      */}
      {idade < 4 && (
        <g filter="url(#pw-glow-forte)" opacity={1 - idade / 4}>
          <path
            d={
              `M${(c.x - ux * L * 1.55).toFixed(1)} ${(c.y - uy * L * 1.55).toFixed(1)}` +
              ` Q${(meio.x + px * L * 0.1).toFixed(1)} ${(meio.y + py * L * 0.1).toFixed(1)} ${(c.x + ux * L * 1.55).toFixed(1)} ${(c.y + uy * L * 1.55).toFixed(1)}` +
              ` Q${(meio.x - px * L * 0.1).toFixed(1)} ${(meio.y - py * L * 0.1).toFixed(1)} ${(c.x - ux * L * 1.55).toFixed(1)} ${(c.y - uy * L * 1.55).toFixed(1)}Z`
            }
            fill="#ffffff"
          />
        </g>
      )}
      {/* halo da ferida: o corte queima nas bordas antes de virar so vermelho */}
      {idade < 14 && (
        <g filter="url(#pw-glow-medio)" opacity={(1 - idade / 14) * 0.9}>
          <path d={fenda(largura * 2.1)} fill={cor.medio} />
        </g>
      )}
      {/* borda clara + carne aberta: duas camadas dao PROFUNDIDADE a fenda */}
      <path d={fenda(largura * 1.45)} fill={cor.claro} opacity={0.95} />
      <path d={fenda(largura)} fill={cor.forte} />
      <path d={fenda(largura * 0.45)} fill={cor.fundo} opacity={0.85} />
      {/*
        SANGUE, reusando o spray direcional: sai na direcao em que a lamina
        viajou, cai e mancha o chao. Um corte sem isso e um risco desenhado.
      */}
      <Sangue
        e={{
          tipo: "sangue",
          from: e.from + 1,
          to: e.from + 30,
          a: c,
          forca: 0.35 + L / 170,
          vetor: { x: ux, y: uy },
        }}
        f={f}
      />
    </g>
  );
};

/** compatibilidade: o corte preso ao corpo de quem levou */
export const MarcaDeCorte: React.FC<{ e: PoderEvent; f: number; corpo: Corpo }> = ({ e, f, corpo }) => (
  <Corte e={e} f={f} corpo={corpo} />
);

/**
 * A ARQUITETURA DE UM DOMINIO.
 *
 * O veu sozinho troca a cor do fundo, e isso nao e um lugar -- e uma tinta.
 * O que faz um dominio impressionar e ter CONSTRUCAO dentro: alguma coisa
 * grande, parada e deliberada, que o espectador entende como feita. E ela que
 * da escala aos dois bonecos no meio.
 *
 * Cada lutador tem a sua, e a paleta escolhe qual:
 *
 *   sombra   CATEDRAL DE LAMINAS. Laminas gigantes fincadas no chao subindo
 *            em arco ate fechar uma abobada, com um halo atras. O espaco de
 *            quem corta: tudo ali e gume, e o teto e feito do que machuca.
 *   vazio    O FUNDO SEM FUNDO. Aneis afastando-se ate um ponto de fuga com
 *            um nucleo claro. Nao ha construcao porque a regra deste dominio
 *            e que nao existe fim: o olho cai para dentro e nao acha parede.
 *
 * As duas se montam junto com a expansao (`montagem`), em vez de ja estarem
 * prontas: dominio que abre revelando um cenario pronto parece corte para
 * outra cena, e nao um espaco sendo construido em volta de quem o abriu.
 */
const EstruturaDoDominio: React.FC<{ e: PoderEvent; f: number; r: number }> = ({ e, f, r }) => {
  const cor = paletaDe(e, PALETAS.sombra);
  const a = e.a ?? { x: 0, y: -300 };
  const idade = f - e.from;
  const montagem = clamp01(idade / 26);
  const m = saiRapido(montagem);
  if (m <= 0.01) return null;

  if (e.paleta === "vazio" || e.paleta === "azul") {
    /*
      O FUNDO SEM FUNDO. Doze aneis em progressao geometrica na direcao do
      nucleo: espacamento constante daria um alvo de tiro, e e o espacamento
      encolhendo que o olho le como profundidade.
    */
    return (
      <g data-dominio="vazio">
        {Array.from({ length: 12 }, (_, i) => {
          const k = (i + 1) / 12;
          // gira devagar e em sentido alternado: o espaco nao esta parado
          const raio = r * 0.92 * k ** 1.9 * m;
          const achata = 0.55 + 0.4 * k;
          return (
            <ellipse
              key={i}
              cx={a.x}
              cy={a.y}
              rx={raio}
              ry={raio * achata}
              fill="none"
              stroke={i % 3 === 0 ? cor.claro : cor.medio}
              strokeWidth={r * 0.004 + raio * 0.006}
              opacity={(0.1 + 0.42 * (1 - k)) * m}
              transform={`rotate(${(f * 0.12 * (i % 2 ? 1 : -1)).toFixed(2)} ${a.x} ${a.y})`}
            />
          );
        })}
        <g filter="url(#pw-glow-forte)">
          <circle cx={a.x} cy={a.y} r={r * 0.045 * m * (1 + 0.1 * Math.sin(f * 0.14))} fill={cor.claro} opacity={0.9 * m} />
        </g>
      </g>
    );
  }

  /*
    CAMPO DE LAMINAS. Laminas gigantes fincadas no chao, em quatro planos de
    profundidade, com as maiores emoldurando a cena.

    A primeira versao era uma abobada de nove pares finos e sumiu: elas eram
    pintadas com `cor.fundo`, que e quase exatamente a cor do veu por dentro
    do dominio. Contraste perto de zero -- o defeito que scripts/contraste.mts
    existe para pegar, cometido de novo. Sobrava o fio do gume, e o resultado
    lia como arame.

    Agora a lamina e uma SILHUETA quase preta (bem abaixo do veu) com o gume
    claro por cima: a mesma solucao que o cenario usa para os predios lerem
    contra o ceu. E sao poucas e grandes, porque o que da escala aos dois
    bonecos no meio e uma coisa enorme ao lado deles, nao dezoito pequenas.
  */
  const CHAO = 10;
  const SILHUETA = "#0b0206";
  /** planos: perto e grande e opaco, longe e menor e mais lavado pelo veu */
  const planos = [
    /*
      COLOSSOS. O primeiro plano e o que da escala: sem nada maior que os
      lutadores, o campo inteiro lia como cenario do tamanho deles. Estes
      passam de quatro vezes a altura de um corpo e emolduram o quadro.
    */
    { escala: 2.4, quantidade: 3, opacidade: 0.98, espalha: 1.9 },
    { escala: 1.0, quantidade: 4, opacidade: 0.92, espalha: 1.5 },
    { escala: 0.55, quantidade: 5, opacidade: 0.75, espalha: 1.1 },
    { escala: 0.3, quantidade: 6, opacidade: 0.55, espalha: 0.8 },
  ];
  /*
    O SANTUARIO. A peca central do dominio, atras do campo de laminas.

    Um campo de laminas sozinho e uma paisagem; o que transforma paisagem em
    LUGAR e uma construcao deliberada no meio dela -- alguma coisa que so
    existe porque alguem a ergueu. Telhado em tres beirais, pilares de osso, e
    o cranio sob a cobertura, que e o que o olho encontra primeiro e o que da
    ao espaco um dono.

    Tudo em silhueta quase preta com o gume claro, pela mesma razao das
    laminas: por dentro do dominio o veu ja e vermelho escuro, e qualquer
    forma pintada na cor do veu desaparece nele.
  */
  /*
    LAYOUT DO SANTUARIO, do chao para cima e em unidades de H.

    A primeira versao empilhava os beirais com espacamento menor que a altura
    deles e o telhado virou uma pilha de formas coladas; o cranio caia abaixo
    da linha dos ombros e ficava escondido atras dos dois lutadores. As duas
    coisas sao erro de LAYOUT, nao de desenho: sem as alturas escritas como
    uma lista, cada peca era posicionada por uma conta propria e elas se
    sobrepunham.

        0      chao
       -1H     topo da plataforma
       -1.2H   base do cranio          }  o cranio ocupa a faixa que fica
       -5.2H   topo do cranio          }  ACIMA da cabeca dos lutadores
       -6H     topo dos pilares
       -6H..-11H  tres beirais, de 1.7H cada, sem se tocarem

    Onze H de altura, contra ~2.6H de um lutador: a construcao tem que
    TORREAR sobre eles, senao o dominio tem o tamanho de quem esta dentro.
  */
  const H = r * 0.075;
  const santuario = (() => {
    const sobe = saiRapido(clamp01((montagem - 0.1) / 0.5));
    if (sobe <= 0.01) return null;
    const y = (k: number) => CHAO - k * H * sobe;
    const larg = H * 4.6;
    /** beiral: telhado com as pontas viradas para cima */
    const beiral = (base: number, w: number, alt: number) =>
      `M${(-w).toFixed(1)} ${base.toFixed(1)}` +
      ` Q${(-w * 1.22).toFixed(1)} ${(base - alt * 0.62).toFixed(1)} ${(-w * 0.7).toFixed(1)} ${(base - alt * 0.8).toFixed(1)}` +
      ` L${(w * 0.7).toFixed(1)} ${(base - alt * 0.8).toFixed(1)}` +
      ` Q${(w * 1.22).toFixed(1)} ${(base - alt * 0.62).toFixed(1)} ${w.toFixed(1)} ${base.toFixed(1)}` +
      ` L${(w * 0.46).toFixed(1)} ${(base - alt * 0.2).toFixed(1)}` +
      ` L${(-w * 0.46).toFixed(1)} ${(base - alt * 0.2).toFixed(1)}Z`;
    const alt = H * 1.7;
    /*
      ALTURA DO CRANIO. A 3.2H ele caia na faixa dos ombros e os dois corpos
      no meio da arena cobriam ele -- a peca mais importante da construcao
      ficava atras de quem estava lutando. Um lutador tem ~2.6H; a 4.8H o
      cranio comeca onde as cabecas acabam e sobe dali. A 4.8 ainda restava o
      maxilar atras da cabeca de quem abre o dominio; a 5.7 a construcao
      inteira fica limpa acima dos dois.
    */
    const cy = y(5.7);
    const cr = H * 2.3;
    return (
      <g transform={`translate(${a.x.toFixed(1)} 0)`} opacity={m}>
        {/* plataforma */}
        <path d={`M${(-larg * 1.3).toFixed(1)} ${CHAO} L${(-larg * 1.08).toFixed(1)} ${y(1).toFixed(1)} L${(larg * 1.08).toFixed(1)} ${y(1).toFixed(1)} L${(larg * 1.3).toFixed(1)} ${CHAO}Z`} fill={SILHUETA} opacity={0.97} />
        {/* pilares, da plataforma ao primeiro beiral */}
        {[-0.82, -0.32, 0.32, 0.82].map((k, i2) => (
          <rect key={i2} x={larg * k - H * 0.17} y={y(7.8)} width={H * 0.34} height={Math.max(0, y(1) - y(7.8))} fill={SILHUETA} opacity={0.97} />
        ))}
        {/*
          O CRANIO entre os pilares, ocupando a faixa acima dos ombros dos
          lutadores. E o que o olho encontra primeiro e o que da um dono ao
          espaco -- por isso ele vem ANTES dos telhados na ordem de desenho,
          para os beirais recortarem sobre ele e nao o contrario.
        */}
        {/*
          CONTORNO DO CRANIO. Uma silhueta preta sobre um veu vermelho escuro
          vira um disco: o olho recebe a mancha e nao a forma. Com o fio claro
          por cima, a calota, as macas e o maxilar aparecem -- e a mesma
          solucao do gume das laminas, pela mesma razao.
        */}
        {(() => {
          const d =
            `M${(-cr).toFixed(1)} ${(cy + cr * 0.12).toFixed(1)}` +
            ` Q${(-cr * 1.04).toFixed(1)} ${(cy - cr * 1.02).toFixed(1)} 0 ${(cy - cr * 1.02).toFixed(1)}` +
            ` Q${(cr * 1.04).toFixed(1)} ${(cy - cr * 1.02).toFixed(1)} ${cr.toFixed(1)} ${(cy + cr * 0.12).toFixed(1)}` +
            // maca do rosto: o degrau que separa a calota do maxilar
            ` L${(cr * 0.82).toFixed(1)} ${(cy + cr * 0.34).toFixed(1)}` +
            ` Q${(cr * 0.74).toFixed(1)} ${(cy + cr * 0.62).toFixed(1)} ${(cr * 0.5).toFixed(1)} ${(cy + cr * 0.7).toFixed(1)}` +
            ` L${(-cr * 0.5).toFixed(1)} ${(cy + cr * 0.7).toFixed(1)}` +
            ` Q${(-cr * 0.74).toFixed(1)} ${(cy + cr * 0.62).toFixed(1)} ${(-cr * 0.82).toFixed(1)} ${(cy + cr * 0.34).toFixed(1)}Z`;
          return (
            <g>
              <path d={d} fill={SILHUETA} opacity={0.98} />
              <path d={d} fill="none" stroke={cor.medio} strokeWidth={Math.max(1.6, H * 0.05)} opacity={0.75} />
            </g>
          );
        })()}
        {/* orbitas acesas: o unico ponto de luz do dominio, e ele esta olhando */}
        {[-1, 1].map((l) => (
          <g key={l} filter="url(#pw-glow-medio)">
            <ellipse cx={l * cr * 0.44} cy={cy} rx={cr * 0.3} ry={cr * 0.25} fill={cor.forte} opacity={0.9} transform={`rotate(${l * 14} ${l * cr * 0.44} ${cy})`} />
            <ellipse cx={l * cr * 0.44} cy={cy} rx={cr * 0.13} ry={cr * 0.11} fill={cor.claro} opacity={0.85} />
          </g>
        ))}
        <path d={`M0 ${(cy + cr * 0.2).toFixed(1)} L${(cr * 0.13).toFixed(1)} ${(cy + cr * 0.48).toFixed(1)} L${(-cr * 0.13).toFixed(1)} ${(cy + cr * 0.48).toFixed(1)}Z`} fill={cor.forte} opacity={0.6} />
        {/* mandibula */}
        <rect x={-cr * 0.46} y={cy + cr * 0.7} width={cr * 0.92} height={cr * 0.24} fill={SILHUETA} opacity={0.98} />
        {Array.from({ length: 7 }, (_, i2) => (
          <rect key={i2} x={(i2 - 3) * cr * 0.13 - cr * 0.045} y={cy + cr * 0.7} width={cr * 0.09} height={cr * 0.22} fill={cor.fundo} opacity={0.9} />
        ))}
        {/* tres beirais, do mais largo em baixo ao mais estreito em cima */}
        {[0, 1, 2].map((i2) => {
          const base = y(7.8 + i2 * 1.75);
          const w = larg * (1.35 - i2 * 0.26);
          return (
            <g key={`t${i2}`}>
              <path d={beiral(base, w, alt * sobe)} fill={SILHUETA} opacity={0.98} />
              <path d={beiral(base, w, alt * sobe)} fill="none" stroke={cor.medio} strokeWidth={Math.max(1.4, H * 0.04)} opacity={0.65} />
            </g>
          );
        })}
      </g>
    );
  })();

  return (
    <g data-dominio="campo-de-laminas">
      {/* halo atras do campo: o fundo contra o qual as laminas recortam */}
      <circle cx={a.x} cy={a.y - r * 0.1} r={r * 0.4 * m} fill={cor.fundo} opacity={0.4 * m} />
      <circle cx={a.x} cy={a.y - r * 0.1} r={r * 0.44 * m} fill="none" stroke={cor.forte} strokeWidth={r * 0.016} opacity={0.32 * m} />
      {santuario}
      {planos.map((plano, pi) =>
        Array.from({ length: plano.quantidade }, (_, i) => {
          const semente = pi * 31 + i * 17;
          // sobem em ORDEM: tudo junto le como imagem aparecendo, em ordem le
          // como espaco sendo construido em volta de quem o abriu
          const atraso = clamp01((montagem - (pi * 3 + i) * 0.035) / 0.4);
          if (atraso <= 0) return null;
          const sobe = saiRapido(atraso);
          const x = a.x + (ruido(semente) - 0.5) * r * plano.espalha;
          const h = r * plano.escala * (0.34 + 0.28 * ruido(semente * 3)) * sobe;
          const larg = h * (0.085 + 0.03 * ruido(semente * 5));
          const inc = (ruido(semente * 7) - 0.5) * 26;
          // lamina: base larga, ponta fina, um lado reto e o outro curvo
          const d =
            `M${(-larg).toFixed(1)} 0` +
            ` Q${(-larg * 0.75).toFixed(1)} ${(-h * 0.55).toFixed(1)} 0 ${(-h).toFixed(1)}` +
            ` Q${(larg * 0.55).toFixed(1)} ${(-h * 0.5).toFixed(1)} ${larg.toFixed(1)} 0Z`;
          return (
            <g key={`${pi}-${i}`} transform={`translate(${x.toFixed(1)} ${CHAO}) rotate(${inc.toFixed(1)})`}>
              <path d={d} fill={SILHUETA} opacity={plano.opacidade * m} />
              {/* gume: o unico lugar em que a lamina pega a luz do dominio */}
              <path
                d={`M0 ${(-h).toFixed(1)} Q${(-larg * 0.75).toFixed(1)} ${(-h * 0.55).toFixed(1)} ${(-larg).toFixed(1)} 0`}
                fill="none"
                stroke={cor.medio}
                strokeWidth={Math.max(1.5, h * 0.012)}
                opacity={0.8 * plano.opacidade * m}
              />
              {/* sombra no chao: sem ela a lamina flutua em vez de estar fincada */}
              <ellipse cx={0} cy={2} rx={larg * 2.1} ry={larg * 0.3} fill={SILHUETA} opacity={0.5 * plano.opacidade * m} />
            </g>
          );
        }),
      )}
    </g>
  );
};

/**
 * EXPANSAO DE DOMINIO: a arena deixa de ser a arena.
 *
 * A tecnica existia como telaBranca + nome + chuva de cortes, e foi descrita
 * assim: "nao mostra expansao de dominio de ninguem, o cenario mudando e tal".
 * Estava certo -- nao havia nada aqui. Nenhum dominio era desenhado; o que
 * havia era o nome aparecendo e uma pose.
 *
 * O que um dominio precisa mostrar, em ordem de importancia:
 *
 *   1. ELE SE EXPANDE. Uma frente sai do corpo de quem abre e engole a arena
 *      em ~10 quadros. Sem a frente passando, nao ha expansao -- ha um fundo
 *      que trocou de cor entre dois quadros.
 *   2. O MUNDO DENTRO E OUTRO. Veu na cor do dominio sobre tudo, mais escuro
 *      no centro. E o que separa "efeito em cima da rua" de "a rua nao esta
 *      mais aqui".
 *   3. ELE TEM BORDA. Um dominio e um espaco FECHADO. A borda pulsando, longe,
 *      e o que da tamanho ao lugar.
 *   4. ELE ESTA VIVO. Cortes a deriva no fundo, em profundidades diferentes.
 *
 * Fica na camada de TRAS: os lutadores precisam aparecer DENTRO do dominio.
 * A frente da expansao tambem passa na camada da frente (ver BordaDoDominio),
 * porque uma onda que engole a arena tem que passar por cima deles tambem.
 */
const Dominio: React.FC<{ e: PoderEvent; f: number }> = ({ e, f }) => {
  const idade = f - e.from;
  if (idade < 0 || f > e.to + 16) return null;
  const a = e.a ?? { x: 0, y: -300 };
  const cor = paletaDe(e, PALETAS.sombra);
  const RAIO = e.forca ?? 1700;
  const ABRE = 10;

  // abre em 10 quadros e fecha em 16: o dominio nao some, ele se recolhe
  const fecha = f > e.to ? 1 - (f - e.to) / 16 : 1;
  const r = RAIO * saiRapido(Math.min(1, idade / ABRE)) * clamp01(fecha);
  if (r < 1) return null;
  const respira = 1 + 0.012 * Math.sin(f * 0.11);
  const id = `dom-${e.from}`;

  return (
    <g data-poder="dominio">
      <defs>
        <radialGradient id={id} cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor={cor.fundo} stopOpacity={0.82} />
          <stop offset="55%" stopColor={cor.fundo} stopOpacity={0.68} />
          <stop offset="88%" stopColor={cor.forte} stopOpacity={0.5} />
          <stop offset="100%" stopColor={cor.claro} stopOpacity={0.18} />
        </radialGradient>
      </defs>
      {/*
        O VEU. Escuro no centro e quente na borda: o olho le um interior, nao
        uma tinta. Ele e a peca que faz o cenario mudar.
      */}
      <circle cx={a.x} cy={a.y} r={r * respira} fill={`url(#${id})`} opacity={clamp01(fecha)} />
      <EstruturaDoDominio e={e} f={f} r={r} />
      {/* cortes a deriva no fundo do dominio, em tres profundidades */}
      {Array.from({ length: 22 }, (_, i) => {
        const prof = 0.35 + 0.65 * ruido(i * 3 + 1);
        const ang = ruido(i * 7) * Math.PI * 2 + f * 0.004 * (1 + prof);
        const dist = r * (0.2 + 0.72 * ruido(i * 11));
        const x = a.x + Math.cos(ang) * dist;
        const y = a.y + Math.sin(ang) * dist * 0.62;
        const L = 90 * prof + 40;
        const gira = ruido(i * 13) * 180 + f * 0.25 * prof;
        return (
          <path
            key={i}
            d={`M${-L} ${-L * 0.18} Q0 0 ${L} ${L * 0.18} Q0 ${L * 0.1} ${-L} ${-L * 0.18}Z`}
            transform={`translate(${x.toFixed(1)} ${y.toFixed(1)}) rotate(${gira.toFixed(1)})`}
            fill={cor.medio}
            opacity={0.1 + 0.3 * prof}
          />
        );
      })}
      {/* BORDA: o dominio e um espaco fechado, e a borda e o que da tamanho */}
      <circle cx={a.x} cy={a.y} r={r * respira} fill="none" stroke={cor.claro} strokeWidth={r * 0.006} opacity={0.5 * clamp01(fecha)} />
      <polygon points={contornoFervente(a, r * 0.965, f, e.from, 0.014)} fill="none" stroke={cor.medio} strokeWidth={r * 0.012} opacity={0.4 * clamp01(fecha)} />
    </g>
  );
};

/**
 * A FRENTE DA EXPANSAO, na camada da frente.
 *
 * Existe so nos quadros em que o dominio esta abrindo, e passa POR CIMA dos
 * lutadores. Sem isso a expansao acontece atras deles e nao os alcanca -- e o
 * momento em que a onda varre o personagem e o que vende que ela e maior que
 * ele.
 */
const BordaDoDominio: React.FC<{ e: PoderEvent; f: number }> = ({ e, f }) => {
  const idade = f - e.from;
  const ABRE = 10;
  if (idade < 0 || idade > ABRE + 3) return null;
  const a = e.a ?? { x: 0, y: -300 };
  const cor = paletaDe(e, PALETAS.sombra);
  const k = Math.min(1, idade / ABRE);
  const r = (e.forca ?? 1700) * saiRapido(k);
  // a frente perde forca conforme se afasta: energia espalhada por mais borda
  const forca = (1 - k) ** 0.7;
  return (
    <g data-poder="dominio-borda" filter="url(#pw-glow-forte)">
      <circle cx={a.x} cy={a.y} r={r} fill="none" stroke={cor.claro} strokeWidth={r * 0.05 * forca + 4} opacity={0.85 * forca} />
      <circle cx={a.x} cy={a.y} r={r * 0.86} fill="none" stroke={cor.medio} strokeWidth={r * 0.03 * forca + 2} opacity={0.5 * forca} />
    </g>
  );
};

// ---- projeteis e feixes ------------------------------------------------------

const BolaDeFogo: React.FC<{ e: PoderEvent; f: number }> = ({ e, f }) => {
  const a = e.a ?? { x: 0, y: -400 };
  const b = e.b ?? a;
  if (f < e.from) return null;
  if (f > e.to) return <ExplosaoFogo a={b} idade={f - e.to} forca={(e.forca ?? 60) * 2.6} semente={e.from} />;
  const t = progresso(e, f);
  const p = { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t - Math.sin(t * Math.PI) * 30 };
  const r = e.forca ?? 60;
  const dir = Math.sign(b.x - a.x) || 1;
  return (
    <g data-poder="bola-de-fogo">
      {/* cauda */}
      {Array.from({ length: 6 }, (_, i) => (
        <circle key={i} cx={p.x - dir * (i + 1) * r * 0.55} cy={p.y + Math.sin(f * 0.5 + i) * 6} r={r * (0.8 - i * 0.12)} fill={i < 2 ? FOGO.medio : FOGO.forte} opacity={0.7 - i * 0.1} />
      ))}
      <circle cx={p.x} cy={p.y} r={r * 1.25} fill={FOGO.forte} opacity={0.5} />
      <circle cx={p.x} cy={p.y} r={r} fill={FOGO.medio} />
      <circle cx={p.x} cy={p.y} r={r * 0.55} fill={FOGO.claro} />
    </g>
  );
};

/** vapor: fogo encontrou gelo. Nuvens brancas que crescem e sobem */
const Vapor: React.FC<{ e: PoderEvent; f: number }> = ({ e, f }) => {
  const a = e.a ?? { x: 0, y: -300 };
  const idade = f - e.from;
  const dur = e.to - e.from;
  if (idade < 0 || idade > dur + 60) return null;
  const tamanho = e.forca ?? 300;
  const fim = clamp01((idade - dur) / 60);
  return (
    <g data-poder="vapor" opacity={1 - fim}>
      {Array.from({ length: 16 }, (_, i) => {
        const ang = ruido(e.from + i) * Math.PI * 2;
        const d = tamanho * ruido(e.from * 3 + i) * saiRapido(idade / 40);
        const x = a.x + Math.cos(ang) * d * 1.4;
        const y = a.y + Math.sin(ang) * d * 0.6 - idade * 0.8;
        const r = tamanho * (0.25 + 0.25 * ruido(e.from * 7 + i)) * (0.5 + saiRapido(idade / 50));
        return <circle key={i} cx={x} cy={y} r={r} fill={i % 3 ? "#e8edf3" : "#c9d2dd"} opacity={0.72} />;
      })}
    </g>
  );
};

/** feixe: de `a` (a mao de quem lanca) ate `b` (onde colide) */
const Feixe: React.FC<{ e: PoderEvent; f: number; fogo: boolean }> = ({ e, f, fogo }) => {
  if (!ativo(e, f)) return null;
  const a = e.a ?? { x: 0, y: -400 };
  const b = e.b ?? a;
  const entra = saiRapido((f - e.from) / 8);
  const pontaX = a.x + (b.x - a.x) * entra;
  const cor = paletaDe(e, fogo ? FOGO : GELO);
  const larg = (e.forca ?? 90) * (0.85 + 0.15 * Math.sin(f * 0.9));
  const onda = (i: number) => Math.sin(f * 0.7 + i) * (fogo ? 14 : 5);
  const pts = (k: number) => {
    const n = 10;
    const cima: string[] = [];
    const baixo: string[] = [];
    for (let i = 0; i <= n; i++) {
      const x = a.x + (pontaX - a.x) * (i / n);
      const y = a.y + (b.y - a.y) * (i / n);
      const w = larg * k * (0.55 + 0.45 * (i / n)) + onda(i);
      cima.push(`${x.toFixed(1)},${(y - w / 2).toFixed(1)}`);
      baixo.push(`${x.toFixed(1)},${(y + w / 2).toFixed(1)}`);
    }
    return [...cima, ...baixo.reverse()].join(" ");
  };
  const ponta = { x: pontaX, y: a.y + (b.y - a.y) * entra };
  return (
    <g data-poder={fogo ? "feixe-fogo" : "raio-gelo"}>
      {/* halo largo por baixo: e ele que faz o feixe iluminar em vez de so ocupar espaco */}
      <g filter="url(#pw-glow-forte)" opacity={0.9}>
        <polygon points={pts(1.15)} fill={cor.forte} opacity={0.55} />
      </g>
      <polygon points={pts(1.5)} fill={cor.forte} opacity={0.35} />
      <polygon points={pts(1)} fill={cor.medio} opacity={0.85} />
      <polygon points={pts(0.45)} fill={cor.claro} />
      {/* a ponta cospe faisca para tras enquanto avanca */}
      <Faiscas a={ponta} idade={(f - e.from) % 9} forca={larg * 2.2} cor={cor} semente={e.from + Math.floor((f - e.from) / 9) * 13} quantidade={10} />
    </g>
  );
};

/**
 * SUPERFICIE TURBULENTA: o contorno da esfera como poligono que ferve.
 *
 * Um circulo perfeito e o que denunciava a esfera como bola parada. Energia
 * contida nao tem borda lisa -- ela empurra de dentro, com o relevo passeando
 * em volta em vez de pulsar tudo junto. Duas ondas de periodo diferente
 * girando em velocidades diferentes dao isso: a soma nunca repete o mesmo
 * perfil, e o olho le movimento sem ver quadro repetido.
 */
const contornoFervente = (a: Vec2, r: number, f: number, semente: number, amplitude = 0.1) => {
  const n = 28;
  const pts: string[] = [];
  for (let i = 0; i < n; i++) {
    const ang = (i / n) * Math.PI * 2;
    const rel =
      1 +
      amplitude * Math.sin(ang * 3 + f * 0.22 + semente) +
      amplitude * 0.6 * Math.sin(ang * 5 - f * 0.31 + semente * 2);
    pts.push(`${(a.x + Math.cos(ang) * r * rel).toFixed(1)},${(a.y + Math.sin(ang) * r * rel).toFixed(1)}`);
  }
  return pts.join(" ");
};

/**
 * ANEIS DE COMPRESSAO: energia sendo puxada PARA DENTRO.
 *
 * Onda de choque anda para fora, e por isso le como "acabou de explodir".
 * Aqui e o contrario: a esfera esta se carregando, e o que precisa ser lido e
 * a arena alimentando ela. Anel nasce longe, encolhe ate a superficie e some
 * -- e onde fica claro que a esfera esta ACUMULANDO, nao so existindo.
 */
const AneisDeCompressao: React.FC<{
  a: Vec2;
  r: number;
  f: number;
  cor: { claro: string; medio: string; forte: string; fundo: string };
  quantidade?: number;
}> = ({ a, r, f, cor, quantidade = 3 }) => (
  <>
    {Array.from({ length: quantidade }, (_, i) => {
      const ciclo = 26;
      const k = ((f + i * (ciclo / quantidade)) % ciclo) / ciclo;
      const raio = r * (2.6 - 1.55 * k);
      return (
        <ellipse
          key={`c${i}`}
          cx={a.x}
          cy={a.y}
          rx={raio}
          ry={raio * 0.94}
          fill="none"
          stroke={cor.medio}
          strokeWidth={r * 0.035 * k}
          opacity={0.45 * k}
        />
      );
    })}
  </>
);

/**
 * ARCOS ELETRICOS saltando da superficie.
 *
 * Trocam de forma a cada 3 quadros, nao a cada quadro: relampago que se
 * redesenha em 60Hz vira ruido cinza e perde o estalo. O `epoca` congela o
 * sorteio dentro da janela, o que da o intervalo de leitura que um arco
 * precisa para existir.
 */
const ArcosEletricos: React.FC<{
  a: Vec2;
  r: number;
  f: number;
  cor: { claro: string; medio: string; forte: string; fundo: string };
  semente: number;
}> = ({ a, r, f, cor, semente }) => {
  const epoca = Math.floor(f / 3);
  return (
    <g filter="url(#pw-glow-medio)">
      {Array.from({ length: 5 }, (_, i) => {
        const s = semente + epoca * 17 + i * 53;
        if (ruido(s) < 0.45) return null;
        const ang = ruido(s * 3) * Math.PI * 2;
        const alcance = r * (1.15 + 0.55 * ruido(s * 5));
        const passos = 4;
        const d: string[] = [];
        for (let k = 0; k <= passos; k++) {
          const t = k / passos;
          const desvio = k === 0 || k === passos ? 0 : (ruido(s * 7 + k) - 0.5) * r * 0.5;
          const rr = r * 0.9 + (alcance - r * 0.9) * t;
          const x = a.x + Math.cos(ang) * rr - Math.sin(ang) * desvio;
          const y = a.y + Math.sin(ang) * rr + Math.cos(ang) * desvio;
          d.push(`${k === 0 ? "M" : "L"}${x.toFixed(1)} ${y.toFixed(1)}`);
        }
        return (
          <path
            key={i}
            d={d.join(" ")}
            fill="none"
            stroke={i % 2 ? cor.claro : cor.medio}
            strokeWidth={r * 0.035}
            strokeLinecap="round"
            opacity={0.85}
          />
        );
      })}
    </g>
  );
};

/**
 * ESFERA DE ENERGIA: cresce na mao de quem lanca e nao para quieta nunca.
 *
 * O defeito que esta correcao ataca: com paleta fria a esfera era tres
 * circulos concentricos e dois aneis pulsando. O raio saturava em ~15 quadros
 * e dali em diante o desenho era IDENTICO quadro a quadro -- uma bola parada,
 * exatamente como foi descrito. Chama em volta (paleta quente) escondia o
 * problema porque a chama se move sozinha.
 *
 * Quatro fontes de movimento independentes, que e o que faz energia contida
 * nunca repetir: superficie fervendo, nucleo derivando dentro da casca, arcos
 * saltando fora e aneis comprimindo para dentro. Nenhuma depende da outra,
 * entao a soma nao tem periodo curto.
 */
const EsferaInferno: React.FC<{ e: PoderEvent; f: number }> = ({ e, f }) => {
  if (!ativo(e, f)) return null;
  const a = e.a ?? { x: 0, y: -800 };
  const t = progresso(e, f);
  const idade = f - e.from;
  const cor = paletaDe(e, FOGO);
  const semente = e.from;

  /*
    O CRESCIMENTO nao termina: depois de chegar ao tamanho, a esfera respira
    (+-3%). Sem isso o raio congela e todo o resto do movimento parece
    acontecer dentro de uma moldura parada.
  */
  const r = (30 + (e.forca ?? 300) * saiRapido(t)) * (1 + 0.03 * Math.sin(f * 0.26 + semente));
  // deriva do nucleo dentro da casca: o peso da energia nao fica centrado
  const nx = a.x + Math.sin(f * 0.19 + semente) * r * 0.07;
  const ny = a.y + Math.cos(f * 0.23 + semente * 2) * r * 0.07;
  const comChama = !e.paleta || e.paleta === "fogo" || e.paleta === "sombra";

  return (
    <g data-poder="esfera-inferno">
      {/* halo contido: em 1.35 do raio ele engolia o lutador junto com a esfera */}
      <circle cx={a.x} cy={a.y} r={r * 1.1} fill={cor.forte} opacity={0.18} />
      <AneisDeCompressao a={a} r={r} f={f} cor={cor} />
      {comChama &&
        Array.from({ length: 14 }, (_, i) => {
          // as labaredas GIRAM em volta, em vez de cada uma tremer no lugar
          const ang = (i / 14) * Math.PI * 2 + f * 0.05;
          return <Chama key={i} x={a.x + Math.cos(ang) * r * 0.9} y={a.y + Math.sin(ang) * r * 0.9} tamanho={r * 0.28} f={f} semente={i * 5} />;
        })}
      <g filter="url(#pw-glow-medio)">
        <polygon points={contornoFervente(a, r * 0.82, f, semente, 0.12)} fill={cor.forte} opacity={0.8} />
      </g>
      {/* casca fervendo, e nao circulo: e a borda que mais acusa bola parada */}
      <polygon points={contornoFervente(a, r, f, semente, 0.09)} fill={cor.forte} />
      <polygon points={contornoFervente(nx === a.x ? a : { x: nx, y: ny }, r * 0.72, f * 1.3, semente + 4, 0.14)} fill={cor.medio} />
      <circle cx={nx} cy={ny} r={r * 0.4} fill={cor.claro} />
      {/* brilho especular fixo: da a esfera uma superficie, nao um disco */}
      <ellipse cx={a.x - r * 0.3} cy={a.y - r * 0.34} rx={r * 0.22} ry={r * 0.15} fill="#ffffff" opacity={0.5} transform={`rotate(-28 ${a.x - r * 0.3} ${a.y - r * 0.34})`} />
      <ArcosEletricos a={a} r={r} f={f} cor={cor} semente={semente} />
      {/* energia sendo sugada para dentro da esfera enquanto ela carrega */}
      <Faiscas a={a} idade={idade % 14} forca={-r * 1.5} cor={cor} semente={semente + Math.floor(idade / 14) * 7} quantidade={12} />
    </g>
  );
};

/**
 * ZERO ABSOLUTE: o ar congela em volta dele. Nada de bolha: um halo fino e
 * frio, cristais girando em volta e linhas de gelo subindo do chao.
 */
const ZeroAbsoluto: React.FC<{ e: PoderEvent; f: number; corpo?: Corpo }> = ({ e, f, corpo }) => {
  if (!ativo(e, f) || !corpo) return null;
  const t = progresso(e, f);
  const j = juntasDoCorpo(corpo);
  const entra = saiRapido(t * 3);
  const c = { x: corpo.x, y: (j.neck.y + j.hip.y) / 2 };
  return (
    <g data-poder="zero-absoluto" opacity={entra}>
      <circle cx={c.x} cy={c.y} r={230} fill="none" stroke="#ffffff" strokeWidth={3} opacity={0.5} />
      <circle cx={c.x} cy={c.y} r={260 + 8 * Math.sin(f * 0.3)} fill="none" stroke={GELO.medio} strokeWidth={2} opacity={0.4} />
      {Array.from({ length: 12 }, (_, i) => {
        const ang = (i / 12) * Math.PI * 2 + f * 0.04;
        const r = 200 + 30 * Math.sin(f * 0.1 + i);
        const x = c.x + Math.cos(ang) * r;
        const y = c.y + Math.sin(ang) * r * 1.2;
        const s = 10 + 6 * ruido(i);
        return <path key={i} d={`M${x} ${y - s} L${x + s * 0.45} ${y} L${x} ${y + s} L${x - s * 0.45} ${y} Z`} fill="#ffffff" opacity={0.9} />;
      })}
      {Array.from({ length: 14 }, (_, i) => {
        const ciclo = 40;
        const k = ((f + i * 11) % ciclo) / ciclo;
        const x = corpo.x + (ruido(i * 3) - 0.5) * 420;
        const y = -k * 650;
        return <line key={`l${i}`} x1={x} y1={y} x2={x} y2={y - 50} stroke={i % 2 ? "#ffffff" : GELO.medio} strokeWidth={3} opacity={(1 - k) * 0.8} />;
      })}
    </g>
  );
};

/** lamina quebrada: dois pedacos voando e girando a partir do meio */
const FragmentosDaLamina: React.FC<{ e: PoderEvent; f: number }> = ({ e, f }) => {
  const idade = f - e.from;
  if (idade < 0 || idade > 90) return null;
  const a = e.a ?? { x: 0, y: -450 };
  return (
    <g data-poder="fragmentos">
      {[
        { cor: GELO, dx: -5, s: 1 },
        { cor: FOGO, dx: 5, s: 2 },
        { cor: GELO, dx: -2, s: 3 },
        { cor: FOGO, dx: 3, s: 4 },
      ].map(({ cor, dx, s }, i) => {
        const vy = -(14 + 6 * ruido(s));
        const x = a.x + dx * idade * (1 + ruido(s * 3));
        const y = Math.min(-4, a.y + vy * idade + 0.5 * idade * idade);
        const rot = idade * (18 + 10 * s) * (dx > 0 ? 1 : -1);
        const L = 70 + 30 * ruido(s * 5);
        return (
          <path
            key={i}
            d={`M${-L / 2} -5 L${L / 2} -2 L${L / 2 + 8} 0 L${L / 2} 3 L${-L / 2} 5 Z`}
            transform={`translate(${x} ${y}) rotate(${y >= -4 ? 0 : rot})`}
            fill={cor.claro}
            stroke={cor.forte}
            strokeWidth={3}
          />
        );
      })}
    </g>
  );
};

// ---- camada ------------------------------------------------------------------

export const CamadaDePoderes: React.FC<{
  timeline: Timeline;
  /** quadro logico */
  frame: number;
  parte: "chao" | "atras" | "frente";
  corpos: Partial<Record<FighterId, Corpo>>;
  /** x do quadril de um lutador num quadro (para a trilha de gelo) */
  xDe: (id: FighterId, quadro: number) => number;
}> = ({ timeline, frame: f, parte, corpos, xDe }) => {
  const itens: React.ReactNode[] = [];
  timeline.poderes.forEach((bruto, i) => {
    const corpo = bruto.quem ? corpos[bruto.quem] : undefined;
    // origem lida do corpo vivo quando o efeito declara ancora (ver `ancorado`)
    const e = ancorado(bruto, corpo);
    const k = `${e.tipo}-${i}`;
    if (parte === "chao") {
      if (e.tipo === "geloNoChao") itens.push(<GeloNoChao key={k} e={e} f={f} />);
      else if (e.tipo === "chaoQueimado") itens.push(<ChaoQueimado key={k} e={e} f={f} />);
      else if (e.tipo === "trilhaGelo" && e.quem) {
        const quem = e.quem;
        itens.push(<TrilhaGelo key={k} e={e} f={f} xs={(q) => xDe(quem, q)} />);
      } else if (e.tipo === "rachadura") itens.push(<Rachadura key={k} e={e} f={f} />);
    } else if (parte === "atras") {
      /*
        O dominio vem ANTES da exigencia de corpo: ele e um lugar, nao uma aura
        presa a alguem, e continua desenhado depois de `to` enquanto se recolhe.
      */
      if (e.tipo === "dominio") {
        itens.push(<Dominio key={k} e={e} f={f} />);
        return;
      }
      if (!corpo || !ativo(e, f)) return;
      if (e.tipo === "auraGelo") itens.push(<AuraGelo key={k} e={e} f={f} corpo={corpo} />);
      else if (e.tipo === "auraFogo") itens.push(<AuraFogo key={k} e={e} f={f} corpo={corpo} />);
      else if (e.tipo === "zeroAbsoluto") itens.push(<ZeroAbsoluto key={k} e={e} f={f} corpo={corpo} />);
    } else {
      if (e.tipo === "explosaoFogo" && e.a) itens.push(<ExplosaoFogo key={k} a={e.a} idade={f - e.from} forca={e.forca ?? 160} semente={e.from} paleta={e.paleta} />);
      else if (e.tipo === "estilhacosGelo" && e.a) itens.push(<EstilhacosGelo key={k} a={e.a} idade={f - e.from} forca={e.forca ?? 160} semente={e.from} dir={e.dir} />);
      else if (e.tipo === "choque") itens.push(<Choque key={k} e={e} f={f} />);
      else if (e.tipo === "sangue") itens.push(<Sangue key={k} e={e} f={f} />);
      else if (e.tipo === "bolaDeFogo") itens.push(<BolaDeFogo key={k} e={e} f={f} />);
      else if (e.tipo === "vapor") itens.push(<Vapor key={k} e={e} f={f} />);
      else if (e.tipo === "feixeFogo") itens.push(<Feixe key={k} e={e} f={f} fogo />);
      else if (e.tipo === "raioGelo") itens.push(<Feixe key={k} e={e} f={f} fogo={false} />);
      else if (e.tipo === "esferaInferno") itens.push(<EsferaInferno key={k} e={e} f={f} />);
      else if (e.tipo === "quebraLaminas") itens.push(<FragmentosDaLamina key={k} e={e} f={f} />);
      else if (e.tipo === "dominio") itens.push(<BordaDoDominio key={k} e={e} f={f} />);
      /*
        Corte sem `quem` desenha SOLTO NO AR, e nao e caso de excecao: a chuva
        de cortes do dominio nao tem dono nenhum. O `&& corpo` que havia aqui
        descartava silenciosamente os catorze cortes do dominio, que era a
        razao de a tecnica mostrar so o nome e nada mais.
      */
      else if (e.tipo === "marcaDeCorte") itens.push(<Corte key={k} e={e} f={f} corpo={corpo} />);
    }
  });
  return (
    <g data-layer={`poderes-${parte}`}>
      <DefsDePoder />
      {itens}
    </g>
  );
};

/** quanto da lamina de um lutador sobrou no quadro (quebra no fim da luta) */
export const laminaInteira = (timeline: Timeline, id: FighterId, f: number): number =>
  timeline.poderes.some((e) => e.tipo === "quebraLaminas" && f >= e.from) ? 0.38 : 1;

/**
 * Efeitos de TELA (fora da camera): a tela branca da colisao e o nome da
 * tecnica, estilo anime.
 */
export const PoderesNaTela: React.FC<{
  timeline: Timeline;
  frame: number;
  largura: number;
  altura: number;
}> = ({ timeline, frame: f, largura, altura }) => {
  let branco = 0;
  for (const e of timeline.poderes) {
    if (e.tipo !== "telaBranca" || f < e.from - 6 || f > e.to + 20) continue;
    const v = f < e.from ? (f - e.from + 6) / 6 : f <= e.to ? 1 : 1 - (f - e.to) / 20;
    branco = Math.max(branco, clamp01(v) * (e.forca ?? 1));
  }

  /*
    LUZ DO PODER SOBRE A CENA.

    Ate aqui o feixe brilhava e nada em volta sabia disso: o chao, os
    predios e os dois corpos seguiam com a mesma iluminacao de antes. E o
    que mais denuncia efeito colado por cima -- uma fonte de luz enorme
    aparece no meio da rua e a rua nao responde.

    Cada poder luminoso ativo contribui com uma lamina da cor dele sobre o
    quadro inteiro. A contribuicao ACOMPANHA A VIDA do efeito: nasce junto,
    segura enquanto ele esta no auge e cai com ele. Piscar antes ou depois
    acusaria o truque na hora.

    Fraca de proposito. Luz ambiente forte lava a cena e some com o
    contraste que o cenario gastou tanto para ter; o que ela precisa fazer e
    tingir, nao iluminar.
  */
  const LUMINOSOS: Partial<Record<TipoPoder, number>> = {
    esferaInferno: 0.14,
    feixeFogo: 0.22,
    raioGelo: 0.19,
    explosaoFogo: 0.28,
    bolaDeFogo: 0.11,
  };
  let luz: { cor: string; forca: number } | null = null;
  for (const e of timeline.poderes) {
    const pico = LUMINOSOS[e.tipo];
    if (pico === undefined || f < e.from || f > e.to + 12) continue;
    // entra em 6 quadros, segura, e desaparece nos 12 seguintes ao fim
    const entra = clamp01((f - e.from) / 6);
    const sai = f <= e.to ? 1 : 1 - (f - e.to) / 12;
    const forca = pico * entra * clamp01(sai);
    if (forca > (luz?.forca ?? 0)) {
      luz = { cor: paletaDe(e, FOGO).medio, forca };
    }
  }

  if (branco <= 0 && !luz) return null;
  return (
    <>
      {luz && luz.forca > 0.002 && (
        <rect
          width={largura}
          height={altura}
          fill={luz.cor}
          opacity={luz.forca}
          style={{ mixBlendMode: "screen" }}
        />
      )}
      {branco > 0 && (
        <rect width={largura} height={altura} fill="#ffffff" opacity={branco} />
      )}
    </>
  );
};
