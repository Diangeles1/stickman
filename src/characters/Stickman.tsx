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
  // 0.62 jogava o membro de tras para razao de contraste 1.8 contra o fundo:
  // ele sumia em vez de ficar atras. Sobre fundo quase preto, escurecer para
  // dar profundidade sempre custa legibilidade, entao aqui a cor cede e a
  // ESPESSURA assume parte do trabalho (ver larguraFundo).
  const corFundo = escurecer(preset.stroke, 0.8);
  // membro de tras tambem e mais FINO. Profundidade por duas vias (cor e
  // espessura) custa menos luminancia do que por uma so, e luminancia e
  // exatamente o que esta escasso contra este fundo.
  const larguraFundo = largura * 0.86;
  const raioCabeca = preset.headRadius * preset.scale * scaleExtra;

  return (
    <g data-fighter={preset.id} opacity={opacity}>
      {/*
        CONTORNO. O mesmo esqueleto desenhado antes, mais grosso e quase preto.
        Resolve o problema que so aparece quando os dois se encostam: no quadro
        do golpe o corpo escuro passava por dentro do vermelho e os dois viravam
        uma mancha so. Com o contorno, cada silhueta tem borda propria.

        Vem por baixo de tudo, entao nao muda a cor de nenhum personagem: so
        aparece onde ha borda.
      */}
      {contorno && (
      <g data-part="contorno" stroke={COR_DO_CONTORNO} fill={COR_DO_CONTORNO}>
        {ossos.map(([de, para]) => (
          <line
            key={`c-${de}-${para}`}
            x1={j[de].x}
            y1={j[de].y}
            x2={j[para].x}
            y2={j[para].y}
            strokeWidth={largura + CONTORNO * 2}
            strokeLinecap="round"
          />
        ))}
        <circle cx={j.head.x} cy={j.head.y} r={raioCabeca + CONTORNO} />
      </g>
      )}

      {ossos.map(([de, para]) => {
        // o osso e "de tras" quando qualquer ponta dele e de tras
        const atras =
          profundidade &&
          (ehDeFundo(de, deCostas) || ehDeFundo(para, deCostas));
        return (
          <line
            key={`${de}-${para}`}
            data-part={`${de}-${para}`}
            x1={j[de].x}
            y1={j[de].y}
            x2={j[para].x}
            y2={j[para].y}
            stroke={atras ? corFundo : preset.stroke}
            strokeWidth={atras ? larguraFundo : largura}
            strokeLinecap="round"
          />
        );
      })}

      {/*
        FAIXAS NOS MEMBROS. Travessoes perpendiculares ao osso, entao a pose
        os carrega sozinha: nao ha nada aqui que precise saber qual golpe esta
        acontecendo. Ficam por cima do corpo e por baixo da cabeca.
      */}
      {/*
        VOLUME. Segunda passada do esqueleto, mais escura e mais fina,
        deslocada para BAIXO do eixo de cada osso. O membro deixa de ser fita
        plana e passa a ler como cilindro com luz vindo de cima.

        Chapada de proposito, em dois tons: e assim que anime sombreia, e
        degrade num corpo de cor solida acusa o truque. Fica por cima do corpo
        e por baixo de roupa e marcas, que sao superficie e nao volume.
      */}
      {preset.tracos?.volume && (
        <g data-part="volume">
          {/*
            LUZ DE CONTORNO, quando o preset pede. Desenhada ANTES da sombra:
            ela e um fio na borda de CIMA, e a sombra que vem depois e mais
            larga nao a cobre, porque as duas moram em lados opostos do osso.

            O fio e fino de proposito. Luz de contorno larga vira um segundo
            corpo claro colado no primeiro; o que ela precisa fazer e marcar
            a borda, nao pintar o membro.
          */}
          {preset.tracos?.luzDeContorno &&
            ossos.map(([de, para]) => {
              const p1 = j[de];
              const p2 = j[para];
              const vx = p2.x - p1.x;
              const vy = p2.y - p1.y;
              const n = Math.hypot(vx, vy) || 1;
              const atras =
                profundidade &&
                (ehDeFundo(de, deCostas) || ehDeFundo(para, deCostas));
              // perpendicular para CIMA: o oposto da sombra
              let nx = -vy / n;
              let ny = vx / n;
              if (ny > 0) {
                nx = -nx;
                ny = -ny;
              }
              const lg = atras ? larguraFundo : largura;
              return (
                <line
                  key={`rim-${de}-${para}`}
                  x1={p1.x + nx * lg * 0.34}
                  y1={p1.y + ny * lg * 0.34}
                  x2={p2.x + nx * lg * 0.34}
                  y2={p2.y + ny * lg * 0.34}
                  stroke={preset.tracos?.luzDeContorno}
                  strokeWidth={lg * 0.2}
                  strokeLinecap="round"
                  // o membro de tras recebe menos luz: ele esta mais longe
                  opacity={atras ? 0.4 : 0.8}
                />
              );
            })}
          {ossos.map(([de, para]) => {
            const p1 = j[de];
            const p2 = j[para];
            const vx = p2.x - p1.x;
            const vy = p2.y - p1.y;
            const n = Math.hypot(vx, vy) || 1;
            const atras =
              profundidade &&
              (ehDeFundo(de, deCostas) || ehDeFundo(para, deCostas));
            const w = (atras ? larguraFundo : largura) * 0.42;
            // perpendicular apontando para baixo na tela: e de onde a sombra
            // vem, porque a luz do cenario esta sempre acima
            let nx = -vy / n;
            let ny = vx / n;
            if (ny < 0) {
              nx = -nx;
              ny = -ny;
            }
            const desloca = (atras ? larguraFundo : largura) * 0.28;
            return (
              <line
                key={`v-${de}-${para}`}
                x1={p1.x + nx * desloca}
                y1={p1.y + ny * desloca}
                x2={p2.x + nx * desloca}
                y2={p2.y + ny * desloca}
                stroke={escurecer(atras ? corFundo : preset.stroke, 0.74)}
                strokeWidth={w}
                strokeLinecap="round"
              />
            );
          })}
          {/*
            A cabeca ganha a mesma sombra: calota na base, recortada pelo
            circulo do cranio.

            Feita com clipPath e nao com dois arcos desenhados a mao -- a
            versao a mao produzia um bico nas pontas quando o raio do arco de
            volta nao batia com o do cranio, e o bico aparecia como uma aba
            saindo da cabeca.
          */}
          <clipPath id={`cr-${preset.id}`}>
            <circle cx={j.head.x} cy={j.head.y} r={raioCabeca} />
          </clipPath>
          <ellipse
            cx={j.head.x}
            cy={j.head.y + raioCabeca * 0.82}
            rx={raioCabeca * 1.1}
            ry={raioCabeca * 0.72}
            fill={escurecer(preset.stroke, 0.74)}
            clipPath={`url(#cr-${preset.id})`}
          />
        </g>
      )}

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
