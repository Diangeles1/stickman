/**
 * O SEGUNDO HOSPEDEIRO DO MOTOR: a arena 3D em tempo real.
 *
 * A decisao de arquitetura e "um motor de luta, dois hospedeiros". O primeiro
 * e o Remotion, que renderiza quadro a quadro, isolado, deterministico, e
 * produz o MP4. Este e o segundo, e existe para fazer as perguntas que o
 * primeiro nao responde:
 *
 *   - o pe esta no chao ou dentro dele? (de perfil, desenha igual)
 *   - as duas cameras concordam? (o unico ponto onde 2D sobre 3D pode falhar)
 *   - a cena aguenta 60 Hz? (o Remotion nao tem taxa de quadros; ele tem
 *     tempo de render por quadro, que e outra coisa)
 *   - como esta luta se parece de cima, de tras, de baixo?
 *
 * O QUE ESTE ARQUIVO NAO FAZ, E ISSO E O PONTO: nenhuma regra de luta. Ele
 * nao decide pose, distancia, contato, reacao nem camera. Ele chama
 * `compilar()` uma vez e `corpoNoQuadro()` por quadro -- as duas MESMAS
 * funcoes que a composicao do Remotion chama. A unica coisa que ele sabe e
 * traduzir milissegundos em numero de quadro (ver relogio.ts), porque e so
 * isso que um hospedeiro de tempo real precisa saber a mais.
 *
 * O cenario vem de `MundoDoCenario3D`, extraido de Cenario3D justamente para
 * nao haver duas cenas: chao, luz, neblina e blocos sao os mesmos objetos,
 * pelo mesmo codigo, no mesmo commit.
 */

import { Canvas } from "@react-three/fiber";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { quadroEfetivo } from "../../animation/sampler";
import { CAMERA_PADRAO, cameraNoQuadro } from "../../camera/camera";
import { ALTURA_QUADRIL } from "../../characters/skeleton";
import { compilar } from "../../core/timeline";
import {
  CAMERA_INICIAL,
  CameraCasada,
  corDoFundo,
  MundoDoCenario3D,
} from "../Cenario3D";
import { CamadaDeCorpos } from "./CamadaDeCorpos";
import { Gizmos3D } from "./Gizmos3D";
import { LUTA_INICIAL, LUTAS } from "./lutas";
import { Orbita } from "./Orbita";
import { Painel, type Opcoes } from "./Painel";
import { criarRelogio } from "./relogio";

const OPCOES_INICIAIS: Opcoes = {
  tocando: true,
  velocidade: 1,
  gizmos: false,
  juntas2D: false,
  contato: true,
  orbita: false,
  corpos: true,
  cenario: true,
};

/** De quanto em quanto tempo o FPS medido sobe para o painel, em ms. */
const INTERVALO_DO_PAINEL = 200;

export const App: React.FC = () => {
  const [luta, setLuta] = useState(LUTA_INICIAL);
  const [opcoes, setOpcoes] = useState(OPCOES_INICIAIS);
  const [frameReal, setFrameReal] = useState(0);
  const [medidas, setMedidas] = useState({ fps: 0, delta: 0 });

  const spec = LUTAS[luta];
  /*
    COMPILA UMA VEZ POR LUTA, como todo o resto do motor. O compilador nao
    roda por quadro em hospedeiro nenhum -- se rodasse aqui, a pagina estaria
    medindo o custo do COMPILADOR e chamando isso de desempenho da cena.
  */
  const timeline = useMemo(() => compilar(spec), [spec]);
  const dur = Math.max(1, timeline.durationInFrames);

  /*
    O QUADRO VIVE NUM ref, E A COPIA EM state E SO PARA DESENHAR.

    O laco de rAF e criado uma vez por luta. Lendo o quadro do state ele
    leria o valor congelado no fecho da primeira chamada e andaria sempre de
    0 para 1. O ref e a posicao de verdade; o state existe para o React
    redesenhar.
  */
  const quadroRef = useRef(0);
  const opcoesRef = useRef(opcoes);
  opcoesRef.current = opcoes;
  const relogioRef = useRef<ReturnType<typeof criarRelogio> | null>(null);

  useEffect(() => {
    const relogio = criarRelogio(spec.fps);
    relogioRef.current = relogio;
    quadroRef.current = 0;
    setFrameReal(0);

    let id = 0;
    let vivo = true;
    let ultimoPainel = 0;

    const passo = (agora: number) => {
      if (!vivo) return;
      const o = opcoesRef.current;
      const quadros = relogio.avancar(agora, o.tocando ? o.velocidade : 0);
      if (quadros > 0) {
        // A LUTA FAZ LACO. Parar no fim transformaria a pagina num visualizador
        // de ultimo quadro; repetir e o que deixa olhar o mesmo golpe dez vezes.
        quadroRef.current = (quadroRef.current + quadros) % dur;
        setFrameReal(quadroRef.current);
      }
      if (agora - ultimoPainel >= INTERVALO_DO_PAINEL) {
        ultimoPainel = agora;
        setMedidas({ fps: relogio.fps(), delta: relogio.delta() });
      }
      id = requestAnimationFrame(passo);
    };

    id = requestAnimationFrame(passo);
    return () => {
      vivo = false;
      cancelAnimationFrame(id);
    };
  }, [spec.fps, dur]);

  /** Salta no tempo sem mexer no play/pause (scrub). */
  const irPara = useCallback(
    (q: number) => {
      const alvo = ((Math.round(q) % dur) + dur) % dur;
      quadroRef.current = alvo;
      // o acumulador guarda uma fracao de quadro da posicao ANTERIOR; mantido,
      // o primeiro quadro depois do salto duraria menos que os outros
      relogioRef.current?.zerar();
      setFrameReal(alvo);
    },
    [dur],
  );

  /** Passo a passo: andar um quadro IMPLICA parar, senao nao se olha nada. */
  const passoDeQuadro = useCallback(
    (delta: number) => {
      setOpcoes((o) => ({ ...o, tocando: false }));
      irPara(quadroRef.current + delta);
    },
    [irPara],
  );

  const mudarOpcoes = useCallback(
    (mudanca: Partial<Opcoes>) => setOpcoes((o) => ({ ...o, ...mudanca })),
    [],
  );

  // ATALHOS: a mao fica no teclado enquanto o olho fica na cena. Ignorados
  // quando o foco esta num campo, senao digitar no seletor de luta pausaria.
  useEffect(() => {
    const emCampo = (alvo: EventTarget | null) => {
      const el = alvo as HTMLElement | null;
      const tag = el?.tagName;
      return tag === "INPUT" || tag === "SELECT" || tag === "TEXTAREA";
    };
    const aoTeclar = (e: KeyboardEvent) => {
      if (emCampo(e.target)) return;
      const atalhos: Record<string, () => void> = {
        " ": () => mudarOpcoes({ tocando: !opcoesRef.current.tocando }),
        ArrowLeft: () => passoDeQuadro(-1),
        ArrowRight: () => passoDeQuadro(1),
        g: () => mudarOpcoes({ gizmos: !opcoesRef.current.gizmos }),
        j: () => mudarOpcoes({ juntas2D: !opcoesRef.current.juntas2D }),
        c: () => mudarOpcoes({ contato: !opcoesRef.current.contato }),
        b: () => mudarOpcoes({ corpos: !opcoesRef.current.corpos }),
        e: () => mudarOpcoes({ cenario: !opcoesRef.current.cenario }),
        o: () => mudarOpcoes({ orbita: !opcoesRef.current.orbita }),
      };
      const acao = atalhos[e.key] ?? atalhos[e.key.toLowerCase()];
      if (!acao) return;
      e.preventDefault();
      acao();
    };
    window.addEventListener("keydown", aoTeclar);
    return () => window.removeEventListener("keydown", aoTeclar);
  }, [mudarOpcoes, passoDeQuadro]);

  const largura = spec.width;
  const altura = spec.height;

  // o hit stop congela o quadro CONSULTADO sem parar o laco -- mesmo
  // tratamento de Arena3D, senao o cenario andaria enquanto a luta congela
  const frame = quadroEfetivo(timeline, frameReal);
  const cam = cameraNoQuadro(timeline, frame, CAMERA_PADRAO, {
    largura,
    alturaQuadril: -ALTURA_QUADRIL,
  });

  /*
    COM A ORBITA LIGADA A CAMADA 2D SAI DA TELA.

    A camera deixou de ser a casada, entao o SVG estaria desenhando os corpos
    no lugar onde eles apareceriam de LADO enquanto a cena mostra outro
    angulo. Deixar os dois na tela daria um desalinhamento que parece defeito
    da cena e nao da ferramenta -- e e exatamente esse desalinhamento que a
    pagina serve para detectar quando a camera esta casada.
  */
  const mostrarCorpos = opcoes.corpos && !opcoes.orbita;

  return (
    <div
      style={{
        display: "flex",
        width: "100vw",
        height: "100vh",
        margin: 0,
        background: "#05070b",
        overflow: "hidden",
      }}
    >
      <div
        style={{
          flex: 1,
          minWidth: 0,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: 8,
          boxSizing: "border-box",
        }}
      >
        {/*
          O PALCO TEM A RAZAO DO VIDEO (1080x1920) e nao a da janela.

          O fov da camera casada e calculado a partir de `altura` em pixels
          LOGICOS do quadro, e o SVG usa o mesmo viewBox. Se a caixa tivesse a
          razao da janela, as duas camadas continuariam concordando entre si,
          mas nenhuma das duas mostraria o enquadramento que o MP4 mostra --
          e enquadramento e metade do que se vem olhar aqui.
        */}
        <div
          style={{
            position: "relative",
            aspectRatio: `${largura} / ${altura}`,
            height: "100%",
            width: "auto",
            maxWidth: "100%",
            maxHeight: "100%",
            background: corDoFundo(),
            boxShadow: "0 0 0 1px #28303f",
          }}
        >
          <Canvas
            shadows
            camera={CAMERA_INICIAL}
            style={{ position: "absolute", inset: 0 }}
          >
            {/* a camera casada escreve a cada render; a orbita a substitui */}
            {!opcoes.orbita && <CameraCasada cam={cam} altura={altura} />}
            <Orbita ativo={opcoes.orbita} />
            {opcoes.cenario && <MundoDoCenario3D semente={spec.seed} />}
            {opcoes.gizmos && (
              <Gizmos3D
                timeline={timeline}
                frame={frame}
                contato={opcoes.contato}
              />
            )}
          </Canvas>
          {mostrarCorpos && (
            <CamadaDeCorpos
              timeline={timeline}
              frame={frame}
              frameReal={frameReal}
              cam={cam}
              largura={largura}
              altura={altura}
              juntas={opcoes.juntas2D}
            />
          )}
        </div>
      </div>

      <Painel
        timeline={timeline}
        luta={luta}
        onLuta={setLuta}
        frameReal={frameReal}
        frame={frame}
        onFrame={irPara}
        onPasso={passoDeQuadro}
        cam={cam}
        fps={medidas.fps}
        delta={medidas.delta}
        opcoes={opcoes}
        onOpcoes={mudarOpcoes}
      />
    </div>
  );
};
