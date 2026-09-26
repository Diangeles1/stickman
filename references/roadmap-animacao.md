# Roadmap: motor de animação de personagem

Norte de longo prazo do projeto, definido pelo autor. Não é lista de tarefas
para uma sessão — é a direção contra a qual cada mudança é conferida.

**Objetivo:** fazer o stickman parecer animado por alguém que entende movimento
humano, e não pontos interpolados de A para B. Peso, intenção, antecipação,
equilíbrio, impacto, continuidade e personalidade.

**Regra que não muda:** construir *sobre* o motor atual. Preservar o rig de 13
juntas, o renderer, a timeline, as partículas e a câmera. Arquitetura
incremental, nunca reescrita.

---

## O que já existe

Levantado no código em 2026-09-25. Importa saber, porque metade do roadmap já
tem base pronta e o trabalho é estender, não criar.

| Área | Onde | Estado |
|---|---|---|
| Cadeia cinemática (quadril→tronco→membro) | `animation/corpo.ts` | pronto, com medidor em `scripts/cadeia.mts` |
| Arcos de movimento | `animation/` | pronto, medidor em `scripts/arcos.mts` |
| Antecipação e follow-through | `AttackDef`: `windup`, `strike`, `recover`, `contactAt`, `seguimento` | pronto por golpe |
| Squash & stretch | `animation/corpo.ts` | pronto, com limite de volume documentado |
| Peso e equilíbrio | `velocidade`, `aceleracao`, `agachamento`, postura por perfil, pés plantados | parcial |
| Níveis de impacto | `ImpactTier` (light/medium/extreme) | pronto |
| Timing | `hitStop`, `slowMo`, `camaraLenta` | pronto |
| Câmera | `cameraKeys` com `ease`, `shake`, `fit`, `cena` | pronto |
| Secondary motion | inércia do cabelo via `velocidade` | primeiro caso feito |
| Volume (cel shading) | `tracos.volume` | pronto |
| Analisador de movimento | os 15 scripts em `scripts/` | é isto; diagnosticam por quadro |

## O que falta, em ordem de dependência

Cada passo depende do anterior. Fazer fora de ordem gera retrabalho.

### 1. Blending entre ações
Hoje uma pose troca para outra em corte seco: `run → punch` não tem mistura.
É o maior buraco e o que mais muda a percepção, porque beneficia toda animação
já existente sem tocar em nenhuma delas.

### 2. Curvas de spacing por fase
O spacing hoje é fixo por golpe. Falta controlar a velocidade visual dentro do
movimento: preparação lenta, meio explosivo, impacto quase instantâneo, recuo
rápido, recuperação desacelerando. Precisa do blending existindo primeiro.

### 3. AnimationDirector
A camada declarativa: escrever `sprint → jump → airPunch → land` e o motor
resolver timing, transições, câmera e continuidade. Usa 1 e 2, por isso vem
depois.

### 4. Presets de estilo
`ANIME`, `REALISTIC`, `CINEMATIC`, `HEAVY_COMBAT`. Cada um é um conjunto de
parâmetros de timing, exagero, antecipação, squash e câmera — só faz sentido
quando esses parâmetros existirem separados do código das cenas.

### 5. Biblioteca de movimentos com fases nomeadas
Existe implícito no `AttackDef`. Tornar explícito (`preparation`, `anticipation`,
`action`, `impact`, `followThrough`, `recovery`) permite ao Director compor.

### 6. Sistema de salto e ciclo de corrida procedurais
Curva de centro de massa no salto, postura mudando com a velocidade na corrida.

---

## Controle de qualidade

Regra principal: **consistência e legibilidade acima da quantidade de efeitos.**
Em conflito entre efeito e anatomia, preserva a anatomia. Entre partículas e
ação principal, reduz as partículas.

Verificado automaticamente por `scripts/qualidade.mts` (número de lutadores,
teleporte, causalidade, oclusão, enquadramento, paleta), mais `pes.mts`,
`contato.mts`, `contraste.mts`, `arcos.mts` e `cadeia.mts`.

Uma cena não está pronta enquanto os validadores não passarem.

**Fora do escopo de validação:** braço extra, dedo a mais, personagem
duplicado, membro invertido, anatomia deformada. Nada disso é verificável
porque nada disso é possível — o corpo é derivado de um esqueleto fixo de 13
juntas, não gerado. Checar seria teatro.

---

## Personagens

Design original sempre. Arquétipos, dinâmicas de combate, paletas e conceitos
de poder são livres e carregam o reconhecimento; o que não se reproduz é o
desenho específico de personagem protegido. Um design próprio bem feito evoca
o arquétipo, o público faz a conexão sozinho, e o personagem vira ativo do
canal em vez de problema à espera.
