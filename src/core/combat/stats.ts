// Cumul des effets des bonus et malus (config/bonuses.json) sur les statistiques de base
// du joueur (config/player.json) et des armes (config/weapons.json).
//
// Règle de cumul d'une statistique : ((set ?? base) + somme des add) × produit des mul.
// Un effet avec une durée ne compte que pendant ses N premières secondes de combat.
import type { Effect, PlayerConfig, StatName, Weapon } from '../config/schemas';

export interface Modifier {
  add: number;
  mul: number;
  set: number | null;
}

export interface EffectSource {
  effects: readonly Effect[];
  durationSeconds: number | null;
}

export type Modifiers = Map<StatName, Modifier>;

export function collectModifiers(sources: readonly EffectSource[], elapsedSeconds: number): Modifiers {
  const mods: Modifiers = new Map();
  for (const source of sources) {
    if (source.durationSeconds !== null && elapsedSeconds >= source.durationSeconds) continue;
    for (const { stat, op, value } of source.effects) {
      const m = mods.get(stat) ?? { add: 0, mul: 1, set: null };
      if (op === 'add') m.add += value;
      else if (op === 'mul') m.mul *= value;
      else m.set = value;
      mods.set(stat, m);
    }
  }
  return mods;
}

export function applyModifier(base: number, m: Modifier | undefined): number {
  if (!m) return base;
  return ((m.set ?? base) + m.add) * m.mul;
}

export interface PlayerStats {
  maxHealth: number;
  shield: number;
  walkSpeed: number;
  jumpVelocity: number;
  airAcceleration: number;
  extraJumps: number;
  dashCharges: number;
  /** Multiplicateur des dégâts reçus (0 = invulnérable). */
  damageTaken: number;
  headshotDamageTaken: number;
  healthRegen: number;
  lifesteal: number;
  laserSight: boolean;
  armorPiercing: boolean;
}

export function playerStats(player: PlayerConfig, mods: Modifiers): PlayerStats {
  const m = (stat: StatName, base: number) => applyModifier(base, mods.get(stat));
  const { movement } = player;
  return {
    maxHealth: Math.max(1, Math.round(m('maxHealth', player.maxHealth))),
    shield: Math.max(0, m('shield', 0)),
    walkSpeed: Math.max(0, m('moveSpeed', movement.walkSpeed)),
    // la hauteur d'un saut varie comme le carré de la vitesse de départ
    jumpVelocity: movement.jumpVelocity * Math.sqrt(Math.max(0, m('jumpHeight', 1))),
    airAcceleration: Math.max(0, m('airControl', movement.airAcceleration)),
    extraJumps: Math.max(0, Math.round(m('extraJumps', 0))),
    dashCharges: Math.max(0, Math.round(m('dashCharges', 0))),
    damageTaken: Math.max(0, m('damageTaken', 1)),
    headshotDamageTaken: Math.max(0, m('headshotDamageTaken', 1)),
    healthRegen: Math.max(0, m('healthRegen', 0)),
    lifesteal: Math.max(0, m('lifesteal', 0)),
    laserSight: m('laserSight', 0) >= 1,
    armorPiercing: m('armorPiercing', 0) >= 1,
  };
}

export interface WeaponStats {
  id: string;
  damagePerShot: number;
  pellets: number;
  fireRate: number;
  magazineSize: number;
  reloadSeconds: number;
  spreadDeg: number;
  kickDeg: number;
  rampDeg: number;
  maxRecoilDeg: number;
  recoverDegPerSec: number;
  headshotMultiplier: number;
  range: number;
  falloff: { startMeters: number; endMeters: number; minFactor: number } | null;
  zoom: number;
  splashRadius: number;
  automatic: boolean;
}

export function weaponStats(w: Weapon, mods: Modifiers): WeaponStats {
  const m = (stat: StatName, base: number) => applyModifier(base, mods.get(stat));
  const recoil = Math.max(0, m('recoil', 1));
  // damageFalloff < 1 = la perte de dégâts commence et finit plus loin
  const falloffScale = Math.max(0.05, m('damageFalloff', 1));
  return {
    id: w.id,
    damagePerShot: Math.max(0, m('damage', w.damagePerShot)),
    pellets: Math.max(1, Math.round(m('pellets', w.pellets))),
    fireRate: Math.max(0.1, m('fireRate', w.fireRate)),
    magazineSize: Math.max(1, Math.round(m('magazineSize', w.magazineSize))),
    reloadSeconds: Math.max(0.05, m('reloadTime', w.reloadSeconds)),
    spreadDeg: Math.max(0, m('spread', w.spreadDeg)),
    kickDeg: w.recoil.kickDeg * recoil,
    rampDeg: w.recoil.rampDeg * recoil,
    maxRecoilDeg: w.recoil.maxDeg * recoil,
    recoverDegPerSec: w.recoil.recoverDegPerSec,
    headshotMultiplier: Math.max(1, m('headshotMultiplier', w.headshotMultiplier)),
    range: w.range,
    falloff: w.falloff
      ? {
          startMeters: w.falloff.startMeters / falloffScale,
          endMeters: w.falloff.endMeters / falloffScale,
          minFactor: w.falloff.minFactor,
        }
      : null,
    zoom: Math.max(1, m('zoom', w.zoom)),
    splashRadius: w.splashRadius,
    automatic: w.automatic,
  };
}

/** Facteur de dégâts selon la distance (1 avant le début de la perte, minFactor après la fin). */
export function falloffFactor(stats: WeaponStats, distance: number): number {
  const f = stats.falloff;
  if (!f || distance <= f.startMeters) return 1;
  if (distance >= f.endMeters) return f.minFactor;
  const k = (distance - f.startMeters) / (f.endMeters - f.startMeters);
  return 1 + (f.minFactor - 1) * k;
}

export function shotDamage(stats: WeaponStats, distance: number, head: boolean): number {
  return stats.damagePerShot * falloffFactor(stats, distance) * (head ? stats.headshotMultiplier : 1);
}
