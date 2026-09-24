"""Luta completa, 15s, na estrutura pedida pelo dono do canal.

A versao anterior gastava 11 dos 15 segundos antes do primeiro golpe, o que
mata a retencao. Aqui o primeiro soco acontece em 1,2s e cada beat dura no
maximo 2s.

Personagens com identidade, nao dois iguais:
  PRETO    = velocidade. Esquiva, combo, chute giratorio. Sem aura.
  VERMELHO = forca. Lento, cada golpe racha o cenario, aura vermelha, e quando
             acerta o outro voa.
"""
import math
import os
import random
import sys

import numpy as np
from PIL import Image, ImageDraw

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from arena import Camera, Chao, Parede, Particulas, aura, linhas_velocidade
from palito import (Boneco, CABECA, GUARDA, MAO_D, PESCOCO, PE_D, QUADRIL,
                    SOCO, CHUTE, mistura, suave)
import palito

L, A, FPS = 1080, 1920, 30
SAIDA = os.path.join(os.path.dirname(os.path.abspath(__file__)), "cena2.mp4")

FUNDO = (14, 15, 19)
CHAO_COR = (26, 28, 35)
RISCO = (9, 9, 12)
PRETO = (70, 75, 88)
VERMELHO = (214, 60, 54)
PAREDE_COR = (44, 46, 56)
PAREDE_BORDA = (22, 23, 29)

CHAO_Y = 0.0
palito.MARGEM_X = None

PUNHOS = {**GUARDA, "braco_tras_mao": (2, 34), "braco_frente_mao": (16, 34)}
BLOQUEIO = {**GUARDA, "pescoco_x": -6,
            "braco_frente_cotovelo": (26, -4), "braco_frente_mao": (34, -40),
            "braco_tras_cotovelo": (6, 10), "braco_tras_mao": (18, -24)}
ESQUIVA = {**GUARDA, "pescoco_x": -14, "cabeca_x": -10,
           "perna_tras_joelho": (-34, 58), "perna_tras_pe": (-52, 92),
           "perna_frente_joelho": (26, 60), "perna_frente_pe": (44, 92)}
SOCO_ALTO = {**SOCO, "braco_frente_mao": (92, -18), "braco_frente_cotovelo": (44, -4)}
GIRA = {**CHUTE, "perna_frente_joelho": (30, -28), "perna_frente_pe": (88, -60),
        "pescoco_x": -16}
# Corrida: duas poses alternadas. Sem isso o "corre" era teleporte e o
# primeiro segundo ficava parado, que era justamente a critica do dono.
CORRE_A = {**GUARDA, "pescoco_x": 22, "cabeca_x": 10,
           "perna_frente_joelho": (46, 30), "perna_frente_pe": (74, 62),
           "perna_tras_joelho": (-34, 54), "perna_tras_pe": (-72, 76),
           "braco_frente_cotovelo": (30, 16), "braco_frente_mao": (14, -12),
           "braco_tras_cotovelo": (-24, 24), "braco_tras_mao": (-46, 44)}
CORRE_B = {**GUARDA, "pescoco_x": 22, "cabeca_x": 10,
           "perna_frente_joelho": (-16, 40), "perna_frente_pe": (-58, 74),
           "perna_tras_joelho": (34, 34), "perna_tras_pe": (66, 60),
           "braco_frente_cotovelo": (-20, 24), "braco_frente_mao": (-42, 42),
           "braco_tras_cotovelo": (28, 18), "braco_tras_mao": (12, -10)}
CAIDO = {**GUARDA, "pescoco_x": -40, "cabeca_x": -30,
         "perna_frente_joelho": (40, 78), "perna_frente_pe": (76, 92),
         "perna_tras_joelho": (-30, 80), "perna_tras_pe": (-64, 92)}


def desenha_boneco(img, b, cam, alpha=1.0, escala_extra=1.0):
    d = ImageDraw.Draw(img, "RGBA")
    cor = b.cor + (int(255 * alpha),)
    centro = b.p[QUADRIL]
    pontos = centro + (b.p - centro) * escala_extra
    tela = cam.tela(pontos)
    larg = max(2, int(cam.escala(26 * escala_extra)))
    for a_, b_, _ in b.ossos[:12]:
        d.line([tuple(tela[a_]), tuple(tela[b_])], fill=cor, width=larg)
    rj = max(1, cam.escala(13 * escala_extra))
    for i in range(len(tela)):
        d.ellipse([tela[i][0]-rj, tela[i][1]-rj, tela[i][0]+rj, tela[i][1]+rj], fill=cor)
    rc = max(2, cam.escala(62 * escala_extra))
    c = tela[CABECA]
    d.ellipse([c[0]-rc, c[1]-rc, c[0]+rc, c[1]+rc], fill=cor)


def onda(img, cam, centro, raio, forca, cor=(255, 252, 240)):
    d = ImageDraw.Draw(img, "RGBA")
    p = cam.tela(np.array(centro))
    r = cam.escala(raio)
    a = int(235 * forca)
    d.ellipse([p[0]-r, p[1]-r*0.9, p[0]+r, p[1]+r*0.9], outline=cor + (a,),
              width=max(2, int(cam.escala(15) * forca)))


def texto(img, linhas, alpha):
    from src.images import load_font
    d = ImageDraw.Draw(img, "RGBA")
    y = 700
    for txt, tam in linhas:
        f = load_font(tam)
        w = d.textbbox((0, 0), txt, font=f, stroke_width=8)[2]
        d.text(((L - w) / 2, y), txt, font=f, fill=(255, 255, 255, int(255*alpha)),
               stroke_width=8, stroke_fill=(0, 0, 0, int(255*alpha)))
        y += tam + 34
    return img


def main():
    preto = Boneco(-620.0, CHAO_Y, espelho=False, cor=PRETO)
    verm = Boneco(620.0, CHAO_Y, espelho=True, cor=VERMELHO)
    bonecos = [preto, verm]
    chao = Chao(CHAO_Y, 5000)
    parede = Parede(1180.0, CHAO_Y, 430.0, 980.0)
    po = Particulas()
    cam = Camera(L, A, centro=(0.0, -380.0), zoom=0.70)
    cam.suavidade = 0.14

    est = [{"de": GUARDA, "para": GUARDA, "inicio": -99, "dur": 6},
           {"de": GUARDA, "para": GUARDA, "inicio": -99, "dur": 6}]
    ondas, cta, quadros = [], 0.0, []
    correndo = False
    congela, giro, aura_forca, no_ar = 0, 0.0, 0.0, [False, False]
    dash_traco = [0.0, 0.0]

    def q(s):
        return int(s * FPS)

    def golpe(quem, pose, dur, forca, alvo_junta=MAO_D, sacode=26, racha=False,
               poeira=260, congelar=2, alto=False):
        """Um golpe com CONSEQUENCIA: flash, tremor, particulas, empurrao e,
        se for do vermelho, rachadura no chao."""
        nonlocal congela, aura_forca
        atk, vit = bonecos[quem], bonecos[1 - quem]
        est[quem].update(de=GUARDA, para=pose, inicio=0, dur=dur)
        direcao = 1.0 if quem == 0 else -1.0
        vit.leva_golpe(direcao, forca)
        ponto = (atk.p[alvo_junta] + vit.p[PESCOCO]) / 2
        ondas.append([float(ponto[0]), float(ponto[1]), 0.0, 1.0])
        po.emitir(poeira, ponto, 80, (direcao * 120, -80), 620,
                  vida=(0.6, 1.9), tam=(2, 9), peso=1.0)
        cam.sacode(sacode)
        congela = congelar
        if racha:
            chao.racha_em(float(vit.p[QUADRIL][0]), semente=random.randint(1, 999))
            po.emitir(90, (float(vit.p[QUADRIL][0]), CHAO_Y), 150, (0, -300), 330,
                      vida=(0.9, 2.2), tam=(3, 12), peso=0.4)
        if alto:
            vit.ant[:, 1] += 30        # joga para CIMA

    ROT = {
        # 0-2s: os dois correndo, preto desaparece, soco, bloqueio, BOOM
        q(0.0): "corre", q(0.9): "preto_desaparece", q(1.2): "soco1",
        q(1.35): "bloqueia", q(1.45): "boom1",
        # 2-5s: combo de 4, o quarto acerta, vermelho atravessa a parede
        q(2.2): "c1", q(2.55): "c2", q(2.9): "c3", q(3.3): "c4_acerta",
        q(3.5): "parede",
        # 5-7s: silencio, poeira, vermelho aparece, aura explode
        q(5.0): "silencio", q(5.9): "verm_volta", q(6.4): "aura_explode",
        # 7-10s: vermelho massacra, preto lancado para cima
        q(7.1): "v1", q(7.7): "v2", q(8.3): "v3_lanca", q(8.9): "persegue",
        # 10-13s: preto cai, vermelho prepara o golpe final
        q(10.2): "preto_cai", q(10.9): "prepara", q(12.1): "silencio2",
        q(12.5): "dispara",
        # 13-15s: esquiva, giro, chute giratorio, vermelho na camera
        q(12.9): "esquiva", q(13.2): "giro", q(13.5): "chute_final",
        q(14.0): "cta",
    }
    TOTAL = q(15.4)

    for n in range(TOTAL):
        a = ROT.get(n)

        if a == "corre":
            correndo = True
            cam.mira(centro=(0.0, -380.0), zoom=0.70)
        elif a == "preto_desaparece":
            correndo = False
            preto.base_x = 150.0
            dash_traco[0] = 1.4
            po.emitir(70, (-380, CHAO_Y), 60, (420, -90), 240, peso=0.9)
        elif a == "soco1":
            est[0].update(de=GUARDA, para=SOCO_ALTO, inicio=n, dur=3)
            cam.mira(centro=(260.0, -420.0), zoom=0.95)
        elif a == "bloqueia":
            est[1].update(de=GUARDA, para=BLOQUEIO, inicio=n, dur=2)
        elif a == "boom1":
            ponto = (preto.p[MAO_D] + verm.p[PESCOCO]) / 2
            ondas.append([float(ponto[0]), float(ponto[1]), 0.0, 1.6])
            preto.leva_golpe(-1.0, 2400); verm.leva_golpe(1.0, 1700)
            po.emitir(320, ponto, 100, (0, -70), 820, tam=(2, 10), peso=1.0)
            po.emitir(130, (ponto[0], CHAO_Y), 220, (0, -360), 430, tam=(3, 12), peso=0.35)
            cam.sacode(52); congela = 4
            cam.mira(zoom=0.52)
        elif a in ("c1", "c2", "c3"):
            golpe(0, SOCO_ALTO if a != "c2" else SOCO, 3, 900, sacode=16,
                  poeira=120, congelar=1)
            est[1].update(de=GUARDA, para=BLOQUEIO, inicio=n, dur=2)
            cam.mira(centro=(float(verm.p[QUADRIL][0]) - 60, -420.0), zoom=1.0)
        elif a == "c4_acerta":
            golpe(0, SOCO_ALTO, 3, 3400, sacode=44, poeira=300, congelar=3)
            cam.mira(zoom=0.6)
        elif a == "parede":
            verm.base_x = 1120.0
            parede.quebra(900.0, 1500.0)
            po.emitir(360, (1140.0, -420.0), 260, (140, -160), 700,
                      vida=(1.4, 3.4), tam=(4, 16), peso=0.5)
            cam.sacode(58); congela = 3
            cam.mira(centro=(760.0, -380.0), zoom=0.5)
        elif a == "silencio":
            cam.suavidade = 0.05
            cam.mira(centro=(940.0, -360.0), zoom=0.72)
        elif a == "verm_volta":
            est[1].update(de=CAIDO, para=PUNHOS, inicio=n, dur=14)
            aura_forca = 0.35
        elif a == "aura_explode":
            aura_forca = 1.0
            ondas.append([float(verm.p[QUADRIL][0]), float(verm.p[QUADRIL][1]), 0.0, 1.5])
            po.emitir(300, verm.p[QUADRIL], 130, (0, -220), 700, tam=(3, 12), peso=0.55)
            chao.racha_em(float(verm.base_x), semente=77)
            cam.sacode(46); congela = 3
            cam.suavidade = 0.15
            cam.mira(centro=(700.0, -360.0), zoom=0.5)
        elif a in ("v1", "v2"):
            verm.base_x = float(preto.p[QUADRIL][0]) + 210
            golpe(1, SOCO if a == "v1" else CHUTE, 4, 2600, sacode=34,
                  racha=True, poeira=240, congelar=2)
            cam.mira(centro=(float(preto.p[QUADRIL][0]), -420.0), zoom=0.8)
        elif a == "v3_lanca":
            verm.base_x = float(preto.p[QUADRIL][0]) + 200
            golpe(1, CHUTE, 4, 3000, alvo_junta=PE_D, sacode=46, racha=True,
                  poeira=300, congelar=3, alto=True)
            no_ar[0] = True
            cam.mira(centro=(float(preto.p[QUADRIL][0]), -760.0), zoom=0.52)
        elif a == "persegue":
            no_ar[1] = True
            verm.ant[:, 1] += 26
            cam.mira(centro=(float(preto.p[QUADRIL][0]), -900.0), zoom=0.5)
        elif a == "preto_cai":
            no_ar[0] = no_ar[1] = False
            est[0].update(de=GUARDA, para=CAIDO, inicio=n, dur=6)
            po.emitir(200, (float(preto.p[QUADRIL][0]), CHAO_Y), 180, (0, -260), 400,
                      tam=(3, 12), peso=0.5)
            cam.sacode(30)
            cam.mira(centro=(float(preto.p[QUADRIL][0]), -260.0), zoom=0.8)
        elif a == "prepara":
            verm.base_x = float(preto.p[QUADRIL][0]) + 250
            est[1].update(de=PUNHOS, para=PUNHOS, inicio=n, dur=10)
            aura_forca = 1.0
            cam.suavidade = 0.07
            cam.mira(centro=(float(verm.base_x) - 70, -400.0), zoom=1.25)
        elif a == "silencio2":
            cam.suavidade = 0.04
        elif a == "dispara":
            est[1].update(de=PUNHOS, para=SOCO, inicio=n, dur=3)
            cam.suavidade = 0.2
        elif a == "esquiva":
            est[0].update(de=CAIDO, para=ESQUIVA, inicio=n, dur=3)
            po.emitir(90, (float(preto.p[QUADRIL][0]), CHAO_Y), 90, (-180, -130), 260, peso=0.8)
            cam.mira(zoom=0.9)
        elif a == "giro":
            giro = 1.0
            est[0].update(de=ESQUIVA, para=GIRA, inicio=n, dur=4)
        elif a == "chute_final":
            golpe(0, GIRA, 3, 5200, alvo_junta=PE_D, sacode=64, racha=True,
                  poeira=420, congelar=5)
            verm.ant[:, 1] += 16
            cam.mira(centro=(float(verm.p[QUADRIL][0]) + 120, -420.0), zoom=0.62)
        elif a == "cta":
            cam.mira(centro=(0.0, -340.0), zoom=0.54)

        if correndo:
            # avanca os dois e alterna a pose de corrida a cada 4 quadros
            preto.base_x += 24.0
            verm.base_x -= 20.0
            passo_pose = CORRE_A if (n // 4) % 2 == 0 else CORRE_B
            est[0].update(de=passo_pose, para=passo_pose, inicio=n, dur=1)
            est[1].update(de=passo_pose, para=passo_pose, inicio=n, dur=1)
            dash_traco = [0.55, 0.45]
            if n % 3 == 0:
                po.emitir(6, (preto.base_x - 40, CHAO_Y), 30, (-150, -60), 130, peso=0.9)
                po.emitir(5, (verm.base_x + 40, CHAO_Y), 30, (150, -60), 130, peso=0.9)

        if n % 8 == 0:
            po.emitir(4, (float(np.random.uniform(-900, 1300)),
                          float(np.random.uniform(-820, -60))), 260,
                      (0, -10), 26, vida=(2.2, 4.2), tam=(3, 6), peso=0.04)

        for i, (b, e) in enumerate(zip(bonecos, est)):
            t = (n - e["inicio"]) / max(1, e["dur"])
            if t < 0:
                b.alvo_pose = e["de"]
            elif t <= 1.0:
                b.alvo_pose = mistura(e["de"], e["para"], suave(t))
            elif t < 2.0:
                b.alvo_pose = e["para"]
            else:
                b.alvo_pose = mistura(e["para"], GUARDA, suave(min(1.0, t - 2.0)))
            chao_do_boneco = -1400.0 if no_ar[i] else CHAO_Y
            b.chao_y = chao_do_boneco
            b.passo(1.0 / FPS)

        po.passo(1.0 / FPS, CHAO_Y)
        parede.passo(1.0 / FPS, CHAO_Y)
        cam.passo()
        aura_forca *= 0.97
        giro *= 0.86
        dash_traco = [d * 0.8 for d in dash_traco]

        img = Image.new("RGB", (L, A), FUNDO)
        chao.desenhar(img, cam, CHAO_COR, RISCO)
        parede.desenhar(img, cam, PAREDE_COR, PAREDE_BORDA)
        po.desenhar(img, cam)
        if aura_forca > 0.05:
            aura(img, cam, verm.p[QUADRIL], 300, math.sin(n * 0.5), VERMELHO)
        for i, b in enumerate(bonecos):
            if dash_traco[i] > 0.12:
                linhas_velocidade(img, cam, b.p[QUADRIL],
                                   1.0 if i == 0 else -1.0, dash_traco[i],
                                   cor=(200, 205, 220) if i == 0 else (255, 150, 140))
            for k, pas in enumerate(b.rastro[:-1]):
                if np.linalg.norm(b.p[MAO_D] - pas[MAO_D]) > 36:
                    f = Boneco.__new__(Boneco); f.__dict__.update(b.__dict__); f.p = pas
                    desenha_boneco(img, f, cam, alpha=0.13 + 0.06 * k)
            desenha_boneco(img, b, cam)
        for o in ondas:
            fo = max(0.0, 1.0 - o[2] / 0.5) * o[3]
            if fo > 0:
                onda(img, cam, (o[0], o[1]), 70 + o[2] * 2400, min(1.0, fo))
        if giro > 0.1:
            # rotate deixa canto preto; amplia 8% e recorta de volta
            g = img.rotate(giro * 7.0, resample=Image.BILINEAR)
            m = int(L * 0.04)
            img = g.crop((m, int(A * 0.04), L - m, A - int(A * 0.04))).resize((L, A))
        if n >= q(14.0):
            cta = min(1.0, cta + 0.09)
            img = texto(img, [("CURTIU?", 118), ("DEIXA O LIKE", 92),
                              ("ELE SOBREVIVEU?", 74)], cta)

        for _ in range(1 + congela):
            quadros.append(np.asarray(img))
        congela = 0
        ondas = [[x, y, i + 1.0 / FPS, f] for x, y, i, f in ondas if i < 0.55]

    from moviepy.editor import ImageSequenceClip
    ImageSequenceClip(quadros, fps=FPS).write_videofile(
        SAIDA, codec="libx264", audio=False, logger=None, preset="medium")
    print(f"{len(quadros)} quadros -> {len(quadros)/FPS:.1f}s")
    print(SAIDA)


if __name__ == "__main__":
    main()
