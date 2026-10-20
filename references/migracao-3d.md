# Migração do motor para 3D (Three.js)

Levantado e iniciado em 2026-10-19. Este arquivo é o mapa da migração: o que
o motor 2D é hoje, o que atravessa para 3D, o que não atravessa, e em que pé
está cada etapa.

## 1. Auditoria — o que existe hoje

**Stack.** TypeScript + React 19 + Remotion 4.0.527. O renderizador é **SVG**
dentro de um quadro do Remotion. A saída é MP4 vertical 1080×1920 a 60 fps,
para Shorts e TikTok.

**O motor não é de tempo real, e isso governa a migração.** `compilar()` roda
uma vez e produz uma `Timeline`; `amostrar()` é puro por quadro; nada guarda
estado entre quadros, porque o Remotion renderiza cada quadro isolado. Um
motor de jogo faz o contrário: integra estado quadro a quadro. Os dois cabem
no mesmo repositório, mas são **dois hospedeiros diferentes** do mesmo motor
de luta — ver a decisão de arquitetura abaixo.

**Entrada e comandos.** `src/index.ts` → `src/Root.tsx` (35 composições).
Execução por `node scripts/remotion.mjs studio|render|still`. Os testes são
35 scripts `.mts` em `scripts/`, rodados por `tsx`.

**Onde cada sistema mora** (≈24.000 linhas em `src/`):

| Sistema | Onde | Linhas | Atravessa para 3D? |
|---|---|---|---|
| Compilador de luta, tipos, contato, técnicas | `core/` | ~5.400 | **Sim, inteiro.** Já é agnóstico de renderizador |
| Dados das lutas | `data/` | ~2.470 | **Sim, inteiro.** São dados puros |
| Regras de animação (sampler, corpo, estilo) | `animation/` | ~2.960 | As regras sim; a IK e o "desenho em 2s" são 2D |
| Poses, esqueleto, presets | `characters/` (menos Stickman) | ~2.820 | Como **dado**, remapeado para bones |
| Desenho do boneco | `characters/Stickman.tsx` | 1.076 | **Não.** SVG puro |
| Efeitos e poderes | `effects/` | ~4.200 | **Não.** SVG puro |
| Cenários | `backgrounds/` | ~1.775 | **Não.** SVG puro |
| Composição da cena | `scenes/FightScene.tsx` | 700 | **Não** |
| Câmera | `camera/camera.ts` | 231 | A intenção sim; é 2D (x, y, zoom) |
| Áudio | `audio/` | 637 | **Sim.** Independente do renderizador |
| Partículas | `particles/particles.ts` | 178 | As regras sim; o desenho não |

**Assets 3D: nenhum.** `public/` são 50 `.wav`, 3 `.webp`, 2 `.png`, 2 `.mp4`,
1 `.mp3`, 1 `.ttf`. Não há `.gltf`, `.glb`, `.fbx`, `.obj` nem `.blend` em
lugar nenhum do repositório.

**Unity: não existe.** Não há projeto Unity neste repositório nem em `D:\`.

**O rig é 2D por tipo**: `Pose = Partial<Record<JointName, Vec2>>`, 13 juntas.
`Vec2` é o ponto exato onde a migração começa.

### Duas coisas que a auditoria achou e que mudam o plano

**O motor já tem profundidade.** `Corpo` tem `z` ("profundidade no palco") e
`giro` (rotação no eixo vertical). A coreografia já movimenta os dois — a
técnica `cerco-em-profundidade` usa `z`, e o chute giratório usa `giro`. O
dado não é plano; a **representação** é.

**O motor finge perspectiva dentro do dado, e isso tem que ser desfeito.**
`corpoNoQuadro` multiplica `scale` e `baseY` por `escalaDaProfundidade(z)` e
soma `alturaDoChao(z)` ao `baseY`: quem está ao fundo já sai menor e com os
pés mais altos na tela. Está certo para SVG, que não tem câmera. Em Three a
lente faz as duas coisas de verdade, então manter as duas aplicaria
perspectiva **duas vezes**. `src/3d/rig3d.ts` divide as duas de volta.

## 2. Decisão de arquitetura — bonecos em 2D, mundo em 3D

**Os lutadores continuam sendo o Stickman em SVG. Só o cenário vira 3D.**

```
   core/ + data/              a luta: agnóstica de renderizador
         |
   +-----+------------------------+
   |                              |
 corpoNoQuadro()            cameraNoQuadro()
   |                              |
 Stickman SVG  (frente)  <--- mesma câmera --->  Cenario3D  (fundo)
```

Dois motivos, e o segundo é o que decide:

1. O traço 2D é a identidade do canal.
2. **As 35 auditorias em `scripts/` medem o rig de 13 juntas** lendo
   `corpoNoQuadro`. Com o corpo em 2D, `cadeia`, `pes`, `contato`, `arcos` e
   as outras continuam valendo exatamente como hoje. Trocar os corpos por
   malhas 3D jogaria fora o que segura a qualidade — era a perda mais séria
   da migração e ela deixa de existir.

O ponto onde isso pode dar errado é **um só**: as duas camadas precisam
concordar sobre a câmera, senão o chão desliza por baixo dos pés. O lado 2D
mapeia `tela = centro + shake + zoom * (mundo - cam.center)`; o lado 3D usa
uma câmera em perspectiva a `DISTANCIA_DA_CAMERA` (1400) do plano z = 0 com
`fov = 2 * atan(altura / (2 * zoom * 1400))`. O 1400 não é escolhido: é o
mesmo número que `escalaDaProfundidade` já usa, então o parallax do cenário
concorda com a profundidade que a coreografia já movimenta. Ver
`src/3d/Cenario3D.tsx`.

**Nada de combate é escrito em `src/3d/`.**

### `src/3d/rig3d.ts` está fora do caminho atual

Ele traduz o corpo 2D para um esqueleto 3D e foi escrito para a direção
anterior (lutadores em 3D), abandonada. **Nenhum arquivo o importa hoje.**
Está mantido, e não apagado, por um motivo prático: não há git instalado
nesta máquina, então apagar é irreversível. Ele ainda serve se um dia algum
adereço 3D precisar seguir uma junta. Se a direção não mudar, é candidato a
remoção assim que houver controle de versão.

## 3. Estado das etapas

| # | Etapa | Estado |
|---|---|---|
| 1 | Auditoria e documentação | **feita** (este arquivo) |
| 2 | Estrutura 3D e Three.js inicializado | **feita** |
| 3 | Cenário 3D renderizando atrás dos bonecos | **feita** — chão, blocos com profundidade, neblina, sombra projetada, horizonte |
| 4 | Câmera casada entre as duas camadas | **feita** — ver a nota na seção 2 |
| 5 | Render headless validado | **feita** — `remotion still` produz PNG com WebGL fora do studio |
| 6 | Levar a composição inteira para cima do cenário 3D | **feita** — via `semFundo` em `Prototype` e `FightScene` |
| 7 | Cenários 3D por palco (vale, metrópole, deserto, neve) | não começada — existe um palco genérico de blocos |
| 8 | Modelos GLTF para o cenário | não começada — o palco é geometria procedural |
| 9 | Otimização e medição de desempenho | não começada |

A versão 2D segue intacta e é a que publica. A composição `Arena3D` existe ao
lado das outras 34 e não substitui nenhuma.

## 4. Comandos

Instalação (as dependências 3D já estão no `package.json`, fixadas):

```
npm install
```

Dependências adicionadas: `three@0.186.1`, `@remotion/three@4.0.527`
(a versão casa com o Remotion pinado), `@react-three/fiber@9.8.2`,
`@types/three@0.186.0` (dev).

Ver a arena:

```
npm run studio
```

e abrir a composição **Arena3D**. Renderizar um quadro:

```
node scripts/remotion.mjs still Arena3D out/arena3d.png --frame=200
```

Validação:

```
npm run typecheck
npx tsx scripts/cadeia.mts vale
```

## 5. Limitações reais do que está pronto

Ditas aqui porque o briefing pede, e porque entregar com defeito conhecido
calado é pior que entregar menos.

- **O palco é um só e é genérico** — blocos gerados por semente. Os oito
  cenários 2D (`vale`, `metropole`, `deserto`, `neve`, `noite`, `arena`,
  `rabisco`, `limpo`) não têm equivalente 3D.
- **O CONTRASTE NÃO FOI MEDIDO, e o risco é real e nomeado.** Os presets de
  cor foram calibrados contra fundos escuros (`#0e1118`, `#101319`) e estão
  documentados com as razões medidas em `characters/presets.ts`. Os blocos do
  cenário 3D são bem mais claros que isso, então o lutador azul (`#707baa`)
  pode cair abaixo do mínimo quando passar na frente de um bloco. Hoje quem
  está segurando a leitura é o contorno preto do Stickman, o que é
  observação visual e **não** medição.
  `scripts/contraste.mts` existe exatamente para isso e **não pôde rodar**:
  ele chama `ffmpeg`, que não está instalado nesta máquina. O ffmpeg que vem
  com o Remotion (`node_modules/@remotion/compositor-win32-x64-msvc`) é uma
  build reduzida, sem o muxer `rawvideo`, e falha. Instalar um ffmpeg de
  verdade desbloqueia `contraste.mts` e também `ritmo.mts`, que está parado
  pelo mesmo motivo. **Medir antes de publicar qualquer coisa com este
  cenário.**
- **Nenhuma medição de desempenho foi feita.** Não há número para citar.
- **Não há git nesta máquina**, então nada foi commitado e não existe rede de
  segurança para desfazer. Instalar o Git for Windows é pré-requisito para o
  resto da migração.

## 6. O modo `semFundo`

`Prototype` e `FightScene` ganharam `semFundo`: quando ligado, não pintam céu
nem chão e o `<svg>` fica transparente, para o cenário vir da camada de baixo.
Sai **só o cenário**. Os obstáculos continuam (a coreografia bate neles — ver
`arremesso-no-paredao`), e efeitos, poderes, katana, placar, nomes e marca
d'água continuam todos.

**A propriedade precisa estar no `Prototype`, não só no `FightScene`.** O
placar, os nomes e a marca d'água são do `Espetaculo`, que mora no `Prototype`.
A primeira versão da cena 3D compunha direto sobre o `FightScene` e perdia os
três — e isso não apareceu em erro nenhum: apareceu comparando o render 3D com
o render 2D do mesmo quadro, lado a lado.

Com `semFundo` desligado (o padrão), as 34 composições 2D renderizam idênticas
ao que renderizavam antes. Conferido re-renderizando `DueloDoVale`, `Dominio` e
`GeloVsFogo` no quadro 235.

## 7. Armadilha já paga

A cena compilava, inicializava o WebGL e pintava só o fundo, **sem erro nenhum
no console**. A configuração da câmera estava escrita inline
(`camera={{ fov: 42, ... }}`): objeto novo a cada quadro, o r3f compara por
identidade, conclui que a câmera mudou e reaplica a configuração depois do
render, jogando a câmera de volta para `(0, 0, 5)` — dentro do chão. Os corpos
estavam certos o tempo todo (medidos fora do navegador: pés em y≈0, cabeças em
y≈600). A configuração agora é constante de módulo. Ver o comentário em
`src/3d/Arena3D.tsx`.

## 8. Segundo hospedeiro: a arena 3D em tempo real

Feito em 2026-10-19. A decisão "um motor de luta, dois hospedeiros" passou a
ter os dois. O primeiro é o Remotion; o segundo é uma página solta em
`src/3d/tempo-real/`, com laço próprio de `requestAnimationFrame`.

Ela existe para as perguntas que o render não responde: o pé está no chão ou
dentro dele (de perfil, as duas coisas desenham igual), as duas câmeras
concordam, e como esta luta se parece de cima ou de trás.

### O que foi extraído em vez de duplicado

`src/3d/Cenario3D.tsx` ganhou `MundoDoCenario3D` — neblina, luzes, chão e
blocos — e `Cenario3D` passou a ser só `<ThreeCanvas>` + `<CameraCasada>` +
`<MundoDoCenario3D>`. `CameraCasada`, `CAMERA_INICIAL` e `COR_DO_CEU` agora
são exportados. A composição `Arena3D` não mudou de comportamento: o conteúdo
da cena é o mesmo, pelo mesmo código. Os dois hospedeiros montam os MESMOS
objetos; só a câmera diverge, e diverge de propósito.

`src/3d/rig3d.ts` deixou de estar fora do caminho. Ele é o que desenha os ossos
em três dimensões, e ganhou `pontoDoCorpoEm3D`, que leva um ponto 2D que está
sobre um corpo (o alvo de um golpe, o `at` de um impacto) para o espaço da
cena desfazendo a perspectiva falsa. **Ele não é mais candidato a remoção.**

### Comandos

```
node scripts/arena-tempo-real.mjs              gera out/tempo-real/
node scripts/arena-tempo-real.mjs --servir     gera, serve e recompila
node scripts/arena-tempo-real.mjs --servir --porta=5000
node scripts/arena-tempo-real.mjs --producao   minificado, sem sourcemap
```

Sem `--servir`, abra `out/tempo-real/index.html` direto no navegador — o bundle
é um IIFE único, então `file://` funciona. Nenhuma dependência nova: o esbuild
usado é o que já vem dentro do Remotion.

### O que a página tem

- **Controles**: play/pause, passo a passo quadro a quadro (andar um quadro
  implica pausar), scrub, e multiplicador de tempo (0.1x a 1x). Atalhos:
  espaço, setas, `g` `j` `c` `b` `e` `o`.
- **Câmera de órbita** (`three/examples/jsm/controls/OrbitControls.js`), que é
  o que torna a página útil como ferramenta. Com ela ligada a camada 2D é
  **escondida**, porque a câmera deixou de concordar com o SVG; deixá-la na
  tela desalinhada faria a ferramenta de depuração ser a fonte do defeito.
- **Painel**: FPS medido, delta, quadro real e quadro da timeline (com aviso de
  hit stop), e por lutador pose, x, z, baseY, facing, giro, spin, escala,
  velocidade, aceleração, agachamento, "no ar" e erro do IK.
- **Gizmos**: ossos e juntas em 3D, anéis de junta no SVG, e anel no chão sob o
  quadril. Os dois conjuntos de junta vêm por caminhos independentes (um por
  `rig3d` + lente do Three, outro por `juntasDoCorpo` + `transformDaCamera`) e
  caem no mesmo pixel quando a câmera está casada — é o primeiro jeito de
  olhar para o único ponto onde 2D sobre 3D pode falhar.
- **Oito lutas** no seletor, `benchmark` por padrão.

### Limitações reais

- **A página não desenha efeitos, poderes, katana, placas, placar nem marca
  d'água.** Ela usa `compilar()` + `corpoNoQuadro()` + `Stickman` direto, e não
  o `FightScene`/`Prototype`, porque os dois exigem `useCurrentFrame()` e
  portanto o contexto do Remotion — que é exatamente o que o segundo
  hospedeiro não tem. Para ver a cena completa, o studio continua sendo o
  lugar.
- **Não há caixa de colisão para desenhar, e isso é do motor.** O contato é
  resolvido por ponto e distância (`core/contact.pontoDoAlvo` mais a distância
  de combate), nunca por AABB. O que os gizmos mostram é a geometria real do
  contato: ponta do membro atacante, ponto mirado, linha entre os dois, e o
  impacto registrado. Caixas seriam geometria inventada.
- **O alinhamento entre o gizmo 3D e o anel 2D é exato só para `giro = 1`**
  (a leitura padrão, e o caso de toda luta já escrita). Durante o chute
  giratório o 2D achata a largura e a cena gira de verdade — os dois
  discordam por construção, e a nota 2 no topo de `rig3d.ts` explica por quê.
- **NENHUM NÚMERO DE DESEMPENHO FOI MEDIDO DE FORMA UTILIZÁVEL.** A página
  mostra FPS, e a única execução feita até agora foi dentro do painel de
  navegador embutido do Claude, que roda a aba como página de segundo plano e
  estrangula o `requestAnimationFrame`: o painel marcou 11 a 35 repinturas por
  segundo com delta travado no teto de 250 ms do relógio. **Esses números
  medem o painel, não a cena.** Rodar `--servir` e abrir num navegador de
  verdade é o que dá um número para citar; até lá não há nenhum.
- **A etapa 9 (otimização e medição) continua não começada.** Esta página é a
  ferramenta que ela vai usar, não a medição em si.

### Verificado

- `node node_modules/typescript/bin/tsc --noEmit` limpo.
- O bundle compila sem aviso (`arena.js`, 4.2 MB sem minificar, com sourcemap).
- A página abre, anima, e o painel acompanha: luta `benchmark`, poses passando
  por `guard`, `run2`, `coil`, `getUp`, scrub e pause funcionando.
- Com os dois conjuntos de gizmo ligados e a luta **pausada**, os anéis brancos
  do SVG caem sobre as esferas 3D. Com a luta **correndo** dentro do painel
  embutido houve quadro em que os dois apareceram deslocados; com o rAF
  estrangulado a 11 fps isso é esperado (o framebuffer do WebGL e o commit do
  DOM não são o mesmo instante), mas **não foi confirmado num navegador de
  verdade**, e é a primeira coisa a conferir.
- A composição `Arena3D` no studio não foi re-renderizada depois desta
  mudança. `Cenario3D` só foi repartido em dois componentes e o `tsc` está
  limpo, mas **abrir o studio uma vez antes de confiar nisso.**
