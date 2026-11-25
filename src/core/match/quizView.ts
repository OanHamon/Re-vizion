// Ce que l'écran du quiz a le droit de voir : la bonne réponse et l'explication
// n'apparaissent qu'une fois la question répondue (anti-triche en réseau).
// Sert au solo comme au réseau : les écrans 08, 09 et 13 ne lisent que ces vues.
import type { Card, DrawMode } from '../quiz/cardDraw';
import type { ComboState } from '../quiz/combo';
import type { InventoryEntry } from '../quiz/inventory';
import type { QuizPhase, QuizSession, TurnResult } from '../quiz/quizSession';
import { questionType, type Question } from '../deck/questionTypes';

export interface QuestionView {
  id: string;
  type: string;
  difficulte: number;
  enonce: string;
  choix: string[];
}

export interface ResultView {
  turn: number;
  card: Card;
  question: QuestionView;
  answer: number | null;
  correct: boolean;
  timedOut: boolean;
  correctIndex: number;
  answerText: string;
  correctText: string;
  explication: string;
  gained: InventoryEntry | null;
  malus: InventoryEntry | null;
}

export interface QuizView {
  phase: QuizPhase;
  version: number;
  questionNumber: number;
  /** Questions max de la phase (0 = sans limite). */
  maxQuestions: number;
  /** Début et fin du budget de temps, dans l'horloge de la session. */
  totalMs: number;
  endsAt: number;
  hand: Card[];
  handMode: DrawMode;
  active: { turn: number; card: Card; question: QuestionView; deadline: number } | null;
  lastResult: ResultView | null;
  /** Dernier retour : instant où la phase quiz se termine toute seule (compte à rebours), sinon null. */
  autoEndAt: number | null;
  combo: ComboState;
  inventory: InventoryEntry[];
  correct: number;
  answered: number;
}

/** Récap d'un match, éventuellement sur plusieurs manches. */
export interface RecapView {
  correct: number;
  total: number;
  bestStreak: number;
  missed: ResultView[];
  bonuses: InventoryEntry[];
  maluses: InventoryEntry[];
}

export function questionView(q: Question): QuestionView {
  return { id: q.id, type: q.type, difficulte: q.difficulte, enonce: q.enonce, choix: [...q.choix] };
}

export function resultView(r: TurnResult): ResultView {
  const def = questionType(r.question);
  return {
    turn: r.turn,
    card: r.card,
    question: questionView(r.question),
    answer: typeof r.answer === 'number' ? r.answer : null,
    correct: r.correct,
    timedOut: r.timedOut,
    correctIndex: r.question.reponse,
    answerText: r.timedOut ? '' : def.answerText(r.question, r.answer),
    correctText: def.correctAnswerText(r.question),
    explication: r.question.explication,
    gained: r.gained,
    malus: r.malus,
  };
}

export function quizView(s: QuizSession): QuizView {
  const active = s.active;
  const last = s.lastResult;
  return {
    phase: s.phase,
    version: s.version,
    questionNumber: s.questionNumber,
    maxQuestions: s.config.quiz.maxQuestions ?? 0,
    totalMs: s.totalMs,
    endsAt: s.endsAt,
    hand: [...s.hand],
    handMode: s.handMode,
    active: active ? { turn: active.turn, card: active.card, question: questionView(active.question), deadline: active.deadline } : null,
    // le dernier résultat n'est montré qu'au retour : il contient la bonne réponse
    lastResult: s.phase === 'feedback' && last ? resultView(last) : null,
    autoEndAt: s.phase === 'feedback' ? s.autoEndAt : null,
    combo: s.combo,
    inventory: [...s.inventory.all()],
    correct: s.results.filter((r) => r.correct).length,
    answered: s.results.length,
  };
}

/** Récap sur une ou plusieurs manches (résultats bout à bout). */
export function recapView(rounds: readonly { results: readonly TurnResult[]; bestStreak: number; inventory: readonly InventoryEntry[] }[]): RecapView {
  const results = rounds.flatMap((r) => r.results);
  const inventory = rounds.flatMap((r) => r.inventory);
  return {
    correct: results.filter((r) => r.correct).length,
    total: results.length,
    bestStreak: Math.max(0, ...rounds.map((r) => r.bestStreak)),
    missed: results.filter((r) => !r.correct).map(resultView),
    bonuses: inventory.filter((e) => e.kind === 'bonus'),
    maluses: inventory.filter((e) => e.kind === 'malus'),
  };
}
