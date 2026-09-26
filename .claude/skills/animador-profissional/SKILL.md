---
name: animador-profissional
description: Animar lutas de stickman no motor Remotion deste projeto com qualidade de anime de batalha — coreografar cenas que usam o cenário inteiro (arremessos longos, perseguição, destruição), melhorar efeitos visuais e sonoros, corrigir defeitos de animação e criar personagens novos. Use sempre que o pedido envolver animação, luta, coreografia, golpes, técnicas, poderes, efeitos, câmera, cenário, personagens, som, ou quando alguém disser que algo "está fraco", "falta polimento", "não parece profissional", "quer mais realista" ou pedir para melhorar/expandir um vídeo existente — mesmo sem citar nomes de arquivo.
---

# Animador profissional

Este motor transforma **dados** em luta animada. Uma luta é um `FightSpec` em
`src/data/fights/`; o compilador em `src/core/timeline.ts` lê os beats e escreve
poses, câmera, impactos e poderes. Nada é desenhado à mão quadro a quadro.

Isso muda como se melhora uma animação aqui: você não retoca frames, você
ajusta a coreografia e as regras. E como o resultado é gerado, ele pode ser
**medido** — que é o coração do método abaixo.

## Meça antes de opinar

O projeto tem 15 scripts de diagnóstico em `scripts/`. Eles existem porque
"está fraco" é impressão, e impressão não diz quanto falta nem quando parar de
mexer. Rodá-los é rápido e quase sempre revela que o defeito está em lugar
diferente do que o olho acusou.

Antes de mudar qualquer coisa por qualidade de animação, rode os que se
aplicam. Um caso real: uma luta parecia "sem polimento", o palpite era que os
golpes não encaixavam. O medidor de contato **aprovou** todos os golpes, e o
medidor de pés reprovou com 80 unidades de patinação. Mexer nos golpes teria
sido consertar a coisa errada.

```bash
# PATH: o node deste ambiente costuma não estar no PATH (ver memória do projeto)
npx tsx scripts/pes.mts <luta>        # pé plantado que desliza — o defeito que mais denuncia amadorismo
npx tsx scripts/contato.mts <luta>    # todo golpe que deveria encostar encosta?
npx tsx scripts/contraste.mts <png>   # alguma cor some no fundo?
npx tsx scripts/arcos.mts <luta>      # o membro descreve arco ou vai reto?
npx tsx scripts/cadeia.mts <luta>     # o corpo se move em cadeia (quadril → tronco → membro)?
npx tsx scripts/ritmo.mts             # os golpes têm respiro entre eles?
npx tsx scripts/camera.mts            # enquadramento vazio, sujeito fora do quadro
```

Os scripts selecionam a luta por argumento. Luta nova precisa ser registrada no
seletor de cada script — veja `references/diagnosticos.md` para o padrão, a
saída esperada de cada um e como interpretar os números.

Quando um script reprova, o número dele é o alvo: mexa até passar, e registre a
medição num comentário. Quando um script aprova, acredite nele e procure em
outro lugar.

## A luta tem que usar o espaço

O defeito mais comum de coreografia aqui: dois bonecos parados a três metros um
do outro trocando golpes, com o cenário inteiro ignorado atrás deles. Anime de
batalha não faz isso — o combate atravessa o espaço, quebra coisas, sobe, cai,
persegue.

O cenário noturno tem 3.400 unidades de extensão com ruínas em parallax. Use.

Ao coreografar, prefira:

- **Arremessos que percorrem distância de verdade** (800+ unidades), com a
  câmera acompanhando o voo. O cenário passando por trás é o que vende o
  tamanho do golpe.
- **Perseguição**: os dois cruzam a arena correndo, trocando no caminho.
- **Colisão com o cenário**, não só com o chão. Se o alvo voa, ele tem que
  bater em alguma coisa.
- **Verticalidade**: pulo, queda, golpe aéreo. Luta só na horizontal cansa.
- **Reposicionar com pose de locomoção**, nunca com pose estática. `guard` é
  pose de apoio e o motor não tem como dar passo nela — o corpo desliza com o
  pé colado no chão, e o medidor de pés reprova. Use `retreat`, `advance`,
  `run1`. Veja `POSES_DE_LOCOMOCAO` em `src/animation/corpo.ts`.

## Efeitos: recolorir antes de escrever

`src/effects/Poderes.tsx` tem um sistema de paletas. Um efeito é uma **forma**;
a paleta decide de quem ele é. O mesmo feixe serve a fogo, a energia roxa e a
um raio dourado.

Antes de escrever efeito novo, pergunte se um existente recolorido resolve —
quase sempre resolve, e custa uma fração. Paletas em `PALETAS`; para usar, o
`PoderEvent` leva `paleta: "vazio" | "azul" | "vermelho" | "sombra" | ...`.

Quando um efeito parece fraco, o problema raramente é a forma. É falta de
camadas. O que separa efeito amador de profissional:

| Camada | Por que importa |
|---|---|
| **Glow** | Energia sem brilho lê como adesivo recortado e colado na cena — a forma está certa mas não *emite* luz, e o olho cobra isso. Use os filtros `pw-glow-forte` / `pw-glow-medio` |
| **Partículas com física** | Faísca que sai reta e some é confete. Faísca desacelera no ar e **cai**. E cada uma precisa de vida própria — partícula que morre toda junta denuncia o laço que a gerou |
| **Onda de choque** | Sem ela a explosão fica do tamanho do desenho; com ela fica do tamanho do espaço que empurrou |
| **Reação do ambiente** | O poder deve iluminar o chão e os corpos, rachar o piso, levantar poeira. Efeito que não afeta nada ao redor parece colado por cima |
| **Curva temporal** | Nascimento rápido, sustentação, decaimento lento. Linear lê como mecânico |

Catálogo completo de tipos de poder, paletas e como compor cenas novas em
`references/efeitos-e-cenario.md`.

## Som

Cada impacto carrega `sound`, resolvido por `src/audio/registry.ts`. Ao criar
técnica nova, escolha o som pelo **peso** do golpe, não pelo tipo: `explosion`
para o que racha o chão, `corte` para lâmina e corte à distância, `clang` para
choque de metal, `block` para o que foi contido.

Silêncio é ferramenta. Um beat mudo antes do golpe grande faz o golpe soar mais
alto do que qualquer mixagem — o motor já usa isso no choque final.

## Convenções do repositório

Siga o estilo que já está lá, é bem específico:

- **Comentários em português sem acento**, explicando o **porquê** e não o quê.
  O código diz o que faz; o comentário diz por que é assim e o que foi tentado
  antes.
- **Registre medições nos comentários.** O padrão da casa é deixar os números
  no código: as três cores testadas com suas razões de contraste, o valor que
  reprovou e o que passou. Isso é o que impede a próxima pessoa de refazer o
  teste ou de "consertar" de volta.
- **Quando escolher ficar abaixo de um limite, diga que foi escolha e por quê.**
  Silêncio parece descuido.
- Rode `npx tsc --noEmit` antes de considerar qualquer coisa pronta.

## Personagens são originais

Ao criar ou melhorar personagens, desenhe **originais**. Arquétipos, dinâmicas
de combate, paletas e conceitos de poder são livres e carregam praticamente
todo o reconhecimento — "o veloz e técnico contra o pesado e brutal", "um
bloqueia sem se mexer, o outro corta de longe". O que não se reproduz é o
desenho específico de um personagem protegido, seus nomes e a sequência exata
de uma luta publicada.

Na prática isso quase nunca custa nada: um design próprio bem feito evoca o
arquétipo, o público faz a conexão sozinho nos comentários, e o personagem
vira um ativo do canal em vez de um problema à espera. Se alguém pedir cópia
fiel de um personagem existente, ofereça em vez disso um design próprio mais
rico — mais camadas de roupa, padrão de marcas mais elaborado, silhueta mais
distinta.

## Fluxo de trabalho

1. **Meça** com os diagnósticos que se aplicam ao que foi pedido
2. **Renderize um still** (`node scripts/remotion.mjs still <Comp> out/x.png --frame=N`)
   antes de renderizar vídeo — leva segundos em vez de minutos e resolve a
   maioria das dúvidas visuais
3. **Mude uma coisa por vez** e remeça
4. **Contact sheet para julgar o conjunto**:
   `ffmpeg -i out/v.mp4 -vf "fps=1/1.6,scale=200:-1,tile=6x2" -frames:v 1 out/grid.png`
   — a luta inteira numa imagem revela ritmo e tempo morto que o vídeo esconde
5. **Typecheck**, depois renderize o vídeo
6. **Relate o que ainda está errado.** Se um diagnóstico continua reprovando ou
   você deixou algo pela metade, diga — entregar com defeito conhecido calado é
   pior do que entregar menos.
