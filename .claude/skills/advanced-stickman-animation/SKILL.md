---
name: advanced-stickman-animation
description: Evoluir o motor de animação deste projeto (Remotion + rig de 13 juntas) para que o stickman se mova como personagem animado por um animador humano — peso, equilíbrio, antecipação, timing, spacing, arcos, follow-through, overlapping action, secondary motion, impacto e transições. Use sempre que o pedido envolver melhorar movimento, animação, poses, golpes, combos, saltos, corrida, esquiva, câmera cinematográfica, física visual, ou quando alguém disser que algo "está robótico", "parece bugado", "não tem peso", "falta polimento" ou pedir para evoluir/refatorar o motor — mesmo sem citar arquivos.
---

# Motor de animação avançada

Este motor transforma **dados** em animação. Uma luta é um `FightSpec` em
`src/data/fights/`; `src/core/timeline.ts` compila os beats em quadros-chave;
`src/animation/sampler.ts` resolve a pose de cada quadro; `src/scenes/` e
`src/characters/` desenham. Nada é animado à mão quadro a quadro.

Isso tem duas consequências que governam todo trabalho aqui: melhorar a
animação significa mexer em **regras**, não em frames; e como o resultado é
gerado, ele pode ser **medido**.

## Antes de construir, descubra o que já existe

O erro mais caro nesta base é reimplementar algo que já está lá. Aconteceu de
verdade: numa sessão, "blending entre ações" foi listado como o maior buraco do
motor — e o `amostrarCru` já fazia mistura de poses com atraso por junta, curva
escolhida pelo par origem→destino e ciclos de locomoção resolvidos por fase.
Uma tarde quase foi gasta construindo o que existia.

Comece sempre lendo `references/arquitetura.md`, que mapeia o que está
implementado e onde. Depois confirme no código — o mapa pode ter envelhecido.
Só então decida o que falta.

Quando encontrar algo que parece faltar, procure por sinônimos antes de
concluir: `misturar`, `atrasoPara`, `curvaPara`, `ELEVACAO_DA_PASSADA`,
`POSES_COM_POSTURA`, `agachamento`, `inclinacaoDoCorpo`. O vocabulário do
projeto é português e nem sempre bate com o termo técnico em inglês.

## Meça antes e depois, sempre

Há 16 scripts em `scripts/`. Eles existem porque "está robótico" é impressão, e
impressão não diz quanto falta nem quando parar. Rodar os que se aplicam custa
segundos e frequentemente revela que o defeito está em outro lugar.

```bash
npx tsx scripts/qualidade.mts <luta>   # teleporte, causalidade, oclusão, enquadramento, paleta
npx tsx scripts/pes.mts <luta>         # patinação — o defeito que mais denuncia amadorismo
npx tsx scripts/contato.mts <luta>     # todo golpe que deveria encostar encosta?
npx tsx scripts/cadeia.mts <luta>      # o corpo se move em cadeia ou como bloco?
npx tsx scripts/arcos.mts <luta>       # o membro descreve arco ou vai reto?
npx tsx scripts/contraste.mts <png>    # alguma forma some no fundo?
npx tsx scripts/ritmo.mts              # os golpes têm respiro entre eles?
```

Registre o número **antes** de mexer. Sem isso não há como saber se a mudança
ajudou — e mudança que não se prova vira dívida.

Duas armadilhas reais, ambas já aconteceram aqui:

**Um medidor que aprova é informação tão útil quanto um que reprova.** Numa
luta que "não tinha polimento", o palpite era que os golpes não encaixavam. O
`contato.mts` aprovou tudo e o `pes.mts` reprovou com 80 unidades de patinação.
Mexer nos golpes teria sido consertar a coisa certa no lugar errado.

**Cobertura tem limite.** O `cadeia.mts` audita só golpes; poses de poder não
passam por ele. Uma melhoria real nelas mediu exatamente igual. Se o número não
mexeu, pergunte se o medidor cobre o que você mudou antes de concluir que a
mudança não funcionou.

## Mudança incremental, e regressão é inevitável

Nunca reescreva o motor. Reutilize o rig, o renderer, a timeline, o sampler, a
câmera e as partículas. Camada nova só quando não houver onde encaixar.

Mudança pequena quebra coisa distante — conte com isso. Exemplos reais:
ajustar proporções dos lutadores desalinhou os pés (patinação 36 → 63) porque a
distância de combate deriva da espessura do traço; remover as armas de uma luta
quebrou o contato, porque os beats usavam golpes de katana cuja distância é
calculada pelo alcance da lâmina.

Por isso: **rode a bateria inteira depois de cada mudança**, não só o medidor da
área que você tocou. E `npx tsc --noEmit` antes de considerar qualquer coisa
pronta.

## Princípios de animação, traduzidos para este rig

`references/movimento.md` tem o detalhamento. O resumo do que importa aqui:

**Antecipação, ação e recuperação** já existem por golpe no `AttackDef`
(`windup`, `strike`, `recover`, `contactAt`, `seguimento`). Golpe pesado pede
antecipação maior; golpe rápido, menor. São números no registro de ataques.

**Overlapping action** é implementado como `PerfilDeAtraso`: cada junta recebe
uma janela `[início, fim]` dentro da transição, e a corrente se propaga. Um
perfil novo é uma constante em `characters/skeleton.ts` mais um `case` em
`atrasoPara`. Pose sem perfil move o corpo inteiro como bloco — foi o que
acontecia com as poses de poder até ganharem `ATRASO_DO_PODER`.

**Spacing** é a curva escolhida por `curvaPara(destino)`. Golpe acelera até o
contato (`disparo`), reação nasce no impacto (`estalo`), knockback sai rápido e
desacelera (`saidaRapida`), o resto é `suave`. Pose sem caso cai no default, e
o default raramente é o certo para movimento com intenção.

**Peso** vem de onde a corrente começa. Um lançamento que planta os pés antes
de empurrar lê como arremesso; o mesmo lançamento com todas as juntas no mesmo
quadro lê como troca de figura. Quando o movimento parecer leve, olhe o perfil
de atraso antes de olhar o desenho.

**Secondary motion** usa `velocidade` do corpo, que chega ao `Stickman` por
prop. O cabelo já a consome. Roupa e peças soltas são o próximo caso natural.

## Personagens são originais

Ao criar ou ajustar personagens, desenhe originais. Arquétipos, dinâmicas de
combate, paletas e conceitos de poder são livres e carregam quase todo o
reconhecimento. O que não se reproduz é o desenho específico de personagem
protegido, seus nomes e a sequência exata de uma luta publicada. Se pedirem
cópia fiel, ofereça um design próprio mais rico — mais camadas de roupa, padrão
de marcas mais elaborado, silhueta mais distinta.

## Fluxo de trabalho

1. **Leia** `references/arquitetura.md` e confirme no código
2. **Meça** com os scripts que se aplicam, e anote os números
3. **Mude uma coisa**, com o porquê num comentário
4. **Typecheck**, depois remeça a bateria inteira
5. **Still antes de vídeo**: `node scripts/remotion.mjs still <Comp> out/x.png --frame=N`
   resolve em segundos o que o render resolveria em minutos
6. **Contact sheet para julgar o conjunto**:
   `ffmpeg -i out/v.mp4 -vf "fps=1/1.6,scale=200:-1,tile=6x2" -frames:v 1 out/grid.png`
7. **Relate o que ficou errado.** Medidor ainda reprovando, item pela metade,
   trade-off assumido — dizer é parte do trabalho. Entregar com defeito
   conhecido calado é pior que entregar menos.

## Convenções do repositório

Comentários em português sem acento, explicando o **porquê** e não o quê.
Registre medições no código — o padrão da casa é deixar os números lá: as cores
testadas com suas razões, o valor que reprovou e o que passou. É o que impede a
próxima pessoa de refazer o teste ou de "consertar" de volta. Quando escolher
ficar abaixo de um limite, diga que foi escolha e o que custaria subir.
