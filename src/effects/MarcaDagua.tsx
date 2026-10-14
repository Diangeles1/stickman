/**
 * MARCA D'AGUA do canal (PALITANOS).
 *
 * Duas vagas, porque a tela muda ao longo do video, e CADA VAGA USA UMA ARTE
 * DIFERENTE pelo motivo mais simples: o fundo atras delas nao e o mesmo.
 *
 *   "placar"  abaixo do circulo do VS, entre as barras de vida. O cenario ali
 *             e CLARO, e o logo em letra branca sumia dentro dele: ficava um
 *             borrao cinza que ninguem lia. Entao aqui vai o SELO redondo, que
 *             traz o proprio disco escuro e por isso se le em qualquer fundo.
 *   "rodape"  embaixo, no centro, para quando o placar nao esta na tela (tela
 *             de escolha, abertura, placa final). O fundo ali e ESCURO e a
 *             faixa e larga, entao vai a LETRA, que ocupa melhor um espaco
 *             deitado e e maior de ler.
 *
 * Quem desenha decide a vaga e a opacidade; a troca entre as duas e um
 * cruzamento de opacidade, nunca um salto.
 */

import React from "react";
import { Img, staticFile } from "remotion";

type Arte = { arquivo: string; proporcao: number };

/** a letra recortada (900 x 333) */
const LETRA: Arte = { arquivo: "assets/marca/palitanos.png", proporcao: 333 / 900 };
/** o selo redondo, com disco escuro e borda acesa (1024 x 1024) */
const SELO: Arte = { arquivo: "assets/marca/palitanos-selo.png", proporcao: 1 };

const VAGAS = {
  // abaixo do VS e das barras, acima da cabeca dos lutadores
  placar: { arte: SELO, centroY: 436, largura: 124 },
  rodape: { arte: LETRA, centroY: 1700, largura: 400 },
} as const;

export const MarcaDagua: React.FC<{
  vaga: keyof typeof VAGAS;
  opacidade?: number;
  larguraTela: number;
}> = ({ vaga, opacidade = 1, larguraTela }) => {
  if (opacidade <= 0.01) return null;
  const v = VAGAS[vaga];
  const altura = v.largura * v.arte.proporcao;
  return (
    <Img
      src={staticFile(v.arte.arquivo)}
      style={{
        position: "absolute",
        left: larguraTela / 2 - v.largura / 2,
        top: v.centroY - altura / 2,
        width: v.largura,
        height: altura,
        opacity: opacidade * 0.92,
        // sombra leve: separa a marca do cenario sem virar um carimbo pesado
        filter: "drop-shadow(0 2px 3px rgba(0,0,0,0.35))",
        pointerEvents: "none",
      }}
    />
  );
};
