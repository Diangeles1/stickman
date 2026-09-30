/**
 * VALE DESTRUIDO: o cenário que o roteiro dos ninjas pediu.
 *
 * O que um vale dá e uma rua não dá: ESCALA VERTICAL. Prédio tem altura de
 * prédio; montanha tem altura de montanha, e num vídeo em que dois corpos
 * disparam rajada um no outro é a montanha que diz o tamanho daquilo.
 *
 * PROFUNDIDADE AÉREA é o que faz a paisagem funcionar, e é uma regra física e
 * não um gosto: quanto mais longe, mais ar entre o olho e a coisa, e mais a
 * cor dela puxa para a do céu. Serra distante quase some no horizonte; a da
 * frente é quase preta. Sem isso as camadas viram recortes empilhados e a
 * profundidade não existe, por mais camadas que se acrescente.
 *
 * DISCIPLINA DE CONTRASTE, a mesma da metrópole: as massas ficam entre 1.0 e
 * 1.8 contra o céu e os corpos seguem acima de 4.0. Paisagem bonita que come
 * os lutadores é paisagem errada -- aqui o cenário é o palco, nunca o assunto.
 *
 * Tudo procedural a partir de ruído determinista: o mesmo índice sempre dá a
 * mesma montanha, então nada treme entre quadros e não há arquivo de dados.
 */

import React from "react";

const ruido = (n: number): number => {
  const x = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
};

/**
 * Silhueta de serra: uma linha quebrada com picos de altura sorteada.
 *
 * Os picos usam DUAS frequências somadas -- poucos picos altos e muitos
 * dentes pequenos. Só a frequência baixa daria colinas lisas de papel de
 * parede; só a alta daria uma serra de dentes iguais. A soma é o que dá
 * silhueta de montanha.
 */
const serra = (
  semente: number,
  largura: number,
  base: number,
  altura: number,
  dentes: number,
): string => {
  const pts: string[] = [`${-largura} ${base}`];
  for (let i = 0; i <= dentes; i++) {
    const t = i / dentes;
    const x = -largura + t * largura * 2;
    const grande = Math.sin(t * Math.PI * 2.1 + semente) * 0.5 + 0.5;
    const pequeno = ruido(semente * 13 + i);
    const h = altura * (0.35 + 0.5 * grande + 0.28 * pequeno);
    pts.push(`${x.toFixed(0)} ${(base - h).toFixed(0)}`);
  }
  pts.push(`${largura} ${base}`);
  return pts.join(" L");
};

/**
 * Céu e serras. Tudo dentro da câmera, antes do piso.
 *
 * `camX` é a posição da câmera; cada camada anda uma fração dela. Camada de
 * profundidade `p`: 0 não anda (infinito), 1 anda junto com o chão.
 */
export const CeuDoVale: React.FC<{ camX: number; extensao?: number }> = ({
  camX,
  extensao = 5200,
}) => {
  const camada = (p: number) => `translate(${(camX * (1 - p)).toFixed(1)} 0)`;
  return (
    <g data-layer="vale">
      {/*
        O CÉU. Escuro em cima e quente perto do horizonte: é o que sobra de
        luz depois do sol, e é ele que recorta as serras.
      */}
      <defs>
        <linearGradient id="vale-ceu" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#0a0f24" />
          <stop offset="55%" stopColor="#1d2445" />
          <stop offset="72%" stopColor="#4a3a58" />
          <stop offset="88%" stopColor="#7a4a4a" />
          <stop offset="100%" stopColor="#a86449" />
        </linearGradient>
        <radialGradient id="vale-brilho" cx="50%" cy="100%" r="70%">
          <stop offset="0%" stopColor="#d4794f" stopOpacity={0.8} />
          <stop offset="100%" stopColor="#c9704f" stopOpacity={0} />
        </radialGradient>
      </defs>
      <rect x={-extensao} y={-2600} width={extensao * 2} height={2620} fill="url(#vale-ceu)" />

      {/* o clarão baixo do horizonte, onde o sol acabou de sair */}
      <g transform={camada(0.04)}>
        <ellipse cx={220} cy={30} rx={extensao * 0.5} ry={480} fill="url(#vale-brilho)" />
      </g>

      {/*
        QUATRO SERRAS, da mais distante à mais próxima. A cor vai do tom do
        céu ao quase preto: é a profundidade aérea, e é ela que faz o vale
        parecer fundo em vez de empilhado.
      */}
      {/*
        A ESCADA DE CLARIDADE ENTRE AS CAMADAS E O EFEITO INTEIRO.

        A primeira versao usou tons quase iguais (#2b3352 a #0e1220) tentando
        manter o fundo apagado, e o vale sumiu: sem degrau entre as camadas
        nao ha profundidade, so uma mancha escura. A serra distante precisa
        estar visivelmente MAIS CLARA que a proxima -- e o ar entre elas.

        Continua abaixo dos corpos com folga: a mais clara fica em 1.9 contra
        o ceu e os lutadores seguem acima de 4.
      */}
      {/*
        AS ALTURAS SAO DITADAS PELO QUE A CAMERA MOSTRA.

        A primeira versao punha os picos entre -1400 e -1900, mirando a escala
        vertical que um vale deveria ter. So que a camera desta luta fica
        fechada e baixa: ela mostra de -950 a +650, e as montanhas ficavam
        INTEIRAS acima do quadro. O vale existia no arquivo e nao no video.

        Com picos entre -400 e -900 eles caem dentro do que se ve em quase
        todo plano. A escala vem do numero de camadas e do degrau de cor entre
        elas, nao da altura bruta -- que nao aparece se ninguem enquadra.
      */}
      {[
        { p: 0.08, base: 30, altura: 480, cor: "#55618f", dentes: 26, semente: 3 },
        { p: 0.18, base: 30, altura: 660, cor: "#3c4670", dentes: 18, semente: 11 },
        { p: 0.32, base: 35, altura: 880, cor: "#272f4f", dentes: 12, semente: 23 },
        { p: 0.5, base: 40, altura: 600, cor: "#141a2e", dentes: 9, semente: 37 },
      ].map((s, i) => (
        <g key={i} transform={camada(s.p)}>
          <path
            d={`M${serra(s.semente, extensao, s.base, s.altura, s.dentes)} L${extensao} 40 L${-extensao} 40Z`}
            fill={s.cor}
          />
        </g>
      ))}

      {/*
        A MONTANHA PARTIDA. O roteiro joga um dos dois contra ela, então ela
        precisa existir como coisa específica e não como mais um dente da
        serra: um pico alto com uma fenda aberta no meio, alto o bastante
        para sair do quadro.
      */}
      <g transform={camada(0.42)}>
        <path
          d="M -1180 40 L -940 -1060 L -800 -640 L -740 -1180 L -540 40 Z"
          fill="#1b2340"
        />
        {/* a fenda: um vinco claro descendo do topo, onde a rocha abriu */}
        <path
          d="M -862 -1010 L -834 -570 L -806 -170 L -828 -170 L -856 -570 Z"
          fill="#3d3050"
          opacity={0.95}
        />
      </g>

      {/*
        PEDRAS FLUTUANDO AO LONGE. Não é enfeite: é o que diz que o que
        aconteceu aqui não foi uma briga comum. Ficam na camada distante e
        quase não se movem, então leem como enormes.
      */}
      <g transform={camada(0.26)}>
        {Array.from({ length: 14 }, (_, i) => {
          const x = -extensao * 0.8 + ruido(i * 7) * extensao * 1.6;
          const y = -760 + ruido(i * 11) * 620;
          const r = 12 + ruido(i * 5) * 30;
          const gira = ruido(i * 3) * 60 - 30;
          return (
            <polygon
              key={i}
              points={`${-r},${r * 0.5} ${-r * 0.5},${-r} ${r * 0.8},${-r * 0.4} ${r * 0.6},${r * 0.7}`}
              transform={`translate(${x.toFixed(0)} ${y.toFixed(0)}) rotate(${gira.toFixed(0)})`}
              fill="#1b2136"
            />
          );
        })}
      </g>
    </g>
  );
};

/**
 * ONDE O PAREDAO ESTA, em coordenada de mundo.
 *
 * Exportado porque a coreografia precisa do numero: para alguem ser
 * arremessado CONTRA a rocha, o compilador tem que saber onde ela fica. A
 * montanha do fundo nao serve para isso -- ela tem paralaxe, entao a posicao
 * dela na tela depende de onde a camera esta, e nao existe um X do mundo em
 * que um corpo possa bater nela.
 *
 * O paredao fica na camada do chao (sem paralaxe): ali o mundo e o mesmo para
 * o cenario e para os lutadores.
 */
export const PAREDAO_X = -1450;

/**
 * PAREDAO DE ROCHA: a face que recebe o corpo arremessado.
 *
 * `trincado` vai de 0 a 1 e abre as fendas do impacto. Elas ficam no desenho
 * e nao somem: rocha que racha e volta ao normal desfaz o golpe que a rachou.
 */
export const Paredao: React.FC<{ trincado: number }> = ({ trincado }) => {
  const t = Math.max(0, Math.min(1, trincado));
  return (
    <g data-layer="paredao" transform={`translate(${PAREDAO_X} 0)`}>
      {/*
        A MASSA. Mais clara que o terreno (#191521) de proposito: encostada
        nele, uma rocha da mesma cor do chao nao tem silhueta e o corpo parece
        bater no nada. O degrau de claridade e o que faz a pedra existir.

        Medido pintando a massa de verde num quadro do impacto: ela SEMPRE
        esteve no quadro, ocupando 216 dos 1080 pixels na borda esquerda. Nao
        era ausencia, era valor -- escura demais contra o vale noturno, lia
        como mais um espigao do fundo. O que faltava era peso, nao presenca.
      */}
      <path d="M -900 40 L -820 -1300 L -260 -1500 L -40 -900 L 0 40 Z" fill="#332b44" />
      {/* a face iluminada, virada para a luta: e nela que o corpo bate */}
      <path d="M -40 -900 L 0 40 L -190 40 L -250 -830 Z" fill="#493c5b" />
      {/* o gume do alto pega a luz baixa do horizonte */}
      <path
        d="M -820 -1300 L -260 -1500 L -250 -1460 L -812 -1262 Z"
        fill="#5c4a5e"
      />
      {/*
        A QUINA ACESA. O vale ja tem espigoes escuros; sem uma borda que separe
        a pedra do fundo, o paredao vira mais um deles e o corpo parece bater
        no nada. E a linha vertical que diz "aqui a rocha termina".
      */}
      <path d="M 0 40 L -40 -900 L -12 -900 L 14 40 Z" fill="#6b5570" />
      {/*
        VEIOS: textura da superficie, e nao estrutura.

        A primeira versao usava quatro listras escuras (#221c30 contra
        #332b44) atravessando a altura inteira da pedra. De longe o efeito era
        o oposto do pretendido: a massa lia como uma PALICADA de espigoes
        finos, igual aos do vale ao fundo, em vez de um bloco unico -- e um
        corpo nao bate numa cerca.

        Agora sao poucos, com pouca diferenca de valor, e param na metade da
        altura. Veio se ve de perto; silhueta se ve de longe, e a silhueta tem
        precedencia.
      */}
      {[0, 1, 2].map((i) => (
        <path
          key={i}
          d={`M ${-700 + i * 230} 40 L ${-640 + i * 230} ${-340 - i * 120} L ${-612 + i * 230} ${-326 - i * 120} L ${-672 + i * 230} 40 Z`}
          fill="#2b2439"
        />
      ))}
      {/* AS FENDAS DO IMPACTO, abrindo com `trincado` */}
      {t > 0.01 &&
        [0, 1, 2, 3, 4].map((i) => {
          const ang = -2.1 + i * 0.42;
          const comp = (220 + i * 70) * t;
          // na FACE, na altura em que o corpo bate -- nao no meio da massa
          const ox = -35;
          const oy = -300;
          return (
            <path
              key={`f${i}`}
              d={
                `M${ox} ${oy} ` +
                `L${(ox + Math.cos(ang) * comp * 0.5).toFixed(0)} ${(oy + Math.sin(ang) * comp * 0.5 + 20).toFixed(0)} ` +
                `L${(ox + Math.cos(ang) * comp).toFixed(0)} ${(oy + Math.sin(ang) * comp).toFixed(0)}`
              }
              fill="none"
              stroke="#0a0810"
              strokeWidth={9 * t}
              strokeLinecap="round"
            />
          );
        })}
      {/* a cratera no ponto do impacto */}
      {t > 0.01 && (
        <ellipse cx={-150} cy={-430} rx={90 * t} ry={110 * t} fill="#0a0810" opacity={0.85} />
      )}
    </g>
  );
};

/**
 * O CHÃO DO VALE: terra rachada, pedras fincadas e poeira baixa.
 *
 * Desenhado DEPOIS dos lutadores não -- antes. O que fica na frente deles é
 * só a poeira, e bem apagada: qualquer massa sólica à frente competiria com
 * a silhueta, que é a única coisa que não pode perder leitura.
 */
export const ChaoDoVale: React.FC<{ camX: number; extensao?: number }> = ({
  camX,
  extensao = 5200,
}) => (
  <g data-layer="vale-chao">
    {/* a terra */}
    <rect x={-extensao} y={0} width={extensao * 2} height={1400} fill="#191521" />
    {/* a crista do terreno pega a luz baixa do horizonte */}
    <rect x={-extensao} y={0} width={extensao * 2} height={18} fill="#5a4652" />

    {/*
      PEDRAS FINCADAS, em duas profundidades. As de trás são maiores e mais
      claras (mais ar na frente delas); as da frente, menores e quase pretas.
      Invertido, a paisagem achata.
    */}
    {[
      { p: 0.7, cor: "#241f33", n: 12, escala: 1.5, y: -10 },
      { p: 1, cor: "#100d18", n: 16, escala: 0.8, y: 8 },
    ].map((faixa, fi) => (
      <g key={fi} transform={`translate(${(camX * (1 - faixa.p)).toFixed(1)} 0)`}>
        {Array.from({ length: faixa.n }, (_, i) => {
          const x = -extensao * 0.9 + ruido(fi * 31 + i * 9) * extensao * 1.8;
          const h = (40 + ruido(fi * 17 + i * 5) * 150) * faixa.escala;
          const w = h * (0.22 + ruido(fi * 23 + i) * 0.2);
          const inc = (ruido(fi * 13 + i * 3) - 0.5) * 30;
          return (
            <path
              key={i}
              d={`M${-w} 0 L${-w * 0.4} ${-h} L${w * 0.5} ${-h * 0.8} L${w} 0Z`}
              transform={`translate(${x.toFixed(0)} ${faixa.y}) rotate(${inc.toFixed(0)})`}
              fill={faixa.cor}
            />
          );
        })}
      </g>
    ))}
  </g>
);

/**
 * POEIRA BAIXA, na frente de tudo. Bem apagada: ela dá atmosfera e não pode
 * disputar leitura com a silhueta dos lutadores.
 */
export const PoeiraDoVale: React.FC<{ camX: number; frame: number; largura: number; altura: number }> = ({
  camX,
  frame,
  largura,
  altura,
}) => (
  <g data-layer="vale-poeira" style={{ mixBlendMode: "screen" }}>
    {Array.from({ length: 7 }, (_, i) => {
      const vel = 0.1 + ruido(i * 7) * 0.22;
      const x = ((frame * vel + ruido(i * 3) * largura) % (largura * 1.6)) - largura * 0.3;
      const y = altura * (0.62 + ruido(i * 11) * 0.3);
      const w = largura * (0.3 + ruido(i * 5) * 0.5);
      return (
        <ellipse
          key={i}
          cx={x - camX * 0.02}
          cy={y}
          rx={w}
          ry={w * 0.12}
          fill="#6a5a72"
          opacity={0.05 + ruido(i * 13) * 0.05}
        />
      );
    })}
  </g>
);
