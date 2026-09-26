# Princípios de movimento neste rig

Como cada princípio clássico de animação se traduz num esqueleto de 13 juntas
movido por regras. Não é teoria geral — é onde mexer neste código.

Índice:
- [Peso vem da ordem, não do desenho](#peso-vem-da-ordem-não-do-desenho)
- [Spacing: a curva certa por intenção](#spacing-a-curva-certa-por-intenção)
- [Antecipação proporcional](#antecipação-proporcional)
- [Arcos](#arcos)
- [Equilíbrio e centro de massa](#equilíbrio-e-centro-de-massa)
- [Transições](#transições)
- [Impacto](#impacto)
- [Secondary motion](#secondary-motion)
- [Diagnóstico por sintoma](#diagnóstico-por-sintoma)

## Peso vem da ordem, não do desenho

O erro mais comum é tentar resolver "falta peso" engrossando o traço ou
aumentando o efeito. Peso é **ordem temporal**: qual parte do corpo se move
primeiro e qual chega por último.

Um arremesso em que os pés plantam antes do tronco empurrar lê como arremesso.
O mesmo arremesso com todas as juntas chegando no mesmo quadro lê como troca de
figura. A diferença está inteira no `PerfilDeAtraso`.

Formato: `junta: [início, fim]`, ambos entre 0 e 1 dentro da transição.

```ts
export const ATRASO_DO_ATAQUE: PerfilDeAtraso = {
  hip: [0, 0.25],            // nasce no quadril
  neck: [0.08, 0.5],         // tronco segue
  shoulderFront: [0.1, 0.56],
  elbowFront: [0.24, 0.74],
  handFront: [0.34, 1],      // punho chega por último
};
```

A regra de leitura: **quanto mais longe da origem da força, mais tarde começa e
mais tarde termina.** Soco nasce no chão e sobe. Reação nasce no ponto do golpe
e se espalha. Lançamento nasce nos pés e sai pelas duas mãos juntas.

Pose sem perfil move o corpo inteiro junto. Se um movimento parece leve ou
"bonequinho", olhe `atrasoPara()` antes de olhar qualquer outra coisa.

## Spacing: a curva certa por intenção

Velocidade constante denuncia software. Cada tipo de movimento tem uma
assinatura própria:

| Intenção | Curva | Por quê |
|---|---|---|
| Golpe | `disparo` (t³) | acelera até o contato; chegar desacelerando é o oposto do que um soco faz |
| Reação a impacto | `estalo` | o movimento **nasce** no impacto: quase todo o deslocamento nos primeiros quadros |
| Knockback, queda | `saidaRapida` | massa empurrada sai rápido e desacelera |
| Freada, pouso | `saidaRapida` | chega devagar porque está *gastando* energia para parar |
| Acomodar em guarda | `acomodar` | assenta sem overshoot |
| Resto | `suave` | genérico, e genérico raramente é o certo para movimento com intenção |

O deslocamento do corpo pode ter curva **diferente** da pose — e tem, nos
golpes: o quadril chega antes do punho (`curvaDoDeslocamento`). Sem isso o soco
vira um bloco empurrado para frente.

## Antecipação proporcional

Golpe pesado pede preparação longa; golpe rápido, curta. São os campos do
`AttackDef` em `attacks/registry.ts`:

- `windup` — o corpo recua e carrega
- `strike` — o membro dispara
- `contactAt` — em qual quadro do strike conecta
- `recover` — volta à guarda
- `seguimento` — para onde o membro **continua** depois do contato

O `seguimento` é o que separa golpe de gesto: o uppercut continua subindo, não
esticando para frente. Sem ele, todo golpe vira jab.

## Arcos

Membro que vai em linha reta de A a B denuncia interpolação. O `arcos.mts` mede
a curvatura (corda contra trajetória real) e reprova quando é reta demais.

Onde importa mais: socos, chutes, braços em salto, esquivas, e movimento de
câmera.

## Equilíbrio e centro de massa

O que existe hoje: `velocidade`, `aceleracao`, `agachamento`, postura por
perfil e pés plantados. A inclinação do corpo deriva da aceleração com janela
larga — de propósito, porque janela estreita transforma um impulso de empurrão
em inclinação absurda num único quadro.

Ao estender: a compensação precisa ser **consequência** do movimento, nunca
ruído aleatório. Corpo que freia inclina para trás porque está desacelerando,
não porque foi sorteado.

## Transições

O blending já existe (`misturar` com atraso e curva). O que fazer é garantir
que o **par** origem→destino tenha tratamento quando a transição for notável:
`curvaDaPose(origem, destino)` permite caso especial. Hoje só `→ guard` tem.

Ponto crítico: ao sair de um ciclo de locomoção no meio da passada, a perna
precisa sair da **fase atual**, não da pose pura — senão o pé salta. Já está
resolvido, e é um bom exemplo do tipo de cuidado que a área exige.

## Impacto

Níveis em `ImpactTier`. Cada nível governa efeitos, hitstop e reação. O erro
comum é aplicar a mesma resposta para tudo: golpe leve com tremor de
finalizador gasta o recurso e o finalizador deixa de significar.

Hitstop é a ferramenta mais barata e mais forte: alguns quadros de congelamento
no contato valem mais que qualquer partícula.

## Secondary motion

Nenhuma parte do corpo começa e para no mesmo instante. Implementações atuais:

- **cabeça** — chega atrasada, por rotação em torno do pescoço (nunca por
  deslocamento, senão o pescoço estica)
- **cabelo** — arrasto proporcional à velocidade, com teto para não descolar

Intensidade deve escalar com a velocidade principal, sempre com limite. Sem
teto, um arremesso rápido joga o cabelo para trás do crânio.

## Diagnóstico por sintoma

Atalho para ir direto ao lugar certo:

| Sintoma | Suspeito primeiro | Medidor |
|---|---|---|
| "parece deslizando" | pose de apoio usada para reposicionar | `pes.mts` |
| "sem peso" | `PerfilDeAtraso` ausente ou achatado | `cadeia.mts` |
| "robótico" | curva `suave` onde precisa de `disparo`/`estalo` | — |
| "golpe não conecta" | golpe de lâmina em luta sem arma; proporção mudada | `contato.mts` |
| "o boneco some" | contraste do corpo contra o fundo | `contraste.mts` |
| "efeito cobre tudo" | `forca` do poder fora de escala | `qualidade.mts` |
| "corta na hora errada" | keyframe de câmera com `fit` sobrescrevendo zoom | `qualidade.mts` |
| "teleporta" | chave de posição sem quadros entre ela e a anterior | `qualidade.mts` |

Uma escala errada é a causa mais frequente de efeito feio. `forca` significa
coisas diferentes por tipo: no sangue o motor usa ~1, na explosão são centenas.
Confira um uso existente antes de inventar um número.
