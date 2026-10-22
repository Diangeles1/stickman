/**
 * CENARIO 3D atras dos bonecos 2D.
 *
 * Os lutadores continuam sendo o Stickman em SVG -- a identidade do canal e,
 * mais importante, o rig de 13 juntas que as 35 auditorias medem. O que vira
 * tres dimensoes e o MUNDO: chao, estruturas, profundidade, sombra.
 *
 * E a montagem classica de 2D sobre 3D: personagem desenhado na frente,
 * cenario com camera de verdade atras. O que faz isso funcionar ou falhar e
 * uma coisa so -- as duas camadas precisam concordar sobre a camera. Se
 * discordarem, o chao desliza por baixo dos pes e a ilusao morre no primeiro
 * movimento lateral.
 *
 * COMO AS DUAS CAMERAS SAO CASADAS
 *
 * O lado 2D mapeia mundo em tela com `transformDaCamera`:
 *
 *     tela = centroDaTela + shake + zoom * (mundo - cam.center)
 *
 * ou seja, no plano z = 0, uma unidade de mundo vale exatamente `zoom`
 * pixels, e a altura de mundo visivel e `altura / zoom`.
 *
 * Do lado 3D, uma camera em perspectiva a distancia D do plano z = 0 enxerga
 * `2 * D * tan(fov/2)` de altura nesse plano. Igualando as duas:
 *
 *     fov = 2 * atan(altura / (2 * zoom * D))
 *
 * Falta escolher D -- e ele NAO e livre. O motor 2D ja finge perspectiva com
 * `escalaDaProfundidade(z) = 1400 / (1400 + z)`, que e exatamente a conta de
 * uma camera pinhole a 1400 unidades do plano. Usando o mesmo 1400 aqui, o
 * parallax do cenario 3D concorda com a profundidade que a coreografia ja
 * usa: a tecnica `cerco-em-profundidade` move os lutadores em z, e o fundo
 * responde na medida certa sem ninguem calibrar nada.
 *
 * O `shake` e deslocamento de TELA, entao ele vira deslocamento de camera
 * dividido pelo zoom, com o sinal invertido: a imagem indo para a direita e
 * a camera indo para a esquerda.
 *
 * E o y do mundo 2D cresce para BAIXO (convencao de SVG). Aqui ele e
 * invertido, como em rig3d.
 */

import { ThreeCanvas } from "@remotion/three";
import { useThree } from "@react-three/fiber";
import React, { useMemo } from "react";
import * as THREE from "three";
import { DISTANCIA_DA_CAMERA } from "../animation/corpo";
import type { EstadoCamera } from "../camera/camera";
import { hashRng } from "../core/rng";
import { COR_DO_ALTO as ALTO_DO_CAMPO, CampoAberto } from "./palcos/CampoAberto";
import { COR_DO_ALTO as ALTO_DO_ENTARDECER, Entardecer } from "./palcos/Entardecer";
import { COR_DO_ALTO as ALTO_DOS_TELHADOS, Telhados } from "./palcos/Telhados";

/**
 * A configuracao inicial e constante de MODULO, nao objeto inline.
 *
 * Inline ela e um objeto novo a cada quadro; o r3f compara por identidade,
 * conclui que a camera mudou e reaplica a configuracao DEPOIS do render,
 * desfazendo o que <CameraCasada> acabou de escrever. O sintoma e uma cena
 * que inicializa o WebGL, nao da erro nenhum e pinta so o fundo, porque a
 * camera voltou para (0, 0, 5) -- dentro do chao.
 */
export const CAMERA_INICIAL = { fov: 40, near: 10, far: 40000 } as const;

const grausDe = (rad: number) => (rad * 180) / Math.PI;

/** Escreve a camera que concorda com o SVG (ver a nota no topo). */
export const CameraCasada: React.FC<{
  cam: EstadoCamera;
  altura: number;
}> = ({ cam, altura }) => {
  const camera = useThree((s) => s.camera) as THREE.PerspectiveCamera;

  const D = DISTANCIA_DA_CAMERA;
  // o ponto de mundo que cai no centro da tela, com o shake ja descontado
  const alvoX = cam.center.x - cam.shake.x / cam.zoom;
  const alvoY2D = cam.center.y - cam.shake.y / cam.zoom;
  const alvoY = -alvoY2D;

  camera.position.set(alvoX, alvoY, D);
  camera.lookAt(alvoX, alvoY, 0);
  camera.fov = grausDe(2 * Math.atan(altura / (2 * cam.zoom * D)));
  camera.updateProjectionMatrix();
  return null;
};

/**
 * Blocos do palco. Profundidade de verdade: eles ficam ATRAS do plano dos
 * lutadores (z > 0) e o parallax sai da lente, nao de uma conta de camada.
 *
 * Gerados por semente para o mesmo palco sair igual em todo render -- o
 * Remotion desenha cada quadro isolado, entao qualquer Math.random aqui
 * tremeria o cenario inteiro a 60 Hz.
 */
const Blocos: React.FC<{ semente: number }> = ({ semente }) => {
  const blocos = useMemo(() => {
    const saida: {
      pos: [number, number, number];
      tam: [number, number, number];
      valor: number;
    }[] = [];
    for (let i = 0; i < 26; i++) {
      const r = (k: string) => hashRng(`bloco-${i}-${k}`, semente);
      /*
        PROFUNDIDADE E z NEGATIVO AQUI, e isso ja custou um render preto.

        No motor 2D, `escalaDaProfundidade(z) = 1400 / (1400 + z)`: z CRESCE
        para o fundo. Na cena, a camera fica em z = +1400 olhando para a
        origem, entao ela olha no sentido -z e "mais fundo" e z MENOR.
        Escrito com o sinal do motor, 20 dos 26 blocos nasciam atras da
        camera e a tela ficava vazia sem erro nenhum no console.

        A conversao entre os dois sentidos e esta linha, e e o unico lugar
        onde ela acontece.
      */
      const profundidade = 600 + r("z") * 5200;
      // quanto mais fundo, mais largo: senao o fundo vira uma fileira de
      // palitos, porque a lente encolhe tudo que esta longe
      const largura = 180 + r("l") * 420 + profundidade * 0.06;
      const alturaBloco = 300 + r("a") * 1500 + profundidade * 0.12;
      saida.push({
        pos: [(r("x") - 0.5) * 9000, alturaBloco / 2, -profundidade],
        tam: [largura, alturaBloco, largura * (0.6 + r("p") * 0.8)],
        // quem esta mais longe e mais CLARO, nao mais escuro: e assim que a
        // atmosfera funciona a noite numa cidade, e e o que separa um bloco
        // do outro. Com todos no mesmo valor o fundo virava uma mancha so.
        valor: 0.26 + (profundidade / 5800) * 0.5 + r("v") * 0.12,
      });
    }
    return saida;
  }, [semente]);

  return (
    <>
      {blocos.map((b, i) => (
        <mesh key={i} position={b.pos} castShadow receiveShadow>
          <boxGeometry args={b.tam} />
          <meshStandardMaterial
            color={new THREE.Color().setHSL(
              // azul-noite, com os distantes puxando para o roxo da bruma
              0.62 - b.valor * 0.05,
              0.3,
              b.valor * 0.34,
            )}
            roughness={0.9}
            metalness={0.05}
          />
        </mesh>
      ))}
    </>
  );
};

/**
 * O MUNDO, SEM A TELA EM QUE ELE E DESENHADO.
 *
 * Sai de dentro do <ThreeCanvas> porque o motor tem DOIS hospedeiros e so um
 * deles e o Remotion. O outro e a pagina de tempo real (src/3d/tempo-real),
 * que precisa exatamente deste conteudo dentro de um <Canvas> do r3f comum,
 * com laco proprio de requestAnimationFrame e camera de orbita.
 *
 * O corte e aqui, e nao mais fundo, por um motivo pratico: se a pagina de
 * depuracao montasse chao, luz e neblina por conta propria, ela estaria
 * depurando OUTRA cena. Qualquer bloco, luz ou cor que mudar aqui muda nos
 * dois hospedeiros no mesmo commit, por construcao.
 *
 * A CAMERA NAO ESTA AQUI DENTRO de proposito: ela e a unica coisa em que os
 * dois hospedeiros legitimamente divergem (um casa com o SVG, o outro orbita
 * livre), e misturar as duas coisas num componente so era o caminho curto
 * para a camera livre comecar a brigar com a camera casada.
 */
/**
 * Qual palco montar. Cada um e um arquivo em 3d/palcos.
 *
 * "entardecer" e o fundo de anime (ceu, serras em bandas, torii) e e o padrao;
 * "blocos" e o palco generico de cidade noturna que veio antes dele, mantido
 * porque e o unico que ja foi visto em movimento numa luta inteira.
 */
export type NomeDoPalco = "entardecer" | "telhados" | "campo" | "blocos";

export const MundoDoCenario3D: React.FC<{
  semente: number;
  palco?: NomeDoPalco;
  /** 0 a 1: quanto o paredao ja foi trincado pela cena */
  trincado?: number;
}> = ({ semente, palco = "entardecer", trincado = 0 }) => {
  if (palco === "entardecer")
    return <Entardecer semente={semente} trincado={trincado} />;
  if (palco === "telhados")
    return <Telhados semente={semente} trincado={trincado} />;
  if (palco === "campo")
    return <CampoAberto semente={semente} trincado={trincado} />;
  return <PalcoDeBlocos semente={semente} />;
};

const PalcoDeBlocos: React.FC<{ semente: number }> = ({ semente }) => (
  <>
    {/*
      A NEBLINA E MAIS CLARA QUE O CEU, de proposito. Igual ao fundo ela
      nao faz nada: o bloco distante escurece ate sumir e a profundidade
      vira preto. Mais clara, a distancia LAVA o bloco e e isso que o olho
      le como "longe". E e ela que da escala: sem ela o bloco a 5000
      unidades tem o mesmo preto do bloco a 600 e o fundo le como adesivo.
      Comeca depois do plano dos lutadores para nunca lavar a area onde a
      luta acontece.
    */}
    <fog attach="fog" args={["#263050", 2200, 12000]} />
    <ambientLight intensity={0.85} color="#8fa2c8" />
    <hemisphereLight args={["#9fb4e0", "#1b2130", 1.0]} />
    <directionalLight
      position={[1200, 3000, 2200]}
      intensity={2.4}
      castShadow
      shadow-mapSize-width={2048}
      shadow-mapSize-height={2048}
      shadow-camera-left={-4000}
      shadow-camera-right={4000}
      shadow-camera-top={4000}
      shadow-camera-bottom={-4000}
      shadow-camera-near={10}
      shadow-camera-far={14000}
    />
    {/*
      O CHAO PASSA PELO z = 0 e continua para tras. O plano dos lutadores e
      z = 0, entao o chao sob os pes deles e o mesmo chao que some no
      horizonte -- e dai que vem a profundidade que o cenario 2D desenhava
      a mao com faixas.
    */}
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]} receiveShadow>
      <planeGeometry args={[40000, 40000]} />
      {/*
        O chao precisa de valor SUFICIENTE para a sombra projetada
        aparecer: sombra e subtracao, e nao da para subtrair de preto. Era
        #12192a e o chao e as sombras liam igual.
      */}
      <meshStandardMaterial color="#2a3550" roughness={0.95} />
    </mesh>
    {/*
      LUZ DE CONTORNO vinda de tras, baixa e fria. Ela separa a silhueta
      dos blocos da bruma -- sem ela, bloco escuro contra bruma clara vira
      recorte chapado de papel.
    */}
    <directionalLight
      position={[-1800, 900, -3000]}
      intensity={1.1}
      color="#7f9fe0"
    />
    <Blocos semente={semente} />
  </>
);

/**
 * A cor de fundo do canvas, por palco.
 *
 * So aparece onde nenhuma geometria cobre, entao e uma rede de seguranca e
 * nao o ceu: o "entardecer" pinta o proprio ceu numa chapa, e se esta cor
 * discordasse dela, uma borda da cor errada apareceria no zoom mais aberto.
 */
const ALTO_POR_PALCO: Record<NomeDoPalco, string> = {
  entardecer: ALTO_DO_ENTARDECER,
  telhados: ALTO_DOS_TELHADOS,
  campo: ALTO_DO_CAMPO,
  blocos: "#10172e",
};

export const corDoFundo = (palco: NomeDoPalco = "entardecer"): string =>
  ALTO_POR_PALCO[palco];

export const Cenario3D: React.FC<{
  cam: EstadoCamera;
  largura: number;
  altura: number;
  semente: number;
  palco?: NomeDoPalco;
  trincado?: number;
}> = ({ cam, largura, altura, semente, palco = "entardecer", trincado = 0 }) => {
  return (
    <ThreeCanvas
      width={largura}
      height={altura}
      shadows
      style={{ backgroundColor: corDoFundo(palco) }}
      camera={CAMERA_INICIAL}
    >
      <CameraCasada cam={cam} altura={altura} />
      <MundoDoCenario3D semente={semente} palco={palco} trincado={trincado} />
    </ThreeCanvas>
  );
};
