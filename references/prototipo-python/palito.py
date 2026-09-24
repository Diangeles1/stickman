"""Protótipo: boneco palito que luta.

Técnica: pose controlada + fisica so na reacao (o que jogo usa como "powered
ragdoll"). Em pe, cada junta e puxada forte para a pose desenhada, entao o
movimento e deliberado. Ao tomar golpe, a forca de controle cai e o corpo
vira ragdoll levando o impulso: e dai que vem a sensacao de peso.

Sem engine: integracao de Verlet + restricoes de distancia resolvidas por
iteracao (Position Based Dynamics), que e curto e estavel.
"""
import numpy as np

# --- esqueleto -------------------------------------------------------------
# indices das juntas
CABECA, PESCOCO, QUADRIL = 0, 1, 2
OMBRO_E, COTOVELO_E, MAO_E = 3, 4, 5
OMBRO_D, COTOVELO_D, MAO_D = 6, 7, 8
JOELHO_E, PE_E, JOELHO_D, PE_D = 9, 10, 11, 12
N = 13

OSSOS = [
    (CABECA, PESCOCO), (PESCOCO, QUADRIL),
    (PESCOCO, OMBRO_E), (OMBRO_E, COTOVELO_E), (COTOVELO_E, MAO_E),
    (PESCOCO, OMBRO_D), (OMBRO_D, COTOVELO_D), (COTOVELO_D, MAO_D),
    (QUADRIL, JOELHO_E), (JOELHO_E, PE_E),
    (QUADRIL, JOELHO_D), (JOELHO_D, PE_D),
    # travessas que impedem o corpo de dobrar como papel
    (OMBRO_E, OMBRO_D), (OMBRO_E, QUADRIL), (OMBRO_D, QUADRIL),
]

# 2,6x o tamanho do primeiro teste: com 168px de altura o boneco ocupava 15%
# da tela vertical e nao se lia num Short.
ESCALA = 2.6

GRAVIDADE = np.array([0.0, 1700.0])
AMORTECIMENTO = 0.94
ITERACOES = 8
# (esquerda, direita) em px; None desliga
MARGEM_X = (90, 990)


def pose(base_x: float, chao_y: float, forma: dict, espelho: bool = False) -> np.ndarray:
    """Monta as coordenadas das juntas a partir de uma descricao de pose.

    forma traz deslocamentos em px relativos ao quadril. Assim uma pose e
    legivel e facil de ajustar sem recalcular angulo."""
    s = -1.0 if espelho else 1.0
    q = np.array([base_x, chao_y - 168.0 * ESCALA])
    p = np.zeros((N, 2))
    p[QUADRIL] = q
    p[PESCOCO] = q + np.array([s * forma.get("pescoco_x", 0), -74]) * ESCALA
    p[CABECA] = p[PESCOCO] + np.array([s * forma.get("cabeca_x", 0), -40]) * ESCALA
    p[OMBRO_E] = p[PESCOCO] + np.array([s * -14, 6]) * ESCALA
    p[OMBRO_D] = p[PESCOCO] + np.array([s * 14, 6]) * ESCALA
    for lado, (ombro, cotovelo, mao, pref) in enumerate((
            (OMBRO_E, COTOVELO_E, MAO_E, "braco_tras"),
            (OMBRO_D, COTOVELO_D, MAO_D, "braco_frente"))):
        cx, cy = forma.get(pref + "_cotovelo", (-18, 34))
        mx, my = forma.get(pref + "_mao", (-26, 68))
        p[cotovelo] = p[ombro] + np.array([s * cx, cy]) * ESCALA
        p[mao] = p[ombro] + np.array([s * mx, my]) * ESCALA
    for lado, (joelho, pe, pref) in enumerate((
            (JOELHO_E, PE_E, "perna_tras"), (JOELHO_D, PE_D, "perna_frente"))):
        jx, jy = forma.get(pref + "_joelho", (-10, 46))
        px_, py_ = forma.get(pref + "_pe", (-16, 92))
        p[joelho] = q + np.array([s * jx, jy]) * ESCALA
        p[pe] = q + np.array([s * px_, py_]) * ESCALA
    return p


# --- poses -----------------------------------------------------------------
GUARDA = {
    "pescoco_x": 4, "cabeca_x": 2,
    "braco_tras_cotovelo": (-6, 30), "braco_tras_mao": (10, 16),
    "braco_frente_cotovelo": (14, 30), "braco_frente_mao": (30, 12),
    "perna_tras_joelho": (-22, 46), "perna_tras_pe": (-40, 92),
    "perna_frente_joelho": (18, 46), "perna_frente_pe": (34, 92),
}
RECUA = {**GUARDA, "pescoco_x": -8, "cabeca_x": -6,
         "braco_frente_cotovelo": (-4, 34), "braco_frente_mao": (2, 20)}
SOCO = {**GUARDA, "pescoco_x": 10, "cabeca_x": 6,
        "braco_frente_cotovelo": (40, 12), "braco_frente_mao": (86, 2),
        "braco_tras_cotovelo": (-18, 28), "braco_tras_mao": (-26, 14),
        "perna_frente_joelho": (34, 46), "perna_frente_pe": (58, 92)}
CHUTE = {**GUARDA, "pescoco_x": -10, "cabeca_x": -8,
         "perna_frente_joelho": (46, 8), "perna_frente_pe": (96, -14),
         "braco_frente_cotovelo": (-10, 26), "braco_frente_mao": (-30, 4),
         "braco_tras_cotovelo": (-24, 20), "braco_tras_mao": (-48, 0)}


def mistura(a: dict, b: dict, t: float) -> dict:
    """Interpola duas poses. t=0 devolve a, t=1 devolve b."""
    out = {}
    for k in set(a) | set(b):
        va, vb = a.get(k, b.get(k)), b.get(k, a.get(k))
        if isinstance(va, tuple):
            out[k] = tuple(va[i] + (vb[i] - va[i]) * t for i in range(2))
        else:
            out[k] = va + (vb - va) * t
    return out


def suave(t: float) -> float:
    return t * t * (3 - 2 * t)


class Boneco:
    def __init__(self, base_x: float, chao_y: float, espelho: bool, cor):
        self.chao_y = chao_y
        self.espelho = espelho
        self.cor = cor
        self.base_x = base_x
        self.p = pose(base_x, chao_y, GUARDA, espelho)
        self.ant = self.p.copy()
        self.controle = 1.0        # 1 = em pe e firme, 0 = ragdoll solto
        self.solto = 0             # quadros restantes sem controle nenhum
        self.alvo_pose = GUARDA
        self.ossos = [(a, b, float(np.linalg.norm(self.p[a] - self.p[b])))
                      for a, b in OSSOS]
        self.rastro = []

    def leva_golpe(self, direcao: float, forca: float) -> None:
        """Solta o controle e joga o corpo: e o que faz o golpe ter peso."""
        self.controle = 0.0
        # SEM isso o controle volta a 0,012 no quadro seguinte e a pose cancela
        # o impulso: o corpo nem sai do lugar. A janela solta e o que deixa o
        # golpe ter peso.
        self.solto = 22
        impulso = np.array([direcao * forca, -forca * 0.42])
        self.ant = self.p - impulso * 0.016
        self.ant[CABECA] -= impulso * 0.010   # cabeca chicoteia mais

    def passo(self, dt: float) -> None:
        # Verlet
        vel = (self.p - self.ant) * AMORTECIMENTO
        self.ant = self.p.copy()
        self.p = self.p + vel + GRAVIDADE * dt * dt

        # puxa para a pose enquanto houver controle
        if self.controle > 0.01:
            desejado = pose(self.base_x, self.chao_y, self.alvo_pose, self.espelho)
            self.p += (desejado - self.p) * (0.34 * self.controle)

        # ossos com tamanho fixo
        for _ in range(ITERACOES):
            for a, b, tamanho in self.ossos:
                d = self.p[b] - self.p[a]
                dist = np.linalg.norm(d)
                if dist < 1e-6:
                    continue
                corr = d * (1 - tamanho / dist) * 0.5
                self.p[a] += corr
                self.p[b] -= corr

        # paredes invisiveis: com impulso forte o corpo saia de quadro e a
        # luta virava um boneco so na tela
        if MARGEM_X is not None:
            esq, dir_ = MARGEM_X
            fora_e = self.p[:, 0] < esq
            fora_d = self.p[:, 0] > dir_
            self.p[fora_e, 0] = esq
            self.p[fora_d, 0] = dir_
            self.ant[fora_e, 0] = esq
            self.ant[fora_d, 0] = dir_

        # chao
        fundo = self.p[:, 1] > self.chao_y
        self.p[fundo, 1] = self.chao_y
        self.ant[fundo, 1] = self.chao_y + (self.chao_y - self.ant[fundo, 1]) * 0.15

        if self.solto > 0:
            self.solto -= 1
        else:
            self.controle = min(1.0, self.controle + 0.035)
        self.rastro.append(self.p.copy())
        if len(self.rastro) > 4:
            self.rastro.pop(0)
