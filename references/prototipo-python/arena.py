"""Camera, particulas e cenario da arena dos bonecos palito.

Estes tres sistemas sao o que o roteiro exige e o primeiro protótipo nao tinha:
sem camera nao existe "revelacao lenta" nem "aproximacao no rosto"; sem
particulas nao existe poeira nem destroco; sem chao proprio nao existe
rachadura.

Tudo em coordenadas de MUNDO. A camera converte para tela no fim, entao mover
a camera nao exige recalcular pose nenhuma.
"""
import math
import random

import numpy as np
from PIL import Image, ImageDraw


class Camera:
    """Converte mundo em tela. zoom 1 = escala natural.

    O alvo e separado da posicao atual para a camera poder PERSEGUIR com
    atraso: camera que chega no lugar instantaneamente parece corte, nao
    movimento."""

    def __init__(self, larg: int, alt: int, centro, zoom: float = 1.0):
        self.larg, self.alt = larg, alt
        self.pos = np.array(centro, dtype=float)
        self.zoom = zoom
        self.alvo_pos = self.pos.copy()
        self.alvo_zoom = zoom
        self.suavidade = 0.12
        self.tremor = np.zeros(2)

    def mira(self, centro=None, zoom: float = None, imediato: bool = False):
        if centro is not None:
            self.alvo_pos = np.array(centro, dtype=float)
            if imediato:
                self.pos = self.alvo_pos.copy()
        if zoom is not None:
            self.alvo_zoom = zoom
            if imediato:
                self.zoom = zoom

    def sacode(self, forca: float):
        ang = random.uniform(0, 2 * math.pi)
        self.tremor = np.array([math.cos(ang), math.sin(ang)]) * forca

    def passo(self):
        self.pos += (self.alvo_pos - self.pos) * self.suavidade
        self.zoom += (self.alvo_zoom - self.zoom) * self.suavidade
        self.tremor *= -0.55          # inverte o sinal: vibra em vez de deslizar

    def tela(self, pontos):
        """mundo -> tela. Aceita (2,) ou (N,2)."""
        p = np.atleast_2d(np.asarray(pontos, dtype=float))
        centro = np.array([self.larg / 2, self.alt / 2])
        fora = (p - self.pos) * self.zoom + centro + self.tremor
        return fora[0] if np.ndim(pontos) == 1 else fora

    def escala(self, valor: float) -> float:
        return valor * self.zoom


class Particulas:
    """Poeira e destroco. Um array so, para o custo nao crescer com o tempo."""

    MAX = 900

    def __init__(self):
        self.pos = np.zeros((0, 2))
        self.vel = np.zeros((0, 2))
        self.vida = np.zeros(0)
        self.tam = np.zeros(0)
        self.peso = np.zeros(0)     # 0 = poeira que flutua, 1 = pedra que cai

    def emitir(self, n: int, centro, espalho: float, vel_base, vel_var: float,
                vida=(0.8, 2.4), tam=(2.0, 7.0), peso: float = 1.0):
        n = min(n, self.MAX - len(self.pos))
        if n <= 0:
            return
        ang = np.random.uniform(0, 2 * math.pi, n)
        raio = np.random.uniform(0, espalho, n)
        pos = np.array(centro, dtype=float) + np.stack(
            [np.cos(ang) * raio, np.sin(ang) * raio], axis=1)
        vel = np.array(vel_base, dtype=float) + np.random.uniform(
            -vel_var, vel_var, (n, 2))
        self.pos = np.vstack([self.pos, pos])
        self.vel = np.vstack([self.vel, vel])
        self.vida = np.concatenate([self.vida, np.random.uniform(*vida, n)])
        self.tam = np.concatenate([self.tam, np.random.uniform(*tam, n)])
        self.peso = np.concatenate([self.peso, np.full(n, peso)])

    def passo(self, dt: float, chao_y: float):
        if not len(self.pos):
            return
        self.vel[:, 1] += 900.0 * dt * self.peso          # poeira quase nao cai
        self.vel *= (1.0 - 0.9 * dt * (0.4 + self.peso[:, None]))
        self.pos += self.vel * dt
        no_chao = self.pos[:, 1] > chao_y
        self.pos[no_chao, 1] = chao_y
        self.vel[no_chao, 1] *= -0.28
        self.vel[no_chao, 0] *= 0.82
        self.vida -= dt
        vivos = self.vida > 0
        for nome in ("pos", "vel", "vida", "tam", "peso"):
            setattr(self, nome, getattr(self, nome)[vivos])

    def desenhar(self, img: Image.Image, cam: Camera, cor=(150, 150, 158)):
        if not len(self.pos):
            return
        d = ImageDraw.Draw(img, "RGBA")
        tela = cam.tela(self.pos)
        for (x, y), v, t in zip(tela, self.vida, self.tam):
            a = int(200 * min(1.0, v))
            r = max(1.0, cam.escala(t))
            d.ellipse([x - r, y - r, x + r, y + r], fill=cor + (a,))


class Chao:
    """Concreto rachado, gerado uma vez e desenhado transformado pela camera."""

    def __init__(self, y: float, largura: float, semente: int = 7):
        rnd = random.Random(semente)
        self.y = y
        self.rachaduras = []
        for _ in range(9):
            x = rnd.uniform(-largura / 2, largura / 2)
            self.rachaduras.append(self._galho(rnd, np.array([x, y]), 3))
        self.manchas = [(rnd.uniform(-largura / 2, largura / 2),
                         y + rnd.uniform(6, 150), rnd.uniform(30, 120))
                        for _ in range(26)]
        self.extras = []      # rachaduras que nascem durante a cena

    @staticmethod
    def _galho(rnd, inicio, profundidade):
        """Rachadura como galho: linha que se parte em duas. Rachadura reta
        parece risco de caneta; ramificada parece concreto."""
        linhas = []
        pilha = [(inicio, rnd.uniform(-0.5, 0.5) + math.pi / 2, profundidade,
                  rnd.uniform(60, 170))]
        while pilha:
            p, ang, prof, comp = pilha.pop()
            passos = max(2, int(comp / 22))
            atual = p.copy()
            pontos = [tuple(atual)]
            for _ in range(passos):
                ang += rnd.uniform(-0.45, 0.45)
                atual = atual + np.array([math.cos(ang), math.sin(ang)]) * 22
                atual[1] = max(atual[1], p[1] - 4)      # nao sobe do chao
                pontos.append(tuple(atual))
            linhas.append(pontos)
            if prof > 0:
                for _ in range(rnd.randint(1, 2)):
                    pilha.append((atual, ang + rnd.uniform(-1.1, 1.1),
                                  prof - 1, comp * 0.55))
        return linhas

    def racha_em(self, x: float, semente: int):
        self.extras.append(self._galho(random.Random(semente),
                                        np.array([x, self.y]), 3))

    def desenhar(self, img: Image.Image, cam: Camera, cor_chao, cor_risco):
        d = ImageDraw.Draw(img, "RGBA")
        topo = cam.tela(np.array([0.0, self.y]))[1]
        # com a camera aproximada no rosto a linha do chao sai da tela, e o
        # retangulo ficava invertido (y1 < y0). Limita antes de desenhar.
        if topo < cam.alt:
            d.rectangle([0, max(0.0, topo), cam.larg, cam.alt], fill=cor_chao)
        for cx, cy, r in self.manchas:
            p = cam.tela(np.array([cx, cy]))
            rr = cam.escala(r)
            d.ellipse([p[0] - rr, p[1] - rr * 0.22, p[0] + rr, p[1] + rr * 0.22],
                      fill=cor_risco + (40,))
        largura = max(1, int(cam.escala(3)))
        for grupo in self.rachaduras + self.extras:
            for pontos in grupo:
                tela = [tuple(cam.tela(np.array(p))) for p in pontos]
                d.line(tela, fill=cor_risco + (150,), width=largura)


class Parede:
    """Parede de concreto que quebra em pedacos.

    Os blocos existem como retangulos enquanto ela esta inteira; ao quebrar,
    cada bloco ganha velocidade propria e passa a cair. Guardar os blocos em
    vez de trocar por particulas mantem o formato de ALVENARIA no ar, que e o
    que faz parecer parede quebrando e nao pó."""

    def __init__(self, x: float, chao_y: float, largura: float, altura: float,
                  semente: int = 3):
        rnd = random.Random(semente)
        self.inteira = True
        self.blocos = []
        passo_x, passo_y = largura / 4, altura / 9
        for i in range(4):
            for j in range(9):
                # junta desalinhada por fileira, como tijolo de verdade
                desloc = (passo_x / 2) if j % 2 else 0.0
                self.blocos.append({
                    "pos": np.array([x - largura / 2 + i * passo_x + desloc,
                                     chao_y - altura + j * passo_y]),
                    "tam": np.array([passo_x * 0.96, passo_y * 0.92]),
                    "vel": np.zeros(2),
                    "ang": 0.0,
                    "vang": 0.0,
                    "jitter": rnd.uniform(-3, 3),
                })

    def quebra(self, de_x: float, forca: float):
        self.inteira = False
        for b in self.blocos:
            d = b["pos"] - np.array([de_x, b["pos"][1]])
            dist = max(60.0, abs(d[0]))
            lado = 1.0 if d[0] >= 0 else -1.0
            b["vel"] = np.array([lado * forca * (260.0 / dist),
                                 random.uniform(-forca * 0.5, -forca * 0.12)])
            b["vang"] = random.uniform(-7.0, 7.0)

    def passo(self, dt: float, chao_y: float):
        if self.inteira:
            return
        for b in self.blocos:
            b["vel"][1] += 1500.0 * dt
            b["pos"] += b["vel"] * dt
            b["ang"] += b["vang"] * dt
            if b["pos"][1] + b["tam"][1] > chao_y:
                b["pos"][1] = chao_y - b["tam"][1]
                b["vel"][1] *= -0.24
                b["vel"][0] *= 0.7
                b["vang"] *= 0.5

    def desenhar(self, img, cam, cor, cor_borda):
        d = ImageDraw.Draw(img, "RGBA")
        for b in self.blocos:
            p = cam.tela(b["pos"])
            w, h = cam.escala(b["tam"][0]), cam.escala(b["tam"][1])
            if p[0] < -w * 2 or p[0] > cam.larg + w * 2:
                continue
            if abs(b["ang"]) < 0.02:
                d.rectangle([p[0], p[1], p[0] + w, p[1] + h],
                            fill=cor, outline=cor_borda)
            else:
                # bloco girando: quatro cantos rodados a mao, mais barato que
                # criar uma imagem nova por bloco
                ca, sa = math.cos(b["ang"]), math.sin(b["ang"])
                cx, cy = p[0] + w / 2, p[1] + h / 2
                cantos = []
                for ex, ey in ((-w/2, -h/2), (w/2, -h/2), (w/2, h/2), (-w/2, h/2)):
                    cantos.append((cx + ex * ca - ey * sa, cy + ex * sa + ey * ca))
                d.polygon(cantos, fill=cor, outline=cor_borda)


def linhas_velocidade(img, cam, centro, direcao: float, forca: float,
                       cor=(255, 255, 255)):
    """Riscos horizontais atras de quem se move rapido. E o truque de anime que
    diz 'velocidade' sem precisar animar mais quadros."""
    d = ImageDraw.Draw(img, "RGBA")
    p = cam.tela(np.array(centro))
    for _ in range(int(16 * forca)):
        y = p[1] + random.uniform(-260, 220) * cam.zoom
        comp = random.uniform(120, 620) * forca
        x0 = p[0] - direcao * random.uniform(20, 200)
        d.line([x0, y, x0 - direcao * comp, y],
               fill=cor + (int(random.uniform(40, 150) * forca),),
               width=max(1, int(random.uniform(2, 6) * cam.zoom)))


def aura(img, cam, centro, raio_mundo: float, pulso: float, cor=(226, 60, 52)):
    """Brilho em camadas ao redor do personagem forte."""
    d = ImageDraw.Draw(img, "RGBA")
    p = cam.tela(np.array(centro))
    for k in range(5, 0, -1):
        r = cam.escala(raio_mundo * (0.5 + 0.16 * k) * (1.0 + 0.06 * pulso))
        d.ellipse([p[0] - r, p[1] - r, p[0] + r, p[1] + r],
                  fill=cor + (int(16 + 8 * (5 - k)),))
