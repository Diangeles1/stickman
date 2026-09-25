"""
PREPARA A ARTE DO CANAL nas medidas exatas do YouTube.

Entra: as artes originais em public/marca/
Sai:   out/canal/Banner.png, Avatar.png, Capa.png  (prontas para arrastar)

O PROBLEMA QUE ESTE SCRIPT RESOLVE e a AREA SEGURA do banner. O YouTube usa
UMA imagem para tres telas e corta diferente em cada uma:

    2560x1440  televisao   ve tudo
    2560x423   computador  ve so uma faixa no meio
    1235x338   celular     ve so um retangulo pequeno no centro

Quem so redimensiona a arte para 2560x1440 perde o logo no celular, que e
onde quase todo mundo olha. Entao aqui o recorte e escolhido para o LOGO cair
dentro dos 1235x338 do meio; o resto da arte fica de moldura para a TV.

Uso:  python3 scripts/preparar-marca.py
"""

from pathlib import Path
from PIL import Image

RAIZ = Path(__file__).resolve().parent.parent
ENTRADA = RAIZ / "public" / "marca"
SAIDA = RAIZ / "out" / "canal"

# ---- onde esta o logo em cada arte, em fracao da imagem -----------------------
# Medido na mao nas artes originais. Se trocar a arte, remeca isto.
LOGO_BANNER = {"cx": 0.505, "cy": 0.415, "larg": 0.385, "alt": 0.185}

# ---- medidas do YouTube -------------------------------------------------------
BANNER = (2560, 1440)
SEGURO = (1235, 338)  # o que o celular mostra, centralizado
AVATAR = (800, 800)
CAPA = (1280, 720)


def cobrir(im: Image.Image, destino: tuple[int, int]) -> Image.Image:
    """redimensiona e corta pelo centro ate preencher destino, sem distorcer"""
    lx, ly = destino[0] / im.width, destino[1] / im.height
    e = max(lx, ly)
    novo = im.resize((round(im.width * e), round(im.height * e)), Image.LANCZOS)
    x = (novo.width - destino[0]) // 2
    y = (novo.height - destino[1]) // 2
    return novo.crop((x, y, x + destino[0], y + destino[1]))


def fazer_banner() -> Image.Image:
    """
    Recorta a arte de modo que o logo fique no centro e caiba no retangulo do
    celular. O recorte e o MAIOR 16:9 cujo centro vertical bate com o centro do
    logo: assim o logo fica no meio da area segura, que e o unico lugar onde ele
    aparece em todas as telas.
    """
    im = Image.open(ENTRADA / "banner-original.webp").convert("RGB")
    W, H = im.size
    cy = LOGO_BANNER["cy"] * H
    # altura maxima de um recorte centrado em cy que ainda cabe na imagem
    h = min(2 * cy, 2 * (H - cy), H)
    w = h * BANNER[0] / BANNER[1]
    if w > W:  # se nao cabe na largura, e a largura que manda
        w, h = W, W * BANNER[1] / BANNER[0]
    x0 = max(0, min(W - w, LOGO_BANNER["cx"] * W - w / 2))
    y0 = max(0, min(H - h, cy - h / 2))
    corte = im.crop((round(x0), round(y0), round(x0 + w), round(y0 + h)))
    banner = corte.resize(BANNER, Image.LANCZOS)

    # confere: o logo cabe mesmo no retangulo do celular?
    fator = BANNER[0] / w
    lw = LOGO_BANNER["larg"] * W * fator
    lh = LOGO_BANNER["alt"] * H * fator
    print(f"  logo no banner: {lw:.0f}x{lh:.0f}px   area segura: {SEGURO[0]}x{SEGURO[1]}px")
    if lw > SEGURO[0] or lh > SEGURO[1]:
        print("  AVISO: o logo passa da area segura; ele vai ser cortado no celular")
    else:
        print(f"  ok, sobra {SEGURO[0] - lw:.0f}px na largura e {SEGURO[1] - lh:.0f}px na altura")
    return banner


def fazer_avatar() -> Image.Image:
    """
    O YouTube corta a foto num circulo. A arte JA e um circulo, entao ela e
    encaixada inteira num quadrado preto em vez de ser cortada: cortar comeria
    a borda acesa, que e o que da o brilho de gelo e fogo.
    """
    im = Image.open(ENTRADA / "logo-original.webp").convert("RGB")
    lado = max(im.size)
    quadro = Image.new("RGB", (lado, lado), (0, 0, 0))
    quadro.paste(im, ((lado - im.width) // 2, (lado - im.height) // 2))
    return quadro.resize(AVATAR, Image.LANCZOS)


def fazer_capa() -> Image.Image:
    return cobrir(Image.open(ENTRADA / "capa-original.webp").convert("RGB"), CAPA)


SAIDA.mkdir(parents=True, exist_ok=True)
for nome, fn in (("Banner", fazer_banner), ("Avatar", fazer_avatar), ("Capa", fazer_capa)):
    print(f"{nome}:")
    img = fn()
    caminho = SAIDA / f"{nome}.png"
    img.save(caminho, "PNG", optimize=True)
    kb = caminho.stat().st_size / 1024
    print(f"  {caminho.relative_to(RAIZ)}  {img.width}x{img.height}  {kb:.0f} KB")
