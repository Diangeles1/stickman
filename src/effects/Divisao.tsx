/**
 * CORPO DIVIDIDO AO MEIO.
 *
 * O golpe que encerra a luta: o corte atravessa e o corpo se separa em duas
 * metades que escorregam e caem.
 *
 * COMO, e por que assim: as duas metades sao O MESMO corpo desenhado duas
 * vezes, cada copia recortada por um lado do plano de corte. Nao ha esqueleto
 * novo, nao ha pose de "cortado ao meio", e nenhuma parte do motor precisa
 * saber que isto existe -- o corpo que ja estava sendo desenhado continua
 * sendo desenhado, e o recorte e a unica coisa nova.
 *
 * A alternativa seria modelar metades de verdade, com juntas proprias. Custa
 * um segundo esqueleto e um segundo conjunto de poses para aparecer uma vez
 * na luta inteira.
 *
 * ORDEM DOS GRUPOS. A mascara fica DENTRO do grupo que desloca, e nao fora:
 * assim ela e resolvida no espaco ja deslocado e acompanha a metade. Com ela
 * por fora, o plano de corte ficaria parado no mundo e as metades entrariam e
 * sairiam dele enquanto se afastam.
 */

import React from "react";
import type { Vec2 } from "../core/types";

const clamp01 = (v: number) => Math.max(0, Math.min(1, v));
/** desacelera: as metades saem rapido e vao parando */
const saiRapido = (t: number) => 1 - (1 - clamp01(t)) ** 3;

export type DivisaoProps = {
  /** identificador unico: os recortes vivem em ids globais do documento */
  id: string;
  /** ponto por onde o corte passa, em mundo */
  corte: Vec2;
  /** angulo do corte em graus (0 = horizontal) */
  angulo: number;
  /** 0 no instante do corte, 1 quando as metades ja pousaram */
  progresso: number;
  /** quanto as metades se afastam, em unidades de mundo */
  afastamento?: number;
  /**
   * Meio-comprimento da faixa do corte, medido do ponto do corte para cada
   * lado ao longo do plano. Quem chama calcula isso projetando as juntas do
   * corpo na direcao do corte -- ver scenes/FightScene.
   */
  extensao?: number;
  /** o corpo, desenhado uma vez por metade */
  desenhar: () => React.ReactNode;
  /**
   * O MESMO corpo como forma chapada branca, para servir de mascara da faixa
   * do corte.
   *
   * Tem que vir de fora e tem que ser SIMPLES: o desenho normal do corpo usa
   * mascaras por dentro (a luz e a sombra de borda, em characters/Stickman) e
   * mascara aninhada dentro de mascara nao resolve -- volta opaca, e a faixa
   * aparece por cima do cenario como se nao houvesse mascara nenhuma.
   */
  silhueta: () => React.ReactNode;
};

export const CorpoDividido: React.FC<DivisaoProps> = ({
  id,
  corte,
  angulo,
  progresso,
  afastamento = 130,
  extensao = 260,
  desenhar,
  silhueta,
}) => {
  const t = clamp01(progresso);
  const L = 5000;
  const uid = `div-${id}`;
  /** regiao das mascaras, em coordenadas de mundo (ver o comentario abaixo) */
  const regiao = {
    maskUnits: "userSpaceOnUse" as const,
    x: -L * 2,
    y: -L * 2,
    width: L * 4,
    height: L * 4,
  };

  const rad = (angulo * Math.PI) / 180;
  // ao longo do plano do corte
  const ux = Math.cos(rad);
  const uy = Math.sin(rad);
  // perpendicular ao plano: e nela que as metades se AFASTAM uma da outra
  const nx = -uy;
  const ny = ux;

  /*
    AS DUAS METADES TOMBAM. Nao deslizam: TOMBAM.

    A versao anterior afastava as metades e somava uma queda vertical grande,
    girando 15 graus em torno do ponto do corte. O resultado foi descrito
    assim: "o azul morre e fica em pe morto?". Estava certo -- as duas ficavam
    verticais lado a lado e afundavam no chao, o que le como recorte
    deslizando, nao como corpo caindo.

    O que faltava era o PIVO. Um corpo cortado nao desce: ele perde o
    equilibrio e gira em torno do proprio pe. Com o pivo no CHAO, embaixo de
    cada metade, a mesma rotacao que antes nao dizia nada agora deita a peca
    inteira -- e e a rotacao, nao a translacao, que conta a queda.

    O tombo usa t ao quadrado porque queda acelera; o afastamento usa
    saiRapido porque o empurrao do corte acontece todo no comeco e vai
    morrendo. Separar as duas curvas e o que faz as metades se afastarem
    primeiro e so depois desabarem.
  */
  const tomba = t * t;
  const sep = saiRapido(t) * afastamento * 0.55;
  const desliza = saiRapido(t) * afastamento * 0.3;

  const cima = {
    dx: -nx * sep + ux * desliza,
    dy: -ny * sep + uy * desliza,
    giro: tomba * 84,
    pivo: { x: corte.x + afastamento * 0.3, y: 0 },
  };
  const baixo = {
    dx: nx * sep * 0.8,
    dy: ny * sep * 0.8,
    giro: -tomba * 71,
    pivo: { x: corte.x - afastamento * 0.3, y: 0 },
  };

  /**
   * MEIO-PLANO COMO POLIGONO, com os quatro cantos calculados aqui.
   *
   * A versao anterior era um retangulo gigante com `transform="rotate(...)"`
   * dentro da mascara, e a rotacao nao era aplicada: o corte saia horizontal
   * em vez de diagonal, e o corpo se partia na cintura em vez de ao meio.
   *
   * Aqui nao ha transform nenhum para ser ignorado -- os cantos ja nascem no
   * lugar. Um poligono de quatro pontos nao tem como ser interpretado de duas
   * formas, e numa peca que aparece uma vez na luta inteira nao vale depender
   * de comportamento que precise ser conferido no navegador.
   */
  const meioPlano = (sinal: number) => {
    const a1 = { x: corte.x - ux * L, y: corte.y - uy * L };
    const a2 = { x: corte.x + ux * L, y: corte.y + uy * L };
    const pontos = [
      a1,
      a2,
      { x: a2.x + sinal * nx * L, y: a2.y + sinal * ny * L },
      { x: a1.x + sinal * nx * L, y: a1.y + sinal * ny * L },
    ];
    return (
      <polygon
        points={pontos.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" ")}
        fill="#ffffff"
      />
    );
  };

  const metade = (chave: string, acima: boolean, m: typeof cima) => (
    <g
      key={chave}
      transform={
        `translate(${m.dx.toFixed(1)} ${m.dy.toFixed(1)}) ` +
        `rotate(${m.giro.toFixed(2)} ${m.pivo.x.toFixed(1)} ${m.pivo.y.toFixed(1)})`
      }
    >
      <g mask={`url(#${uid}-${acima ? "a" : "b"})`}>
        {desenhar()}
        {/*
          A SUPERFICIE DO CORTE, do tamanho exato do corpo.

          Duas tentativas antes desta, e as duas falharam por motivos que vale
          registrar:

          1. Linha de cinco mil unidades recortada so pelo meio-plano. Mas o
             meio-plano separa uma metade da outra e nao sabe onde o corpo
             esta: a linha vermelha atravessava a tela inteira.
          2. A mesma linha, mascarada pelo proprio corpo. Nao funcionou porque
             o corpo JA USA mascaras por dentro (a luz e a sombra de borda em
             characters/Stickman), e mascara aninhada dentro de mascara nao
             resolve -- o resultado volta opaco e a linha aparece inteira de
             novo.

          A saida foi nao precisar de mascara nenhuma: quem chama projeta as
          juntas do corpo na direcao do corte e diz ate onde ele vai
          (`extensao`). A faixa nasce do tamanho certo.
        */}
        <g mask={`url(#${uid}-silhueta)`}>
          <line
            x1={corte.x - ux * extensao}
            y1={corte.y - uy * extensao}
            x2={corte.x + ux * extensao}
            y2={corte.y + uy * extensao}
            stroke="#7a0a10"
            strokeWidth={19}
          />
          <line
            x1={corte.x - ux * extensao}
            y1={corte.y - uy * extensao}
            x2={corte.x + ux * extensao}
            y2={corte.y + uy * extensao}
            stroke="#d4141f"
            strokeWidth={8}
          />
        </g>
      </g>
    </g>
  );

  return (
    <g data-part="corpo-dividido">
      <defs>
        {/*
          A REGIAO DA MASCARA PRECISA SER DECLARADA.

          Sem x/y/width/height, uma mascara usa o padrao do SVG: 120% do
          viewport. Aqui o desenho acontece dentro da transformacao da camera,
          entao esse padrao vira um retangulo em coordenadas de MUNDO que
          comeca perto de y = -192 -- mais ou menos a altura do quadril. Tudo
          acima disso era descartado.

          O efeito na tela foi um corte horizontal na cintura com a metade de
          cima sumindo por inteiro, e passei um bom tempo procurando o defeito
          na geometria do corte, que estava certa. Quem cortava era a borda da
          mascara.

          `regiao` cobre a arena inteira com folga, entao nada alem do proprio
          meio-plano decide o que fica.
        */}
        <mask id={`${uid}-a`} {...regiao}>
          {meioPlano(-1)}
        </mask>
        <mask id={`${uid}-b`} {...regiao}>
          {meioPlano(1)}
        </mask>
        {/* a forma chapada do corpo: prende a faixa do corte ao corpo */}
        <mask id={`${uid}-silhueta`} {...regiao}>
          {silhueta()}
        </mask>
      </defs>
      {metade("baixo", false, baixo)}
      {metade("cima", true, cima)}
    </g>
  );
};
