/**
 * A CAMADA DA FRENTE: os dois corpos em SVG, como o video desenha.
 *
 * Esta pagina NAO usa o `FightScene` nem o `Prototype`, e a razao e uma so:
 * os dois pedem `useCurrentFrame()`, que exige estar dentro de uma composicao
 * do Remotion. O segundo hospedeiro existe exatamente para NAO estar dentro
 * dela -- ele tem laco proprio de requestAnimationFrame.
 *
 * O que isso custa esta dito no painel e em references/migracao-3d.md: aqui
 * nao ha efeito, poder, katana, placa, placar nem marca d'agua. O que sobra e
 * o que a ferramenta precisa: o CORPO, resolvido pela mesma chamada que o
 * video usa.
 *
 * E e a MESMA chamada, nao uma parecida:
 *
 *   quadroEfetivo   -> o hit stop congela o quadro consultado
 *   corpoNoQuadro   -> pose, apoio, IK da mira, profundidade
 *   tremorDoHitStop -> a vibracao no congelamento, que le como forca entrando
 *   transformDaCamera -> mundo em tela
 *   Stickman        -> o mesmo componente de desenho, sem copia
 *
 * Se qualquer uma divergisse, a pagina estaria depurando outra animacao.
 */

import React from "react";
import { corpoNoQuadro, juntasDoCorpo } from "../../animation/corpo";
import { tremorDoHitStop } from "../../animation/sampler";
import { transformDaCamera, type EstadoCamera } from "../../camera/camera";
import { PRESETS } from "../../characters/presets";
import { Stickman } from "../../characters/Stickman";
import type { FighterId, Timeline } from "../../core/types";

export const CamadaDeCorpos: React.FC<{
  timeline: Timeline;
  /** quadro LOGICO, ja passado por quadroEfetivo */
  frame: number;
  /** quadro REAL do laco: e ele que faz o tremor do hit stop andar */
  frameReal: number;
  cam: EstadoCamera;
  largura: number;
  altura: number;
  /** desenha uma bolinha em cada junta, para comparar com o gizmo 3D */
  juntas: boolean;
}> = ({ timeline, frame, frameReal, cam, largura, altura, juntas }) => {
  const ids = [timeline.spec.fighterA, timeline.spec.fighterB] as FighterId[];

  const lutadores = ids
    .map((id) => ({
      id,
      corpo: corpoNoQuadro(timeline, id, frame),
      preset: PRESETS[id],
      tremor: tremorDoHitStop(timeline, frameReal, id),
    }))
    /*
      ORDENA POR z, como o FightScene faz: sem isso um corpo pode encolher e
      subir na tela sem nunca ficar ATRAS do outro, e o olho nao acredita. O
      sort do JavaScript e estavel, entao onde z nao foi usado nada muda.
    */
    .sort((p, q) => q.corpo.z - p.corpo.z);

  return (
    <svg
      width="100%"
      height="100%"
      viewBox={`0 0 ${largura} ${altura}`}
      /*
        O SVG fica POR CIMA do canvas do Three e nao pode comer o mouse: sem
        isto a camera de orbita nao recebe arrasto nenhum e a pagina deixa de
        ser inspecionavel, que e a razao de ela existir.
      */
      style={{
        position: "absolute",
        inset: 0,
        pointerEvents: "none",
        background: "transparent",
      }}
    >
      <g transform={transformDaCamera(cam, largura, altura)}>
        {lutadores.map(({ id, corpo, preset, tremor }) => (
          <g key={id}>
            <Stickman
              preset={preset}
              pose={corpo.pose}
              baseX={corpo.x + tremor}
              baseY={corpo.baseY}
              facing={corpo.facing}
              scaleExtra={corpo.scale / preset.scale}
              spin={corpo.spin}
              giro={corpo.giro}
              velocidade={corpo.velocidade}
            />
            {juntas &&
              Object.entries(juntasDoCorpo(corpo)).map(([nome, p]) => (
                <circle
                  key={nome}
                  cx={p.x + tremor}
                  cy={p.y}
                  r={9}
                  fill="none"
                  /*
                    ANEL BRANCO, nao bolinha colorida: ele existe para ser
                    comparado com a esfera 3D que cai no mesmo lugar, e so da
                    para ver a esfera atraves dele se o meio for vazado.
                  */
                  stroke="#ffffff"
                  strokeWidth={3}
                />
              ))}
          </g>
        ))}
      </g>
    </svg>
  );
};
