// Pioche de questions d'un match : ordre mélangé une seule fois à partir de la graine,
// puis chaque demande prend la première question non utilisée de la bonne tranche.
// Deux joueurs avec la même graine reçoivent donc la même question
// pour leur n-ième carte d'une même rareté, et jamais deux fois la même.
import type { Question } from '../deck/questionTypes';
import type { Rng } from '../random';

export class QuestionPool {
  private readonly order: readonly Question[];
  private readonly used = new Set<string>();

  /** exclude : questions déjà posées dans les manches précédentes du match. */
  constructor(questions: readonly Question[], rng: Rng, exclude: Iterable<string> = []) {
    this.order = rng.shuffle(questions);
    for (const id of exclude) this.used.add(id);
  }

  countAvailable(difficulties: readonly number[]): number {
    return this.order.filter((q) => !this.used.has(q.id) && difficulties.includes(q.difficulte)).length;
  }

  hasAvailable(difficulties: readonly number[]): boolean {
    return this.order.some((q) => !this.used.has(q.id) && difficulties.includes(q.difficulte));
  }

  /** Prend une question de la tranche et la marque comme utilisée. undefined si la tranche est vide. */
  take(difficulties: readonly number[]): Question | undefined {
    const question = this.order.find((q) => !this.used.has(q.id) && difficulties.includes(q.difficulte));
    if (question) this.used.add(question.id);
    return question;
  }

  get usedCount(): number {
    return this.used.size;
  }
}
