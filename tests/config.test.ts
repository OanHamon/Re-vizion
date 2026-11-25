import { describe, expect, it } from 'vitest';
import { parseGameConfig } from '../src/core/config/gameConfig';
import { loadConfig, rawConfig } from './helpers';

type Json = Record<string, any>;

function errorsOf(mutate: (raw: Json) => void): string[] {
  const raw = rawConfig() as Json;
  mutate(raw);
  const result = parseGameConfig(raw as never);
  return result.ok ? [] : result.errors;
}

describe('fichiers config/*.json', () => {
  it('les fichiers du dépôt sont valides', () => {
    const result = parseGameConfig(rawConfig());
    expect(result.ok ? [] : result.errors).toEqual([]);
  });

  it('reprennent les valeurs du brief (coûts, raretés), avec 1:00 par défaut et 5:00 proposé', () => {
    const { quiz } = loadConfig();
    expect(quiz.budgetSeconds).toBe(60);
    expect(quiz.budgetChoicesSeconds).toContain(300);
    expect(quiz.cardsPerTurn).toBe(3);
    const byId = Object.fromEntries(quiz.rarities.map((r) => [r.id, r]));
    expect(byId.common).toMatchObject({ difficulties: [1, 2], costSeconds: 30 });
    expect(byId.rare).toMatchObject({ difficulties: [3], costSeconds: 45 });
    expect(byId.epic).toMatchObject({ difficulties: [4], costSeconds: 60 });
    expect(byId.legendary).toMatchObject({ difficulties: [5], costSeconds: 75 });
    expect(quiz.draw.normalWeights.legendary ?? 0).toBe(0);
    expect(quiz.combos.doubleOrNothing.correctStreak).toBe(3);
    expect(quiz.combos.negative.wrongStreak).toBe(3);
  });

  it('reprennent les armes du brief, toutes autour de 80 dégâts par seconde', () => {
    const { weapons } = loadConfig();
    for (const w of weapons.weapons) {
      const dps = w.damagePerShot * w.pellets * w.fireRate;
      expect(dps, w.id).toBeGreaterThanOrEqual(75);
      expect(dps, w.id).toBeLessThanOrEqual(85);
    }
    const sniper = weapons.weapons.find((w) => w.id === 'sniper');
    expect(sniper).toMatchObject({ damagePerShot: 80, headshotMultiplier: 2, magazineSize: 5 });
  });

  it('au moins 3 bonus par famille et par rareté (Arme : pour chaque arme du loadout)', () => {
    const { bonuses, quiz, player } = loadConfig();
    for (const family of bonuses.families) {
      for (const rarity of quiz.rarities) {
        const weaponsToCheck = family.id === 'weapon' ? player.loadout : [player.defaultWeapon];
        for (const weapon of weaponsToCheck) {
          const count = bonuses.bonuses.filter(
            (b) =>
              b.family === family.id &&
              b.rarity === rarity.id &&
              (b.weapons.length === 0 || b.weapons.includes(weapon)),
          ).length;
          expect(count, `${family.id} / ${rarity.id} / ${weapon}`).toBeGreaterThanOrEqual(3);
        }
      }
    }
  });

  it('chaque famille a au moins un malus de chaque gravité', () => {
    const { bonuses } = loadConfig();
    for (const family of bonuses.families) {
      for (const severity of ['heavy', 'light']) {
        expect(bonuses.maluses.some((m) => m.family === family.id && m.severity === severity), `${family.id}/${severity}`).toBe(true);
      }
    }
  });

  it('refuse un champ de mauvais type, avec le fichier et le chemin', () => {
    const errors = errorsOf((raw) => {
      raw.quiz.rarities[1].costSeconds = 'quarante-cinq';
    });
    expect(errors).toHaveLength(1);
    expect(errors[0]).toContain('config/quiz.json');
    expect(errors[0]).toContain('rarities[1].costSeconds');
  });

  it('refuse une durée par défaut absente des choix, ou trop courte pour une Commune', () => {
    const errors = errorsOf((raw) => {
      raw.quiz.budgetSeconds = 120;
      raw.quiz.budgetChoicesSeconds = [20, 60, 300];
    });
    expect(errors.some((e) => e.includes('budgetSeconds') && e.includes('budgetChoicesSeconds'))).toBe(true);
    expect(errors.some((e) => e.includes('budgetChoicesSeconds[0]'))).toBe(true);
  });

  it('refuse une clé inconnue (faute de frappe)', () => {
    const errors = errorsOf((raw) => {
      raw.quiz.budgetSecond = 200;
    });
    expect(errors.join('\n')).toContain('budgetSecond');
  });

  it('refuse un bonus qui cite une rareté ou une famille inconnue', () => {
    const errors = errorsOf((raw) => {
      raw.bonuses.bonuses[0].rarity = 'mythique';
      raw.bonuses.bonuses[1].family = 'magie';
    });
    expect(errors.some((e) => e.includes('rareté inconnue « mythique »'))).toBe(true);
    expect(errors.some((e) => e.includes('famille inconnue « magie »'))).toBe(true);
  });

  it('refuse une arme sans asset dans le catalogue', () => {
    const errors = errorsOf((raw) => {
      delete raw.assets.assets['weapon.sniper'];
    });
    expect(errors.some((e) => e.includes('config/weapons.json') && e.includes('weapon.sniper'))).toBe(true);
  });

  it('refuse une arme spéciale dans le loadout', () => {
    const errors = errorsOf((raw) => {
      raw.player.loadout.push('beam');
    });
    expect(errors.some((e) => e.includes('arme spéciale'))).toBe(true);
  });

  it('refuse un tableau de poids où aucune rareté ne peut sortir', () => {
    const errors = errorsOf((raw) => {
      raw.quiz.draw.normalWeights = { common: 0, rare: 0, epic: 0, legendary: 0 };
    });
    expect(errors.some((e) => e.includes('draw.normalWeights'))).toBe(true);
  });

  it('refuse un asset qui a à la fois glb et primitive', () => {
    const errors = errorsOf((raw) => {
      raw.assets.assets['weapon.pistol'].glb = 'pistol.glb';
    });
    expect(errors.some((e) => e.includes('config/assets.json'))).toBe(true);
  });
});
