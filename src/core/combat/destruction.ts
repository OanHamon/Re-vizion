// Destruction limitée du décor : les éléments cassables d'une arène (arenas.json « breakables ») sont découpés
// en morceaux d'environ cellSize mètres (config/materials.json). Chaque morceau est une boîte de collision
// du monde, avec ses PV selon son matériau ; détruit, il quitte le monde (on passe à travers, les balles
// et les grenades aussi). Pur et déterministe : mêmes ids de morceaux sur le serveur et chez chaque client.
import type { Arena, MaterialsConfig } from '../config/schemas';
import { v3, type Aabb, type Vec3, type World } from './geometry';

export type MaterialDef = MaterialsConfig['materials'][number];

export interface BreakCell {
  /** Index dans la liste des morceaux de l'arène (stable). */
  id: number;
  /** Index de l'élément (arena.breakables) auquel le morceau appartient. */
  element: number;
  material: MaterialDef;
  box: Aabb;
  health: number;
  alive: boolean;
}

/** Distance d'un point à une boîte (0 à l'intérieur). */
export function distanceToBox(p: Vec3, b: Aabb): number {
  const dx = Math.max(b.min.x - p.x, 0, p.x - b.max.x);
  const dy = Math.max(b.min.y - p.y, 0, p.y - b.max.y);
  const dz = Math.max(b.min.z - p.z, 0, p.z - b.max.z);
  return Math.hypot(dx, dy, dz);
}

/** Découpe d'une longueur en parts égales proches de `cell` (au moins une). */
function split(size: number, cell: number): number {
  return Math.max(1, Math.round(size / cell));
}

export class Destructibles {
  readonly cells: BreakCell[] = [];

  /** Ajoute les morceaux de l'arène aux collisions du monde. */
  constructor(
    private readonly world: World,
    arena: Arena,
    materials: MaterialsConfig,
  ) {
    (arena.breakables ?? []).forEach((e, element) => {
      const material = materials.materials.find((m) => m.id === e.material);
      if (!material) throw new Error(`Matériau inconnu : ${e.material}`);
      const [x, y, z] = e.position;
      const [w, h, d] = e.size;
      const [nx, ny, nz] = [split(w, materials.cellSize), split(h, materials.cellSize), split(d, materials.cellSize)];
      const [sx, sy, sz] = [w / nx, h / ny, d / nz];
      for (let j = 0; j < ny; j++)
        for (let k = 0; k < nz; k++)
          for (let i = 0; i < nx; i++) {
            const min = v3(x - w / 2 + i * sx, y + j * sy, z - d / 2 + k * sz);
            const box = { min, max: v3(min.x + sx, min.y + sy, min.z + sz) };
            this.cells.push({ id: this.cells.length, element, material, box, health: material.health, alive: true });
            world.blocks.push(box);
          }
    });
  }

  /** Morceau en place touché par un impact : celui dont la boîte contient le point, à `margin` près. */
  cellAt(point: Vec3, margin = 0.02): BreakCell | undefined {
    let best: BreakCell | undefined;
    let bestDistance = margin;
    for (const c of this.cells) {
      if (!c.alive) continue;
      const d = distanceToBox(point, c.box);
      if (d <= bestDistance) {
        best = c;
        bestDistance = d;
      }
    }
    return best;
  }

  /** Balle : dégâts de l'arme × part du matériau, sur le morceau touché. Renvoie l'id du morceau détruit, ou null. */
  shot(point: Vec3, weaponDamage: number): number | null {
    const cell = this.cellAt(point);
    if (!cell) return null;
    return this.damage(cell, weaponDamage * cell.material.bulletFactor) ? cell.id : null;
  }

  /** Explosion : `damageAt(distance)` × part du matériau, sur chaque morceau à moins de `radius`. Renvoie les ids détruits. */
  blast(point: Vec3, radius: number, damageAt: (distance: number) => number): number[] {
    const destroyed: number[] = [];
    for (const c of this.cells) {
      if (!c.alive) continue;
      const d = distanceToBox(point, c.box);
      if (d >= radius) continue;
      if (this.damage(c, damageAt(d) * c.material.blastFactor)) destroyed.push(c.id);
    }
    return destroyed;
  }

  /** Retire des morceaux (décidé par le serveur). Renvoie ceux qui étaient encore en place. */
  remove(ids: readonly number[]): BreakCell[] {
    const removed: BreakCell[] = [];
    for (const id of ids) {
      const c = this.cells[id];
      if (!c?.alive) continue;
      c.alive = false;
      c.health = 0;
      const at = this.world.blocks.indexOf(c.box);
      if (at >= 0) this.world.blocks.splice(at, 1);
      removed.push(c);
    }
    return removed;
  }

  private damage(c: BreakCell, amount: number): boolean {
    if (amount <= 0) return false;
    c.health -= amount;
    if (c.health > 0) return false;
    this.remove([c.id]);
    return true;
  }
}
