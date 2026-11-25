// Grenade : trajectoire avec rebonds sur le décor, puis explosion à dégâts de zone.
// Pur et déterministe : le serveur calcule la trajectoire et l'explosion, chaque client rejoue
// exactement la même trajectoire pour l'affichage (même monde, mêmes valeurs, même pas de temps).
import type { PickupsConfig } from '../config/schemas';
import { add, addScaled, length, raycastWorld, scale, sub, v3, type Vec3, type World } from './geometry';

export type GrenadeParams = PickupsConfig['grenade'];

/** Pas de la simulation (s) et intervalle entre deux points gardés pour l'affichage. */
const STEP = 1 / 120;
export const GRENADE_SAMPLE_SECONDS = 1 / 30;
const SAMPLE_EVERY = Math.round(GRENADE_SAMPLE_SECONDS / STEP);
/** En dessous de cette vitesse après un rebond sur un sol, la grenade s'arrête. */
const REST_SPEED = 0.6;
/** Une surface est un sol si sa normale monte au moins autant. */
const FLOOR_NORMAL_Y = 0.7;
const dot = (a: Vec3, b: Vec3) => a.x * b.x + a.y * b.y + a.z * b.z;

export interface GrenadePath {
  /** Positions toutes les GRENADE_SAMPLE_SECONDS, de 0 jusqu'à l'explosion comprise. */
  samples: Vec3[];
  /** Point de l'explosion. */
  end: Vec3;
}

/** Vitesse de départ : dans l'axe du regard, plus une poussée vers le haut. */
export function throwVelocity(direction: Vec3, p: GrenadeParams): Vec3 {
  const n = length(direction) || 1;
  return add(scale(direction, p.throwSpeed / n), v3(0, p.throwUpBoost, 0));
}

export function simulateGrenade(world: World, origin: Vec3, velocity: Vec3, p: GrenadeParams): GrenadePath {
  let pos = { ...origin };
  let vel = { ...velocity };
  let resting = false;
  const steps = Math.round(p.fuseSeconds / STEP);
  const samples: Vec3[] = [{ ...pos }];
  const limitX = world.halfX - p.radius;
  const limitZ = world.halfZ - p.radius;

  for (let i = 1; i <= steps; i++) {
    if (!resting) {
      vel = v3(vel.x, vel.y - p.gravity * STEP, vel.z);
      const speed = length(vel);
      const travel = speed * STEP;
      if (speed > 1e-9) {
        const dir = scale(vel, 1 / speed);
        const hit = raycastWorld(world, pos, dir, travel + p.radius);
        if (hit) {
          // s'arrête à un rayon de la surface, puis rebondit : vitesse normale inversée et amortie, frottement le long
          pos = addScaled(pos, dir, Math.max(0, hit.t - p.radius));
          const vn = dot(vel, hit.normal);
          const normalPart = scale(hit.normal, vn);
          const tangent = sub(vel, normalPart);
          vel = add(scale(tangent, p.friction), scale(normalPart, -p.bounce));
          if (hit.normal.y >= FLOOR_NORMAL_Y && length(vel) < REST_SPEED) {
            vel = v3();
            resting = true;
          }
        } else {
          pos = addScaled(pos, dir, travel);
        }
      }
      // garde-fou : jamais hors de l'arène ni sous le sol
      pos = v3(Math.max(-limitX, Math.min(limitX, pos.x)), Math.max(p.radius, pos.y), Math.max(-limitZ, Math.min(limitZ, pos.z)));
    }
    if (i % SAMPLE_EVERY === 0 || i === steps) samples.push({ ...pos });
  }
  return { samples, end: { ...pos } };
}

/** Position affichée à un instant donné depuis le lancer (interpolée entre deux points). */
export function grenadePositionAt(path: GrenadePath, seconds: number): Vec3 {
  const f = Math.max(0, seconds / GRENADE_SAMPLE_SECONDS);
  const i = Math.floor(f);
  if (i >= path.samples.length - 1) return { ...path.end };
  const a = path.samples[i]!;
  const b = path.samples[i + 1]!;
  const k = f - i;
  return v3(a.x + (b.x - a.x) * k, a.y + (b.y - a.y) * k, a.z + (b.z - a.z) * k);
}

/** Part des dégâts selon la distance au centre : 1 au centre, minFactor au bord, 0 au-delà. */
export function blastFactor(distance: number, p: GrenadeParams): number {
  if (distance >= p.blastRadius) return 0;
  return 1 - (1 - p.minFactor) * (distance / p.blastRadius);
}

export interface BlastVictim {
  id: string;
  /** Position des pieds. */
  position: Vec3;
}

export interface BlastHit {
  id: string;
  distance: number;
  /** Dégâts bruts de l'explosion, avant défense et bouclier. */
  damage: number;
}

/**
 * Joueurs touchés par une explosion : dans le rayon, et pas cachés derrière le décor
 * (le centre du corps ou la tête doit être visible depuis le point d'explosion).
 */
export function blastHits(world: World, point: Vec3, victims: readonly BlastVictim[], body: { height: number }, p: GrenadeParams): BlastHit[] {
  const hits: BlastHit[] = [];
  for (const v of victims) {
    const aims = [v3(v.position.x, v.position.y + body.height / 2, v.position.z), v3(v.position.x, v.position.y + body.height * 0.9, v.position.z)];
    const distance = Math.min(...aims.map((a) => length(sub(a, point))));
    const factor = blastFactor(distance, p);
    if (factor <= 0) continue;
    const visible = aims.some((a) => {
      const delta = sub(a, point);
      const d = length(delta);
      if (d < 1e-6) return true;
      return raycastWorld(world, point, scale(delta, 1 / d), d - 0.01) === null;
    });
    if (visible) hits.push({ id: v.id, distance, damage: p.damage * factor });
  }
  return hits;
}
