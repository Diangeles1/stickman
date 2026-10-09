/**
 * O OBSTACULO: a massa contra a qual um corpo e arremessado, em QUALQUER palco.
 *
 * Ele existe porque a cena mais pesada do canal (`arremessoNoParedao`) so
 * podia acontecer no vale: a rocha era desenhada por backgrounds/Vale e a
 * tecnica importava a posicao dela de la. Como tres dos nove roteiros usam
 * essa cena, o vale levava um terco do calendario por dependencia de ARTE, e
 * nao por escolha de coreografia -- medido, 15 de 45 dias mesmo depois de
 * dois cenarios novos entrarem.
 *
 * A GEOMETRIA E A MESMA DO PAREDAO DO VALE, e isso e de proposito. Ela nao e
 * um desenho bonito que saiu por acaso: a massa tem que ser um degrau de
 * claridade acima do chao (rocha da cor do chao nao tem silhueta e o corpo
 * parece bater no nada), a face virada para a luta recebe o corpo, a quina
 * acesa diz onde a massa termina, e os veios param na metade da altura
 * porque veio que atravessa tudo faz a pedra ler como PALICADA de espigoes.
 * Tudo isso foi medido uma vez; reaproveitar a forma e reaproveitar a
 * medicao.
 *
 * O QUE MUDA POR PALCO E A PALETA. Cada cenario tem o seu degrau: no deserto
 * a massa e MAIS ESCURA que a areia clara, na neve e mais escura que a neve,
 * nos palcos noturnos e mais clara que o piso. A regra nao e "clarear", e
 * "afastar do fundo".
 */

import React from "react";
import type { FightSpec } from "../core/types";

/**
 * ONDE A MASSA FICA, em unidades de mundo.
 *
 * Longe da faixa em que as lutas acontecem: com -1450 ela caia bem no meio
 * do combate e, na versao espelhada por `trocarVencedor`, os corpos passavam
 * de 8s a 49s DENTRO dela -- uma laje atras dos dois achatando justamente a
 * profundidade que as cenas tentam mostrar. Quem vai ate ela e o arremesso,
 * que posiciona os dois em marcas relativas a esta coordenada.
 */
export const OBSTACULO_X = -2400;

type Paleta = {
  massa: string;
  face: string;
  gume: string;
  quina: string;
  veio: string;
};

/*
  AS PALETAS, uma por familia de cenario.

  O numero que importa em cada uma e a distancia entre `massa` e o fundo
  daquele palco (ver FUNDOS em scripts/elenco.mts, que lista o fundo medido
  de cada um). Os palcos escuros tem fundo perto de #101319 e massa em torno
  de #2d3345; o deserto tem areia #ebc99a e massa #9c6a44; a neve tem
  #d8e4f0 e massa #8fa6bd.
*/
const PALETAS: Record<string, Paleta> = {
  // o vale mantem exatamente as cores que a rocha dele sempre teve
  vale: { massa: "#332b44", face: "#493c5b", gume: "#5c4a5e", quina: "#6b5570", veio: "#2b2439" },
  // pedra fria para os tres palcos noturnos
  escuro: { massa: "#2d3345", face: "#3e4759", gume: "#4d586d", quina: "#5e6b85", veio: "#232838" },
  // rocha de deserto: ela e MAIS ESCURA que a areia, ao contrario das outras
  deserto: { massa: "#9c6a44", face: "#b07a50", gume: "#c28f61", quina: "#d4a273", veio: "#7d5435" },
  /*
    PEDRA ESCURA NA NEVE, e nao gelo claro.

    A primeira versao usava #8fa6bd pensando so no CHAO: contra a neve
    (#d8e4f0) ela tinha silhueta de sobra. Renderizado, a massa sumia -- o
    que fica ATRAS dela nao e o chao, sao as montanhas, que estao em #a2b6cd
    e #b9c9dc. Tres tons quase iguais empilhados.

    Contraste se mede contra o que esta atras, e nao contra o que esta
    embaixo. Esta paleta e a familia dos pinheiros (#3f5468), que e a unica
    forma escura do palco e por isso a unica que tem leitura garantida la.
  */
  neve: { massa: "#5d7389", face: "#6d849b", gume: "#7e95ad", quina: "#90a8bf", veio: "#4c6174" },
  /*
    NOS PALCOS DE TRACO a massa e clara e quem desenha a forma e o CONTORNO.
    Um bloco cinza chapado no meio do branco briga com a silhueta dos
    lutadores, que e a unica coisa que nao pode perder leitura; no rabisco
    ele ainda destoaria do desenho de caderno em volta.
  */
  traco: { massa: "#e4e0d8", face: "#d6d1c6", gume: "#efece6", quina: "#c4bdae", veio: "#cfc9bc" },
};

/** Qual paleta cada cenario usa. */
const paletaDe = (scenario: FightSpec["scenario"]): Paleta => {
  if (scenario === "vale") return PALETAS.vale;
  if (scenario === "deserto") return PALETAS.deserto;
  if (scenario === "neve") return PALETAS.neve;
  if (scenario === "arena" || scenario === "noite" || scenario === "metropole")
    return PALETAS.escuro;
  return PALETAS.traco;
};

/**
 * A massa que recebe o corpo arremessado.
 *
 * `trincado` vai de 0 a 1 e abre as fendas do impacto. Elas FICAM: massa que
 * racha e volta ao normal desfaz o golpe que a rachou.
 */
export const Obstaculo: React.FC<{
  trincado: number;
  scenario: FightSpec["scenario"];
}> = ({ trincado, scenario }) => {
  const t = Math.max(0, Math.min(1, trincado));
  const p = paletaDe(scenario);
  // so o palco de traco ganha contorno: ver a nota na paleta `traco`
  const contorno = p === PALETAS.traco ? "#2f3545" : undefined;
  return (
    <g data-layer="obstaculo" transform={`translate(${OBSTACULO_X} 0)`}>
      <path
        d="M -900 40 L -820 -1300 L -260 -1500 L -40 -900 L 0 40 Z"
        fill={p.massa}
        stroke={contorno}
        strokeWidth={contorno ? 10 : undefined}
      />
      {/* a face iluminada, virada para a luta: e nela que o corpo bate */}
      <path d="M -40 -900 L 0 40 L -190 40 L -250 -830 Z" fill={p.face} />
      {/* o gume do alto pega a luz rasante */}
      <path d="M -820 -1300 L -260 -1500 L -250 -1460 L -812 -1262 Z" fill={p.gume} />
      {/* a quina acesa: a linha vertical que diz onde a massa termina */}
      <path d="M 0 40 L -40 -900 L -12 -900 L 14 40 Z" fill={p.quina} />
      {/* veios: textura, nao estrutura -- param na metade da altura */}
      {[0, 1, 2].map((i) => (
        <path
          key={i}
          d={`M ${-700 + i * 230} 40 L ${-640 + i * 230} ${-340 - i * 120} L ${-612 + i * 230} ${-326 - i * 120} L ${-672 + i * 230} 40 Z`}
          fill={p.veio}
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
              stroke={contorno ?? "#0a0810"}
              strokeWidth={9 * t}
              strokeLinecap="round"
            />
          );
        })}
      {/* a cratera no ponto do impacto */}
      {t > 0.01 && (
        <ellipse
          cx={-150}
          cy={-430}
          rx={90 * t}
          ry={110 * t}
          fill={contorno ?? "#0a0810"}
          opacity={0.85}
        />
      )}
    </g>
  );
};
