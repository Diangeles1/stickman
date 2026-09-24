/**
 * Compilador de timeline: FightSpec (dados) -> Timeline (quadros resolvidos).
 *
 * E o coracao do motor. Roda UMA vez, fora do render, e produz tudo que os
 * componentes precisam para desenhar o quadro N sem guardar estado. Isso e o
 * que satisfaz a exigencia de determinismo do Remotion e, ao mesmo tempo, o
 * que permite descrever uma luta por JSON.
 *
 * Fluxo: beats -> para cada beat, avanca o cursor de quadros, escreve
 * quadros-chave nas trilhas dos lutadores, e emite impactos, camera e slow
 * motion. Quem desenha depois so interpola entre chaves.
 */

import { ATAQUES, escalaDuracao } from "../attacks/registry";
import { PRESETS } from "../characters/presets";
import { ALTURA_QUADRIL as ALTURA_DO_ESQUELETO, ESCALA_POSE } from "../characters/skeleton";
import type {
  AttackName,
  CameraKey,
  FightSpec,
  FighterId,
  FighterTrack,
  ImpactEvent,
  PoseName,
  ScheduledBeat,
  Timeline,
} from "./types";

/**
 * Distancia entre os dois na hora do golpe.
 *
 * DERIVADA do alcance real do braco, nao um numero solto. A primeira versao
 * usava 190, escrito em unidades de pose (antes da ESCALA_POSE), e no mundo
 * isso punha os dois SE SOBREPONDO: a luta parecia dois caras andando juntos.
 * O 1,8 e a folga para o golpe encostar sem atravessar o outro corpo.
 */
const ALCANCE_DA_MAO = 104 * ESCALA_POSE;
const ALCANCE = Math.round(ALCANCE_DA_MAO * 1.8);

/**
 * Altura do quadril, em coordenada de mundo (negativo = acima do chao).
 * Vem do esqueleto para nao existirem dois valores que possam divergir: foi
 * exatamente esse tipo de duplicacao que deixou o boneco flutuando antes.
 */
export const ALTURA_QUADRIL = -ALTURA_DO_ESQUELETO;

type Estado = {
  x: number;
  pose: PoseName;
  airborne: boolean;
};

export const compilar = (spec: FightSpec): Timeline => {
  const A = spec.fighterA;
  const B = spec.fighterB;
  const preset = { [A]: PRESETS[A], [B]: PRESETS[B] } as Record<FighterId, typeof PRESETS[FighterId]>;

  const tracks: Record<string, FighterTrack> = {
    [A]: { id: A, keys: [] },
    [B]: { id: B, keys: [] },
  };
  const estado: Record<string, Estado> = {
    [A]: { x: -520, pose: "idle", airborne: false },
    [B]: { x: 520, pose: "idle", airborne: false },
  };

  const scheduled: ScheduledBeat[] = [];
  const impacts: ImpactEvent[] = [];
  const cameraKeys: CameraKey[] = [];
  const slowMo: Timeline["slowMo"] = [];

  let cursor = 0;

  const chave = (quem: FighterId, frame: number) => {
    const e = estado[quem];
    tracks[quem].keys.push({ frame, x: e.x, pose: e.pose, airborne: e.airborne });
  };

  // ambos comecam registrados, senao a interpolacao nao tem de onde partir
  chave(A, 0);
  chave(B, 0);

  const oposto = (quem: FighterId): FighterId => (quem === A ? B : A);

  /** Coloca atacante e alvo a distancia de golpe, sem teletransporte brusco. */
  const aproximar = (atacante: FighterId, alvo: FighterId) => {
    const lado = estado[atacante].x <= estado[alvo].x ? -1 : 1;
    estado[atacante].x = estado[alvo].x + lado * ALCANCE;
  };

  const duracaoDe = (quem: FighterId, move: AttackName) => {
    const a = ATAQUES[move];
    const k = escalaDuracao(preset[quem].profile.speed, spec.intensity);
    return {
      windup: Math.max(2, Math.round(a.windup * k)),
      strike: Math.max(2, Math.round(a.strike * k)),
      recover: Math.max(2, Math.round(a.recover * k)),
      contactAt: Math.max(1, Math.round(a.contactAt * k)),
      def: a,
    };
  };

  /** Um golpe completo: preparacao, disparo, contato com consequencia, volta. */
  const golpear = (
    atacante: FighterId,
    alvo: FighterId,
    move: AttackName,
    opcoes: { bloqueado?: boolean; finalizador?: boolean } = {},
  ) => {
    const { windup, strike, recover, contactAt, def } = duracaoDe(atacante, move);
    aproximar(atacante, alvo);

    // preparacao: carrega e a camera aproxima nos golpes fortes
    estado[atacante].pose = "guard";
    chave(atacante, cursor);
    if (def.tier === "extreme") {
      cameraKeys.push({
        frame: cursor,
        center: { x: (estado[atacante].x + estado[alvo].x) / 2, y: ALTURA_QUADRIL - 40 },
        zoom: opcoes.finalizador ? 1.7 : 1.35,
        ease: windup,
      });
      if (opcoes.finalizador) {
        // o ritmo cai antes do estouro: e o contraste que da forca
        slowMo.push({ from: cursor, to: cursor + windup, factor: 0.45 });
      }
    }
    cursor += windup;

    // disparo
    estado[atacante].pose = def.pose;
    chave(atacante, cursor);

    const frameContato = cursor + contactAt;
    const direcao = estado[atacante].x <= estado[alvo].x ? 1 : -1;

    if (opcoes.bloqueado) {
      estado[alvo].pose = "block";
      chave(alvo, frameContato - 2);
      impacts.push({
        frame: frameContato,
        at: { x: estado[alvo].x - direcao * 70, y: ALTURA_QUADRIL - 90 },
        // bloqueio nao e golpe limpo: um degrau abaixo na intensidade
        tier: def.tier === "extreme" ? "medium" : "light",
        direction: direcao,
        hitStop: Math.max(1, Math.round(def.hitStop * 0.6)),
        cracksGround: false,
        sound: "block",
      });
    } else {
      impacts.push({
        frame: frameContato,
        at: { x: estado[alvo].x - direcao * 60, y: ALTURA_QUADRIL - 80 },
        tier: def.tier,
        direction: direcao,
        hitStop: def.hitStop,
        cracksGround: Boolean(def.cracksGround),
        sound: def.sound,
      });
      // reacao do alvo: recua e, em golpe que lanca, sobe
      estado[alvo].pose = def.launches ? "airborne" : "knockback";
      estado[alvo].airborne = Boolean(def.launches);
      chave(alvo, frameContato);
      // knockback em unidades de MUNDO. Dividir por 60 (como se fosse por
      // segundo) dava ~5 unidades de recuo, imperceptivel numa figura de
      // 597 unidades de altura.
      const empurrao = def.knockback * (1 + preset[atacante].profile.power * 0.6);
      estado[alvo].x += direcao * empurrao;
      chave(alvo, frameContato + Math.round(strike * 1.6));

      cameraKeys.push({
        frame: frameContato,
        center: { x: estado[alvo].x, y: ALTURA_QUADRIL - 60 },
        zoom: def.tier === "extreme" ? 0.85 : 1.1,
        ease: def.tier === "extreme" ? 8 : 5,
        shake: def.tier === "extreme" ? 46 : def.tier === "medium" ? 24 : 10,
        // o corpo voa longe: sem plano de dois o outro sai do quadro
        fit: true,
      });
    }

    cursor += strike;

    // recuperacao
    estado[atacante].pose = "guard";
    chave(atacante, cursor);
    if (!opcoes.bloqueado) {
      estado[alvo].pose = estado[alvo].airborne ? "airborne" : "guard";
      chave(alvo, cursor);
    }
    cursor += recover;
  };

  for (const beat of spec.beats) {
    const inicio = cursor;

    switch (beat.type) {
      case "approach": {
        const e = estado[beat.who];
        e.pose = "run1";
        chave(beat.who, cursor);
        e.x = beat.toX;
        e.pose = "run2";
        chave(beat.who, cursor + beat.duration);
        // o oponente tambem se move, senao um corre e o outro fica plantado
        const outro = oposto(beat.who);
        estado[outro].pose = "advance";
        chave(outro, cursor);
        estado[outro].x += (beat.toX > estado[outro].x ? -1 : 1) * 60;
        chave(outro, cursor + beat.duration);
        cameraKeys.push({
          frame: cursor,
          center: { x: 0, y: ALTURA_QUADRIL - 40 },
          zoom: 0.92,
          ease: beat.duration,
          fit: true,
        });
        cursor += beat.duration;
        break;
      }

      case "attack":
        golpear(beat.attacker, beat.target, beat.move);
        break;

      case "blocked":
        golpear(beat.attacker, beat.target, beat.move, { bloqueado: true });
        break;

      case "combo": {
        // o combo muda a posicao entre golpes sozinho (aproximar() roda em
        // cada golpe), que e o que o briefing pede
        beat.moves.forEach((move, i) => {
          const ultimo = i === beat.moves.length - 1;
          golpear(beat.attacker, beat.target, move, { bloqueado: !ultimo });
        });
        break;
      }

      case "dodge": {
        estado[beat.who].pose = "dodge";
        chave(beat.who, cursor);
        estado[beat.who].x += (estado[beat.who].x < 0 ? -1 : 1) * 80;
        chave(beat.who, cursor + beat.duration);
        cameraKeys.push({
          frame: cursor,
          center: { x: estado[beat.who].x, y: ALTURA_QUADRIL - 70 },
          zoom: 1.3,
          ease: 4,
        });
        // esquiva extrema em camera lenta: momento de leitura
        slowMo.push({ from: cursor, to: cursor + beat.duration, factor: 0.5 });
        estado[beat.who].pose = "guard";
        chave(beat.who, cursor + beat.duration + 2);
        cursor += beat.duration;
        break;
      }

      case "knockback": {
        estado[beat.who].pose = "knockback";
        chave(beat.who, cursor);
        estado[beat.who].x += (estado[beat.who].x < 0 ? -1 : 1) * beat.distance;
        chave(beat.who, cursor + beat.duration);
        estado[beat.who].pose = "guard";
        chave(beat.who, cursor + beat.duration + 4);
        cursor += beat.duration;
        break;
      }

      case "powerUp": {
        estado[beat.who].pose = "charge";
        chave(beat.who, cursor);
        chave(beat.who, cursor + beat.duration);
        cameraKeys.push({
          frame: cursor,
          center: { x: estado[beat.who].x, y: ALTURA_QUADRIL - 60 },
          zoom: 1.2,
          ease: Math.round(beat.duration * 0.6),
        });
        cursor += beat.duration;
        break;
      }

      case "airborne": {
        estado[beat.who].airborne = true;
        estado[beat.who].pose = "airborne";
        chave(beat.who, cursor);
        chave(beat.who, cursor + beat.duration);
        estado[beat.who].airborne = false;
        estado[beat.who].pose = "land";
        chave(beat.who, cursor + beat.duration + 4);
        cursor += beat.duration;
        break;
      }

      case "recover": {
        estado[beat.who].pose = "getUp";
        chave(beat.who, cursor);
        estado[beat.who].pose = "guard";
        chave(beat.who, cursor + beat.duration);
        cursor += beat.duration;
        break;
      }

      case "finisher":
        golpear(beat.attacker, beat.target, beat.move, { finalizador: true });
        break;

      case "hold":
      case "cta":
      case "hook":
        cursor += beat.duration;
        break;
    }

    scheduled.push({ beat, from: inicio, to: cursor });
  }

  // chave final para a interpolacao nao ficar sem destino no ultimo quadro
  chave(A, cursor);
  chave(B, cursor);

  return {
    spec,
    durationInFrames: Math.max(1, cursor),
    scheduled,
    impacts,
    cameraKeys,
    tracks,
    slowMo,
  };
};
