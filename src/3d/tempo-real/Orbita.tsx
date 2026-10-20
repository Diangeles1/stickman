/**
 * CAMERA DE ORBITA: o que faz esta pagina valer como ferramenta.
 *
 * A camera do video e fixa de lado, e nao por preguica -- ela e CASADA com o
 * SVG (ver a nota no topo de Cenario3D), e e justamente por estar casada que
 * ela nao pode se mover livremente sem descolar as duas camadas. Entao a
 * pergunta "o pe esta dentro do chao ou acima dele?" nao tem resposta no
 * video: de perfil, as duas coisas desenham igual.
 *
 * Aqui ela tem. A orbita e o unico recurso desta pagina que o Remotion nao
 * pode ter, e e por causa dela que o segundo hospedeiro existe.
 *
 * O PRECO ESTA PAGO EXPLICITAMENTE, e o App o cobra: com a orbita ligada a
 * camera deixa de concordar com o SVG, entao a camada de corpos 2D e
 * ESCONDIDA e os gizmos 3D entram no lugar dela. A alternativa -- deixar o
 * SVG na tela, desalinhado -- transformaria a ferramenta de depuracao na
 * fonte do defeito que ela deveria achar.
 *
 * Nao ha salto ao ligar: `CameraCasada` acabou de escrever a posicao e o
 * ponto para onde a camera olha, e a orbita comeca desse estado.
 */

import { useFrame, useThree } from "@react-three/fiber";
import React, { useEffect, useMemo } from "react";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";

export const Orbita: React.FC<{ ativo: boolean }> = ({ ativo }) => {
  const camera = useThree((s) => s.camera);
  const dom = useThree((s) => s.gl.domElement);

  const controles = useMemo(() => {
    const c = new OrbitControls(camera, dom);
    // amortecimento: sem ele cada clique joga a camera, e comparar dois
    // angulos proximos fica impossivel
    c.enableDamping = true;
    c.dampingFactor = 0.09;
    c.zoomSpeed = 1.4;
    c.panSpeed = 1.2;
    // a cena e medida em unidades de mundo do motor (um corpo tem ~600), e os
    // blocos chegam a 5800 de profundidade: a faixa util e grande
    c.minDistance = 150;
    c.maxDistance = 26000;
    /*
      DEIXA PASSAR UM POUCO ABAIXO DO HORIZONTE de proposito. O chao e um
      plano de face unica, entao de baixo ele e invisivel -- e e exatamente
      dali que da para ver se o pe furou o chao. Clampar em PI/2 tiraria o
      unico angulo em que a pergunta tem resposta.
    */
    c.maxPolarAngle = Math.PI * 0.66;
    return c;
  }, [camera, dom]);

  useEffect(() => () => controles.dispose(), [controles]);

  useEffect(() => {
    controles.enabled = ativo;
    if (!ativo) return;
    // o alvo e o ponto do plano z = 0 que a camera casada estava mirando
    controles.target.set(camera.position.x, camera.position.y, 0);
    controles.update();
  }, [ativo, controles, camera]);

  // o amortecimento precisa de um update por repintura, nao por quadro da luta
  useFrame(() => {
    if (ativo) controles.update();
  });

  return null;
};
