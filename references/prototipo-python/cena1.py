"""Abertura do roteiro: preto -> revelacao -> encarada -> punhos -> rachadura
-> aproximacao no rosto -> silencio -> dash -> soco -> bloqueio -> onda de
choque -> deslizada.

Fatia vertical: se esta parte ficar boa, o resto do roteiro e mais do mesmo.
"""
import math
import os
import sys

import numpy as np
from PIL import Image, ImageDraw

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from arena import Camera, Chao, Particulas
from palito import (Boneco, CABECA, GUARDA, MAO_D, PESCOCO, QUADRIL, SOCO,
                    mistura, suave)
import palito

L, A, FPS = 1080, 1920, 30
SAIDA = os.path.join(os.path.dirname(os.path.abspath(__file__)), "cena1.mp4")

FUNDO = (14, 15, 19)
CHAO_COR = (26, 28, 35)
RISCO = (10, 10, 13)
PRETO = (66, 71, 84)       # nao pode ser preto de verdade: contra FUNDO (14,15,19)
                           # ele desaparecia. Este cinza-azulado le como preto na tela
VERMELHO = (214, 64, 58)

CHAO_Y = 0.0               # mundo: o chao e a origem em y
palito.MARGEM_X = None     # a arena e larga, quem limita e a camera

# poses novas que o roteiro pede
PUNHOS = {**GUARDA, "braco_tras_mao": (2, 34), "braco_frente_mao": (16, 34),
          "braco_tras_cotovelo": (-10, 26), "braco_frente_cotovelo": (12, 26)}
PROVOCA = {**GUARDA, "cabeca_x": 16}          # inclina a cabeca de lado
BLOQUEIO = {**GUARDA, "pescoco_x": -6,
            "braco_frente_cotovelo": (26, -4), "braco_frente_mao": (34, -40),
            "braco_tras_cotovelo": (6, 10), "braco_tras_mao": (18, -24)}


def desenha_boneco(img, b, cam, alpha=1.0):
    d = ImageDraw.Draw(img, "RGBA")
    cor = b.cor + (int(255 * alpha),)
    tela = cam.tela(b.p)
    largura = max(2, int(cam.escala(26)))
    for a_, b_, _ in b.ossos[:12]:
        d.line([tuple(tela[a_]), tuple(tela[b_])], fill=cor, width=largura)
    rj = max(1, cam.escala(13))
    for i in range(len(tela)):
        d.ellipse([tela[i][0] - rj, tela[i][1] - rj,
                   tela[i][0] + rj, tela[i][1] + rj], fill=cor)
    rc = max(2, cam.escala(62))
    c = tela[CABECA]
    d.ellipse([c[0] - rc, c[1] - rc, c[0] + rc, c[1] + rc], fill=cor)


def onda(img, cam, centro, raio_mundo, forca):
    d = ImageDraw.Draw(img, "RGBA")
    p = cam.tela(np.array(centro))
    r = cam.escala(raio_mundo)
    a = int(235 * forca)
    d.ellipse([p[0] - r, p[1] - r * 0.92, p[0] + r, p[1] + r * 0.92],
              outline=(255, 252, 240, a), width=max(2, int(cam.escala(14) * forca)))
    r2 = r * 0.7
    d.ellipse([p[0] - r2, p[1] - r2 * 0.92, p[0] + r2, p[1] + r2 * 0.92],
              outline=(255, 226, 150, int(a * 0.6)),
              width=max(1, int(cam.escala(7) * forca)))


def main():
    preto = Boneco(-300.0, CHAO_Y, espelho=False, cor=PRETO)
    verm = Boneco(300.0, CHAO_Y, espelho=True, cor=VERMELHO)
    bonecos = [preto, verm]
    chao = Chao(CHAO_Y, 4000)
    poeira = Particulas()
    cam = Camera(L, A, centro=(0.0, -260.0), zoom=0.62)

    estado = [{"de": GUARDA, "para": GUARDA, "inicio": -99, "dur": 10},
              {"de": GUARDA, "para": GUARDA, "inicio": -99, "dur": 10}]

    # roteiro em segundos -> quadro
    def q(s):
        return int(s * FPS)

    ROTEIRO = {
        q(0.0):  "preto_total",
        q(1.8):  "revela",
        q(5.6):  "punhos",
        q(6.6):  "crack",
        q(7.6):  "provoca",
        q(8.6):  "aproxima_rosto",
        q(10.2): "silencio",
        q(10.9): "dash",
        q(11.5): "soco",
        q(11.75): "bloqueio",
        q(11.85): "klang",
        q(13.6): "recarrega",
    }
    TOTAL = q(15.0)

    fade = 1.0          # 1 = tela preta
    ondas = []
    congela = 0
    quadros = []
    dash_de = None

    for n in range(TOTAL):
        acao = ROTEIRO.get(n)

        if acao == "revela":
            cam.mira(centro=(0.0, -300.0), zoom=0.52)
            cam.suavidade = 0.022          # revelacao LENTA
        elif acao == "punhos":
            estado[1].update(de=GUARDA, para=PUNHOS, inicio=n, dur=26)
        elif acao == "crack":
            chao.racha_em(verm.base_x, semente=11)
            poeira.emitir(70, (verm.base_x, CHAO_Y), 70, (0, -120), 190,
                          vida=(0.7, 1.8), tam=(2, 6), peso=0.9)
            cam.sacode(9)
        elif acao == "provoca":
            estado[0].update(de=GUARDA, para=PROVOCA, inicio=n, dur=14)
        elif acao == "aproxima_rosto":
            cam.suavidade = 0.16
            ca, cb = preto.p[CABECA], verm.p[CABECA]
            meio = (ca + cb) / 2
            # o zoom vem da distancia entre as cabecas, com folga de 22% nas
            # laterais. Zoom fixo cortava um dos dois fora do quadro.
            largura_alvo = abs(cb[0] - ca[0]) * 1.22 + 260
            cam.mira(centro=(meio[0], meio[1] + 60), zoom=min(1.4, L / largura_alvo))
        elif acao == "silencio":
            cam.suavidade = 0.06
        elif acao == "dash":
            cam.suavidade = 0.10
            cam.mira(centro=(120.0, -280.0), zoom=0.62)
            dash_de = preto.base_x
            preto.base_x = verm.base_x - 210
            estado[0].update(de=PROVOCA, para=SOCO, inicio=n, dur=7)
            poeira.emitir(60, (dash_de, CHAO_Y), 50, (260, -90), 210,
                          vida=(0.5, 1.2), tam=(2, 7), peso=0.9)
        elif acao == "soco":
            estado[0].update(de=PROVOCA, para=SOCO, inicio=n, dur=4)
        elif acao == "bloqueio":
            estado[1].update(de=PUNHOS, para=BLOQUEIO, inicio=n, dur=3)
        elif acao == "klang":
            ponto = (verm.p[PESCOCO] + preto.p[MAO_D]) / 2
            ondas.append([float(ponto[0]), float(ponto[1]), 0.0])
            preto.leva_golpe(-1.0, 2100)
            verm.leva_golpe(1.0, 1500)
            poeira.emitir(300, ponto, 90, (0, -60), 760,
                          vida=(0.9, 2.6), tam=(2, 9), peso=1.0)
            poeira.emitir(120, (ponto[0], CHAO_Y), 200, (0, -330), 420,
                          vida=(1.2, 2.8), tam=(3, 11), peso=0.35)
            cam.sacode(46)
            congela = 4
        elif acao == "recarrega":
            preto.base_x = float(preto.p[QUADRIL][0])
            estado[0].update(de=GUARDA, para=GUARDA, inicio=n, dur=10)

        # poeira do ar, sempre
        if n % 7 == 0:
            poeira.emitir(5, (float(np.random.uniform(-800, 800)),
                              float(np.random.uniform(-760, -60))), 240,
                          (0, -10), 26, vida=(2.4, 4.4), tam=(3.0, 6.5), peso=0.04)

        for b, e in zip(bonecos, estado):
            t = (n - e["inicio"]) / max(1, e["dur"])
            if t < 0:
                b.alvo_pose = e["de"]
            elif t <= 1.0:
                b.alvo_pose = mistura(e["de"], e["para"], suave(t))
            elif t < 2.4:
                b.alvo_pose = e["para"]
            else:
                b.alvo_pose = mistura(e["para"], GUARDA, suave(min(1.0, t - 2.4)))
            b.passo(1.0 / FPS)

        poeira.passo(1.0 / FPS, CHAO_Y)
        cam.passo()

        img = Image.new("RGB", (L, A), FUNDO)
        chao.desenhar(img, cam, CHAO_COR, RISCO)
        poeira.desenhar(img, cam)
        for b in bonecos:
            for k, passado in enumerate(b.rastro[:-1]):
                if np.linalg.norm(b.p[MAO_D] - passado[MAO_D]) > 40:
                    fantasma = Boneco.__new__(Boneco)
                    fantasma.__dict__.update(b.__dict__)
                    fantasma.p = passado
                    desenha_boneco(img, fantasma, cam, alpha=0.12 + 0.06 * k)
            desenha_boneco(img, b, cam)
        for o in ondas:
            forca = max(0.0, 1.0 - o[2] / 0.55)
            if forca > 0:
                onda(img, cam, (o[0], o[1]), 60 + o[2] * 2100, forca)

        # fade de entrada: a tela nasce preta e abre junto da revelacao
        if n >= q(1.8):
            fade = max(0.0, fade - 0.012)
        if fade > 0.002:
            img = Image.blend(img, Image.new("RGB", (L, A), (0, 0, 0)), min(1.0, fade))

        for _ in range(1 + congela):
            quadros.append(np.asarray(img))
        congela = 0
        ondas = [[x, y, i + 1.0 / FPS] for x, y, i in ondas if i < 0.6]

    from moviepy.editor import ImageSequenceClip
    ImageSequenceClip(quadros, fps=FPS).write_videofile(
        SAIDA, codec="libx264", audio=False, logger=None, preset="medium")
    print(f"{len(quadros)} quadros -> {len(quadros)/FPS:.1f}s")
    print(SAIDA)


if __name__ == "__main__":
    main()
