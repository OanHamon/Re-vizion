import { describe, expect, it } from 'vitest';
import { parseGameConfig } from '../src/core/config/gameConfig';
import { cooledDown, planSound } from '../src/ui/soundPlan';
import { loadConfig, rawConfig } from './helpers';

const config = loadConfig();
const sounds = config.sounds.sounds;

describe('sounds.json', () => {
  it('se charge et couvre chaque moment du jeu', () => {
    const needed = [
      'ui.click', 'ui.back',
      'quiz.deal', 'quiz.doubleOrNothing', 'quiz.pick', 'quiz.correct', 'quiz.wrong', 'quiz.timeout', 'quiz.malus', 'quiz.tick', 'quiz.endTick',
      'match.countdown', 'match.go',
      'shot.default', 'combat.empty', 'combat.reload', 'combat.reloaded', 'combat.switch', 'combat.hit', 'combat.headshot', 'combat.kill', 'combat.hurt', 'combat.death',
      'results.victory', 'results.defeat',
    ];
    for (const id of needed) expect(sounds[id], id).toBeDefined();
  });

  it('chaque arme du jeu a son propre son de tir', () => {
    for (const w of config.weapons.weapons) expect(sounds[`shot.${w.id}`], w.id).toBeDefined();
  });

  it('refuse une onde sans fréquence', () => {
    const raw = rawConfig();
    const s = raw.sounds as { sounds: Record<string, { layers: { freq?: unknown }[] }> };
    delete s.sounds['ui.click']!.layers[0]!.freq;
    const result = parseGameConfig(raw);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors.join('\n')).toContain('sounds.ui.click.layers[0].freq');
  });

  it('exige un son de tir de repli', () => {
    const raw = rawConfig();
    delete (raw.sounds as { sounds: Record<string, unknown> }).sounds['shot.default'];
    expect(parseGameConfig(raw).ok).toBe(false);
  });
});

describe('plan d’un son', () => {
  const def = sounds['quiz.correct']!;

  it('multiplie les volumes : config, joueur, lecture, son, couche', () => {
    const plan = planSound(def, { master: 0.5, user: 0.5, volume: 0.5 });
    expect(plan).toHaveLength(def.layers.length);
    expect(plan[0]!.peak).toBeCloseTo(0.5 * 0.5 * 0.5 * def.volume * def.layers[0]!.gain);
  });

  it('volume du joueur à 0 : rien à jouer', () => {
    expect(planSound(def, { master: 1, user: 0 })).toEqual([]);
  });

  it('décale les couches et applique la variation de hauteur', () => {
    const shot = sounds['shot.pistol']!;
    const plan = planSound(shot, { master: 1, user: 1, delay: 0.3, jitter: 1 });
    expect(plan[0]!.start).toBeCloseTo(0.3 + shot.layers[0]!.delay);
    const sine = plan.find((l) => l.freq)!;
    const layer = shot.layers.find((l) => l.freq)!;
    expect(sine.freq![0]).toBeCloseTo(layer.freq![0] * (1 + shot.pitchJitter));
  });

  it('écart minimal entre deux lectures', () => {
    const hit = sounds['combat.hit']!;
    expect(cooledDown(hit, undefined, 0)).toBe(true);
    expect(cooledDown(hit, 1000, 1000 + hit.cooldownMs - 1)).toBe(false);
    expect(cooledDown(hit, 1000, 1000 + hit.cooldownMs)).toBe(true);
  });
});
