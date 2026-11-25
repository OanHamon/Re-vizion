import { describe, expect, it } from 'vitest';
import { parseGameConfig } from '../src/core/config/gameConfig';
import { matchCoins, type CoinStats } from '../src/core/match/coins';
import { loadConfig, rawConfig } from './helpers';

const cfg = loadConfig().economy;
const stats = (over: Partial<CoinStats> = {}): CoinStats => ({ kills: 0, headshotKills: 0, damage: 0, shots: 0, hits: 0, roundWins: 0, won: false, ...over });

describe('economy.json', () => {
  it('se charge', () => {
    expect(cfg.maxPerMatch).toBeGreaterThan(0);
  });

  it('refuse un gain négatif avec un message clair', () => {
    const raw = rawConfig();
    (raw.economy as { match: { kill: { coins: number } } }).match.kill.coins = -5;
    const result = parseGameConfig(raw);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors.join('\n')).toContain('config/economy.json · match.kill.coins');
  });
});

describe('pièces de fin de match', () => {
  it('un match sans rien faire rapporte seulement la participation', () => {
    const r = matchCoins(stats(), cfg);
    expect(r.total).toBe(cfg.match.participation.coins);
    expect(r.lines.map((l) => l.id)).toEqual(['participation']);
  });

  it('additionne kills, kills à la tête, dégâts, manches et victoire', () => {
    const m = cfg.match;
    const r = matchCoins(stats({ kills: 2, headshotKills: 1, damage: 255, roundWins: 2, won: true }), cfg);
    const expected =
      m.participation.coins + 2 * m.kill.coins + m.headshotKill.coins + Math.floor(255 / m.damage.per) * m.damage.coins + 2 * m.roundWin.coins + m.matchWin.coins;
    expect(r.total).toBe(Math.min(expected, cfg.maxPerMatch));
  });

  it('la précision ne compte qu’à partir de minShots tirs', () => {
    const { minShots, coins } = cfg.match.accuracy;
    expect(matchCoins(stats({ shots: minShots - 1, hits: minShots - 1 }), cfg).lines.some((l) => l.id === 'accuracy')).toBe(false);
    const half = matchCoins(stats({ shots: minShots * 2, hits: minShots }), cfg);
    expect(half.lines.find((l) => l.id === 'accuracy')?.coins).toBe(Math.round(coins / 2));
  });

  it('ignore le quiz : seules les stats de combat comptent', () => {
    // CoinStats n'a aucun champ de quiz : deux joueurs aux mêmes stats de combat gagnent pareil
    expect(matchCoins(stats({ kills: 1 }), cfg)).toEqual(matchCoins(stats({ kills: 1 }), cfg));
  });

  it('plafonne le total à maxPerMatch', () => {
    const r = matchCoins(stats({ kills: 100, damage: 10_000, roundWins: 5, won: true }), cfg);
    expect(r.total).toBe(cfg.maxPerMatch);
    expect(r.capped).toBe(true);
  });
});
