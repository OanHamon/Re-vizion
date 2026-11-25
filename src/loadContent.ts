// Chargement du contenu côté navigateur : config/*.json et tous les decks de decks/.
// Tout est validé ici, au chargement ; le reste du code ne reçoit que des données valides.
import quiz from '../config/quiz.json';
import bonuses from '../config/bonuses.json';
import weapons from '../config/weapons.json';
import player from '../config/player.json';
import modes from '../config/modes.json';
import arenas from '../config/arenas.json';
import assets from '../config/assets.json';
import stats from '../config/stats.json';
import sounds from '../config/sounds.json';
import economy from '../config/economy.json';
import pickups from '../config/pickups.json';
import materials from '../config/materials.json';
import { parseGameConfig, type GameConfig } from './core/config/gameConfig';
import { validateDeck, type Deck } from './core/deck/validateDeck';

export interface Content {
  config: GameConfig;
  decks: Deck[];
  /** Erreurs des decks refusés (les decks valides restent jouables). */
  deckErrors: string[];
}

export type ContentResult = { ok: true; content: Content } | { ok: false; title: string; errors: string[] };

// Tout fichier ajouté dans decks/ est pris en compte sans toucher au code.
const deckFiles = import.meta.glob('../decks/*.json', { eager: true, import: 'default' });

export function loadContent(): ContentResult {
  const configResult = parseGameConfig({ quiz, bonuses, weapons, player, modes, arenas, assets, stats, sounds, economy, pickups, materials });
  if (!configResult.ok) return { ok: false, title: 'Configuration invalide', errors: configResult.errors };

  const decks: Deck[] = [];
  const deckErrors: string[] = [];
  for (const [path, raw] of Object.entries(deckFiles).sort(([a], [b]) => a.localeCompare(b))) {
    const result = validateDeck(raw, path.replace('../', ''));
    if (result.ok) decks.push(result.deck);
    else deckErrors.push(...result.errors);
  }

  if (decks.length === 0) {
    return { ok: false, title: 'Aucun deck jouable', errors: deckErrors.length ? deckErrors : ['Le dossier decks/ est vide.'] };
  }
  return { ok: true, content: { config: configResult.config, decks, deckErrors } };
}
