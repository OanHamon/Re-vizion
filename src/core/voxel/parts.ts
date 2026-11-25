// Découpage d'un modèle voxel en parties animées, et recoloration de la palette.
// Pur TypeScript : testable sans navigateur.
import { createVoxelModel, type VoxelModel } from './voxelModel';

export interface PartBox {
  readonly min: readonly number[];
  readonly max: readonly number[];
}

/** Nom de la partie qui reçoit les voxels hors de toute boîte (le tronc). */
export const BODY_PART = 'body';

/**
 * Répartit les voxels dans les parties : un voxel va dans la première boîte qui le contient
 * (ordre des clés), sinon dans BODY_PART. Chaque partie garde la taille et la palette du modèle.
 */
export function splitParts(model: VoxelModel, parts: Readonly<Record<string, PartBox>>): Map<string, VoxelModel> {
  const names = Object.keys(parts);
  const out = new Map<string, VoxelModel>();
  const target = (name: string) => {
    let m = out.get(name);
    if (!m) {
      m = createVoxelModel(model.sx, model.sy, model.sz);
      m.palette.set(model.palette);
      out.set(name, m);
    }
    return m;
  };
  for (let z = 0; z < model.sz; z++)
    for (let y = 0; y < model.sy; y++)
      for (let x = 0; x < model.sx; x++) {
        const i = x + model.sx * (y + model.sy * z);
        const c = model.data[i]!;
        if (c === 0) continue;
        const name =
          names.find((n) => {
            const { min, max } = parts[n]!;
            return x >= min[0]! && x <= max[0]! && y >= min[1]! && y <= max[1]! && z >= min[2]! && z <= max[2]!;
          }) ?? BODY_PART;
        target(name).data[i] = c;
      }
  return out;
}

/** Copie du modèle dont les couleurs de la palette listées dans `replace` (0xRRGGBB → 0xRRGGBB) sont changées. */
export function recolorPalette(model: VoxelModel, replace: ReadonlyMap<number, number>): VoxelModel {
  const palette = new Uint32Array(model.palette);
  for (let i = 1; i < 256; i++) {
    const to = replace.get(palette[i]!);
    if (to !== undefined) palette[i] = to;
  }
  return { ...model, palette };
}
