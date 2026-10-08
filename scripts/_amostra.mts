import { writeFileSync } from "node:fs";
import { duelo, dueloDoDia } from "../src/data/fights/diario";
const spec = duelo({
  ...dueloDoDia(new Date()),
  roteiro: "cratera", palco: "deserto", elenco: "sangue-mar",
  nomeA: "DAVI", nomeB: "BERNARDO", venceA: false,
});
writeFileSync("out/fundos/cratera.json", JSON.stringify({ spec, escolha: true }));
console.log("ok");
