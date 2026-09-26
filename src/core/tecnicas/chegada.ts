/**
 * CHEGADA: a mini-historia antes da luta.
 *
 * Luta que comeca com os dois ja frente a frente nao tem o que perder:
 * o espectador entra sem saber quem sao nem por que estao ali, e o
 * primeiro golpe e so movimento. Esta cena existe para criar a divida
 * que a luta vai pagar.
 *
 * O roteiro e todo visual, sem uma palavra:
 *
 *   1. a rua VAZIA, camera baixa -- o lugar existe antes deles
 *   2. um entra andando, sozinho, e para no meio
 *   3. corta para o lado e ele JA ESTAVA la, parado, esperando
 *   4. close num, close no outro
 *   5. os dois assumem a guarda ao mesmo tempo
 *
 * O passo 1 e o mais facil de cortar e o mais caro de perder: um quadro
 * de cenario vazio antes da figura entrar e o que faz a entrada dela
 * significar alguma coisa.
 */

import type { Tecnica } from "./contexto";

export const chegada: Tecnica = (ctx) => {
  const { G, F, c, lado, s, pose, cameraKeys, ALTURA_QUADRIL } = ctx;

      const dur = s(4.6);
      // 1. RUA VAZIA. Os dois comecam fora do quadro, cada um de um lado.
      const centro = 0;
      pose(G, "idle", c, centro - lado * 1500);
      pose(F, "idle", c, centro + lado * 620);
      cameraKeys.push({
        frame: c,
        center: { x: centro, y: ALTURA_QUADRIL - 40 },
        zoom: 0.78,
        ease: 1,
        cena: true,
      });
      // um respiro antes de qualquer coisa entrar
      cameraKeys.push({
        frame: c + s(0.7),
        center: { x: centro - lado * 120, y: ALTURA_QUADRIL - 90 },
        zoom: 0.86,
        ease: s(0.7),
        cena: true,
      });

      // 2. ELE ENTRA andando. Pose de locomocao: o motor da os passos.
      pose(G, "walk1", c + s(0.6));
      pose(G, "walk1", c + s(2.0), centro - lado * 430);
      // freia e assenta
      pose(G, "idle", c + s(2.3));
      cameraKeys.push({
        frame: c + s(1.5),
        center: { x: centro - lado * 300, y: ALTURA_QUADRIL - 120 },
        zoom: 1.0,
        ease: s(0.8),
        cena: true,
      });

      // 3. O OUTRO JA ESTAVA LA. A revelacao e da CAMERA, nao do corpo: o
      //    quadro estava fechado nele o tempo todo sem mostrar, e agora
      //    corta para o lado e ele aparece parado, esperando. Vira mais
      //    ameacador do que se tivesse entrado andando.
      cameraKeys.push({
        frame: c + s(2.4),
        center: { x: centro + lado * 500, y: ALTURA_QUADRIL - 180 },
        zoom: 1.25,
        ease: s(0.5),
        cena: true,
      });

      // 4. CLOSE em cada um. Dois cortes secos, sem transicao: e o corte
      //    que cria a tensao, a camera deslizando entre eles dissolveria.
      const perto = (x: number, quadro: number) =>
        cameraKeys.push({
          frame: quadro,
          center: { x, y: ALTURA_QUADRIL - 300 },
          zoom: 2.2,
          ease: 0,
          cena: true,
        });
      perto(centro - lado * 430, c + s(3.1));
      perto(centro + lado * 620, c + s(3.6));

      // 5. OS DOIS ASSUMEM A GUARDA no mesmo quadro. Abre para o plano da
      //    luta -- e daqui que a primeira tecnica pega.
      pose(G, "guard", c + s(4.1));
      pose(F, "guard", c + s(4.1));
      cameraKeys.push({
        frame: c + s(4.0),
        center: { x: centro + lado * 90, y: ALTURA_QUADRIL - 130 },
        zoom: 0.92,
        ease: s(0.45),
        fit: true,
        cena: true,
      });
      pose(G, "guard", c + dur);
      pose(F, "guard", c + dur);
      return c + dur;
};
