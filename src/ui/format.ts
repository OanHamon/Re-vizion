// Formatage des durées et libellés lus dans la config.
import type { GameConfig } from '../core/config/gameConfig';

/** 272 400 ms → « 4:33 » (arrondi à la seconde supérieure, comme un compte à rebours). */
export function formatClock(ms: number): string {
  const total = Math.max(0, Math.ceil(ms / 1000));
  const minutes = Math.floor(total / 60);
  const seconds = total % 60;
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
}

export function formatSeconds(ms: number): string {
  return `${Math.round(ms / 1000)} s`;
}

export function familyLabel(config: GameConfig, id: string): string {
  return config.bonuses.families.find((f) => f.id === id)?.label ?? id;
}

export function rarityLabel(config: GameConfig, id: string): string {
  return config.quiz.rarities.find((r) => r.id === id)?.label ?? id;
}

/** Rang de la rareté (1 = la plus commune), pour les pastilles des cartes. */
export function rarityRank(config: GameConfig, id: string): number {
  return config.quiz.rarities.findIndex((r) => r.id === id) + 1;
}

export function weaponLabel(config: GameConfig, id: string): string {
  return config.weapons.weapons.find((w) => w.id === id)?.label ?? id;
}

/** Difficultés d'une rareté : [1, 2] → « Niv. 1-2 », [4] → « Niv. 4 ». */
export function levelLabel(config: GameConfig, rarityId: string): string {
  const d = config.quiz.rarities.find((r) => r.id === rarityId)?.difficulties ?? [];
  if (d.length === 0) return '';
  const min = Math.min(...d);
  const max = Math.max(...d);
  return min === max ? `Niv. ${min}` : `Niv. ${min}-${max}`;
}

/** Difficulté la plus haute d'une rareté (points de la carte) et le maximum possible. */
export function levelPips(config: GameConfig, rarityId: string): { on: number; total: number } {
  const all = config.quiz.rarities.flatMap((r) => r.difficulties);
  const own = config.quiz.rarities.find((r) => r.id === rarityId)?.difficulties ?? [];
  return { on: own.length ? Math.max(...own) : 0, total: all.length ? Math.max(...all) : 0 };
}
