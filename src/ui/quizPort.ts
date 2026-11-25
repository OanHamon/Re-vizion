// Accès des écrans 08 et 09 au quiz, qu'il tourne ici (entraînement solo) ou sur le serveur (salon).
// Les écrans ne lisent que des QuizView : en réseau, la bonne réponse n'arrive qu'après la réponse.
import type { GameConfig } from '../core/config/gameConfig';
import type { Card } from '../core/quiz/cardDraw';
import { quizView, type QuizView } from '../core/match/quizView';
import type { QuizSession } from '../core/quiz/quizSession';
import type { Connection } from '../net/connection';
import type { Clock } from './clock';

export interface QuizPort {
  readonly config: GameConfig;
  view(): QuizView;
  /** Heure dans l'horloge du quiz (celle de view().endsAt et des échéances). */
  now(): number;
  pick(cardId: string): void;
  answer(answer: number): void;
  next(): void;
}

export function remainingMs(port: QuizPort, now = port.now()): number {
  return Math.max(0, port.view().endsAt - now);
}

export function isPlayable(port: QuizPort, card: Card, now = port.now()): boolean {
  return port.view().phase === 'choosing' && card.costMs <= remainingMs(port, now);
}

/** Entraînement solo : la session tourne dans le navigateur. */
export class LocalQuizPort implements QuizPort {
  private cache: QuizView | null = null;

  constructor(
    readonly config: GameConfig,
    readonly session: QuizSession,
    private readonly clock: Clock,
    /** Appelé après chaque action, pour redessiner tout de suite. */
    private readonly onChange: () => void = () => {},
  ) {}

  view(): QuizView {
    if (!this.cache || this.cache.version !== this.session.version) this.cache = quizView(this.session);
    return this.cache;
  }

  now(): number {
    return this.clock.now();
  }

  /** Fait avancer le temps (fin du temps de réponse, fin du budget). */
  tick(): void {
    this.session.tick(this.now());
  }

  pick(cardId: string): void {
    this.session.pickCard(cardId, this.now());
    this.onChange();
  }

  answer(answer: number): void {
    this.session.answer(answer, this.now());
    this.onChange();
  }

  next(): void {
    this.session.next(this.now());
    this.onChange();
  }
}

/** Salon : le serveur fait foi, on n'envoie que des intentions. */
export class RemoteQuizPort implements QuizPort {
  private current: QuizView;

  constructor(
    readonly config: GameConfig,
    private readonly connection: Connection,
    first: QuizView,
  ) {
    this.current = first;
  }

  update(view: QuizView): void {
    this.current = view;
  }

  view(): QuizView {
    return this.current;
  }

  now(): number {
    return this.connection.serverNow();
  }

  pick(cardId: string): void {
    this.connection.send({ type: 'pick', cardId });
  }

  answer(answer: number): void {
    this.connection.send({ type: 'answer', answer });
  }

  next(): void {
    this.connection.send({ type: 'next' });
  }
}
