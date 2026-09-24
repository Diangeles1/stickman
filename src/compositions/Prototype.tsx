/**
 * Composicao do prototipo.
 *
 * A composicao so faz duas coisas: compilar os dados da luta e entregar a
 * timeline para a cena. Nenhuma coreografia mora aqui.
 *
 * A compilacao roda dentro de um useMemo com a semente como dependencia, entao
 * acontece UMA vez por render e nao por quadro.
 */

import React from "react";
import { FightAudio } from "../audio/FightAudio";
import { FightScene } from "../scenes/FightScene";
import { compilar } from "../core/timeline";
import { gerarLuta } from "../data/gerador";
import type { FightSpec } from "../core/types";

export type PrototypeProps = {
  /**
   * A luta. Opcional porque a composicao GERADA recebe o spec por
   * calculateMetadata, e nao por defaultProps: ele so existe depois que a
   * semente e lida.
   */
  spec?: FightSpec;
  debug?: boolean;
  /** usadas pela composicao gerada; o spec chega pronto via calculateMetadata */
  seed?: number;
  segundos?: number;
};

export const Prototype: React.FC<PrototypeProps> = ({
  spec,
  debug = false,
  seed = 1,
  segundos = 30,
}) => {
  // sem spec, a luta vem da semente: e o caminho da composicao gerada
  const usado = React.useMemo(
    () => spec ?? gerarLuta(seed, { segundos }),
    [spec, seed, segundos],
  );
  const timeline = React.useMemo(() => compilar(usado), [usado]);
  return (
    <>
      <FightScene timeline={timeline} debug={debug} />
      <FightAudio timeline={timeline} />
    </>
  );
};

/**
 * Duracao da composicao, em quadros.
 *
 * Precisa ser calculada FORA do componente, porque o Remotion pede
 * durationInFrames na hora de registrar a composicao, nao na hora de desenhar.
 * O hit stop soma quadros congelados, entao entra na conta.
 */
export const duracaoDoPrototipo = (spec: FightSpec): number => {
  const t = compilar(spec);
  const congelados = t.impacts.reduce((soma, i) => soma + i.hitStop, 0);
  return t.durationInFrames + congelados;
};
