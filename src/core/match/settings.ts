// Réglages d'un salon (écran 06) et configuration effective d'un match.
// Les valeurs par défaut viennent de config/*.json ; l'hôte ne peut choisir que parmi ce que la config propose.
import type { GameConfig } from '../config/gameConfig';
import { z } from '../zod';

export const MatchSettingsSchema = z.strictObject({
  modeId: z.string().min(1),
  /** Carte du combat (config/arenas.json), parmi les cartes jouables ou celle du mode. */
  arenaId: z.string().min(1),
  /** Taille max du salon (le match démarre dès que tous les présents sont prêts, à partir du minimum). */
  maxPlayers: z.number().int().min(2).max(16),
  budgetSeconds: z.number().positive(),
  /** Questions max par phase quiz (0 = sans limite, seul le temps compte). */
  maxQuestions: z.number().int().min(0),
  /** 0 = sans limite de temps : la manche ne finit qu'au dernier joueur en lice (vies limitées obligatoires). */
  combatSeconds: z.number().min(0),
  rounds: z.number().int().min(1).max(9),
  roundsToWin: z.number().int().min(1).max(9),
  /** Vies par manche (0 = illimitées, avec réapparition). */
  lives: z.number().int().min(0).max(9),
  winCondition: z.enum(['last_alive', 'most_kills']),
  doubleOrNothing: z.boolean(),
  negativeCombo: z.boolean(),
});

export type MatchSettings = z.infer<typeof MatchSettingsSchema>;

/** Réglages par défaut d'un mode, tirés de la config. */
export function defaultSettings(config: GameConfig, modeId = config.modes.defaultMode): MatchSettings {
  const mode = config.modes.modes.find((m) => m.id === modeId) ?? config.modes.modes[0]!;
  return {
    modeId: mode.id,
    arenaId: mode.arena,
    maxPlayers: mode.maxPlayers ?? config.modes.players.default,
    budgetSeconds: config.quiz.budgetSeconds,
    maxQuestions: 0,
    combatSeconds: mode.combatMaxSeconds,
    rounds: mode.rounds,
    roundsToWin: mode.roundsToWin,
    lives: mode.lives,
    winCondition: mode.winCondition,
    doubleOrNothing: true,
    negativeCombo: true,
  };
}

/**
 * Vérifie des réglages reçus d'un client : forme (zod) et valeurs autorisées par la config.
 * Hors mode « éditable », manches, vies et condition de victoire sont imposées par le mode ;
 * un mode peut aussi imposer le nombre de joueurs (Duel : 2).
 */
export function checkSettings(config: GameConfig, raw: unknown): { ok: true; settings: MatchSettings } | { ok: false; error: string } {
  const parsed = MatchSettingsSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: 'Réglages du salon invalides.' };
  const s = parsed.data;
  const mode = config.modes.modes.find((m) => m.id === s.modeId);
  if (!mode || mode.id === 'training') return { ok: false, error: 'Mode inconnu.' };
  if (!config.quiz.budgetChoicesSeconds.includes(s.budgetSeconds)) return { ok: false, error: 'Durée du quiz non proposée.' };
  if (!config.modes.combatChoicesSeconds.includes(s.combatSeconds)) return { ok: false, error: 'Durée du combat non proposée.' };
  if (!config.quiz.maxQuestionsChoices.includes(s.maxQuestions)) return { ok: false, error: 'Nombre de questions non proposé.' };
  const maxPlayers = mode.maxPlayers ?? s.maxPlayers;
  if (!mode.maxPlayers && !config.modes.players.choices.includes(maxPlayers)) return { ok: false, error: 'Nombre de joueurs non proposé.' };
  const { roundsChoices, livesChoices } = config.modes.custom;
  if (mode.editable && (!roundsChoices.includes(s.rounds) || !livesChoices.includes(s.lives))) return { ok: false, error: 'Manches ou vies non proposées.' };
  const arena = config.arenas.arenas.find((x) => x.id === s.arenaId);
  if (!arena || (!arena.selectable && arena.id !== mode.arena)) return { ok: false, error: 'Carte non proposée.' };
  if (arena.spawns.length < maxPlayers) return { ok: false, error: 'Carte trop petite pour ce nombre de joueurs.' };
  const settings: MatchSettings = mode.editable
    ? { ...s, maxPlayers, roundsToWin: Math.min(s.roundsToWin, s.rounds) }
    : { ...s, maxPlayers, rounds: mode.rounds, roundsToWin: mode.roundsToWin, lives: mode.lives, winCondition: mode.winCondition };
  // sans limite de temps, seules des vies limitées peuvent finir la manche
  if (settings.combatSeconds === 0 && settings.lives === 0) return { ok: false, error: 'Un combat sans limite de temps demande des vies limitées.' };
  return { ok: true, settings };
}

/** Le combat peut-il être sans limite de temps avec ces vies ? (0 vie = réapparitions illimitées : non) */
export function allowsUnlimitedCombat(lives: number): boolean {
  return lives > 0;
}

/** Durée « jamais » pour désactiver un combo sans toucher au code du quiz. */
const NEVER = Number.MAX_SAFE_INTEGER;

/** Configuration du match : la config de base, modifiée par les réglages du salon. */
export function effectiveConfig(config: GameConfig, s: MatchSettings): GameConfig {
  const { doubleOrNothing, negative } = config.quiz.combos;
  return {
    ...config,
    quiz: {
      ...config.quiz,
      budgetSeconds: s.budgetSeconds,
      maxQuestions: s.maxQuestions,
      combos: {
        doubleOrNothing: { ...doubleOrNothing, correctStreak: s.doubleOrNothing ? doubleOrNothing.correctStreak : NEVER },
        negative: { ...negative, wrongStreak: s.negativeCombo ? negative.wrongStreak : NEVER },
      },
    },
  };
}

/** Cartes que l'hôte peut choisir (écran 06), dans l'ordre de config/arenas.json. */
export function selectableArenas(config: GameConfig) {
  return config.arenas.arenas.filter((a) => a.selectable);
}

/** Libellé court des réglages : « Duel · Cubes · 2 joueurs · Quiz 1:00 · Combat 2:00 · 1 vie ». */
export function settingsSummary(config: GameConfig, s: MatchSettings): string[] {
  const mode = config.modes.modes.find((m) => m.id === s.modeId);
  const clock = (sec: number) => `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}`;
  const arena = config.arenas.arenas.find((a) => a.id === s.arenaId);
  const parts = [mode?.label ?? s.modeId, arena?.label ?? s.arenaId, `${s.maxPlayers} joueurs max`, `Quiz ${clock(s.budgetSeconds)}`];
  if (s.maxQuestions > 0) parts.push(`${s.maxQuestions} questions max`);
  parts.push(s.combatSeconds === 0 ? 'Combat sans limite' : `Combat ${clock(s.combatSeconds)}`);
  if (s.rounds > 1) parts.push(`${s.roundsToWin} manches gagnantes sur ${s.rounds}`);
  parts.push(s.lives === 0 ? 'Réapparition' : `${s.lives} vie${s.lives > 1 ? 's' : ''}`);
  if (mode?.editable) parts.push(s.winCondition === 'most_kills' ? 'Le plus de kills' : 'Dernier en vie');
  if (!s.doubleOrNothing) parts.push('Sans quitte ou double');
  if (!s.negativeCombo) parts.push('Sans combo négatif');
  return parts;
}
