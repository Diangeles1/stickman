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
import { Sequence } from "remotion";
import { Espetaculo } from "../effects/Espetaculo";
import { QUADROS_DE_ESCOLHA, TelaDeEscolha } from "../effects/TelaDeEscolha";
import { FightScene } from "../scenes/FightScene";
import { compilar } from "../core/timeline";
import { duracaoReal } from "../core/tempo";
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
  /**
   * Desliga TUDO que nao e o corpo: particulas, flash, ondas, rastros, aura,
   * tremor e movimentos de camera (fica um plano de dois neutro). E o modo de
   * julgar a animacao: se a luta nao convence assim, efeito nenhum salva.
   */
  semEfeitos?: boolean;
  /** usadas pela composicao gerada; o spec chega pronto via calculateMetadata */
  seed?: number;
  segundos?: number;
  /** abre com a tela "ESCOLHA UM PERSONAGEM!" e a contagem de 5 segundos */
  escolha?: boolean;
};

export const Prototype: React.FC<PrototypeProps> = ({
  spec,
  debug = false,
  semEfeitos = false,
  seed = 1,
  segundos = 30,
  escolha = false,
}) => {
  // sem spec, a luta vem da semente: e o caminho da composicao gerada
  const usado = React.useMemo(
    () => spec ?? gerarLuta(seed, { segundos }),
    [spec, seed, segundos],
  );
  const timeline = React.useMemo(() => compilar(usado), [usado]);
  const luta = (
    <>
      <FightScene timeline={timeline} debug={debug} semEfeitos={semEfeitos} />
      {semEfeitos ? null : <Espetaculo timeline={timeline} />}
      {semEfeitos ? null : <FightAudio timeline={timeline} />}
    </>
  );
  if (!escolha) return luta;
  // a luta inteira comeca depois da escolha: dentro da Sequence o quadro
  // volta a contar do zero, entao nada da luta precisa saber da tela antes
  return (
    <>
      <Sequence durationInFrames={QUADROS_DE_ESCOLHA}>
        <TelaDeEscolha a={usado.fighterA} b={usado.fighterB} />
      </Sequence>
      <Sequence from={QUADROS_DE_ESCOLHA}>{luta}</Sequence>
    </>
  );
};

/**
 * Duracao da composicao, em quadros.
 *
 * Precisa ser calculada FORA do componente, porque o Remotion pede
 * durationInFrames na hora de registrar a composicao, nao na hora de desenhar.
 * O hit stop e a camera lenta somam quadros reais, entao entram na conta.
 */
export const duracaoDoPrototipo = (
  spec: FightSpec,
  opcoes: { escolha?: boolean } = {},
): number => {
  return duracaoReal(compilar(spec)) + (opcoes.escolha ? QUADROS_DE_ESCOLHA : 0);
};
