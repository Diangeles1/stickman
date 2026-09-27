/**
 * Cena de luta: junta camera, cenario, lutadores e efeitos num quadro.
 *
 * Este componente NAO sabe qual luta esta desenhando. Recebe uma Timeline e
 * desenha o quadro atual. Trocar a luta e trocar os dados, nao o codigo.
 *
 * Ordem das camadas, de tras para frente: fundo, arena, poeira, aura, lutadores,
 * particulas, ondas de choque, e por fim o flash, que e o unico que fica FORA
 * da camera porque cobre a tela e nao o mundo.
 */

import React from "react";
import { useCurrentFrame, useVideoConfig } from "remotion";
import { corpoNoQuadro, juntasDoCorpo } from "../animation/corpo";
import {
  poseDeContato,
  quadroEfetivo,
  tremorDoHitStop,
} from "../animation/sampler";
import { Arena } from "../backgrounds/Arena";
import { Rabisco } from "../backgrounds/Rabisco";
import {
  cameraNoQuadro,
  enquadrarDois,
  transformDaCamera,
} from "../camera/camera";
import { PRESETS } from "../characters/presets";
import { ALTURA_QUADRIL, OSSOS } from "../characters/skeleton";
import { Stickman, StickmanSmear, StickmanTrail } from "../characters/Stickman";
import {
  Aura,
  Clarao,
  Flash,
  LinhasDeVelocidade,
  Ondas,
  Particulas,
} from "../effects/Impact";
import { ArcoDoGolpe } from "../effects/Arco";
import { espetaculoDe } from "../effects/espetaculo";
import { EstrelaDeImpacto, PoeiraDaQueda } from "../effects/Queda";
import { Placa } from "../effects/Placa";
import { ArcoDaKatana, Katana } from "../characters/Katana";
import { CorpoDividido } from "../effects/Divisao";
import { CamadaDePoderes, laminaInteira, PoderesNaTela } from "../effects/Poderes";
import { CeuNoturno, Chuva } from "../backgrounds/Noite";
import { CeuDeMetropole, RuaMolhada } from "../backgrounds/Metropole";
import { CeuDoVale, ChaoDoVale, PoeiraDoVale } from "../backgrounds/Vale";
import { DebugOverlay } from "../debug/DebugOverlay";
import { poeiraAmbiente } from "../particles/particles";
import type { Timeline } from "../core/types";

export type FightSceneProps = {
  timeline: Timeline;
  /** liga o overlay de medicao (punho, alvo, distancia). Desligado no render final. */
  debug?: boolean;
  /** so os corpos: sem efeitos, sem tremor, camera neutra (ver Prototype) */
  semEfeitos?: boolean;
};

/** Enquadramento inicial, usado antes da primeira chave de camera. */
const CAMERA_PADRAO = {
  center: { x: 0, y: -ALTURA_QUADRIL - 120 },
  // 0.62 deixava o corpo com 19% da altura da tela, pequeno demais para
  // Shorts. Em 0.95 ele ocupa ~30%, que e onde a acao se le no celular.
  zoom: 0.95,
};

/**
 * Acima desta velocidade (unidades por quadro) aparecem linhas de velocidade.
 *
 * Medida a distribuicao de velocidade dos dois corpos nos 3026 quadros do
 * episodio (cada corpo, cada quadro):
 *
 *   p50  0.0     p90   6.4     p97  18.7
 *   p80  2.5     p95  14.4     p99  28.1
 *
 * E a fracao de quadros que cada limiar acende:
 *
 *   26 -> 1.3%    22 -> 1.8%    18 -> 3.5%    14 -> 5.2%
 *
 * A 26 as linhas apareciam em um quadro e meio a cada cem: o recurso existia
 * no motor e praticamente nao acontecia no video. A 14 elas acendem em 5% dos
 * quadros -- os picos de acao, nao o andar (p80 = 2.5, muito abaixo). O medo
 * de "borrao permanente" so valeria se o limiar caisse perto da mediana.
 */
const LIMITE_LINHAS = 14;

/**
 * RASTRO FANTASMA: copias esmaecidas dos quadros anteriores.
 *
 * E a assinatura do estilo pedido. Medido no projeto de referencia do autor,
 * e o que comunica velocidade sem precisar de mais quadros de animacao: o
 * corpo rapido deixa um traco do caminho que percorreu.
 *
 * Aparece so acima de uma velocidade alta, senao vira borrao permanente.
 *
 * A 34 ele acendia em 0.4% dos quadros: 12 de 3026 no episodio inteiro. A
 * assinatura do estilo estava efetivamente desligada -- o codigo existia e o
 * espectador nunca via. A 18 acende em 3.5%, que sao os deslocamentos de
 * verdade (knockback, arremesso, corrida), e continua bem acima do p90 (6.4),
 * entao andar e trocar golpe parado seguem sem rastro.
 */
const LIMITE_RASTRO = 18;
/**
 * Acima DESTA velocidade o corpo deixa de ser desenhado como copias e passa a
 * ser um BORRAO CONTINUO (ver characters/Stickman, StickmanSmear).
 *
 * Reservado para os picos de verdade. Na referencia de stickman o smear
 * aparece nos poucos quadros em que o personagem atravessa a tela; usar em
 * tudo que passa do limiar do rastro transformaria a luta inteira em mancha.
 */
const LIMITE_SMEAR = 30;
/**
 * Quantos quadros atras entram no rastro. Seis em vez de quatro: com o passo
 * de 2 quadros, o rastro cobre 12 quadros de caminho em vez de 8, e um corpo
 * atravessando a arena deixa um traco que chega a ter comprimento.
 */
const QUADROS_DO_RASTRO = 6;
/** de quantos em quantos quadros, para o rastro ter espacamento visivel */
const PASSO_DO_RASTRO = 2;

export const FightScene: React.FC<FightSceneProps> = ({
  timeline,
  debug = false,
  semEfeitos = false,
}) => {
  const frameReal = useCurrentFrame();
  const { width, height, fps } = useVideoConfig();

  // hit stop: durante os quadros de impacto o tempo PARA, e e isso que faz o
  // golpe pesar. A timeline continua intacta; so o quadro consultado congela.
  const frame = quadroEfetivo(timeline, frameReal);

  const cam = semEfeitos
    ? {
        ...enquadrarDois(timeline, frame, width, -ALTURA_QUADRIL),
        shake: { x: 0, y: 0 },
      }
    : cameraNoQuadro(timeline, frame, CAMERA_PADRAO, {
        largura: width,
        alturaQuadril: -ALTURA_QUADRIL,
      });
  const fx = !semEfeitos;
  const { fighterA, fighterB, seed, scenario } = timeline.spec;
  const metropole = scenario === "metropole";
  const vale = scenario === "vale";
  // os cenarios de rabisco sao o limpo com desenho no fundo
  const limpo =
    scenario !== "arena" && scenario !== "noite" && !metropole && !vale;
  // a metropole compartilha a chuva e o piso escuro com a noite
  // o vale tambem e noturno: ceu escuro e o mesmo tratamento de contraste
  const noite = scenario === "noite" || metropole || vale;
  const espetaculo = fx ? espetaculoDe(timeline) : null;

  // QUADRO DE IMPACTO (anime): nos golpes mais fortes, um ou dois quadros
  // em alto contraste puro, fundo e corpos chapados, com linhas de foco no
  // ponto do golpe. Alterna escuro/claro; o finalizador pisca cinco vezes.
  const anime = espetaculo?.impactosAnime.find(
    (a) => frameReal >= a.real && frameReal < a.real + a.quadros,
  );
  /*
    QUADRO DE IMPACTO: a tela inteira vira abstracao por um instante.
    E a assinatura da animacao de stickman -- em referencia da web ele aparece
    como um quadro CHAPADO com linhas radiais, sem cenario e sem personagem.

    DURACAO. Era de 2 quadros reais (33 ms) para impacto forte. A convencao do
    genero segura de 2 a 4 desenhos a 12 fps, ou seja 167 a 333 ms: estavamos
    de cinco a dez vezes curtos, e o recurso existia sem ser visto. Agora sao
    8 quadros (133 ms) no forte e 14 (233 ms) no finalizador.

    A INVERSAO PRECISOU DESACELERAR JUNTO, e isso e seguranca e nao estetica.
    Ela trocava preto e branco a CADA quadro: a 60 fps sao 30 Hz de tela cheia
    em contraste maximo. Em 2 quadros isso e um piscar unico e inofensivo; em
    14 vira exatamente o padrao que dispara crise fotossensitiva (o limite
    aceito e 3 Hz). Com a troca a cada 5 quadros o impacto inverte no maximo
    duas vezes -- abaixo de 3 Hz, e mais perto da referencia, que e um quadro
    SEGURADO e nao um tremeluzir.
  */
  const QUADROS_POR_POLARIDADE = 5;
  const modoAnime = anime
    ? Math.floor((frameReal - anime.real) / QUADROS_POR_POLARIDADE) % 2 === 0
      ? { fundo: "#ffffff", figura: "#000000" }
      : { fundo: "#000000", figura: "#ffffff" }
    : null;

  // rachaduras abertas pelos impactos que JA aconteceram neste quadro: elas
  // sao consequencia da acao, nao desenho permanente do cenario
  const rachaduras = timeline.impacts
    .filter((i) => i.cracksGround && i.frame <= frame)
    .map((i) => i.at.x);

  const poeira = React.useMemo(
    () => poeiraAmbiente(seed, frame, fps),
    [seed, frame, fps],
  );

  /** Forca da aura de um lutador neste quadro, vinda dos beats de powerUp. */
  const auraDe = (id: string): number => {
    let forca = 0;
    for (const s of timeline.scheduled) {
      if (s.beat.type !== "powerUp" || s.beat.who !== id) continue;
      if (frame < s.from) continue;
      // sobe durante o beat e se mantem depois: a aura ficou ligada
      const subida = Math.min(1, (frame - s.from) / Math.max(1, s.to - s.from));
      forca = Math.max(forca, subida);
    }
    return forca;
  };

  // Estado dos dois lutadores neste quadro, resolvido UMA vez. As camadas de
  // tras (aura, linhas) e a da frente (corpos) leem daqui, entao nao existe a
  // possibilidade de uma camada discordar da outra.
  const lutadores = [fighterA, fighterB].map((id) => {
    const corpo = corpoNoQuadro(timeline, id, frame);
    return {
      id,
      corpo,
      preset: PRESETS[id],
      // Em pose de contato (golpe dado ou recebido) nao ha linha de
      // velocidade: ela sujava justamente os quadros em que o corpo precisa
      // ser lido. No knockback ela continua, que e onde ela ganha o seu
      // salario.
      rapido:
        Math.abs(corpo.velocidade) > LIMITE_LINHAS &&
        !poseDeContato(corpo.poseNome),
      // o rastro le do MESMO corpoNoQuadro, entao ele mostra exatamente onde
      // o personagem esteve, e nao uma aproximacao
      rastro:
        Math.abs(corpo.velocidade) > LIMITE_RASTRO
          ? Array.from({ length: QUADROS_DO_RASTRO }, (_, k) => {
              const atras = (QUADROS_DO_RASTRO - k) * PASSO_DO_RASTRO;
              const c = corpoNoQuadro(timeline, id, frame - atras);
              return {
                pose: c.pose,
                baseX: c.x,
                baseY: c.baseY,
                spin: c.spin,
                giro: c.giro,
              };
            })
          : [],
      // so o DESENHO vibra: a mira e a camera continuam no corpo parado
      tremor: tremorDoHitStop(timeline, frameReal, id),
    };
  });

  // poderes: gelo, fogo, sangue, feixes (effects/Poderes.tsx)
  const poderesAtivos = fx && timeline.poderes.length > 0;
  const corpos = Object.fromEntries(lutadores.map((l) => [l.id, l.corpo]));
  const xDe = (id: string, q: number) => corpoNoQuadro(timeline, id as never, q).x;
  const chuvaCongelada = timeline.poderes.find(
    (e) => e.tipo === "chuvaCongelada" && frame >= e.from && frame <= e.to,
  );

  if (anime && modoAnime) {
    return (
      <svg
        width={width}
        height={height}
        viewBox={`0 0 ${width} ${height}`}
        style={{ background: modoAnime.fundo }}
      >
        <rect width={width} height={height} fill={modoAnime.fundo} />
        <g transform={transformDaCamera(cam, width, height)}>
          <EstrelaDeImpacto
            at={anime.at}
            cor={modoAnime.figura}
            semente={anime.real}
          />
          {lutadores.map(({ id, corpo, preset, tremor }) => (
            <Stickman
              key={id}
              preset={{ ...preset, stroke: modoAnime.figura }}
              pose={corpo.pose}
              baseX={corpo.x + tremor}
              baseY={corpo.baseY}
              facing={corpo.facing}
              scaleExtra={corpo.scale / preset.scale}
              spin={corpo.spin}
              giro={corpo.giro}
              contorno={false}
            />
          ))}
        </g>
      </svg>
    );
  }

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      style={{ background: limpo ? "#ffffff" : "#06070a" }}
    >
      <defs>
        <linearGradient id="ceu" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={noite ? "#070b1c" : "#050609"} />
          <stop offset="100%" stopColor={noite ? "#1a2442" : "#0d0f15"} />
        </linearGradient>
      </defs>
      <rect
        width={width}
        height={height}
        fill={limpo ? "#ffffff" : "url(#ceu)"}
      />

      <g transform={transformDaCamera(cam, width, height)}>
        {(scenario === "vilarejo" || scenario === "cidade") && (
          <Rabisco
            seed={seed}
            tema={scenario}
            camX={cam.center.x}
            frame={frameReal}
          />
        )}
        {vale && (
          <>
            <CeuDoVale camX={cam.center.x} />
            <ChaoDoVale camX={cam.center.x} />
          </>
        )}
        {noite && !metropole && !vale && <CeuNoturno camX={cam.center.x} />}
        {metropole && (
          <>
            <CeuDeMetropole camX={cam.center.x} />
            <RuaMolhada camX={cam.center.x} />
          </>
        )}
        {/* o vale tem piso proprio: a arena por cima cobriria a terra */}
        {!vale && (
          <Arena
            seed={seed}
            rachaduras={rachaduras}
            cenario={limpo ? "limpo" : "arena"}
          />
        )}
        {(scenario === "vilarejo" || scenario === "cidade") && (
          <Rabisco
            seed={seed}
            tema={scenario}
            camX={cam.center.x}
            frame={frameReal}
            parte="chao"
          />
        )}
        {poderesAtivos && (
          <CamadaDePoderes timeline={timeline} frame={frame} parte="chao" corpos={corpos} xDe={xDe} />
        )}

        {/* poeira no ar: o cenario respira mesmo quando ninguem se move.
            No cenario limpo ela sai: nada deve competir com a silhueta. */}
        <g data-layer="ambient-dust">
          {limpo || !fx
            ? null
            : poeira.map((p, i) => (
                <circle
                  key={i}
                  cx={p.pos.x}
                  cy={p.pos.y}
                  r={p.raio}
                  fill="#9aa4bb"
                  opacity={p.opacidade}
                />
              ))}
        </g>

        {/*
          Onda de choque e clarao vao ATRAS dos lutadores. Na frente eles
          cobriam exatamente o punho e o peito, que sao as duas coisas que o
          espectador precisa ver no quadro do golpe: o traco da onda passava
          por cima do corpo e clareava o vermelho. Atras, recortam a silhueta
          dos dois contra a luz, que e o efeito que se quer.

          So as PARTICULAS ficam na frente: estilhaco voando na frente do
          corpo e correto, e sao poucos e pequenos.
        */}
        {espetaculo && (
          <PoeiraDaQueda
            quedas={espetaculo.quedas}
            frame={frame}
            cor={limpo ? "#b8b1a4" : "#8d96ab"}
          />
        )}
        {fx && <Ondas impactos={timeline.impacts} frame={frame} />}
        {fx && <Clarao impactos={timeline.impacts} frame={frame} />}

        {/* aura e linhas de velocidade FICAM ATRAS dos dois corpos. A linha de
            velocidade do lutador empurrado atravessava o peito do outro, e no
            quadro do golpe isso vira sujeira em cima da acao. */}
        {fx && (
          <g data-layer="atras-dos-corpos">
            {poderesAtivos && (
              <CamadaDePoderes timeline={timeline} frame={frame} parte="atras" corpos={corpos} xDe={xDe} />
            )}
            {lutadores.map(({ id, corpo, preset, rapido, rastro }) => (
              <g key={`tras-${id}`}>
                {/*
                  O arco sai na cor da AURA, nao na do corpo.

                  Com preset.stroke ele era um rastro da mesma cor do
                  personagem, desenhado ATRAS dele e a 42% -- sobre fundo
                  escuro isso e invisivel, e a parte mais importante (junto do
                  membro) ainda ficava coberta pelo proprio corpo. O smear
                  existia no codigo e nao existia na tela.

                  A cor da aura e clara e saturada em todos os presets, entao
                  o caminho do golpe se le sem competir com a silhueta: o
                  corpo continua sendo a forma, o arco e a velocidade.
                */}
                <ArcoDoGolpe
                  timeline={timeline}
                  frame={frame}
                  id={id}
                  cor={preset.auraColor}
                  largura={preset.limbWidth * preset.scale * 1.15}
                  opacidade={limpo ? 0.5 : 0.75}
                />
                {/*
                  Um OU outro, nunca os dois: copias soltas por baixo de um
                  borrao continuo sujam a forma que o borrao existe para ter.
                */}
                {rastro.length > 0 &&
                  (Math.abs(corpo.velocidade) > LIMITE_SMEAR ? (
                    <StickmanSmear
                      preset={preset}
                      quadros={[
                        ...rastro,
                        { pose: corpo.pose, baseX: corpo.x, baseY: corpo.baseY, spin: corpo.spin, giro: corpo.giro },
                      ]}
                      facing={corpo.facing}
                      forca={limpo ? 0.6 : 0.45}
                    />
                  ) : (
                    <StickmanTrail
                      preset={preset}
                      quadros={rastro}
                      facing={corpo.facing}
                      forca={limpo ? 0.34 : 0.22}
                    />
                  ))}
                {auraDe(id) > 0.02 && (
                  <Aura
                    centro={{ x: corpo.x, y: corpo.baseY }}
                    cor={preset.auraColor}
                    forca={auraDe(id)}
                    frame={frame}
                  />
                )}
                {rapido && (
                  <LinhasDeVelocidade
                    origem={{ x: corpo.x, y: corpo.baseY }}
                    direcao={Math.sign(corpo.velocidade)}
                    forca={Math.min(
                      1,
                      (Math.abs(corpo.velocidade) - LIMITE_LINHAS) / 60,
                    )}
                    seed={seed}
                    chave={`sl-${id}-${Math.round(frame / 3)}`}
                  />
                )}
              </g>
            ))}
          </g>
        )}

        {/* a placa do vencedor fica ATRAS do corpo: sai de tras da cabeca */}
        <Placa timeline={timeline} frame={frame} lutadores={lutadores} />

        {/* rastro do corte da katana: atras dos corpos, como o arco do golpe */}
        {fx &&
          lutadores.map(({ id }) => {
            const arma = timeline.spec.armas?.[id];
            return arma ? (
              <ArcoDaKatana key={`arco-k-${id}`} timeline={timeline} frame={frame} id={id} elemento={arma.elemento} />
            ) : null;
          })}

        {lutadores.map(({ id, corpo, preset, tremor }) => {
          const desenhar = () => (
            <Stickman
              preset={preset}
              pose={corpo.pose}
              baseX={corpo.x + (fx ? tremor : 0)}
              baseY={corpo.baseY}
              facing={corpo.facing}
              scaleExtra={corpo.scale / preset.scale}
              spin={corpo.spin}
              giro={corpo.giro}
              // secondary action: o cabelo atrasa em relacao a cabeca
              velocidade={corpo.velocidade}
              contorno={!limpo}
            />
          );
          /*
            CORTADO AO MEIO. O corpo continua sendo o mesmo desenho; o que
            muda e que ele passa a ser recortado em duas metades que se
            afastam (ver effects/Divisao). Por isso isto e um envelope e nao
            um caminho separado de render: nada aqui sabe desenhar um corpo.
          */
          const corte = fx
            ? timeline.poderes.find(
                (e) => e.tipo === "divisao" && e.quem === id && frame >= e.from,
              )
            : undefined;
          if (!corte) return <g key={id}>{desenhar()}</g>;
          const ponto = {
            x: corpo.x,
            y: corpo.baseY + (corte.a?.y ?? ALTURA_QUADRIL * 0.55),
          };
          const angulo = corte.dir ?? 68;
          /*
            ATE ONDE VAI A FAIXA DO CORTE. Cada junta e projetada na direcao
            do corte; o maior valor absoluto diz onde o corpo acaba naquele
            eixo. Mais meia espessura de membro, porque a junta e o EIXO do
            osso e o desenho tem largura em volta dele.

            Medir em vez de estimar importa aqui: faixa curta deixa o corpo
            aberto sem ferida nas pontas, e faixa longa aparece como um risco
            vermelho saindo da cabeca e do chao.
          */
          const rad = (angulo * Math.PI) / 180;
          const juntas = juntasDoCorpo(corpo);
          let extensao = 0;
          for (const j of Object.values(juntas)) {
            const proj = Math.abs(
              (j.x - ponto.x) * Math.cos(rad) + (j.y - ponto.y) * Math.sin(rad),
            );
            if (proj > extensao) extensao = proj;
          }
          extensao += (preset.limbWidth * preset.scale) / 2;
          /*
            A SILHUETA CHAPADA: os mesmos ossos, em branco, sem nada dentro.
            E so ela que a faixa do corte precisa como mascara, e por ser
            simples ela nao esbarra no limite de mascara aninhada.
          */
          const larguraOsso = preset.limbWidth * preset.scale * (corpo.scale / preset.scale);
          const silhueta = () => (
            <g stroke="#ffffff" fill="#ffffff" strokeLinecap="round">
              {OSSOS.map(([de, para]) => (
                <line
                  key={`${de}-${para}`}
                  x1={juntas[de].x}
                  y1={juntas[de].y}
                  x2={juntas[para].x}
                  y2={juntas[para].y}
                  strokeWidth={larguraOsso}
                />
              ))}
              <circle
                cx={juntas.head.x}
                cy={juntas.head.y}
                r={preset.headRadius * corpo.scale}
              />
            </g>
          );
          return (
            <CorpoDividido
              key={id}
              id={id}
              corte={ponto}
              angulo={angulo}
              progresso={(frame - corte.from) / Math.max(1, corte.to - corte.from)}
              afastamento={corte.forca ?? 130}
              extensao={extensao}
              desenhar={desenhar}
              silhueta={silhueta}
            />
          );
        })}

        {/* katanas: na frente do corpo, presas a mao da frente */}
        {lutadores.map(({ id, corpo, tremor }) => {
          const arma = timeline.spec.armas?.[id];
          return arma ? (
            <Katana
              key={`katana-${id}`}
              corpo={{ ...corpo, x: corpo.x + (fx ? tremor : 0) }}
              elemento={arma.elemento}
              frame={frameReal}
              inteira={laminaInteira(timeline, id, frame)}
            />
          ) : null;
        })}

        {fx && (
          <Particulas
            impactos={timeline.impacts}
            frame={frame}
            seed={seed}
            fps={fps}
          />
        )}

        {poderesAtivos && (
          <CamadaDePoderes timeline={timeline} frame={frame} parte="frente" corpos={corpos} xDe={xDe} />
        )}

        {debug && <DebugOverlay timeline={timeline} frame={frame} />}
      </g>

      {/*
        POEIRA DO VALE em vez de chuva. Um vale de terra rachada com chuva
        caindo conta duas historias diferentes ao mesmo tempo.
      */}
      {vale && (
        <PoeiraDoVale
          camX={cam.center.x}
          frame={frameReal}
          largura={width}
          altura={height}
        />
      )}
      {noite && !vale && (
        <Chuva
          frame={frameReal}
          largura={width}
          altura={height}
          congelada={chuvaCongelada ? 1 : 0}
          quadroDoCongelamento={chuvaCongelada?.from ?? 0}
        />
      )}
      {poderesAtivos && (
        <PoderesNaTela timeline={timeline} frame={frame} largura={width} altura={height} />
      )}

      {/* o flash cobre a TELA, nao o mundo: fica fora do grupo da camera */}
      {fx && (
        <Flash
          impactos={timeline.impacts}
          frame={frame}
          largura={width}
          altura={height}
        />
      )}
    </svg>
  );
};
