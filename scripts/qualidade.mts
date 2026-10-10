/**
 * VALIDACAO DE QUALIDADE VISUAL.
 *
 * Roda a lista de criterios que uma cena tem que cumprir antes de ser
 * considerada pronta, e devolve codigo de saida diferente de zero quando algo
 * reprova -- entao serve tanto para olhar quanto para barrar um render.
 *
 * O que NAO esta aqui, e por que:
 *
 *   braco extra, dedo a mais, personagem duplicado, membro invertido,
 *   anatomia deformada
 *
 * Nada disso e verificavel porque nada disso e POSSIVEL. O corpo nao e
 * gerado, e derivado: um esqueleto de 13 juntas fixas (core/types, JointName)
 * desenhado pela mesma funcao em todo quadro. Nao existe caminho no codigo
 * que produza um terceiro braco. Checar isso seria teatro.
 *
 * O que esta aqui e o que o motor PODE errar de verdade, quase sempre porque
 * alguem escreveu uma coreografia com numero fora de escala:
 *
 *   1. numero de lutadores
 *   2. teleporte: o corpo saltar sem estar no ar nem sob arrasto
 *   3. causalidade: efeito de impacto comecando ANTES do golpe conectar
 *   4. oclusao: poder grande o bastante para cobrir quem o lancou
 *   5. enquadramento: lutador fora do quadro em momento de impacto
 *   6. paleta: lutador trocando de cor de poder no meio da luta
 *
 * Uso: npx tsx scripts/qualidade.mts [luta]
 */

import { corpoNoQuadro } from "../src/animation/corpo";
import { estiloDe } from "../src/animation/estilo";
import { cameraNoQuadro } from "../src/camera/camera";
import { compilar } from "../src/core/timeline";
import type { FighterId, NomeDePaleta, Timeline } from "../src/core/types";
import { escolherLuta } from "./lutas.mjs";
import { ALTURA_QUADRIL } from "../src/characters/skeleton";

const { nome: qual, spec } = escolherLuta(process.argv[2], "dominio");
const t: Timeline = compilar(spec);
const ids = [spec.fighterA, spec.fighterB] as FighterId[];

type Falha = { regra: string; detalhe: string };
const falhas: Falha[] = [];
const notas: string[] = [];

// ---- 1. numero de lutadores -------------------------------------------------
const nTracks = Object.keys(t.tracks).length;
if (nTracks !== 2) {
  falhas.push({
    regra: "2 personagens",
    detalhe: `a timeline tem ${nTracks} tracks de lutador`,
  });
}

// ---- 2. teleporte -----------------------------------------------------------
/**
 * Um corpo pode andar muito rapido: lancado, no ar, ou arrastado por golpe. O
 * que ele nao pode e MUDAR DE LUGAR entre dois quadros sem nenhuma dessas
 * condicoes -- isso e keyframe mal escrito, e na tela le como corte errado.
 */
/*
  O LIMITE ESCALA COM OS QUADROS POR DESENHO.

  90 unidades por quadro pressupoe interpolacao lisa. Quando o estilo segura a
  pose por dois quadros (animacao em 2s, ver animation/estilo), o corpo anda o
  DOBRO por passo visivel -- e isso nao e teleporte, e o proprio recurso
  funcionando: desenho segurado e o que separa animacao desenhada de
  interpolacao.

  Medido: com quadrosPorDesenho 2 a luta dos ninjas acusava saltos de 114
  unidades, que sao 57 por quadro logico -- bem dentro do limite. Comparar um
  salto de passo duplo contra um limite de passo simples reprova o recurso em
  vez do defeito.
*/
const PASSOS = estiloDe(spec.estilo).quadrosPorDesenho;
const SALTO_MAXIMO = 90 * PASSOS; // unidades por passo com os pes no chao
const INICIO_VALIDO = 6;
for (const id of ids) {
  let pior = { frame: 0, delta: 0 };
  let quantos = 0;
  /*
    Os primeiros quadros sao o SETUP: a cena coloca cada um na marca inicial,
    e nao existe "antes" de onde eles teriam vindo. Contar isso como teleporte
    acusaria toda luta no quadro 1.
  */
  let anterior = corpoNoQuadro(t, id, INICIO_VALIDO);
  for (let f = INICIO_VALIDO + 1; f < t.durationInFrames; f++) {
    const atual = corpoNoQuadro(t, id, f);
    /*
      O SALTO E MEDIDO NO PALCO, e nao so no eixo da tela.

      Com profundidade, um corpo pode atravessar o cenario inteiro recuando
      sem que `x` mude um numero -- e a medicao em x diria que ele nao saiu do
      lugar. Distancia percorrida e a hipotenusa dos dois eixos.
    */
    const delta = Math.hypot(atual.x - anterior.x, atual.z - anterior.z);
    if (delta > SALTO_MAXIMO && !atual.noAr && !anterior.noAr) {
      quantos++;
      if (delta > pior.delta) pior = { frame: f, delta };
    }
    anterior = atual;
  }
  if (quantos > 0) {
    falhas.push({
      regra: "sem teleporte",
      detalhe: `${id}: ${quantos} salto(s) com os pes no chao, pior ${pior.delta.toFixed(0)} unidades no quadro ${pior.frame}`,
    });
  }
}

// ---- 3. causalidade ---------------------------------------------------------
/**
 * Explosao, estilhaco e tela branca sao CONSEQUENCIA. Se o evento comeca antes
 * do impacto que o justifica, a cena mostra o efeito antes da causa -- o
 * espectador nao sabe nomear, mas sente que algo esta errado.
 */
/*
  telaBranca ficou DE FORA: ela e usada tanto como consequencia de impacto
  quanto como clarao de carga (duas energias se juntando), e a segunda e
  legitima antes de qualquer golpe. Regra que acusa uso correto ensina a
  ignorar o validador, que e pior do que nao ter validador.
*/
const CONSEQUENCIAS = new Set([
  "explosaoFogo",
  "estilhacosGelo",
  "rachadura",
  "vapor",
]);
const TOLERANCIA_CAUSAL = 2; // quadros de folga: o efeito pode nascer junto
/*
  CAUSALIDADE TEM LUGAR, E NAO SO HORA.

  A regra emparelhava efeito com impacto so pelo TEMPO: qualquer explosao a
  menos de 30 quadros de um impacto tinha que vir depois dele. Isso acusa uso
  correto, que e o que esta nota logo acima diz para nao fazer -- a cena
  `investida` solta uma explosao NO CORPO de quem arranca, como propulsao, e
  o impacto dela acontece meio segundo depois, a meio palco de distancia.

  Medido no roteiro `emboscada`: explosao no quadro 284 contra um impacto no
  320, com os dois pontos separados por centenas de unidades. Uma explosao
  longe do golpe nao e consequencia do golpe.

  O raio e generoso de proposito. Ele nao existe para medir o alcance de uma
  explosao, e sim para separar "aconteceu AQUI" de "aconteceu do outro lado
  da arena" -- se um dia ele deixar passar um efeito adiantado de verdade, o
  conserto e apertar, nao remover.
*/
const RAIO_CAUSAL = 400;
const noMesmoLugar = (
  e: { a?: { x: number; y: number } },
  i: { at: { x: number; y: number } },
) => e.a === undefined || Math.abs(e.a.x - i.at.x) <= RAIO_CAUSAL;
for (const e of t.poderes) {
  if (!CONSEQUENCIAS.has(e.tipo)) continue;
  const perto = t.impacts.some(
    (i) =>
      Math.abs(i.frame - e.from) <= 30 &&
      noMesmoLugar(e, i) &&
      e.from >= i.frame - TOLERANCIA_CAUSAL,
  );
  const temImpactoProximo = t.impacts.some(
    (i) => Math.abs(i.frame - e.from) <= 30 && noMesmoLugar(e, i),
  );
  if (temImpactoProximo && !perto) {
    falhas.push({
      regra: "efeito depois da causa",
      detalhe: `${e.tipo} comeca no quadro ${e.from}, antes do impacto que o justifica`,
    });
  }
}

// ---- 4. oclusao -------------------------------------------------------------
/**
 * O raio desenhado de uma esfera cresce ate `30 + forca` (ver EsferaInferno), e
 * o halo soma mais 10%. Se esse raio alcanca o corpo de quem lancou, o poder
 * cobre o personagem -- que foi exatamente o defeito relatado na revisao da
 * luta do dominio.
 */
const ALTURA_CORPO = 600; // meia altura tipica, em unidades de mundo
for (const e of t.poderes) {
  if (e.tipo !== "esferaInferno" || !e.a) continue;
  const raio = (30 + (e.forca ?? 300)) * 1.1;
  for (const id of ids) {
    const c = corpoNoQuadro(t, id, Math.min(e.to, t.durationInFrames - 1));
    const dx = Math.abs(c.x - e.a.x);
    const dy = Math.abs(c.baseY - ALTURA_CORPO / 2 - e.a.y);
    const dist = Math.hypot(dx, dy);
    if (dist < raio * 0.72) {
      falhas.push({
        regra: "efeito nao cobre o personagem",
        detalhe: `esfera no quadro ${e.from} (raio ${raio.toFixed(0)}) alcanca ${id} a ${dist.toFixed(0)} de distancia`,
      });
      break;
    }
  }
}

// ---- 5. enquadramento -------------------------------------------------------
/**
 * No quadro de um impacto, quem levou o golpe precisa estar visivel. Camera
 * que corta o alvo bem na hora do golpe joga fora o momento que a cena inteira
 * estava construindo.
 */
const LARGURA = spec.width;

for (const imp of t.impacts) {
  const cam = cameraNoQuadro(t, imp.frame, { center: { x: 0, y: -300 }, zoom: 1 }, {
    largura: LARGURA,
    // o mesmo valor que a cena passa (ver scenes/FightScene); esta regra so
    // usa o eixo x, mas um parametro errado aqui viraria defeito na proxima
    // regra que olhar o eixo y
    alturaQuadril: -ALTURA_QUADRIL,
  });
  const meiaLargura = LARGURA / 2 / cam.zoom;
  const fora = Math.abs(imp.at.x - cam.center.x) > meiaLargura;
  if (fora) {
    falhas.push({
      regra: "impacto dentro do quadro",
      detalhe: `impacto no quadro ${imp.frame} cai fora do enquadramento (x ${imp.at.x.toFixed(0)}, camera em ${cam.center.x.toFixed(0)}, meia largura ${meiaLargura.toFixed(0)})`,
    });
  }
}

// ---- 6. paleta consistente --------------------------------------------------
/**
 * Cada lutador tem a cor dele. Trocar no meio da luta quebra a associacao que
 * o espectador levou a luta inteira para construir.
 *
 * MAS o que conta e a cor do MOMENTO, nao o total de cores no arquivo.
 *
 * A primeira versao somava todas as paletas que apareciam com o `quem` do
 * lutador, e reprovava a partir de tres. Isso confundia duas coisas
 * diferentes:
 *
 *   TROCA     ele lancava fogo no primeiro round e gelo no terceiro. O
 *             espectador perde a referencia. E o defeito que a regra existe
 *             para pegar.
 *   COMBINACAO  ele junta azul e vermelho e o resultado sai roxo, tudo dentro
 *             de tres segundos. Nao ha nada a perder aqui -- a fusao e a
 *             tecnica, e ver as tres cores e o ponto dela.
 *
 * Separar as duas e so olhar o TEMPO: eventos agrupados por proximidade
 * formam um momento, e dentro de um momento quantas cores houver e escolha.
 * O que precisa ser estavel e a cor DOMINANTE de um momento para o seguinte.
 *
 * A distincao passou a importar quando os poderes ganharam ancoragem
 * (core/types, AncoraDePoder): a partir dali `quem` passou a marcar tambem
 * "sai do corpo deste", e a esfera de fusao, que antes flutuava sem dono,
 * passou a ser atribuida a quem a segura.
 */
const INTERVALO_DE_MOMENTO = 150;
const eventosPorLutador = new Map<FighterId, { f: number; p: NomeDePaleta }[]>();
for (const e of t.poderes) {
  if (!e.quem || !e.paleta) continue;
  if (!eventosPorLutador.has(e.quem)) eventosPorLutador.set(e.quem, []);
  eventosPorLutador.get(e.quem)!.push({ f: e.from, p: e.paleta });
}
for (const [id, eventos] of eventosPorLutador) {
  eventos.sort((a, b) => a.f - b.f);
  // agrupa em momentos: corte onde o silencio entre poderes passa do limite
  const momentos: { f: number; p: NomeDePaleta }[][] = [];
  for (const ev of eventos) {
    const ultimo = momentos[momentos.length - 1];
    if (!ultimo || ev.f - ultimo[ultimo.length - 1].f > INTERVALO_DE_MOMENTO) momentos.push([ev]);
    else ultimo.push(ev);
  }
  // a cor de um momento e a que mais aparece nele
  const dominantes = momentos.map((mo) => {
    const conta = new Map<NomeDePaleta, number>();
    for (const ev of mo) conta.set(ev.p, (conta.get(ev.p) ?? 0) + 1);
    return [...conta.entries()].sort((a, b) => b[1] - a[1])[0][0];
  });
  const assinaturas = new Set(dominantes);
  if (assinaturas.size > 2) {
    falhas.push({
      regra: "paleta consistente",
      detalhe: `${id} troca de cor entre momentos: ${dominantes.join(" -> ")}`,
    });
  } else {
    notas.push(`${id}: ${[...assinaturas].join(", ")} em ${momentos.length} momento(s)`);
  }
}

// ---- relatorio --------------------------------------------------------------
console.log(`luta: ${qual}`);
console.log(`duracao: ${(t.durationInFrames / spec.fps).toFixed(1)}s`);
console.log(`lutadores: ${ids.join(" vs ")}`);
console.log(`impactos: ${t.impacts.length}   poderes: ${t.poderes.length}`);
if (notas.length) {
  console.log("\npaletas por lutador:");
  for (const n of notas) console.log(`  ${n}`);
}

if (falhas.length === 0) {
  console.log("\nAPROVADO: nenhuma regra violada.");
  process.exit(0);
}
console.log(`\nREPROVADO: ${falhas.length} ocorrencia(s).\n`);
const porRegra = new Map<string, string[]>();
for (const f of falhas) {
  if (!porRegra.has(f.regra)) porRegra.set(f.regra, []);
  porRegra.get(f.regra)!.push(f.detalhe);
}
for (const [regra, detalhes] of porRegra) {
  console.log(`  ${regra}  (${detalhes.length})`);
  for (const d of detalhes.slice(0, 4)) console.log(`     ${d}`);
  if (detalhes.length > 4) console.log(`     ... e mais ${detalhes.length - 4}`);
}
process.exit(1);
