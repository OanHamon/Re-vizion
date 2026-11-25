// Géométrie du combat : vecteurs, boîtes alignées (AABB), lancer de rayon, monde de collision.
// Conventions (identiques à Three.js) : y = haut ; yaw 0 = regard vers −z ;
// yaw positif = tourne à gauche ; pitch positif = regarde vers le haut.
import type { Arena } from '../config/schemas';

export interface Vec3 {
  x: number;
  y: number;
  z: number;
}

export const v3 = (x = 0, y = 0, z = 0): Vec3 => ({ x, y, z });
export const add = (a: Vec3, b: Vec3): Vec3 => v3(a.x + b.x, a.y + b.y, a.z + b.z);
export const sub = (a: Vec3, b: Vec3): Vec3 => v3(a.x - b.x, a.y - b.y, a.z - b.z);
export const scale = (a: Vec3, s: number): Vec3 => v3(a.x * s, a.y * s, a.z * s);
export const addScaled = (a: Vec3, b: Vec3, s: number): Vec3 => v3(a.x + b.x * s, a.y + b.y * s, a.z + b.z * s);
export const length = (a: Vec3): number => Math.hypot(a.x, a.y, a.z);

export function lookDirection(yaw: number, pitch: number): Vec3 {
  const c = Math.cos(pitch);
  return v3(-Math.sin(yaw) * c, Math.sin(pitch), -Math.cos(yaw) * c);
}

export interface Aabb {
  min: Vec3;
  max: Vec3;
}

/** Recouvrement strict (deux boîtes qui se touchent ne se recouvrent pas). */
export function overlaps(a: Aabb, b: Aabb): boolean {
  return a.min.x < b.max.x && a.max.x > b.min.x && a.min.y < b.max.y && a.max.y > b.min.y && a.min.z < b.max.z && a.max.z > b.min.z;
}

export interface RayHit {
  t: number;
  normal: Vec3;
}

/** Rayon contre boîte (méthode des tranches). Un rayon qui part de l'intérieur ne touche pas. */
export function rayAabb(origin: Vec3, dir: Vec3, box: Aabb, maxT: number): RayHit | null {
  let tNear = -Infinity;
  let tFar = Infinity;
  let normal = v3();
  for (const axis of ['x', 'y', 'z'] as const) {
    const o = origin[axis];
    const d = dir[axis];
    const lo = box.min[axis];
    const hi = box.max[axis];
    if (Math.abs(d) < 1e-12) {
      if (o < lo || o > hi) return null;
      continue;
    }
    let t1 = (lo - o) / d;
    let t2 = (hi - o) / d;
    let sign = -1;
    if (t1 > t2) {
      [t1, t2] = [t2, t1];
      sign = 1;
    }
    if (t1 > tNear) {
      tNear = t1;
      normal = v3();
      normal[axis] = sign;
    }
    tFar = Math.min(tFar, t2);
    if (tNear > tFar) return null;
  }
  if (tNear < 0 || tNear > maxT) return null;
  return { t: tNear, normal };
}

/** Monde de collision d'une arène : blocs + sol (y = 0) + murs d'enceinte. */
export interface World {
  blocks: Aabb[];
  halfX: number;
  halfZ: number;
  wallHeight: number;
}

export function worldFromArena(arena: Arena): World {
  return {
    blocks: arena.blocks.map(({ position: [x, y, z], size: [w, h, d] }) => ({
      min: v3(x - w / 2, y, z - d / 2),
      max: v3(x + w / 2, y + h, z + d / 2),
    })),
    halfX: arena.size[0] / 2,
    halfZ: arena.size[1] / 2,
    wallHeight: arena.wallHeight,
  };
}

export type Surface = 'block' | 'floor' | 'wall';

export interface WorldHit extends RayHit {
  surface: Surface;
}

/** Premier obstacle du décor touché par le rayon (blocs, sol, murs). */
export function raycastWorld(world: World, origin: Vec3, dir: Vec3, maxT: number): WorldHit | null {
  let best: WorldHit | null = null;
  const consider = (hit: RayHit | null, surface: Surface) => {
    if (hit && (!best || hit.t < best.t)) best = { ...hit, surface };
  };
  for (const block of world.blocks) consider(rayAabb(origin, dir, block, maxT), 'block');
  if (dir.y < 0) {
    const t = -origin.y / dir.y;
    if (t >= 0 && t <= maxT) consider({ t, normal: v3(0, 1, 0) }, 'floor');
  }
  // murs : plans intérieurs x = ±halfX et z = ±halfZ, jusqu'à wallHeight
  const walls: [keyof Vec3, number, Vec3][] = [
    ['x', world.halfX, v3(-1, 0, 0)],
    ['x', -world.halfX, v3(1, 0, 0)],
    ['z', world.halfZ, v3(0, 0, -1)],
    ['z', -world.halfZ, v3(0, 0, 1)],
  ];
  for (const [axis, plane, normal] of walls) {
    const d = dir[axis];
    if (Math.abs(d) < 1e-12) continue;
    const t = (plane - origin[axis]) / d;
    if (t < 0 || t > maxT) continue;
    const y = origin.y + dir.y * t;
    if (y >= 0 && y <= world.wallHeight) consider({ t, normal }, 'wall');
  }
  return best;
}
