import { describe, expect, it } from 'vitest';
import { computeAxes, type QuizSample } from '../src/core/match/matchStats';
import { loadConfig, rawConfig } from './helpers';
import { parseGameConfig } from '../src/core/config/gameConfig';

const cfg = loadConfig().stats;
const q = (difficulty: number, correct: boolean, answerMs = 10_000, allowedMs = 40_000, timedOut = false): QuizSample => ({ difficulty, correct, timedOut, answerMs, allowedMs });

describe('stats.json', () => {
  it('se charge et donne 6 axes', () => {
    expect(cfg.axes.map((a) => a.id)).toEqual(['knowledge', 'boldness', 'speed', 'accuracy', 'aggression', 'consistency']);
  });

  it('refuse un axe en double', () => {
    const raw = rawConfig();
    const stats = raw.stats as { axes: { id: string }[] };
    stats.axes[1]!.id = 'knowledge';
    const result = parseGameConfig(raw);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors.join('\n')).toContain('config/stats.json');
  });
});

describe('hexagone de comparaison', () => {
  it('Connaissance pondérée par la difficulté', () => {
    // bonne réponse en difficulté 4, erreur en difficulté 1 : 4 / 5 = 80
    const axes = computeAxes({ quiz: [q(4, true), q(1, false)], bestStreak: 1, combat: null }, cfg);
    expect(axes.knowledge).toBe(80);
  });

  it('Audace : difficulté moyenne ramenée entre les bornes', () => {
    expect(computeAxes({ quiz: [q(1, true)], bestStreak: 1, combat: null }, cfg).boldness).toBe(0);
    expect(computeAxes({ quiz: [q(5, true)], bestStreak: 1, combat: null }, cfg).boldness).toBe(100);
    expect(computeAxes({ quiz: [q(3, true), q(3, false)], bestStreak: 1, combat: null }, cfg).boldness).toBe(50);
  });

  it('Vitesse : plus rapide = plus haut, temps écoulé = timedOutSpeed', () => {
    const axes = computeAxes({ quiz: [q(2, true, 10_000, 40_000), q(2, false, 40_000, 40_000, true)], bestStreak: 1, combat: null }, cfg);
    // (0,75 + 0) / 2
    expect(axes.speed).toBe(38);
  });

  it('Précision et Agressivité viennent du combat, plafonnées à 100', () => {
    const axes = computeAxes({ quiz: [], bestStreak: 0, combat: { shots: 25, hits: 17, damage: 250, opponentHealth: 100 } }, cfg);
    expect(axes.accuracy).toBe(68);
    expect(axes.aggression).toBe(100);
  });

  it('Régularité : plus longue série rapportée au nombre de questions', () => {
    const quiz = [q(1, true), q(1, true), q(1, true), q(1, false), q(1, true)];
    expect(computeAxes({ quiz, bestStreak: 3, combat: null }, cfg).consistency).toBe(60);
  });

  it('rien à mesurer : null (affiché « — »)', () => {
    const axes = computeAxes({ quiz: [], bestStreak: 0, combat: null }, cfg);
    expect(Object.values(axes).every((v) => v === null)).toBe(true);
    expect(computeAxes({ quiz: [], bestStreak: 0, combat: { shots: 0, hits: 0, damage: 0, opponentHealth: 100 } }, cfg).accuracy).toBeNull();
  });
});
