import { describe, expect, it } from 'vitest';
import { drawCards, type DrawContext } from '../src/core/quiz/cardDraw';
import { createRng } from '../src/core/random';
import { loadConfig } from './helpers';

const config = loadConfig();
const bonusById = new Map(config.bonuses.bonuses.map((b) => [b.id, b]));

function ctx(overrides: Partial<DrawContext> = {}): DrawContext {
  return {
    config,
    rng: createRng(1),
    remainingMs: 300_000,
    mode: 'normal',
    weaponId: 'pistol',
    ownedBonusIds: new Set(),
    hasQuestionFor: () => true,
    idPrefix: 't',
    ...overrides,
  };
}

/** Répète un tirage avec des graines différentes. */
function manyDraws(overrides: Partial<DrawContext>, n = 300) {
  return Array.from({ length: n }, (_, seed) => drawCards(ctx({ ...overrides, rng: createRng(seed) })));
}

describe('tirage des 3 cartes', () => {
  it('propose 3 cartes avec des bonus différents, de familles différentes', () => {
    for (const { cards } of manyDraws({})) {
      expect(cards).toHaveLength(3);
      expect(new Set(cards.map((c) => c.bonusId)).size).toBe(3);
      expect(new Set(cards.map((c) => c.family)).size).toBe(3);
      for (const card of cards) {
        const bonus = bonusById.get(card.bonusId)!;
        expect(bonus.rarity).toBe(card.rarity);
        expect(bonus.family).toBe(card.family);
      }
    }
  });

  it('ne propose que des cartes dont le coût rentre dans le temps restant', () => {
    for (const { cards } of manyDraws({ remainingMs: 50_000 })) {
      for (const card of cards) {
        expect(card.costMs).toBeLessThanOrEqual(50_000);
        expect(['common', 'rare']).toContain(card.rarity);
      }
    }
  });

  it('ne propose rien quand il ne reste même plus de quoi jouer une Commune', () => {
    expect(drawCards(ctx({ remainingMs: 29_999 })).cards).toEqual([]);
  });

  it('associe le coût de la rareté (30 / 45 / 60 / 75 s)', () => {
    const costs = { common: 30_000, rare: 45_000, epic: 60_000, legendary: 75_000 } as Record<string, number>;
    for (const { cards } of manyDraws({ mode: 'doubleOrNothing' }, 50).concat(manyDraws({}, 50))) {
      for (const card of cards) expect(card.costMs).toBe(costs[card.rarity]);
    }
  });

  it('tirage normal : jamais de Légendaire', () => {
    const rarities = manyDraws({}).flatMap((d) => d.cards.map((c) => c.rarity));
    expect(rarities).not.toContain('legendary');
    expect(new Set(rarities)).toEqual(new Set(['common', 'rare', 'epic']));
  });

  it('quitte ou double : plus rare, sans Commune, et c’est là que sortent les Légendaires', () => {
    const draws = manyDraws({ mode: 'doubleOrNothing' });
    const rarities = draws.flatMap((d) => d.cards.map((c) => c.rarity));
    expect(rarities).not.toContain('common');
    expect(rarities).toContain('legendary');
    for (const d of draws) {
      expect(d.mode).toBe('doubleOrNothing');
      expect(d.cards.every((c) => c.doubleOrNothing)).toBe(true);
    }
  });

  it('quitte ou double impossible (pas assez de temps) : retombe en tirage normal', () => {
    const { cards, mode } = drawCards(ctx({ mode: 'doubleOrNothing', remainingMs: 40_000 }));
    expect(mode).toBe('normal');
    expect(cards.length).toBeGreaterThan(0);
    expect(cards.every((c) => c.rarity === 'common' && !c.doubleOrNothing)).toBe(true);
  });

  it('ne propose pas une rareté dont la tranche de questions est épuisée', () => {
    const rarities = manyDraws({ hasQuestionFor: (r) => r.id !== 'common' }).flatMap((d) => d.cards.map((c) => c.rarity));
    expect(rarities).not.toContain('common');
  });

  it('les bonus Arme suivent l’arme équipée', () => {
    for (const weaponId of ['pistol', 'sniper']) {
      for (const { cards } of manyDraws({ weaponId })) {
        for (const card of cards) {
          const bonus = bonusById.get(card.bonusId)!;
          expect(bonus.weapons.length === 0 || bonus.weapons.includes(weaponId)).toBe(true);
        }
      }
    }
  });

  it('ne repropose pas un bonus déjà gagné', () => {
    const owned = new Set(['atk_damage_c', 'def_shield_c', 'mob_speed_c', 'atk_damage_r']);
    for (const { cards } of manyDraws({ ownedBonusIds: owned })) {
      for (const card of cards) expect(owned.has(card.bonusId)).toBe(false);
    }
  });

  it('même graine = même main', () => {
    expect(drawCards(ctx({ rng: createRng(77) }))).toEqual(drawCards(ctx({ rng: createRng(77) })));
  });
});
