"""Renderiza uma luta curta de bonecos palito e salva o mp4."""
import math
import os
import sys

import numpy as np
from PIL import Image, ImageDraw

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from palito import (Boneco, CABECA, CHUTE, GUARDA, MAO_D, PE_D, RECUA, SOCO,
                    mistura, suave)

L, A, FPS = 1080, 1920, 30
CHAO = 1700
SAIDA = os.path.join(os.path.dirname(os.path.abspath(__file__)), "luta.mp4")

FUNDO = (18, 20, 26)
CHAO_COR = (30, 33, 42)
BRANCO = (238, 240, 245)
VERMELHO = (226, 78, 72)

# --- coreografia -----------------------------------------------------------
# (quadro, quem, acao). "quem" 0 = esquerda, 1 = direita
ROTEIRO = [
    (12,  0, "aproxima"),
    (26,  0, "soco"),      # acerta
    (42,  1, "recua"),
    (54,  1, "soco"),      # contra-golpe, acerta
    (70,  0, "recua"),
    (84,  0, "chute"),     # finaliza
    (112, 1, "cai"),
]
TOTAL = 190


def desenha(img: Image.Image, b: Boneco, alpha: float = 1.0) -> None:
    d = ImageDraw.Draw(img, "RGBA")
    cor = b.cor + (int(255 * alpha),)
    largura = 26
    for a_, b_, _ in b.ossos[:12]:      # so os ossos visiveis, sem travessas
        d.line([tuple(b.p[a_]), tuple(b.p[b_])], fill=cor, width=largura)
    for i in range(len(b.p)):
        r = 13
        d.ellipse([b.p[i][0] - r, b.p[i][1] - r, b.p[i][0] + r, b.p[i][1] + r], fill=cor)
    r = 62
    c = b.p[CABECA]
    d.ellipse([c[0] - r, c[1] - r, c[0] + r, c[1] + r], fill=cor,
              outline=cor, width=largura)


def quadro(n: int, bonecos, flash: float, tremor: np.ndarray,
            impactos: list) -> Image.Image:
    img = Image.new("RGB", (L, A), FUNDO)
    d = ImageDraw.Draw(img, "RGBA")
    dx, dy = int(tremor[0]), int(tremor[1])
    d.rectangle([0, CHAO + 8 + dy, L, A], fill=CHAO_COR)

    for b in bonecos:
        # rastro: posicoes anteriores bem apagadas, so quando ha velocidade
        for k, passado in enumerate(b.rastro[:-1]):
            vel = np.linalg.norm(b.p[MAO_D] - passado[MAO_D])
            if vel > 26:
                fantasma = Boneco.__new__(Boneco)
                fantasma.__dict__.update(b.__dict__)
                fantasma.p = passado + np.array([dx, dy])
                desenha(img, fantasma, alpha=0.10 + 0.05 * k)
        salvo = b.p.copy()
        b.p = b.p + np.array([dx, dy])
        desenha(img, b)
        b.p = salvo

    for cx, cy, idade in impactos:
        raio = 34 + idade * 46
        a_ = max(0.0, 1.0 - idade / 5.0)
        d.ellipse([cx - raio + dx, cy - raio + dy, cx + raio + dx, cy + raio + dy],
                  outline=(255, 255, 255, int(220 * a_)), width=max(2, int(11 * a_)))
        for k in range(7):
            ang = k * (2 * math.pi / 7) + idade
            r1, r2 = raio * 0.7, raio * 1.35
            d.line([cx + math.cos(ang) * r1 + dx, cy + math.sin(ang) * r1 + dy,
                    cx + math.cos(ang) * r2 + dx, cy + math.sin(ang) * r2 + dy],
                   fill=(255, 235, 170, int(220 * a_)), width=max(2, int(7 * a_)))

    if flash > 0.01:
        camada = Image.new("RGB", (L, A), (255, 255, 255))
        img = Image.blend(img, camada, min(0.14, flash))
    return img


def main() -> None:
    esq = Boneco(L * 0.30, CHAO, espelho=False, cor=BRANCO)
    dir_ = Boneco(L * 0.70, CHAO, espelho=True, cor=VERMELHO)
    bonecos = [esq, dir_]

    acoes = {n: (q, a) for n, q, a in ROTEIRO}
    estado = [{"pose_de": GUARDA, "pose_para": GUARDA, "inicio": 0, "dur": 10}
              for _ in bonecos]
    flash, impactos, tremor = 0.0, [], np.zeros(2)
    quadros, congelar = [], 0

    for n in range(TOTAL):
        if n in acoes:
            quem, acao = acoes[n]
            b, e = bonecos[quem], estado[quem]
            outro = bonecos[1 - quem]
            if acao == "aproxima":
                b.base_x += 150 if quem == 0 else -150
            elif acao in ("soco", "chute"):
                e.update(pose_de=GUARDA, pose_para=SOCO if acao == "soco" else CHUTE,
                         inicio=n, dur=5)
                # o golpe conecta 5 quadros depois da largada
                acoes[n + 5] = (1 - quem, "apanha_" + acao)
            elif acao == "recua":
                e.update(pose_de=GUARDA, pose_para=RECUA, inicio=n, dur=6)
            elif acao.startswith("apanha"):
                forte = acao.endswith("chute")
                direcao = 1.0 if quem == 1 else -1.0
                b.leva_golpe(direcao, 2900 if forte else 1700)
                junta = PE_D if forte else MAO_D
                impactos.append([float(outro.p[junta][0]), float(outro.p[junta][1]), 0])
                flash = 0.30 if forte else 0.18
                tremor = np.array([direcao * (34 if forte else 20), -9.0])
                congelar = 3 if forte else 2
            elif acao == "cai":
                # mesmo cuidado do leva_golpe: sem janela solta o controle
                # recupera em 29 quadros e o boneco se levanta sozinho
                b.controle = 0.0
                b.solto = 9999

        for b, e in zip(bonecos, estado):
            t = (n - e["inicio"]) / max(1, e["dur"])
            if t <= 1.0:
                b.alvo_pose = mistura(e["pose_de"], e["pose_para"], suave(max(0.0, t)))
            elif t < 1.9:      # segura o golpe estendido antes de voltar
                b.alvo_pose = e["pose_para"]
            elif t < 3.2:
                b.alvo_pose = mistura(e["pose_para"], GUARDA, suave((t - 1.9) / 1.3))
            else:
                b.alvo_pose = GUARDA
            b.passo(1.0 / FPS)

        img = quadro(n, bonecos, flash, tremor, impactos)
        repeticoes = 1 + (congelar if congelar > 0 else 0)
        for _ in range(repeticoes):
            quadros.append(np.asarray(img))
        congelar = 0

        flash *= 0.55
        tremor = tremor * -0.52
        impactos = [[x, y, i + 1] for x, y, i in impactos if i < 5]

    from moviepy.editor import ImageSequenceClip
    clipe = ImageSequenceClip(quadros, fps=FPS)
    clipe.write_videofile(SAIDA, codec="libx264", audio=False, logger=None,
                          preset="medium")
    print(f"{len(quadros)} quadros -> {len(quadros)/FPS:.1f}s")
    print(SAIDA)


if __name__ == "__main__":
    main()
