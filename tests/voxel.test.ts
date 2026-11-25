import { describe, expect, it } from 'vitest';
import { meshVoxels } from '../src/core/voxel/mesher';
import { countVoxels, createVoxelModel, getVoxel, readVox, setVoxel, writeVox } from '../src/core/voxel/voxelModel';

function model(cells: [number, number, number, number][], size: [number, number, number] = [4, 4, 4]) {
  const m = createVoxelModel(...size);
  m.palette[1] = 0x808080;
  m.palette[2] = 0x5fe3f2;
  for (const [x, y, z, c] of cells) setVoxel(m, x, y, z, c);
  return m;
}

const faces = (indices: Uint32Array) => indices.length / 6;

describe('format .vox', () => {
  it('aller-retour écriture / lecture sans perte (taille, voxels, palette)', () => {
    const m = model([[0, 0, 0, 1], [3, 1, 2, 2], [1, 3, 0, 1]], [4, 5, 3]);
    const back = readVox(writeVox(m));
    expect([back.sx, back.sy, back.sz]).toEqual([4, 5, 3]);
    expect(countVoxels(back)).toBe(3);
    expect(getVoxel(back, 3, 1, 2)).toBe(2);
    expect(getVoxel(back, 1, 3, 0)).toBe(1);
    expect(back.palette[2]).toBe(0x5fe3f2);
  });

  it('écrit un en-tête MagicaVoxel valide', () => {
    const bytes = writeVox(model([[0, 0, 0, 1]]));
    expect(String.fromCharCode(...bytes.slice(0, 4))).toBe('VOX ');
    expect(String.fromCharCode(...bytes.slice(8, 12))).toBe('MAIN');
  });

  it('refuse un fichier qui n’est pas un .vox', () => {
    expect(() => readVox(new Uint8Array(40))).toThrow(/en-tête/);
  });

  it('refuse une taille hors limites', () => {
    expect(() => createVoxelModel(0, 1, 1)).toThrow();
    expect(() => createVoxelModel(1, 257, 1)).toThrow();
  });
});

describe('mailleur voxel', () => {
  it('un voxel seul = 6 faces', () => {
    const { solid, glow } = meshVoxels(model([[1, 1, 1, 1]]));
    expect(faces(solid.indices)).toBe(6);
    expect(solid.positions.length).toBe(6 * 4 * 3);
    expect(faces(glow.indices)).toBe(0);
  });

  it('les faces collées entre deux voxels ne sont pas émises', () => {
    const { solid } = meshVoxels(model([[1, 1, 1, 1], [2, 1, 1, 1]]));
    expect(faces(solid.indices)).toBe(10);
  });

  it('les voxels lumineux vont dans le maillage à part, sans occlusion', () => {
    const { solid, glow } = meshVoxels(model([[1, 1, 1, 1], [2, 1, 1, 2]]), { glowColors: new Set([0x5fe3f2]) });
    expect(faces(solid.indices)).toBe(5);
    expect(faces(glow.indices)).toBe(5);
    expect(Math.min(...glow.colors)).toBeGreaterThan(0.1);
  });

  it('assombrit les coins creux (occlusion ambiante)', () => {
    // un sol 3×3 et un voxel posé au milieu : le dessus du sol est plus sombre au pied du voxel
    const cells: [number, number, number, number][] = [];
    for (let x = 0; x < 3; x++) for (let z = 0; z < 3; z++) cells.push([x, 0, z, 1]);
    cells.push([1, 1, 1, 1]);
    const { solid } = meshVoxels(model(cells));
    const grey = (0x80 / 255 + 0.055) / 1.055;
    const full = Math.pow(grey, 2.4);
    const reds = [];
    for (let i = 0; i < solid.colors.length; i += 3) reds.push(solid.colors[i]!);
    expect(Math.max(...reds)).toBeCloseTo(full, 5);
    expect(Math.min(...reds)).toBeLessThan(full * 0.9);
  });

  it('les normales sont unitaires et alignées sur un axe', () => {
    const { solid } = meshVoxels(model([[0, 0, 0, 1]]));
    for (let i = 0; i < solid.normals.length; i += 3) {
      const n = [solid.normals[i]!, solid.normals[i + 1]!, solid.normals[i + 2]!];
      expect(n.reduce((s, v) => s + Math.abs(v), 0)).toBe(1);
    }
  });
});
