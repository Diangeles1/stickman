/**
 * ESTILO DE ANIMACAO: o timing do motor como PARAMETRO, nao como constante.
 *
 * Antes disto, os numeros que governam a sensacao do movimento viviam como
 * constantes de modulo espalhadas pelo motor: o atraso da cabeca no sampler, o
 * peso desse atraso, a gravidade do voo. Cada um no seu arquivo, cada um sem
 * relacao declarada com os outros.
 *
 * O problema nao era organizacao. Era que "a mesma luta em estilo mais
 * exagerado" exigia editar tres arquivos e lembrar de reverter depois. Com os
 * valores num objeto, trocar de estilo vira um campo no FightSpec.
 *
 * REGRA: STICK_FIGHT reproduz EXATAMENTE o comportamento anterior. Ele e o
 * default de tudo que nao declara estilo, entao os episodios ja feitos nao
 * podem mudar um quadro sequer. Qualquer valor novo aqui comeca copiando o que
 * a constante antiga dizia, e so depois os outros presets divergem.
 */

/** Nomes de estilo disponiveis. Cada um e um conjunto coerente de parametros. */
export type NomeDeEstilo =
  | "stickFight"
  | "anime"
  | "realista"
  | "cartoon"
  | "combatePesado";

export type EstiloDeAnimacao = {
  /**
   * MOVIMENTO SECUNDARIO DA CABECA.
   *
   * `atrasoDaCabeca` e de quantos quadros atras vem a direcao antiga;
   * `pesoDoAtraso` e quanto dela aparece (1 deixaria a cabeca solta do corpo).
   * Juntos definem o chicote do pescoco -- a diferenca entre "assumiu a pose
   * de quem apanhou" e "foi atingido".
   */
  atrasoDaCabeca: number;
  pesoDoAtraso: number;
  /**
   * Gravidade do voo, em unidades por quadro ao quadrado. Mais alta deixa o
   * salto mais seco e mais pesado; mais baixa deixa flutuante.
   */
  gravidade: number;
  /**
   * Multiplicador do EXAGERO das poses. 1 usa a pose como escrita. Acima
   * disso, o motor vai alem dela (ver skeleton.exagerar), que e como
   * personalidade entra sem escrever pose nova.
   */
  exagero: number;
  /**
   * Intensidade do movimento secundario de pecas soltas (cabelo, roupa), como
   * fracao do que a velocidade do corpo pediria. Acima de 1 exagera o arrasto.
   */
  secundario: number;
  /**
   * Exagero aplicado SO as poses de locomocao (andar, correr, sprintar).
   *
   * Existe separado porque locomocao nao passa pela calibragem de contato:
   * pose de ataque e medida contra o ponto mirado (scripts/contato.mts) e
   * esticar o corpo ali tira o golpe do alcance. Passada, nao -- ali o corpo
   * pode ir tao longe quanto o estilo pedir.
   *
   * E onde mais se ganha silhueta: tronco baixo, perna de tras estendida,
   * passada longa. Le como velocidade antes de qualquer efeito entrar.
   */
  exageroLocomocao: number;
  /**
   * Multiplicador do hit stop. Anime congela mais no impacto do que a vida
   * real; realista quase nao congela.
   */
  hitStop: number;
  /**
   * Multiplicador do tremor de camera. Existe para conter: tremor constante
   * cansa e faz o impacto forte deixar de significar.
   */
  tremor: number;
};

/**
 * O ESTILO DA CASA. Estes sao os valores que o motor usava embutidos, movidos
 * para ca sem alteracao nenhuma:
 *
 *   atrasoDaCabeca  3     (era ATRASO_DA_CABECA em animation/sampler)
 *   pesoDoAtraso    0.55  (era PESO_DO_ATRASO, idem)
 *   gravidade       1.0   (era GRAVIDADE, idem)
 *
 * Os multiplicadores entram em 1 porque 1 significa "como estava".
 */
export const STICK_FIGHT: EstiloDeAnimacao = {
  atrasoDaCabeca: 3,
  pesoDoAtraso: 0.55,
  gravidade: 1.0,
  exagero: 1,
  secundario: 1,
  exageroLocomocao: 1,
  hitStop: 1,
  tremor: 1,
};

/**
 * ANIME de batalha: tudo mais longe e mais demorado no momento certo.
 *
 * A cabeca chega mais tarde e com mais chicote, as poses passam do ponto, o
 * impacto congela mais. A gravidade sobe um pouco porque queda pesada le
 * melhor que flutuacao -- no anime o personagem PARA no ar por escolha de
 * tempo, nao por falta de peso.
 */
export const ANIME: EstiloDeAnimacao = {
  atrasoDaCabeca: 4,
  pesoDoAtraso: 0.7,
  gravidade: 1.15,
  exagero: 1.25,
  secundario: 1.4,
  exageroLocomocao: 1.5,
  hitStop: 1.5,
  tremor: 1.15,
};

/**
 * REALISTA: o corpo obedece a fisica e nada passa do ponto.
 *
 * Exagero abaixo de 1 puxa a pose para AQUEM do que foi escrita. O hit stop
 * quase some: na vida real o tempo nao para no soco.
 */
export const REALISTA: EstiloDeAnimacao = {
  atrasoDaCabeca: 2,
  pesoDoAtraso: 0.4,
  gravidade: 1.3,
  exagero: 0.85,
  secundario: 0.7,
  exageroLocomocao: 0.9,
  hitStop: 0.35,
  tremor: 0.6,
};

/**
 * CARTOON: elastico. Exagero alto, gravidade baixa, secundario solto.
 * O corpo vira borracha sem deixar de ser o mesmo esqueleto.
 */
export const CARTOON: EstiloDeAnimacao = {
  atrasoDaCabeca: 5,
  pesoDoAtraso: 0.85,
  gravidade: 0.8,
  exagero: 1.5,
  secundario: 1.8,
  exageroLocomocao: 1.7,
  hitStop: 1.8,
  tremor: 1.3,
};

/**
 * COMBATE PESADO: lento, plantado e brutal.
 *
 * Gravidade alta e secundario baixo: o corpo nao balanca, ele aguenta. O hit
 * stop e o mais longo de todos porque aqui o golpe e o evento, nao a
 * sequencia.
 */
export const COMBATE_PESADO: EstiloDeAnimacao = {
  atrasoDaCabeca: 4,
  pesoDoAtraso: 0.6,
  gravidade: 1.45,
  exagero: 1.1,
  secundario: 0.75,
  exageroLocomocao: 1.2,
  hitStop: 1.9,
  tremor: 1.4,
};

const POR_NOME: Record<NomeDeEstilo, EstiloDeAnimacao> = {
  stickFight: STICK_FIGHT,
  anime: ANIME,
  realista: REALISTA,
  cartoon: CARTOON,
  combatePesado: COMBATE_PESADO,
};

/**
 * Estilo de uma luta. Sem declaracao, o da casa -- que e o que mantem os
 * episodios antigos identicos ao que eram.
 */
export const estiloDe = (nome?: NomeDeEstilo): EstiloDeAnimacao =>
  nome ? POR_NOME[nome] : STICK_FIGHT;
