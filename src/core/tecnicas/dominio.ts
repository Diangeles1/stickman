/**
 * DOMINIO. A arena escurece, o nome entra, e a tela se enche de cortes
 * vindos de todo lado: nenhum deles precisa de alvo, o dominio acerta
 * porque acerta.
 */

import type { Tecnica } from "./contexto";

export const dominio: Tecnica = (ctx) => {
  const {
    G,
    F,
    c,
    lado,
    s,
    estado,
    pose,
    poder,
    nome,
    cameraKeys,
    impacts,
    ALTURA_QUADRIL,
  } = ctx;

      const m = (estado[G].x + estado[F].x) / 2;
      // andando para a marca, nao deslizando ate ela
      pose(G, "retreat", c + 10, m - lado * 250);
      pose(F, "advance", c + 10, m + lado * 250);

      /*
        CARGA. O dominio nao pode abrir do nada: ele precisa de alguem
        abrindo. Pose de acumulo, energia juntando nas maos (ancorada, entao
        presa a elas), e a camera em cima dele.
      */
      const carrega = c + s(0.35);
      pose(F, "charge", carrega);
      poder({
        tipo: "esferaInferno",
        quem: F,
        ancora: "entreMaos",
        a: { x: 20, y: -10 },
        from: carrega,
        to: carrega + s(0.5),
        forca: 46,
        paleta: "sombra",
      });
      cameraKeys.push({ frame: carrega, center: { x: estado[F].x, y: ALTURA_QUADRIL - 150 }, zoom: 1.3, ease: 10, cena: true });

      /*
        A EXPANSAO. Sai do peito de F e engole a arena.

        O que existia aqui era telaBranca + nome, e a leitura foi exata: "nao
        mostra expansao de dominio de ninguem, o cenario mudando e tal". Nao
        havia dominio nenhum -- havia um titulo. Agora existe um poder que se
        expande, tem borda e troca o mundo por dentro (ver effects/Poderes,
        Dominio).
      */
      const abre = carrega + s(0.55);
      pose(F, "bracosFrente", abre);
      poder({ tipo: "telaBranca", from: abre, to: abre + 4 });
      poder({
        tipo: "dominio",
        quem: F,
        ancora: "peito",
        a: { x: 0, y: -40 },
        from: abre,
        to: abre + s(3.0),
        forca: 1800,
        paleta: "sombra",
      });
      nome("DOMINIO", F, abre + 8);
      /*
        A camera ABRE para caber o dominio. Um espaco de 1800 de raio visto de
        perto e so fundo colorido; o tamanho dele so existe se houver
        enquadramento que o mostre acabando. Sem fit, que recalcularia o zoom
        pelos corpos e ignoraria isto.
      */
      cameraKeys.push({ frame: abre, center: { x: m, y: ALTURA_QUADRIL - 220 }, zoom: 0.44, ease: 7, shake: 18, cena: true });
      cameraKeys.push({ frame: abre + s(0.9), center: { x: m, y: ALTURA_QUADRIL - 240 }, zoom: 0.62, ease: 22, cena: true });

      /*
        CHUVA DE CORTES, em cadencia irregular para nao virar metronomo.
        Um a cada tres acerta o CORPO de G (com `quem`, entao a ferida fica
        nele e acompanha o tronco); os outros cortam o ar do dominio.
      */
      for (let k = 0; k < 16; k++) {
        const q = abre + 14 + k * 4 + (k % 3);
        const noCorpo = k % 3 === 2;
        poder({
          tipo: "marcaDeCorte",
          quem: noCorpo ? G : undefined,
          a: noCorpo
            ? undefined
            : {
                x: m + ((k % 5) - 2) * 220 + (k % 2 ? 70 : -60),
                y: ALTURA_QUADRIL - 120 - (k % 4) * 150,
              },
          from: q,
          to: q + 18,
          forca: 200 + (k % 3) * 60,
          paleta: "sombra",
          vetor: { x: k % 2 ? 1 : -1, y: 0.4 },
        });
        // cada corte tem seu tremor: e o que faz a chuva bater, nao decorar
        if (k % 2 === 0) {
          cameraKeys.push({ frame: q, center: { x: m, y: ALTURA_QUADRIL - 230 }, zoom: 0.64, ease: 4, shake: 9, cena: true });
        }
      }

      const golpeia = abre + 14 + 16 * 4 + s(0.3);
      impacts.push({
        frame: golpeia,
        at: { x: m - lado * 180, y: ALTURA_QUADRIL - 220 },
        tier: "extreme",
        direction: -lado,
        hitStop: 10,
        cracksGround: true,
        sound: "corte",
      });
      pose(G, "knockback", golpeia, m - lado * 380);
      // o corte que derruba: no corpo, grande, com o sangue que ele leva
      poder({ tipo: "marcaDeCorte", quem: G, from: golpeia, to: golpeia + 30, forca: 320, paleta: "sombra", vetor: { x: -lado, y: -0.5 } });
      poder({ tipo: "sangue", quem: G, a: { x: m - lado * 300, y: ALTURA_QUADRIL - 210 }, from: golpeia, to: golpeia + 40, forca: 1.2, vetor: { x: -lado, y: -0.3 } });
      for (let k = 0; k < 3; k++) {
        cameraKeys.push({ frame: golpeia + k * 9, center: { x: m, y: ALTURA_QUADRIL - 200 }, zoom: 0.8 + k * 0.05, ease: 8, shake: 22 - k * 6, cena: true });
      }
      const fim = golpeia + s(1.0);
      pose(G, "getUp", fim);
      pose(F, "guard", fim);
      cameraKeys.push({ frame: golpeia + 24, center: { x: m, y: ALTURA_QUADRIL - 150 }, zoom: 0.9, ease: 20, fit: true, cena: true });
      return fim;
};
