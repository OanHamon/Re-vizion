// Session de combat (lot 4 : entraînement sur cibles).
// Pur TypeScript, piloté par des entrées et un pas de temps : rejouable côté serveur.
// Le temps est découpé en petits pas fixes pour des collisions et une cadence de tir stables.
import type { GameConfig } from '../config/gameConfig';
import type { Arena, Mode } from '../config/schemas';
import type { InventoryEntry } from '../quiz/inventory';
import { createRng, type Rng } from '../random';
import { addScaled, length, lookDirection, rayAabb, raycastWorld, sub, v3, worldFromArena, type Aabb, type Surface, type Vec3, type World } from './geometry';
import { Destructibles } from './destruction';
import { createMoveState, stepMovement, type MoveEvent, type MoveParams, type MoveState } from './movement';
import { collectModifiers, playerStats, shotDamage, weaponStats, type EffectSource, type PlayerStats, type WeaponStats } from './stats';
import { WeaponState } from './weaponState';

export interface CombatInput {
  forward: number;
  right: number;
  jump: boolean;
  dash: boolean;
  fire: boolean;
  reload: boolean;
  aim: boolean;
  /** Emplacement d'arme demandé (0 = arme du loadout, 1 = arme spéciale), ou null. */
  slot: number | null;
  yaw: number;
  pitch: number;
}

export const IDLE_INPUT: CombatInput = {
  forward: 0,
  right: 0,
  jump: false,
  dash: false,
  fire: false,
  reload: false,
  aim: false,
  slot: null,
  yaw: 0,
  pitch: 0,
};

export interface CombatOptions {
  config: GameConfig;
  modeId: string;
  weaponId: string;
  /** Bonus et malus gagnés pendant le quiz. */
  entries: readonly InventoryEntry[];
  seed: number;
  /** Carte choisie par l'hôte (sinon celle du mode). */
  arenaId?: string;
  /** Point d'apparition (index dans arena.spawns). */
  spawnIndex?: number;
  /** Adversaires distants (ids des joueurs) : touchables, mais leurs PV sont gérés par le serveur. */
  opponents?: readonly string[];
  /** Combat en réseau : pas de fin de chrono locale, le serveur décide. */
  networked?: boolean;
}

export interface Target {
  id: number;
  /** Joueur adverse (null = cible d'entraînement). */
  playerId: string | null;
  base: Vec3;
  position: Vec3;
  yaw: number;
  moving: Arena['targets'][number]['moving'];
  health: number;
  alive: boolean;
  respawnAt: number;
  lastHitAt: number;
}

export interface WeaponSlot {
  weaponId: string;
  label: string;
  assetId: string;
  state: WeaponState;
}

export interface ShotRay {
  from: Vec3;
  to: Vec3;
}

export type CombatEvent =
  | { type: 'shot'; slot: number; rays: ShotRay[] }
  | { type: 'impact'; point: Vec3; normal: Vec3; surface: Surface | 'target' }
  | { type: 'hit'; targetId: number; playerId: string | null; head: boolean; damage: number; distance: number; point: Vec3 }
  | { type: 'kill'; targetId: number; head: boolean }
  | { type: 'respawn'; targetId: number }
  | { type: 'empty' }
  | { type: 'reload'; slot: number }
  | { type: 'reloaded'; slot: number }
  | { type: 'switch'; slot: number }
  | { type: 'end' }
  | MoveEvent;

export interface CombatSummary {
  kills: number;
  headshotKills: number;
  shots: number;
  hits: number;
  damage: number;
  /** Part des tirs qui ont touché une cible (0 à 1). */
  accuracy: number;
  seconds: number;
}

const SUBSTEP = 1 / 120;
const MAX_FRAME = 0.1;
const MAX_PITCH = (89 * Math.PI) / 180;
const DEG = Math.PI / 180;
/** Largeur de la tête par rapport au corps. */
const HEAD_WIDTH_SHARE = 0.6;

interface Hit {
  t: number;
  normal: Vec3;
  surface: Surface | 'target';
  target: Target | null;
  head: boolean;
}

export class CombatSession {
  readonly config: GameConfig;
  readonly mode: Mode;
  readonly arena: Arena;
  readonly world: World;
  /** Éléments cassables du décor (morceaux retirés sur ordre du serveur). */
  readonly breakables: Destructibles;
  readonly duration: number;
  readonly slots: WeaponSlot[];
  readonly targets: Target[];
  readonly move: MoveState;
  readonly score = { kills: 0, headshotKills: 0, shots: 0, hits: 0, damage: 0 };

  time = 0;
  activeSlot = 0;
  health: number;
  shield: number;
  finished = false;
  /** Joueur local en vie (en duel, le serveur annonce la mort et la réapparition). */
  alive = true;
  yaw: number;
  pitch = 0;
  aiming = false;
  stats: PlayerStats;

  private readonly sources: readonly EffectSource[];
  private readonly rng: Rng;
  private prev = { fire: false, jump: false, dash: false, reload: false };

  constructor(o: CombatOptions) {
    const { config } = o;
    this.config = config;
    const mode = config.modes.modes.find((m) => m.id === o.modeId);
    if (!mode) throw new Error(`Mode inconnu : ${o.modeId}`);
    const arenaId = o.arenaId ?? mode.arena;
    const arena = config.arenas.arenas.find((a) => a.id === arenaId);
    if (!arena) throw new Error(`Arène inconnue : ${arenaId}`);
    this.mode = mode;
    this.arena = arena;
    this.world = worldFromArena(arena);
    this.breakables = new Destructibles(this.world, arena, config.materials);
    this.duration = o.networked ? Infinity : mode.combatMaxSeconds;
    this.sources = o.entries;
    this.rng = createRng(o.seed);

    const mods = collectModifiers(this.sources, 0);
    this.stats = playerStats(config.player, mods);
    this.health = this.stats.maxHealth;
    this.shield = this.stats.shield;

    // emplacement 0 : arme du loadout ; puis les armes spéciales gagnées
    const weaponIds = [o.weaponId, ...new Set(o.entries.flatMap((e) => (e.grantsWeapon ? [e.grantsWeapon] : [])))];
    this.slots = weaponIds.map((id) => {
      const weapon = config.weapons.weapons.find((w) => w.id === id);
      if (!weapon) throw new Error(`Arme inconnue : ${id}`);
      return { weaponId: id, label: weapon.label, assetId: weapon.asset, state: new WeaponState(weaponStats(weapon, mods)) };
    });

    this.targets = arena.targets.map((t, id) => {
      const base = v3(...t.position);
      const target: Target = { id, playerId: null, base, position: { ...base }, yaw: t.yawDeg * DEG, moving: t.moving, health: arena.targetHealth, alive: true, respawnAt: 0, lastHitAt: -Infinity };
      return target;
    });
    for (const playerId of o.opponents ?? []) {
      // invisible tant que sa première position n'est pas connue
      this.targets.push({ id: this.targets.length, playerId, base: v3(), position: v3(), yaw: 0, moving: null, health: 1, alive: false, respawnAt: Infinity, lastHitAt: -Infinity });
    }

    const spawn = arena.spawns[(o.spawnIndex ?? 0) % arena.spawns.length]!;
    this.move = createMoveState(v3(...spawn.position), this.stats.dashCharges);
    this.yaw = spawn.yawDeg * DEG;
  }

  // ---------- duel : état donné par le serveur ----------

  /** Position et état d'un adversaire distant. */
  setOpponent(playerId: string, state: { position: Vec3; yaw: number; alive: boolean }): void {
    const t = this.targets.find((x) => x.playerId === playerId);
    if (!t) return;
    t.position = { ...state.position };
    t.yaw = state.yaw;
    t.alive = state.alive;
  }

  opponentTarget(playerId: string): Target | undefined {
    return this.targets.find((x) => x.playerId === playerId);
  }

  /** PV et bouclier du joueur local, décidés par le serveur. */
  setVitals(health: number, shield: number): void {
    this.health = health;
    this.shield = shield;
  }

  die(): void {
    this.alive = false;
    this.move.vel = v3();
  }

  /** Réapparition : position, chargeurs pleins, PV et bouclier de départ. */
  respawn(spawnIndex: number, health: number, shield: number): void {
    const spawn = this.arena.spawns[spawnIndex % this.arena.spawns.length]!;
    Object.assign(this.move, createMoveState(v3(...spawn.position), this.stats.dashCharges));
    this.yaw = spawn.yawDeg * DEG;
    this.pitch = 0;
    for (const slot of this.slots) {
      slot.state.cancelReload();
      slot.state.ammo = slot.state.stats.magazineSize;
      slot.state.recoilDeg = 0;
    }
    this.alive = true;
    this.setVitals(health, shield);
  }

  // ---------- lecture ----------

  get weapon(): WeaponSlot {
    return this.slots[this.activeSlot]!;
  }

  get timeLeft(): number {
    return Math.max(0, this.duration - this.time);
  }

  get eye(): Vec3 {
    return v3(this.move.pos.x, this.move.pos.y + this.config.player.body.eyeHeight, this.move.pos.z);
  }

  /** Angle vertical réel du regard : celui de la souris + le recul de l'arme. */
  get viewPitch(): number {
    return Math.max(-MAX_PITCH, Math.min(MAX_PITCH, this.pitch + this.weapon.state.recoilDeg * DEG));
  }

  /** Grossissement actuel (visée). */
  get zoom(): number {
    return this.aiming ? this.weapon.state.stats.zoom : 1;
  }

  targetBoxes(t: Target): { body: Aabb; head: Aabb } {
    const { radius, height, headHeight } = this.config.player.body;
    const neck = t.position.y + height - headHeight;
    const hr = radius * HEAD_WIDTH_SHARE;
    return {
      body: { min: v3(t.position.x - radius, t.position.y, t.position.z - radius), max: v3(t.position.x + radius, neck, t.position.z + radius) },
      head: { min: v3(t.position.x - hr, neck, t.position.z - hr), max: v3(t.position.x + hr, t.position.y + height, t.position.z + hr) },
    };
  }

  /** Le point est-il visible depuis les yeux (aucun bloc ni mur entre les deux) ? */
  canSee(point: Vec3): boolean {
    const eye = this.eye;
    const delta = sub(point, eye);
    const distance = length(delta);
    if (distance < 1e-6) return true;
    const dir = { x: delta.x / distance, y: delta.y / distance, z: delta.z / distance };
    return raycastWorld(this.world, eye, dir, distance) === null;
  }

  /** Point visé (premier obstacle ou cible dans l'axe du regard, sinon à portée max) : sert au viseur laser. */
  aimPoint(): Vec3 {
    const dir = lookDirection(this.yaw, this.viewPitch);
    const range = this.weapon.state.stats.range;
    const hit = this.raycast(this.eye, dir, range);
    return addScaled(this.eye, dir, hit ? hit.t : range);
  }

  summary(): CombatSummary {
    const { kills, headshotKills, shots, hits, damage } = this.score;
    return { kills, headshotKills, shots, hits, damage, accuracy: shots > 0 ? hits / shots : 0, seconds: Math.min(this.time, this.duration) };
  }

  // ---------- simulation ----------

  step(input: CombatInput, dt: number): CombatEvent[] {
    if (this.finished) return [];
    const events: CombatEvent[] = [];
    const edge = {
      fire: input.fire && !this.prev.fire,
      jump: input.jump && !this.prev.jump,
      dash: input.dash && !this.prev.dash,
      reload: input.reload && !this.prev.reload,
    };
    this.prev = { fire: input.fire, jump: input.jump, dash: input.dash, reload: input.reload };
    this.yaw = input.yaw;
    this.pitch = Math.max(-MAX_PITCH, Math.min(MAX_PITCH, input.pitch));
    this.aiming = input.aim;

    if (input.slot !== null && input.slot !== this.activeSlot && this.slots[input.slot]) {
      this.weapon.state.cancelReload();
      this.activeSlot = input.slot;
      events.push({ type: 'switch', slot: input.slot });
    }
    this.refreshStats();
    if (edge.reload && this.weapon.state.reload(this.time)) events.push({ type: 'reload', slot: this.activeSlot });

    let remaining = Math.min(dt, MAX_FRAME);
    let first = true;
    while (remaining > 1e-9 && !this.finished) {
      const h = Math.min(SUBSTEP, remaining);
      remaining -= h;
      this.time += h;

      if (!this.alive) {
        first = false;
        continue;
      }
      events.push(
        ...stepMovement(
          this.move,
          { forward: input.forward, right: input.right, jump: first && edge.jump, dash: first && edge.dash, yaw: this.yaw },
          this.moveParams(),
          this.world,
          h,
        ),
      );

      const state = this.weapon.state;
      if (state.update(this.time, h)) events.push({ type: 'reloaded', slot: this.activeSlot });
      const wantsFire = state.stats.automatic ? input.fire : first && edge.fire;
      if (wantsFire) this.tryShoot(events);

      this.updateTargets(events);
      if (this.time >= this.duration) {
        this.finished = true;
        events.push({ type: 'end' });
      }
      first = false;
    }
    return events;
  }

  // ---------- interne ----------

  private refreshStats(): void {
    const mods = collectModifiers(this.sources, this.time);
    this.stats = playerStats(this.config.player, mods);
    for (const slot of this.slots) {
      const weapon = this.config.weapons.weapons.find((w) => w.id === slot.weaponId)!;
      slot.state.setStats(weaponStats(weapon, mods));
    }
  }

  private moveParams(): MoveParams {
    const { movement, body } = this.config.player;
    return {
      walkSpeed: this.stats.walkSpeed * (this.aiming ? movement.aimSpeedFactor : 1),
      groundAcceleration: movement.groundAcceleration,
      airAcceleration: this.stats.airAcceleration,
      jumpVelocity: this.stats.jumpVelocity,
      gravity: movement.gravity,
      extraJumps: this.stats.extraJumps,
      maxDashCharges: this.stats.dashCharges,
      dashSpeed: movement.dashSpeed,
      dashSeconds: movement.dashSeconds,
      dashCooldownSeconds: movement.dashCooldownSeconds,
      height: body.height,
      radius: body.radius,
      stepHeight: movement.stepHeight,
    };
  }

  private tryShoot(events: CombatEvent[]): void {
    const state = this.weapon.state;
    if (state.ammo <= 0 && !state.reloading) {
      events.push({ type: 'empty' });
      if (state.reload(this.time)) events.push({ type: 'reload', slot: this.activeSlot });
      return;
    }
    const recoilBefore = state.recoilDeg;
    if (state.fire(this.time) !== 'fired') return;
    this.score.shots++;

    const s = state.stats;
    const origin = this.eye;
    const basePitch = this.pitch + recoilBefore * DEG;
    const rays: { from: Vec3; to: Vec3 }[] = [];
    const after: CombatEvent[] = [];
    let touched = false;

    for (let i = 0; i < s.pellets; i++) {
      // tirage uniforme dans le cône de dispersion
      const r = s.spreadDeg * DEG * Math.sqrt(this.rng.next());
      const theta = this.rng.next() * Math.PI * 2;
      const dir = lookDirection(this.yaw + r * Math.cos(theta), basePitch + r * Math.sin(theta));
      const hit = this.raycast(origin, dir, s.range);
      const point = addScaled(origin, dir, hit ? hit.t : s.range);
      rays.push({ from: origin, to: point });
      if (!hit) continue;
      after.push({ type: 'impact', point, normal: hit.normal, surface: hit.surface });
      if (hit.target) {
        this.damageTarget(hit.target, shotDamage(s, hit.t, hit.head), hit.head, point, after, hit.t);
        touched = true;
      }
      if (s.splashRadius > 0 && this.splash(point, s, hit.target, after)) touched = true;
    }
    if (touched) this.score.hits++;
    events.push({ type: 'shot', slot: this.activeSlot, rays }, ...after);
  }

  private raycast(origin: Vec3, dir: Vec3, maxT: number): Hit | null {
    const world = raycastWorld(this.world, origin, dir, maxT);
    let best: Hit | null = world ? { ...world, target: null, head: false } : null;
    for (const target of this.targets) {
      if (!target.alive) continue;
      const boxes = this.targetBoxes(target);
      for (const head of [true, false]) {
        const hit = rayAabb(origin, dir, head ? boxes.head : boxes.body, best ? best.t : maxT);
        if (hit && (!best || hit.t < best.t)) best = { ...hit, surface: 'target', target, head };
      }
    }
    return best;
  }

  private splash(point: Vec3, s: WeaponStats, direct: Target | null, events: CombatEvent[]): boolean {
    let any = false;
    const { height, headHeight } = this.config.player.body;
    for (const target of this.targets) {
      if (!target.alive || target === direct) continue;
      const center = v3(target.position.x, target.position.y + (height - headHeight) / 2, target.position.z);
      const d = length(sub(center, point));
      if (d >= s.splashRadius) continue;
      this.damageTarget(target, s.damagePerShot * (1 - d / s.splashRadius), false, center, events, length(sub(center, this.eye)));
      any = true;
    }
    return any;
  }

  private damageTarget(target: Target, damage: number, head: boolean, point: Vec3, events: CombatEvent[], distance: number): void {
    if (target.playerId) {
      // adversaire : le serveur calcule et applique les dégâts
      target.lastHitAt = this.time;
      events.push({ type: 'hit', targetId: target.id, playerId: target.playerId, head, damage, distance, point });
      return;
    }
    const dealt = Math.min(damage, target.health);
    target.health -= damage;
    target.lastHitAt = this.time;
    this.score.damage += dealt;
    events.push({ type: 'hit', targetId: target.id, playerId: null, head, damage, distance, point });
    if (target.health <= 0) {
      target.alive = false;
      target.respawnAt = this.time + this.arena.targetRespawnSeconds;
      this.score.kills++;
      if (head) this.score.headshotKills++;
      events.push({ type: 'kill', targetId: target.id, head });
    }
  }

  private updateTargets(events: CombatEvent[]): void {
    for (const t of this.targets) {
      if (t.playerId) continue;
      if (!t.alive && this.time >= t.respawnAt) {
        t.alive = true;
        t.health = this.arena.targetHealth;
        events.push({ type: 'respawn', targetId: t.id });
      }
      if (t.moving) {
        const half = t.moving.distance / 2;
        const offset = half * Math.sin((this.time * t.moving.speed) / half);
        t.position = { ...t.base, [t.moving.axis]: t.base[t.moving.axis] + offset };
      }
    }
  }
}
