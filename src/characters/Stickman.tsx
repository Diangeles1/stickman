/**
 * O stickman em SVG.
 *
 * Modular de proposito: cada osso e um <line> proprio e a cabeca um <circle>,
 * todos com data-part, entao qualquer parte pode ser controlada, pintada ou
 * animada de forma independente sem reescrever o componente.
 *
 * Componente PURO: recebe pose e transformacao por props e nao guarda estado.
 * Nada de useState, useEffect ou transition de CSS aqui dentro; no Remotion
 * isso causaria flicker, porque cada quadro e renderizado isolado.
 */

import React from "react";
import type { FighterPreset, JointName, Pose, Vec2 } from "../core/types";
import {
  JUNTAS_FUNDO,
  OSSOS,
  juntasNoMundo,
  type Transformacao,
} from "./skeleton";

export type StickmanProps = {
  preset: FighterPreset;
  pose: Pose;
  baseX: number;
  /** altura do quadril no mundo (negativo = acima do chao) */
  baseY: number;
  facing: 1 | -1;
  /** multiplica o scale do preset, para socar em "close" sem mexer na pose */
  scaleExtra?: number;
  /** rotacao do corpo em torno do quadril, em graus (chute giratorio) */
  spin?: number;
  /** giro no eixo vertical: 1 de frente, -1 de costas (ver Transformacao) */
  giro?: number;
  opacity?: number;
  /**
   * Velocidade horizontal do corpo, em unidades por quadro.
   *
   * Usada como SECONDARY ACTION: cabelo e peca solta nao acompanham a cabeca
   * no mesmo quadro, eles atrasam e depois alcancam. Sem isso o cabelo e uma
   * silhueta parafusada no cranio, e o corpo inteiro le como recorte rigido
   * por mais bem animado que o esqueleto esteja.
   */
  velocidade?: number;
  /** escurece o braco e a perna de tras, o que da leitura de volume */
  profundidade?: boolean;
  /**
   * Liga o contorno escuro.
   *
   * Ele existe para separar um corpo do outro quando se encostam sobre fundo
   * ESCURO. Sobre fundo claro ele vira uma borda preta desenhada em volta do
   * personagem, que a referencia nao tem: la a separacao vem do proprio fundo
   * branco aparecendo entre os membros.
   */
  contorno?: boolean;
};

/**
 * Contorno do personagem: espessura extra de cada lado, em unidades de mundo.
 *
 * Pequeno de proposito. O que ele precisa fazer e separar um corpo do outro
 * quando se encostam, nao virar uma borda de adesivo.
 */
const CONTORNO = 5;

/**
 * Cor do contorno: mais escura que o fundo da arena.
 *
 * Contra o fundo ele some (e e o que se quer, senao vira borda desenhada);
 * contra o outro lutador ele aparece e corta a silhueta.
 */
const COR_DO_CONTORNO = "#050609";

/** Membros da FRENTE: de costas para a camera eles passam a ficar atras. */
const JUNTAS_FRENTE = new Set<JointName>([
  "shoulderFront",
  "elbowFront",
  "handFront",
  "kneeFront",
  "footFront",
]);

const ehDeFundo = (junta: JointName, deCostas: boolean): boolean =>
  deCostas ? JUNTAS_FRENTE.has(junta) : JUNTAS_FUNDO.has(junta);

/**
 * Ossos na ordem de profundidade para o lado que o corpo mostra.
 *
 * De costas (no meio do chute giratorio) o braco e a perna "de tras" ficam
 * mais perto da camera. Sem trocar a ordem, o membro de tras continuava
 * escuro e por baixo, e o giro lia como corpo achatando, nao virando.
 */
const ossosEmOrdem = (deCostas: boolean): [JointName, JointName][] => {
  if (!deCostas) return OSSOS;
  const fundo = OSSOS.filter(
    ([a, b]) => ehDeFundo(a, true) || ehDeFundo(b, true),
  );
  const resto = OSSOS.filter(
    ([a, b]) => !(ehDeFundo(a, true) || ehDeFundo(b, true)),
  );
  return [...fundo, ...resto];
};

/**
 * Clareia uma cor hex, aproximando de branco por `fator` (0 a 1).
 *
 * Usada no gradiente do olho. Aumentar cada canal por multiplicacao
 * saturaria o mais forte primeiro e viraria a cor -- azul claro puxaria
 * para ciano. Interpolar ate o branco mantem o matiz.
 */
const clarear = (hex: string, fator: number): string => {
  const n = parseInt(hex.slice(1), 16);
  const mistura = (c: number) => Math.round(c + (255 - c) * fator);
  return `rgb(${mistura((n >> 16) & 255)},${mistura((n >> 8) & 255)},${mistura(n & 255)})`;
};

/** Escurece uma cor hex por um fator. Usado no membro de tras. */
const escurecer = (hex: string, fator: number): string => {
  const n = parseInt(hex.slice(1), 16);
  const r = Math.round(((n >> 16) & 255) * fator);
  const g = Math.round(((n >> 8) & 255) * fator);
  const b = Math.round((n & 255) * fator);
  return `rgb(${r},${g},${b})`;
};

export const Stickman: React.FC<StickmanProps> = ({
  preset,
  pose,
  baseX,
  baseY,
  facing,
  scaleExtra = 1,
  spin = 0,
  giro = 1,
  opacity = 1,
  velocidade = 0,
  profundidade = true,
  contorno = true,
}) => {
  const transformacao: Transformacao = {
    baseX,
    baseY,
    facing,
    scale: preset.scale * scaleExtra,
    spin,
    giro,
  };
  const deCostas = giro < 0;
  const ossos = ossosEmOrdem(deCostas);
  const j: Record<JointName, Vec2> = juntasNoMundo(pose, transformacao);
  const largura = preset.limbWidth * preset.scale * scaleExtra;
  /*
    PROFUNDIDADE POR COR foi REMOVIDA daqui.

    O membro de tras era escurecido (0.8) e afinado (0.86). Contra este fundo
    a conta ja era apertada -- havia tres blocos de medicao de contraste nos
    presets so para o membro escurecido nao afundar no preto -- e o custo
    real aparecia por DENTRO do corpo: braco de tras cruzando o tronco virava
    uma mancha escura, com uma borda de contorno exposta em volta.

    Quem da profundidade agora e a luz e a sombra de borda, que so existem na
    silhueta externa. O parametro `profundidade` continua no tipo porque a
    ficha de poses e o modo de depuracao o usam.
  */
  const raioCabeca = preset.headRadius * preset.scale * scaleExtra;

  /*
    IDENTIFICADOR UNICO DESTE DESENHO. As mascaras abaixo vivem em ids
    globais do documento, e o mesmo lutador aparece varias vezes no quadro
    (o corpo mais as copias do rastro). Posicao arredondada basta: cada
    instancia esta num lugar diferente, e o valor e deterministico, entao o
    mesmo quadro sempre gera o mesmo id.
  */
  const uid = `${preset.id}-${Math.round(baseX)}-${Math.round(baseY)}-${Math.round(spin)}`;

/*
  O CALIBRE DE CADA PONTA DO OSSO, em multiplos da espessura do preset.

  Ate aqui todo osso era uma `<line>` de espessura unica com ponta redonda, e
  era isso que fazia o boneco ler como montado com canudos: braco, perna e
  tronco com o mesmo diametro do ombro ate o punho, cotovelo aparecendo como
  BOLHA onde dois canudos se encontram, e o pescoco abrindo um ENTALHE entre
  a cabeca e os ombros.

  Membro que afina da raiz para a ponta e a diferenca entre um traco e um
  corpo. Os numeros seguem o que o olho espera de proporcao humana: o tronco
  e o mais grosso, a coxa vem depois, e punho e tornozelo sao os mais finos.

  O PESCOCO JA FOI GROSSO, e foi um erro que durou duas mudancas.

  Ele nasceu fino, a cabeca parecia colada, e a resposta foi engrossa-lo ate
  1,38. Funcionou enquanto o corpo era largo. Quando os membros afinaram de
  100 para 72, ninguem reviu este numero: o pescoco virou 99 unidades contra
  78 do tronco e 69 do ombro -- a parte MAIS GROSSA do corpo, que e o
  contrario de um corpo.

  O entalhe entre a cabeca e os ombros nao se fecha engrossando o pescoco;
  quem o fecha e o osso `neck -> head` ABRIR para baixo, do ombro para a
  cabeca (ver calibreDoOsso). Com isso o pescoco pode ser o que e: mais fino
  que o tronco.
*/
/*
  A CONICIDADE ACHATOU quando os corpos viraram vareta.

  Com membro de 72 a diferenca entre raiz e ponta dava volume a um corpo
  cheio. Com 40 ela faz outra coisa: 0,66 no antebraco viram 26 unidades
  contra 43 do tronco, e o braco afila ate quase sumir -- o boneco deixa de
  ler como traco e passa a ler como massa esculpida, que e o oposto do
  pedido.

  Boneco de vareta tem TRACO, e traco tem espessura constante. Aqui sobra so
  o suficiente para as juntas nao virarem bolhas e para o tronco nao ser tao
  fino quanto o pulso.
*/
const CALIBRE = {
  tronco: 1.06,
  // o pescoco continua sendo o mais fino: e ele que separa a cabeca dos
  // ombros (ver a nota em calibreDoOsso)
  pescoco: 0.6,
  ombro: 1.0,
  braco: 0.96,
  antebraco: 0.88,
  coxa: 1.02,
  canela: 0.92,
  mao: 1.0,
  pe: 1.06,
} as const;

/** calibre das duas pontas de um osso, da raiz para a extremidade */
const calibreDoOsso = (de: string, para: string): [number, number] => {
  /*
    O PESCOCO E MAIS FINO QUE O OMBRO, e abre so um pouco na base.

    Medido na pose de guarda: a coluna do pescoco tem 44 unidades de ALTURA
    (a cabeca fica 116 do pescoco e tem raio 72, entao sobram 44 entre a base
    dela e a junta). Desenhada com a largura do ombro, ela ficava com 69 de
    largura para 44 de altura -- mais larga do que alta. Um toco, e e isso
    que le como pescoco grosso.

    A abertura na base continua, porque e ela que evita o V concavo contra os
    ombros; so que agora e de 0,66 para 0,52 em vez de 0,96 para 1,38.
  */
  if (para === "head") return [0.78, CALIBRE.pescoco];
  if (de === "hip" && para === "neck") return [CALIBRE.tronco, CALIBRE.ombro];
  if (de === "neck") return [CALIBRE.ombro, CALIBRE.ombro];
  if (de.startsWith("shoulder")) return [CALIBRE.ombro, CALIBRE.braco];
  if (de.startsWith("elbow")) return [CALIBRE.braco, CALIBRE.antebraco];
  if (de === "hip") return [CALIBRE.tronco, CALIBRE.coxa];
  if (de.startsWith("knee")) return [CALIBRE.coxa, CALIBRE.canela];
  return [1, 1];
};

  /**
   * O ESQUELETO INTEIRO como uma forma so, numa cor so.
   *
   * Tudo que precisa da silhueta (o corpo, o contorno, as mascaras de luz e
   * de sombra) pede esta mesma funcao. Desenhar cada um por conta propria foi
   * o que produziu o defeito que esta correcao conserta.
   */
  const ossada = (cor: string, w: number) => {
    // a diferenca entre a espessura pedida e a do corpo: o contorno e as
    // mascaras pedem esta mesma forma engordada ou afinada por igual
    const d = w - largura;
    return (
      <g stroke={cor} fill={cor} strokeLinecap="round" strokeLinejoin="round">
        {ossos.map(([de, para]) => {
          const [kDe, kPara] = calibreDoOsso(de, para);
          const a = j[de];
          const b = j[para];
          const rA = Math.max(0.4, (largura * kDe + d) / 2);
          const rB = Math.max(0.4, (largura * kPara + d) / 2);
          const vx = b.x - a.x;
          const vy = b.y - a.y;
          const n = Math.hypot(vx, vy);
          if (n < 0.01) return null;
          // perpendicular unitaria: e por ela que a largura varia ao longo do osso
          const px = -vy / n;
          const py = vx / n;
          return (
            <g key={`${de}-${para}`}>
              <polygon
                points={
                  `${(a.x + px * rA).toFixed(1)},${(a.y + py * rA).toFixed(1)} ` +
                  `${(b.x + px * rB).toFixed(1)},${(b.y + py * rB).toFixed(1)} ` +
                  `${(b.x - px * rB).toFixed(1)},${(b.y - py * rB).toFixed(1)} ` +
                  `${(a.x - px * rA).toFixed(1)},${(a.y - py * rA).toFixed(1)}`
                }
                stroke="none"
              />
              {/* as juntas ficam redondas: sem elas o cotovelo vira um bico */}
              <circle cx={a.x} cy={a.y} r={rA} stroke="none" />
              <circle cx={b.x} cy={b.y} r={rB} stroke="none" />
            </g>
          );
        })}
        {/*
          MAOS E PES. Sao so quatro circulos, e mudam mais a leitura do que
          parece: um membro que termina num toco cortado nao tem ONDE acabar,
          e o olho le o braco como um tubo. Uma ponta arredondada um pouco
          maior que o pulso diz "aqui termina a pessoa".
        */}
        {(["handFront", "handBack"] as const).map((k) => (
          <circle key={k} cx={j[k].x} cy={j[k].y} r={Math.max(0.4, (largura * CALIBRE.mao + d) / 2)} stroke="none" />
        ))}
        {(["footFront", "footBack"] as const).map((k) => (
          <circle key={k} cx={j[k].x} cy={j[k].y} r={Math.max(0.4, (largura * CALIBRE.pe + d) / 2)} stroke="none" />
        ))}
        <circle cx={j.head.x} cy={j.head.y} r={raioCabeca + d / 2} stroke="none" />
      </g>
    );
  };

  /*
    DIRECAO DA LUZ. De cima e ligeiramente da frente -- e de onde vem a luz
    destes cenarios (ceu, neon alto, o poder do outro lutador). Deslocar a
    mascara nesse sentido deixa exposta a borda voltada PARA a luz, que e
    exatamente o canto que deveria acender.
  */
  const espessuraLuz = largura * 0.2;
  const espessuraSombra = largura * 0.3;
  const luzX = facing * 0.35;
  const corLuz = preset.tracos?.luzDeContorno ?? clarear(preset.stroke, 0.45);
  const corSombra = escurecer(preset.stroke, 0.72);

  /*
    ESTICA COM A VELOCIDADE.

    Ate aqui o corpo a 300 unidades por quadro era desenhado exatamente igual
    ao corpo parado. Isso e o que mais separa este motor de animacao de luta
    de verdade, e nenhuma quantidade de efeito em volta conserta: linhas de
    velocidade, rastro e brilho sao coisas ADICIONADAS ao lado do corpo, e o
    que falta e o CORPO responder.

    Em animacao 2D a forma se alonga na direcao em que viaja e encolhe na
    perpendicular. Nao e estilo: e como o olho integra um objeto que se move
    mais rapido do que o quadro consegue registrar.

    APLICADO NO DESENHO, NUNCA NO ESQUELETO. Os ossos mantem o comprimento
    (ver skeleton: membro que estica e encolhe le como borracha) e, mais
    importante, a distancia de combate e a cinematica inversa sao calibradas
    contra o esqueleto -- deformar ali tiraria todo golpe do alcance e
    reprovaria em scripts/contato.mts. Aqui e so a matriz de desenho.

    LIMIAR 14: o mesmo das linhas de velocidade. Abaixo disso o corpo esta
    andando, e andar nao deforma nada. A 60 unidades por quadro (acima do p99
    medido, que e 28) a deformacao chega ao teto de 22%.

    VOLUME QUASE PRESERVADO: o que estica em x encolhe em y, mas nao na mesma
    proporcao. Preservar volume exato deixa o corpo fino demais nos picos; a
    animacao classica tambem "cola" aqui.
  */
  const rapidez = Math.abs(velocidade);
  const k = Math.max(0, Math.min(1, (rapidez - 14) / 46));
  const esticaX = 1 + 0.22 * k;
  const esticaY = 1 - 0.14 * k;
  /*
    O CENTRO DA DEFORMACAO E O QUADRIL, e nao o meio do corpo: e onde a massa
    esta. Deformar em torno dos pes levantaria a cabeca do lugar, e em torno
    da cabeca arrancaria os pes do chao.
  */
  const pivo = j.hip;
  const deforma =
    k > 0.01
      ? `translate(${pivo.x.toFixed(1)} ${pivo.y.toFixed(1)}) ` +
        `scale(${esticaX.toFixed(3)} ${esticaY.toFixed(3)}) ` +
        `translate(${(-pivo.x).toFixed(1)} ${(-pivo.y).toFixed(1)})`
      : undefined;

  return (
    <g data-fighter={preset.id} opacity={opacity} transform={deforma}>
      <defs>
        {/*
          A LUZ E A SOMBRA COMO MASCARAS DA SILHUETA INTEIRA, e nao como uma
          faixa por osso.

          O que havia antes desenhava, para CADA osso, um fio claro na borda
          de cima e uma faixa escura na borda de baixo. Funciona num membro
          isolado; num corpo, todo osso que passa por dentro de outro carrega
          as suas duas faixas para dentro da silhueta, e o resultado foi
          descrito assim: "essas linhas de camadas de dentro do boneco".
          Estavam certas por osso e erradas por corpo.

          Uma mascara resolve na definicao: e a silhueta INTEIRA menos ela
          mesma deslocada. O que sobra e so a borda externa voltada para a
          luz. Osso que esta no meio do corpo nao tem borda externa, entao
          nao recebe nada -- que e o que a fisica diz.
        */}
        <mask id={`luz-${uid}`}>
          {ossada("#ffffff", largura)}
          <g transform={`translate(${(luzX * espessuraLuz).toFixed(2)} ${espessuraLuz.toFixed(2)})`}>
            {ossada("#000000", largura)}
          </g>
        </mask>
        <mask id={`sombra-${uid}`}>
          {ossada("#ffffff", largura)}
          <g transform={`translate(${(-luzX * espessuraSombra).toFixed(2)} ${(-espessuraSombra).toFixed(2)})`}>
            {ossada("#000000", largura)}
          </g>
        </mask>
      </defs>

      {/*
        CONTORNO. O mesmo esqueleto desenhado antes, mais grosso e quase preto.
        Resolve o problema que so aparece quando os dois se encostam: no quadro
        do golpe o corpo escuro passava por dentro do vermelho e os dois viravam
        uma mancha so. Com o contorno, cada silhueta tem borda propria.

        Vem por baixo de tudo, entao nao muda a cor de nenhum personagem: so
        aparece onde ha borda.
      */}
      {contorno && (
        <g data-part="contorno">{ossada(COR_DO_CONTORNO, largura + CONTORNO * 2)}</g>
      )}

      {/*
        O CORPO, NUMA COR SO.

        Antes o membro de tras era pintado 20% mais escuro E 14% mais fino,
        para dar profundidade. Duas consequencias, e as duas aparecem por
        dentro da silhueta quando um braco cruza o tronco:

          a mancha escura do proprio membro, que le como buraco no corpo;
          e uma faixa do CONTORNO em volta dele -- porque o contorno era
          desenhado na largura do membro da FRENTE enquanto o osso de tras
          saia mais fino, entao sobrava borda preta exposta dos dois lados.
          Essa segunda era defeito, nao escolha.

        Uma cor so, uma largura so: nada pode aparecer por dentro. A leitura
        de profundidade passa inteira para a luz e a sombra das bordas, que e
        onde ela pertence.
      */}
      <g data-part="corpo">{ossada(preset.stroke, largura)}</g>
      <g data-part="sombra" mask={`url(#sombra-${uid})`} opacity={0.85}>
        {ossada(corSombra, largura)}
      </g>
      <g data-part="luz" mask={`url(#luz-${uid})`} opacity={0.9}>
        {ossada(corLuz, largura)}
      </g>

      {preset.tracos?.roupa && (
        <Roupa
          roupa={preset.tracos.roupa}
          j={j}
          largura={largura}
          facing={facing}
        />
      )}

      {preset.tracos?.faixasMembros && preset.tracos.marcas && (
        <g data-part="faixas" stroke={preset.tracos.marcas} strokeLinecap="butt">
          {ossos.map(([de, para]) => {
            const noTronco = de === "neck" || de === "hip";
            if (noTronco && !preset.tracos?.marcasTronco) return null;
            const a = j[de];
            const b = j[para];
            const dx = b.x - a.x;
            const dy = b.y - a.y;
            const comp = Math.hypot(dx, dy) || 1;
            // perpendicular unitaria, escalada para a largura do membro
            const px = (-dy / comp) * largura * 0.46;
            const py = (dx / comp) * largura * 0.46;
            const atras =
              profundidade &&
              (ehDeFundo(de, deCostas) || ehDeFundo(para, deCostas));
            /*
             * Em pares, e nao soltas: duas faixas juntas leem como PADRAO
             * desenhado no corpo; faixas isoladas e igualmente espacadas leem
             * como risco de sujeira. A segunda de cada par e mais fina, o que
             * da direcao ao desenho.
             */
            const posicoes = preset.tracos?.faixasDuplas
              ? [
                  [0.3, 1],
                  [0.4, 0.6],
                  [0.66, 1],
                  [0.76, 0.6],
                ]
              : [
                  [0.38, 1],
                  [0.68, 1],
                ];
            // direcao unitaria ao longo do osso, para dar espessura a faixa
            const ax = dx / comp;
            const ay = dy / comp;
            return posicoes.map(([t, esp]) => {
              const cx = a.x + dx * t;
              const cy = a.y + dy * t;
              // o par afina em direcao a ponta do membro: marca que acompanha
              // o afinamento do corpo em vez de atravessar reto
              const k = 1 - t * 0.25;
              /*
                FAIXA COMO MASSA, nao como linha. Um <line> com espessura da
                banda de largura constante, que le como fita colada. Aqui a
                faixa e um poligono que nasce larga de um lado do membro e
                afina ate um bico do outro: e o bico que faz o olho ler tinta
                na pele em vez de adesivo.
              */
              const larg = largura * 0.19 * esp;
              const bico = larg * 0.22;
              const lado1 = { x: cx - px * k, y: cy - py * k };
              const lado2 = { x: cx + px * k, y: cy + py * k };
              return (
                <path
                  key={`${de}-${para}-${t}`}
                  d={
                    `M ${lado1.x - ax * larg} ${lado1.y - ay * larg} ` +
                    `L ${lado1.x + ax * larg} ${lado1.y + ay * larg} ` +
                    `Q ${cx + ax * larg * 0.7} ${cy + ay * larg * 0.7} ` +
                    `${lado2.x + ax * bico} ${lado2.y + ay * bico} ` +
                    `L ${lado2.x - ax * bico} ${lado2.y - ay * bico} ` +
                    `Q ${cx - ax * larg * 0.7} ${cy - ay * larg * 0.7} ` +
                    `${lado1.x - ax * larg} ${lado1.y - ay * larg} Z`
                  }
                  fill={preset.tracos?.marcas}
                  stroke="none"
                  opacity={atras ? 0.55 : 0.9}
                />
              );
            });
          })}
        </g>
      )}

      <circle
        data-part="head"
        cx={j.head.x}
        cy={j.head.y}
        r={raioCabeca}
        fill={preset.stroke}
      />

      {/*
        ROSTO E CABELO. So entram quando o preset pede, e somem de costas.
        A inclinacao vem do vetor pescoco->cabeca, entao o cabelo acompanha a
        cabeca chicoteando no golpe em vez de ficar grudado na vertical.
      */}
      {preset.tracos && !deCostas && (
        <Tracos
          tracos={preset.tracos}
          centro={j.head}
          raio={raioCabeca}
          anguloGraus={anguloDaCabeca(j.neck, j.head)}
          facing={facing}
          velocidade={velocidade}
          preset={preset}
        />
      )}
    </g>
  );
};

/** Inclinacao da cabeca em graus, a partir do osso do pescoco. */
const anguloDaCabeca = (neck: Vec2, head: Vec2): number =>
  (Math.atan2(head.x - neck.x, -(head.y - neck.y)) * 180) / Math.PI;

/**
 * ROUPA.
 *
 * A versao anterior desenhava pecas geometricas soltas por cima do esqueleto
 * -- um trapezio no tronco, um risco no meio como fecho -- e o resultado lia
 * como adesivo colado ao lado do corpo, nao como pano vestido nele.
 *
 * O que muda aqui: a roupa e desenhada como SILHUETA. Ombreiras que passam da
 * linha do ombro, casaco que alarga em cima e afunila na cintura, e fraldas
 * caindo do quadril. Silhueta e o que se le quando o personagem e pequeno na
 * tela ou passa rapido -- detalhe interno, nesse tamanho, vira sujeira.
 *
 * Tudo ancorado em juntas e derivado da pose, entao nada aqui precisa saber
 * qual golpe esta acontecendo.
 */
const Roupa: React.FC<{
  roupa: NonNullable<NonNullable<FighterPreset["tracos"]>["roupa"]>;
  j: Record<JointName, Vec2>;
  largura: number;
  facing: number;
}> = ({ roupa, j, largura, facing }) => {
  const dx = j.hip.x - j.neck.x;
  const dy = j.hip.y - j.neck.y;
  const comp = Math.hypot(dx, dy) || 1;
  const ux = dx / comp;
  const uy = dy / comp;
  // perpendicular ao tronco: e nela que a largura do pano se mede
  const px = -uy;
  const py = ux;
  /** ponto no eixo do tronco (t=0 pescoco, t=1 quadril) deslocado de lado */
  const pt = (t: number, lateral: number) => ({
    x: j.neck.x + dx * t + px * lateral,
    y: j.neck.y + dy * t + py * lateral,
  });
  const meia = largura * 0.72;

  return (
    <g data-part="roupa">
      {roupa.tronco && (
        <>
          {/*
            CASACO: largo no peito, estreito na cintura, e abrindo de novo
            embaixo. Sao tres larguras diferentes ao longo do mesmo eixo, e e
            essa variacao que da forma de corpo vestido -- largura constante
            daria um tubo.
          */}
          <path
            d={
              `M ${pt(0.0, -meia * 0.92).x} ${pt(0.0, -meia * 0.92).y} ` +
              `C ${pt(0.16, -meia * 1.16).x} ${pt(0.16, -meia * 1.16).y} ` +
              `${pt(0.52, -meia * 0.82).x} ${pt(0.52, -meia * 0.82).y} ` +
              `${pt(0.86, -meia * 0.74).x} ${pt(0.86, -meia * 0.74).y} ` +
              `L ${pt(1.04, -meia * 0.9).x} ${pt(1.04, -meia * 0.9).y} ` +
              `L ${pt(1.04, meia * 0.9).x} ${pt(1.04, meia * 0.9).y} ` +
              `L ${pt(0.86, meia * 0.74).x} ${pt(0.86, meia * 0.74).y} ` +
              `C ${pt(0.52, meia * 0.82).x} ${pt(0.52, meia * 0.82).y} ` +
              `${pt(0.16, meia * 1.16).x} ${pt(0.16, meia * 1.16).y} ` +
              `${pt(0.0, meia * 0.92).x} ${pt(0.0, meia * 0.92).y} Z`
            }
            fill={roupa.tronco}
          />
          {roupa.dobra && (
            /*
              DOBRA: sombra do proprio pano na metade de tras. Uma cor so no
              casaco o deixa chapado mesmo com o corpo sombreado por baixo.
            */
            <path
              d={
                `M ${pt(0.0, -facing * meia * 0.92).x} ${pt(0.0, -facing * meia * 0.92).y} ` +
                `C ${pt(0.16, -facing * meia * 1.16).x} ${pt(0.16, -facing * meia * 1.16).y} ` +
                `${pt(0.52, -facing * meia * 0.82).x} ${pt(0.52, -facing * meia * 0.82).y} ` +
                `${pt(0.86, -facing * meia * 0.74).x} ${pt(0.86, -facing * meia * 0.74).y} ` +
                `L ${pt(1.04, -facing * meia * 0.9).x} ${pt(1.04, -facing * meia * 0.9).y} ` +
                `L ${pt(1.02, -facing * meia * 0.2).x} ${pt(1.02, -facing * meia * 0.2).y} ` +
                `C ${pt(0.5, -facing * meia * 0.24).x} ${pt(0.5, -facing * meia * 0.24).y} ` +
                `${pt(0.2, -facing * meia * 0.4).x} ${pt(0.2, -facing * meia * 0.4).y} ` +
                `${pt(0.0, -facing * meia * 0.32).x} ${pt(0.0, -facing * meia * 0.32).y} Z`
              }
              fill={roupa.dobra}
            />
          )}
        </>
      )}

      {roupa.ombreiras &&
        (["Front", "Back"] as const).map((lado) => {
          const ombro = j[`shoulder${lado}`];
          const cotovelo = j[`elbow${lado}`];
          const vx = cotovelo.x - ombro.x;
          const vy = cotovelo.y - ombro.y;
          const n = Math.hypot(vx, vy) || 1;
          const ax = vx / n;
          const ay = vy / n;
          // perpendicular ao braco, para dar espessura a placa
          const qx = -ay;
          const qy = ax;
          const raio = largura * 0.82;
          const fundo = lado === "Back";
          return (
            <path
              key={lado}
              d={
                `M ${ombro.x - qx * raio * 0.78} ${ombro.y - qy * raio * 0.78} ` +
                `Q ${ombro.x + ax * raio * 0.5 - qx * raio * 0.5} ${ombro.y + ay * raio * 0.5 - qy * raio * 0.5} ` +
                `${ombro.x + ax * raio * 0.92} ${ombro.y + ay * raio * 0.92} ` +
                `Q ${ombro.x + ax * raio * 0.55 + qx * raio * 0.6} ${ombro.y + ay * raio * 0.55 + qy * raio * 0.6} ` +
                `${ombro.x + qx * raio * 0.82} ${ombro.y + qy * raio * 0.82} Z`
              }
              fill={roupa.ombreiras}
              opacity={fundo ? 0.72 : 1}
            />
          );
        })}

      {roupa.fraldas && (
        /*
          FRALDAS: duas abas caindo do quadril, uma mais longa que a outra.
          O comprimento desigual e proposital -- simetrico le como saia, e
          desigual le como pano que ficou para tras no movimento.
        */
        <g data-part="fraldas" fill={roupa.fraldas}>
          {[
            { lado: 1, alcance: 1.35, larg: 0.62 },
            { lado: -1, alcance: 1.05, larg: 0.5 },
          ].map(({ lado, alcance, larg }) => {
            const raiz = pt(0.98, lado * meia * 0.5);
            const ponta = {
              x: raiz.x + ux * largura * alcance - facing * lado * largura * 0.22,
              y: raiz.y + uy * largura * alcance,
            };
            return (
              <path
                key={lado}
                d={
                  `M ${raiz.x - px * meia * larg * 0.5} ${raiz.y - py * meia * larg * 0.5} ` +
                  `L ${raiz.x + px * meia * larg * 0.5} ${raiz.y + py * meia * larg * 0.5} ` +
                  `Q ${ponta.x + px * meia * larg * 0.3} ${ponta.y + py * meia * larg * 0.3} ` +
                  `${ponta.x} ${ponta.y} ` +
                  `Q ${ponta.x - px * meia * larg * 0.36} ${ponta.y - py * meia * larg * 0.36} ` +
                  `${raiz.x - px * meia * larg * 0.5} ${raiz.y - py * meia * larg * 0.5} Z`
                }
              />
            );
          })}
        </g>
      )}

      {roupa.faixa && (
        <g data-part="faixa" fill={roupa.faixa}>
          {/* a amarra em volta da cintura */}
          <path
            d={
              `M ${pt(0.82, -meia * 0.98).x} ${pt(0.82, -meia * 0.98).y} ` +
              `L ${pt(0.82, meia * 0.98).x} ${pt(0.82, meia * 0.98).y} ` +
              `L ${pt(0.98, meia * 0.88).x} ${pt(0.98, meia * 0.88).y} ` +
              `L ${pt(0.98, -meia * 0.88).x} ${pt(0.98, -meia * 0.88).y} Z`
            }
          />
          {/* a ponta solta, caindo de um lado so */}
          <path
            d={
              `M ${pt(0.92, facing * meia * 0.62).x} ${pt(0.92, facing * meia * 0.62).y} ` +
              `Q ${pt(1.3, facing * meia * 0.9).x} ${pt(1.3, facing * meia * 0.9).y} ` +
              `${pt(1.58, facing * meia * 0.52).x} ${pt(1.58, facing * meia * 0.52).y} ` +
              `L ${pt(1.5, facing * meia * 0.22).x} ${pt(1.5, facing * meia * 0.22).y} ` +
              `Q ${pt(1.22, facing * meia * 0.56).x} ${pt(1.22, facing * meia * 0.56).y} ` +
              `${pt(0.94, facing * meia * 0.3).x} ${pt(0.94, facing * meia * 0.3).y} Z`
            }
          />
        </g>
      )}
    </g>
  );
};

/**
 * Cabelo, olhos e marcas.
 *
 * Desenhado num grupo rotacionado junto da cabeca: assim cada peca e escrita
 * em coordenadas locais simples (raio 1 no centro) e a pose cuida do resto.
 */
const Tracos: React.FC<{
  tracos: NonNullable<FighterPreset["tracos"]>;
  centro: Vec2;
  raio: number;
  anguloGraus: number;
  facing: number;
  velocidade?: number;
  /** id do preset: entra nos ids de gradiente, que sao globais no documento */
  preset: { id: string };
}> = ({ tracos, centro, raio, anguloGraus, facing, velocidade = 0, preset }) => {
  const r = raio;
  /*
    ARRASTO DO CABELO. A massa nao acompanha a cabeca no mesmo quadro: ela
    fica para tras enquanto o corpo acelera e so depois alcanca. Aqui isso
    vira uma rotacao contraria ao movimento, com teto -- sem o teto, um
    arremesso rapido jogava o cabelo para tras do cranio e ele descolava.

    O sinal e invertido de proposito: indo para a direita, o cabelo pende
    para a esquerda.
  */
  const arrasto = Math.max(-26, Math.min(26, -velocidade * 1.1));
  // de perfil o rosto fica na metade da frente da cabeca
  const frente = facing >= 0 ? 1 : -1;
  return (
    <g
      data-part="tracos"
      transform={`translate(${centro.x} ${centro.y}) rotate(${anguloGraus})`}
    >
      {tracos.olhos && (
        /*
          Gradiente do olho: claro no alto e escuro embaixo, com o foco
          deslocado para cima. E a luz do cenario batendo numa superficie
          curva -- cor chapada nao tem como sugerir curvatura nenhuma.

          O id carrega o preset porque ids de gradiente sao globais no
          documento, e os dois lutadores desenham ao mesmo tempo.
        */
        <defs>
          <radialGradient id={`olho-${preset.id}`} cx="42%" cy="30%" r="72%">
            <stop offset="0%" stopColor={clarear(tracos.olhos, 0.55)} />
            <stop offset="55%" stopColor={tracos.olhos} />
            <stop offset="100%" stopColor={escurecer(tracos.olhos, 0.55)} />
          </radialGradient>
        </defs>
      )}
      {tracos.cabelo === "espetado" && (
        <g
          data-part="cabelo"
          fill={tracos.corCabelo ?? "#f2f4fb"}
          transform={`rotate(${arrasto.toFixed(2)})`}
        >
          {/*
            Espetos em leque a partir do topo. Sao poligonos e nao tracos
            porque o estilo do motor e silhueta cheia: contorno fino sumiria
            do lado do corpo, que e chapado.
          */}
          {[-70, -48, -26, -4, 20].map((graus, i) => {
            // alturas modestas e caindo para a frente: espeto alto demais le
            // como coroa, nao como cabelo. O pico fica atras do topo, entao a
            // massa cai para TRAS e o rosto fica livre.
            const alturas = [1.3, 1.34, 1.26, 1.16, 1.08];
            const h = r * alturas[i];
            const base = r * 0.42;
            // graus negativo = lado de tras da cabeca; multiplicar por `frente`
            // espelha o penteado junto com o personagem
            const rad = ((graus * frente - 90) * Math.PI) / 180;
            const px = Math.cos(rad);
            const py = Math.sin(rad);
            // perpendicular a direcao do espeto, para dar largura na base
            const qx = -py * base * 0.5;
            const qy = px * base * 0.5;
            return (
              <polygon
                key={graus}
                points={[
                  `${px * r * 0.55 + qx},${py * r * 0.55 + qy}`,
                  `${px * h},${py * h}`,
                  `${px * r * 0.55 - qx},${py * r * 0.55 - qy}`,
                ].join(" ")}
              />
            );
          })}
          {/*
            Calota: liga os espetos e cobre a emenda com o circulo da cabeca.
            Desce mais atras (frente * 0.35) do que na frente, que e o que
            deixa a testa a mostra em vez de virar capacete.
          */}
          <path
            d={
              `M ${-frente * r * 1.0} ${r * 0.35} ` +
              `A ${r} ${r} 0 0 ${frente > 0 ? 1 : 0} ${frente * r * 0.92} ${-r * 0.3} ` +
              `L ${frente * r * 0.5} ${-r * 0.5} ` +
              `L ${-frente * r * 0.9} ${-r * 0.2} Z`
            }
          />
        </g>
      )}

      {tracos.olhos && (
        <g data-part="olhos">
          {tracos.brilhoOlhos && (
            <ellipse
              cx={frente * r * 0.3}
              cy={-r * 0.04}
              rx={r * 0.72}
              ry={r * 0.38}
              fill={tracos.olhos}
              opacity={0.34}
              style={{ filter: `blur(${tracos.brilhoOlhos}px)` }}
            />
          )}
          {/*
            Dois olhos alongados na horizontal. De perfil o de tras aparece
            menor e mais perto da borda, que e o que o olho espera ver.
            Com olhosExtras, o par de baixo desce e um segundo par entra
            acima: quatro olhos no total.
          */}
          {/*
            PROFUNDIDADE NO OLHO. Tres camadas, na ordem em que o olho real
            as produz:

              1. o corpo do olho, com gradiente radial -- claro em cima e
                 escuro embaixo. Elipse de cor unica le como adesivo; o
                 degrade e o que faz a superficie parecer curva.
              2. a SOMBRA DA PALPEBRA, um arco escuro no topo. Nenhum olho e
                 igualmente iluminado em cima e embaixo, porque a palpebra e
                 a testa projetam sombra.
              3. o BRILHO ESPECULAR, um ponto claro deslocado para cima e
                 para a frente. E a peca mais barata e a que mais converte:
                 sem ele o olho e uma mancha, com ele e uma esfera molhada.

            O ponto de luz fica sempre no MESMO canto dos dois olhos -- luz
            vem de uma direcao so, e espelhar o brilho denunciaria o truque.
          */}
          {(tracos.olhosExtras ? [0.1, -0.34] : [-0.06]).map((dy, i) => {
            const grande = i !== 1;
            const rx = r * (grande ? 0.26 : 0.22);
            const ry = r * (grande ? 0.15 : 0.12);
            return (
              <g key={dy} opacity={i === 1 ? 0.92 : 1}>
                {[
                  { cx: frente * r * 0.52, k: 1, op: 1 },
                  { cx: frente * r * 0.04, k: 0.78, op: 0.85 },
                ].map(({ cx, k, op }) => (
                  <g key={cx} opacity={op}>
                    <ellipse
                      cx={cx}
                      cy={r * dy}
                      rx={rx * k}
                      ry={ry * k}
                      fill={`url(#olho-${preset.id})`}
                    />
                    {/* sombra da palpebra: arco escuro cobrindo o topo */}
                    <path
                      d={
                        `M ${cx - rx * k} ${r * dy} ` +
                        `A ${rx * k} ${ry * k} 0 0 1 ${cx + rx * k} ${r * dy} ` +
                        `A ${rx * k * 1.4} ${ry * k * 1.5} 0 0 0 ${cx - rx * k} ${r * dy} Z`
                      }
                      fill="#000"
                      opacity={0.28}
                    />
                    {/* brilho especular */}
                    <ellipse
                      cx={cx + frente * rx * k * 0.34}
                      cy={r * dy - ry * k * 0.42}
                      rx={rx * k * 0.28}
                      ry={ry * k * 0.34}
                      fill="#ffffff"
                      opacity={0.9}
                    />
                  </g>
                ))}
              </g>
            );
          })}
        </g>
      )}

      {tracos.gola && (
        // Colarinho alto: um trapezio que sobe do pescoco e abraca o queixo.
        // Vem depois dos olhos para cobrir a base da cabeca, que e onde a
        // gola encosta de verdade.
        <path
          data-part="gola"
          d={
            `M ${-r * 0.92} ${r * 1.02} L ${r * 0.92} ${r * 1.02} ` +
            `L ${r * 0.72} ${r * 0.3} L ${-r * 0.72} ${r * 0.3} Z`
          }
          fill={tracos.gola}
        />
      )}

      {tracos.marcas && (
        /*
          MARCAS DO ROSTO. Padrao proprio deste projeto.

          Tres regras fazem marca parecer tatuagem e nao risco de caneta:

          1. ACOMPANHAR A ANATOMIA. Faixa reta atravessando a cara le como
             adesivo. Arco sobre o olho e faixa que desce pela face leem como
             desenho feito NAQUELE rosto.
          2. ESPESSURA VARIAVEL. Traco de largura constante e vetor; traco que
             engrossa no meio e afina nas pontas e pincelada.
          3. ASSIMETRIA. Padrao espelhado perfeito le como estampa. Um lado
             com um elemento a mais quebra isso.

          Tudo em coordenadas locais da cabeca (raio 1 no centro), entao a
          rotacao da pose carrega o desenho junto.
        */
        <g data-part="marcas" fill={tracos.marcas}>
          {/*
            TESTA: massa larga com ponta descendo ao centro. A ponta e o que
            transforma faixa em marca -- linha de largura constante le como
            traco de caneta, massa que afina ate um bico le como tinta.
          */}
          <path
            d={
              `M ${-r * 0.62} ${-r * 0.52} ` +
              `C ${-r * 0.3} ${-r * 0.62} ${r * 0.3} ${-r * 0.62} ${r * 0.62} ${-r * 0.52} ` +
              `C ${r * 0.44} ${-r * 0.34} ${r * 0.2} ${-r * 0.36} ${r * 0.08} ${-r * 0.12} ` +
              `C ${r * 0.02} ${-r * 0.3} ${-r * 0.2} ${-r * 0.34} ${-r * 0.58} ${-r * 0.34} Z`
            }
          />
          {/*
            SOB O OLHO DA FRENTE: mancha cheia que sai do canto e afina para
            fora. Solida de proposito -- contorno vazado aqui sumiria contra o
            corpo, que tambem e chapado.
          */}
          <path
            d={
              `M ${frente * r * 0.16} ${r * 0.1} ` +
              `C ${frente * r * 0.42} ${r * 0.02} ${frente * r * 0.7} ${r * 0.06} ${frente * r * 0.9} ${r * 0.22} ` +
              `C ${frente * r * 0.62} ${r * 0.2} ${frente * r * 0.4} ${r * 0.3} ${frente * r * 0.22} ${r * 0.44} ` +
              `C ${frente * r * 0.22} ${r * 0.28} ${frente * r * 0.2} ${r * 0.18} ${frente * r * 0.16} ${r * 0.1} Z`
            }
          />
          {/*
            FACE: lingua de tinta descendo ate o queixo, larga em cima e
            terminando em bico. O bico aponta para baixo, o que alonga o rosto.
          */}
          <path
            d={
              `M ${frente * r * 0.3} ${r * 0.3} ` +
              `C ${frente * r * 0.56} ${r * 0.3} ${frente * r * 0.66} ${r * 0.46} ${frente * r * 0.58} ${r * 0.72} ` +
              `C ${frente * r * 0.5} ${r * 0.56} ${frente * r * 0.42} ${r * 0.52} ${frente * r * 0.26} ${r * 0.5} Z`
            }
          />
          {/*
            LADO DE TRAS: so uma lasca, e de um lado so. Padrao espelhado
            perfeito le como estampa; a assimetria e o que faz parecer feito a
            mao naquele rosto.
          */}
          <path
            d={
              `M ${-frente * r * 0.52} ${-r * 0.04} ` +
              `C ${-frente * r * 0.66} ${r * 0.14} ${-frente * r * 0.6} ${r * 0.34} ${-frente * r * 0.42} ${r * 0.46} ` +
              `C ${-frente * r * 0.44} ${r * 0.26} ${-frente * r * 0.44} ${r * 0.12} ${-frente * r * 0.38} ${-r * 0.02} Z`
            }
          />
        </g>
      )}
    </g>
  );
};

/**
 * Rastro do personagem: copias esmaecidas de poses anteriores.
 *
 * E o "afterimage" que o briefing pede. Fica aqui e nao em effects/ porque
 * depende do desenho do personagem, nao de uma camada de efeito.
 */
/**
 * SMEAR: o corpo vira um BORRAO CONTINUO no caminho que percorreu.
 *
 * Copiado da referencia de animacao stickman, e a diferenca com o que o motor
 * ja fazia e categorica. O rastro fantasma sao COPIAS SOLTAS do corpo, cada
 * uma reconhecivel como um boneco; o smear da referencia nao tem bonecos
 * dentro -- e uma forma unica, grossa, tracando a trajetoria. O personagem
 * deixa de ser desenhado e passa a ser o rastro dele.
 *
 * COMO: para cada osso, o quadrilatero que ele VARREU entre uma posicao e a
 * seguinte (as duas pontas de antes e as duas de agora). A uniao dessas
 * varreduras com as cabecas no caminho fecha a silhueta continua.
 *
 * A OPACIDADE FICA NO GRUPO, nunca em cada peca. Com opacidade por peca as
 * varreduras se sobrepoem e cada cruzamento fica mais escuro que o resto --
 * o borrao vira uma colagem de pedacos translucidos, que e exatamente o que
 * ele nao pode ser. No grupo, tudo achata numa forma so.
 */
/** o quadro anterior de um varrido */
const a0 = <T,>(todas: T[], i: number): T => todas[i - 1];

export const StickmanSmear: React.FC<{
  preset: FighterPreset;
  /** do mais antigo ao mais recente, incluindo a posicao atual no fim */
  quadros: {
    pose: Pose;
    baseX: number;
    baseY: number;
    spin?: number;
    giro?: number;
  }[];
  facing: 1 | -1;
  forca?: number;
}> = ({ preset, quadros, facing, forca = 0.5 }) => {
  if (quadros.length < 2) return null;
  const largura = preset.limbWidth * preset.scale;
  const raioCabeca = preset.headRadius * preset.scale;
  const juntasDe = (q: (typeof quadros)[number]) =>
    juntasNoMundo(q.pose, {
      baseX: q.baseX,
      baseY: q.baseY,
      facing,
      scale: preset.scale,
      spin: q.spin ?? 0,
      giro: (q.giro ?? 1) as 1 | -1,
    });
  const todas = quadros.map(juntasDe);
  /*
    O RASTRO DESVANECE E AFINA PARA TRAS, e sem isso ele nao e um rastro.

    A primeira versao punha UMA opacidade no grupo inteiro. Num deslocamento
    curto isso passa, mas num arremesso o corpo atravessa centenas de unidades
    e os varridos, todos igualmente opacos, se encostam e fecham uma LAJE
    solida atravessando o quadro -- medido num quadro do arremesso: um bloco
    chapado de ponta a ponta, com a silhueta do corpo perdida dentro dele.

    O que distingue borrao de mancha e ter direcao no tempo: forte onde o
    corpo esta agora, quase nada onde ele esteve. O peso desce com o cubo da
    idade para que a cauda suma rapido em vez de empapar o fundo, e a
    espessura acompanha, porque tinta que so clareia sem afinar continua
    lendo como chapa.

    A opacidade fica no <g> de cada varrido, e nunca nos ossos: dentro de um
    mesmo varrido os ossos se sobrepoem, e pintar peca a peca abriria as
    emendas de cada junta.
  */
  const n = todas.length - 1;
  return (
    <g data-layer="smear" fill={preset.stroke} stroke={preset.stroke}>
      {todas.map((j, i) => {
        if (i === 0) return null;
        // 1 no varrido que encosta no corpo, 0 no mais antigo
        const novidade = n <= 1 ? 1 : (i - 1) / (n - 1);
        const peso = 0.12 + 0.88 * novidade * novidade * novidade;
        const esp = largura * (0.45 + 0.55 * novidade);
        return (
          <g key={i} opacity={forca * peso}>
            {OSSOS.map(([de, para]) => (
              <polygon
                key={`${de}-${para}`}
                points={
                  `${a0(todas, i)[de].x.toFixed(1)},${a0(todas, i)[de].y.toFixed(1)} ` +
                  `${a0(todas, i)[para].x.toFixed(1)},${a0(todas, i)[para].y.toFixed(1)} ` +
                  `${j[para].x.toFixed(1)},${j[para].y.toFixed(1)} ` +
                  `${j[de].x.toFixed(1)},${j[de].y.toFixed(1)}`
                }
                strokeWidth={esp}
                strokeLinejoin="round"
              />
            ))}
            {/* a cabeca varre junto: sem ela o borrao fica sem topo */}
            <line
              x1={a0(todas, i).head.x}
              y1={a0(todas, i).head.y}
              x2={j.head.x}
              y2={j.head.y}
              strokeWidth={raioCabeca * (0.9 + 1.1 * novidade)}
              strokeLinecap="round"
            />
          </g>
        );
      })}
    </g>
  );
};

export const StickmanTrail: React.FC<{
  preset: FighterPreset;
  quadros: {
    pose: Pose;
    baseX: number;
    baseY: number;
    spin?: number;
    giro?: number;
  }[];
  facing: 1 | -1;
  /** opacidade do rastro mais forte; os demais decaem a partir dela */
  forca?: number;
}> = ({ preset, quadros, facing, forca = 0.22 }) => (
  <g data-layer="trail">
    {quadros.map((q, i) => (
      <Stickman
        key={i}
        preset={preset}
        pose={q.pose}
        baseX={q.baseX}
        baseY={q.baseY}
        facing={facing}
        spin={q.spin}
        giro={q.giro}
        opacity={(forca * (i + 1)) / quadros.length}
        profundidade={false}
      />
    ))}
  </g>
);
