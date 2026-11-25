// Pièces gagnées en fin de match (config/economy.json).
// Seules les stats de combat comptent, jamais le quiz. Logique pure : calculée par le serveur.
import type { EconomyConfig } from '../config/schemas';

/** Stats de combat d'un joueur, cumulées sur tout le match. */
export interface CoinStats {
  kills: number;
  headshotKills: number;
  damage: number;
  shots: number;
  hits: number;
  roundWins: number;
  won: boolean;
}

export type CoinRuleId = keyof EconomyConfig['match'];

export interface CoinLine {
  id: CoinRuleId;
  label: string;
  coins: number;
}

export interface CoinReward {
  /** Lignes non nulles, dans l'ordre de config/economy.json. */
  lines: CoinLine[];
  /** Somme des lignes, plafonnée à maxPerMatch. */
  total: number;
  /** Vrai si le plafond a rogné le total. */
  capped: boolean;
}

export function matchCoins(s: CoinStats, cfg: EconomyConfig): CoinReward {
  const r = cfg.match;
  const accuracy = s.shots >= r.accuracy.minShots ? Math.min(1, s.hits / s.shots) : 0;
  const amounts: Record<CoinRuleId, number> = {
    participation: r.participation.coins,
    kill: s.kills * r.kill.coins,
    headshotKill: s.headshotKills * r.headshotKill.coins,
    damage: Math.floor(Math.max(0, s.damage) / r.damage.per) * r.damage.coins,
    roundWin: s.roundWins * r.roundWin.coins,
    matchWin: s.won ? r.matchWin.coins : 0,
    accuracy: accuracy * r.accuracy.coins,
  };
  const lines: CoinLine[] = [];
  for (const id of Object.keys(r) as CoinRuleId[]) {
    const coins = Math.round(amounts[id]);
    if (coins > 0) lines.push({ id, label: r[id].label, coins });
  }
  const sum = lines.reduce((a, l) => a + l.coins, 0);
  return { lines, total: Math.min(sum, cfg.maxPerMatch), capped: sum > cfg.maxPerMatch };
}
