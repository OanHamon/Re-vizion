// Générateur pseudo-aléatoire à graine (mulberry32).
// Même graine = même suite de tirages : c'est ce qui permettra au serveur
// de donner les mêmes questions aux deux joueurs.

export interface WeightedEntry<T> {
  item: T;
  weight: number;
}

export interface Rng {
  /** Nombre dans [0, 1). */
  next(): number;
  /** Entier dans [0, maxExclusive). */
  int(maxExclusive: number): number;
  /** Élément au hasard (le tableau ne doit pas être vide). */
  pick<T>(items: readonly T[]): T;
  /** Copie mélangée (Fisher-Yates), le tableau d'origine n'est pas modifié. */
  shuffle<T>(items: readonly T[]): T[];
  /** Tirage pondéré ; les poids nuls ou négatifs ne sortent jamais. undefined si rien n'est tirable. */
  weighted<T>(entries: readonly WeightedEntry<T>[]): T | undefined;
}

export function createRng(seed: number): Rng {
  let state = seed >>> 0;

  const next = (): number => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };

  const int = (maxExclusive: number): number => Math.floor(next() * maxExclusive);

  return {
    next,
    int,
    pick<T>(items: readonly T[]): T {
      if (items.length === 0) throw new Error('pick() sur un tableau vide');
      return items[int(items.length)] as T;
    },
    shuffle<T>(items: readonly T[]): T[] {
      const copy = items.slice();
      for (let i = copy.length - 1; i > 0; i--) {
        const j = int(i + 1);
        [copy[i], copy[j]] = [copy[j] as T, copy[i] as T];
      }
      return copy;
    },
    weighted<T>(entries: readonly WeightedEntry<T>[]): T | undefined {
      const valid = entries.filter((e) => e.weight > 0);
      const total = valid.reduce((sum, e) => sum + e.weight, 0);
      if (total <= 0) return undefined;
      let roll = next() * total;
      for (const entry of valid) {
        roll -= entry.weight;
        if (roll < 0) return entry.item;
      }
      return valid[valid.length - 1]?.item;
    },
  };
}

/** Dérive une graine secondaire, pour avoir des tirages indépendants à partir d'une seule graine de match. */
export function deriveSeed(seed: number, salt: number): number {
  return (Math.imul(seed ^ 0x9e3779b9, 0x85ebca6b) ^ Math.imul(salt + 1, 0xc2b2ae35)) >>> 0;
}
