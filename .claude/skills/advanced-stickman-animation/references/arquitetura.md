# Arquitetura do motor

Mapa do que existe, levantado no código em 2026-09-25. Confirme antes de
confiar — o código muda e este arquivo pode envelhecer.

Índice:
- [O caminho de um quadro](#o-caminho-de-um-quadro)
- [O que já está implementado](#o-que-já-está-implementado)
- [Onde cada coisa mora](#onde-cada-coisa-mora)
- [Os pontos de extensão](#os-pontos-de-extensão)
- [O que realmente falta](#o-que-realmente-falta)

## O caminho de um quadro

```
FightSpec (data/fights/*.ts)        beats como dados
        ↓
compilar() (core/timeline.ts)       beats → quadros-chave, impactos, câmera, poderes
        ↓
amostrar() (animation/sampler.ts)   quadro N → pose, posição, velocidade
        ↓
corpoNoQuadro() (animation/corpo.ts) pose + IK + pés plantados + postura
        ↓
FightScene / Stickman               SVG
```

O compilador roda **uma vez**; o sampler roda por quadro e é puro. Remotion
renderiza cada quadro isolado, então nada pode guardar estado entre quadros.

## O que já está implementado

Esta lista existe para você **não reconstruir**. Já houve tentativa de
reimplementar blending que existia há meses.

| Princípio | Onde | Como |
|---|---|---|
| **Blending entre poses** | `sampler.ts` → `misturar()` | mistura com atraso por junta e curva por par origem→destino |
| **Overlapping action** | `skeleton.ts` → `PerfilDeAtraso` | cada junta com janela `[início, fim]`; há perfis para ataque, corte, uppercut, chute, reações por ponto de impacto, e poder |
| **Spacing / curvas** | `sampler.ts` → `curvaPara()` | `disparo` para golpes, `estalo` para reação, `saidaRapida` para knockback, `suave` como default |
| **Curva separada do deslocamento** | `sampler.ts` → `curvaDoDeslocamento()` | o quadril chega antes do punho, senão o soco vira bloco empurrado |
| **Ciclos de locomoção contínuos** | `sampler.ts` → `poseDoCiclo()` | fase contínua por distância percorrida; `ELEVACAO_DA_PASSADA` levanta o pé que avança |
| **Secondary motion (cabeça)** | `sampler.ts` → `amostrar()` | cabeça chega atrasada, por rotação em torno do pescoço |
| **Secondary motion (cabelo)** | `Stickman.tsx` → `Tracos` | arrasto proporcional a `velocidade`, com teto |
| **Antecipação / follow-through** | `AttackDef` | `windup`, `strike`, `recover`, `contactAt`, `seguimento` |
| **Cadeia cinemática** | `corpo.ts` | com medidor em `scripts/cadeia.mts` |
| **Pés plantados** | `corpo.ts` → `POSES_DE_APOIO`, `POSES_DE_LOCOMOCAO` | pé de apoio prega; só corpo empurrado arrasta |
| **Squash** | `corpo.ts` | com limite de volume documentado |
| **Postura por perfil** | `corpo.ts` → `POSES_COM_POSTURA` | pesado tem base larga e quadril baixo; rápido, o oposto. Só em espera e defesa — ataque é calibrado contra o medidor de contato |
| **Inclinação por aceleração** | `sampler.ts` → `inclinacaoDoCorpo()` | janela larga, lê tendência e não impulso |
| **Níveis de impacto** | `ImpactTier` | light / medium / extreme |
| **Timing dramático** | `hitStop`, `slowMo`, `camaraLenta` | |
| **Câmera** | `cameraKeys` | `ease`, `shake`, `fit`, `cena` (enquadramento intencional) |
| **Paletas de efeito** | `Poderes.tsx` → `PALETAS` | efeito é forma; a paleta decide de quem é |
| **Volume (cel shading)** | `Stickman.tsx` → `tracos.volume` | sombra chapada em dois tons |

## Onde cada coisa mora

- `core/types.ts` — o contrato entre camadas. Beat, AttackDef, PoderEvent, FighterPreset
- `core/timeline.ts` — o compilador. Beats viram quadros-chave. As técnicas cinematográficas são `case`s no switch de `tecnica`
- `core/contact.ts` — `distanciaDeCombate()`: onde o atacante precisa estar para o golpe encostar. Deriva da espessura do traço e do alcance da arma
- `animation/sampler.ts` — resolução por quadro, curvas, blending, ciclos
- `animation/corpo.ts` — IK, pés plantados, postura, squash
- `characters/skeleton.ts` — poses base, perfis de atraso, `misturar()`, `exagerar()`
- `characters/poses.ts` — as poses escritas à mão
- `characters/Stickman.tsx` — o desenho: ossos, volume, traços, roupa
- `attacks/registry.ts` — `ATAQUES`: o catálogo de golpes com suas fases
- `effects/Poderes.tsx` — efeitos por camada (chão, atrás, frente, tela)
- `scenes/FightScene.tsx` — composição final
- `backgrounds/` — cenários, por camada de parallax

## Os pontos de extensão

Onde encaixar coisa nova sem criar motor paralelo:

**Movimento novo** → pose em `poses.ts` + entrada em `ATAQUES` se for golpe +
`case` em `curvaPara` e `atrasoPara` se precisar de dinâmica própria.

**Efeito novo** → antes, tente `paleta` num efeito existente. Se não servir,
tipo novo em `TipoPoder` + componente em `Poderes.tsx` + despacho na camada.

**Cena coreografada** → `case` novo em `tecnica` (timeline.ts). Recebe o quadro
inicial, devolve o final, e compõe `pose()`, `poder()`, `nome()`,
`cameraKeys.push()`, `impacts.push()`.

**Traço de personagem** → campo em `FighterPreset.tracos` + desenho em
`Stickman.tsx`. Opcional sempre: quem não declara continua como antes.

**Cenário** → arquivo em `backgrounds/` exportando por camada, + valor em
`scenario` no tipo + ligação em `FightScene.tsx`.

**Validação nova** → checagem em `scripts/qualidade.mts`, ou script próprio se
for uma família inteira de defeitos.

## O que realmente falta

Depois de descontar tudo que já existe:

1. **Curvas parametrizáveis por chave.** A curva hoje é escolhida pela pose de
   destino. Não dá para dizer "esta transição específica é mais lenta".
2. **AnimationDirector.** A camada declarativa (`sprint → jump → airPunch →
   land`). Hoje cada cena é escrita à mão em ~60 linhas de `case`.
3. **Presets de estilo.** ANIME / REALISTIC / HEAVY_COMBAT como conjuntos de
   parâmetros. Exige antes que timing e exagero sejam parâmetros, não constantes.
4. **Sistema de salto com fases.** Existe parábola de voo; falta a sequência
   compressão → impulso → ápice → antecipação de pouso → absorção.
5. **Secondary motion em roupa.** O canal existe (`velocidade` chega ao
   `Stickman`); só o cabelo consome.
6. **Cobertura dos medidores.** `cadeia.mts` audita só golpes; poses de poder,
   locomoção e aéreas não passam por medidor nenhum.
