"""
NARRADOR: gera as falas do locutor com o Kokoro (modelo de voz aberto,
licenca Apache 2.0), em portugues do Brasil.

Gera um WAV por fala em public/assets/audio/narrador/ e o arquivo
src/audio/falas.ts com a duracao de cada uma, que o video usa para nao
encavalar uma fala na outra.

Requisitos:
    pip install kokoro-onnx soundfile
    modelo: kokoro-v1.0.onnx e voices-v1.0.bin
    (github.com/thewh1teagle/kokoro-onnx/releases, "model-files-v1.0")

Uso:
    python3 scripts/narrar.py <pasta-do-modelo>
"""

import json
import os
import sys

import numpy as np
import soundfile as sf
from kokoro_onnx import Kokoro

VOZ = "pm_santa"
# acelerada: locutor de luta fala rapido e empolgado (1.0 soava calmo demais)
VELOCIDADE = 1.25

FALAS = {
    "escolha": "Rápido, escolha um personagem!",
    "tres": "Três!",
    "dois": "Dois!",
    "um": "Um!",
    "lutem": "Lutem!",
    # os golpes da luta nao sao narrados: tem efeitos sonoros proprios
    # (scripts/compor-efeitos.mts)
    "nocaute": "Nocaute!",
    "venceu_black": "O Preto venceu!",
    "venceu_red": "O Vermelho venceu!",
    "like": "Dá like e se inscreve no canal!",
}

# PRONUNCIA BRASILEIRA, escrita a mao em IPA.
#
# O conversor de texto para fonemas que o Kokoro usa (espeak-ng "pt-br")
# erra justamente o que faz soar brasileiro: "escolha" virava "escolia",
# "personagem" ganhava um schwa ingles ("pe-re-sonagem") e as vogais nasais
# (ẽ, ũ, ɐ̃) eram jogadas fora porque vinham num formato que o vocabulario do
# modelo nao tem. Resultado: sotaque gringo. Aqui cada fala tem a pronuncia
# de um brasileiro: "ti/di" viram "tchi/dji", "r" final aspirado, "l" final
# vira "u", e os "e/o" finais fechados viram "i/u".
N = "\u0303"  # til combinante: o unico jeito de nasal que o vocabulario aceita
PRONUNCIA = {
    "escolha": f"ʁˈapidu, iskˈoʎɐ ˈu{N} pehsonˈaʒe{N}j!",
    "tres": "tɾˈejs!",
    "dois": "dˈojs!",
    "um": f"ˈu{N}ŋ!",
    "lutem": f"lˈute{N}j!",
    "nocaute": "nokˈawʧi!",
    "venceu_black": f"u pɾˈetu ve{N}sˈew!",
    "venceu_red": f"u vehmˈeʎu ve{N}sˈew!",
    "like": f"dˈa lˈajki i si i{N}skɾˈɛvi nu kanˈaw!",
}

# CONTAGEM: "tres, dois, um" e gerado como UMA frase e cortado nos vales de
# silencio entre as palavras. Palavra curta falada sozinha e o ponto fraco do
# Kokoro (sem frase em volta ele nao acerta a entonacao e a pronuncia sai
# estranha); dentro da frase cada numero sai com a entonacao de contagem.
CONTAGEM = ["tres", "dois", "um"]
VELOCIDADE_DA_CONTAGEM = 1.05


def contagem(k: Kokoro) -> dict:
    frase = ", ".join(PRONUNCIA[c].rstrip("!") for c in CONTAGEM) + "!"
    a, taxa = k.create(frase, voice=VOZ, speed=VELOCIDADE_DA_CONTAGEM, is_phonemes=True)
    env = np.convolve(np.abs(a), np.ones(720) / 720, mode="same")
    n = len(a)

    def vale(lo: float, hi: float) -> int:
        i0, i1 = int(n * lo), int(n * hi)
        return i0 + int(np.argmin(env[i0:i1]))

    cortes = [0, vale(0.2, 0.5), vale(0.5, 0.78), n]
    print("  contagem: frase", round(n / taxa, 2), "s, cortes em", [round(c / taxa, 2) for c in cortes[1:3]])
    pedacos = {}
    for i, chave in enumerate(CONTAGEM):
        p = a[cortes[i] : cortes[i + 1]].copy()
        # rampa de 5ms nas pontas: corte seco estala
        r = int(taxa * 0.005)
        p[:r] *= np.linspace(0, 1, r)
        p[-r:] *= np.linspace(1, 0, r)
        pedacos[chave] = (p, taxa)
    return pedacos


RAIZ = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SAIDA = os.path.join(RAIZ, "public", "assets", "audio", "narrador")


def main() -> None:
    pasta = sys.argv[1] if len(sys.argv) > 1 else "."
    k = Kokoro(
        os.path.join(pasta, "kokoro-v1.0.onnx"),
        os.path.join(pasta, "voices-v1.0.bin"),
    )
    os.makedirs(SAIDA, exist_ok=True)
    duracoes = {}
    numeros = contagem(k)
    for chave, texto in FALAS.items():
        if chave in numeros:
            amostras, taxa = numeros[chave]
        else:
            amostras, taxa = k.create(
                PRONUNCIA[chave], voice=VOZ, speed=VELOCIDADE, is_phonemes=True
            )
        # corta o silencio das pontas: a fala tem que comecar no quadro
        # marcado, nao 200ms depois
        # (os numeros da contagem ja vem cortados nos vales: cortar de novo
        # comia o fim nasal do "um", que e baixinho)
        a = np.abs(amostras)
        ativo = np.where(a > 0.01)[0]
        if len(ativo) and chave not in numeros:
            amostras = amostras[max(0, ativo[0] - 240) : ativo[-1] + 2400]
        # normaliza: todas as falas no mesmo volume
        amostras = amostras * (0.9 / max(1e-6, np.max(np.abs(amostras))))
        sf.write(os.path.join(SAIDA, f"{chave}.wav"), amostras, taxa)
        duracoes[chave] = round(len(amostras) / taxa, 3)
        print(f"{chave:14s} {duracoes[chave]:.2f}s  {texto}")

    ts = [
        "/**",
        " * Falas do narrador, geradas por scripts/narrar.py (Kokoro, voz",
        f" * {VOZ}). NAO editar a mao: rode o script de novo.",
        " */",
        "",
        "export const FALAS = " + json.dumps(
            {c: {"arquivo": f"assets/audio/narrador/{c}.wav", "segundos": d, "texto": FALAS[c]}
             for c, d in duracoes.items()},
            ensure_ascii=False,
            indent=2,
        ) + " as const;",
        "",
        "export type Fala = keyof typeof FALAS;",
        "",
    ]
    with open(os.path.join(RAIZ, "src", "audio", "falas.ts"), "w", encoding="utf-8") as f:
        f.write("\n".join(ts))


if __name__ == "__main__":
    main()
