// Contrôles des armes voxel : modèles générés par scripts/voxels et entrées du catalogue d'assets.
import { describe, expect, it } from 'vitest';
import { getVoxel } from '../src/core/voxel/voxelModel';
import { PALETTE, WEAPONS } from '../scripts/voxels/weapons';
import { insidePolygon, VoxelBuilder } from '../scripts/voxels/dsl';
import { connectedCount, loadConfig } from './helpers';

const config = loadConfig();
// Liste des .vox présents sur le disque (sans les lire).
const voxFiles = Object.keys(import.meta.glob('../assets/**/*.vox'));

describe('armes voxel', () => {
  for (const [id, build] of Object.entries(WEAPONS)) {
    describe(id, () => {
      const { model } = build();
      const asset = config.assets.assets[`weapon.${id}`];

      it('est d’un seul tenant (aucun voxel flottant)', () => {
        const { connected, total } = connectedCount(model);
        expect(connected).toBe(total);
      });

      it('a le niveau de détail visé et des pièces lumineuses', () => {
        expect(model.sx).toBeGreaterThanOrEqual(30);
        let glow = 0;
        const glowIndex = [...model.palette].indexOf(parseInt(PALETTE.glow.slice(1), 16));
        for (const v of model.data) if (v === glowIndex) glow++;
        expect(glow).toBeGreaterThan(0);
      });

      it('a une entrée voxel dans le catalogue, avec un fichier présent et une prise en main dans le modèle', () => {
        expect(asset?.voxel).toBeDefined();
        expect(voxFiles).toContain(`../assets/${asset!.voxel!.path}`);
        const [gx, gy, gz] = asset!.grip;
        expect(gx).toBeGreaterThanOrEqual(0);
        expect(gx).toBeLessThanOrEqual(model.sx);
        expect(gy).toBeLessThanOrEqual(model.sy);
        expect(gz).toBeLessThanOrEqual(model.sz);
        expect(asset!.voxel!.glow).toContain(PALETTE.glow);
      });
    });
  }
});

describe('langage de modélisation', () => {
  it('remplit un profil polygonal extrudé', () => {
    const b = new VoxelBuilder(10, 10, 5).profile([[0, 0], [4, 0], [4, 2], [0, 2]], 3, '#ffffff');
    expect(getVoxel(b.model, 3, 1, 2)).not.toBe(0);
    expect(getVoxel(b.model, 4, 1, 2)).toBe(0);
    expect(getVoxel(b.model, 1, 1, 0)).toBe(0);
    expect(insidePolygon(1, 1, [[0, 0], [2, 0], [2, 2], [0, 2]])).toBe(true);
  });

  it('creuse la surface sur la profondeur demandée et colore le fond', () => {
    const b = new VoxelBuilder(4, 4, 7).slab(0, 0, 3, 3, 7, '#ffffff').engrave(1, 1, 1, 1, 2, '#000000', 'front');
    expect(getVoxel(b.model, 1, 1, 6)).toBe(0);
    expect(getVoxel(b.model, 1, 1, 5)).toBe(0);
    expect(b.model.palette[getVoxel(b.model, 1, 1, 4)]).toBe(0x000000);
    expect(getVoxel(b.model, 1, 1, 0)).not.toBe(0);
  });
});
