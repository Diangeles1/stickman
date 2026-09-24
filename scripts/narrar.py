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

VOZ = "pm_alex"
# velocidade normal: acelerada a voz embola e perde a empolgacao
VELOCIDADE = 1.0

FALAS = {
    "escolha": "Rápido, escolha um personagem!",
    "tres": "Três!",
    "dois": "Dois!",
    "um": "Um!",
    "lutem": "Lutem!",
    "combo": "Que combo!",
    "desviou": "Desviou!",
    "contra": "Contra-ataque!",
    "pancada": "Que pancada!",
    "agora": "É agora!",
    "nocaute": "Nocaute!",
    "venceu_black": "O Preto venceu!",
    "venceu_red": "O Vermelho venceu!",
    "like": "Dá like e se inscreve no canal!",
}

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
    for chave, texto in FALAS.items():
        amostras, taxa = k.create(texto, voice=VOZ, speed=VELOCIDADE, lang="pt-br")
        # corta o silencio das pontas: a fala tem que comecar no quadro
        # marcado, nao 200ms depois
        a = np.abs(amostras)
        ativo = np.where(a > 0.01)[0]
        if len(ativo):
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
