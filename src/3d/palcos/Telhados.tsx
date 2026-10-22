/**
 * PALCO "TELHADOS": noite sobre a cidade.
 *
 * O segundo palco, e o primeiro a usar as pecas de `comum` em vez de ter as
 * suas proprias. O que muda em relacao ao entardecer nao e tecnica, e
 * REPERTORIO: ceu frio em vez de quente, lua em vez de sol, linha de predios
 * em vez de serra, e um parapeito que diz onde o telhado acaba.
 *
 * A LINHA DE PREDIOS PRECISOU DE GEOMETRIA PROPRIA, e eu apostei errado.
 *
 * A primeira versao reusava a serra com mais picos, na ideia de que a
 * FREQUENCIA separasse as duas leituras. O render desmentiu: trinta picos
 * pontudos sao trinta montanhas pequenas, nao uma cidade. O que faz predio e
 * topo CHATO e lateral VERTICAL. Dai `tipo: "predios"` em comum.
 *
 * AS JANELAS ACESAS SAO O QUE FAZ A CIDADE VIVER. Sem elas a banda mais
 * proxima e uma silhueta chapada, igual a serra: e a luz dispersa nela que
 * diz "tem gente ali". Elas sao uma geometria so, pelo mesmo motivo que o
 * capim e (ver palcos/Terreno): algumas centenas de retangulos minusculos
 * nao justificam algumas centenas de chamadas de desenho.
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

export const COR_DO_ALTO = "#070b22";

const CEU: ParadaDoCeu[] = [
  [0, COR_DO_ALTO],
  // o ceu de cidade nao fica preto perto do chao: a luz dela sobe e tinge
  [0.55, "#16214a"],
  [0.85, "#2d4170"],
  [1, "#4c6a94"],
];

const BANDAS: Banda[] = [
  { z: -21000, altura: 4200, cor: "#5d7093", largura: 72000, picos: 34, tipo: "predios" },
  { z: -16000, altura: 5200, cor: "#41527a", largura: 56000, picos: 26, tipo: "predios" },
  { z: -11000, altura: 4000, cor: "#2a3557", largura: 40000, picos: 19, tipo: "predios" },
  { z: -6500, altura: 2600, cor: "#161d36", largura: 26000, picos: 12, tipo: "predios" },
];

/** A lua: disco frio e alto, com halo discreto. */
const Lua: React.FC = () => (
  <group position={[2900, 6400, -24000]}>
    <mesh>
      <circleGeometry args={[1250, 48]} />
      <meshBasicMaterial color="#e8eeff" fog={false} depthWrite={false} />
    </mesh>
    <mesh position={[0, 0, -10]}>
      <circleGeometry args={[2400, 48]} />
      <meshBasicMaterial
        color="#9fb6e8"
        transparent
        opacity={0.3}
        fog={false}
        depthWrite={false}
      />
    </mesh>
  </group>
);

/**
 * Janelas acesas, espalhadas na faixa de altura das duas bandas do meio.
 *
 * Elas NAO consultam a silhueta das bandas: ficam numa faixa de altura
 * plausivel e algumas caem no ceu. A essa distancia, com a cor da bruma
 * lavando tudo, uma luz solta le como janela de um predio que esta atras de
 * outro -- e conferir a silhueta custaria reconstruir a geometria da banda
 * aqui so para apagar pontos que ninguem identifica como errados.
 */
const Janelas: React.FC<{ semente: number }> = ({ semente }) => {
  const geometria = useMemo(() => {
    const formas: THREE.Shape[] = [];
    for (let i = 0; i < 520; i++) {
      const r = (k: string) => hashRng(`janela-${i}-${k}`, semente);
      const x = (r("x") - 0.5) * 46000;
      const y = 260 + r("y") * 3400;
      const w = 70 + r("w") * 60;
      const h = 90 + r("h") * 70;
      const f = new THREE.Shape();
      f.moveTo(x, y);
      f.lineTo(x + w, y);
      f.lineTo(x + w, y + h);
      f.lineTo(x, y + h);
      f.closePath();
      formas.push(f);
    }
    return new THREE.ShapeGeometry(formas);
  }, [semente]);

  return (
    <mesh geometry={geometria} position={[0, 0, -13500]}>
      <meshBasicMaterial color="#ffd79a" transparent opacity={0.75} fog={false} />
    </mesh>
  );
};

/**
 * PARAPEITO E ANTENAS: o que diz que isto e um TELHADO e nao um terreno.
 *
 * Sem eles o chao de concreto a noite e indistinguivel de qualquer piso. O
 * parapeito fica longe o bastante para nunca cruzar a area da luta, e a
 * cidade aparece por cima dele -- que e exatamente a leitura que se quer.
 */
const Coberturas: React.FC<{ rampa: THREE.DataTexture; semente: number }> = ({
  rampa,
  semente,
}) => {
  const antenas = useMemo(
    () =>
      Array.from({ length: 7 }, (_, i) => {
        const r = (k: string) => hashRng(`antena-${i}-${k}`, semente);
        return {
          x: (r("x") - 0.5) * 9000,
          h: 900 + r("h") * 1500,
          z: -2300 - r("z") * 900,
        };
      }),
    [semente],
  );
  return (
    <>
      {/* o parapeito */}
      <mesh position={[0, 170, -3000]} castShadow receiveShadow>
        <boxGeometry args={[40000, 340, 220]} />
        <meshToonMaterial color="#2b3350" gradientMap={rampa} />
      </mesh>
      {/*
        TRES CAIXAS D'AGUA, e nao uma.

        Com uma so, scripts/palco3d.mts reprovou em 18 das 22 amostras: ela
        sumia do quadro na maior parte da luta. E a mesma licao do caminho
        de torii no entardecer -- a camera persegue os lutadores, que derivam
        milhares de unidades, e um marco parado a z = -2600 tem parallax
        forte (1400/4000 = 0.35) e some rapido. Telhado de cidade tem varias
        mesmo; repetir e mais fiel do que inventar um marco que acompanha a
        camera.
      */}
      {/*
        A FILEIRA PRECISA COBRIR A DERIVA INTEIRA, e nao so o comeco.

        Com tres caixas entre -5200 e 8200, scripts/palco3d.mts ainda
        reprovava em 6 amostras, todas no FIM da luta (quadros 1800 a 2700):
        os lutadores derivam para a esquerda e passam de -5200. Estendida
        ate -18000 ela acompanha. E a mesma medida que definiu a extensao do
        caminho de torii.
      */}
      {[
        { x: -18000, z: -2600 },
        { x: -11600, z: -3100 },
        { x: -5200, z: -2600 },
        { x: 1800, z: -3100 },
        { x: 8200, z: -2600 },
      ].map((c, i) => (
        <mesh key={i} position={[c.x, 700, c.z]} castShadow receiveShadow>
          <cylinderGeometry args={[520, 560, 1400, 14]} />
          <meshToonMaterial color="#232b45" gradientMap={rampa} />
        </mesh>
      ))}
      {antenas.map((a, i) => (
        <mesh key={i} position={[a.x, a.h / 2, a.z]} castShadow>
          <boxGeometry args={[36, a.h, 36]} />
          <meshToonMaterial color="#1b2238" gradientMap={rampa} />
        </mesh>
      ))}
    </>
  );
};

export const Telhados: React.FC<{ semente: number; trincado?: number }> = ({
  semente,
  trincado = 0,
}) => {
  const rampa = useMemo(() => rampaDeDegraus([0.4, 0.74, 1]), []);

  return (
    <>
      <fog attach="fog" args={["#24335c", 3000, 16000]} />
      <CeuEmDegrade paradas={CEU} />
      <Lua />
      <BandasDoHorizonte semente={semente} bandas={BANDAS} />
      <Janelas semente={semente} />

      {/*
        A LUA MANDA NA LUZ, e ela esta a DIREITA e alta (x 2900, y 6400).
        Luz de noite que vem de onde a lua nao esta e o mesmo erro que o sol
        no entardecer, e mais visivel ainda: a lua e pequena e o olho a usa
        de referencia.
      */}
      <ambientLight intensity={0.75} color="#6f86c4" />
      <hemisphereLight args={["#8ea6dd", "#10162c", 0.85]} />
      <directionalLight
        position={[2900, 2600, 2000]}
        intensity={1.5}
        color="#cfdcff"
        castShadow
        shadow-mapSize-width={2048}
        shadow-mapSize-height={2048}
        shadow-camera-left={-5000}
        shadow-camera-right={5000}
        shadow-camera-top={5000}
        shadow-camera-bottom={-5000}
        shadow-camera-near={10}
        shadow-camera-far={16000}
      />
      {/* contraluz fria da cidade, de baixo e de tras: o neon que sobe */}
      <directionalLight position={[-2000, 300, -3000]} intensity={0.7} color="#5f7fd0" />

      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[60000, 60000]} />
        <meshToonMaterial
          color="#39405e"
          gradientMap={rampa}
          map={texturaDoChao()}
        />
      </mesh>

      <Coberturas rampa={rampa} semente={semente} />
      <Paredao3D rampa={rampa} trincado={trincado} cor="#3a4164" />
      {/* a franja aqui e o proprio concreto escuro da beirada */}
      <FranjaDaFrente semente={semente} cor="#141a2e" />
    </>
  );
};
