# Personalizar o canal do YouTube

Dois caminhos. O primeiro leva dois minutos e nunca quebra; o segundo é
automático, mas depende de o YouTube não ter mudado a tela.

---

## Caminho 1: na mão (recomendado)

1. Gere as imagens:
   ```
   npm install
   npm run canal
   ```
   Elas saem em `out/canal/`: `Banner.png`, `Avatar.png` e `Capa.png`.

2. Abra <https://studio.youtube.com> → **Personalização** → **Identidade visual**.
   - **Foto do perfil:** `Avatar.png`
   - **Imagem do banner:** `Banner.png`

3. Vá em **Informações básicas** e cole a descrição:

   > PALITANOS — lutas de stickman animadas quadro a quadro.
   >
   > Gelo contra fogo, katanas, poderes e nocautes.
   > Vídeo novo toda semana. Você escolhe quem vence.
   >
   > #palitanos #stickman #animation

4. **Publicar**.

---

## Caminho 2: automático

O script usa o **seu Chrome com o seu perfil já logado**. Nenhuma senha passa
por ele e nada sai da sua máquina. Por isso ele **só roda no seu computador**,
nunca numa sessão na nuvem.

```
npm i -D playwright
npm run canal                                  # gera as imagens
node scripts/canal-youtube.mjs --canal SEU_ID --ver
```

O `SEU_ID` está no endereço do Studio:
`studio.youtube.com/channel/`**`UCxxxxxxxxxxxxxxxxxx`**`/editing/images`

**Feche o Chrome por completo antes de rodar.** O Chrome não deixa dois
programas usarem o mesmo perfil ao mesmo tempo; com ele aberto, o script abre
uma janela sem o seu login e nada funciona.

Opções:

| opção | o que faz |
|---|---|
| `--ver` | mostra o navegador trabalhando (use na primeira vez) |
| `--so-imagens` | só banner e avatar |
| `--so-texto` | só a descrição |
| `--publicar` | publica sem perguntar |
| `--perfil CAMINHO` | outra pasta de perfil do Chrome |

### O que esperar

- Ele preenche tudo e **pergunta antes de publicar**.
- Se o YouTube tiver mudado a tela, ele **para e tira uma foto** em
  `canal-youtube-erro.png`, em vez de clicar em algo errado.
- O Google detecta navegador automatizado. Pode pedir verificação. Se pedir,
  faça no braço: é mais rápido que insistir.

### Trocar os textos

Estão no topo de `scripts/canal-youtube.mjs`, em `DESCRICAO`.
Para mudar a arte (frase do banner, título da capa), mexa em
`src/compositions/ArteDoCanal.tsx` e rode `npm run canal` de novo.
