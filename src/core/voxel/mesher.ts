// Mailleur voxel : transforme une grille en triangles prêts pour le rendu.
// - seules les faces visibles (voisin vide) sont émises ;
// - occlusion ambiante par sommet (les coins creux sont assombris), ce qui donne
//   du relief aux petits détails sans éclairage coûteux ;
// - les voxels « lumineux » (couleurs listées) vont dans un maillage à part, sans ombrage.
// Pur TypeScript : testable sans navigateur.
import { getVoxel, type VoxelModel } from './voxelModel';

export interface MeshData {
  positions: Float32Array;
  normals: Float32Array;
  /** Couleurs linéaires (prêtes pour un rendu en espace linéaire), occlusion incluse. */
  colors: Float32Array;
  indices: Uint32Array;
}

export interface VoxelMeshes {
  solid: MeshData;
  glow: MeshData;
}

export interface MeshOptions {
  /** Couleurs (0xRRGGBB) rendues lumineuses. */
  glowColors?: ReadonlySet<number>;
  /** Luminosité d'un sommet selon son nombre de voisins occultants (0 = coin le plus fermé). */
  aoLevels?: readonly [number, number, number, number];
  /** Ne maille que les colonnes x ∈ [x0, x1) et z ∈ [z0, z1) (gros modèles découpés en morceaux) ; les voisins restent lus partout. */
  region?: { x0: number; x1: number; z0: number; z1: number };
  /** Le dessous du modèle est plein (sol d'une carte) : pas de faces tournées vers le bas sous la couche y = 0. */
  closedBelow?: boolean;
}

const DEFAULT_AO: readonly [number, number, number, number] = [0.5, 0.68, 0.84, 1];

type Vec3 = readonly [number, number, number];

interface Face {
  n: Vec3;
  u: Vec3;
  v: Vec3;
  /** Le plan de la face est du côté + de l'axe (sinon côté 0). */
  positive: boolean;
}

// u × v = n : les coins (0,0) (1,0) (1,1) (0,1) tournent dans le sens trigonométrique vus de l'extérieur.
const FACES: readonly Face[] = [
  { n: [1, 0, 0], u: [0, 1, 0], v: [0, 0, 1], positive: true },
  { n: [-1, 0, 0], u: [0, 0, 1], v: [0, 1, 0], positive: false },
  { n: [0, 1, 0], u: [0, 0, 1], v: [1, 0, 0], positive: true },
  { n: [0, -1, 0], u: [1, 0, 0], v: [0, 0, 1], positive: false },
  { n: [0, 0, 1], u: [1, 0, 0], v: [0, 1, 0], positive: true },
  { n: [0, 0, -1], u: [0, 1, 0], v: [1, 0, 0], positive: false },
];

const CORNERS: readonly (readonly [number, number])[] = [
  [0, 0],
  [1, 0],
  [1, 1],
  [0, 1],
];

export function srgbToLinear(c: number): number {
  return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
}

class Builder {
  positions: number[] = [];
  normals: number[] = [];
  colors: number[] = [];
  indices: number[] = [];

  quad(corners: Vec3[], n: Vec3, rgb: Vec3, light: readonly number[], flip: boolean): void {
    const base = this.positions.length / 3;
    corners.forEach((p, i) => {
      this.positions.push(p[0], p[1], p[2]);
      this.normals.push(n[0], n[1], n[2]);
      const l = light[i] ?? 1;
      this.colors.push(rgb[0] * l, rgb[1] * l, rgb[2] * l);
    });
    // On coupe le quad selon la diagonale qui interpole le mieux l'occlusion.
    if (flip) this.indices.push(base + 1, base + 2, base + 3, base + 1, base + 3, base);
    else this.indices.push(base, base + 1, base + 2, base, base + 2, base + 3);
  }

  build(): MeshData {
    return {
      positions: new Float32Array(this.positions),
      normals: new Float32Array(this.normals),
      colors: new Float32Array(this.colors),
      indices: new Uint32Array(this.indices),
    };
  }
}

export function meshVoxels(m: VoxelModel, options: MeshOptions = {}): VoxelMeshes {
  const glowColors = options.glowColors ?? new Set<number>();
  const ao = options.aoLevels ?? DEFAULT_AO;
  const solid = new Builder();
  const glow = new Builder();
  const linear: Vec3[] = [];
  for (let i = 0; i < 256; i++) {
    const rgb = m.palette[i] ?? 0;
    linear.push([srgbToLinear(((rgb >> 16) & 0xff) / 255), srgbToLinear(((rgb >> 8) & 0xff) / 255), srgbToLinear((rgb & 0xff) / 255)]);
  }
  const closedBelow = options.closedBelow ?? false;
  const filled = (x: number, y: number, z: number) => (y < 0 ? closedBelow : getVoxel(m, x, y, z) !== 0);

  const r = options.region ?? { x0: 0, x1: m.sx, z0: 0, z1: m.sz };
  for (let z = Math.max(0, r.z0); z < Math.min(m.sz, r.z1); z++) {
    for (let y = 0; y < m.sy; y++) {
      for (let x = Math.max(0, r.x0); x < Math.min(m.sx, r.x1); x++) {
        const c = getVoxel(m, x, y, z);
        if (c === 0) continue;
        const isGlow = glowColors.has(m.palette[c] ?? -1);
        const rgb = linear[c]!;

        for (const f of FACES) {
          const bx = x + f.n[0];
          const by = y + f.n[1];
          const bz = z + f.n[2];
          if (filled(bx, by, bz)) continue;

          const ox = x + (f.positive ? f.n[0] : 0);
          const oy = y + (f.positive ? f.n[1] : 0);
          const oz = z + (f.positive ? f.n[2] : 0);
          const corners: Vec3[] = [];
          const light: number[] = [];
          for (const [cu, cv] of CORNERS) {
            corners.push([
              ox + cu * f.u[0] + cv * f.v[0],
              oy + cu * f.u[1] + cv * f.v[1],
              oz + cu * f.u[2] + cv * f.v[2],
            ]);
            if (isGlow) {
              light.push(1);
              continue;
            }
            // voisins dans la couche devant la face : deux côtés et le coin
            const su = cu ? 1 : -1;
            const sv = cv ? 1 : -1;
            const s1 = filled(bx + su * f.u[0], by + su * f.u[1], bz + su * f.u[2]) ? 1 : 0;
            const s2 = filled(bx + sv * f.v[0], by + sv * f.v[1], bz + sv * f.v[2]) ? 1 : 0;
            const cr = filled(bx + su * f.u[0] + sv * f.v[0], by + su * f.u[1] + sv * f.v[1], bz + su * f.u[2] + sv * f.v[2]) ? 1 : 0;
            const level = s1 && s2 ? 0 : 3 - (s1 + s2 + cr);
            light.push(ao[level] ?? 1);
          }
          const flip = (light[0]! + light[2]!) < (light[1]! + light[3]!);
          (isGlow ? glow : solid).quad(corners, f.n, rgb, light, flip);
        }
      }
    }
  }
  return { solid: solid.build(), glow: glow.build() };
}
