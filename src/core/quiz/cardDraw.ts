// Tirage des cartes proposées à chaque tour.
// Une rareté n'est tirable que si : son poids est > 0 dans le mode courant,
// son coût rentre dans le temps restant, il reste une question de sa tranche,
// et il reste au moins un bonus de cette rareté à proposer.
import type { GameConfig } from '../config/gameConfig';
import type { BonusDef, Rarity } from '../config/schemas';
import type { Rng } from '../random';

export type DrawMode = 'normal' | 'doubleOrNothing';

export interface Card {
  /** Unique dans le match. */
  id: string;
  bonusId: string;
  family: string;
  rarity: string;
  costMs: number;
  /** Carte « quitte ou double » : une erreur donne un gros malus. */
  doubleOrNothing: boolean;
}

export interface DrawContext {
  config: GameConfig;
  rng: Rng;
  remainingMs: number;
  mode: DrawMode;
  /** Arme équipée : filtre les bonus de la famille Arme. */
  weaponId: string;
  ownedBonusIds: ReadonlySet<string>;
  hasQuestionFor(rarity: Rarity): boolean;
  /** Préfixe des ids de cartes (ex. « t3 »). */
  idPrefix: string;
}

export interface DrawResult {
  cards: Card[];
  /** Mode réellement appliqué : un quitte ou double impossible retombe en tirage normal. */
  mode: DrawMode;
}

export function rarityCostMs(rarity: Rarity): number {
  return Math.round(rarity.costSeconds * 1000);
}

export function bonusFitsWeapon(bonus: BonusDef, weaponId: string): boolean {
  return bonus.weapons.length === 0 || bonus.weapons.includes(weaponId);
}

function weightsFor(config: GameConfig, mode: DrawMode): Record<string, number> {
  return mode === 'doubleOrNothing' ? config.quiz.combos.doubleOrNothing.rarityWeights : config.quiz.draw.normalWeights;
}

function drawWithMode(ctx: DrawContext, mode: DrawMode): Card[] {
  const { config, rng } = ctx;
  const weights = weightsFor(config, mode);
  const cards: Card[] = [];
  const inHand = new Set<string>();

  const candidates = (rarity: Rarity): BonusDef[] =>
    config.bonuses.bonuses.filter(
      (b) =>
        b.rarity === rarity.id &&
        bonusFitsWeapon(b, ctx.weaponId) &&
        !inHand.has(b.id) &&
        !(config.quiz.draw.excludeOwnedBonuses && ctx.ownedBonusIds.has(b.id)),
    );

  for (let slot = 0; slot < config.quiz.cardsPerTurn; slot++) {
    const eligible = config.quiz.rarities.filter(
      (r) =>
        (weights[r.id] ?? 0) > 0 &&
        rarityCostMs(r) <= ctx.remainingMs &&
        ctx.hasQuestionFor(r) &&
        candidates(r).length > 0,
    );
    const rarity = rng.weighted(eligible.map((r) => ({ item: r, weight: weights[r.id] ?? 0 })));
    if (!rarity) break;

    let pool = candidates(rarity);
    if (config.quiz.draw.preferDistinctFamilies) {
      const families = new Set(cards.map((c) => c.family));
      const fresh = pool.filter((b) => !families.has(b.family));
      if (fresh.length > 0) pool = fresh;
    }
    const bonus = rng.pick(pool);
    inHand.add(bonus.id);
    cards.push({
      id: `${ctx.idPrefix}-${slot}`,
      bonusId: bonus.id,
      family: bonus.family,
      rarity: rarity.id,
      costMs: rarityCostMs(rarity),
      doubleOrNothing: mode === 'doubleOrNothing',
    });
  }
  return cards;
}

export function drawCards(ctx: DrawContext): DrawResult {
  if (ctx.mode === 'doubleOrNothing') {
    const cards = drawWithMode(ctx, 'doubleOrNothing');
    if (cards.length > 0) return { cards, mode: 'doubleOrNothing' };
  }
  return { cards: drawWithMode(ctx, 'normal'), mode: 'normal' };
}
