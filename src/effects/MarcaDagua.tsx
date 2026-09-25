/**
 * MARCA D'AGUA do canal (PALITANOS).
 *
 * Duas vagas, porque a tela muda ao longo do video:
 *
 *   "placar"  logo abaixo do circulo do VS, entre as barras de vida: e onde
 *             jogo de luta poe o logo, e nao disputa espaco com a acao
 *   "rodape"  embaixo, no centro, para quando o placar nao esta na tela
 *             (tela de escolha, abertura, placa final)
 *
 * Quem desenha decide a vaga e a opacidade; a troca entre as duas e um
 * cruzamento de opacidade, nunca um salto.
 */

import React from "react";
import { Img, staticFile } from "remotion";

const ARQUIVO = "assets/marca/palitanos.png";
/** proporcao do arquivo (900 x 333) */
const PROPORCAO = 333 / 900;

const VAGAS = {
  placar: { centroY: 352, largura: 270 },
  rodape: { centroY: 1700, largura: 400 },
} as const;

export const MarcaDagua: React.FC<{
  vaga: keyof typeof VAGAS;
  opacidade?: number;
  larguraTela: number;
}> = ({ vaga, opacidade = 1, larguraTela }) => {
  if (opacidade <= 0.01) return null;
  const v = VAGAS[vaga];
  const altura = v.largura * PROPORCAO;
  return (
    <Img
      src={staticFile(ARQUIVO)}
      style={{
        position: "absolute",
        left: larguraTela / 2 - v.largura / 2,
        top: v.centroY - altura / 2,
        width: v.largura,
        height: altura,
        opacity: opacidade * 0.92,
        // sombra leve: o logo branco continua legivel sobre o fundo branco
        filter: "drop-shadow(0 2px 3px rgba(0,0,0,0.35))",
        pointerEvents: "none",
      }}
    />
  );
};
