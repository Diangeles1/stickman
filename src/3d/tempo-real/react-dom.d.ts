/**
 * Tipos minimos de `react-dom/client`.
 *
 * O projeto nao tem `@types/react-dom` instalado, e nunca precisou: as 35
 * composicoes sao montadas pelo Remotion, que faz o `createRoot` por conta
 * propria. Esta pagina e o primeiro lugar do repositorio que monta React a
 * mao, e o briefing e explicito -- nenhuma dependencia nova.
 *
 * Entao a superficie usada e declarada aqui, e so ela. Se um dia
 * `@types/react-dom` entrar no projeto por outro motivo, este arquivo sai e
 * nada mais muda: os nomes e as assinaturas sao os de verdade.
 */
declare module "react-dom/client" {
  import type { ReactNode } from "react";

  export type Root = {
    render: (filho: ReactNode) => void;
    unmount: () => void;
  };

  export const createRoot: (
    recipiente: Element | DocumentFragment,
    opcoes?: { identifierPrefix?: string },
  ) => Root;
}
