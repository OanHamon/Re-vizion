import { describe, expect, it } from 'vitest';
import { parseGameConfig, type GameConfig } from '../src/core/config/gameConfig';
import { QuizSession } from '../src/core/quiz/quizSession';
import { loadConfig, loadDeck, rawConfig } from './helpers';

const config = loadConfig();
const { questions } = loadDeck();
const T0 = 10_000;

/** Les tests de règles jouent sur 5:00 (durée du brief), quelle que soit la durée par défaut de la config. */
function newSession(seed = 1, cfg: GameConfig = config) {
  return new QuizSession({ config: cfg, questions, seed, now: T0, budgetSeconds: 300 });
}

/** Config modifiée à partir des vrais fichiers. */
function configWith(mutate: (raw: any) => void): GameConfig {
  const raw = rawConfig() as any;
  mutate(raw);
  const result = parseGameConfig(raw);
  if (!result.ok) throw new Error(result.errors.join('\n'));
  return result.config;
}

/** Choisit la première carte jouable et répond juste ou faux. */
function playTurn(s: QuizSession, now: number, correct: boolean) {
  const card = s.hand.find((c) => s.isPlayable(c, now))!;
  expect(s.pickCard(card.id, now)).toEqual({ ok: true });
  const q = s.active!.question;
  const answer = correct ? q.reponse : (q.reponse + 1) % q.choix.length;
  expect(s.answer(answer, now)).toEqual({ ok: true });
  const result = s.lastResult!;
  s.next(now);
  return result;
}

describe('session de quiz', () => {
  it('démarre sur un choix de 3 cartes jouables', () => {
    const s = newSession();
    expect(s.phase).toBe('choosing');
    expect(s.hand).toHaveLength(3);
    expect(s.hand.every((c) => s.isPlayable(c, T0))).toBe(true);
    expect(s.remainingMs(T0)).toBe(300_000);
    expect(s.questionNumber).toBe(1);
  });

  it('prend la durée de la config par défaut, ou celle choisie par le joueur', () => {
    const byDefault = new QuizSession({ config, questions, seed: 1, now: T0 });
    expect(byDefault.remainingMs(T0)).toBe(config.quiz.budgetSeconds * 1000);
    const chosen = new QuizSession({ config, questions, seed: 1, now: T0, budgetSeconds: 180 });
    expect(chosen.remainingMs(T0)).toBe(180_000);
  });

  it('en 1:00, la phase finit dès qu’il reste moins de 30 s, et aucune Légendaire (75 s) n’est possible', () => {
    const s = new QuizSession({ config, questions, seed: 2, now: T0, budgetSeconds: 60 });
    expect(s.hand.every((c) => c.costMs <= 60_000)).toBe(true);
    expect(s.tick(T0 + 30_001)).toBe(true);
    expect(s.phase).toBe('finished');
  });

  it('bonne réponse : le bonus de la carte entre dans l’inventaire', () => {
    const s = newSession();
    const card = s.hand[0]!;
    s.pickCard(card.id, T0);
    expect(s.phase).toBe('answering');
    expect(s.active!.deadline).toBe(T0 + card.costMs);
    expect(s.answer(s.active!.question.reponse, T0 + 5_000)).toEqual({ ok: true });
    expect(s.phase).toBe('feedback');
    expect(s.lastResult).toMatchObject({ correct: true, timedOut: false, malus: null });
    expect(s.lastResult!.gained?.defId).toBe(card.bonusId);
    expect(s.inventory.bonuses()).toHaveLength(1);
    expect(s.combo.correctStreak).toBe(1);
  });

  it('mauvaise réponse : rien (ni bonus ni malus)', () => {
    const s = newSession();
    const result = playTurn(s, T0, false);
    expect(result).toMatchObject({ correct: false, gained: null, malus: null });
    expect(s.inventory.all()).toHaveLength(0);
  });

  it('temps de réponse écoulé = mauvaise réponse, horodatée à l’échéance', () => {
    const s = newSession();
    s.pickCard(s.hand[0]!.id, T0);
    const deadline = s.active!.deadline;
    expect(s.tick(deadline - 1)).toBe(false);
    expect(s.tick(deadline)).toBe(true);
    expect(s.lastResult).toMatchObject({ correct: false, timedOut: true, answer: null, answeredAt: deadline });
  });

  it('une réponse arrivée après l’échéance est refusée et compte comme temps écoulé', () => {
    const s = newSession();
    s.pickCard(s.hand[0]!.id, T0);
    const q = s.active!.question;
    expect(s.answer(q.reponse, s.active!.deadline + 10)).toEqual({ ok: false, reason: 'temps écoulé' });
    expect(s.lastResult).toMatchObject({ correct: false, timedOut: true });
  });

  it('refuse une réponse mal formée sans consommer la question', () => {
    const s = newSession();
    s.pickCard(s.hand[0]!.id, T0);
    expect(s.answer(9, T0).ok).toBe(false);
    expect(s.answer('a', T0).ok).toBe(false);
    expect(s.phase).toBe('answering');
  });

  it('l’horloge globale tourne pendant le choix, la question et le retour', () => {
    const s = newSession();
    s.pickCard(s.hand[0]!.id, T0 + 10_000);
    s.answer(s.active!.question.reponse, T0 + 18_000);
    s.next(T0 + 25_000);
    expect(s.remainingMs(T0 + 25_000)).toBe(275_000);
  });

  it('refuse une carte dont le coût ne rentre plus dans le temps restant', () => {
    // Tirage normal limité aux Épiques (60 s) et Communes (30 s) ; on cherche une main qui a les deux.
    const cfg = configWith((raw) => (raw.quiz.draw.normalWeights = { common: 1, rare: 0, epic: 1, legendary: 0 }));
    const hasBoth = (s: QuizSession) => s.hand.some((c) => c.rarity === 'epic') && s.hand.some((c) => c.rarity === 'common');
    let s = newSession(0, cfg);
    for (let seed = 1; !hasBoth(s); seed++) s = newSession(seed, cfg);

    const epic = s.hand.find((c) => c.rarity === 'epic')!;
    const common = s.hand.find((c) => c.rarity === 'common')!;
    const now = T0 + 250_000; // reste 50 s
    expect(s.isPlayable(epic, now)).toBe(false);
    expect(s.isPlayable(common, now)).toBe(true);
    expect(s.pickCard(epic.id, now)).toEqual({ ok: false, reason: 'pas assez de temps pour cette carte' });
    expect(s.phase).toBe('choosing');
    expect(s.pickCard(common.id, now)).toEqual({ ok: true });
  });

  it('si plus aucune carte de la main ne rentre, une nouvelle main est tirée', () => {
    // Main d'Épiques forcée : on part d'une config où seules les Épiques sortent…
    const epicOnly = configWith((raw) => (raw.quiz.draw.normalWeights = { common: 0, rare: 0, epic: 1, legendary: 0 }));
    const s = newSession(4, epicOnly);
    expect(s.hand.every((c) => c.rarity === 'epic')).toBe(true);
    // …quand il reste 50 s, aucune Épique ne rentre et aucune autre rareté n'est tirable : fin de phase.
    s.tick(T0 + 250_000);
    expect(s.phase).toBe('finished');

    // Avec des Communes possibles, la main est retirée au lieu de finir.
    const mixed = configWith((raw) => (raw.quiz.draw.normalWeights = { common: 1, rare: 0, epic: 100000, legendary: 0 }));
    const s2 = newSession(4, mixed);
    const before = s2.hand.map((c) => c.id);
    expect(s2.tick(T0 + 250_000)).toBe(true);
    expect(s2.phase).toBe('choosing');
    expect(s2.hand.map((c) => c.id)).not.toEqual(before);
    expect(s2.hand.every((c) => c.rarity === 'common' && s2.isPlayable(c, T0 + 250_000))).toBe(true);
  });

  it('la phase se termine quand il ne reste plus de quoi jouer une Commune', () => {
    const s = newSession();
    expect(s.tick(T0 + 270_000)).toBe(false); // reste 30 s : une Commune rentre encore
    expect(s.tick(T0 + 270_001)).toBe(true);
    expect(s.phase).toBe('finished');
    expect(s.pickCard('h1-0', T0 + 270_001).ok).toBe(false);
  });

  it('après le retour, fin de phase si le temps restant est trop court', () => {
    const s = newSession();
    s.pickCard(s.hand[0]!.id, T0 + 200_000);
    s.answer(s.active!.question.reponse, T0 + 275_000 - 1);
    s.next(T0 + 280_000);
    expect(s.phase).toBe('finished');
  });

  it('aucune question en double sur tout un match', () => {
    const s = newSession(12);
    while (s.phase !== 'finished') playTurn(s, T0, true);
    const ids = s.results.map((r) => r.question.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids.length).toBeGreaterThan(10);
    for (const r of s.results) {
      const rarity = config.quiz.rarities.find((x) => x.id === r.card.rarity)!;
      expect(rarity.difficulties).toContain(r.question.difficulte);
    }
  });

  it('3 bonnes réponses d’affilée : main quitte ou double, une erreur donne un malus lourd de la famille', () => {
    const s = newSession(21);
    for (let i = 0; i < 3; i++) playTurn(s, T0, true);
    expect(s.handMode).toBe('doubleOrNothing');
    expect(s.hand.every((c) => c.doubleOrNothing && c.rarity !== 'common')).toBe(true);

    const card = s.hand[0]!;
    s.pickCard(card.id, T0);
    const q = s.active!.question;
    s.answer((q.reponse + 1) % q.choix.length, T0);
    expect(s.lastResult!.malus).toMatchObject({ kind: 'malus', severity: 'heavy', family: card.family });
    expect(s.combo.correctStreak).toBe(0);
    s.next(T0);
    expect(s.handMode).toBe('normal');
  });

  it('quitte ou double réussi : le bonus rare est gagné et la série continue', () => {
    const s = newSession(22);
    for (let i = 0; i < 3; i++) playTurn(s, T0, true);
    const result = playTurn(s, T0, true);
    expect(result.card.doubleOrNothing).toBe(true);
    expect(result.gained?.defId).toBe(result.card.bonusId);
    expect(s.combo.correctStreak).toBe(4);
    expect(s.handMode).toBe('normal');
  });

  it('combo négatif : malus léger à chaque erreur à partir de la 4e d’affilée', () => {
    const s = newSession(5);
    const results = [false, false, false, false, false].map((ok) => playTurn(s, T0, ok));
    expect(results.map((r) => r.malus?.severity ?? null)).toEqual([null, null, null, 'light', 'light']);
    expect(playTurn(s, T0, true).malus).toBeNull();
    expect(playTurn(s, T0, false).malus).toBeNull();
    expect(s.inventory.maluses()).toHaveLength(2);
  });

  it('même graine et mêmes actions = même partie', () => {
    const run = (seed: number) => {
      const s = newSession(seed);
      for (const ok of [true, false, true, true, true, false]) playTurn(s, T0, ok);
      return s.results.map((r) => `${r.card.bonusId}/${r.question.id}`);
    };
    expect(run(8)).toEqual(run(8));
    expect(run(8)).not.toEqual(run(9));
  });

  it('le récap compte les réussites et liste les questions ratées', () => {
    const s = newSession(30);
    for (const ok of [true, false, true, false]) playTurn(s, T0, ok);
    s.tick(T0 + 299_000);
    const recap = s.recap();
    expect(recap).toMatchObject({ correct: 2, total: 4, bestStreak: 1 });
    expect(recap.missed.map((r) => r.turn)).toEqual([2, 4]);
    expect(recap.bonuses).toHaveLength(2);
  });
});

describe('fin du quiz : compte à rebours du dernier retour', () => {
  const endMs = config.quiz.endCountdownSeconds * 1000;

  /** 60 s de budget : une Commune (30 s) répondue à 35 s laisse 25 s, donc c'est le dernier retour. */
  function lastFeedback() {
    const s = new QuizSession({ config, questions, seed: 2, now: T0, budgetSeconds: 60 });
    const card = s.hand.find((c) => c.costMs === 30_000) ?? s.hand[0]!;
    s.pickCard(card.id, T0 + 5_000);
    s.answer(s.active!.question.reponse, T0 + 35_000 - 1);
    return s;
  }

  it('le compte à rebours dure endCountdownSeconds (5 s par défaut)', () => {
    expect(config.quiz.endCountdownSeconds).toBe(5);
  });

  it('se lance dès la réponse quand il ne reste plus de quoi jouer une carte, puis termine la phase seul', () => {
    const s = lastFeedback();
    expect(s.phase).toBe('feedback');
    const at = T0 + 35_000 - 1;
    expect(s.autoEndAt).toBe(at + endMs);
    s.tick(at + endMs - 1);
    expect(s.phase).toBe('feedback');
    s.tick(at + endMs);
    expect(s.phase).toBe('finished');
    expect(s.autoEndAt).toBeNull();
  });

  it('« next » passe le compte à rebours', () => {
    const s = lastFeedback();
    s.next(T0 + 36_000);
    expect(s.phase).toBe('finished');
  });

  it('pas de compte à rebours s’il reste de quoi jouer ; il démarre si le temps s’épuise pendant la lecture', () => {
    const s = newSession();
    const card = s.hand[0]!;
    s.pickCard(card.id, T0);
    s.answer(s.active!.question.reponse, T0 + 1_000);
    expect(s.autoEndAt).toBeNull();
    // le joueur lit le retour jusqu'à ce qu'il reste moins de 30 s
    const late = T0 + 300_000 - 29_000;
    s.tick(late);
    expect(s.autoEndAt).toBe(late + endMs);
    s.tick(late + endMs);
    expect(s.phase).toBe('finished');
  });

  it('une nouvelle main efface le compte à rebours', () => {
    const s = newSession();
    playTurn(s, T0, true);
    expect(s.phase).toBe('choosing');
    expect(s.autoEndAt).toBeNull();
  });
});
