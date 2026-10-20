/**
 * BONECOS 2D SOBRE CENARIO 3D.
 *
 * A decisao que esta composicao materializa: os lutadores continuam sendo o
 * Stickman em SVG e so o MUNDO vira tres dimensoes.
 *
 * Nao e uma concessao -- e a escolha melhor, por dois motivos concretos:
 *
 *   1. O traco 2D e a identidade do canal. Um boneco de palito com volume de
 *      cilindro vira outro produto.
 *   2. As 35 auditorias em scripts/ medem o rig de 13 juntas lendo
 *      `corpoNoQuadro`. Mantendo o corpo em 2D, `cadeia`, `pes`, `contato`,
 *      `arcos` e as outras continuam valendo exatamente como hoje. Trocar os
 *      corpos por malhas 3D jogaria fora o que segura a qualidade.
 *
 * O cenario 3D fica em Cenario3D.tsx, e a nota sobre como as duas cameras
 * sao casadas esta la -- e o unico ponto onde isso pode dar errado.
 *
 * A LUTA INTEIRA VEM DO FightScene, e nao de uma cena paralela.
 *
 * A primeira versao desta composicao desenhava os dois corpos aqui mesmo e
 * mais nada -- sem efeito, sem poder, sem katana, sem placa. Isso ia virar um
 * segundo renderizador de luta vivendo ao lado do primeiro, e os dois
 * divergiriam no primeiro efeito novo que alguem escrevesse so de um lado.
 *
 * Agora o FightScene e usado inteiro, em `semFundo`: ele deixa de pintar ceu
 * e chao e passa a desenhar sobre o que estiver atras. Tudo que o caminho 2D
 * ganhar daqui para frente aparece aqui de graca.
 */

import React, { useMemo } from "react";
import { AbsoluteFill, useCurrentFrame, useVideoConfig } from "remotion";
import { quadroEfetivo } from "../animation/sampler";
import { CAMERA_PADRAO, cameraNoQuadro } from "../camera/camera";
import { ALTURA_QUADRIL } from "../characters/skeleton";
import { Prototype } from "../compositions/Prototype";
import { compilar } from "../core/timeline";
import type { FightSpec } from "../core/types";
import { Cenario3D } from "./Cenario3D";

export const Arena3D: React.FC<{ spec: FightSpec }> = ({ spec }) => {
  const frameReal = useCurrentFrame();
  const { width, height } = useVideoConfig();

  // compila UMA vez, como todo o resto do motor: o compilador nao roda por
  // quadro, so o amostrador
  const timeline = useMemo(() => compilar(spec), [spec]);

  // o hitstop congela o quadro consultado sem mexer na timeline -- o mesmo
  // tratamento de FightScene, senao o cenario 3D continuaria andando
  // enquanto os corpos congelam no impacto
  const frame = quadroEfetivo(timeline, frameReal);

  /*
    A CAMERA E CALCULADA AQUI COM A MESMA CHAMADA QUE O FightScene FAZ.

    As duas camadas precisam da MESMA camera, e nao de duas parecidas. O
    FightScene a resolve internamente; aqui ela e recalculada com os mesmos
    argumentos para alimentar o cenario 3D. Mesma funcao pura, mesmo quadro,
    mesmos argumentos: mesmo resultado, por construcao.

    `quadroEfetivo` tambem e repetido pelo mesmo motivo -- durante o hit stop
    o quadro consultado congela, e sem isso o cenario 3D continuaria andando
    enquanto a luta para no impacto, que e exatamente o que o hit stop existe
    para evitar.
  */
  const cam = cameraNoQuadro(timeline, frame, CAMERA_PADRAO, {
    largura: width,
    alturaQuadril: -ALTURA_QUADRIL,
  });

  return (
    <AbsoluteFill>
      {/* camada de tras: o mundo, com camera de verdade */}
      <Cenario3D cam={cam} largura={width} altura={height} semente={spec.seed} />
      {/*
        camada da frente: a composicao INTEIRA, sem ceu nem chao proprios.

        E o `Prototype`, e nao o `FightScene`: o placar, os nomes e a marca
        d'agua sao do `Espetaculo`, que mora no Prototype. Compondo direto
        sobre o FightScene os tres sumiam, e isso so apareceu comparando este
        render com o render 2D do mesmo quadro.
      */}
      <AbsoluteFill>
        <Prototype spec={spec} semFundo />
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
