// Hexagone de comparaison de l'écran 14 : 6 axes notés de 0 à `scale` (config/stats.json).
// Logique pure : mêmes calculs côté serveur (fin de match) et en solo.
import type { StatAxis, StatsConfig } from '../config/schemas';
import type { TurnResult } from '../quiz/quizSession';

/** Une question jouée, réduite à ce qui compte pour les stats. */
export interface QuizSample {
  difficulty: number;
  correct: boolean;
  timedOut: boolean;
  answerMs: number;
  allowedMs: number;
}

export interface StatsInput {
  quiz: readonly QuizSample[];
  bestStreak: number;
  /** null : pas de combat (entraînement solo). */
  combat: { shots: number; hits: number; damage: number; opponentHealth: number } | null;
}

/** Valeur de chaque axe, arrondie ; null si rien à mesurer (aucune question, aucun tir…). */
export type AxisValues = Partial<Record<StatAxis, number | null>>;

export function quizSamples(results: readonly TurnResult[]): QuizSample[] {
  return results.map((r) => ({
    difficulty: r.question.difficulte,
    correct: r.correct,
    timedOut: r.timedOut,
    answerMs: Math.max(0, r.answeredAt - r.startedAt),
    allowedMs: r.card.costMs,
  }));
}

const ratio = (num: number, den: number): number | null => (den > 0 ? num / den : null);
const mean = (values: number[]): number | null => (values.length ? values.reduce((a, b) => a + b, 0) / values.length : null);

/** Part brute (0 à 1) de chaque axe, avant mise à l'échelle. */
function shares(input: StatsInput, cfg: StatsConfig): Record<StatAxis, number | null> {
  const { quiz, combat } = input;
  const [dMin, dMax] = cfg.difficultyRange;
  const answered = quiz.length;
  return {
    knowledge: ratio(
      quiz.reduce((sum, q) => sum + (q.correct ? q.difficulty : 0), 0),
      quiz.reduce((sum, q) => sum + q.difficulty, 0),
    ),
    boldness: answered ? ((mean(quiz.map((q) => q.difficulty)) ?? dMin) - dMin) / (dMax - dMin) : null,
    speed: mean(quiz.map((q) => (q.timedOut || q.allowedMs <= 0 ? cfg.timedOutSpeed : 1 - q.answerMs / q.allowedMs))),
    accuracy: combat ? ratio(combat.hits, combat.shots) : null,
    aggression: combat ? ratio(combat.damage, combat.opponentHealth) : null,
    consistency: ratio(input.bestStreak, answered),
  };
}

export function computeAxes(input: StatsInput, cfg: StatsConfig): AxisValues {
  const raw = shares(input, cfg);
  const out: AxisValues = {};
  for (const { id } of cfg.axes) {
    const share = raw[id];
    out[id] = share === null ? null : Math.round(cfg.scale * Math.min(1, Math.max(0, share)));
  }
  return out;
}
