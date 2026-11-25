// Tests des briques simples : RNG, budget de temps, pioche de questions, combos, inventaire.
import { describe, expect, it } from 'vitest';
import { createRng } from '../src/core/random';
import { createTimeBudget, fitsInBudget, remainingMs } from '../src/core/quiz/timeBudget';
import { QuestionPool } from '../src/core/quiz/questionPool';
import { INITIAL_COMBO, isDoubleOrNothingTurn, malusSeverityFor, pickMalus, registerAnswer } from '../src/core/quiz/combo';
import { Inventory } from '../src/core/quiz/inventory';
import { loadConfig, loadDeck } from './helpers';

const config = loadConfig();
const { questions } = loadDeck();

describe('RNG à graine', () => {
  it('même graine = même suite', () => {
    const a = createRng(42);
    const b = createRng(42);
    expect(Array.from({ length: 10 }, () => a.next())).toEqual(Array.from({ length: 10 }, () => b.next()));
  });

  it('le tirage pondéré ne sort jamais un poids nul', () => {
    const rng = createRng(1);
    for (let i = 0; i < 500; i++) {
      expect(rng.weighted([{ item: 'a', weight: 0 }, { item: 'b', weight: 1 }])).toBe('b');
    }
    expect(rng.weighted([{ item: 'a', weight: 0 }])).toBeUndefined();
  });

  it('shuffle renvoie une permutation sans toucher au tableau source', () => {
    const src = [1, 2, 3, 4, 5, 6];
    const out = createRng(3).shuffle(src);
    expect(src).toEqual([1, 2, 3, 4, 5, 6]);
    expect([...out].sort()).toEqual(src);
  });
});

describe('budget de temps', () => {
  const budget = createTimeBudget(300_000, 1_000);

  it('décompte en temps réel et ne descend pas sous zéro', () => {
    expect(remainingMs(budget, 1_000)).toBe(300_000);
    expect(remainingMs(budget, 61_000)).toBe(240_000);
    expect(remainingMs(budget, 999_999)).toBe(0);
  });

  it('une carte rentre si son coût tient dans le temps restant', () => {
    const now = 1_000 + 300_000 - 45_000; // reste 45 s
    expect(fitsInBudget(budget, 45_000, now)).toBe(true);
    expect(fitsInBudget(budget, 60_000, now)).toBe(false);
  });
});

describe('pioche de questions', () => {
  it('ne donne jamais deux fois la même question et respecte la tranche', () => {
    const pool = new QuestionPool(questions, createRng(7));
    const seen = new Set<string>();
    for (;;) {
      const q = pool.take([1, 2]);
      if (!q) break;
      expect([1, 2]).toContain(q.difficulte);
      expect(seen.has(q.id)).toBe(false);
      seen.add(q.id);
    }
    expect(seen.size).toBe(questions.filter((q) => q.difficulte <= 2).length);
    expect(pool.hasAvailable([1, 2])).toBe(false);
    expect(pool.hasAvailable([5])).toBe(true);
  });

  it('même graine = mêmes questions dans le même ordre (multijoueur)', () => {
    const a = new QuestionPool(questions, createRng(99));
    const b = new QuestionPool(questions, createRng(99));
    for (const tranche of [[3], [1, 2], [5], [3], [4]]) {
      expect(a.take(tranche)?.id).toBe(b.take(tranche)?.id);
    }
  });
});

describe('combos', () => {
  const play = (answers: boolean[]) => answers.reduce(registerAnswer, INITIAL_COMBO);

  it('compte les séries et la meilleure série', () => {
    expect(play([true, true, false, true])).toEqual({ correctStreak: 1, wrongStreak: 0, bestStreak: 2 });
    expect(play([false, false])).toEqual({ correctStreak: 0, wrongStreak: 2, bestStreak: 0 });
  });

  it('quitte ou double après 3 bonnes réponses, puis à 6, pas à 4', () => {
    expect(isDoubleOrNothingTurn(play([true, true]), config)).toBe(false);
    expect(isDoubleOrNothingTurn(play([true, true, true]), config)).toBe(true);
    expect(isDoubleOrNothingTurn(play([true, true, true, true]), config)).toBe(false);
    expect(isDoubleOrNothingTurn(play(Array(6).fill(true)), config)).toBe(true);
    expect(isDoubleOrNothingTurn(play([true, true, false, true]), config)).toBe(false);
  });

  it('erreur en quitte ou double = malus lourd', () => {
    expect(malusSeverityFor(false, true, play([false]), config)).toBe('heavy');
    expect(malusSeverityFor(true, true, play([true]), config)).toBeNull();
  });

  it('combo négatif : rien jusqu’à 3 erreurs, malus léger à partir de la 4e', () => {
    expect(malusSeverityFor(false, false, play([false, false, false]), config)).toBeNull();
    expect(malusSeverityFor(false, false, play([false, false, false, false]), config)).toBe('light');
    expect(malusSeverityFor(false, false, play([false, false, false, false, false]), config)).toBe('light');
    expect(malusSeverityFor(false, false, play([false, false, false, true, false]), config)).toBeNull();
  });

  it('le malus vient de la même famille que la carte ratée', () => {
    const rng = createRng(5);
    for (const family of ['attack', 'defense', 'mobility', 'weapon']) {
      const malus = pickMalus(config, family, 'heavy', rng);
      expect(malus?.family).toBe(family);
      expect(malus?.severity).toBe('heavy');
    }
  });
});

describe('inventaire', () => {
  it('garde les bonus et malus dans l’ordre, avec les armes spéciales', () => {
    const inv = new Inventory();
    const byId = (id: string) => config.bonuses.bonuses.find((b) => b.id === id)!;
    inv.addBonus(byId('atk_damage_c'), 1);
    inv.addMalus(config.bonuses.maluses[0]!, 2);
    inv.addBonus(byId('wpn_beam_l'), 3);
    expect(inv.all().map((e) => e.kind)).toEqual(['bonus', 'malus', 'bonus']);
    expect(inv.bonuses().map((e) => e.defId)).toEqual(['atk_damage_c', 'wpn_beam_l']);
    expect(inv.maluses()).toHaveLength(1);
    expect(inv.ownedBonusIds()).toEqual(new Set(['atk_damage_c', 'wpn_beam_l']));
    expect(inv.grantedWeapons()).toEqual(['beam']);
  });
});
