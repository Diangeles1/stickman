/**
 * PLACAR E LETREIROS: a camada de tela que prende quem esta assistindo.
 *
 * Fica FORA da camera (e tela, nao mundo): barras de vida no topo como num
 * jogo de luta, placas de nome com "VS" na abertura, e letreiros que batem
 * na tela no instante do evento (COMBO, ESQUIVA, BLOQUEIO, K.O.).
 *
 * O roteiro de tudo vem de espetaculo.ts. Aqui so se desenha, a partir do
 * quadro REAL: o letreiro continua se mexendo durante o hit stop e a camera
 * lenta, e e isso que faz o congelamento parecer proposital.
 */

import React from "react";
import {
  AbsoluteFill,
  Img,
  continueRender,
  delayRender,
  interpolate,
  spring,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { POSES } from "../characters/poses";
import { PRESETS } from "../characters/presets";
import { Stickman } from "../characters/Stickman";
import { MarcaDagua } from "./MarcaDagua";
import type { FighterId, Timeline } from "../core/types";
import {
  ESPERA_DA_PERGUNTA,
  NOMES,
  espetaculoDe,
  vidaNoQuadro,
  type Rotulo,
} from "./espetaculo";

/**
 * Bangers: letra de gibi, a mesma familia visual dos letreiros de luta.
 * Arquivo local (public/assets/fonts), entao o render nao depende de rede.
 */
export const FONTE = "Bangers";
const PILHA = `${FONTE}, "Arial Black", "DejaVu Sans", sans-serif`;

if (typeof window !== "undefined" && typeof FontFace !== "undefined") {
  const espera = delayRender("fonte Bangers");
  const fonte = new FontFace(
    FONTE,
    `url(${staticFile("assets/fonts/Bangers-Regular.ttf")})`,
  );
  fonte
    .load()
    .then(() => {
      document.fonts.add(fonte);
      continueRender(espera);
    })
    // sem a fonte o video sai com a reserva; nao vale travar o render
    .catch(() => continueRender(espera));
}

/** cor do lutador na interface: o "preto" e escuro demais sobre o painel */
const corDe = (id: FighterId): string =>
  id === "black" ? "#dfe5f5" : PRESETS[id].stroke;

/** contorno grosso de letreiro: em SVG o traco vai por baixo do preenchimento */
const clamp01 = (v: number) => Math.max(0, Math.min(1, v));
/** chega devagar: rapido no comeco e assentando no fim */
const saiDevagar = (t: number) => 1 - (1 - clamp01(t)) ** 3;

const contorno = (px: number, cor = "#000"): React.SVGProps<SVGTextElement> => ({
  stroke: cor,
  strokeWidth: px,
  strokeLinejoin: "round",
  paintOrder: "stroke",
});

/**
 * Escala de uma PANCADA a partir de uma mola: entra grande, bate, amassa um
 * pouco no repique e assenta em 1. Sem o limite o repique da mola passava do
 * ponto e o letreiro encolhia ate sumir.
 */
const batida = (mola: number): number =>
  mola <= 1 ? 1 + 1.6 * (1 - mola) : 1 - 0.35 * Math.min(1, mola - 1);

/**
 * Altura do placar. O topo da tela do TikTok/Shorts fica coberto pela
 * interface do app ("Seguindo | Para voce"): a 70px o placar sumia embaixo
 * dela.
 */
const TOPO = 220;

// ---------------------------------------------------------------------------

const Barra: React.FC<{
  id: FighterId;
  /**
   * O NOME VEM DE FORA, ja resolvido.
   *
   * Aqui se lia NOMES[id] -- a tabela padrao do modulo -- e com isso o campo
   * `nomes` do FightSpec era ignorado pela barra de vida. O duelo do vale
   * declarava CIANO e LARANJA e a tela escrevia VERDE e DOURADO, os nomes de
   * quando aqueles presets tinham outra cor. O spec declarava e o motor nao
   * lia.
   */
  nome: string;
  lado: -1 | 1;
  vida: number;
  fantasma: number;
  atingido: number;
  entrada: number;
  largura: number;
}> = ({ id, nome, lado, vida, fantasma, atingido, entrada, largura }) => {
  const L = 430;
  const H = 46;
  const x0 = lado < 0 ? 44 : largura - 44 - L;
  // a barra ancora na borda de fora e esvazia rumo ao centro
  const cheia = (v: number) => (L - 8) * (v / 100);
  const pisca = atingido < 6;
  const baixa = vida <= 25;
  const cor = baixa ? "#ff3b30" : "#ffd23f";
  const desliza = interpolate(entrada, [0, 1], [-160, 0]);
  const tremor = atingido < 10 ? (atingido % 2 === 0 ? 1 : -1) * (10 - atingido) : 0;
  const barraX = (v: number) => (lado < 0 ? x0 + 4 : x0 + L - 4 - cheia(v));

  return (
    <g transform={`translate(${tremor} ${desliza})`} opacity={entrada}>
      {/* painel */}
      <rect
        x={x0 - 6}
        y={TOPO}
        width={L + 12}
        height={H + 12}
        rx={10}
        fill="#0b0c12"
        stroke="#ffffff"
        strokeWidth={4}
      />
      <rect x={x0 + 4} y={TOPO + 10} width={L - 8} height={H - 8} fill="#3a0d0f" />
      {/* fantasma: o que acabou de ser perdido, descendo atrasado */}
      <rect
        x={barraX(fantasma)}
        y={TOPO + 10}
        width={cheia(fantasma)}
        height={H - 8}
        fill="#ffffff"
        opacity={0.85}
      />
      <rect
        x={barraX(vida)}
        y={TOPO + 10}
        width={cheia(vida)}
        height={H - 8}
        fill={pisca ? "#ffffff" : cor}
      />
      <rect
        x={barraX(vida)}
        y={TOPO + 10}
        width={cheia(vida)}
        height={(H - 8) * 0.35}
        fill="#ffffff"
        opacity={0.35}
      />
      <text
        x={lado < 0 ? x0 : x0 + L}
        y={TOPO + 110}
        textAnchor={lado < 0 ? "start" : "end"}
        fontFamily={PILHA}
        fontSize={64}
        fill={corDe(id)}
        {...contorno(10)}
        letterSpacing={2}
      >
        {nome}
      </text>
    </g>
  );
};

// ---------------------------------------------------------------------------

const Letreiro: React.FC<{
  r: Rotulo;
  idade: number;
  fps: number;
  largura: number;
  altura: number;
}> = ({ r, idade, fps, largura, altura }) => {
  const entra = spring({
    frame: idade,
    fps,
    config: { damping: 10, stiffness: 260, mass: 0.6 },
  });
  // pancada: entra grande e bate no tamanho; o normal nasce do zero
  const escala = r.pancada
    ? batida(entra)
    : interpolate(entra, [0, 1], [0.2, 1], { extrapolateRight: "clamp" });
  const some = interpolate(
    idade,
    [r.duracao - 10, r.duracao],
    [1, 0],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
  );
  const aparece = interpolate(idade, [0, 3], [0, 1], {
    extrapolateRight: "clamp",
  });
  // o letreiro respira depois de bater, senao parece colado na tela
  const pulso = 1 + 0.03 * Math.sin(idade * 0.35);
  const x =
    r.lado === 0 ? largura / 2 : r.lado < 0 ? largura * 0.27 : largura * 0.73;
  const inclinacao = r.lado === 0 ? -4 : r.lado * 6;

  return (
    <g
      transform={`translate(${x} ${altura * r.y}) rotate(${inclinacao}) scale(${escala * pulso})`}
      opacity={some * aparece}
    >
      <text
        textAnchor="middle"
        fontFamily={PILHA}
        fontSize={r.tamanho}
        fill={r.cor}
        {...contorno(Math.max(8, r.tamanho * 0.11))}
        letterSpacing={3}
      >
        {r.texto}
      </text>
      {r.sub && (
        <text
          y={r.tamanho * 0.62}
          textAnchor="middle"
          fontFamily={PILHA}
          fontSize={r.tamanho * 0.42}
          fill="#ffffff"
          {...contorno(8)}
          letterSpacing={2}
        >
          {r.sub}
        </text>
      )}
    </g>
  );
};

// ---------------------------------------------------------------------------

const Abertura: React.FC<{
  a: FighterId;
  b: FighterId;
  /** os nomes ja resolvidos pelo spec (ver a nota em Barra) */
  nomeA: string;
  nomeB: string;
  frame: number;
  fps: number;
  vs: number;
  lute: number;
  fim: number;
  largura: number;
  altura: number;
}> = ({ a, b, nomeA, nomeB, frame, fps, vs, lute, fim, largura, altura }) => {
  if (frame > lute + 40) return null;
  const sai = interpolate(frame, [fim - 8, fim], [1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const chega = spring({ frame, fps, config: { damping: 14, stiffness: 180 } });
  const bate = spring({
    frame: frame - vs,
    fps,
    config: { damping: 8, stiffness: 300, mass: 0.5 },
  });
  const luteIdade = frame - lute;
  const lutaEscala = spring({
    frame: luteIdade,
    fps,
    config: { damping: 9, stiffness: 280, mass: 0.5 },
  });
  const y = altura * 0.27;
  return (
    <g>
      {frame < fim && (
        <g opacity={sai}>
          {/* faixas diagonais atras dos nomes */}
          <polygon
            points={`0,${y - 150} ${largura * 0.62},${y - 190} ${largura * 0.5},${y + 10} 0,${y + 40}`}
            fill={corDe(a) === "#dfe5f5" ? "#1b1f2c" : corDe(a)}
            opacity={0.92}
            transform={`translate(${interpolate(chega, [0, 1], [-largura, 0])} 0)`}
          />
          <polygon
            points={`${largura},${y + 30} ${largura * 0.38},${y + 70} ${largura * 0.5},${y + 250} ${largura},${y + 220}`}
            fill={PRESETS[b].stroke}
            opacity={0.92}
            transform={`translate(${interpolate(chega, [0, 1], [largura, 0])} 0)`}
          />
          <text
            x={interpolate(chega, [0, 1], [-400, 60])}
            y={y - 50}
            fontFamily={PILHA}
            fontSize={120}
            fill="#ffffff"
            {...contorno(12)}
          >
            {nomeA}
          </text>
          <text
            x={interpolate(chega, [0, 1], [largura + 400, largura - 60])}
            y={y + 175}
            textAnchor="end"
            fontFamily={PILHA}
            fontSize={120}
            fill="#ffffff"
            {...contorno(12)}
          >
            {nomeB}
          </text>
          {frame >= vs && (
            <text
              x={largura / 2}
              y={y + 95}
              textAnchor="middle"
              fontFamily={PILHA}
              fontSize={200}
              fill="#ffd23f"
              {...contorno(16)}
              transform={`translate(${largura / 2} ${y + 30}) scale(${batida(bate)}) translate(${-largura / 2} ${-(y + 30)})`}
            >
              VS
            </text>
          )}
        </g>
      )}
      {luteIdade >= 0 && luteIdade < 40 && (
        <g
          transform={`translate(${largura / 2} ${altura * 0.25}) rotate(-5) scale(${batida(lutaEscala)})`}
          opacity={interpolate(luteIdade, [30, 40], [1, 0], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
          })}
        >
          <text
            textAnchor="middle"
            fontFamily={PILHA}
            fontSize={210}
            fill="#ff2e2e"
            {...contorno(18)}
            letterSpacing={4}
          >
            LUTE!
          </text>
        </g>
      )}
    </g>
  );
};

// ---------------------------------------------------------------------------

const nomeDe = (t: Timeline, id: FighterId) => t.spec.nomes?.[id] ?? NOMES[id];
const corDoElemento = (t: Timeline, id: FighterId) => {
  const el = t.spec.armas?.[id]?.elemento;
  return el === "gelo" ? "#8fe3ff" : el === "fogo" ? "#ff8a2a" : corDe(id);
};

/** o logo do canal entra batendo no centro, no final aberto */
const LogoDoFinal: React.FC<{ idade: number; fps: number; largura: number; altura: number }> = ({ idade, fps, largura, altura }) => {
  const mola = spring({ frame: idade, fps, config: { damping: 11, stiffness: 200, mass: 0.7 } });
  const escala = batida(mola);
  const w = 860;
  const h = w * (333 / 900);
  return (
    <Img
      src={staticFile("assets/marca/palitanos.png")}
      style={{
        position: "absolute",
        left: largura / 2 - w / 2,
        top: altura * 0.3 - h / 2,
        width: w,
        height: h,
        transform: `scale(${escala})`,
        opacity: Math.min(1, idade / 4),
        filter: "drop-shadow(0 6px 12px rgba(0,0,0,0.6))",
      }}
    />
  );
};

/** joinha desenhado a mao: em SVG proprio, porque emoji depende da fonte
 *  instalada na maquina que renderiza, e o Chrome do render nao tem as
 *  mesmas do computador onde isto foi escrito. */
const Joinha: React.FC<{ escala: number }> = ({ escala }) => (
  <g transform={`scale(${escala})`}>
    <path
      d="M -26 -6 L -26 40 L -6 40 L -6 -6 Z"
      fill="#ffffff"
      stroke="#000000"
      strokeWidth={7}
      strokeLinejoin="round"
    />
    <path
      d="M -2 40 L 30 40 C 40 40 44 33 42 25 L 34 -4 C 32 -12 26 -16 18 -16 L 6 -16 L 10 -34 C 12 -44 6 -52 -2 -50 C -7 -49 -9 -45 -10 -40 L -14 -20 C -15 -14 -12 -8 -6 -6 L -2 -6 Z"
      fill="#ffffff"
      stroke="#000000"
      strokeWidth={7}
      strokeLinejoin="round"
    />
  </g>
);

/**
 * ENCERRAMENTO: o vencedor vem para cima da camera e fecha a lona.
 *
 * Um botao parado no canto e um pedido que o espectador ja aprendeu a
 * ignorar. Aqui quem pede e o personagem que ele acabou de ver vencer, e o
 * pedido acontece COMO ACAO: ele corre na direcao de quem assiste, alcanca o
 * alto do quadro e puxa uma lona que cobre a cena inteira. O texto aparece na
 * lona -- ou seja, dentro do mundo, e nao colado por cima dele.
 *
 * Quatro tempos, e a ordem e o que faz funcionar:
 *
 *   CORRE      ele se aproxima. A escala cresce e o chao DESCE no quadro:
 *              as duas coisas juntas leem como aproximacao; so a escala
 *              leria como zoom.
 *   ALCANCA    para, braços para cima (a pose de salto ja tem as maos acima
 *              da cabeca), e e ai que fica claro que ele vai puxar algo.
 *   PUXA       a lona desce. A borda de baixo ONDULA e passa do ponto antes
 *              de assentar -- pano tem peso e nao para de uma vez; reta e
 *              rigida leria como retangulo preto aparecendo.
 *   PEDE       o texto entra na lona ja parada. Texto entrando junto com o
 *              pano em movimento disputa o olho com ele.
 */
const Encerramento: React.FC<{
  idade: number;
  fps: number;
  largura: number;
  altura: number;
  quem: FighterId;
}> = ({ idade, fps, largura, altura, quem }) => {
  if (idade < 0) return null;
  const preset = PRESETS[quem];

  // ---- 1. corre para a camera ---------------------------------------------
  const CORRIDA = 42;
  const k = clamp01(idade / CORRIDA);
  const chegou = idade >= CORRIDA;
  // ciclo de passada: duas poses alternando. Rapido o bastante para ler como
  // corrida, nao tao rapido que vire vibracao
  const passada = Math.floor(idade / 4) % 2 === 0 ? POSES.run1 : POSES.run2;
  /*
    ATE ONDE ELE CRESCE, e isto e conta e nao gosto.

    Da sola ao alto da cabeca o corpo mede cerca de 682 unidades na escala 1
    (267 do quadril ao pe, mais 322 do quadril a cabeca, mais 93 de raio do
    cranio). Numa tela de 1920 com o chao a 95% da altura, a escala 2.7 da
    1841 de corpo e a cabeca sai por cima da borda -- foi o que aconteceu na
    primeira versao, e cabeca cortada le como erro, nao como proximidade.

    Em 2.0 o corpo mede 1364 e o alto da cabeca cai a 460 do topo: ele chega
    perto o bastante para dominar o quadro e ainda cabe inteiro nele.
  */
  const escala = 0.5 + 1.5 * saiDevagar(k);
  const chao = altura * (0.52 + 0.43 * saiDevagar(k));
  const cx = largura * (0.18 + 0.32 * saiDevagar(k));

  // ---- 2. alcanca ---------------------------------------------------------
  const ALCANCA = CORRIDA + 16;
  const esticando = clamp01((idade - CORRIDA) / 16);

  // ---- 3. a lona desce ----------------------------------------------------
  const PUXA_LONA = ALCANCA - 4;
  const q = clamp01((idade - PUXA_LONA) / 22);
  // passa do ponto e volta: pano pesado nao para de uma vez
  const descida = saiDevagar(q) * (1 + 0.06 * Math.sin(q * Math.PI));
  const base = altura * 1.04 * descida;
  // a barriga do pano some conforme ele assenta
  const barriga = 150 * (1 - q) + 26 * (1 - clamp01((idade - PUXA_LONA - 22) / 20));

  // ---- 4. o pedido --------------------------------------------------------
  const TEXTO = PUXA_LONA + 26;
  const molaTexto = spring({ frame: idade - TEXTO, fps, config: { damping: 11, stiffness: 220, mass: 0.6 } });
  const pulso = 1 + 0.05 * Math.sin((idade - TEXTO) * 0.26);

  return (
    <g>
      {/*
        O corpo sai assim que a lona passa por ele. A 0.75 as pernas ainda
        apareciam por baixo da borda do pano, o que le como recorte mal feito
        -- quem puxa a lona fica ATRAS dela.
      */}
      {q < 0.42 && (
        <g transform={`translate(${cx.toFixed(1)} ${chao.toFixed(1)}) scale(${escala.toFixed(3)})`}>
          <Stickman
            preset={preset}
            pose={chegou ? POSES.jump : passada}
            baseX={0}
            baseY={0}
            facing={1}
            giro={1}
            spin={0}
            scaleExtra={1}
            opacity={1 - clamp01((esticando - 1) * 0)}
          />
        </g>
      )}

      {/* A LONA. Borda de baixo em curva: e ela que da peso ao pano. */}
      {q > 0 && (
        <path
          d={
            `M0 0 L${largura} 0 L${largura} ${base.toFixed(1)} ` +
            `Q${(largura / 2).toFixed(1)} ${(base + barriga).toFixed(1)} 0 ${base.toFixed(1)} Z`
          }
          fill="#07080c"
        />
      )}
      {/* vinco de luz na dobra: sem ele a lona e um retangulo preto chapado */}
      {q > 0 && (
        <path
          d={`M0 ${base.toFixed(1)} Q${(largura / 2).toFixed(1)} ${(base + barriga).toFixed(1)} ${largura} ${base.toFixed(1)}`}
          fill="none"
          stroke="#2a2f3f"
          strokeWidth={7}
        />
      )}

      {/* O PEDIDO, na lona */}
      {idade >= TEXTO && (
        <g transform={`translate(${largura / 2} ${altura * 0.42}) scale(${batida(molaTexto)})`}>
          <text textAnchor="middle" fontFamily={PILHA} fontSize={128} fill="#ffffff" {...contorno(12)} letterSpacing={2}>
            GOSTOU?
          </text>
          <g transform={`translate(0 130) scale(${pulso})`}>
            <text textAnchor="middle" fontFamily={PILHA} fontSize={150} fill="#ffd23f" {...contorno(14)} letterSpacing={3}>
              SE INSCREVE!
            </text>
          </g>
          <g transform={`translate(0 270) scale(${pulso})`}>
            <Joinha escala={2.6} />
          </g>
          <text y={510} textAnchor="middle" fontFamily={PILHA} fontSize={78} fill="#ffffff" {...contorno(10)} letterSpacing={2}>
            DEIXA O LIKE!
          </text>
        </g>
      )}
    </g>
  );
};

/**
 * O FIM. Duas versoes do mesmo bloco, e o que muda entre elas e se a luta
 * teve vencedor:
 *
 *   sem vencedor  "BLACK vs RED" e "QUEM DEVE VENCER?" -- a pergunta puxa o
 *                 comentario porque ninguem ganhou
 *   com vencedor  o nome de quem venceu e "VOCE ACERTOU?" -- que cobra a
 *                 aposta feita na tela de escolha, no comeco do video
 *
 * A segunda existe porque o video abre pedindo para escolher um personagem.
 * Terminar com "quem deve vencer?" depois de um deles ter sido partido ao
 * meio faria a pergunta errada, e pior: jogaria fora a unica coisa que o
 * gancho prometeu entregar.
 */
const FinalAberto: React.FC<{
  idade: number;
  fps: number;
  largura: number;
  altura: number;
  a: string;
  b: string;
  corA: string;
  corB: string;
  vencedor?: { nome: string; cor: string };
  vencedorId?: FighterId;
}> = ({ idade, fps, largura, altura, a, b, corA, corB, vencedor, vencedorId }) => {
  /**
   * Quando o encerramento comeca, contado do inicio do fim.
   *
   * Depois da pergunta (que entra em 100) e nao junto: a pergunta cobra a
   * aposta da tela de escolha e precisa ser lida sozinha. O vencedor so entra
   * correndo quando ela ja foi entendida.
   */
  const ENTRADA_DO_BOTAO = 158;
  /*
    O QUE ESTAVA NA TELA SAI ANTES DELE CHEGAR.

    O nome de quem venceu e a pergunta ficavam no quadro enquanto o vencedor
    corria para a camera, e o corpo dele passava por cima das letras. Duas
    camadas de informacao disputando o mesmo espaco: nenhuma das duas e lida.

    Some nos 26 quadros que antecedem a chegada, entao quando ele domina o
    quadro ja nao ha texto atras dele.
  */
  const saiTexto = 1 - clamp01((idade - (ENTRADA_DO_BOTAO - 26)) / 22);
  const escurece = Math.min(0.45, idade / 30);
  const nomes = idade - 45;
  const pergunta = idade - ESPERA_DA_PERGUNTA;
  const molaNomes = spring({ frame: nomes, fps, config: { damping: 10, stiffness: 240, mass: 0.6 } });
  const molaPergunta = spring({ frame: pergunta, fps, config: { damping: 9, stiffness: 260, mass: 0.6 } });
  const pulso = 1 + 0.03 * Math.sin(pergunta * 0.3);
  return (
    <g>
      <rect width={largura} height={altura} fill="#000" opacity={escurece} />
      {nomes >= 0 && vencedor && saiTexto > 0 && (
        <g opacity={saiTexto} transform={`translate(${largura / 2} ${altura * 0.45}) scale(${batida(molaNomes)})`}>
          <text textAnchor="middle" fontFamily={PILHA} fontSize={150} fill={vencedor.cor} {...contorno(14)}>
            {vencedor.nome}
          </text>
          <text y={120} textAnchor="middle" fontFamily={PILHA} fontSize={110} fill="#ffffff" {...contorno(12)} letterSpacing={4}>
            VENCE!
          </text>
        </g>
      )}
      {nomes >= 0 && !vencedor && saiTexto > 0 && (
        <g opacity={saiTexto} transform={`translate(${largura / 2} ${altura * 0.47}) scale(${batida(molaNomes)})`}>
          <text x={-40} textAnchor="end" fontFamily={PILHA} fontSize={130} fill={corA} {...contorno(12)}>
            {a}
          </text>
          <text textAnchor="middle" y={-6} fontFamily={PILHA} fontSize={80} fill="#ffffff" {...contorno(10)}>
            vs
          </text>
          <text x={40} textAnchor="start" fontFamily={PILHA} fontSize={130} fill={corB} {...contorno(12)}>
            {b}
          </text>
        </g>
      )}
      {pergunta >= 0 && saiTexto > 0 && (
        <g opacity={saiTexto} transform={`translate(${largura / 2} ${altura * 0.63}) rotate(-3) scale(${batida(molaPergunta) * pulso})`}>
          {vencedor ? (
            <>
              <text textAnchor="middle" fontFamily={PILHA} fontSize={136} fill="#ffd23f" {...contorno(14)} letterSpacing={3}>
                VOCE
              </text>
              <text y={128} textAnchor="middle" fontFamily={PILHA} fontSize={150} fill="#ffd23f" {...contorno(14)} letterSpacing={3}>
                ACERTOU?
              </text>
              <text y={210} textAnchor="middle" fontFamily={PILHA} fontSize={54} fill="#ffffff" {...contorno(8)}>
                COMENTA AI!
              </text>
            </>
          ) : (
            <>
              <text textAnchor="middle" fontFamily={PILHA} fontSize={120} fill="#ffd23f" {...contorno(14)} letterSpacing={3}>
                QUEM DEVE
              </text>
              <text y={120} textAnchor="middle" fontFamily={PILHA} fontSize={140} fill="#ffd23f" {...contorno(14)} letterSpacing={3}>
                VENCER?
              </text>
              <text y={205} textAnchor="middle" fontFamily={PILHA} fontSize={54} fill="#ffffff" {...contorno(8)}>
                COMENTA AI!
              </text>
            </>
          )}
        </g>
      )}
      {vencedorId && (
        <Encerramento
          idade={idade - ENTRADA_DO_BOTAO}
          fps={fps}
          largura={largura}
          altura={altura}
          quem={vencedorId}
        />
      )}
    </g>
  );
};

export const Espetaculo: React.FC<{ timeline: Timeline }> = ({ timeline }) => {
  const frame = useCurrentFrame();
  const { width, height, fps } = useVideoConfig();
  const e = espetaculoDe(timeline);
  const { fighterA, fighterB } = timeline.spec;

  // placar: entra junto com o LUTE!
  // e sai quando a placa do vencedor sobe: a placa ocupa o alto da tela
  // (luta cinematica: o placar nunca entra)
  const entrada = !Number.isFinite(e.entradaDoPlacar)
    ? 0
    : interpolate(
        frame,
        [e.entradaDoPlacar, e.entradaDoPlacar + 12],
        [0, 1],
        { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
      ) *
      (Number.isFinite(e.saidaDoPlacar)
        ? interpolate(
            frame,
            [e.saidaDoPlacar - 14, e.saidaDoPlacar],
            [1, 0],
            { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
          )
        : 1);
  const noFinal = e.final !== undefined && frame >= e.final;

  // letreiros: em cada vaga so aparece o mais recente
  const porVaga = new Map<string, Rotulo>();
  for (const r of e.rotulos) {
    if (frame < r.inicio || frame >= r.inicio + r.duracao) continue;
    const atual = porVaga.get(r.vaga);
    if (!atual || r.inicio >= atual.inicio) porVaga.set(r.vaga, r);
  }
  // o K.O. apaga o resto do centro e dos lados
  const koNaTela = e.rotulos.some(
    (r) => r.texto === "K.O.!" && frame >= r.inicio,
  );

  // selo no meio do placar: acende em vermelho no nocaute
  const koAceso = koNaTela && Math.floor((frame - (e.ko?.real ?? 0)) / 6) % 2 === 0;

  return (
    <AbsoluteFill style={{ pointerEvents: "none" }}>
      {/* marca d'agua: no placar enquanto ele esta na tela, no rodape fora dele */}
      <MarcaDagua vaga="placar" opacidade={noFinal ? 0 : entrada} larguraTela={width} />
      <MarcaDagua vaga="rodape" opacidade={noFinal ? 0 : 1 - entrada} larguraTela={width} />
      <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
        {entrada > 0 && (
          <g>
            {([fighterA, fighterB] as FighterId[]).map((id, i) => {
              const v = vidaNoQuadro(e, id, frame);
              return (
                <Barra
                  key={id}
                  id={id}
                  nome={nomeDe(timeline, id)}
                  lado={i === 0 ? -1 : 1}
                  vida={v.vida}
                  fantasma={v.fantasma}
                  atingido={v.atingido}
                  entrada={entrada}
                  largura={width}
                />
              );
            })}
            <g opacity={entrada}>
              <circle
                cx={width / 2}
                cy={TOPO + 29}
                r={52}
                fill={koAceso ? "#ff2e2e" : "#0b0c12"}
                stroke="#ffffff"
                strokeWidth={5}
              />
              <text
                x={width / 2}
                y={TOPO + 52}
                textAnchor="middle"
                fontFamily={PILHA}
                fontSize={62}
                fill={koAceso ? "#ffffff" : "#ffd23f"}
              >
                {koNaTela ? "KO" : "VS"}
              </text>
            </g>
          </g>
        )}

        <Abertura
          a={fighterA}
          b={fighterB}
          nomeA={nomeDe(timeline, fighterA)}
          nomeB={nomeDe(timeline, fighterB)}
          frame={frame}
          fps={fps}
          {...e.abertura}
          largura={width}
          altura={height}
        />

        {[...porVaga.values()]
          .filter(
            (r) =>
              !koNaTela || r.vaga === "centro" || r.vaga === "vence",
          )
          .map((r) => (
            <Letreiro
              key={`${r.vaga}-${r.inicio}`}
              r={r}
              idade={frame - r.inicio}
              fps={fps}
              largura={width}
              altura={height}
            />
          ))}
        {noFinal && e.final !== undefined && (
          <FinalAberto
            idade={frame - e.final}
            fps={fps}
            largura={width}
            altura={height}
            a={nomeDe(timeline, fighterA)}
            b={nomeDe(timeline, fighterB)}
            corA={corDoElemento(timeline, fighterA)}
            corB={corDoElemento(timeline, fighterB)}
            vencedor={
              e.ko
                ? {
                    nome: nomeDe(timeline, e.ko.vencedor),
                    cor: corDoElemento(timeline, e.ko.vencedor),
                  }
                : undefined
            }
            vencedorId={e.ko?.vencedor}
          />
        )}
      </svg>
      {noFinal && e.final !== undefined && (
        <LogoDoFinal idade={frame - e.final} fps={fps} largura={width} altura={height} />
      )}
    </AbsoluteFill>
  );
};
