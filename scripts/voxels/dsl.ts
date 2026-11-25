// Petit langage pour dessiner des modèles voxel en code.
// Principe : on dessine des PROFILS de côté (polygones dans le plan x/y) qu'on extrude
// sur une épaisseur centrée en z, puis on ajoute cylindres, perçages et peinture de surface.
//
// Repère : x = longueur (bouche du canon vers +x), y = haut, z = profondeur (centrée).
// Lancé par Node directement (pas de syntaxe TypeScript non effaçable ici).
import { createVoxelModel, getVoxel, setVoxel, type VoxelModel } from '../../src/core/voxel/voxelModel.ts';

export type Point = readonly [number, number];
export type Side = 'both' | 'front' | 'back';

export class VoxelBuilder {
  readonly model: VoxelModel;
  readonly cz: number;
  private readonly colorIndex = new Map<string, number>();

  constructor(sx: number, sy: number, sz: number) {
    this.model = createVoxelModel(sx, sy, sz);
    this.cz = sz / 2;
  }

  /** Index de palette d'une couleur « #rrggbb » (ajoutée à la palette au premier usage). */
  color(hex: string): number {
    const known = this.colorIndex.get(hex);
    if (known !== undefined) return known;
    const index = this.colorIndex.size + 1;
    if (index > 255) throw new Error('Palette pleine (255 couleurs max)');
    this.model.palette[index] = parseInt(hex.slice(1), 16);
    this.colorIndex.set(hex, index);
    return index;
  }

  /** Tranche z d'une pièce d'épaisseur t, centrée sur le modèle. */
  zRange(t: number): [number, number] {
    const z0 = Math.round(this.cz - t / 2);
    return [z0, z0 + t - 1];
  }

  get(x: number, y: number, z: number): number {
    return getVoxel(this.model, x, y, z);
  }

  set(x: number, y: number, z: number, hex: string | null): this {
    setVoxel(this.model, x, y, z, hex === null ? 0 : this.color(hex));
    return this;
  }

  /** Pavé plein (bornes incluses). hex = null pour creuser. */
  box(x0: number, y0: number, z0: number, x1: number, y1: number, z1: number, hex: string | null): this {
    for (let x = Math.min(x0, x1); x <= Math.max(x0, x1); x++)
      for (let y = Math.min(y0, y1); y <= Math.max(y0, y1); y++)
        for (let z = Math.min(z0, z1); z <= Math.max(z0, z1); z++) this.set(x, y, z, hex);
    return this;
  }

  /** Pavé d'épaisseur t centrée en z. */
  slab(x0: number, y0: number, x1: number, y1: number, t: number, hex: string | null): this {
    const [z0, z1] = this.zRange(t);
    return this.box(x0, y0, z0, x1, y1, z1, hex);
  }

  /** Polygone (profil de côté) extrudé sur une épaisseur t centrée. Une case est remplie si son centre est dans le polygone. */
  profile(points: readonly Point[], t: number, hex: string | null): this {
    const [z0, z1] = this.zRange(t);
    const xs = points.map((p) => p[0]);
    const ys = points.map((p) => p[1]);
    for (let x = Math.floor(Math.min(...xs)); x <= Math.ceil(Math.max(...xs)); x++) {
      for (let y = Math.floor(Math.min(...ys)); y <= Math.ceil(Math.max(...ys)); y++) {
        if (!insidePolygon(x + 0.5, y + 0.5, points)) continue;
        for (let z = z0; z <= z1; z++) this.set(x, y, z, hex);
      }
    }
    return this;
  }

  /** Cylindre couché le long de x, centré en (cy, cz) (coordonnées de bord de case, ex. 15.5 = milieu de la case 15). */
  cylX(x0: number, x1: number, cy: number, r: number, hex: string | null, cz = this.cz): this {
    for (let x = x0; x <= x1; x++)
      for (let y = Math.floor(cy - r); y <= Math.ceil(cy + r); y++)
        for (let z = Math.floor(cz - r); z <= Math.ceil(cz + r); z++) {
          const dy = y + 0.5 - cy;
          const dz = z + 0.5 - cz;
          if (dy * dy + dz * dz <= r * r) this.set(x, y, z, hex);
        }
    return this;
  }

  /** Cylindre vertical (le long de y), centré en (cx, cz). */
  cylY(y0: number, y1: number, cx: number, r: number, hex: string | null, cz = this.cz): this {
    for (let y = y0; y <= y1; y++)
      for (let x = Math.floor(cx - r); x <= Math.ceil(cx + r); x++)
        for (let z = Math.floor(cz - r); z <= Math.ceil(cz + r); z++) {
          const dx = x + 0.5 - cx;
          const dz = z + 0.5 - cz;
          if (dx * dx + dz * dz <= r * r) this.set(x, y, z, hex);
        }
    return this;
  }

  /** Cases extérieures d'une colonne (x, y) : la plus en avant (+z) et la plus en arrière (−z). */
  private surface(x: number, y: number, side: Side): number[] {
    const zs: number[] = [];
    if (side !== 'back') {
      for (let z = this.model.sz - 1; z >= 0; z--) if (this.get(x, y, z)) { zs.push(z); break; }
    }
    if (side !== 'front') {
      for (let z = 0; z < this.model.sz; z++) if (this.get(x, y, z)) { zs.push(z); break; }
    }
    return zs;
  }

  /** Peint la surface visible de côté (sans changer la forme). filter(x, y) permet des motifs. */
  paint(x0: number, y0: number, x1: number, y1: number, hex: string, side: Side = 'both', filter?: (x: number, y: number) => boolean): this {
    for (let x = x0; x <= x1; x++)
      for (let y = y0; y <= y1; y++) {
        if (filter && !filter(x, y)) continue;
        for (const z of this.surface(x, y, side)) this.set(x, y, z, hex);
      }
    return this;
  }

  /** Creuse la surface de côté sur `depth` cases ; le fond du creux prend la couleur `floor`. */
  engrave(x0: number, y0: number, x1: number, y1: number, depth: number, floor: string | null, side: Side = 'both', filter?: (x: number, y: number) => boolean): this {
    for (let x = x0; x <= x1; x++)
      for (let y = y0; y <= y1; y++) {
        if (filter && !filter(x, y)) continue;
        for (const z of this.surface(x, y, side)) {
          const dir = z >= this.cz ? -1 : 1;
          for (let d = 0; d < depth; d++) this.set(x, y, z + dir * d, null);
          const bottom = z + dir * depth;
          if (floor && this.get(x, y, bottom)) this.set(x, y, bottom, floor);
        }
      }
    return this;
  }

  /** Repeint toutes les cases pleines d'une zone (dans toute l'épaisseur). */
  recolor(x0: number, y0: number, z0: number, x1: number, y1: number, z1: number, hex: string): this {
    for (let x = x0; x <= x1; x++)
      for (let y = y0; y <= y1; y++)
        for (let z = z0; z <= z1; z++) if (this.get(x, y, z)) this.set(x, y, z, hex);
    return this;
  }

  /** Peint le dessus visible (case pleine la plus haute de chaque colonne x/z). */
  paintTop(x0: number, x1: number, hex: string, filter?: (x: number, z: number) => boolean): this {
    for (let x = x0; x <= x1; x++)
      for (let z = 0; z < this.model.sz; z++) {
        if (filter && !filter(x, z)) continue;
        for (let y = this.model.sy - 1; y >= 0; y--) {
          if (this.get(x, y, z)) {
            this.set(x, y, z, hex);
            break;
          }
        }
      }
    return this;
  }
}

export function insidePolygon(px: number, py: number, points: readonly Point[]): boolean {
  let inside = false;
  for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
    const [xi, yi] = points[i]!;
    const [xj, yj] = points[j]!;
    if (yi > py !== yj > py && px < ((xj - xi) * (py - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}
