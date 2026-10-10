/**
 * Auditoria da CADEIA CINETICA: o corpo se move como corrente ou como bloco?
 *
 * Num golpe real o movimento nasce no chao e sobe: o quadril acelera primeiro,
 * o tronco depois, o ombro depois, e o punho por ultimo. Em animacao
 * interpolada acontece o oposto: TODAS as juntas partem e chegam no mesmo
 * instante, porque a mistura de poses usa um unico fator de tempo para o corpo
 * inteiro. E isso que faz o olho ler "posicoes sendo trocadas" em vez de
 * "corpo se movendo".
 *
 * Este script mede, para cada golpe da luta, em que quadro cada junta atinge a
 * VELOCIDADE MAXIMA. Se todas atingem no mesmo quadro, o corpo e um bloco.
 *
 * Uso: npx tsx scripts/cadeia.mts [benchmark|um-soco]
 */

import { corpoNoQuadro, juntasDoCorpo } from "../src/animation/corpo";
import { CADEIA_DO_MEMBRO } from "../src/characters/skeleton";
import { geometriaDaLamina } from "../src/characters/Katana";
import { compilar } from "../src/core/timeline";
import type { FighterId, JointName } from "../src/core/types";
import { escolherLuta } from "./lutas.mjs";

/**
 * Cadeia a auditar, da raiz para a ponta do membro que DE FATO golpeia.
 *
 * A primeira versao media sempre o braco da frente, e por isso reprovava todo
 * chute: media um membro que nao estava atacando. A cadeia do soco e
 * quadril -> tronco -> ombro -> cotovelo -> punho; a do chute e
 * quadril -> tronco -> joelho -> pe.
 */
/**
 * A CORRENTE DE UM LUTADOR ARMADO TERMINA NA LAMINA, e nao no punho.
 *
 * A katana sai cem unidades de pose da mao e e o ultimo elo do chicote: a
 * energia vai do chao ate a ponta. Medir ate o punho e parar a conta um elo
 * antes do fim -- e justamente o elo que mais se move.
 *
 * E a mesma correcao que scripts/coreografia.mts precisou: as reguas foram
 * escritas quando o motor so tinha maos e pes, e a arma ficou de fora das
 * duas.
 */
const PONTA_DA_LAMINA = "pontaDaLamina" as JointName;

const cadeiaDe = (ponta: JointName): JointName[] => {
  const membro = CADEIA_DO_MEMBRO[ponta] ?? ["hip", ponta];
  const lista: JointName[] = ["hip", "neck"];
  for (const j of membro) if (!lista.includes(j)) lista.push(j);
  return lista;
};

const { nome: qual, spec } = escolherLuta(process.argv[2], "benchmark");
const t = compilar(spec);

/** Posicao de uma junta no mundo, no quadro pedido. */
const juntaEm = (id: FighterId, frame: number, junta: JointName) => {
  const c = corpoNoQuadro(t, id, frame);
  if (junta === PONTA_DA_LAMINA) {
    const g = geometriaDaLamina(c);
    return { x: g.mao.x + g.dir.x * g.comprimento, y: g.mao.y + g.dir.y * g.comprimento };
  }
  return juntasDoCorpo(c)[junta];
};

/**
 * Para QUAL POSE o corpo estava indo naquele quadro.
 *
 * Sem esta coluna o relatorio dizia que o corpo se movia como bloco e nao
 * dizia onde, e "onde" e a unica informacao que leva a um conserto: o perfil
 * de atraso e escolhido pela pose de DESTINO (ver `atrasoPara` em
 * animation/sampler), entao o nome que aparece aqui e o nome da chave do
 * switch que precisa existir. Foi assim que `cargaKatana` e `cargaBaixa`
 * apareceram -- duas poses de carga que a troca por arma criou e que ninguem
 * tinha adicionado ao switch, deixando a ERGUIDA da espada sem corrente
 * nenhuma enquanto o corte em si tinha a dele.
 */
const poseEm = (id: FighterId, frame: number): string =>
  corpoNoQuadro(t, id, frame).poseNome;

console.log(`luta: ${qual}\n`);

/*
  O QUE JA FOI INVESTIGADO SOBRE AS REPROVACOES DESTE MEDIDOR, para ninguem
  refazer o caminho.

  A luta dos ninjas reprova em 10 de 21 golpes, e as falhas se concentram nos
  COMBOS: `punchFast` sozinho espalha os picos por 16 quadros e passa; o mesmo
  `punchFast` dentro de um combo espalha 4 e reprova.

  CINCO EXPLICACOES FORAM MEDIDAS E AS CINCO SAO FALSAS:

  1. "o avanco do corpo vaza para dentro do disparo e a translacao domina a
     velocidade de todas as juntas" -- medido: 6% do avanco acontece durante o
     disparo, e 18 dos 21 golpes tem deslocamento ZERO nele. Os tres que vazam
     sao aereos, em que o corpo viaja porque esta voando.

  2. "medir relativo ao quadril tira a translacao e revela a corrente" -- nao
     revela: em alguns golpes melhora um pouco, em outro INVERTE a ordem
     (pescoco e ombro passam a picar antes do quadril).

  3. "golpe curto nao tem quadros para a corrente" -- a correlacao entre
     duracao e espalhamento e 0,37. Golpes de CINCO quadros dao espalhamentos
     de 16, 4, 18, 8 e 4: a duracao nao decide.

  4. "no combo a preparacao encadeada e curta demais" (ela e 45% da normal) --
     subir para 0,62 / 0,78 / 0,95 PIORA: a cadeia vai de 10 para 12 e a
     patinacao dos pes triplica.

  5. "no combo o braco ja esta perto da pose seguinte, entao nao ha caminho a
     percorrer" -- medido: o braco viaja 194 a 214 unidades nos combos contra
     220 a 297 nos golpes solo. Nao e pouco. E o `uppercut` viaja 143, menos
     que qualquer combo, e PASSA.

  O QUE SOBRA, e que e a leitura mais honesta disponivel: num golpe de sete
  quadros a corrente aparece em DOIS estagios (o corpo, e depois o braco) em
  vez de cinco. Medido no soco com contato no 475: quadril, pescoco e ombro
  picam no 470 e cotovelo e punho no 473 -- tres quadros de separacao, na
  ordem certa, mas so dois quadros DISTINTOS. O criterio de "3 dos 5 picos
  distintos" pede mais estagios do que cabem num golpe rapido.

  MAIS TRES EXPLICACOES MEDIDAS E REFUTADAS, todas depois das cinco acima:

  6. "basta dar JANELAS MAIORES aos golpes" -- esta estava ESCRITA como
     receita no proprio preset (ver ANIME_DESENHADO em animation/estilo). E
     falsa, e no sentido contrario: subindo `janelaDeGolpe` de 1.4 para 1.8,
     2.2 e 2.8, o duelo do dia vai de 5 para 7, 7 e 9 reprovacoes. Janela
     maior da mais tempo para o corpo TRANSLADAR dentro da janela de medicao,
     e translacao move tudo junto.

  7. "descontar a translacao da raiz do corpo (corpo.x, corpo.baseY)" -- e
     diferente da ideia 2 acima, que subtraia a JUNTA quadril e por isso
     zerava a velocidade dela por construcao. Esta preserva o giro do
     quadril, parecia obviamente certa, e PIORA: duelo do dia 5 -> 11,
     dominio 0 -> 1, luta completa 1 -> 2.

  8. "a janela nao deve alcancar a CAMINHADA" -- locomocao move todas as
     juntas juntas de proposito (`atrasoPara` devolve undefined para passo e
     corrida), e o pico do quadril caia mesmo la: num uppercut com contato em
     2261, quadril, pescoco e ombro picavam todos em 2230, dentro de um
     `advance`. Andar a janela para a frente ate sair da locomocao tambem
     piora: duelo do dia 5 -> 6, luta completa 1 -> 2, duelo do vale 9 -> 10.

  O QUE DE FATO MOVEU O NUMERO foi abrir os VAOS entre as juntas nos perfis
  de atraso (ver ATRASO_DO_ATAQUE em characters/skeleton): o pescoco comecava
  dois centesimos depois do ombro, o que num golpe de sete quadros e um
  setimo de quadro -- os dois partiam no mesmo desenho. Duelo do dia 5 -> 3,
  duelo do vale 9 -> 5, ninjas 10 -> 8.

  E VALE REGISTRAR O QUE A MEDICAO MOSTROU DE BOM: o disparo em si tem uma
  corrente exemplar. No mesmo uppercut, entre os quadros 2255 e 2258, o
  quadril para (0, 0, 0), o pescoco para (2, 3, 0) e a ponta dispara
  (cotovelo 146, punho 216). A raiz chega primeiro e a ponta por ultimo, que
  e exatamente o que se pede. O que reprova e onde o pico GLOBAL cai.

  UMA CLASSE DE DEFEITO QUE ESTE MEDIDOR ESTAVA ACUSANDO SEM NOMEAR: o
  TELEPORTE DE POSE. Duas chaves com poses de braco diferentes separadas por
  um ou tres quadros nao sao um movimento rapido, sao um salto -- e salto move
  TODAS as juntas no mesmo quadro, que e exatamente o que o criterio chama de
  bloco. Num boneco de palito isso passava despercebido; a espada, que sai cem
  unidades da mao, multiplicou a diferenca e tornou o salto visivel na medida.

  Dois foram encontrados em `laminas` e os dois eram no PREPARO, nunca no
  disparo (o disparo segue exemplar, ver o paragrafo acima):

    - a saida da parada em `aproximar` escrevia a pose de corrida UM quadro
      depois da pose parada. Ponta da lamina: 458 unidades num quadro.
      Consertado dando tempo a arrancada, tirado da corrida e nao somado.

    - a decolagem do golpe aereo sobrescrevia a carga declarada pelo golpe com
      `coil` fixo, tres quadros depois de a preparacao ter usado a carga certa.
      Em `corteMergulho` isso atravessava a espada de um lado do corpo ao
      outro: ponta a 671 unidades num quadro, contra 253 no pico do corte de
      verdade. Consertado respeitando `def.carga`, e a ponta caiu para 101.

  A COLUNA "indo para" EXISTE POR CAUSA DISSO. Sem ela o relatorio dizia que o
  corpo virava bloco e nao dizia ONDE, e "onde" e a unica informacao que leva a
  um conserto -- os dois teleportes acima apareceram no primeiro relatorio que
  imprimiu o nome da pose de destino no quadro do pico.

  9. E O RESULTADO NEGATIVO, que importa tanto quanto: consertar os dois
     teleportes NAO MOVEU O TOTAL. Somando os doze roteiros, 51 antes e 51
     depois -- `vale` 7->6, `ar` 5->4 e `laminas` 3->2 melhoraram, `rua` 3->4,
     `relampago` 5->6 e `laminaNua` 2->3 pioraram. Nao e contradicao: o
     criterio olha onde cai o pico GLOBAL, entao qualquer mudanca de timing
     troca golpes individuais de lado. A CONTAGEM DESTE MEDIDOR NAO E SENSIVEL
     A ESTA CLASSE DE DEFEITO; quem mediu o conserto foi a velocidade da ponta
     da lamina, nao o total de reprovacoes. Nao use este total para decidir se
     um teleporte foi consertado -- meca a ponta.

  10. "a lamina e um elo de qualquer corrente do lutador armado" -- era assim
      que este script media, e e falso: a lamina e extensao do BRACO. A
      corrente quadril -> joelho -> pe de um CHUTE terminava na espada, que
      naquele golpe esta parada na outra ponta do corpo, e isso reprovava um
      chute cuja corrente estava correta. Agora a ponta so entra quando a
      junta que golpeia e uma mao.

  NAO MEXA NO CRITERIO SO PARA PASSAR. Se algum dia ele for afrouxado, que
  seja com uma razao que valha para golpe lento tambem -- e note que golpe
  lento passa: `punchHeavy` e `uppercut` espalham 20 e 28 quadros.
*/
let blocos = 0;

for (const mira of t.aims) {
  // A janela comeca na PREPARACAO, nao no disparo.
  //
  // A primeira versao comecava em mira.from, que e o inicio do disparo, e por
  // isso media a coisa errada: o passo a frente acontece durante a preparacao,
  // entao o pico do quadril caia fora da janela e o medidor acusava "cadeia
  // invertida" num corpo que estava certo.
  /*
    ...MAS A JANELA NAO PODE ALCANCAR O GOLPE ANTERIOR.

    Vinte e quatro quadros antes do disparo sao 0,4 segundo a 60 fps, e isso
    chega inteiro dentro da acao de antes. Medido num soco com contato no
    quadro 422: TODAS as juntas apareciam com o pico em 414 -- tres quadros
    antes de a mira sequer abrir -- e o medidor acusava "corpo se movendo como
    bloco". O pico era da investida anterior, em que o corpo inteiro translada
    e todas as juntas se movem juntas POR DEFINICAO.

    Nenhuma corrente cinetica sobrevive a essa comparacao, porque translacao
    do corpo move tudo igual e com folga mais do que a articulacao de um
    braco. A janela agora para onde o golpe anterior deste mesmo lutador
    terminou.
  */
  const anterior = t.aims
    .filter((m) => m.who === mira.who && m.to < mira.contact && m !== mira)
    .reduce<number>((maior, m) => Math.max(maior, m.to), 0);
  const de = Math.max(0, anterior, mira.from - 24);
  const ate = mira.contact + 4;

  console.log(
    `--- ${mira.who} -> ${mira.alvo} ${mira.ponto}, contato no quadro ${mira.contact}`,
  );
  console.log("  junta            pico  desvio do contato  velocidade   indo para");

  const CADEIA = cadeiaDe(mira.joint);
  /*
    O LUTADOR ARMADO TEM UM ELO A MAIS, MAS SO QUANDO GOLPEIA COM A MAO.

    A lamina e extensao do BRACO, e nao do corpo. Anexar a ponta a qualquer
    corrente de um lutador armado punia os CHUTES dele: a corrente
    hip -> joelho -> pe terminava na espada, que naquele golpe esta parada na
    outra ponta do corpo. Era assim que `cadeia` reprovava um chute correto em
    `laminas`, com a ponta cravando pico 9 quadros depois do pe.
  */
  const comLamina = mira.joint === "handFront" || mira.joint === "handBack";
  if (t.spec.armas?.[mira.who] && comLamina) CADEIA.push(PONTA_DA_LAMINA);
  const picos: { junta: JointName; frame: number; v: number }[] = [];
  for (const junta of CADEIA) {
    let melhor = { v: 0, f: de };
    for (let f = de + 1; f <= ate; f++) {
      const a = juntaEm(mira.who, f - 1, junta);
      const b = juntaEm(mira.who, f, junta);
      const v = Math.hypot(b.x - a.x, b.y - a.y);
      if (v > melhor.v) melhor = { v, f };
    }
    picos.push({ junta, frame: melhor.f, v: melhor.v });
    console.log(
      `  ${junta.padEnd(15)} ${String(melhor.f).padStart(4)}  ` +
        `${String(melhor.f - mira.contact).padStart(8)}          ` +
        `${melhor.v.toFixed(0).padStart(5)}   ${poseEm(mira.who, melhor.f)}`,
    );
  }

  // O corpo e um BLOCO quando quase todas as juntas picam no mesmo quadro.
  const unicos = new Set(picos.map((p) => p.frame));
  const espalhamento =
    Math.max(...picos.map((p) => p.frame)) -
    Math.min(...picos.map((p) => p.frame));

  // Ordem da cadeia: o punho tem que picar DEPOIS do quadril.
  /**
   * ORDEM: so vale para juntas que de fato se MOVERAM.
   *
   * No chute giratorio o atacante nao da passo, entao o quadril dele pica a 14
   * unidades por quadro, que e ruido. Ordenar dois eventos quando um deles nao
   * aconteceu nao diz nada, e o medidor acusava cadeia invertida por isso.
   */
  const MOVEU = 25;
  const quadril = picos.find((p) => p.junta === "hip")!;
  const ponta = picos.find((p) => p.junta === mira.joint)!;
  const ordemOk =
    quadril.v < MOVEU || ponta.v < MOVEU || ponta.frame >= quadril.frame;

  // Bloco = no maximo dois picos distintos, ou todos dentro de um quadro.
  //
  // Antes era "espalhamento <= 2", escrito quando os disparos tinham 8 a 10
  // quadros. O jab do lutador rapido tem 5 quadros (83 ms), e dentro dele a
  // corrente cabe em tres quadros consecutivos: quadril e tronco, cotovelo,
  // punho. Exigir mais que isso reprovava a resolucao do video, nao o corpo.
  // O que continua reprovado e o que importa: picos coincidentes e cadeia
  // invertida (abaixo).
  const bloco = unicos.size <= 2 || espalhamento < 2;
  if (bloco || !ordemOk) blocos++;
  console.log(
    `  picos distintos: ${unicos.size}/${CADEIA.length}, ` +
      `espalhamento ${espalhamento} quadros, ` +
      `${
        quadril.v < MOVEU
          ? "quadril parado (sem passo)"
          : `ponta ${ponta.frame >= quadril.frame ? "depois" : "ANTES"} do quadril`
      }` +
      `${bloco ? "   <<< CORPO SE MOVENDO COMO BLOCO" : ""}` +
      `${ordemOk ? "" : "   <<< CADEIA INVERTIDA"}\n`,
  );
}

console.log(
  blocos === 0
    ? "APROVADO: nenhum golpe move o corpo como bloco nem com a cadeia invertida."
    : `REPROVADO: ${blocos}/${t.aims.length} golpes com bloco ou cadeia invertida.`,
);
