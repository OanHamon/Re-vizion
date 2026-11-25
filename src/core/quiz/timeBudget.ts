// Budget de temps de la phase quiz.
// L'horloge est injectée (paramètre `now`, en millisecondes) : aucune lecture
// de l'heure système ici, pour pouvoir tester et rejouer côté serveur.

export interface TimeBudget {
  readonly startedAt: number;
  readonly totalMs: number;
}

export function createTimeBudget(totalMs: number, startedAt: number): TimeBudget {
  return { startedAt, totalMs };
}

export function remainingMs(budget: TimeBudget, now: number): number {
  return Math.max(0, budget.totalMs - (now - budget.startedAt));
}

/** Une carte rentre si son coût (= temps max de réponse) tient dans le temps restant. */
export function fitsInBudget(budget: TimeBudget, costMs: number, now: number): boolean {
  return costMs <= remainingMs(budget, now);
}
