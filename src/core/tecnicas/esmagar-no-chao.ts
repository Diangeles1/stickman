/**
 * ESMAGAR NO CHAO: a cena de cenario que serve a QUALQUER palco.
 *
 * O canal passou a girar sete cenarios, e so um deles tinha cena propria --
 * `arremessoNoParedao`, que precisa da rocha do vale. Nos outros seis a luta
 * acontecia na frente do cenario sem nunca tocar nele: o combate inteiro
 * contra o corpo do outro, com o lugar servindo de papel de parede.
 *
 * O que todo palco tem e o CHAO. Esta cena usa ele como a superficie do
 * golpe: o corpo nao e empurrado para longe, e levado para cima e cravado
 * para baixo, e quem recebe a pancada e o piso. A rachadura, a poeira e o
 * tremor sao a resposta do lugar, e e isso que faz o lugar existir.
 *
 * E ELA LE COMO DECISAO, e nao como golpe sorteado. A sequencia e: fechar a
 * distancia correndo, agarrar, subir junto, virar o corpo no alto e descer
 * com ele. Cada passo depende do anterior -- um lutador que faz isso esta
 * executando um plano, nao revezando socos.
 *
 * O QUE ESTA CENA TEM QUE DEVOLVER, como toda cena: os dois na distancia de
 * combate. Terminando longe, o golpe da cena seguinte atravessa o vao durante
 * a preparacao e sai em linha reta -- foi o que `arcos` acusou quando o
 * `cercoEmProfundidade` terminava com 450 unidades entre eles.
 */

import type { Tecnica } from "./contexto";

export const esmagarNoChao: Tecnica = (ctx) => {
  const {
    G,
    F,
    c,
    s,
    estado,
    pose,
    poder,
    nome,
    cameraKeys,
    impacts,
    ALTURA_QUADRIL,
    DISTANCIA_DE_ESPERA,
  } = ctx;

  const xG = estado[G].x;
  const xF = estado[F].x;
  /** para que lado G avanca para alcancar F */
  const rumo: 1 | -1 = xG <= xF ? 1 : -1;

  // ---- 1. FECHAR A DISTANCIA, CORRENDO ------------------------------------
  /*
    O REPOSICIONAMENTO E COM POSE DE LOCOMOCAO, e isto nao e detalhe de
    estilo: `guard` e pose de apoio, e o planejador dos pes prega o pe de
    apoio nela. Mover o corpo com uma pose dessas arrasta o pe colado no
    chao, e `pes` reprova com razao. Ver POSES_DE_LOCOMOCAO em animation/corpo.
  */
  pose(F, "guard", c + s(0.15), xF);
  pose(G, "sprint1", c + s(0.3), xF - rumo * 300);
  pose(G, "coil", c + s(0.5), xF - rumo * 160);

  // ---- 2. A PEGADA --------------------------------------------------------
  const pega = c + s(0.66);
  pose(G, "punchHeavy", pega, xF - rumo * 100);
  pose(F, "hitBody", pega, xF);
  impacts.push({
    frame: pega,
    at: { x: xF - rumo * 40, y: ALTURA_QUADRIL - 140 },
    tier: "medium",
    direction: rumo,
    hitStop: 5,
    cracksGround: false,
    attacker: G,
    victim: F,
    sound: "impact",
  });

  // ---- 3. SOBEM JUNTOS ----------------------------------------------------
  /*
    OS DOIS SOBEM, e nao so o alvo. Lancar o outro para cima e ficar no chao
    olhando e outro golpe (ver `perseguicaoNoAr`, que faz exatamente isso de
    proposito). Aqui quem conduz vai junto, porque e ele que vai virar o
    corpo la em cima -- e e a subida COMPARTILHADA que separa um arremesso de
    um esmagamento.

    O arco do voo e declarado de uma vez, entre a primeira chave com
    `airborne` e a primeira sem: escrever o voo em pedacos daria varias
    parabolas curtas emendadas (a licao esta em perseguicao-no-ar).
  */
  const sobe = pega + s(0.14);
  const alto = sobe + s(0.46);
  estado[G].airborne = true;
  estado[F].airborne = true;
  pose(G, "airborne", sobe, xF - rumo * 70);
  pose(F, "launched", sobe, xF);
  pose(G, "airborne", alto, xF - rumo * 40);
  pose(F, "launched", alto, xF + rumo * 10);

  cameraKeys.push({
    frame: sobe,
    center: { x: xF - rumo * 40, y: ALTURA_QUADRIL - 420 },
    zoom: 1.0,
    ease: s(0.4),
    cena: true,
  });

  // ---- 4. A VIRADA E O MERGULHO -------------------------------------------
  /*
    O INSTANTE PARADO NO ALTO e o que faz a descida valer. Sem ele a cena e
    uma curva so, sobe e desce, e o olho le um arco de bola. Com a pausa, a
    descida vira uma DECISAO tomada la em cima.
  */
  const vira = alto + s(0.16);
  pose(G, "diveAttack", vira, xF + rumo * 10);
  pose(F, "launched", vira, xF + rumo * 30);

  const bate = vira + s(0.28);
  const onde = xF + rumo * 80;
  estado[F].airborne = false;
  estado[G].airborne = false;
  /*
    O CORPO COMPRIME NO IMPACTO E SO DEPOIS ASSENTA.

    Era `groundHit` direto no quadro da pancada, e `coreografia` reprovou com
    "leva o golpe e segue em groundHit". A razao e de amostragem e vale para
    qualquer cena: o NOME da pose vira o do destino na metade da transicao
    (ver `poseNome` em animation/sampler), entao escrevendo a pose de chegada
    no proprio quadro do impacto a vitima ja estava rotulada caida ANTES de
    cair. Pelo medidor, nada mudou quando o golpe entrou.

    `squash` no impacto e `groundHit` oito quadros depois resolvem as duas
    coisas de uma vez -- a medida e a leitura. Corpo que bate no chao comprime
    primeiro e se espalha depois; chegar ja assentado e o que faz uma queda
    parecer um boneco sendo POSICIONADO no chao.
  */
  pose(F, "squash", bate, onde);
  pose(F, "groundHit", bate + s(0.13), onde + rumo * 25);
  pose(G, "land", bate, onde - rumo * 150);

  // ---- 5. O CHAO RESPONDE -------------------------------------------------
  /*
    TRES CAMADAS, e nenhuma e enfeite. A rachadura e a marca que FICA (ela
    continua desenhada nos quadros seguintes, ver `rachaduras` em
    scenes/FightScene); o choque e o ar sendo empurrado, que e o que da
    tamanho ao golpe; e `cracksGround` no impacto e o que liga a poeira e o
    tremor do cenario. Efeito que nao mexe em nada ao redor parece colado por
    cima da cena.
  */
  impacts.push({
    frame: bate,
    at: { x: onde, y: 0 },
    tier: "extreme",
    direction: rumo,
    hitStop: 12,
    cracksGround: true,
    attacker: G,
    victim: F,
    sound: "explosion",
  });
  poder({ tipo: "rachadura", a: { x: onde, y: 0 }, from: bate, to: bate + s(1.5), forca: 420 });
  // duas ondas, a segunda maior e mais tarde: o ar cede em camadas
  poder({ tipo: "choque", a: { x: onde, y: -60 }, from: bate, to: bate + s(0.5), forca: 170 });
  poder({ tipo: "choque", a: { x: onde, y: -40 }, from: bate + 5, to: bate + s(0.62), forca: 240 });
  nome("CRATERA", G, bate + 4);

  cameraKeys.push({
    frame: bate,
    center: { x: onde, y: ALTURA_QUADRIL + 40 },
    zoom: 1.2,
    ease: 0,
    shake: 28,
    cena: true,
  });

  // ---- 6. A VOLTA A DISTANCIA DE COMBATE ----------------------------------
  /*
    QUEM LEVOU SE LEVANTA, e a cena nao termina com ele no chao: a luta
    continua depois daqui, e um beat seguinte escrito contra um corpo caido
    mira num alvo que nao esta mais la.
  */
  const levanta = bate + s(0.6);
  pose(F, "stagger", levanta, onde + rumo * 60);
  pose(G, "guard", levanta, onde - rumo * 150);
  const fim = levanta + s(0.65);
  pose(F, "guard", fim, onde + rumo * (DISTANCIA_DE_ESPERA - 150));
  pose(G, "guard", fim, onde - rumo * 150);

  cameraKeys.push({
    frame: levanta + s(0.3),
    center: { x: onde - rumo * 20, y: ALTURA_QUADRIL - 120 },
    zoom: 0.8,
    ease: s(0.5),
    cena: true,
  });

  return fim;
};
