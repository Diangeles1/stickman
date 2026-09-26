# Efeitos e cenário

Índice:
- [Tipos de poder disponíveis](#tipos-de-poder-disponíveis)
- [Paletas](#paletas)
- [Anatomia de uma técnica](#anatomia-de-uma-técnica)
- [Criar um cenário novo](#criar-um-cenário-novo)
- [Fazer a luta usar o cenário](#fazer-a-luta-usar-o-cenário)

## Tipos de poder disponíveis

Em `src/core/types.ts` (`TipoPoder`), desenhados em `src/effects/Poderes.tsx`:

| Camada | Tipos |
|---|---|
| chão | `geloNoChao` `chaoQueimado` `trilhaGelo` `rachadura` |
| atrás | `auraGelo` `auraFogo` `zeroAbsoluto` |
| frente | `explosaoFogo` `estilhacosGelo` `choque` `sangue` `bolaDeFogo` `vapor` `feixeFogo` `raioGelo` `esferaInferno` `quebraLaminas` `marcaDeCorte` |
| tela | `telaBranca` `nomeDaTecnica` |

Os nomes são históricos (nasceram de uma luta de gelo contra fogo). Leia-os
como **formas**, não como elementos: `feixeFogo` é "feixe", `esferaInferno` é
"esfera carregada", `marcaDeCorte` é "corte aparecendo no ar ou num corpo".
Qualquer um deles recolorido serve a qualquer elemento.

## Paletas

`PoderEvent` aceita `paleta`. As atuais em `PALETAS` (`Poderes.tsx`): `fogo`,
`gelo`, `vazio`, `azul`, `vermelho`, `sombra`. Cada uma tem `claro`, `medio`,
`forte`, `fundo`.

Paleta nova é uma linha nesse objeto mais uma entrada em `NomeDePaleta`. Isso é
quase sempre melhor que efeito novo — antes de escrever um desenho, verifique
se uma forma existente com cor nova resolve.

Nem todo efeito lê paleta ainda. Já leem: `Feixe`, `EsferaInferno`,
`ExplosaoFogo`, `AuraGelo`, `AuraFogo`. Se precisar de um que ainda não lê, o
padrão é trocar a constante fixa por `paletaDe(e, PADRAO)` — mudança de uma
linha.

## Anatomia de uma técnica

Uma técnica é um `case` no switch de `tecnica` em `src/core/timeline.ts`. Ela
recebe o quadro inicial `c` e devolve o quadro final. Dentro, compõe:

```ts
pose(quem, "nomeDaPose", quadro, xOpcional)   // pose e posição
poder({ tipo, a, b, from, to, forca, paleta }) // efeito
nome("TEXTO", quem, quadro)                    // letreiro
cameraKeys.push({ frame, center, zoom, ease, shake?, cena?, fit? })
impacts.push({ frame, at, tier, direction, hitStop, cracksGround, sound })
```

Utilidades no escopo: `s(segundos)` converte para quadros, `lado` é a direção,
`estado[X].x` é a posição atual, `ALTURA_QUADRIL` e `MAO_Y` são referências
verticais.

Uma técnica boa coreografa **câmera junto com pose**. O que faz uma cena ler
não é o efeito, é o enquadramento: close no espaço entre o punho e o corpo
quando o golpe é contido; corte seco para o alvo no instante em que o ataque
chega nele; plano baixo e aberto no golpe final.

## Criar um cenário novo

Cenários ficam em `src/backgrounds/`. O padrão (ver `Noite.tsx`) é exportar
componentes por camada, com **parallax** pela distância:

```ts
const camada = (p: number) => `translate(${(camX * (1 - p)).toFixed(1)} 0)`;
// p = 0 fundo infinito (não anda) … p = 1 plano do chão (anda junto)
```

Princípios que fazem cenário funcionar aqui:

- **Extensão grande.** `Noite` cobre 3.400 unidades. Cenário curto força a luta
  a ficar parada, porque não há para onde ir.
- **Procedural com ruído determinista.** `ruido(i)` dá variação sem arquivo de
  dados e sem tremer entre quadros. O mesmo índice sempre dá o mesmo prédio.
- **Três a quatro camadas.** Fundo distante quase parado, meio, e algo perto que
  passa rápido. Profundidade vem do diferencial, não do desenho.
- **Contraste com os corpos.** Meça com `contraste.mts` depois de montar: o
  cenário não pode competir com os lutadores. Fundo escuro e dessaturado, com
  as luzes concentradas em poucos pontos.
- **Atmosfera na tela, não no mundo.** Chuva e névoa são desenhadas fora da
  câmera, por cima de tudo e bem fracas — elas são ambiente, não podem esconder
  os corpos.

Cenário novo precisa entrar no seletor que lê `spec.scenario`
(`src/scenes/FightScene.tsx`) e no tipo do campo em `types.ts`.

## Fazer a luta usar o cenário

Cenário bonito que a luta ignora é desperdício. O que faz o espaço entrar na
luta:

- **Arremesso longo**: 800+ unidades de voo com a câmera acompanhando. O
  cenário correndo por trás é o que comunica a força do golpe — sem
  deslocamento, o mesmo golpe lê como empurrão.
- **Perseguição**: os dois atravessam a arena, trocando no caminho. Dá escala e
  quebra a monotonia do duelo parado.
- **Elementos destrutíveis**: para "jogar o outro contra uma estrutura", o
  cenário precisa de peças em plano próximo que possam receber um estado de
  quebrado a partir de um quadro. Modele como propriedade do componente
  (`quebradoEm?: number`), não como estado interno — o Remotion renderiza cada
  quadro isolado e estado interno causa tremulação.
- **Iluminação reativa**: quando um poder grande dispara, um clarão da cor dele
  sobre a cena inteira é barato e é o que mais "cola" o efeito no ambiente.

Ao escrever a coreografia, lembre de reposicionar com pose de locomoção. Mover
alguém 800 unidades com `guard` produz um corpo deslizando de pé parado, e o
`pes.mts` vai reprovar.
