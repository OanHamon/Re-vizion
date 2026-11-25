// Préférences et données du joueur gardées dans ce navigateur (pas de compte pour le proto).
// Le stockage peut être indisponible : chaque lecture retombe sur une valeur par défaut.

const PREFIX = 'reviz.';

function read<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(PREFIX + key);
    return raw === null ? fallback : (JSON.parse(raw) as T);
  } catch {
    return fallback;
  }
}

function write(key: string, value: unknown): void {
  try {
    localStorage.setItem(PREFIX + key, JSON.stringify(value));
  } catch {
    // stockage indisponible : le choix vaut pour cette session seulement
  }
}

export interface LastGame {
  outcome: 'win' | 'loss' | 'draw' | 'solo';
  correct: number;
  total: number;
  at: number;
}

export const store = {
  name: () => read<string>('name', ''),
  setName: (v: string) => write('name', v),
  weaponId: (fallback: string) => read<string>('weapon', fallback),
  setWeaponId: (v: string) => write('weapon', v),
  deckId: () => read<string | null>('deck', null),
  setDeckId: (v: string) => write('deck', v),
  /** Decks importés (JSON brut, revalidé à chaque chargement). */
  importedDecks: () => read<unknown[]>('importedDecks', []),
  setImportedDecks: (v: unknown[]) => write('importedDecks', v),
  /** Multiplicateur de la sensibilité de la souris (1 = valeur de config/player.json). */
  sensitivity: () => read<number>('sensitivity', 1),
  setSensitivity: (v: number) => write('sensitivity', v),
  /** Volume des sons choisi par le joueur (0 à 1, appliqué au volume général de config/sounds.json). */
  volume: () => read<number>('volume', 1),
  setVolume: (v: number) => write('volume', v),
  /** Solde de pièces, gagnées en fin de match (config/economy.json). */
  coins: () => Math.max(0, Math.floor(read<number>('coins', 0)) || 0),
  addCoins: (n: number) => write('coins', store.coins() + Math.max(0, Math.floor(n))),
  lastGame: () => read<LastGame | null>('lastGame', null),
  setLastGame: (v: LastGame) => write('lastGame', v),
  /** Questions signalées depuis le récap (id du deck + id de la question). */
  reported: () => read<string[]>('reported', []),
  setReported: (v: string[]) => write('reported', v),
};

/** Pseudo par défaut, stable pour ce navigateur. */
export function playerName(): string {
  const saved = store.name().trim();
  if (saved) return saved;
  const generated = `Joueur ${Math.floor(1000 + Math.random() * 9000)}`;
  store.setName(generated);
  return generated;
}
