/**
 * PAINEL DE DEPURACAO E CONTROLES.
 *
 * Tudo que ele mostra e LIDO do motor no quadro atual -- nenhum numero e
 * guardado, estimado ou suavizado, tirando o FPS, que e media das ultimas
 * repinturas porque amostra unica de rAF oscila entre 48 e 72 sem nada estar
 * errado.
 *
 * O painel e DOM comum, nao SVG dentro da cena: ele nao pode participar do
 * enquadramento nem da camera, senao sumiria junto com a cena no primeiro
 * zoom e seria inutil justamente quando mais se precisa dele.
 */

import React from "react";
import { corpoNoQuadro } from "../../animation/corpo";
import type { EstadoCamera } from "../../camera/camera";
import type { FighterId, Timeline } from "../../core/types";
import { miraNoQuadro } from "./Gizmos3D";
import { LUTAS } from "./lutas";

export type Opcoes = {
  tocando: boolean;
  /** multiplicador de tempo: 0.25 para olhar um impacto quadro a quadro */
  velocidade: number;
  /** ossos e juntas em 3D */
  gizmos: boolean;
  /** aneis nas juntas dentro do SVG, para comparar com os gizmos 3D */
  juntas2D: boolean;
  /** ponto mirado, ponta do membro atacante e impacto registrado */
  contato: boolean;
  /** camera livre; desliga a camada 2D (ver Orbita.tsx) */
  orbita: boolean;
  /** desenha os corpos em SVG */
  corpos: boolean;
  /** desenha o cenario 3D (chao, blocos, neblina) */
  cenario: boolean;
};

const cor = {
  fundo: "#0d1118",
  caixa: "#151b26",
  borda: "#28303f",
  texto: "#c8d2e4",
  fraco: "#7b879c",
  aceso: "#7fd8a0",
  alerta: "#ffb84d",
  erro: "#ff6b81",
};

const Linha: React.FC<{ rotulo: string; valor: React.ReactNode }> = ({
  rotulo,
  valor,
}) => (
  <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
    <span style={{ color: cor.fraco }}>{rotulo}</span>
    <span style={{ textAlign: "right" }}>{valor}</span>
  </div>
);

const Secao: React.FC<{ titulo: string; children: React.ReactNode }> = ({
  titulo,
  children,
}) => (
  <div
    style={{
      background: cor.caixa,
      border: `1px solid ${cor.borda}`,
      borderRadius: 6,
      padding: "8px 10px",
      marginBottom: 8,
    }}
  >
    <div
      style={{
        color: cor.fraco,
        fontSize: 10,
        letterSpacing: 1.2,
        marginBottom: 6,
        textTransform: "uppercase",
      }}
    >
      {titulo}
    </div>
    {children}
  </div>
);

const Botao: React.FC<{
  children: React.ReactNode;
  onClick: () => void;
  aceso?: boolean;
  titulo?: string;
}> = ({ children, onClick, aceso = false, titulo }) => (
  <button
    type="button"
    onClick={onClick}
    title={titulo}
    style={{
      flex: 1,
      padding: "6px 4px",
      fontSize: 11,
      fontFamily: "inherit",
      cursor: "pointer",
      color: aceso ? "#0d1118" : cor.texto,
      background: aceso ? cor.aceso : "#1d2534",
      border: `1px solid ${aceso ? cor.aceso : cor.borda}`,
      borderRadius: 4,
    }}
  >
    {children}
  </button>
);

const Alternador: React.FC<{
  rotulo: string;
  ligado: boolean;
  onMudar: () => void;
  atalho?: string;
}> = ({ rotulo, ligado, onMudar, atalho }) => (
  <label
    style={{
      display: "flex",
      alignItems: "center",
      gap: 6,
      padding: "2px 0",
      cursor: "pointer",
    }}
  >
    <input type="checkbox" checked={ligado} onChange={onMudar} />
    <span style={{ flex: 1 }}>{rotulo}</span>
    {atalho && <span style={{ color: cor.fraco, fontSize: 10 }}>{atalho}</span>}
  </label>
);

export const Painel: React.FC<{
  timeline: Timeline;
  luta: string;
  onLuta: (nome: string) => void;
  /** quadro do laco, antes do hit stop */
  frameReal: number;
  /** quadro consultado, depois do hit stop */
  frame: number;
  /** salto no tempo sem mexer no play/pause: o scrub */
  onFrame: (q: number) => void;
  /** um quadro para tras ou para frente; implica pausar */
  onPasso: (delta: number) => void;
  cam: EstadoCamera;
  fps: number;
  delta: number;
  opcoes: Opcoes;
  onOpcoes: (mudanca: Partial<Opcoes>) => void;
}> = ({
  timeline,
  luta,
  onLuta,
  frameReal,
  frame,
  onFrame,
  onPasso,
  cam,
  fps,
  delta,
  opcoes,
  onOpcoes,
}) => {
  const dur = timeline.durationInFrames;
  const fpsDaLuta = timeline.spec.fps;
  const ids = [timeline.spec.fighterA, timeline.spec.fighterB] as FighterId[];
  const mira = miraNoQuadro(timeline, frame);
  const impacto = timeline.impacts.find((i) => i.frame === frame);
  const congelado = frame !== frameReal;

  /*
    O FPS E COMPARADO COM O fps DA LUTA, nao com 60 fixo. As lutas sao a 60,
    mas o numero vem do spec: se alguem escrever uma a 30, o painel nao passa
    a acusar folga de 100%.
  */
  const folga = fps > 0 ? fps / fpsDaLuta : 0;
  const corDoFps =
    folga >= 0.95 ? cor.aceso : folga >= 0.75 ? cor.alerta : cor.erro;

  return (
    <div
      style={{
        width: 330,
        flex: "0 0 330px",
        height: "100%",
        overflowY: "auto",
        background: cor.fundo,
        borderLeft: `1px solid ${cor.borda}`,
        color: cor.texto,
        font: "12px/1.5 ui-monospace, SFMono-Regular, Consolas, monospace",
        padding: 10,
        boxSizing: "border-box",
      }}
    >
      <Secao titulo="desempenho">
        <Linha
          rotulo="repinturas/s"
          valor={
            <span style={{ color: corDoFps }}>
              {fps.toFixed(1)} / {fpsDaLuta}
            </span>
          }
        />
        <Linha rotulo="delta" valor={`${delta.toFixed(1)} ms`} />
        <div style={{ color: cor.fraco, fontSize: 10, marginTop: 4 }}>
          medido nesta maquina, neste navegador, com estas opcoes ligadas. Nao
          e o custo do render do Remotion, que roda sem laco e sem orbita.
        </div>
      </Secao>

      <Secao titulo="luta">
        <select
          value={luta}
          onChange={(e) => onLuta(e.target.value)}
          style={{
            width: "100%",
            padding: 5,
            marginBottom: 6,
            fontFamily: "inherit",
            fontSize: 11,
            color: cor.texto,
            background: "#1d2534",
            border: `1px solid ${cor.borda}`,
            borderRadius: 4,
          }}
        >
          {Object.keys(LUTAS).map((n) => (
            <option key={n} value={n}>
              {n}
            </option>
          ))}
        </select>
        <Linha
          rotulo="lutadores"
          valor={`${timeline.spec.fighterA} vs ${timeline.spec.fighterB}`}
        />
        <Linha rotulo="semente" valor={timeline.spec.seed} />
        <Linha
          rotulo="duracao"
          valor={`${dur} q  (${(dur / fpsDaLuta).toFixed(2)} s)`}
        />
        <Linha rotulo="impactos" valor={timeline.impacts.length} />
        <Linha rotulo="miras" valor={timeline.aims.length} />
      </Secao>

      <Secao titulo="tempo">
        <Linha
          rotulo="quadro real"
          valor={`${frameReal} / ${dur - 1}`}
        />
        <Linha
          rotulo="quadro da timeline"
          valor={
            <span style={{ color: congelado ? cor.alerta : cor.texto }}>
              {frame}
              {congelado ? "  (hit stop)" : ""}
            </span>
          }
        />
        <Linha
          rotulo="tempo"
          valor={`${(frameReal / fpsDaLuta).toFixed(3)} s`}
        />
        <input
          type="range"
          min={0}
          max={Math.max(0, dur - 1)}
          step={1}
          value={frameReal}
          onChange={(e) => onFrame(Number(e.target.value))}
          style={{ width: "100%", marginTop: 6 }}
        />
        <div style={{ display: "flex", gap: 4, marginTop: 6 }}>
          <Botao onClick={() => onPasso(-1)} titulo="um quadro atras (seta esquerda)">
            {"<"}
          </Botao>
          <Botao
            aceso={opcoes.tocando}
            onClick={() => onOpcoes({ tocando: !opcoes.tocando })}
            titulo="espaco"
          >
            {opcoes.tocando ? "pausar" : "tocar"}
          </Botao>
          <Botao onClick={() => onPasso(1)} titulo="um quadro a frente (seta direita)">
            {">"}
          </Botao>
        </div>
        <div style={{ display: "flex", gap: 4, marginTop: 4 }}>
          {[0.1, 0.25, 0.5, 1].map((v) => (
            <Botao
              key={v}
              aceso={opcoes.velocidade === v}
              onClick={() => onOpcoes({ velocidade: v, tocando: true })}
            >
              {v}x
            </Botao>
          ))}
        </div>
      </Secao>

      <Secao titulo="camera">
        <Linha
          rotulo="centro"
          valor={`${cam.center.x.toFixed(0)}, ${cam.center.y.toFixed(0)}`}
        />
        <Linha rotulo="zoom" valor={cam.zoom.toFixed(4)} />
        <Linha
          rotulo="tremor"
          valor={`${cam.shake.x.toFixed(1)}, ${cam.shake.y.toFixed(1)}`}
        />
        {opcoes.orbita && (
          <div style={{ color: cor.alerta, fontSize: 10, marginTop: 4 }}>
            CAMERA LIVRE: a camera deixou de concordar com o SVG, entao a
            camada de corpos 2D esta escondida. Arraste para girar, roda para
            aproximar, botao do meio para deslocar.
          </div>
        )}
      </Secao>

      {ids.map((id) => {
        const c = corpoNoQuadro(timeline, id, frame);
        return (
          <Secao key={id} titulo={`lutador ${id}`}>
            <Linha
              rotulo="pose"
              valor={<span style={{ color: cor.aceso }}>{c.poseNome}</span>}
            />
            <Linha
              rotulo="x, z"
              valor={`${c.x.toFixed(1)}, ${c.z.toFixed(1)}`}
            />
            <Linha rotulo="baseY" valor={c.baseY.toFixed(1)} />
            <Linha
              rotulo="facing / giro"
              valor={`${c.facing} / ${c.giro.toFixed(2)}`}
            />
            <Linha rotulo="spin" valor={`${c.spin.toFixed(1)} deg`} />
            <Linha rotulo="escala" valor={c.scale.toFixed(3)} />
            <Linha
              rotulo="velocidade"
              valor={`${c.velocidade.toFixed(2)} u/q`}
            />
            <Linha rotulo="aceleracao" valor={c.aceleracao.toFixed(2)} />
            <Linha rotulo="agachamento" valor={c.agachamento.toFixed(1)} />
            <Linha
              rotulo="no ar"
              valor={
                <span style={{ color: c.noAr ? cor.alerta : cor.fraco }}>
                  {c.noAr ? "sim" : "nao"}
                </span>
              }
            />
            <Linha
              rotulo="erro do IK"
              valor={
                <span
                  style={{
                    color: c.alcancou
                      ? c.correcaoDaMira > 0
                        ? cor.texto
                        : cor.fraco
                      : cor.erro,
                  }}
                >
                  {c.correcaoDaMira.toFixed(1)}
                  {c.alcancou ? "" : "  FORA DE ALCANCE"}
                </span>
              }
            />
          </Secao>
        );
      })}

      <Secao titulo="contato neste quadro">
        <Linha rotulo="mira" valor={mira ?? <span style={{ color: cor.fraco }}>—</span>} />
        <Linha
          rotulo="impacto"
          valor={
            impacto ? (
              <span style={{ color: cor.erro }}>
                {impacto.tier}
                {impacto.bloqueado ? " bloq" : ""} hs{impacto.hitStop}
              </span>
            ) : (
              <span style={{ color: cor.fraco }}>—</span>
            )
          }
        />
      </Secao>

      <Secao titulo="o que desenhar">
        <Alternador
          rotulo="ossos e juntas em 3D"
          ligado={opcoes.gizmos}
          onMudar={() => onOpcoes({ gizmos: !opcoes.gizmos })}
          atalho="g"
        />
        <Alternador
          rotulo="juntas no SVG (comparar)"
          ligado={opcoes.juntas2D}
          onMudar={() => onOpcoes({ juntas2D: !opcoes.juntas2D })}
          atalho="j"
        />
        <Alternador
          rotulo="pontos de contato"
          ligado={opcoes.contato}
          onMudar={() => onOpcoes({ contato: !opcoes.contato })}
          atalho="c"
        />
        <Alternador
          rotulo="corpos em SVG"
          ligado={opcoes.corpos}
          onMudar={() => onOpcoes({ corpos: !opcoes.corpos })}
          atalho="b"
        />
        <Alternador
          rotulo="cenario 3D"
          ligado={opcoes.cenario}
          onMudar={() => onOpcoes({ cenario: !opcoes.cenario })}
          atalho="e"
        />
        <Alternador
          rotulo="camera livre (orbita)"
          ligado={opcoes.orbita}
          onMudar={() => onOpcoes({ orbita: !opcoes.orbita })}
          atalho="o"
        />
      </Secao>

      <Secao titulo="o que esta pagina nao desenha">
        <div style={{ color: cor.fraco, fontSize: 10 }}>
          efeitos, poderes, katana, placas, placar e marca d&apos;agua. Eles
          moram no <code>FightScene</code> e no <code>Prototype</code>, que
          exigem o contexto do Remotion. Para ver a cena COMPLETA, abra a
          composicao <code>Arena3D</code> no studio.
        </div>
      </Secao>
    </div>
  );
};
