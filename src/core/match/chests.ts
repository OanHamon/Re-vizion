// Coffres à grenades pendant le combat : machine à états pure, horloge injectée.
//
//   ready ──open (joueur proche)──▶ busy (question en cours, un seul joueur)
//     ▲                               │ bonne réponse / erreur / temps écoulé / mort
//     └──────── fin du blocage ◀── locked (pour tout le monde)
//
// La question est tirée dans le deck du salon, jamais déjà posée dans le match.
import type { PickupsConfig } from '../config/schemas';
import { questionType, type Question } from '../deck/questionTypes';

type ChestRules = PickupsConfig['chests'];
type Vec = { x: number; y: number; z: number };

export type ChestStatus = 'ready' | 'busy' | 'locked';

export interface ChestView {
  id: number;
  status: ChestStatus;
  /** Bloqué : instant (ms, horloge du serveur) où il se rouvre ; sinon 0. */
  until: number;
}

export interface ChestAttempt {
  chestId: number;
  playerId: string;
  question: Question;
  startedAt: number;
  deadline: number;
}

export interface ChestOutcome {
  chestId: number;
  playerId: string;
  question: Question;
  /** null : temps écoulé ou mort pendant la question. */
  answer: number | null;
  correct: boolean;
  timedOut: boolean;
  startedAt: number;
  answeredAt: number;
}

export type OpenResult = { ok: true; attempt: ChestAttempt } | { ok: false; reason: string };

/**
 * Prend une question non utilisée : d'abord dans les difficultés préférées, sinon dans la difficulté
 * restante la plus proche de la première préférée. La marque comme utilisée.
 */
export function pickChestQuestion(questions: readonly Question[], used: Set<string>, preferred: readonly number[], random: () => number): Question | undefined {
  const free = questions.filter((q) => !used.has(q.id));
  if (free.length === 0) return undefined;
  let candidates = free.filter((q) => preferred.includes(q.difficulte));
  if (candidates.length === 0) {
    const target = preferred[0]!;
    const best = Math.min(...free.map((q) => Math.abs(q.difficulte - target)));
    candidates = free.filter((q) => Math.abs(q.difficulte - target) === best);
  }
  const question = candidates[Math.min(candidates.length - 1, Math.floor(random() * candidates.length))]!;
  used.add(question.id);
  return question;
}

interface Chest {
  id: number;
  position: Vec;
  status: ChestStatus;
  until: number;
}

export class ChestManager {
  private readonly chests: Chest[];
  private readonly attempts = new Map<string, ChestAttempt>();
  /** Augmente à chaque changement visible par les joueurs (pour savoir quand diffuser l'état). */
  version = 0;

  constructor(
    positions: readonly Vec[],
    private readonly rules: ChestRules,
    private readonly questions: readonly Question[],
    /** Questions déjà posées dans le match (partagé avec le quiz : aucun doublon). */
    private readonly used: Set<string>,
    private readonly random: () => number,
  ) {
    this.chests = positions.map((position, id) => ({ id, position, status: 'ready', until: 0 }));
  }

  /** Début de manche : tous les coffres ouverts, aucune question en cours. */
  reset(): void {
    for (const c of this.chests) {
      c.status = 'ready';
      c.until = 0;
    }
    this.attempts.clear();
    this.version++;
  }

  views(): ChestView[] {
    return this.chests.map((c) => ({ id: c.id, status: c.status, until: c.status === 'locked' ? c.until : 0 }));
  }

  attemptOf(playerId: string): ChestAttempt | undefined {
    return this.attempts.get(playerId);
  }

  open(playerId: string, position: Vec | null, chestId: number, now: number): OpenResult {
    this.tick(now);
    const chest = this.chests[chestId];
    if (!chest) return { ok: false, reason: 'coffre inconnu' };
    if (this.attempts.has(playerId)) return { ok: false, reason: 'question déjà en cours' };
    if (chest.status !== 'ready') return { ok: false, reason: chest.status === 'busy' ? 'coffre occupé' : 'coffre bloqué' };
    if (!position) return { ok: false, reason: 'position inconnue' };
    const d = Math.hypot(position.x - chest.position.x, position.y - chest.position.y, position.z - chest.position.z);
    if (d > this.rules.openRadius) return { ok: false, reason: 'trop loin' };
    const question = pickChestQuestion(this.questions, this.used, this.rules.questionDifficulties, this.random);
    if (!question) return { ok: false, reason: 'plus de questions' };
    const attempt: ChestAttempt = { chestId, playerId, question, startedAt: now, deadline: now + this.rules.answerSeconds * 1000 };
    this.attempts.set(playerId, attempt);
    chest.status = 'busy';
    this.version++;
    return { ok: true, attempt };
  }

  /** Réponse du joueur ; undefined s'il n'a pas de question en cours ou si la réponse est invalide. */
  answer(playerId: string, answer: number, now: number): ChestOutcome | undefined {
    const attempt = this.attempts.get(playerId);
    if (!attempt) return undefined;
    if (now >= attempt.deadline) return this.close(attempt, null, now);
    const def = questionType(attempt.question);
    if (!def.isValidAnswer(attempt.question, answer)) return undefined;
    return this.close(attempt, answer, now, def.isCorrect(attempt.question, answer));
  }

  /** Mort ou départ pendant la question : compte comme un échec. */
  abandon(playerId: string, now: number): ChestOutcome | undefined {
    const attempt = this.attempts.get(playerId);
    return attempt ? this.close(attempt, null, now) : undefined;
  }

  /** Temps écoulés et fins de blocage. Renvoie les questions closes par le temps. */
  tick(now: number): ChestOutcome[] {
    const outcomes: ChestOutcome[] = [];
    for (const attempt of [...this.attempts.values()]) {
      if (now >= attempt.deadline) outcomes.push(this.close(attempt, null, now));
    }
    for (const c of this.chests) {
      if (c.status === 'locked' && now >= c.until) {
        c.status = 'ready';
        c.until = 0;
        this.version++;
      }
    }
    return outcomes;
  }

  private close(attempt: ChestAttempt, answer: number | null, now: number, correct = false): ChestOutcome {
    this.attempts.delete(attempt.playerId);
    const chest = this.chests[attempt.chestId]!;
    const lockSeconds = correct ? this.rules.lockSecondsOnSuccess : this.rules.lockSecondsOnFail;
    chest.status = lockSeconds > 0 ? 'locked' : 'ready';
    chest.until = lockSeconds > 0 ? now + lockSeconds * 1000 : 0;
    this.version++;
    return {
      chestId: attempt.chestId,
      playerId: attempt.playerId,
      question: attempt.question,
      answer,
      correct,
      timedOut: answer === null,
      startedAt: attempt.startedAt,
      answeredAt: now,
    };
  }
}
