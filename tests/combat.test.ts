import { describe, expect, it } from 'vitest';
import { CombatSession, IDLE_INPUT, type CombatEvent, type CombatInput } from '../src/core/combat/combatSession';
import { rayAabb, raycastWorld, v3, worldFromArena, type World } from '../src/core/combat/geometry';
import { createMoveState, stepMovement, type MoveParams } from '../src/core/combat/movement';
import { applyModifier, collectModifiers, falloffFactor, playerStats, shotDamage, weaponStats } from '../src/core/combat/stats';
import { WeaponState } from '../src/core/combat/weaponState';
import { Inventory } from '../src/core/quiz/inventory';
import { loadConfig } from './helpers';

const config = loadConfig();
const arena = config.arenas.arenas.find((a) => a.id === 'training')!;
const world = worldFromArena(arena);
const weapon = (id: string) => config.weapons.weapons.find((w) => w.id === id)!;

/** Entrées d'inventaire à partir d'ids de bonus/malus. */
function entries(...ids: string[]) {
  const inv = new Inventory();
  for (const id of ids) {
    const bonus = config.bonuses.bonuses.find((b) => b.id === id);
    if (bonus) inv.addBonus(bonus, 1);
    else inv.addMalus(config.bonuses.maluses.find((m) => m.id === id)!, 1);
  }
  return inv.all();
}

const NO_MODS = collectModifiers([], 0);

// ---------- statistiques ----------

describe('cumul des effets', () => {
  it('applique set, puis add, puis mul ; ignore les effets expirés', () => {
    const mods = collectModifiers(
      [
        { durationSeconds: null, effects: [{ stat: 'damage', op: 'mul', value: 1.5 }, { stat: 'shield', op: 'add', value: 10 }] },
        { durationSeconds: null, effects: [{ stat: 'damage', op: 'mul', value: 2 }, { stat: 'shield', op: 'add', value: 5 }] },
        { durationSeconds: 8, effects: [{ stat: 'damageTaken', op: 'mul', value: 0 }] },
      ],
      3,
    );
    expect(applyModifier(10, mods.get('damage'))).toBe(30);
    expect(applyModifier(0, mods.get('shield'))).toBe(15);
    expect(applyModifier(1, mods.get('damageTaken'))).toBe(0);
    expect(collectModifiers([{ durationSeconds: 8, effects: [{ stat: 'damageTaken', op: 'mul', value: 0 }] }], 8).has('damageTaken')).toBe(false);
  });

  it('statistiques du joueur : bouclier, PV, saut, sauts en plus, laser', () => {
    const s = playerStats(config.player, collectModifiers(entries('def_shield_r', 'def_health_e', 'mob_jump_r', 'mob_double_jump_e', 'atk_laser_r'), 0));
    expect(s.shield).toBe(30);
    expect(s.maxHealth).toBe(125);
    expect(s.jumpVelocity).toBeCloseTo(config.player.movement.jumpVelocity * Math.sqrt(1.3));
    expect(s.extraJumps).toBe(1);
    expect(s.laserSight).toBe(true);
  });

  it('« Pieds collés » empêche de sauter pendant sa durée seulement', () => {
    const src = entries('mal_mob_jump_h');
    expect(playerStats(config.player, collectModifiers(src, 5)).jumpVelocity).toBe(0);
    expect(playerStats(config.player, collectModifiers(src, 31)).jumpVelocity).toBe(config.player.movement.jumpVelocity);
  });

  it('statistiques d’arme : chargeur, munitions divisées, portée du fusil à pompe', () => {
    expect(weaponStats(weapon('pistol'), collectModifiers(entries('atk_magazine_r'), 0)).magazineSize).toBe(18);
    expect(weaponStats(weapon('pistol'), collectModifiers(entries('mal_atk_ammo_h'), 0)).magazineSize).toBe(6);
    const far = weaponStats(weapon('shotgun'), collectModifiers(entries('wpn_shotgun_c'), 0));
    expect(far.falloff!.startMeters).toBeCloseTo(5 / 0.8);
    expect(far.falloff!.endMeters).toBeCloseTo(18 / 0.8);
  });

  it('dégâts : perte avec la distance (fusil à pompe) et tir à la tête (sniper × 2)', () => {
    const shotgun = weaponStats(weapon('shotgun'), NO_MODS);
    expect(falloffFactor(shotgun, 3)).toBe(1);
    expect(falloffFactor(shotgun, 30)).toBe(0.2);
    expect(falloffFactor(shotgun, 11.5)).toBeCloseTo(0.6);
    const sniper = weaponStats(weapon('sniper'), NO_MODS);
    expect(shotDamage(sniper, 50, false)).toBe(80);
    expect(shotDamage(sniper, 50, true)).toBe(160);
  });
});

// ---------- géométrie ----------

describe('lancer de rayon', () => {
  const box = { min: v3(-1, 0, -6), max: v3(1, 2, -4) };

  it('touche la face d’entrée avec la bonne distance et la bonne normale', () => {
    const hit = rayAabb(v3(0, 1, 0), v3(0, 0, -1), box, 100);
    expect(hit?.t).toBeCloseTo(4);
    expect(hit?.normal).toEqual(v3(0, 0, 1));
  });

  it('rate une boîte à côté, ou au-delà de la portée, ou en partant de l’intérieur', () => {
    expect(rayAabb(v3(5, 1, 0), v3(0, 0, -1), box, 100)).toBeNull();
    expect(rayAabb(v3(0, 1, 0), v3(0, 0, -1), box, 3)).toBeNull();
    expect(rayAabb(v3(0, 1, -5), v3(0, 0, -1), box, 100)).toBeNull();
  });

  it('touche le sol et les murs de l’arène', () => {
    expect(raycastWorld(world, v3(0, 1, 15), v3(0, -1, 0), 10)).toMatchObject({ t: 1, surface: 'floor' });
    expect(raycastWorld(world, v3(0, 1, 15), v3(0, 0, 1), 100)).toMatchObject({ t: 5, surface: 'wall' });
  });
});

// ---------- déplacement ----------

const baseParams: MoveParams = {
  walkSpeed: config.player.movement.walkSpeed,
  groundAcceleration: config.player.movement.groundAcceleration,
  airAcceleration: config.player.movement.airAcceleration,
  jumpVelocity: config.player.movement.jumpVelocity,
  gravity: config.player.movement.gravity,
  extraJumps: 0,
  maxDashCharges: 0,
  dashSpeed: config.player.movement.dashSpeed,
  dashSeconds: config.player.movement.dashSeconds,
  dashCooldownSeconds: config.player.movement.dashCooldownSeconds,
  height: config.player.body.height,
  radius: config.player.body.radius,
  stepHeight: config.player.movement.stepHeight,
};

function simulate(start: [number, number, number], input: { forward?: number; jumpAt?: number[]; dashAt?: number[] }, seconds: number, params = baseParams) {
  const s = createMoveState(v3(...start), params.maxDashCharges);
  const events: string[] = [];
  const dt = 1 / 120;
  for (let i = 0; i * dt < seconds; i++) {
    const t = i * dt;
    const at = (list?: number[]) => (list ?? []).some((x) => Math.abs(x - t) < dt / 2);
    for (const e of stepMovement(s, { forward: input.forward ?? 0, right: 0, jump: at(input.jumpAt), dash: at(input.dashAt), yaw: 0 }, params, world, dt)) events.push(e.type);
  }
  return { s, events };
}

describe('déplacement', () => {
  const r = config.player.body.radius;

  it('tombe et se pose sur le sol', () => {
    const { s, events } = simulate([0, 2, 14], {}, 1);
    expect(s.pos.y).toBe(0);
    expect(s.onGround).toBe(true);
    expect(events).toContain('land');
  });

  it('est arrêté par un bloc (pas de traversée)', () => {
    // muret de 1 m : x −5.5..−2.5, z 7.5..8.5
    const { s } = simulate([-4, 0, 11], { forward: 1 }, 1);
    expect(s.pos.z).toBeCloseTo(8.5 + r, 2);
  });

  it('monte sur une plateforme de 1 m en sautant, pas sans sauter', () => {
    // plateforme : x −11.5..−6.5, z −1.5..3.5, haute de 1 m
    const walk = simulate([-10.5, 0, 5.5], { forward: 1 }, 1);
    expect(walk.s.pos.z).toBeCloseTo(3.5 + r, 2);
    const jump = simulate([-10.5, 0, 5.5], { forward: 1, jumpAt: [0] }, 0.8);
    expect(jump.s.pos.y).toBeCloseTo(1, 5);
    expect(jump.s.onGround).toBe(true);
  });

  it('monte une petite marche en marchant, mais pas une marche trop haute ni sous un plafond', () => {
    const step = config.player.movement.stepHeight;
    const marche = (h: number, ceiling = false): World => ({
      ...world,
      blocks: [
        { min: v3(-2, 0, -12), max: v3(2, h, 0) },
        ...(ceiling ? [{ min: v3(-2, h + 1, -12), max: v3(2, h + 2, 0) }] : []),
      ],
    });
    const walkOn = (w: World) => {
      const st = createMoveState(v3(0, 0, 2), 0);
      for (let i = 0; i < 120; i++) stepMovement(st, { forward: 1, right: 0, jump: false, dash: false, yaw: 0 }, baseParams, w, 1 / 120);
      return st;
    };
    const low = walkOn(marche(step - 0.05));
    expect(low.pos.y).toBeCloseTo(step - 0.05, 5);
    expect(low.pos.z).toBeLessThan(-1);
    const high = walkOn(marche(step + 0.1));
    expect(high.pos.y).toBe(0);
    expect(high.pos.z).toBeCloseTo(r, 2);
    // plafond trop bas au-dessus de la marche : on reste en bas
    expect(walkOn(marche(0.3, true)).pos.y).toBe(0);
  });

  it('saut en plus en l’air seulement avec le bonus', () => {
    expect(simulate([0, 0, 14], { jumpAt: [0, 0.2] }, 0.5).events.filter((e) => e === 'jump')).toHaveLength(1);
    const withBonus = simulate([0, 0, 14], { jumpAt: [0, 0.2] }, 0.5, { ...baseParams, extraJumps: 1 });
    expect(withBonus.events.filter((e) => e === 'jump')).toHaveLength(2);
  });

  it('reste dans l’arène', () => {
    const { s } = simulate([0, 0, -15], { forward: 1 }, 2);
    expect(s.pos.z).toBeCloseTo(-arena.size[1] / 2 + r, 5);
  });

  it('le dash va plus vite et consomme une charge', () => {
    const params = { ...baseParams, maxDashCharges: 1 };
    const dash = simulate([0, 0, 14], { forward: 1, dashAt: [0] }, 0.18, params);
    const walk = simulate([0, 0, 14], { forward: 1 }, 0.18, params);
    expect(dash.events).toContain('dash');
    expect(14 - dash.s.pos.z).toBeGreaterThan((14 - walk.s.pos.z) * 2);
    expect(dash.s.dashCharges).toBe(0);
  });
});

// ---------- arme ----------

describe('état de l’arme', () => {
  it('respecte la cadence de tir', () => {
    const w = new WeaponState(weaponStats(weapon('pistol'), NO_MODS)); // 4 tirs/s
    expect(w.fire(0)).toBe('fired');
    expect(w.fire(0.1)).toBe('busy');
    expect(w.fire(0.25)).toBe('fired');
  });

  it('chargeur vide puis rechargement complet après le temps prévu', () => {
    const stats = weaponStats(weapon('sniper'), NO_MODS); // 5 balles, 2.4 s
    const w = new WeaponState(stats);
    for (let i = 0; i < 5; i++) expect(w.fire(i * 2)).toBe('fired');
    expect(w.fire(20)).toBe('empty');
    expect(w.reload(20)).toBe(true);
    expect(w.update(21, 1)).toBe(false);
    expect(w.update(22.4, 1.4)).toBe(true);
    expect(w.ammo).toBe(5);
  });

  it('fusil d’assaut : le recul monte de plus en plus en rafale, puis redescend', () => {
    const stats = weaponStats(weapon('assault_rifle'), NO_MODS);
    const w = new WeaponState(stats);
    const gaps: number[] = [];
    let prev = 0;
    for (let i = 0; i < 6; i++) {
      w.update(i / 8, 1 / 8);
      w.fire(i / 8);
      gaps.push(w.recoilDeg - prev);
      prev = w.recoilDeg;
    }
    expect(gaps[5]!).toBeGreaterThan(gaps[1]!);
    for (let t = 1; t < 3; t += 0.05) w.update(t, 0.05);
    expect(w.recoilDeg).toBe(0);
  });
});

// ---------- session ----------

const frame = 1 / 60;
const BODY_PITCH = Math.atan2(1.0 - 1.6, 11); // centre du torse de la cible n°0, à 11 m devant l'apparition
const HEAD_PITCH = Math.atan2(1.64 - 1.6, 11);

function newCombat(weaponId = 'pistol', ids: string[] = []) {
  return new CombatSession({ config, modeId: 'training', weaponId, entries: entries(...ids), seed: 3 });
}

function hold(s: CombatSession, input: Partial<CombatInput>, seconds: number): CombatEvent[] {
  const events: CombatEvent[] = [];
  for (let t = 0; t < seconds - 1e-9; t += frame) events.push(...s.step({ ...IDLE_INPUT, ...input }, frame));
  return events;
}

/** Un tir (appui puis relâché), suivi d'une pause qui laisse le recul retomber. */
function shoot(s: CombatSession, pitch: number, pause = 1): CombatEvent[] {
  return [...hold(s, { fire: true, pitch }, frame), ...hold(s, { pitch }, pause)];
}

describe('session de combat', () => {
  it('le pistolet tue la cible d’en face en 5 tirs au corps, puis elle réapparaît', () => {
    const s = newCombat();
    const events: CombatEvent[] = [];
    for (let i = 0; i < 4; i++) events.push(...shoot(s, BODY_PITCH));
    expect(events.filter((e) => e.type === 'hit')).toHaveLength(4);
    expect(events.some((e) => e.type === 'kill')).toBe(false);
    const fifth = shoot(s, BODY_PITCH, 0.5);
    expect(fifth.some((e) => e.type === 'kill' && e.targetId === 0)).toBe(true);
    expect(s.targets[0]!.alive).toBe(false);
    expect(hold(s, {}, 3).some((e) => e.type === 'respawn' && e.targetId === 0)).toBe(true);
    expect(s.score.kills).toBe(1);
  });

  it('sniper : un tir à la tête tue', () => {
    const s = newCombat('sniper');
    const events = shoot(s, HEAD_PITCH);
    expect(events.find((e) => e.type === 'hit')).toMatchObject({ head: true, damage: 160 });
    expect(events.some((e) => e.type === 'kill' && e.head)).toBe(true);
    expect(s.score.headshotKills).toBe(1);
  });

  it('le bonus « Dégâts +50 % » fait tuer en 4 tirs au lieu de 5', () => {
    const s = newCombat('pistol', ['atk_damage_l']);
    const events: CombatEvent[] = [];
    for (let i = 0; i < 4; i++) events.push(...shoot(s, BODY_PITCH));
    expect(events.some((e) => e.type === 'kill')).toBe(true);
  });

  it('arme automatique : tire tant que le bouton est enfoncé ; semi-automatique : un tir par appui', () => {
    const rifle = newCombat('assault_rifle');
    hold(rifle, { fire: true, pitch: 0.5 }, 1);
    expect(rifle.score.shots).toBeGreaterThanOrEqual(7);
    expect(rifle.score.shots).toBeLessThanOrEqual(9);
    const pistol = newCombat('pistol');
    hold(pistol, { fire: true, pitch: 0.5 }, 1);
    expect(pistol.score.shots).toBe(1);
  });

  it('chargeur vide : un tir de plus lance le rechargement', () => {
    const s = newCombat('sniper');
    for (let i = 0; i < 5; i++) shoot(s, 0.5, 1.1);
    expect(s.weapon.state.ammo).toBe(0);
    const events = shoot(s, 0.5, 0.1);
    expect(events.map((e) => e.type)).toEqual(expect.arrayContaining(['empty', 'reload']));
    hold(s, {}, 2.5);
    expect(s.weapon.state.ammo).toBe(5);
  });

  it('fusil à pompe : un tir = 8 plombs', () => {
    const s = newCombat('shotgun');
    const shot = shoot(s, BODY_PITCH).find((e) => e.type === 'shot');
    expect(shot && shot.type === 'shot' && shot.rays).toHaveLength(8);
  });

  it('bonus défensifs appliqués au départ, arme spéciale dans un 2e emplacement', () => {
    const s = newCombat('pistol', ['def_shield_r', 'def_health_e', 'wpn_beam_l']);
    expect(s.shield).toBe(30);
    expect(s.health).toBe(125);
    expect(s.slots.map((x) => x.weaponId)).toEqual(['pistol', 'beam']);
    expect(hold(s, { slot: 1 }, frame).some((e) => e.type === 'switch')).toBe(true);
    expect(s.weapon.weaponId).toBe('beam');
  });

  it('précision : 1 tir sur 2 touche → 50 %', () => {
    const s = newCombat();
    shoot(s, BODY_PITCH);
    shoot(s, 0.6);
    expect(s.summary()).toMatchObject({ shots: 2, hits: 1, accuracy: 0.5 });
  });

  it('le combat s’arrête à la fin du chrono du mode', () => {
    const s = newCombat();
    const events = hold(s, {}, s.duration + 0.5);
    expect(events.filter((e) => e.type === 'end')).toHaveLength(1);
    expect(s.finished).toBe(true);
    expect(s.step(IDLE_INPUT, frame)).toEqual([]);
    expect(s.summary().seconds).toBe(s.duration);
  });
});
