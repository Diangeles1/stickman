/**
 * OSSOS E PONTOS DE CONTATO DESENHADOS DENTRO DA CENA 3D.
 *
 * Nao e enfeite: e a unica forma de VER, de um angulo que nao o da camera do
 * video, onde o motor pensa que o corpo esta.
 *
 * O que estes gizmos verificam, e que nada mais no projeto verifica:
 *
 *   1. SE AS DUAS CAMERAS CONCORDAM. O gizmo 3D nasce de `rig3d`, passa pela
 *      lente do Three e cai num pixel. A bolinha 2D da `CamadaDeCorpos` nasce
 *      de `juntasDoCorpo`, passa por `transformDaCamera` e cai noutro pixel.
 *      Com a camera casada (ver a nota no topo de Cenario3D) os dois pixels
 *      sao o MESMO. Se separarem, as cameras discordaram -- que e o unico
 *      ponto onde a montagem 2D-sobre-3D pode dar errado, e ate agora nao
 *      havia como olhar para ele.
 *   2. SE O CORPO ESTA NO CHAO. Em perfil, pe dentro do chao e pe acima dele
 *      desenham igual. Orbitando a camera para baixo a diferenca aparece.
 *   3. SE O GOLPE ENCOSTA NO LUGAR. O ponto mirado, a ponta do membro
 *      atacante e a linha entre os dois, em tres dimensoes.
 *
 * NAO HA CAIXA DE COLISAO PARA DESENHAR, e isso e uma propriedade do motor e
 * nao uma omissao daqui: o contato e resolvido por PONTO e DISTANCIA
 * (`core/contact.pontoDoAlvo` mais a distancia de combate), nunca por caixa
 * alinhada aos eixos. Desenhar caixas aqui seria inventar geometria que o
 * compilador nao usa. O que aparece e a geometria real do contato.
 */

import React, { useMemo } from "react";
import * as THREE from "three";
import { corpoNoQuadro, juntasDoCorpo } from "../../animation/corpo";
import { PRESETS } from "../../characters/presets";
import { OSSOS } from "../../characters/skeleton";
import { pontoDoAlvo, type PontoAlvo } from "../../core/contact";
import type { FighterId, Timeline } from "../../core/types";
import {
  esqueletoDoCorpo,
  juntaNoMundo,
  pontoDoCorpoEm3D,
  type Esqueleto3D,
  type Ponto3D,
} from "../rig3d";

/** Raio do osso desenhado, em unidades de mundo. Fino para nao esconder nada. */
const RAIO_DO_OSSO = 7;
const RAIO_DA_JUNTA = 17;

const vetor = (p: Ponto3D) => new THREE.Vector3(p.x, p.y, p.z);

/**
 * Um osso: cilindro UNITARIO escalado, nunca `cylinderGeometry` com o
 * comprimento nos args.
 *
 * Com o comprimento nos args, o r3f compara os args, ve que mudaram e cria uma
 * BufferGeometry nova -- vinte e quatro delas por quadro, sessenta vezes por
 * segundo, numa pagina cuja razao de existir inclui medir desempenho.
 * Escalando uma geometria de args constantes, nada e realocado.
 */
const Osso: React.FC<{ a: Ponto3D; b: Ponto3D; cor: string }> = ({
  a,
  b,
  cor,
}) => {
  const { posicao, quaternion, comprimento } = useMemo(() => {
    const va = vetor(a);
    const vb = vetor(b);
    const d = new THREE.Vector3().subVectors(vb, va);
    const comp = d.length();
    return {
      posicao: new THREE.Vector3().addVectors(va, vb).multiplyScalar(0.5),
      // o cilindro do Three nasce ao longo de +y; girar de +y para a direcao
      // do osso e exatamente o que setFromUnitVectors faz
      quaternion: new THREE.Quaternion().setFromUnitVectors(
        new THREE.Vector3(0, 1, 0),
        comp > 0 ? d.divideScalar(comp) : new THREE.Vector3(0, 1, 0),
      ),
      comprimento: Math.max(comp, 0.001),
    };
  }, [a, b]);

  return (
    <mesh
      position={posicao}
      quaternion={quaternion}
      scale={[RAIO_DO_OSSO, comprimento, RAIO_DO_OSSO]}
    >
      <cylinderGeometry args={[1, 1, 1, 6]} />
      {/*
        BASICO e nao standard: o gizmo nao participa da iluminacao da cena.
        Ele e instrumento de medida, e instrumento que escurece quando a luz
        muda deixa de servir para comparar dois quadros.
      */}
      <meshBasicMaterial color={cor} />
    </mesh>
  );
};

const Junta: React.FC<{ p: Ponto3D; cor: string; raio?: number }> = ({
  p,
  cor,
  raio = RAIO_DA_JUNTA,
}) => (
  <mesh position={[p.x, p.y, p.z]} scale={raio}>
    <sphereGeometry args={[1, 8, 8]} />
    <meshBasicMaterial color={cor} />
  </mesh>
);

const Esqueleto: React.FC<{ e: Esqueleto3D; cor: string }> = ({ e, cor }) => (
  <group>
    {OSSOS.map(([de, para], i) => (
      <Osso
        key={i}
        a={juntaNoMundo(e, de)}
        b={juntaNoMundo(e, para)}
        cor={cor}
      />
    ))}
    {OSSOS.map(([de], i) => (
      <Junta key={`j${i}`} p={juntaNoMundo(e, de)} cor={cor} />
    ))}
    {/*
      O QUADRIL NO CHAO: um anel no y = 0 embaixo do quadril. E o que mostra,
      de qualquer angulo, se o corpo esta plantado ou flutuando -- a pergunta
      que `scripts/pes.mts` responde em numero e que ninguem conseguia ver.
    */}
    <mesh
      position={[e.posicao.x, 1, e.posicao.z]}
      rotation={[-Math.PI / 2, 0, 0]}
    >
      <ringGeometry args={[52, 64, 24]} />
      <meshBasicMaterial color={cor} transparent opacity={0.8} />
    </mesh>
  </group>
);

/**
 * O CONTATO DO QUADRO: ponto mirado, ponta do membro atacante, linha entre os
 * dois.
 *
 * A mira vem de `timeline.aims`, que e a INTENCAO que o compilador declarou --
 * a mesma que a cinematica inversa de `corpoNoQuadro` tenta cumprir. Entao a
 * distancia que aparece entre as duas bolinhas e o erro de IK de verdade, e
 * nao uma estimativa.
 */
const Contato: React.FC<{ timeline: Timeline; frame: number }> = ({
  timeline,
  frame,
}) => {
  const mira = timeline.aims.find(
    (m) => !m.recuo && frame >= m.from && frame <= m.to,
  );
  if (!mira) return null;

  const atacante = corpoNoQuadro(timeline, mira.who, frame);
  const alvo = corpoNoQuadro(timeline, mira.alvo, frame);
  const punho2D = juntasDoCorpo(atacante)[mira.joint];
  const alvo2D = pontoDoAlvo(mira.ponto as PontoAlvo, juntasDoCorpo(alvo));

  const punho = pontoDoCorpoEm3D(punho2D, atacante);
  const ponto = pontoDoCorpoEm3D(alvo2D, alvo);

  return (
    <group>
      <Junta p={punho} cor="#ffd34d" raio={26} />
      <Junta p={ponto} cor="#ff4d6d" raio={26} />
      <Osso a={punho} b={ponto} cor="#ffd34d" />
    </group>
  );
};

/** O impacto que o compilador registrou, se ele cai perto deste quadro. */
const Impacto: React.FC<{ timeline: Timeline; frame: number }> = ({
  timeline,
  frame,
}) => {
  const imp = timeline.impacts.find((i) => Math.abs(i.frame - frame) <= 2);
  if (!imp) return null;
  /*
    O `at` do impacto e coordenada de mundo 2D sem corpo de origem declarado.
    Ele e levado para a cena pelo corpo da VITIMA, que e de quem ele descreve
    a superficie; sem vitima (impacto no chao) sobra o lutador A, cujo z e o
    mesmo em toda luta ja escrita.
  */
  const dono = imp.victim ?? timeline.spec.fighterA;
  const p = pontoDoCorpoEm3D(imp.at, corpoNoQuadro(timeline, dono, frame));
  return <Junta p={p} cor="#ffffff" raio={38} />;
};

export const Gizmos3D: React.FC<{
  timeline: Timeline;
  frame: number;
  contato: boolean;
}> = ({ timeline, frame, contato }) => {
  const ids = [timeline.spec.fighterA, timeline.spec.fighterB] as FighterId[];
  return (
    <group>
      {ids.map((id) => (
        <Esqueleto
          key={id}
          e={esqueletoDoCorpo(corpoNoQuadro(timeline, id, frame))}
          cor={PRESETS[id]?.stroke ?? "#9fe0b4"}
        />
      ))}
      {contato && (
        <>
          <Contato timeline={timeline} frame={frame} />
          <Impacto timeline={timeline} frame={frame} />
        </>
      )}
    </group>
  );
};

/**
 * A mira ativa neste quadro, em texto, para o painel.
 *
 * A distancia que sai daqui e medida em 2D de proposito: e a mesma conta de
 * `debug/DebugOverlay`, entao o numero do painel e comparavel com o numero que
 * o overlay 2D ja mostrava, em vez de ser um terceiro valor.
 */
export const miraNoQuadro = (
  timeline: Timeline,
  frame: number,
): string | null => {
  const mira = timeline.aims.find(
    (m) => !m.recuo && frame >= m.from && frame <= m.to,
  );
  if (!mira) return null;
  const atacante = corpoNoQuadro(timeline, mira.who, frame);
  const alvo = corpoNoQuadro(timeline, mira.alvo, frame);
  const punho = juntasDoCorpo(atacante)[mira.joint];
  const ponto = pontoDoAlvo(mira.ponto as PontoAlvo, juntasDoCorpo(alvo));
  const d = Math.hypot(punho.x - ponto.x, punho.y - ponto.y);
  return `${mira.joint} -> ${mira.alvo}.${mira.ponto}  ${d.toFixed(0)}u`;
};
