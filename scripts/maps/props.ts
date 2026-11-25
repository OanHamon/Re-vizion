// Éléments de décor réutilisables par les cartes : immeubles, arbres, voitures, caisses, lampadaires…
// Chaque fonction dessine le décor et, quand l'objet doit bloquer, ses collisions.
import { hash, pick, speckle, VPM, type MapBuilder, type Paint } from './mapDsl.ts';

export type Side = 'n' | 's' | 'e' | 'w';

// ---------- immeubles ----------

export interface BuildingOptions {
  x0: number;
  z0: number;
  x1: number;
  z1: number;
  /** Hauteur des murs, en mètres. */
  h: number;
  wall: readonly string[];
  trim: string;
  seed: number;
  /** Couleurs communes (vitres, encadrements…). */
  palette: BuildingPalette;
  /** Toit à deux pans (sinon toit plat avec acrotère). */
  gable?: boolean;
  /** Toit accessible : acrotère bas qui bloque, pas d'objets encombrants. */
  roofAccess?: boolean;
  /** Vitrine et store au rez-de-chaussée sur ce côté. */
  shop?: { side: Side; awning: readonly [string, string] };
  /** Porte au rez-de-chaussée sur ce côté. */
  door?: Side;
  /** Faces sans fenêtres (murs aveugles, contre un voisin). */
  blind?: readonly Side[];
  /** Collision (faux pour le décor hors de la zone de jeu). */
  collide?: boolean;
  /** Balcons sur une partie des fenêtres. */
  balconies?: boolean;
}

export interface BuildingPalette {
  glass: readonly string[];
  curtains: readonly string[];
  frame: string;
  plinth: readonly string[];
  roof: readonly string[];
  tiles: readonly string[];
  door: string;
  metal: string;
  flowers: readonly string[];
  leaves: readonly string[];
}

const FLOOR = 12; // voxels par étage (3 m)
const WIN_PERIOD = 10; // une fenêtre tous les 2,5 m

export function building(m: MapBuilder, o: BuildingOptions): void {
  const p = o.palette;
  const ix0 = m.vx(o.x0);
  const ix1 = m.vx(o.x1);
  const iz0 = m.vz(o.z0);
  const iz1 = m.vz(o.z1);
  const iy0 = m.vy(0);
  const iy1 = m.vy(o.h);
  const w = ix1 - ix0;
  const d = iz1 - iz0;
  const hv = iy1 - iy0;

  // murs : enduit nuancé, soubassement plus foncé
  m.vfill(ix0, iy0, iz0, ix1, iy1, iz1, ({ ix, iy, iz, ly }) => (ly < 3 ? pick(p.plinth, hash(ix, iy, iz, o.seed)) : pick(o.wall, hash(ix >> 1, iy, iz >> 1, o.seed))), { shell: 2 });
  if (o.collide !== false) m.collide(o.x0, 0, o.z0, o.x1, o.h, o.z1);

  // accès aux faces : a = position le long de la face, depth = 0 en surface, −1 dehors
  const faces: { side: Side; len: number; at: (a: number, ly: number, depth: number) => [number, number, number] }[] = [
    { side: 'n', len: w, at: (a, ly, dp) => [ix0 + a, iy0 + ly, iz0 + dp] },
    { side: 's', len: w, at: (a, ly, dp) => [ix1 - 1 - a, iy0 + ly, iz1 - 1 - dp] },
    { side: 'w', len: d, at: (a, ly, dp) => [ix0 + dp, iy0 + ly, iz1 - 1 - a] },
    { side: 'e', len: d, at: (a, ly, dp) => [ix1 - 1 - dp, iy0 + ly, iz0 + a] },
  ];
  const floors = Math.floor(hv / FLOOR);

  for (const f of faces) {
    const set = (a: number, ly: number, dp: number, c: string | null) => {
      const [x, y, z] = f.at(a, ly, dp);
      m.vox(x, y, z, c);
    };
    // corniche à chaque étage (débord d'un voxel)
    for (let fl = 1; fl <= floors; fl++) {
      const ly = fl * FLOOR - 1;
      if (ly >= hv - 1) continue;
      for (let a = -1; a <= f.len; a++) set(a, ly, -1, o.trim);
    }
    if (o.blind?.includes(f.side)) continue;
    const slots = Math.floor((f.len - 4) / WIN_PERIOD);
    const offset = Math.floor((f.len - slots * WIN_PERIOD) / 2);
    const shopHere = o.shop?.side === f.side;
    const doorHere = o.door === f.side;

    for (let fl = 0; fl < floors; fl++) {
      if (fl === 0 && (shopHere || doorHere)) continue;
      for (let sIdx = 0; sIdx < slots; sIdx++) {
        const a0 = offset + sIdx * WIN_PERIOD + 2;
        const ly0 = fl * FLOOR + 3;
        const ww = 6;
        const wh = 7;
        const id = hash(sIdx, fl, f.side.charCodeAt(0), o.seed);
        // cadre, vitre en retrait d'un voxel, rideau parfois
        for (let a = 0; a < ww; a++)
          for (let y = 0; y < wh; y++) {
            const edge = a === 0 || a === ww - 1 || y === 0 || y === wh - 1;
            if (edge) {
              set(a0 + a, ly0 + y, 0, p.frame);
              continue;
            }
            set(a0 + a, ly0 + y, 0, null);
            const curtain = id < 0.35 && (a === 1 || a === ww - 2) && y > 1;
            const shine = a + y === 3 || a + y === 4;
            set(a0 + a, ly0 + y, 1, curtain ? pick(p.curtains, id * 3 % 1) : shine ? p.glass[p.glass.length - 1]! : pick(p.glass, hash(a, y, sIdx, o.seed)));
          }
        // croisillon
        for (let y = 1; y < wh - 1; y++) set(a0 + 3, ly0 + y, 1, p.frame);
        // appui de fenêtre
        for (let a = -1; a <= ww; a++) set(a0 + a, ly0 - 1, -1, p.frame);
        // jardinière fleurie
        if (id > 0.7 && fl > 0) {
          for (let a = 0; a < ww; a++) {
            set(a0 + a, ly0, -1, p.metal);
            set(a0 + a, ly0 + 1, -1, hash(a, fl, sIdx, o.seed + 1) < 0.5 ? pick(p.flowers, hash(a, sIdx, fl, o.seed)) : pick(p.leaves, hash(sIdx, a, fl, o.seed)));
          }
        }
        // balcon
        if (o.balconies && fl > 0 && id > 0.45 && id < 0.7) {
          for (let a = -2; a <= ww + 1; a++)
            for (let dp = -3; dp <= -1; dp++) set(a0 + a, ly0 - 2, dp, p.frame);
          for (let a = -2; a <= ww + 1; a++) {
            set(a0 + a, ly0 + 2, -3, p.metal);
            if ((a & 1) === 0) set(a0 + a, ly0, -3, p.metal), set(a0 + a, ly0 + 1, -3, p.metal);
          }
          for (const a of [-2, ww + 1]) for (const dp of [-2, -1]) set(a0 + a, ly0 + 2, dp, p.metal);
          // pot de fleurs
          set(a0 - 1, ly0 - 1, -2, p.metal);
          set(a0 - 1, ly0, -2, pick(p.leaves, id));
          set(a0 - 1, ly0 + 1, -2, pick(p.flowers, id));
        }
      }
    }

    // rez-de-chaussée : porte ou vitrine
    if (doorHere || shopHere) {
      const mid = Math.floor(f.len / 2);
      if (doorHere) {
        for (let a = -3; a <= 2; a++)
          for (let y = 0; y < 10; y++) {
            const edge = a === -3 || a === 2 || y === 9;
            set(mid + a, y, 0, edge ? p.frame : null);
            if (!edge) set(mid + a, y, 1, y === 5 && a === 1 ? p.metal : p.door);
          }
        // petit auvent
        for (let a = -4; a <= 3; a++) for (let dp = -3; dp <= -1; dp++) set(mid + a, 10, dp, p.frame);
      }
      if (shopHere && o.shop) {
        const [sa, sb] = o.shop.awning;
        for (let a = 3; a < f.len - 3; a++)
          for (let y = 1; y < 9; y++) {
            const edge = a === 3 || a === f.len - 4 || y === 1 || y === 8 || (a - 3) % 8 === 0;
            set(a, y, 0, edge ? p.frame : null);
            if (!edge) set(a, y, 1, y > 5 ? p.glass[0]! : pick(p.curtains, hash(a >> 2, 0, 0, o.seed)));
          }
        // store rayé en pente
        for (let a = 2; a < f.len - 2; a++)
          for (let k = 0; k < 5; k++) set(a, 11 - (k >> 1), -1 - k, ((a >> 1) & 1) === 0 ? sa : sb);
        // enseigne
        for (let a = Math.floor(f.len / 2) - 6; a < Math.floor(f.len / 2) + 6; a++) for (let y = 12; y < 14; y++) set(a, y, -1, a % 3 === 0 ? sb : sa);
      }
    }
  }

  // toit
  const roofY = iy1;
  if (o.gable) {
    const alongX = w >= d;
    const span = alongX ? d : w;
    for (let k = 0; k * 2 < span + 2; k++) {
      const y = roofY + Math.floor(k / 1);
      if (y >= m.model.sy) break;
      for (let a = -1; a <= (alongX ? w : d); a++) {
        for (const s of [-1 + k, span - k]) {
          const c = pick(p.tiles, ((y + (a >> 1)) & 1) * 0.5 + hash(a, y, s, o.seed) * 0.49);
          if (alongX) m.vox(ix0 + a, y, iz0 + s, c);
          else m.vox(ix0 + s, y, iz0 + a, c);
        }
        // pignons : seulement les deux murs d'extrémité (l'intérieur reste vide)
        const len = alongX ? w : d;
        if (a !== 0 && a !== len - 1) continue;
        for (let s = k; s < span - k; s++) {
          const c = pick(o.wall, hash(a, y, s, o.seed));
          if (alongX) m.vox(ix0 + a, y, iz0 + s, c);
          else m.vox(ix0 + s, y, iz0 + a, c);
        }
      }
    }
    // cheminée
    const cx = ix0 + Math.floor(w * (0.25 + 0.5 * hash(1, 2, 3, o.seed)));
    const cz = iz0 + Math.floor(d * 0.3);
    m.vfill(cx, roofY, cz, cx + 3, roofY + Math.floor(span / 2) + 4, cz + 3, ({ ix: _x, iy: _y, iz: _z, ly, h }) => (ly >= h - 1 ? o.trim : pick(p.plinth, hash(_x, _y, _z))));
    return;
  }
  // toit plat : surface, acrotère, objets
  m.vfill(ix0 + 2, roofY - 1, iz0 + 2, ix1 - 2, roofY, iz1 - 2, speckle(p.roof, o.seed));
  m.vfill(ix0, roofY, iz0, ix1, roofY + 2, iz1, ({ ix: _x, iy: _y, iz: _z, ly }) => (ly === 1 ? o.trim : pick(o.wall, hash(_x, _y, _z, o.seed))), { shell: 1 });
  m.vfill(ix0 + 1, roofY, iz0 + 1, ix1 - 1, roofY + 2, iz1 - 1, null);
  if (o.roofAccess) {
    const t = 1 / VPM;
    const top = o.h + 2 / VPM;
    m.collide(o.x0, o.h, o.z0, o.x1, top, o.z0 + t);
    m.collide(o.x0, o.h, o.z1 - t, o.x1, top, o.z1);
    m.collide(o.x0, o.h, o.z0 + t, o.x0 + t, top, o.z1 - t);
    m.collide(o.x1 - t, o.h, o.z0 + t, o.x1, top, o.z1 - t);
    return;
  }
  // climatiseurs et château d'eau sur les toits inaccessibles
  const r = hash(4, 5, 6, o.seed);
  const ax = ix0 + 4 + Math.floor((w - 12) * r);
  const az = iz0 + 4 + Math.floor((d - 12) * hash(7, 8, 9, o.seed));
  m.vfill(ax, roofY, az, ax + 5, roofY + 3, az + 4, ({ lx, ly }) => (ly === 2 || lx === 0 ? p.frame : p.metal));
  if (r > 0.5 && w > 20 && d > 20) {
    const tx = ix0 + Math.floor(w * 0.6);
    const tz = iz0 + Math.floor(d * 0.55);
    for (const [lx, lz] of [[0, 0], [5, 0], [0, 5], [5, 5]] as const) m.vfill(tx + lx, roofY, tz + lz, tx + lx + 1, roofY + 6, tz + lz + 1, p.metal);
    m.vfill(tx - 1, roofY + 6, tz - 1, tx + 7, roofY + 12, tz + 7, ({ lx, ly }) => (ly === 5 ? p.metal : (lx & 1) === 0 ? p.door : p.plinth[0]!));
  }
}

// ---------- nature ----------

export interface TreeOptions {
  trunk: readonly string[];
  leaves: readonly string[];
  /** Hauteur du tronc avant le feuillage. */
  height: number;
  /** Rayon du feuillage. */
  crown: number;
  seed: number;
  /** Hauteur du sol au pied de l'arbre. */
  base?: number;
  collide?: boolean;
  /** Feuillage en sapin (étages coniques) plutôt qu'en boule. */
  pine?: boolean;
}

export function tree(m: MapBuilder, x: number, z: number, o: TreeOptions): void {
  const base = o.base ?? 0;
  const top = base + o.height;
  m.cylinder(x, z, 0.32, base, top + o.crown * 0.4, ({ ix, iy, iz }) => pick(o.trunk, hash(ix, iy >> 1, iz, o.seed)));
  // racines
  for (const [dx, dz] of [[0.4, 0], [-0.4, 0], [0, 0.4], [0, -0.4]] as const) m.fill(x + dx - 0.125, base, z + dz - 0.125, x + dx + 0.125, base + 0.25, z + dz + 0.125, o.trunk[0]!);
  if (o.collide !== false) m.collide(x - 0.3, base, z - 0.3, x + 0.3, top, z + 0.3);
  const leaf: Paint = ({ ix, iy, iz }) => pick(o.leaves, Math.min(0.999, hash(ix >> 1, iy >> 1, iz >> 1, o.seed) * 0.7 + (m.my(iy) - top) / (o.crown * 4) + 0.15));
  if (o.pine) {
    for (let k = 0; k < 4; k++) {
      const r = o.crown * (1 - k * 0.22);
      m.blob(x, top + k * o.crown * 0.55, z, r, o.crown * 0.35, r, leaf, 0.2, o.seed + k);
    }
    return;
  }
  m.blob(x, top + o.crown * 0.55, z, o.crown, o.crown * 0.8, o.crown, leaf, 0.3, o.seed);
  const s = o.crown * 0.55;
  m.blob(x + s * (hash(1, 0, 0, o.seed) - 0.5) * 2, top + o.crown * 0.2, z + s * (hash(0, 0, 1, o.seed) - 0.5) * 2, o.crown * 0.75, o.crown * 0.6, o.crown * 0.75, leaf, 0.3, o.seed + 1);
  m.blob(x, top + o.crown * 1.15, z, o.crown * 0.6, o.crown * 0.5, o.crown * 0.6, leaf, 0.3, o.seed + 2);
}

/** Rocher bosselé ; collision par une boîte un peu plus petite que le volume. */
export function rock(m: MapBuilder, x: number, z: number, rx: number, ry: number, rz: number, colors: readonly string[], moss: readonly string[] | null, seed: number, base = 0, collide = true): void {
  m.blob(x, base + ry * 0.35, z, rx, ry, rz, ({ ix, iy, iz }) => {
    const isTop = m.get(ix, iy + 1, iz) === 0 && moss !== null && hash(ix, iy, iz, seed) < 0.75 && m.my(iy) > base + ry * 0.6;
    return isTop ? pick(moss!, hash(iz, ix, iy, seed)) : pick(colors, hash(ix >> 1, iy, iz >> 1, seed));
  }, 0.3, seed);
  if (collide) m.collide(x - rx * 0.75, base, z - rz * 0.75, x + rx * 0.75, base + ry * 1.2, z + rz * 0.75);
}

/** Touffes et fleurs posées sur les cases d'herbe en surface d'une zone (décor). */
export function scatterFlowers(m: MapBuilder, x0: number, z0: number, x1: number, z1: number, isGround: (hex: string) => boolean, flowers: readonly string[], density: number, seed: number): void {
  for (let iz = m.vz(z0); iz < m.vz(z1); iz++)
    for (let ix = m.vx(x0); ix < m.vx(x1); ix++) {
      const r = hash(ix, 7, iz, seed);
      if (r > density) continue;
      // case de surface la plus haute
      let iy = m.model.sy - 2;
      while (iy > 0 && m.get(ix, iy, iz) === 0) iy--;
      const top = m.colorAt(ix, iy, iz);
      if (!top || !isGround(top) || m.get(ix, iy + 1, iz) !== 0) continue;
      m.vox(ix, iy + 1, iz, pick(flowers, hash(ix, iy, iz, seed + 3)));
    }
}

// ---------- ville ----------

export interface CarPalette {
  body: string;
  bodyDark: string;
  glass: string;
  wheel: string;
  hub: string;
  lightFront: string;
  lightBack: string;
}

/** Voiture (4 m × 1,8 m) orientée le long de x ou de z. Collision 1,5 m de haut. */
export function car(m: MapBuilder, x: number, z: number, alongX: boolean, c: CarPalette): void {
  const L = 4;
  const W = 1.8;
  const [hx, hz] = alongX ? [L / 2, W / 2] : [W / 2, L / 2];
  const ix0 = m.vx(x - hx);
  const iz0 = m.vz(z - hz);
  const lenV = L * VPM;
  const widV = W * VPM;
  const y0 = m.vy(0);
  // (u le long de la voiture, v en travers)
  const put = (u: number, y: number, v: number, col: string | null) => (alongX ? m.vox(ix0 + u, y0 + y, iz0 + v, col) : m.vox(ix0 + v, y0 + y, iz0 + u, col));
  for (let u = 0; u < lenV; u++)
    for (let v = 0; v < widV; v++) {
      const edgeU = u === 0 || u === lenV - 1;
      const edgeV = v === 0 || v === widV - 1;
      for (let y = 1; y < 4; y++) {
        if (edgeU && edgeV) continue;
        if (y === 3 && (edgeU || edgeV)) continue;
        const lamp = edgeU && y === 2 && (v === 1 || v === widV - 2);
        put(u, y, v, lamp ? (u === 0 ? c.lightBack : c.lightFront) : y === 1 ? c.bodyDark : c.body);
      }
      // habitacle
      if (u >= 4 && u < lenV - 5 && v >= 1 && v < widV - 1) {
        for (let y = 4; y < 6; y++) {
          const side = v === 1 || v === widV - 2 || u === 4 || u === lenV - 6;
          put(u, y, v, side && !(u === 8 && y === 4) ? c.glass : c.body);
        }
        put(u, 6, v, c.body);
      }
    }
  // roues
  for (const u of [2, 3, lenV - 4, lenV - 3])
    for (const v of [-0, widV - 1]) {
      put(u, 0, v, c.wheel);
      put(u, 1, v, u === 2 || u === lenV - 4 ? c.hub : c.wheel);
    }
  m.collide(x - hx, 0, z - hz, x + hx, 1.5, z + hz);
}

/** Caisse en bois de `s` mètres, planches et coins foncés. */
export function crate(m: MapBuilder, x: number, z: number, s: number, wood: readonly string[], dark: string, base = 0, collide = true): void {
  const paint: Paint = ({ ix, iy, iz, lx, ly, lz, w, h, d }) => {
    const ex = lx === 0 || lx === w - 1;
    const ey = ly === 0 || ly === h - 1;
    const ez = lz === 0 || lz === d - 1;
    if ((ex && ey) || (ey && ez) || (ex && ez)) return dark;
    return pick(wood, hash(ix, iy >> 1, iz, 5));
  };
  if (collide) m.solid(x - s / 2, base, z - s / 2, x + s / 2, base + s, z + s / 2, paint);
  else m.fill(x - s / 2, base, z - s / 2, x + s / 2, base + s, z + s / 2, paint);
}

/** Lampadaire (décor) : mât fin, lanterne lumineuse. */
export function lamp(m: MapBuilder, x: number, z: number, metal: string, glow: string, base = 0, height = 3.5): void {
  const ix = m.vx(x);
  const iz = m.vz(z);
  const y0 = m.vy(base);
  const y1 = m.vy(base + height);
  m.vfill(ix - 1, y0, iz - 1, ix + 1, y0 + 2, iz + 1, metal);
  m.vfill(ix, y0, iz, ix + 1, y1, iz + 1, metal);
  m.vfill(ix - 1, y1, iz - 1, ix + 2, y1 + 2, iz + 2, m.light(glow));
  m.vfill(ix - 1, y1 + 2, iz - 1, ix + 2, y1 + 3, iz + 2, metal);
}
