/**
 * Ponto de entrada do bundle da pagina de tempo real.
 *
 * Nao tem React.StrictMode de proposito. O StrictMode monta cada efeito duas
 * vezes em desenvolvimento, e aqui isso criaria DOIS lacos de
 * requestAnimationFrame: o quadro andaria em dobro e o FPS medido seria o
 * dobro do real. Numa pagina cuja funcao e medir, o modo que ajuda a achar
 * efeito mal limpo atrapalha mais do que ajuda -- e a limpeza do laco esta
 * escrita e revisada em App.tsx.
 */

import { createRoot } from "react-dom/client";
import { App } from "./App";

const alvo = document.getElementById("raiz");
if (!alvo) throw new Error("falta <div id=\"raiz\"> no HTML da pagina");

createRoot(alvo).render(<App />);
