// Session de la phase quiz : machine à états pure, pilotée par des actions horodatées.
//
//   choosing ──pickCard──▶ answering ──answer / temps écoulé──▶ feedback ──next──▶ choosing
//       │                                                          │
//       └──────── plus assez de temps / plus de carte ─────────────┴──▶ finished
//
// Dernier retour (plus de quoi jouer une carte) : un compte à rebours (endCountdownSeconds)
// démarre et termine la phase tout seul ; « next » permet de le passer.
//
// L'horloge globale tourne en continu (choix, question, retour) : le coût d'une carte
// est le temps MAX pour répondre, le temps réellement consommé est le temps réel écoulé.
import type { GameConfig } from '../config/gameConfig';
import type { BonusDef, Rarity } from '../config/schemas';
import { questionType, type Question } from '../deck/questionTypes';
import { createRng, deriveSeed, type Rng } from '../random';
import { drawCards, rarityCostMs, type Card, type DrawMode } from './cardDraw';
import { INITIAL_COMBO, isDoubleOrNothingTurn, malusSeverityFor, pickMalus, registerAnswer, type ComboState } from './combo';
import { Inventory, type InventoryEntry } from './inventory';
import { QuestionPool } from './questionPool';
import { createTimeBudget, fitsInBudget, remainingMs, type TimeBudget } from './timeBudget';

export type QuizPhase = 'choosing' | 'answering' | 'feedback' | 'finished';

export interface ActiveQuestion {
  turn: number;
  card: Card;
  question: Question;
  startedAt: number;
  deadline: number;
}

export interface TurnResult {
  turn: number;
  card: Card;
  question: Question;
  /** null si le temps est écoulé. */
  answer: unknown;
  correct: boolean;
  timedOut: boolean;
  gained: InventoryEntry | null;
  malus: InventoryEntry | null;
  startedAt: number;
  answeredAt: number;
}

export interface QuizRecap {
  correct: number;
  total: number;
  bestStreak: number;
  results: readonly TurnResult[];
  missed: TurnResult[];
  bonuses: InventoryEntry[];
  maluses: InventoryEntry[];
}

export type ActionResult = { ok: true } | { ok: false; reason: string };

export interface QuizSessionOptions {
  config: GameConfig;
  questions: readonly Question[];
  /** Graine du match : même graine = mêmes questions dans le même ordre. */
  seed: number;
  /** Instant de départ (ms). */
  now: number;
  /** Arme équipée ; par défaut celle de config/player.json. */
  weaponId?: string;
  /** Durée choisie par le joueur (une des durées proposées) ; par défaut celle de config/quiz.json. */
  budgetSeconds?: number;
  /** Questions déjà posées plus tôt dans le match (aucun doublon d'une manche à l'autre). */
  excludeQuestionIds?: Iterable<string>;
}

const fail = (reason: string): ActionResult => ({ ok: false, reason });

export class QuizSession {
  readonly config: GameConfig;
  readonly weaponId: string;
  readonly inventory = new Inventory();

  private readonly budget: TimeBudget;
  private readonly pool: QuestionPool;
  private readonly drawRng: Rng;
  private readonly malusRng: Rng;
  private readonly minCostMs: number;
  private readonly rarityById: Map<string, Rarity>;
  private readonly bonusById: Map<string, BonusDef>;

  private _phase: QuizPhase = 'choosing';
  private _hand: Card[] = [];
  private _handMode: DrawMode = 'normal';
  private _active: ActiveQuestion | null = null;
  private readonly _results: TurnResult[] = [];
  private _combo: ComboState = INITIAL_COMBO;
  private _version = 0;
  private handCount = 0;
  /** Fin automatique du dernier retour (null si ce n'est pas le dernier). */
  private _autoEndAt: number | null = null;

  constructor(options: QuizSessionOptions) {
    const { config, seed } = options;
    this.config = config;
    this.weaponId = options.weaponId ?? config.player.defaultWeapon;
    this.budget = createTimeBudget((options.budgetSeconds ?? config.quiz.budgetSeconds) * 1000, options.now);
    this.pool = new QuestionPool(options.questions, createRng(deriveSeed(seed, 1)), options.excludeQuestionIds);
    this.drawRng = createRng(deriveSeed(seed, 2));
    this.malusRng = createRng(deriveSeed(seed, 3));
    this.minCostMs = Math.min(...config.quiz.rarities.map(rarityCostMs));
    this.rarityById = new Map(config.quiz.rarities.map((r) => [r.id, r]));
    this.bonusById = new Map(config.bonuses.bonuses.map((b) => [b.id, b]));
    this.dealHand(options.now);
  }

  // ---------- lecture de l'état ----------

  get phase(): QuizPhase {
    return this._phase;
  }

  /** Cartes proposées (phase choosing). */
  get hand(): readonly Card[] {
    return this._hand;
  }

  get handMode(): DrawMode {
    return this._handMode;
  }

  get active(): ActiveQuestion | null {
    return this._active;
  }

  get results(): readonly TurnResult[] {
    return this._results;
  }

  get lastResult(): TurnResult | null {
    return this._results[this._results.length - 1] ?? null;
  }

  get combo(): ComboState {
    return this._combo;
  }

  /** Numéro de la question en cours ou à venir (1, 2, 3…). */
  get questionNumber(): number {
    return this._phase === 'feedback' ? this._results.length : this._results.length + 1;
  }

  /** Instant où le dernier retour se termine tout seul, ou null s'il reste de quoi jouer. */
  get autoEndAt(): number | null {
    return this._autoEndAt;
  }

  /** Change à chaque modification d'état : l'interface s'en sert pour savoir quand redessiner. */
  get version(): number {
    return this._version;
  }

  remainingMs(now: number): number {
    return remainingMs(this.budget, now);
  }

  /** Fin du budget de temps (même horloge que `now`). */
  get endsAt(): number {
    return this.budget.startedAt + this.budget.totalMs;
  }

  get totalMs(): number {
    return this.budget.totalMs;
  }

  isPlayable(card: Card, now: number): boolean {
    return this._phase === 'choosing' && this._hand.includes(card) && fitsInBudget(this.budget, card.costMs, now);
  }

  bonusOf(card: Card): BonusDef {
    const bonus = this.bonusById.get(card.bonusId);
    if (!bonus) throw new Error(`Bonus inconnu : ${card.bonusId}`);
    return bonus;
  }

  // ---------- actions ----------

  /**
   * Fait avancer le temps : temps de réponse écoulé, fin de phase,
   * nouveau tirage si plus aucune carte de la main ne rentre dans le temps restant.
   * Renvoie true si l'état a changé.
   */
  tick(now: number): boolean {
    const before = this._version;
    if (this._phase === 'answering' && this._active && now >= this._active.deadline) {
      this.resolve(null, this._active.deadline, true);
    } else if (this._phase === 'feedback') {
      if (this._autoEndAt === null) this.armAutoEnd(now);
      if (this._autoEndAt !== null && now >= this._autoEndAt) this.finish();
    } else if (this._phase === 'choosing') {
      if (!this.canPlayMore(now)) this.finish();
      else if (!this._hand.some((c) => fitsInBudget(this.budget, c.costMs, now))) this.dealHand(now);
    }
    return this._version !== before;
  }

  pickCard(cardId: string, now: number): ActionResult {
    this.tick(now);
    if (this._phase !== 'choosing') return fail('aucun choix de carte en cours');
    const card = this._hand.find((c) => c.id === cardId);
    if (!card) return fail('carte inconnue');
    if (!fitsInBudget(this.budget, card.costMs, now)) return fail('pas assez de temps pour cette carte');
    const rarity = this.rarityById.get(card.rarity);
    const question = rarity ? this.pool.take(rarity.difficulties) : undefined;
    if (!question) return fail('plus de question disponible pour cette rareté');

    this._active = { turn: this._results.length + 1, card, question, startedAt: now, deadline: now + card.costMs };
    this._hand = [];
    this._phase = 'answering';
    this._version++;
    return { ok: true };
  }

  answer(answer: unknown, now: number): ActionResult {
    if (this._phase === 'answering' && this._active && now >= this._active.deadline) {
      this.tick(now); // trop tard : compte comme temps écoulé
      return fail('temps écoulé');
    }
    if (this._phase !== 'answering' || !this._active) return fail('aucune question en cours');
    if (!questionType(this._active.question).isValidAnswer(this._active.question, answer)) return fail('réponse invalide');
    this.resolve(answer, now, false);
    return { ok: true };
  }

  /** Après le retour : nouvelle main, ou fin de phase s'il ne reste plus de quoi jouer. */
  next(now: number): ActionResult {
    if (this._phase !== 'feedback') return fail('aucun retour en cours');
    if (!this.canPlayMore(now)) this.finish();
    else this.dealHand(now);
    return { ok: true };
  }

  recap(): QuizRecap {
    return {
      correct: this._results.filter((r) => r.correct).length,
      total: this._results.length,
      bestStreak: this._combo.bestStreak,
      results: this._results,
      missed: this._results.filter((r) => !r.correct),
      bonuses: this.inventory.bonuses(),
      maluses: this.inventory.maluses(),
    };
  }

  // ---------- interne ----------

  private resolve(answer: unknown, at: number, timedOut: boolean): void {
    const active = this._active;
    if (!active) return;
    const { card, question, turn } = active;
    const correct = !timedOut && questionType(question).isCorrect(question, answer);
    this._combo = registerAnswer(this._combo, correct);

    let gained: InventoryEntry | null = null;
    let malus: InventoryEntry | null = null;
    if (correct) {
      gained = this.inventory.addBonus(this.bonusOf(card), turn);
    } else {
      const severity = malusSeverityFor(false, card.doubleOrNothing, this._combo, this.config);
      const def = severity ? pickMalus(this.config, card.family, severity, this.malusRng) : undefined;
      if (def) malus = this.inventory.addMalus(def, turn);
    }

    this._results.push({
      turn,
      card,
      question,
      answer: timedOut ? null : answer,
      correct,
      timedOut,
      gained,
      malus,
      startedAt: active.startedAt,
      answeredAt: at,
    });
    this._active = null;
    this._phase = 'feedback';
    this._autoEndAt = null;
    this.armAutoEnd(at);
    this._version++;
  }

  /** Reste-t-il de quoi jouer une carte : assez de temps, et le nombre max de questions pas atteint ? */
  private canPlayMore(now: number): boolean {
    const max = this.config.quiz.maxQuestions ?? 0;
    if (max > 0 && this._results.length >= max) return false;
    return this.remainingMs(now) >= this.minCostMs;
  }

  /** Si plus aucune carte ne peut être jouée (temps ou nombre max), ce retour est le dernier : on lance le compte à rebours. */
  private armAutoEnd(now: number): void {
    if (this.canPlayMore(now)) return;
    this._autoEndAt = now + this.config.quiz.endCountdownSeconds * 1000;
    this._version++;
  }

  private dealHand(now: number): void {
    this.handCount++;
    const { cards, mode } = drawCards({
      config: this.config,
      rng: this.drawRng,
      remainingMs: this.remainingMs(now),
      mode: isDoubleOrNothingTurn(this._combo, this.config) ? 'doubleOrNothing' : 'normal',
      weaponId: this.weaponId,
      ownedBonusIds: this.inventory.ownedBonusIds(),
      hasQuestionFor: (rarity) => this.pool.hasAvailable(rarity.difficulties),
      idPrefix: `h${this.handCount}`,
    });
    if (cards.length === 0) {
      this.finish();
      return;
    }
    this._hand = cards;
    this._handMode = mode;
    this._autoEndAt = null;
    this._phase = 'choosing';
    this._version++;
  }

  private finish(): void {
    this._phase = 'finished';
    this._autoEndAt = null;
    this._hand = [];
    this._active = null;
    this._version++;
  }
}
