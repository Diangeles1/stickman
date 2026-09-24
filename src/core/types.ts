/**
 * Tipos compartilhados do STICKMAN FIGHT ENGINE.
 *
 * Este arquivo e o contrato entre as camadas. Um golpe, uma cena ou um
 * personagem novo entram declarando dados destes tipos, sem tocar em quem
 * consome.
 */

export type Vec2 = { x: number; y: number };

/** Nome das juntas. O esqueleto inteiro deriva desta lista. */
export type JointName =
  | "head"
  | "neck"
  | "hip"
  | "shoulderBack"
  | "elbowBack"
  | "handBack"
  | "shoulderFront"
  | "elbowFront"
  | "handFront"
  | "kneeBack"
  | "footBack"
  | "kneeFront"
  | "footFront";

/**
 * Uma pose e o deslocamento de cada junta em relacao ao quadril, em unidades
 * de mundo. Guardar deslocamento em vez de angulo deixa a pose legivel e
 * editavel sem trigonometria.
 */
export type Pose = Partial<Record<JointName, Vec2>>;

export type PoseName =
  | "idle"
  | "guard"
  | "walk1"
  | "walk2"
  | "run1"
  | "run2"
  | "sprint1"
  | "sprint2"
  | "jump"
  | "airborne"
  | "land"
  | "dodge"
  | "duck"
  | "advance"
  | "retreat"
  | "block"
  | "punch"
  | "punchHeavy"
  | "punchFast"
  | "uppercut"
  | "kick"
  | "kickLow"
  | "kickHigh"
  | "spinKick"
  | "knee"
  | "elbow"
  | "airAttack"
  | "diveAttack"
  | "knockback"
  | "downed"
  | "getUp"
  | "charge";

/** Identidade visual de um lutador. Adicionar cor nova nao mexe em codigo. */
export type FighterId = "black" | "red" | "blue" | "gold" | "green" | "white" | "purple";

export type FighterPreset = {
  id: FighterId;
  /** cor do traco */
  stroke: string;
  /** cor da aura, quando ele tiver uma */
  auraColor: string;
  /** espessura do traco em unidades de mundo */
  limbWidth: number;
  headRadius: number;
  /** 1 = altura padrao; muda o porte sem mexer nas poses */
  scale: number;
  /**
   * Perfil de luta. Nao e enfeite: o compilador de timeline usa isto para
   * escolher duracao de golpe e intensidade, o que da personalidade sem
   * coreografar cada luta na mao.
   */
  profile: {
    /** 0 a 1. Alto = golpe rapido, recuperacao curta, mais esquiva. */
    speed: number;
    /** 0 a 1. Alto = mais knockback, mais destruicao de cenario. */
    power: number;
  };
};

/** Peso do impacto. Governa quais efeitos entram (ver effects/impact). */
export type ImpactTier = "light" | "medium" | "extreme";

export type AttackName =
  | "punch"
  | "punchHeavy"
  | "punchFast"
  | "uppercut"
  | "kick"
  | "kickLow"
  | "kickHigh"
  | "spinKick"
  | "knee"
  | "elbow"
  | "charge"
  | "airAttack"
  | "diveAttack"
  | "special"
  | "finisher";

/**
 * Definicao de um golpe: as cinco fases que o briefing pede, mais o que o
 * impacto produz. Duracoes em quadros a 60 fps, escaladas depois pela
 * velocidade do lutador.
 */
export type AttackDef = {
  name: AttackName;
  pose: PoseName;
  /** preparacao: o corpo recua e carrega */
  windup: number;
  /** execucao: o membro dispara */
  strike: number;
  /** recuperacao: volta para a guarda */
  recover: number;
  /** em qual quadro do strike o golpe conecta */
  contactAt: number;
  tier: ImpactTier;
  /** empurrao aplicado no alvo, em unidades de mundo por segundo */
  knockback: number;
  /** quadros de interrupcao visual no contato */
  hitStop: number;
  /** junta que encosta no alvo, para posicionar o efeito */
  contactJoint: JointName;
  /** chave do som em audio/registry */
  sound: string;
  /** o golpe racha o chao */
  cracksGround?: boolean;
  /** o golpe joga o alvo para cima */
  launches?: boolean;
};

/** Um beat do roteiro. E isto que vira JSON e o que a geracao aleatoria monta. */
export type Beat =
  | { type: "approach"; who: FighterId; toX: number; duration: number }
  | { type: "attack"; attacker: FighterId; target: FighterId; move: AttackName }
  | { type: "blocked"; attacker: FighterId; target: FighterId; move: AttackName }
  | { type: "dodge"; who: FighterId; duration: number }
  | { type: "combo"; attacker: FighterId; target: FighterId; moves: AttackName[] }
  | { type: "knockback"; who: FighterId; distance: number; duration: number }
  | { type: "powerUp"; who: FighterId; duration: number }
  | { type: "airborne"; who: FighterId; duration: number }
  | { type: "recover"; who: FighterId; duration: number }
  | { type: "hold"; duration: number; label?: string }
  | { type: "finisher"; attacker: FighterId; target: FighterId; move: AttackName }
  | { type: "cta"; duration: number }
  | { type: "hook"; duration: number };

/** A luta como DADOS. Uma luta nova e um objeto destes, nada mais. */
export type FightSpec = {
  fighterA: FighterId;
  fighterB: FighterId;
  /** semente do PRNG: a mesma semente sempre da a mesma luta */
  seed: number;
  fps: number;
  width: number;
  height: number;
  /** 0 a 10, como no briefing. Escala duracoes e intensidade. */
  intensity: number;
  scenario: "arena";
  beats: Beat[];
};

/** Beat ja resolvido em quadros absolutos pelo compilador. */
export type ScheduledBeat = {
  beat: Beat;
  from: number;
  to: number;
};

/** Um evento de impacto no tempo, consumido pelos efeitos e pela camera. */
export type ImpactEvent = {
  frame: number;
  at: Vec2;
  tier: ImpactTier;
  direction: number;
  hitStop: number;
  cracksGround: boolean;
  sound: string;
};

/** Onde cada lutador esta e o que faz, num beat. */
export type FighterTrack = {
  id: FighterId;
  /** posicao base no eixo x, por quadro-chave */
  keys: { frame: number; x: number; pose: PoseName; airborne: boolean }[];
};

/**
 * Saida do compilador: tudo que os componentes precisam para desenhar o
 * quadro N sem manter estado. E o coracao do determinismo exigido pelo
 * Remotion.
 */
export type Timeline = {
  spec: FightSpec;
  durationInFrames: number;
  scheduled: ScheduledBeat[];
  impacts: ImpactEvent[];
  tracks: Record<string, FighterTrack>;
  /** momentos de camera, resolvidos em quadro */
  cameraKeys: CameraKey[];
  /** trechos em camera lenta */
  slowMo: { from: number; to: number; factor: number }[];
};

export type CameraKey = {
  frame: number;
  /** centro do enquadramento em mundo */
  center: Vec2;
  zoom: number;
  /** quadros para chegar la; 0 = corte seco */
  ease: number;
  shake?: number;
};
