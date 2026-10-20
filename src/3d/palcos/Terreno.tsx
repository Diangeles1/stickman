/**
 * O TERRENO do palco: o que faz o chao ler como chao.
 *
 * O problema que este arquivo resolve: num quadro VERTICAL de 1080x1920 a
 * camera mira acima do quadril, entao o terco de baixo e chao e mais nada.
 * Com um plano de uma cor so, esse terco vira uma laje -- "piso de estudio",
 * nao "lugar". E nenhum efeito por cima conserta, porque o que falta nao e
 * brilho, e INFORMACAO.
 *
 * Fundo de anime resolve isso com duas coisas, e as duas estao aqui:
 *
 *   1. VARIACAO DE VALOR NA DISTANCIA. O chao perto e mais escuro e mais
 *      saturado; o chao longe lava. Uma textura com manchas suaves e sulcos
 *      quebra a chapa sem virar ruido.
 *
 *   2. UMA FRANJA ESCURA NA FRENTE. E o recurso mais barato e mais forte de
 *      composicao de fundo pintado: silhueta quase preta na borda de baixo,
 *      perto da camera. Ela emoldura, da escala (o espectador sabe o que e
 *      capim, entao sabe o tamanho do resto) e cria tres planos onde havia
 *      um -- franja, acao, serra.
 */

import React, { useMemo } from "react";
import * as THREE from "three";
import { hashRng } from "../../core/rng";

/**
 * Textura do chao: manchas e sulcos, pintados uma vez num canvas.
 *
 * Guardada numa variavel de modulo e nao em useMemo: ela nao depende de
 * nada, e uma por processo basta. Cada remontagem criando a sua gastaria
 * memoria de GPU a toa.
 *
 * O LADRILHO E GRANDE DE PROPOSITO: 12 repeticoes num plano de 60000 dao
 * ladrilhos de 5000 unidades, que sao umas oito alturas de corpo. Menor que
 * isso e o olho pega a repeticao; maior, a variacao some do quadro.
 */
let chaoGuardado: THREE.CanvasTexture | null = null;
export const texturaDoChao = (): THREE.CanvasTexture | null => {
  if (chaoGuardado) return chaoGuardado;
  const canvas = document.createElement("canvas");
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;

  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, 256, 256);

  /*
    AS MANCHAS SAO CLARAS E ESCURAS, e nao so escuras. So escuras, a media da
    textura cai e o chao inteiro escurece junto -- o que se quer e variar em
    torno do valor, nao abaixar o valor.
  */
  for (let i = 0; i < 90; i++) {
    const r = (k: string) => hashRng(`mancha-${i}-${k}`, 7);
    const x = r("x") * 256;
    const y = r("y") * 256;
    const raio = 14 + r("r") * 46;
    const claro = r("c") > 0.5;
    const g = ctx.createRadialGradient(x, y, 0, x, y, raio);
    g.addColorStop(0, claro ? "rgba(255,255,255,0.5)" : "rgba(120,100,130,0.42)");
    g.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(x, y, raio, 0, Math.PI * 2);
    ctx.fill();
  }

  // sulcos: linhas longas e fracas, na horizontal, como terra batida
  ctx.lineCap = "round";
  for (let i = 0; i < 14; i++) {
    const r = (k: string) => hashRng(`sulco-${i}-${k}`, 11);
    const y = r("y") * 256;
    ctx.strokeStyle = `rgba(110,92,120,${0.05 + r("a") * 0.08})`;
    ctx.lineWidth = 1 + r("w") * 3;
    ctx.beginPath();
    ctx.moveTo(r("x") * 256 - 90, y);
    ctx.bezierCurveTo(60, y + (r("c1") - 0.5) * 30, 160, y + (r("c2") - 0.5) * 30, 256, y);
    ctx.stroke();
  }

  const t = new THREE.CanvasTexture(canvas);
  t.wrapS = THREE.RepeatWrapping;
  t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(12, 12);
  t.colorSpace = THREE.SRGBColorSpace;
  chaoGuardado = t;
  return t;
};

/**
 * ONDE A FRANJA FICA, e por que exatamente ai.
 *
 * A camera fica em z = +1400 (DISTANCIA_DA_CAMERA) olhando para z = 0, que e
 * o plano dos lutadores. Entao z POSITIVO e na frente deles, entre eles e a
 * lente -- e e la que a franja tem que estar.
 *
 * A 700 a escala na tela e 1400/(1400-700) = 2x a dos corpos. Com capim de
 * 150 unidades, isso da ~300 pixels de silhueta: o bastante para a borda de
 * baixo ter peso, e pouco o bastante para o topo do capim ficar ABAIXO dos
 * pes em toda a faixa de zoom da camera (medida: 0.62 a 1.46 no duelo do
 * vale). Mais perto que isso e o capim come a luta.
 */
const Z_DA_FRANJA = 700;
const ALTURA_DO_CAPIM = 115;

/**
 * Capim e pedras em silhueta, construidos como UMA geometria so.
 *
 * ShapeGeometry aceita uma LISTA de formas, e e por isso que trezentas
 * laminas cabem num unico mesh. Uma malha por lamina seriam trezentas
 * chamadas de desenho por quadro para umas formas que nem sequer tem volume.
 */
const geometriaDaFranja = (
  semente: number,
  deX: number,
  ateX: number,
): THREE.ShapeGeometry => {
  const formas: THREE.Shape[] = [];

  /*
    A FAIXA CONTINUA VEM PRIMEIRO, e sem ela nada disto funciona.

    Com so as laminas, o que aparece na borda de baixo sao formas ISOLADAS
    com ceu entre elas -- a base de cada uma fica fora do quadro e o olho le
    espinhos flutuando sobre o chao, nao um barranco de capim. A faixa e uma
    chapa que desce muito abaixo do quadro: ela da o chao de onde as laminas
    saem, e e ela que transforma a franja num PLANO em vez de um enfeite.
  */
  const faixa = new THREE.Shape();
  faixa.moveTo(deX, -6000);
  faixa.lineTo(deX, 18);
  faixa.lineTo(ateX, 18);
  faixa.lineTo(ateX, -6000);
  faixa.closePath();
  formas.push(faixa);
  const PASSO = 125;
  let i = 0;
  for (let x = deX; x < ateX; x += PASSO) {
    const r = (k: string) => hashRng(`capim-${i}-${k}`, semente);
    i++;
    // uma PEDRA de vez em quando quebra o ritmo do capim
    if (r("tipo") > 0.88) {
      const largura = 90 + r("pw") * 130;
      const altura = 40 + r("ph") * 50;
      const pedra = new THREE.Shape();
      pedra.moveTo(x - largura / 2, 0);
      pedra.quadraticCurveTo(x - largura / 3, altura, x, altura * 0.95);
      pedra.quadraticCurveTo(x + largura / 3, altura * 0.8, x + largura / 2, 0);
      pedra.closePath();
      formas.push(pedra);
      continue;
    }
    const laminas = 4 + Math.floor(r("n") * 4);
    for (let k = 0; k < laminas; k++) {
      const rk = (s: string) => hashRng(`capim-${i}-${k}-${s}`, semente);
      const base = x + (rk("o") - 0.5) * 190;
      const h = ALTURA_DO_CAPIM * (0.45 + rk("h") * 0.75);
      const inclina = (rk("i") - 0.5) * h * 0.85;
      // lamina LARGA na base: triangulo fino le como espinho, nao folha
      const largura = 26 + rk("w") * 22;
      const lamina = new THREE.Shape();
      lamina.moveTo(base - largura / 2, 0);
      // a curva e o que separa capim de serrote: lamina reta le como grafico
      lamina.quadraticCurveTo(
        base + inclina * 0.35,
        h * 0.62,
        base + inclina,
        h,
      );
      lamina.quadraticCurveTo(base + inclina * 0.2, h * 0.5, base + largura / 2, 0);
      lamina.closePath();
      formas.push(lamina);
    }
  }
  return new THREE.ShapeGeometry(formas);
};

/**
 * A franja cobre um x MUITO maior que o quadro, e isso e necessario.
 *
 * A camera persegue os lutadores, e medido com scripts/palco3d.mts eles
 * derivam cerca de 6300 unidades ao longo do duelo do vale. Uma franja que
 * so cobrisse o quadro inicial terminaria no meio do video, e o fim da
 * silhueta seria uma borda reta atravessando a tela.
 */
export const FranjaDaFrente: React.FC<{ semente: number; cor?: string }> = ({
  semente,
  cor = "#2b1b33",
}) => {
  const geometria = useMemo(
    () => geometriaDaFranja(semente, -16000, 10000),
    [semente],
  );
  return (
    <mesh geometry={geometria} position={[0, 0, Z_DA_FRANJA]}>
      {/*
        Chapada e fora da neblina: ela e o plano MAIS PROXIMO da cena, e
        bruma no que esta perto e o contrario do que a atmosfera faz.
      */}
      <meshBasicMaterial color={cor} fog={false} />
    </mesh>
  );
};
