/**
 * PALCO "ENTARDECER": fundo de anime, em tres dimensoes de verdade.
 *
 * O vocabulario do genero e convencao, nao desenho de ninguem: ceu ocupando
 * metade do quadro, serras em bandas que clareiam com a distancia, nuvens de
 * borda dura, sol baixo, silhueta quase preta na frente. Tudo aqui e
 * construido do zero com esse vocabulario -- nenhuma arte de obra alguma foi
 * reproduzida.
 *
 * A DECISAO QUE MANDA NESTE ARQUIVO E O SOMBREAMENTO CHAPADO.
 *
 * O palco anterior (Blocos) usa meshStandardMaterial, que e sombreamento
 * continuo: cada face tem um degrade suave. Isso briga com o lutador, que e
 * SVG chapado com contorno preto -- o olho le duas tecnicas na mesma imagem e
 * o boneco parece colado por cima. Aqui:
 *
 *   - ceu, serras e nuvens sao meshBasicMaterial, ou seja NAO recebem luz
 *     nenhuma. Sao chapas de cor, como camadas de fundo pintado. E tambem por
 *     isso elas ignoram a neblina (`fog={false}`): bruma por cima de uma banda
 *     que ja representa distancia lavaria duas vezes.
 *
 *   - o chao e o torii usam meshToonMaterial com uma rampa de TRES degraus.
 *     Eles precisam responder ao sol -- e deles que sai a leitura de volume --
 *     mas em bandas duras, nao em degrade.
 *
 * ESTE PALCO DEPENDE DO CONTORNO PRETO DO STICKMAN. Medido, e precisa
 * estar escrito aqui.
 *
 * scripts/contraste.mts compara cada cor com o fundo DOMINANTE da imagem, e
 * por esse criterio o palco passa folgado (laranja 3.99 a 5.80, ciano 5.64 a
 * 8.19, contra um minimo de 3.0). Mas o fundo dominante e o chao escuro --
 * e nao e contra o chao que a silhueta de um lutador se recorta na metade de
 * cima do quadro.
 *
 * Contra o que ele de fato cruza, com a mesma formula de razao:
 *
 *                       laranja  ciano
 *   sol (disco)            2.53   1.79
 *   halo do sol            1.78   1.26
 *   ceu no horizonte       1.36   1.04
 *   serra distante         1.39   1.02
 *   chao                   3.16   4.47
 *   franja                 5.61   7.92
 *
 * Ou seja: da linha do horizonte para cima, a COR DO CORPO sozinha nao
 * alcanca o minimo. Quem separa ali e o contorno preto (ver `contorno` em
 * characters/Stickman), e os presets em characters/presets foram calibrados
 * contra fundos escuros, onde a cor bastava.
 *
 * DUAS CONSEQUENCIAS PRATICAS:
 *
 *   - O quadro de impacto anime desenha os corpos com `contorno={false}`
 *     (ver scenes/FightScene). Ele troca o cenario inteiro por uma chapa de
 *     alto contraste, entao hoje nao ha problema -- mas qualquer caminho
 *     novo que desligue o contorno sobre ESTE palco lava os dois lutadores.
 *
 *   - Clarear mais o ceu ou subir o sol piora a conta. Se for preciso, o que
 *     se mexe e a cor do corpo (como ja foi feito duas vezes em presets),
 *     nao a do ceu.
 *
 * A PERSPECTIVA AEREA E O QUE DA PROFUNDIDADE, e ela e invertida em relacao
 * ao que a intuicao pede: o que esta LONGE e mais CLARO e menos saturado,
 * porque o ar entre o olho e a montanha espalha luz. Serra distante pintada
 * mais escura le como buraco, nao como distancia.
 */

import React, { useMemo } from "react";
import * as THREE from "three";
import { hashRng } from "../../core/rng";
import { Paredao3D } from "./Paredao3D";
import { FranjaDaFrente, texturaDoChao } from "./Terreno";

/** Cor do ceu no alto, e o fundo do canvas quando nada mais e desenhado. */
export const COR_DO_ALTO = "#2a2d64";
/** Cor do ceu na linha do horizonte. */
const COR_DO_HORIZONTE = "#f0a071";
const COR_DO_MEIO = "#b96a86";

/**
 * Rampa de degraus para o meshToonMaterial.
 *
 * O material toon nao decide sozinho quantas bandas usar: ele consulta esta
 * textura. Sem ela o Three usa uma rampa de dois degraus e tudo fica preto ou
 * branco. NearestFilter e obrigatorio -- com filtro linear os degraus se
 * misturam e volta a ser degrade, que e exatamente o que este palco evita.
 */
const rampaDeDegraus = (degraus: number[]): THREE.DataTexture => {
  const dados = new Uint8Array(degraus.length * 4);
  degraus.forEach((v, i) => {
    const c = Math.round(v * 255);
    dados.set([c, c, c, 255], i * 4);
  });
  const t = new THREE.DataTexture(dados, degraus.length, 1);
  t.minFilter = THREE.NearestFilter;
  t.magFilter = THREE.NearestFilter;
  t.needsUpdate = true;
  return t;
};

/**
 * Mascara de opacidade da faixa de bruma: opaca ao fundo, zero de perto.
 *
 * Guardada numa variavel de modulo em vez de useMemo porque ela nao depende
 * de nada -- e uma textura so para o processo inteiro, e criar uma por
 * componente desperdicaria memoria de GPU a cada remontagem.
 */
let mascaraGuardada: THREE.CanvasTexture | null = null;
const mascaraDeBruma = (): THREE.CanvasTexture | null => {
  if (mascaraGuardada) return mascaraGuardada;
  const canvas = document.createElement("canvas");
  canvas.width = 4;
  canvas.height = 256;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  const grad = ctx.createLinearGradient(0, 0, 0, 256);
  // v = 0 e a borda LONGE (o plano esta deitado): opaca la, transparente aqui
  grad.addColorStop(0, "#ffffff");
  grad.addColorStop(0.55, "#777777");
  grad.addColorStop(1, "#000000");
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 4, 256);
  mascaraGuardada = new THREE.CanvasTexture(canvas);
  return mascaraGuardada;
};

/** O ceu: uma chapa enorme ao fundo, com degrade vertical pintado. */
const Ceu: React.FC = () => {
  const textura = useMemo(() => {
    const canvas = document.createElement("canvas");
    canvas.width = 4;
    canvas.height = 512;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;
    const grad = ctx.createLinearGradient(0, 0, 0, 512);
    // de cima para baixo: noite chegando -> malva -> brasa no horizonte
    grad.addColorStop(0, COR_DO_ALTO);
    grad.addColorStop(0.45, COR_DO_MEIO);
    grad.addColorStop(0.8, COR_DO_HORIZONTE);
    grad.addColorStop(1, "#ffd9a0");
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 4, 512);
    const t = new THREE.CanvasTexture(canvas);
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  }, []);

  if (!textura) return null;
  /*
    O ceu fica a 26000 de distancia e e ENORME. Ele precisa cobrir o quadro
    inteiro no zoom mais aberto da camera, e a camera abre bastante quando os
    dois lutadores se separam (ver enquadrarDois em camera/camera).
  */
  return (
    <mesh position={[0, 3000, -26000]}>
      <planeGeometry args={[80000, 34000]} />
      <meshBasicMaterial map={textura} fog={false} depthWrite={false} />
    </mesh>
  );
};

/** O sol baixo: disco chapado, com um halo maior e translucido em volta. */
const Sol: React.FC = () => (
  <group position={[-3200, 4200, -24000]}>
    <mesh>
      <circleGeometry args={[1500, 48]} />
      <meshBasicMaterial color="#fff0c8" fog={false} depthWrite={false} />
    </mesh>
    <mesh position={[0, 0, -10]}>
      <circleGeometry args={[3200, 48]} />
      <meshBasicMaterial
        color="#ffc07a"
        transparent
        opacity={0.45}
        fog={false}
        depthWrite={false}
      />
    </mesh>
  </group>
);

/**
 * Uma banda de serra: silhueta recortada, chapada, numa distancia so.
 *
 * O recorte sai de `hashRng` com a semente do palco, entao o mesmo palco sai
 * igual em todo quadro -- o Remotion desenha cada quadro isolado e um
 * Math.random aqui tremeria a montanha inteira a 60 Hz.
 */
const Serra: React.FC<{
  semente: number;
  indice: number;
  z: number;
  altura: number;
  cor: string;
  largura: number;
}> = ({ semente, indice, z, altura, cor, largura }) => {
  const geometria = useMemo(() => {
    const forma = new THREE.Shape();
    const picos = 9;
    const passo = largura / picos;
    forma.moveTo(-largura / 2, -4000);
    forma.lineTo(-largura / 2, 0);
    for (let i = 0; i <= picos; i++) {
      const r = hashRng(`serra-${indice}-${i}`, semente);
      const x = -largura / 2 + i * passo;
      // picos alternados alto/baixo: cume isolado le melhor que serrote
      const h = altura * (0.45 + r * 0.55) * (i % 2 === 0 ? 1 : 0.62);
      forma.lineTo(x + passo * 0.5, h);
      forma.lineTo(x + passo, h * 0.4);
    }
    forma.lineTo(largura / 2, -4000);
    forma.closePath();
    return new THREE.ShapeGeometry(forma);
  }, [semente, indice, altura, largura]);

  return (
    <mesh geometry={geometria} position={[0, 0, z]}>
      <meshBasicMaterial color={cor} fog={false} />
    </mesh>
  );
};

/**
 * As bandas, da mais distante para a mais proxima.
 *
 * As cores vao de clara para escura conforme se aproximam: e a perspectiva
 * aerea (ver a nota no topo). A banda mais proxima e quase a cor da
 * silhueta, e e ela que encosta no chao onde a luta acontece.
 */
const BANDAS: { z: number; altura: number; cor: string; largura: number }[] = [
  /*
    A BANDA MAIS DISTANTE E BAIXA DE PROPOSITO (3400 e nao 5200): e por cima
    dela que o sol aparece. Com 5200 o disco ficava inteiro atras da serra e
    o palco perdia a sua unica fonte de luz visivel -- o sol estava desenhado
    e ninguem via.
  */
  { z: -21000, altura: 3400, cor: "#e0a79e", largura: 72000 },
  { z: -16000, altura: 4600, cor: "#a9738a", largura: 56000 },
  { z: -11000, altura: 3400, cor: "#6d4a68", largura: 40000 },
  { z: -6500, altura: 2100, cor: "#3b2747", largura: 26000 },
];

/** Nuvem: laje achatada de bordas arredondadas, chapada em duas cores. */
const Nuvem: React.FC<{
  pos: [number, number, number];
  escala: number;
  cor: string;
}> = ({ pos, escala, cor }) => (
  <group position={pos} scale={escala}>
    {[
      [-600, 0, 0, 620],
      [120, 90, 0, 820],
      [800, -20, 0, 540],
    ].map(([x, y, z, r], i) => (
      <mesh key={i} position={[x, y, z]}>
        <circleGeometry args={[r, 28]} />
        <meshBasicMaterial color={cor} fog={false} depthWrite={false} />
      </mesh>
    ))}
  </group>
);

const Nuvens: React.FC<{ semente: number }> = ({ semente }) => {
  const nuvens = useMemo(
    () =>
      /*
        NUVEM PEQUENA, ALTA E LONGE.

        A primeira versao punha sete nuvens de escala 1.6 a 4.0 entre 2200 e
        8200 de altura, a 14000..24000 de distancia. Num quadro VERTICAL de
        1080 isso enche: elas viravam manchas atras do placar e uma passava
        por tras do selo do canal. Nuvem de fundo de anime e elemento de
        CANTO -- ela existe para o ceu nao ser liso, nao para ocupar o centro.
      */
      Array.from({ length: 5 }, (_, i) => {
        const r = (k: string) => hashRng(`nuvem-${i}-${k}`, semente);
        const z = -27000 + r("z") * 5000;
        return {
          pos: [
            // empurrada para os lados: o centro do quadro e da luta
            (r("x") < 0.5 ? -1 : 1) * (14000 + r("x") * 22000),
            6500 + r("y") * 7000,
            z,
          ] as [number, number, number],
          escala: 1.1 + r("e") * 1.1,
          // nuvem mais alta pega menos a brasa do sol: fica malva
          cor: r("y") > 0.55 ? "#d59aa6" : "#ffc79a",
        };
      }),
    [semente],
  );
  return (
    <>
      {nuvens.map((n, i) => (
        <Nuvem key={i} pos={n.pos} escala={n.escala} cor={n.cor} />
      ))}
    </>
  );
};

/**
 * TORII em silhueta, fora do caminho da luta.
 *
 * Ele e o elemento que diz "este lugar e um lugar" -- um fundo so de serra e
 * paisagem, nao cenario. Fica bem para o lado e atras do plano dos lutadores
 * para nunca disputar o centro do quadro, que e vertical e estreito.
 */
const Torii: React.FC<{
  rampa: THREE.DataTexture;
  x: number;
  z: number;
  escala: number;
}> = ({ rampa, x, z, escala }) => {
  const cor = "#2a1b30";
  const coluna = (x: number) => (
    <mesh key={x} position={[x, 1100, 0]} castShadow>
      <boxGeometry args={[150, 2200, 150]} />
      <meshToonMaterial color={cor} gradientMap={rampa} />
    </mesh>
  );
  /*
    GRANDE E LONGE, e nao pequeno e perto.

    A camera enxerga cerca de 1100 unidades de largura no plano dos
    lutadores (1080 pixels divididos pelo zoom). Um torii a z = -3200 com
    2100 de vao simplesmente nao cabia no quadro vertical: ele estava
    montado e invisivel. A 9000 de distancia a mesma lente cobre quase
    8000 unidades, e ai um torii desta escala aparece inteiro, de lado,
    sem disputar o centro com a luta.
  */
  return (
    <group position={[x, 0, z]} scale={escala}>
      {coluna(-700)}
      {coluna(700)}
      <mesh position={[0, 2320, 0]} castShadow>
        <boxGeometry args={[2100, 170, 230]} />
        <meshToonMaterial color={cor} gradientMap={rampa} />
      </mesh>
      <mesh position={[0, 1950, 0]} castShadow>
        <boxGeometry args={[1750, 120, 170]} />
        <meshToonMaterial color={cor} gradientMap={rampa} />
      </mesh>
    </group>
  );
};

/**
 * UM CAMINHO DE TORII, e nao um torii.
 *
 * Com um so, medido por scripts/palco3d.mts no duelo do vale: ele aparece
 * inteiro no comeco e vai sumindo -- 67%, 44%, 27%, 20% e zero a partir do
 * quadro 2520. Os lutadores derivam cerca de 6300 unidades para a esquerda ao
 * longo da luta e a camera vai com eles; o torii, parado em x = 4200, cai
 * para fora da borda direita e o ultimo terco do video fica com metade do
 * quadro em ceu liso.
 *
 * A saida NAO e prender o torii na camera. Isso e o que o cenario 2D faz
 * (`camX` em backgrounds/Vale) porque la nao ha profundidade de verdade;
 * aqui ha, e um elemento que acompanha a camera denuncia o truque assim que
 * a camera se aproxima dele.
 *
 * A saida e o lugar ter mais de um portao -- que e o que um caminho de
 * santuario tem de verdade. O espacamento vem da medicao: ~3800 unidades
 * cobre a deriva da luta sem que dois caiam no quadro ao mesmo tempo no
 * zoom mais aberto.
 */
const CaminhoDeTorii: React.FC<{ rampa: THREE.DataTexture }> = ({ rampa }) => (
  <>
    {[
      { x: 5200, z: -11000, escala: 1.5 },
      { x: 1400, z: -11600, escala: 1.42 },
      { x: -2400, z: -11000, escala: 1.5 },
      { x: -6200, z: -11600, escala: 1.42 },
      { x: -10000, z: -11000, escala: 1.5 },
    ].map((p, i) => (
      <Torii key={i} rampa={rampa} x={p.x} z={p.z} escala={p.escala} />
    ))}
  </>
);

export const Entardecer: React.FC<{
  semente: number;
  /** 0 a 1: quanto o paredao ja foi trincado (ver Paredao3D) */
  trincado?: number;
}> = ({ semente, trincado = 0 }) => {
  const rampa = useMemo(() => rampaDeDegraus([0.35, 0.72, 1]), []);

  return (
    <>
      {/*
        NEBLINA CURTA E DA COR DO HORIZONTE. Ela so age no chao e no torii --
        ceu, serras e nuvens sao `fog={false}`. Serve para o chao sumir na
        mesma cor em que a serra mais distante comeca, em vez de terminar
        numa linha reta de plano infinito.
      */}
      <fog attach="fog" args={["#8a5f78", 3000, 15000]} />
      <Ceu />
      <Sol />
      <Nuvens semente={semente} />
      {BANDAS.map((b, i) => (
        <Serra
          key={i}
          semente={semente}
          indice={i}
          z={b.z}
          altura={b.altura}
          cor={b.cor}
          largura={b.largura}
        />
      ))}

      {/*
        LUZ. O sol esta baixo e a ESQUERDA, igual ao disco desenhado: luz que
        vem de onde o sol nao esta e o erro que mais denuncia cenario montado
        as pressas.
      */}
      <ambientLight intensity={1.1} color="#c99bb0" />
      <hemisphereLight args={["#ffc79a", "#3a2740", 0.9]} />
      <directionalLight
        position={[-2600, 1600, 2200]}
        intensity={2.2}
        color="#ffd2a0"
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

      {/*
        PREENCHIMENTO VINDO DA CAMERA, fraco e quente.

        O sol esta a ESQUERDA (x = -2600) e o paredao tem a face virada
        para a DIREITA -- de onde vem a luta. Com uma luz so, essa face
        caia no degrau mais baixo da rampa toon e lia quase preta, e e
        justamente nela que o corpo arremessado bate. A versao 2D pintava
        essa face mais clara de proposito (`face` nas paletas de
        backgrounds/Obstaculo); aqui o equivalente honesto e uma luz, nao
        uma cor pintada a mao.

        Fraca para nao desfazer o contraluz de entardecer, que e o que da
        o clima do palco.
      */}
      <directionalLight
        position={[3200, 1100, 4200]}
        intensity={0.95}
        color="#f0b89e"
      />

      {/* o chao passa pelo z = 0, que e o plano dos lutadores */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[60000, 60000]} />
        {/*
          A TEXTURA ENTRA COMO map, e o toon continua mandando no valor.

          Sem ela o terco de baixo do quadro era uma laje de uma cor so. A
          textura nao desenha pedra nem grama: ela varia o valor em manchas
          largas e sulcos fracos, que e o que separa "terreno" de "piso"
          sem competir com a silhueta dos lutadores (ver palcos/Terreno).
        */}
        <meshToonMaterial
          color="#5e3f55"
          gradientMap={rampa}
          map={texturaDoChao()}
        />
      </mesh>
      {/*
        FAIXA DE BRUMA RENTE AO CHAO, onde ele encontra a serra.

        Sem ela o chao e uma laje de UMA cor ocupando quase metade do quadro
        vertical, e a transicao para a montanha e uma linha reta -- a leitura
        e "piso de estudio", nao "terreno que continua". A faixa e so uma
        chapa clara e translucida deitada logo acima do chao: ela clareia a
        parte distante, que e o que a distancia faz de verdade.

        Deitada e nao em pe de proposito: em pe ela seria uma parede e
        cortaria os pes de quem recuasse para o fundo.
      */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 12, -7000]}>
        <planeGeometry args={[60000, 11000]} />
        {/*
          A FAIXA PRECISA DESAPARECER NA BORDA DE PERTO.

          Com opacidade constante ela termina onde o plano termina, e isso e
          uma LINHA RETA atravessando o chao no meio do quadro -- trocar uma
          laje chapada por uma laje chapada com risco no meio. A mascara faz
          a opacidade cair ate zero na borda que olha para a camera, entao a
          bruma morre sem deixar aresta.
        */}
        <meshBasicMaterial
          color="#c98f93"
          transparent
          alphaMap={mascaraDeBruma()}
          opacity={0.6}
          fog={false}
          depthWrite={false}
        />
      </mesh>

      <Paredao3D rampa={rampa} trincado={trincado} />

      <CaminhoDeTorii rampa={rampa} />

      {/*
        A FRANJA E A ULTIMA COISA DA CENA, e ela fica na frente dos
        lutadores (z positivo). E o terceiro plano da composicao: franja,
        acao, serra. Ver palcos/Terreno para a conta de onde ela cabe sem
        comer a luta.
      */}
      <FranjaDaFrente semente={semente} />
    </>
  );
};
