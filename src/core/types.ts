/**
 * Tipos compartilhados do STICKMAN FIGHT ENGINE.
 *
 * Este arquivo e o contrato entre as camadas. Um golpe, uma cena ou um
 * personagem novo entram declarando dados destes tipos, sem tocar em quem
 * consome.
 */

import type { PontoAlvo } from "./contact";

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
  | "stagger"
  | "coil"
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
  | "hitHead"
  | "hitChest"
  | "hitBody"
  | "hitLeg"
  | "knockback"
  | "launched"
  | "groundHit"
  | "squash"
  | "downed"
  | "sitUp"
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
  /**
   * Quanto do alcance do membro o golpe usa no contato (1 = membro esticado).
   *
   * Golpe de curta distancia (uppercut, gancho) chega com o braco DOBRADO:
   * calculado com o alcance inteiro, a distancia de combate afastava os dois
   * e a cinematica inversa esticava o braco na horizontal, e o uppercut virava
   * um jab alto.
   */
  extensao?: number;
  /**
   * Para onde o membro CONTINUA depois do contato (follow-through), no
   * referencial de quem bate: x para frente, y para baixo. Padrao: reto para
   * frente. O uppercut continua SUBINDO; empurrado para frente, o braco
   * esticava na horizontal e o golpe lia como jab.
   */
  seguimento?: Vec2;
  /**
   * Golpe AEREO: quanto o quadril esta acima do apoio normal no quadro do
   * contato. Sem isto a distancia era calculada como se o golpe fosse dado
   * do chao, com o pe abaixo do peito do outro e o alcance encurtado, e o
   * pulo terminava com um corpo em cima do outro.
   */
  elevacao?: number;
};

/** Um beat do roteiro. E isto que vira JSON e o que a geracao aleatoria monta. */
export type Beat =
  | { type: "approach"; who: FighterId; toX: number; duration: number }
  | {
      type: "attack";
      attacker: FighterId;
      target: FighterId;
      move: AttackName;
      /** onde o golpe acerta; sem isso usa ALVO_PADRAO do golpe */
      targetPoint?: PontoAlvo;
    }
  | {
      type: "blocked";
      attacker: FighterId;
      target: FighterId;
      move: AttackName;
      targetPoint?: PontoAlvo;
    }
  | { type: "dodge"; who: FighterId; duration: number }
  /**
   * Golpe que PASSA: o atacante desfere, o alvo sai do caminho, e nao ha
   * impacto nenhum.
   *
   * Sem isto uma luta nao tem erro, e luta em que todo golpe acerta nao tem
   * tensao. Diferente de "blocked", onde o golpe encosta na guarda: aqui ele
   * nao encosta em nada, e e justamente isso que da valor a esquiva.
   */
  | {
      type: "dodged";
      attacker: FighterId;
      target: FighterId;
      move: AttackName;
      targetPoint?: PontoAlvo;
    }
  | {
      type: "combo";
      attacker: FighterId;
      target: FighterId;
      moves: AttackName[];
      /** o ultimo golpe acerta (padrao) ou tambem e bloqueado */
      final?: "hit" | "blocked";
      targetPoint?: PontoAlvo;
    }
  | { type: "knockback"; who: FighterId; distance: number; duration: number }
  | { type: "powerUp"; who: FighterId; duration: number }
  | { type: "airborne"; who: FighterId; duration: number }
  | { type: "recover"; who: FighterId; duration: number }
  | { type: "hold"; duration: number; label?: string }
  | {
      type: "finisher";
      attacker: FighterId;
      target: FighterId;
      move: AttackName;
      targetPoint?: PontoAlvo;
    }
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
  /**
   * "arena" e o cenario escuro com rachaduras e poeira.
   * "limpo" e fundo branco com uma linha de chao, no estilo da referencia:
   * nada compete com a silhueta dos lutadores.
   */
  scenario: "arena" | "limpo";
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
  /** ponto REAL onde o membro encostou, em coordenada de mundo */
  at: Vec2;
  tier: ImpactTier;
  direction: number;
  hitStop: number;
  cracksGround: boolean;
  sound: string;
  /**
   * Quem levou. Sem isto a cena nao sabe em qual dos dois aplicar a
   * compressao do impacto, e a absorcao do golpe nao existiria.
   */
  victim?: FighterId;
  /** quem bateu: o placar (vida, combo) precisa saber de quem foi o golpe */
  attacker?: FighterId;
  /** o golpe encostou na guarda, nao no corpo */
  bloqueado?: boolean;
  /** o golpe que encerra a luta */
  finalizador?: boolean;
};

/**
 * MIRA: o membro `joint` de `who` tem que encostar em `ponto` de `alvo` no
 * quadro `contact`.
 *
 * Existe porque a distancia de combate resolve o eixo horizontal por
 * construcao, mas o vertical vinha da pose escrita a mao. O compilador declara
 * a intencao aqui e quem desenha resolve por cinematica inversa, o que faz o
 * golpe encostar nos dois eixos sem ninguem ajustar pose.
 */
export type AimEvent = {
  who: FighterId;
  /** ponta do membro atacante: handFront, footFront... */
  joint: JointName;
  alvo: FighterId;
  ponto: string;
  /** quadro em que a ponta tem que estar exatamente no ponto */
  contact: number;
  /** a correcao entra a partir daqui */
  from: number;
  /** e sai completamente aqui */
  to: number;
  /** +1 quando o golpe vai para a direita, -1 para a esquerda */
  direcao: number;
  /**
   * FOLLOW-THROUGH: quanto o membro passa ALEM do ponto de contato, em
   * unidades de mundo, nos quadros seguintes ao contato.
   *
   * Membro que para exatamente no alvo le como golpe sem massa. Passar um
   * pouco e voltar e o que da a sensacao de peso e velocidade.
   */
  avanco: number;
  /** direcao do follow-through (ver AttackDef.seguimento), ja normalizada */
  direcaoDoAvanco?: Vec2;
  /**
   * Mira CONGELADA: o ponto do alvo e lido neste quadro, e nao no quadro
   * atual. E o golpe esquivado: quem ataca mira onde a cabeca ESTAVA quando
   * ele decidiu golpear; mirar no corpo vivo fazia o punho perseguir a
   * cabeca que se abaixava, como um missil teleguiado.
   */
  congelarEm?: number;
};

/** Onde cada lutador esta e o que faz, num beat. */
export type FighterTrack = {
  id: FighterId;
  /** posicao base no eixo x, por quadro-chave */
  keys: {
    frame: number;
    x: number;
    pose: PoseName;
    airborne: boolean;
    /**
     * EXAGERO da pose em relacao a guarda: 1 (ou ausente) e a pose escrita;
     * 1.2 vai 20% alem; 0.9 fica aquem. E como a personalidade e o
     * follow-through entram no movimento sem escrever poses novas (ver
     * skeleton.exagerar).
     */
    exagero?: number;
  }[];
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
  /** intencoes de mira, resolvidas por IK na hora de desenhar */
  aims: AimEvent[];
  tracks: Record<string, FighterTrack>;
  /** momentos de camera, resolvidos em quadro */
  cameraKeys: CameraKey[];
  /** trechos em camera lenta */
  slowMo: { from: number; to: number; factor: number }[];
  /**
   * CAMERA LENTA DE VERDADE: trechos em que o video gasta mais quadros reais
   * por quadro logico (factor 0.25 = quatro vezes mais devagar).
   *
   * Diferente de slowMo, que so avisa a camera, este muda a DURACAO do video
   * (ver core/tempo.ts). Fica reservado para os poucos momentos que o
   * espectador tem que ver devagar: a esquiva por um fio e o nocaute.
   */
  camaraLenta: { from: number; to: number; factor: number }[];
};

export type CameraKey = {
  frame: number;
  /** centro do enquadramento em mundo */
  center: Vec2;
  zoom: number;
  /** quadros para chegar la; 0 = corte seco */
  ease: number;
  shake?: number;
  /**
   * Plano de dois: em vez de usar center/zoom fixos, a camera calcula o
   * enquadramento a partir da distancia entre os lutadores, para os dois
   * caberem na tela.
   *
   * Existe porque consertar o knockback criou o problema oposto: com os corpos
   * se separando de verdade, um enquadramento fixo perdia um dos dois fora do
   * quadro. Close-up continua sendo fit=false, porque ali excluir o outro e
   * intencional.
   */
  fit?: boolean;
  /**
   * Segue este lutador: o centro vem da posicao REAL dele no quadro, nao de um
   * valor congelado na compilacao.
   *
   * Existe por um bug encontrado renderizando: a chave gravava onde o lutador
   * estava quando o beat foi compilado, mas ele continuava se deslocando depois
   * (o escorregao do pouso). A camera mirava o lugar vazio e o personagem
   * ficava fora do quadro.
   */
  follow?: FighterId;
};
