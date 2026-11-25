// Dégâts entre joueurs, calculés par le serveur à partir des statistiques des deux joueurs.
// Ordre : dégâts de l'arme (distance, tête) × défense de la victime, puis le bouclier absorbe
// en premier (sauf arme ou bonus perce-bouclier), puis les PV.
import type { GameConfig } from '../config/gameConfig';
import type { InventoryEntry } from '../quiz/inventory';
import { collectModifiers, playerStats, shotDamage, weaponStats, type PlayerStats, type WeaponStats } from './stats';

export interface Fighter {
  weaponIds: readonly string[];
  entries: readonly InventoryEntry[];
}

/** Statistiques d'un combattant à l'instant t (secondes depuis le début du combat). */
export function fighterStats(config: GameConfig, f: Fighter, elapsedSeconds: number): { player: PlayerStats; weapons: WeaponStats[] } {
  const mods = collectModifiers(f.entries, elapsedSeconds);
  const weapons = f.weaponIds.map((id) => {
    const w = config.weapons.weapons.find((x) => x.id === id);
    if (!w) throw new Error(`Arme inconnue : ${id}`);
    return weaponStats(w, mods);
  });
  return { player: playerStats(config.player, mods), weapons };
}

export interface HitInput {
  weapon: WeaponStats;
  /** L'arme traverse les boucliers (trait shield_piercing). */
  weaponPiercesShield: boolean;
  attacker: PlayerStats;
  victim: PlayerStats;
  distance: number;
  head: boolean;
  health: number;
  shield: number;
}

export interface HitOutcome {
  /** Dégâts infligés (bouclier + PV). */
  damage: number;
  health: number;
  shield: number;
  killed: boolean;
  /** PV rendus à l'attaquant (vampire). */
  heal: number;
}

export function resolveHit(h: HitInput): HitOutcome {
  const raw = shotDamage(h.weapon, h.distance, h.head) * (h.head ? h.victim.headshotDamageTaken : 1);
  return resolveDamage({ raw, piercesShield: h.weaponPiercesShield, attacker: h.attacker, victim: h.victim, health: h.health, shield: h.shield });
}

export interface DamageInput {
  /** Dégâts bruts (avant la défense de la victime). */
  raw: number;
  piercesShield: boolean;
  attacker: PlayerStats;
  victim: PlayerStats;
  health: number;
  shield: number;
}

/** Dégâts quelconques (balle, explosion) : défense de la victime, puis bouclier, puis PV. */
export function resolveDamage(h: DamageInput): HitOutcome {
  let remaining = h.raw * h.victim.damageTaken;
  let shield = h.shield;
  if (!h.piercesShield && !h.attacker.armorPiercing && shield > 0) {
    const absorbed = Math.min(shield, remaining);
    shield -= absorbed;
    remaining -= absorbed;
  }
  const dealtToHealth = Math.min(h.health, remaining);
  const health = h.health - dealtToHealth;
  return {
    damage: h.shield - shield + dealtToHealth,
    health,
    shield,
    killed: health <= 0,
    heal: dealtToHealth * h.attacker.lifesteal,
  };
}
