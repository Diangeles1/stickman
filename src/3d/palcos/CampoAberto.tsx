/**
 * PALCO "CAMPO ABERTO": dia claro, campo e linha de arvores.
 *
 * O terceiro palco, e o primeiro CLARO -- e e justamente por isso que ele
 * importa mais do que parece. Os dois anteriores sao escuros, e um fundo
 * escuro perdoa quase tudo: qualquer cor de corpo se recorta contra ele.
 *
 * AQUI O FUNDO COMPETE COM OS LUTADORES, e isso esta medido.
 *
 * Os presets de cor em characters/presets foram calibrados contra fundos
 * escuros (#0e1118, #101319). Contra ceu claro a conta inverte: com a mesma
 * formula de razao de contraste usada por scripts/contraste.mts, o laranja
 * #f2743a e o ciano #2fc8d6 ficam ABAIXO do minimo de 3.0 contra o ceu alto
 * e contra a nuvem branca. Quem segura a leitura e o contorno preto do
 * Stickman -- exatamente como ja estava anotado no palco do entardecer, so
 * que la o problema aparecia so na metade de cima do quadro e aqui aparece
 * no quadro inteiro.
 *
 * As decisoes de paleta abaixo saem disso, e nao de gosto:
 *
 *   - O ceu NAO vai ate o branco. O topo e um azul medio e o horizonte para
 *     num azul palido, nao em branco. Ceu estourado e o pior fundo possivel.
 *   - A linha de arvores e ESCURA. Ela ocupa a faixa de altura em que os
 *     corpos ficam, e e contra ela que a silhueta se recorta na maior parte
 *     do tempo -- e o unico lugar do palco onde a cor do corpo sozinha
 *     resolve.
 *   - As nuvens sao poucas e ficam ALTAS, longe da faixa da acao.
 */

import React, { useMemo } from "react";
import * as THREE from "three";
import { hashRng } from "../../core/rng";
import { Paredao3D } from "./Paredao3D";
import { FranjaDaFrente, texturaDoChao } from "./Terreno";
import {
  BandasDoHorizonte,
  CeuEmDegrade,
  rampaDeDegraus,
  type Banda,
  type ParadaDoCeu,
} from "./comum";

export const COR_DO_ALTO = "#3f7fc4";

const CEU: ParadaDoCeu[] = [
  [0, COR_DO_ALTO],
  [0.55, "#79b0dd"],
  // para num azul palido, e nao em branco: ver a nota no topo
  [1, "#bcd8ea"],
];

/**
 * Colinas ao fundo e a LINHA DE ARVORES na frente delas.
 *
 * Muitos picos baixos na banda mais proxima leem como copas; poucos e altos
 * nas de tras, como colina. E a mesma troca de frequencia que separa serra
 * de skyline em palcos/Telhados.
 */
const BANDAS: Banda[] = [
  { z: -21000, altura: 2600, cor: "#9fc0cf", largura: 72000, picos: 7 },
  { z: -16000, altura: 2900, cor: "#7ba390", largura: 56000, picos: 9 },
  { z: -11000, altura: 2400, cor: "#4e7a5e", largura: 40000, picos: 13 },
  /*
    A FAIXA QUE OS CORPOS CRUZAM: mais alta e mais perto do que o resto.

    Medido com a razao de contraste: contra o ceu os dois lutadores ficam
    em 1.45 e 2.05, bem abaixo do minimo de 3.0, enquanto contra esta
    faixa ficam em 3.42 e 4.83. Entao ela nao e enfeite de horizonte: e o
    FUNDO DE TRABALHO do palco, e precisa cobrir a altura em que os corpos
    estao.

    A 4200 de distancia a lente reduz tudo a 1400/5600 = um quarto, entao
    2400 de altura projetam como 600 -- que e a altura de um corpo. Era
    1700 a 6500, ou seja 425 projetados: os dois passavam a cabeca e o
    tronco inteiro acima dela, contra ceu puro.
  */
  { z: -4200, altura: 2400, cor: "#2c4a39", largura: 22000, picos: 24 },
];

/** Cumulo: massa branca de bordas duras, com uma base mais fria. */
const Cumulo: React.FC<{
  pos: [number, number, number];
  escala: number;
}> = ({ pos, escala }) => (
  <group position={pos} scale={escala}>
    {([
      [-900, -40, 700],
      [0, 150, 1000],
      [900, 10, 760],
      [1700, -60, 560],
    ] as const).map(([x, y, r], i) => (
      <mesh key={i} position={[x, y, 0]}>
        <circleGeometry args={[r, 30]} />
        <meshBasicMaterial color="#f4f7fb" fog={false} depthWrite={false} />
      </mesh>
    ))}
    {/* a base fria: nuvem sem sombra le como adesivo */}
    {([
      [-700, -420, 620],
      [500, -400, 820],
      [1500, -430, 500],
    ] as const).map(([x, y, r], i) => (
      <mesh key={`b${i}`} position={[x, y, -6]}>
        <circleGeometry args={[r, 26]} />
        <meshBasicMaterial color="#c3d4e4" fog={false} depthWrite={false} />
      </mesh>
    ))}
  </group>
);

const Cumulos: React.FC<{ semente: number }> = ({ semente }) => {
  const nuvens = useMemo(
    () =>
      Array.from({ length: 4 }, (_, i) => {
        const r = (k: string) => hashRng(`cumulo-${i}-${k}`, semente);
        return {
          pos: [
            (r("x") < 0.5 ? -1 : 1) * (12000 + r("x") * 20000),
            8500 + r("y") * 6000,
            -26000 + r("z") * 4000,
          ] as [number, number, number],
          escala: 1.3 + r("e") * 1.3,
        };
      }),
    [semente],
  );
  return (
    <>
      {nuvens.map((n, i) => (
        <Cumulo key={i} pos={n.pos} escala={n.escala} />
      ))}
    </>
  );
};

/**
 * As arvores que dao escala ao campo.
 *
 * Sem nenhum objeto de tamanho conhecido, uma planicie verde nao tem
 * tamanho. Ficam longe (z ~ -9000) pela mesma conta do caminho de torii:
 * perto demais nao cabem no quadro vertical.
 *
 * E sao TRES pelo mesmo motivo que os torii sao cinco: com uma so,
 * scripts/palco3d.mts reprovou em 16 das 22 amostras -- a camera persegue
 * os lutadores e o marco parado sai do quadro.
 */
const Arvore: React.FC<{ rampa: THREE.DataTexture; x: number; z: number }> = ({
  rampa,
  x,
  z,
}) => (
  <group position={[x, 0, z]} scale={2.2}>
    <mesh position={[0, 620, 0]} castShadow>
      <cylinderGeometry args={[55, 85, 1240, 9]} />
      <meshToonMaterial color="#4a3a2c" gradientMap={rampa} />
    </mesh>
    <mesh position={[0, 1600, 0]} castShadow>
      <sphereGeometry args={[720, 16, 12]} />
      <meshToonMaterial color="#335c3d" gradientMap={rampa} />
    </mesh>
    <mesh position={[420, 1300, 120]} castShadow>
      <sphereGeometry args={[430, 14, 10]} />
      <meshToonMaterial color="#2b4f34" gradientMap={rampa} />
    </mesh>
  </group>
);

export const CampoAberto: React.FC<{ semente: number; trincado?: number }> = ({
  semente,
  trincado = 0,
}) => {
  const rampa = useMemo(() => rampaDeDegraus([0.58, 0.82, 1]), []);

  return (
    <>
      {/*
        BRUMA CLARA E LONGE. De dia a atmosfera lava o que esta distante para
        a cor do CEU, nao para uma cor propria -- e por isso ela e quase a
        parada palida do degrade. Comeca longe porque de dia se enxerga mais.
      */}
      <fog attach="fog" args={["#b4d2e6", 6000, 22000]} />
      <CeuEmDegrade paradas={CEU} />
      <Cumulos semente={semente} />
      <BandasDoHorizonte semente={semente} bandas={BANDAS} />

      {/*
        SOL ALTO, SEM DISCO. Meio-dia nao tem sol no quadro: tem luz dura de
        cima e sombra curta. Desenhar o disco aqui so poria uma mancha branca
        competindo com os corpos, que e o problema que este palco ja tem.

        A rampa toon comeca em 0.58 (e nao 0.35 como a do entardecer) pelo
        mesmo motivo: de dia a sombra nao e escura, e sombra escura num palco
        claro cria justamente as manchas de valor medio que confundem a
        silhueta.
      */}
      <ambientLight intensity={1.5} color="#cfe3f2" />
      <hemisphereLight args={["#dff0ff", "#4c6246", 1.2]} />
      <directionalLight
        position={[2200, 7000, 3000]}
        intensity={2.6}
        color="#fffaf0"
        castShadow
        shadow-mapSize-width={2048}
        shadow-mapSize-height={2048}
        shadow-camera-left={-5000}
        shadow-camera-right={5000}
        shadow-camera-top={5000}
        shadow-camera-bottom={-5000}
        shadow-camera-near={10}
        shadow-camera-far={18000}
      />

      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[60000, 60000]} />
        {/*
          O VERDE DO CHAO E ESCURO POR MEDICAO, e nao por estilo.

          Era #5f8a4e, um verde de campo ensolarado. Contra ele o laranja
          dava 1.40 e o ciano 1.98 -- os dois abaixo do minimo de 3.0, e
          o chao e o que fica atras das PERNAS a luta inteira. Em #2e4d33
          sobem para 3.49 e 4.91.

          O que paga a conta e a rampa toon comecando alto (0.58): a parte
          iluminada nao fica mais clara que a cor base, entao escurecer a
          base escurece o chao inteiro de forma previsivel.
        */}
        <meshToonMaterial
          color="#2e4d33"
          gradientMap={rampa}
          map={texturaDoChao()}
        />
      </mesh>

      {[
        { x: 6200, z: -9000 },
        { x: -1800, z: -10200 },
        { x: -9500, z: -9000 },
      ].map((a, i) => (
        <Arvore key={i} rampa={rampa} x={a.x} z={a.z} />
      ))}
      <Paredao3D rampa={rampa} trincado={trincado} cor="#8a8577" />
      {/* capim verde-escuro: aqui ele tambem e o degrau de valor mais baixo */}
      <FranjaDaFrente semente={semente} cor="#24401f" />
    </>
  );
};
