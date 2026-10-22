/**
 * As pecas que TODO palco 3D usa.
 *
 * Elas nasceram dentro do palco do entardecer, que era o unico. Com o segundo
 * e o terceiro, continuar copiando seria repetir a mesma licao que
 * backgrounds/Obstaculo ja ensinou neste repositorio: arte duplicada vira
 * restricao: tres copias de "ceu" significam que melhorar o ceu e tres
 * edicoes, e que duas delas vao ser esquecidas.
 *
 * O que fica aqui e o que e MECANISMO. O que e identidade de cada palco --
 * quais cores, quantas bandas, o que tem no horizonte -- fica no palco.
 */

import React, { useMemo } from "react";
import * as THREE from "three";
import { hashRng } from "../../core/rng";

/**
 * Rampa de degraus para o meshToonMaterial.
 *
 * O material toon nao decide sozinho quantas bandas usar: ele consulta esta
 * textura. Sem ela o Three usa uma rampa de dois degraus e tudo fica preto ou
 * branco. NearestFilter e obrigatorio -- com filtro linear os degraus se
 * misturam e volta a ser degrade, que e exatamente o que os palcos evitam.
 */
export const rampaDeDegraus = (degraus: number[]): THREE.DataTexture => {
  const dados = new Uint8Array(degraus.length * 4);
  degraus.forEach((v, i) => {
    const c = Math.round(v * 255);
    dados.set([c, c, c, 255], i * 4);
  });
  const t = new THREE.DataTexture(dados, degraus.length, 1);
  t.minFilter = THREE.NearestFilter;
  t.magFilter = THREE.NearestFilter;
  t.needsUpdate = true;
  return t;
};

/** Uma parada do degrade do ceu: posicao de 0 (topo) a 1 (horizonte). */
export type ParadaDoCeu = [number, string];

/*
  AS TEXTURAS DE CEU SAO GUARDADAS POR RECEITA, e nao por componente.

  Cada palco pede sempre o mesmo degrade, e o Remotion remonta a arvore a
  cada quadro. Sem o cache, cada quadro criaria uma textura nova de 512
  linhas e a GPU ia acumulando lixo durante um render de 3000 quadros.
*/
const ceusGuardados = new Map<string, THREE.CanvasTexture | null>();

/** O ceu: uma chapa enorme ao fundo, com degrade vertical pintado. */
export const CeuEmDegrade: React.FC<{ paradas: ParadaDoCeu[] }> = ({
  paradas,
}) => {
  const chave = JSON.stringify(paradas);
  const textura = useMemo(() => {
    if (ceusGuardados.has(chave)) return ceusGuardados.get(chave) ?? null;
    const canvas = document.createElement("canvas");
    canvas.width = 4;
    canvas.height = 512;
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      ceusGuardados.set(chave, null);
      return null;
    }
    const grad = ctx.createLinearGradient(0, 0, 0, 512);
    for (const [pos, cor] of paradas) grad.addColorStop(pos, cor);
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 4, 512);
    const t = new THREE.CanvasTexture(canvas);
    t.colorSpace = THREE.SRGBColorSpace;
    ceusGuardados.set(chave, t);
    return t;
  }, [chave, paradas]);

  if (!textura) return null;
  /*
    O ceu fica a 26000 de distancia e e ENORME. Ele precisa cobrir o quadro
    inteiro no zoom mais aberto da camera, e a camera abre bastante quando os
    dois lutadores se separam (ver enquadrarDois em camera/camera).
  */
  return (
    <mesh position={[0, 3000, -26000]}>
      <planeGeometry args={[80000, 34000]} />
      <meshBasicMaterial map={textura} fog={false} depthWrite={false} />
    </mesh>
  );
};

/** Uma banda do horizonte: silhueta recortada, chapada, numa distancia so. */
export type Banda = {
  z: number;
  altura: number;
  cor: string;
  largura: number;
  /** Quantos recortes a banda tem ao longo da largura. */
  picos?: number;
  /**
   * A FORMA do recorte, e ela nao e opcional de verdade.
   *
   * Tentei primeiro que "serra" com muitos picos virasse skyline, e o render
   * desmentiu na hora: subir a contagem de picos da MONTANHAS MENORES, nao
   * predios. O que distingue uma linha de predios e topo CHATO e lateral
   * VERTICAL -- sao duas geometrias, nao uma com outro parametro.
   */
  tipo?: "serra" | "predios";
};

/**
 * Uma banda recortada, chapada, numa distancia so.
 *
 * O recorte sai de `hashRng` com a semente do palco, entao o mesmo palco sai
 * igual em todo quadro -- o Remotion desenha cada quadro isolado e um
 * Math.random aqui tremeria o horizonte inteiro a 60 Hz.
 */
export const BandaDoHorizonte: React.FC<{
  semente: number;
  indice: number;
  banda: Banda;
}> = ({ semente, indice, banda }) => {
  const { z, altura, cor, largura, picos = 9, tipo = "serra" } = banda;
  const geometria = useMemo(() => {
    const forma = new THREE.Shape();
    const passo = largura / picos;
    forma.moveTo(-largura / 2, -4000);
    forma.lineTo(-largura / 2, 0);
    for (let i = 0; i <= picos; i++) {
      const r = hashRng(`banda-${indice}-${i}`, semente);
      const x = -largura / 2 + i * passo;
      if (tipo === "predios") {
        /*
          Sobe reto, atravessa o topo, desce reto. A largura varia com o
          sorteio para a linha nao virar um pente: predios iguais lado a
          lado leem como grade, e grade nao e cidade.
        */
        const r2 = hashRng(`larg-${indice}-${i}`, semente);
        const h = altura * (0.3 + r * 0.7);
        const w = passo * (0.55 + r2 * 0.4);
        forma.lineTo(x, h);
        forma.lineTo(x + w, h);
        forma.lineTo(x + w, 0);
        forma.lineTo(x + passo, 0);
      } else {
        // picos alternados alto/baixo: cume isolado le melhor que serrote
        const h = altura * (0.45 + r * 0.55) * (i % 2 === 0 ? 1 : 0.62);
        forma.lineTo(x + passo * 0.5, h);
        forma.lineTo(x + passo, h * 0.4);
      }
    }
    forma.lineTo(largura / 2, -4000);
    forma.closePath();
    return new THREE.ShapeGeometry(forma);
  }, [semente, indice, altura, largura, picos, tipo]);

  return (
    <mesh geometry={geometria} position={[0, 0, z]}>
      <meshBasicMaterial color={cor} fog={false} />
    </mesh>
  );
};

/**
 * As bandas, da mais distante para a mais proxima.
 *
 * A ordem das cores nelas e sempre a mesma regra: o que esta LONGE e mais
 * CLARO e menos saturado, porque o ar entre o olho e a forma espalha luz.
 * Banda distante pintada mais escura le como buraco, nao como distancia.
 */
export const BandasDoHorizonte: React.FC<{
  semente: number;
  bandas: Banda[];
}> = ({ semente, bandas }) => (
  <>
    {bandas.map((b, i) => (
      <BandaDoHorizonte key={i} semente={semente} indice={i} banda={b} />
    ))}
  </>
);
