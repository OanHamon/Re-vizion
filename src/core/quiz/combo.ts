// Combos : « quitte ou double » après une série de bonnes réponses,
// « combo négatif » après une série d'erreurs.
import type { GameConfig } from '../config/gameConfig';
import type { MalusDef, MalusSeverity } from '../config/schemas';
import type { Rng } from '../random';

export interface ComboState {
  correctStreak: number;
  wrongStreak: number;
  bestStreak: number;
}

export const INITIAL_COMBO: ComboState = { correctStreak: 0, wrongStreak: 0, bestStreak: 0 };

export function registerAnswer(state: ComboState, correct: boolean): ComboState {
  if (correct) {
    const correctStreak = state.correctStreak + 1;
    return { correctStreak, wrongStreak: 0, bestStreak: Math.max(state.bestStreak, correctStreak) };
  }
  return { correctStreak: 0, wrongStreak: state.wrongStreak + 1, bestStreak: state.bestStreak };
}

/**
 * Le prochain tirage est-il un « quitte ou double » ?
 * Oui à chaque palier de la série (3, 6, 9… avec un seuil de 3).
 */
export function isDoubleOrNothingTurn(state: ComboState, config: GameConfig): boolean {
  const n = config.quiz.combos.doubleOrNothing.correctStreak;
  return state.correctStreak > 0 && state.correctStreak % n === 0;
}

/**
 * Gravité du malus après une réponse (état APRÈS la réponse), ou null s'il n'y en a pas.
 * - erreur sur une carte quitte ou double : malus du quitte ou double ;
 * - au-delà du seuil d'erreurs d'affilée (4e erreur et suivantes avec un seuil de 3) : malus du combo négatif.
 */
export function malusSeverityFor(
  correct: boolean,
  wasDoubleOrNothing: boolean,
  after: ComboState,
  config: GameConfig,
): MalusSeverity | null {
  if (correct) return null;
  const { doubleOrNothing, negative } = config.quiz.combos;
  if (wasDoubleOrNothing) return doubleOrNothing.malusSeverity;
  if (after.wrongStreak > negative.wrongStreak) return negative.malusSeverity;
  return null;
}

/** Malus de la gravité demandée, de préférence de la même famille que la carte ratée. */
export function pickMalus(config: GameConfig, family: string, severity: MalusSeverity, rng: Rng): MalusDef | undefined {
  const ofSeverity = config.bonuses.maluses.filter((m) => m.severity === severity);
  const sameFamily = ofSeverity.filter((m) => m.family === family);
  const pool = sameFamily.length > 0 ? sameFamily : ofSeverity;
  return pool.length > 0 ? rng.pick(pool) : undefined;
}
