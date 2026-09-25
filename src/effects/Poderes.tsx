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
import type { FighterId, PoderEvent, Timeline, Vec2 } from "../core/types";

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
  return (
    <g data-poder="aura-gelo" opacity={entra}>
      <ellipse cx={corpo.x} cy={-6} rx={150} ry={22} fill={GELO.medio} opacity={0.35} />
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
  return (
    <g data-poder="aura-fogo" opacity={entra}>
      <ellipse cx={corpo.x} cy={-4} rx={140 + 10 * Math.sin(f * 0.3)} ry={20} fill={FOGO.forte} opacity={0.3} />
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

const ExplosaoFogo: React.FC<{ a: Vec2; idade: number; forca: number; semente: number }> = ({ a, idade, forca, semente }) => {
  const dur = 34;
  if (idade < 0 || idade > dur + 30) return null;
  const k = clamp01(idade / dur);
  const r = forca * (0.3 + 0.9 * saiRapido(k));
  return (
    <g data-poder="explosao">
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

const Sangue: React.FC<{ e: PoderEvent; f: number }> = ({ e, f }) => {
  const a = e.a ?? { x: 0, y: -400 };
  const idade = f - e.from;
  if (idade < 0) return null;
  const dir = e.dir ?? 1;
  const n = Math.round(10 + 10 * (e.forca ?? 1));
  return (
    <g data-poder="sangue">
      {Array.from({ length: n }, (_, i) => {
        const vx = dir * (4 + 10 * ruido(e.from + i)) + (ruido(e.from * 3 + i) - 0.5) * 6;
        const vy = -(6 + 10 * ruido(e.from * 5 + i));
        const t = idade;
        const x = a.x + vx * t;
        const y = a.y + vy * t + 0.55 * t * t;
        const r = 4 + 6 * ruido(e.from * 7 + i);
        if (y >= 0) {
          // caiu: vira mancha no chao (fica)
          const tc = (-vy + Math.sqrt(vy * vy + 4 * 0.55 * -a.y)) / (2 * 0.55);
          const xc = a.x + vx * tc;
          return <ellipse key={i} cx={xc} cy={3} rx={r * 1.8} ry={r * 0.45} fill="#9e0d16" opacity={0.85} />;
        }
        // gota esticada na direcao do movimento
        const vyAgora = vy + 1.1 * t;
        const ang = (Math.atan2(vyAgora, vx) * 180) / Math.PI;
        return <ellipse key={i} cx={x} cy={y} rx={r * 1.6} ry={r * 0.7} transform={`rotate(${ang} ${x} ${y})`} fill={SANGUE} />;
      })}
    </g>
  );
};

/** corte no tronco: uma linha vermelha que fica no corpo de quem levou */
export const MarcaDeCorte: React.FC<{ e: PoderEvent; f: number; corpo: Corpo }> = ({ e, f, corpo }) => {
  if (f < e.from) return null;
  const j = juntasDoCorpo(corpo);
  const aparece = clamp01((f - e.from) / 6);
  const c = { x: j.hip.x + (j.neck.x - j.hip.x) * 0.55, y: j.hip.y + (j.neck.y - j.hip.y) * 0.55 };
  const w = 34 * aparece;
  return (
    <g data-poder="marca-de-corte">
      <line x1={c.x - w} y1={c.y - w * 0.6} x2={c.x + w} y2={c.y + w * 0.6} stroke="#fff4f4" strokeWidth={10} strokeLinecap="round" />
      <line x1={c.x - w} y1={c.y - w * 0.6} x2={c.x + w} y2={c.y + w * 0.6} stroke={SANGUE} strokeWidth={6} strokeLinecap="round" />
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
  const cor = fogo ? FOGO : GELO;
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
  return (
    <g data-poder={fogo ? "feixe-fogo" : "raio-gelo"}>
      <polygon points={pts(1.5)} fill={cor.forte} opacity={0.35} />
      <polygon points={pts(1)} fill={cor.medio} opacity={0.85} />
      <polygon points={pts(0.45)} fill={cor.claro} />
    </g>
  );
};

/** esfera do INFERNO: cresce acima de quem lanca, com labaredas em volta */
const EsferaInferno: React.FC<{ e: PoderEvent; f: number }> = ({ e, f }) => {
  if (!ativo(e, f)) return null;
  const a = e.a ?? { x: 0, y: -800 };
  const t = progresso(e, f);
  const r = 30 + (e.forca ?? 300) * saiRapido(t);
  return (
    <g data-poder="esfera-inferno">
      <circle cx={a.x} cy={a.y} r={r * 1.35} fill={FOGO.forte} opacity={0.25} />
      {Array.from({ length: 14 }, (_, i) => {
        const ang = (i / 14) * Math.PI * 2 + f * 0.05;
        return <Chama key={i} x={a.x + Math.cos(ang) * r * 0.9} y={a.y + Math.sin(ang) * r * 0.9} tamanho={r * 0.28} f={f} semente={i * 5} />;
      })}
      <circle cx={a.x} cy={a.y} r={r} fill={FOGO.forte} />
      <circle cx={a.x} cy={a.y} r={r * 0.75} fill={FOGO.medio} />
      <circle cx={a.x} cy={a.y} r={r * 0.45} fill={FOGO.claro} />
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
  timeline.poderes.forEach((e, i) => {
    const corpo = e.quem ? corpos[e.quem] : undefined;
    const k = `${e.tipo}-${i}`;
    if (parte === "chao") {
      if (e.tipo === "geloNoChao") itens.push(<GeloNoChao key={k} e={e} f={f} />);
      else if (e.tipo === "chaoQueimado") itens.push(<ChaoQueimado key={k} e={e} f={f} />);
      else if (e.tipo === "trilhaGelo" && e.quem) {
        const quem = e.quem;
        itens.push(<TrilhaGelo key={k} e={e} f={f} xs={(q) => xDe(quem, q)} />);
      } else if (e.tipo === "rachadura") itens.push(<Rachadura key={k} e={e} f={f} />);
    } else if (parte === "atras") {
      if (!corpo || !ativo(e, f)) return;
      if (e.tipo === "auraGelo") itens.push(<AuraGelo key={k} e={e} f={f} corpo={corpo} />);
      else if (e.tipo === "auraFogo") itens.push(<AuraFogo key={k} e={e} f={f} corpo={corpo} />);
      else if (e.tipo === "zeroAbsoluto") itens.push(<ZeroAbsoluto key={k} e={e} f={f} corpo={corpo} />);
    } else {
      if (e.tipo === "explosaoFogo" && e.a) itens.push(<ExplosaoFogo key={k} a={e.a} idade={f - e.from} forca={e.forca ?? 160} semente={e.from} />);
      else if (e.tipo === "estilhacosGelo" && e.a) itens.push(<EstilhacosGelo key={k} a={e.a} idade={f - e.from} forca={e.forca ?? 160} semente={e.from} dir={e.dir} />);
      else if (e.tipo === "choque") itens.push(<Choque key={k} e={e} f={f} />);
      else if (e.tipo === "sangue") itens.push(<Sangue key={k} e={e} f={f} />);
      else if (e.tipo === "bolaDeFogo") itens.push(<BolaDeFogo key={k} e={e} f={f} />);
      else if (e.tipo === "vapor") itens.push(<Vapor key={k} e={e} f={f} />);
      else if (e.tipo === "feixeFogo") itens.push(<Feixe key={k} e={e} f={f} fogo />);
      else if (e.tipo === "raioGelo") itens.push(<Feixe key={k} e={e} f={f} fogo={false} />);
      else if (e.tipo === "esferaInferno") itens.push(<EsferaInferno key={k} e={e} f={f} />);
      else if (e.tipo === "quebraLaminas") itens.push(<FragmentosDaLamina key={k} e={e} f={f} />);
      else if (e.tipo === "marcaDeCorte" && corpo) itens.push(<MarcaDeCorte key={k} e={e} f={f} corpo={corpo} />);
    }
  });
  return <g data-layer={`poderes-${parte}`}>{itens}</g>;
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
  return branco > 0 ? <rect width={largura} height={altura} fill="#ffffff" opacity={branco} /> : null;
};
