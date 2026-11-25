// Petit langage pour dessiner une carte en voxel ET ses collisions d'un seul geste.
// - Le décor est une grille de voxels de 25 cm (VPM = 4 voxels par mètre), écrite en .vox.
// - Les collisions sont des boîtes alignées (AABB) en mètres, écrites dans config/arenas.json.
// `solid()` fait les deux à la fois : ce qu'on voit et ce qui bloque viennent du même dessin.
//
// Repère (identique au jeu) : x = est, y = haut, z = sud ; l'origine est au centre de la zone de jeu, au sol.
// Les coordonnées en mètres sont des boîtes demi-ouvertes [x0, x1) ; elles sont arrondies au voxel.
// Lancé par Node directement (pas de syntaxe TypeScript non effaçable ici).
import { createVoxelModel, getVoxel, setVoxel, type VoxelModel } from '../../src/core/voxel/voxelModel.ts';

/** Voxels par mètre. */
export const VPM = 4;

/** Case en cours de peinture : position absolue (ix, iy, iz), position dans la boîte (lx, ly, lz), taille de la boîte (w, h, d). */
export interface Cell {
  ix: number;
  iy: number;
  iz: number;
  lx: number;
  ly: number;
  lz: number;
  w: number;
  h: number;
  d: number;
}

/** Peinture d'un voxel : couleur « #rrggbb », null pour vider la case. */
export type PaintFn = (c: Cell) => string | null;
export type Paint = string | null | PaintFn;

export interface SpawnDef {
  position: [number, number, number];
  yawDeg: number;
}

export interface BlockDef {
  position: [number, number, number];
  size: [number, number, number];
  color: number;
}

/** Élément cassable (config/materials.json) : boîte en mètres, centre de la face du bas. */
export interface BreakableDef {
  material: string;
  position: [number, number, number];
  size: [number, number, number];
}

export interface MapOptions {
  /** Zone de jeu (largeur x, profondeur z) en mètres, centrée. */
  play: [number, number];
  /** Étendue du décor (≥ zone de jeu), en mètres : le décor peut déborder pour l'horizon. */
  extent: [number, number];
  /** Hauteur du décor au-dessus du sol, en mètres. */
  height: number;
}

export interface FillOptions {
  /** Ne remplit que l'enveloppe (épaisseur en voxels), sans le dessous : moins de voxels pour un gros volume. */
  shell?: number;
}

// ---------- bruit déterministe ----------

/** Nombre pseudo-aléatoire stable dans [0, 1) pour une case et une graine. */
export function hash(x: number, y: number, z: number, seed = 0): number {
  let h = Math.imul(x | 0, 374761393) ^ Math.imul(y | 0, 668265263) ^ Math.imul(z | 0, 1440662683) ^ Math.imul(seed | 0, 2246822519);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}

/** Bruit lissé 2D dans [0, 1) (interpolation des valeurs d'une grille de pas `cell`). */
export function smoothNoise(x: number, z: number, cell: number, seed = 0): number {
  const gx = x / cell;
  const gz = z / cell;
  const x0 = Math.floor(gx);
  const z0 = Math.floor(gz);
  const fx = gx - x0;
  const fz = gz - z0;
  const s = (t: number) => t * t * (3 - 2 * t);
  const a = hash(x0, 0, z0, seed);
  const b = hash(x0 + 1, 0, z0, seed);
  const c = hash(x0, 0, z0 + 1, seed);
  const d = hash(x0 + 1, 0, z0 + 1, seed);
  const u = s(fx);
  const v = s(fz);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}

/** Couleur d'une liste choisie par une valeur dans [0, 1). */
export function pick(colors: readonly string[], n: number): string {
  return colors[Math.min(colors.length - 1, Math.floor(n * colors.length))]!;
}

/** Peinture tachetée : nuances tirées au hasard, case par case. */
export function speckle(colors: readonly string[], seed = 0): PaintFn {
  return ({ ix, iy, iz }) => pick(colors, hash(ix, iy, iz, seed));
}

// ---------- constructeur ----------

export class MapBuilder {
  readonly model: VoxelModel;
  readonly options: MapOptions;
  readonly blocks: BlockDef[] = [];
  readonly spawns: SpawnDef[] = [];
  /** Coffres à grenades (config/pickups.json), tournés vers le centre de la carte. */
  readonly chests: SpawnDef[] = [];
  /** Éléments cassables et leurs voxels, dessinés à part du décor (écrits dans <id>-breakables.vox). */
  readonly breakables: BreakableDef[] = [];
  readonly breakModel: VoxelModel;
  /** Matériau en cours (dans `breakable()`), sinon null. */
  private breaking: string | null = null;
  /** Couleurs rendues lumineuses (lanternes, cristaux…). */
  readonly glow = new Set<string>();
  /** Index voxel de y = 0 (une couche de sol sous le niveau 0). */
  readonly ground = 1;
  private readonly colorIndex = new Map<string, number>();

  constructor(options: MapOptions) {
    this.options = options;
    const [ex, ez] = options.extent;
    this.model = createVoxelModel(ex * VPM, options.height * VPM + this.ground, ez * VPM);
    // même palette que le décor (mêmes couleurs, mêmes index)
    this.breakModel = { ...createVoxelModel(this.model.sx, this.model.sy, this.model.sz), palette: this.model.palette };
  }

  /**
   * Tout ce que `draw` dessine devient cassable : ses voxels vont dans le décor cassable,
   * chacune de ses collisions devient un élément du matériau donné (config/materials.json).
   */
  breakable(material: string, draw: () => void): this {
    this.breaking = material;
    try {
      draw();
    } finally {
      this.breaking = null;
    }
    return this;
  }

  /** Modèle où l'on dessine en ce moment (décor ou décor cassable). */
  private get target(): VoxelModel {
    return this.breaking ? this.breakModel : this.model;
  }

  /** Objet réutilisé pour chaque case peinte (évite des millions d'allocations). */
  private readonly cell: Cell = { ix: 0, iy: 0, iz: 0, lx: 0, ly: 0, lz: 0, w: 0, h: 0, d: 0 };

  // conversions mètres → index voxel (bord de case)
  vx(x: number): number {
    return Math.round((x + this.options.extent[0] / 2) * VPM);
  }
  vy(y: number): number {
    return Math.round(y * VPM) + this.ground;
  }
  vz(z: number): number {
    return Math.round((z + this.options.extent[1] / 2) * VPM);
  }
  /** Centre d'une case voxel, en mètres. */
  mx(ix: number): number {
    return (ix + 0.5) / VPM - this.options.extent[0] / 2;
  }
  my(iy: number): number {
    return (iy - this.ground + 0.5) / VPM;
  }
  mz(iz: number): number {
    return (iz + 0.5) / VPM - this.options.extent[1] / 2;
  }

  /** Index de palette d'une couleur (ajoutée au premier usage). */
  color(hex: string): number {
    const known = this.colorIndex.get(hex);
    if (known !== undefined) return known;
    const index = this.colorIndex.size + 1;
    if (index > 255) throw new Error('Palette pleine (255 couleurs max)');
    this.model.palette[index] = parseInt(hex.slice(1), 16);
    this.colorIndex.set(hex, index);
    return index;
  }

  /** Déclare une couleur lumineuse et la renvoie. */
  light(hex: string): string {
    this.glow.add(hex);
    return hex;
  }

  get(ix: number, iy: number, iz: number): number {
    return getVoxel(this.target, ix, iy, iz);
  }

  /** Couleur « #rrggbb » d'une case, ou null si vide. */
  colorAt(ix: number, iy: number, iz: number): string | null {
    const c = this.get(ix, iy, iz);
    return c === 0 ? null : `#${(this.model.palette[c] ?? 0).toString(16).padStart(6, '0')}`;
  }

  vox(ix: number, iy: number, iz: number, hex: string | null): void {
    setVoxel(this.target, ix, iy, iz, hex === null ? 0 : this.color(hex));
  }

  /** Remplit une boîte d'index voxel [i0, i1) avec une peinture. */
  vfill(ix0: number, iy0: number, iz0: number, ix1: number, iy1: number, iz1: number, paint: Paint, o: FillOptions = {}): void {
    const w = ix1 - ix0;
    const h = iy1 - iy0;
    const d = iz1 - iz0;
    const t = o.shell ?? 0;
    for (let iz = Math.max(0, iz0); iz < Math.min(this.model.sz, iz1); iz++) {
      for (let iy = Math.max(0, iy0); iy < Math.min(this.model.sy, iy1); iy++) {
        for (let ix = Math.max(0, ix0); ix < Math.min(this.model.sx, ix1); ix++) {
          const lx = ix - ix0;
          const ly = iy - iy0;
          const lz = iz - iz0;
          if (t > 0 && lx >= t && lx < w - t && lz >= t && lz < d - t && ly < h - t) continue;
          let c: string | null;
          if (typeof paint === 'function') {
            const cell = this.cell;
            cell.ix = ix;
            cell.iy = iy;
            cell.iz = iz;
            cell.lx = lx;
            cell.ly = ly;
            cell.lz = lz;
            cell.w = w;
            cell.h = h;
            cell.d = d;
            c = paint(cell);
          } else c = paint;
          this.vox(ix, iy, iz, c);
        }
      }
    }
  }

  /** Décor seul (pas de collision), boîte en mètres. */
  fill(x0: number, y0: number, z0: number, x1: number, y1: number, z1: number, paint: Paint, o: FillOptions = {}): this {
    this.vfill(this.vx(Math.min(x0, x1)), this.vy(Math.min(y0, y1)), this.vz(Math.min(z0, z1)), this.vx(Math.max(x0, x1)), this.vy(Math.max(y0, y1)), this.vz(Math.max(z0, z1)), paint, o);
    return this;
  }

  /** Collision seule, boîte en mètres (ignorée si elle est entièrement hors de la zone de jeu). */
  collide(x0: number, y0: number, z0: number, x1: number, y1: number, z1: number): this {
    const [ax, bx] = [Math.min(x0, x1), Math.max(x0, x1)];
    const [ay, by] = [Math.min(y0, y1), Math.max(y0, y1)];
    const [az, bz] = [Math.min(z0, z1), Math.max(z0, z1)];
    const [px, pz] = this.options.play;
    if (bx <= -px / 2 || ax >= px / 2 || bz <= -pz / 2 || az >= pz / 2) return this;
    if (bx - ax <= 0 || by - ay <= 0 || bz - az <= 0) return this;
    const r = (v: number) => Math.round(v * 1000) / 1000;
    if (this.breaking) {
      this.breakables.push({ material: this.breaking, position: [r((ax + bx) / 2), r(ay), r((az + bz) / 2)], size: [r(bx - ax), r(by - ay), r(bz - az)] });
      return this;
    }
    this.blocks.push({ position: [r((ax + bx) / 2), r(ay), r((az + bz) / 2)], size: [r(bx - ax), r(by - ay), r(bz - az)], color: 1 });
    return this;
  }

  /** Décor + collision de la même boîte. */
  solid(x0: number, y0: number, z0: number, x1: number, y1: number, z1: number, paint: Paint, o: FillOptions = {}): this {
    this.fill(x0, y0, z0, x1, y1, z1, paint, o);
    return this.collide(x0, y0, z0, x1, y1, z1);
  }

  /** Cylindre vertical (décor) ; collision optionnelle par le carré inscrit. */
  cylinder(cx: number, cz: number, r: number, y0: number, y1: number, paint: Paint, collide = false): this {
    const ix0 = this.vx(cx - r) - 1;
    const ix1 = this.vx(cx + r) + 1;
    const iz0 = this.vz(cz - r) - 1;
    const iz1 = this.vz(cz + r) + 1;
    const iy0 = this.vy(y0);
    const iy1 = this.vy(y1);
    for (let iz = iz0; iz < iz1; iz++)
      for (let ix = ix0; ix < ix1; ix++) {
        const dx = this.mx(ix) - cx;
        const dz = this.mz(iz) - cz;
        if (dx * dx + dz * dz > r * r) continue;
        this.vfill(ix, iy0, iz, ix + 1, iy1, iz + 1, paint);
      }
    if (collide) {
      const s = r * Math.SQRT1_2;
      this.collide(cx - s, y0, cz - s, cx + s, y1, cz + s);
    }
    return this;
  }

  /** Volume arrondi irrégulier (feuillage, rochers) : ellipsoïde dont le bord est grignoté par le bruit. */
  blob(cx: number, cy: number, cz: number, rx: number, ry: number, rz: number, paint: Paint, roughness = 0.25, seed = 0): this {
    const ix0 = this.vx(cx - rx) - 1;
    const ix1 = this.vx(cx + rx) + 1;
    const iy0 = this.vy(cy - ry) - 1;
    const iy1 = this.vy(cy + ry) + 1;
    const iz0 = this.vz(cz - rz) - 1;
    const iz1 = this.vz(cz + rz) + 1;
    for (let iz = iz0; iz < iz1; iz++)
      for (let iy = iy0; iy < iy1; iy++)
        for (let ix = ix0; ix < ix1; ix++) {
          const dx = (this.mx(ix) - cx) / rx;
          const dy = (this.my(iy) - cy) / ry;
          const dz = (this.mz(iz) - cz) / rz;
          const d = dx * dx + dy * dy + dz * dz;
          if (d > 1 - roughness * hash(ix >> 1, iy >> 1, iz >> 1, seed)) continue;
          this.vfill(ix, iy, iz, ix + 1, iy + 1, iz + 1, paint);
        }
    return this;
  }

  /**
   * Escalier plein : `steps` marches de `rise` m de haut et `run` m de profondeur, montant vers `dir`,
   * en partant de (x, z) (bord bas de la première marche, centré en largeur) et de la hauteur `base`.
   */
  stairs(x: number, z: number, dir: 'n' | 's' | 'e' | 'w', width: number, steps: number, paint: Paint, rise = 0.5, run = 0.5, base = 0): this {
    for (let i = 0; i < steps; i++) {
      const top = base + (i + 1) * rise;
      const a = i * run;
      const b = (i + 1) * run;
      const hw = width / 2;
      if (dir === 'n') this.solid(x - hw, base, z - b, x + hw, top, z - a, paint);
      if (dir === 's') this.solid(x - hw, base, z + a, x + hw, top, z + b, paint);
      if (dir === 'e') this.solid(x + a, base, z - hw, x + b, top, z + hw, paint);
      if (dir === 'w') this.solid(x - b, base, z - hw, x - a, top, z + hw, paint);
    }
    return this;
  }

  /** Hauteur où l'on se tient en (x, z) : on empile les collisions depuis le sol. */
  standHeight(x: number, z: number, radius = 0.35): number {
    let y = 0;
    for (let moved = true; moved; ) {
      moved = false;
      for (const b of this.blocks) {
        const [bx, by, bz] = b.position;
        const [w, h, d] = b.size;
        const inside = Math.abs(x - bx) < w / 2 + radius && Math.abs(z - bz) < d / 2 + radius;
        if (inside && by <= y + 1e-6 && by + h > y + 1e-6) {
          y = by + h;
          moved = true;
        }
      }
    }
    return Math.round(y * 1000) / 1000;
  }

  /** Coffre posé au sol (ou sur le bloc le plus haut), serrure tournée vers le centre de la carte. */
  chest(x: number, z: number): this {
    const yawDeg = x === 0 && z === 0 ? 0 : Math.round((Math.atan2(-x, -z) * 180) / Math.PI);
    this.chests.push({ position: [x, this.standHeight(x, z), z], yawDeg });
    return this;
  }

  spawn(x: number, z: number, yawDeg: number): this {
    this.spawns.push({ position: [x, this.standHeight(x, z), z], yawDeg });
    return this;
  }

  /** Copie tournée de 180° de toutes les collisions et du décor d'une zone : cartes symétriques et équitables. */
  mirrorHalf(keep: (x: number, z: number) => boolean): this {
    const { sx, sy, sz } = this.model;
    for (let iz = 0; iz < sz; iz++)
      for (let ix = 0; ix < sx; ix++) {
        if (!keep(this.mx(ix), this.mz(iz))) continue;
        const jx = sx - 1 - ix;
        const jz = sz - 1 - iz;
        for (let iy = 0; iy < sy; iy++) {
          const from = ix + sx * (iy + sy * iz);
          const to = jx + sx * (iy + sy * jz);
          this.model.data[to] = this.model.data[from]!;
          this.breakModel.data[to] = this.breakModel.data[from]!;
        }
      }
    const keptBreakables = this.breakables.filter((b) => keep(b.position[0], b.position[2]));
    this.breakables.length = 0;
    for (const b of keptBreakables) {
      this.breakables.push(b);
      if (Math.abs(b.position[0]) < 1e-6 && Math.abs(b.position[2]) < 1e-6) continue;
      this.breakables.push({ ...b, position: [-b.position[0], b.position[1], -b.position[2]] });
    }
    const kept = this.blocks.filter((b) => keep(b.position[0], b.position[2]));
    this.blocks.length = 0;
    for (const b of kept) {
      this.blocks.push(b);
      // un bloc centré sur l'axe serait dupliqué sur lui-même
      if (Math.abs(b.position[0]) < 1e-6 && Math.abs(b.position[2]) < 1e-6) continue;
      this.blocks.push({ ...b, position: [-b.position[0], b.position[1], -b.position[2]] });
    }
    return this;
  }
}
