/**
 * O PAREDAO em tres dimensoes.
 *
 * Ele existia como SVG chapado (backgrounds/Obstaculo) e, dentro da cena 3D,
 * lia como um adesivo: uma laje sem perspectiva no meio de um mundo que tem.
 * Era a ultima peca 2D que nao era personagem.
 *
 * O PERFIL E O MESMO, VERTICE POR VERTICE, e isso nao e preciosismo.
 *
 * A coreografia depende da geometria dele. `OBSTACULO_X` (-2400) e a QUINA
 * DIREITA da massa, e `arremesso-no-paredao` usa `FACE_X = OBSTACULO_X` como
 * a superficie em que o corpo bate -- o arremesso posiciona os dois em marcas
 * relativas a essa coordenada. Uma rocha 3D "parecida" com a 2D poria a face
 * alguns pixels adiante e o corpo bateria no ar, ou entraria na pedra.
 *
 * Entao o caminho do SVG e transcrito como esta, so com o y invertido (o
 * mundo 2D cresce para baixo):
 *
 *     M -900 40  L -820 -1300  L -260 -1500  L -40 -900  L 0 40  Z
 *
 * A profundidade e a unica coisa que o 2D nao tinha e que aqui e inventada --
 * ela nao afeta coreografia nenhuma, porque todo o combate acontece no plano
 * z = 0. A extrusao e CENTRADA nesse plano justamente por isso: a face que o
 * corpo acerta passa por onde o corpo esta.
 */

import React, { useMemo } from "react";
import * as THREE from "three";
import { OBSTACULO_X } from "../../backgrounds/Obstaculo";

/** Quanto a massa avanca para a frente e para tras do plano da luta. */
const PROFUNDIDADE = 760;

/**
 * Espessura do chanfro, e ELA ENTRA NA CONTA DA FACE DIANTEIRA.
 *
 * `ExtrudeGeometry` soma `bevelThickness` nas DUAS pontas: com depth 760 e
 * chanfro 26, a malha tem 812 de profundidade, nao 760. Pondo a cratera em
 * PROFUNDIDADE / 2 ela nascia DENTRO da pedra e so a borda dela escapava --
 * no render aparecia uma lasca vertical de poucos pixels, que foi
 * exatamente o sintoma.
 */
const CHANFRO = 26;

/** O perfil, em coordenadas locais com y para CIMA. */
const PERFIL: [number, number][] = [
  [-900, -40],
  [-820, 1300],
  [-260, 1500],
  [-40, 900],
  [0, -40],
];

export const Paredao3D: React.FC<{
  rampa: THREE.DataTexture;
  /** 0 a 1: quanto a massa ja foi trincada pelo impacto da cena */
  trincado?: number;
  cor?: string;
}> = ({ rampa, trincado = 0, cor = "#533a52" }) => {
  const geometria = useMemo(() => {
    const forma = new THREE.Shape();
    forma.moveTo(PERFIL[0][0], PERFIL[0][1]);
    for (const [x, y] of PERFIL.slice(1)) forma.lineTo(x, y);
    forma.closePath();
    const g = new THREE.ExtrudeGeometry(forma, {
      depth: PROFUNDIDADE,
      bevelEnabled: true,
      // o chanfro tira a aresta de corte perfeita, que e o que faz caixa
      // extrudada parecer caixa extrudada
      bevelThickness: CHANFRO,
      bevelSize: 22,
      bevelSegments: 2,
    });
    /*
      CENTRADA NO PLANO DA LUTA. A extrusao nasce de z = 0 para z = +depth;
      sem este deslocamento a massa inteira ficaria NA FRENTE dos lutadores e
      o corpo arremessado desapareceria atras dela.
    */
    g.translate(0, 0, -PROFUNDIDADE / 2);
    return g;
  }, []);

  const t = Math.max(0, Math.min(1, trincado));

  return (
    <group position={[OBSTACULO_X, 0, 0]}>
      <mesh geometry={geometria} castShadow receiveShadow>
        <meshToonMaterial color={cor} gradientMap={rampa} />
      </mesh>
      {/*
        A CRATERA DO IMPACTO, quando a cena ja bateu.

        A versao 2D abre cinco fendas e uma cratera na face. Aqui vai so a
        cratera, e esta dito de proposito: fenda em 3D pede geometria
        deformada ou mapa de normais, e nenhuma das duas cabe nesta etapa. O
        que nao se perde e a INFORMACAO -- a pedra fica marcada depois que
        alguem bate nela, e a marca nao some.

        E ELA ENCARA A CAMERA, nao a face.

        A primeira versao girava o disco em Math.PI/2 para ficar colado na
        face que o corpo acerta -- a do +x. Mas a camera olha no sentido
        -z, entao uma superficie virada para o +x e vista quase de perfil:
        a cratera saiu no render como uma LASCA VERTICAL de poucos pixels.

        A marca vai na quina dianteira, virada para quem assiste. O corpo
        continua batendo na face de +x (a coreografia nao muda); o que
        muda e onde o estrago fica visivel.
      */}
      {t > 0.01 && (
        <mesh position={[-130, 430, PROFUNDIDADE / 2 + CHANFRO + 12]}>
          <circleGeometry args={[118 * t, 9]} />
          {/*
            TRANSLUCIDA E DE NOVE LADOS, nao opaca e redonda.

            Opaca em #1b1020 ela lia como BURACO recortado -- um adesivo
            preto colado na pedra. A 0.5 o valor da rocha aparece por
            baixo e a marca vira depressao. E o poligono de nove lados
            quebra o circulo perfeito, que era a outra metade do problema:
            pedra nao racha em circunferencia.
          */}
          <meshBasicMaterial color="#1b1020" transparent opacity={0.5} />
        </mesh>
      )}
    </group>
  );
};
