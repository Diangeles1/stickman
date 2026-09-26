# Diagnósticos

Índice:
- [Como registrar uma luta nova](#como-registrar-uma-luta-nova)
- [pes.mts — patinação](#pesmts--patinação)
- [contato.mts — os golpes encostam](#contatomts--os-golpes-encostam)
- [contraste.mts — a forma se lê](#contrastemts--a-forma-se-lê)
- [arcos / cadeia / ritmo / camera](#arcos--cadeia--ritmo--camera)
- [Interpretando os números](#interpretando-os-números)

## Como registrar uma luta nova

Os scripts escolhem a luta por `process.argv[2]` num encadeado de ternários.
Luta nova não aparece até ser registrada. O padrão, em cada script que você for
usar:

```ts
import { MINHA_LUTA } from "../src/data/fights/minha-luta";

const spec = qual === "minha-luta"
  ? MINHA_LUTA
  : qual.startsWith("gerada:")
  // ... resto do encadeado existente
```

Vale registrar em `contato.mts`, `pes.mts`, `arcos.mts` e `cadeia.mts` de uma
vez — são os quatro que se usa sempre.

## pes.mts — patinação

O mais importante para a sensação de "profissional". Pé apoiado que anda no
mundo é o que mais denuncia boneco arrastado por código em vez de corpo com
peso.

```bash
npx tsx scripts/pes.mts <luta>
PES_DEBUG=1 npx tsx scripts/pes.mts <luta>   # mostra quadro, poses e valor de cada escorregão
```

Critérios do script: pé a menos de 1,5 unidade do chão conta como apoiado;
mais de 1,5 de deslocamento por quadro é patinação; acima de velocidade 16 no
quadril o corpo está sendo **arrastado** de verdade e isso é permitido (e
contado separado, como "arrastado sob golpe").

**A causa mais comum, e é sempre a mesma:** reposicionar alguém com
`pose(X, "guard", frame, outroX)`. `guard` é pose de apoio mas não de
locomoção, então o motor não tem passo para dar — ele desliza o corpo inteiro.
No debug isso aparece como `guard -> guard` com um salto grande.

A correção é trocar por pose de locomoção (`retreat`, `advance`, `run1`), que
faz o motor pregar o pé e animar o passo.

## contato.mts — os golpes encostam

```bash
npx tsx scripts/contato.mts <luta>
```

Percorre as miras emitidas pelo compilador e mede, no quadro de contato, a
distância entre a ponta do membro e o ponto mirado. Imprime a vizinhança do
contato, o que permite ver se o membro **chega acelerando** ou se passa e
volta — dois golpes que "encostam" mas leem completamente diferente.

Erro pequeno (menos de ~15 unidades contra a superfície) é bom. Golpes marcados
`[ESQUIVADO]` devem errar; erro grande neles é correto.

## contraste.mts — a forma se lê

```bash
node scripts/remotion.mjs still <Comp> out/x.png --frame=N
npx tsx scripts/contraste.mts out/x.png
```

Varre um quadro renderizado, agrupa as cores e calcula a razão de contraste
WCAG de cada uma contra a cor de fundo. Varre a imagem inteira de propósito —
escolher pixel na mão leva a medir o contorno achando que é o braço.

**3.0 é o mínimo para uma forma se ler.** O script classifica em `ok`, `fraco`
e `some no fundo`.

Duas armadilhas:

1. **O membro de trás é escurecido** (fator 0.8 em `Stickman.tsx`), então a cor
   principal precisa de folga acima do limite — principal em 4.0 costuma
   colocar o membro de trás em ~2.8. Meça os dois.
2. **Clarear o fundo nem sempre ajuda.** Se corpo e fundo são da mesma família
   de cor, aproximá-los derruba a razão. Quem sobe é o corpo.

## arcos / cadeia / ritmo / camera

- **arcos.mts** — o membro descreve arco ou vai reto do ponto A ao B? Movimento
  reto lê como interpolação; arco lê como corpo.
- **cadeia.mts** — o corpo se move em cadeia (quadril primeiro, tronco depois,
  membro por último) ou tudo junto? Cadeia é o que dá peso.
- **ritmo.mts** — golpes colados sem respiro viram barulho. Mede o espaçamento.
- **camera.mts** — enquadramento vazio e sujeito fora do quadro. Trechos
  marcados `cena: true` são enquadramentos escolhidos de propósito (close no
  olho, plano aberto) e a auditoria os trata como intencionais.

## Interpretando os números

Um diagnóstico que **aprova** é informação tão útil quanto um que reprova: ele
elimina uma hipótese. Se o contato aprova e a animação continua parecendo
errada, o problema é ritmo, câmera ou arco — não adianta mexer nos golpes.

Quando um script reprova, o número é o alvo. Mexa até passar e deixe a medição
num comentário no código, no formato que o repositório já usa:

```ts
// Medido na noite (fundo #101319), membro de tras no fator 0.8:
//   #565d7d  principal 2.88  tras 2.13  (reprova nos dois)
//   #6b739b  principal 4.03  tras 2.84  (principal passa com folga)
```

Se você escolher conscientemente ficar abaixo de um limite — porque subir
custaria algo que importa mais — escreva que foi escolha e o que custaria.
Número abaixo do limite sem explicação parece descuido e alguém vai "consertar"
de volta.
