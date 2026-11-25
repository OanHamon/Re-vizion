// Contrôles des personnages voxel : modèles générés par scripts/voxels, parties animées et catalogue.
import { describe, expect, it } from 'vitest';
import { getVoxel, createVoxelModel, setVoxel, countVoxels } from '../src/core/voxel/voxelModel';
import { BODY_PART, recolorPalette, splitParts } from '../src/core/voxel/parts';
import { CHARACTERS, TINT, TINT_DARK } from '../scripts/voxels/characters';
import { parseGameConfig } from '../src/core/config/gameConfig';
import { connectedCount, loadConfig, rawConfig } from './helpers';

const config = loadConfig();
const voxFiles = Object.keys(import.meta.glob('../assets/**/*.vox'));
const hex = (s: string) => parseInt(s.slice(1), 16);

describe('personnages voxel', () => {
  it('le joueur a au moins un personnage, et chacun existe dans le générateur', () => {
    expect(config.player.characters.length).toBeGreaterThan(0);
    for (const id of config.player.characters) expect(Object.keys(CHARACTERS)).toContain(id.replace('character.', ''));
  });

  for (const [name, build] of Object.entries(CHARACTERS)) {
    describe(name, () => {
      const { model } = build();
      const asset = config.assets.assets[`character.${name}`]!;
      const voxelSize = asset.voxel!.voxelSize;
      const { height, headHeight, radius } = config.player.body;

      it('a une entrée voxel dans le catalogue, avec le fichier, la couleur du joueur et des parties animées', () => {
        expect(asset.voxel).toBeDefined();
        expect(voxFiles).toContain(`../assets/${asset.voxel!.path}`);
        expect(asset.voxel!.tint).toEqual([TINT, TINT_DARK]);
        expect(Object.keys(asset.parts ?? {})).toEqual(expect.arrayContaining(['head', 'arm_r', 'arm_l', 'leg_r', 'leg_l']));
      });

      it('est d’un seul tenant (aucun voxel flottant)', () => {
        const { connected, total } = connectedCount(model);
        expect(connected).toBe(total);
      });

      it('a la taille de la hitbox : 1,80 m de haut (à 3 voxels près), pas plus large que le corps', () => {
        let top = 0;
        let minX = model.sx;
        let maxX = 0;
        for (let z = 0; z < model.sz; z++)
          for (let y = 0; y < model.sy; y++)
            for (let x = 0; x < model.sx; x++)
              if (getVoxel(model, x, y, z)) {
                top = Math.max(top, y + 1);
                minX = Math.min(minX, x);
                maxX = Math.max(maxX, x + 1);
              }
        expect(Math.abs(top * voxelSize - height)).toBeLessThanOrEqual(3 * voxelSize);
        expect((maxX - minX) * voxelSize).toBeLessThanOrEqual(radius * 2 + 0.001);
      });

      it('la tête commence au bas de la zone « tête » de la hitbox', () => {
        const neck = asset.parts!.head!.pivot[1]! * voxelSize;
        expect(Math.abs(neck - (height - headHeight))).toBeLessThanOrEqual(0.1);
      });

      it('les pieds sont posés au sol, au centre de la prise en main', () => {
        const [gx, gy, gz] = asset.grip;
        expect(gy).toBe(0);
        expect(gx).toBeCloseTo(model.sx / 2, 0);
        expect(gz).toBeGreaterThan(0);
        expect(gz).toBeLessThan(model.sz);
      });

      it('chaque partie animée est non vide et d’un seul tenant', () => {
        const parts = splitParts(model, asset.parts!);
        for (const part of [...Object.keys(asset.parts!), BODY_PART]) {
          const m = parts.get(part);
          expect(m, part).toBeDefined();
          const { connected, total } = connectedCount(m!);
          expect(connected, part).toBe(total);
        }
      });

      it('porte les couleurs remplacées par celle du joueur', () => {
        const used = new Set<number>();
        for (const v of model.data) if (v) used.add(model.palette[v]!);
        expect(used.has(hex(TINT))).toBe(true);
        expect(used.has(hex(TINT_DARK))).toBe(true);
      });
    });
  }

  it('refuse un personnage absent du catalogue', () => {
    const raw = rawConfig() as { player: { characters: string[] } };
    raw.player.characters = ['character.inconnu'];
    const result = parseGameConfig(raw as never);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors.join('\n')).toContain('characters[0]');
  });
});

describe('découpage en parties et recoloration', () => {
  it('range chaque voxel dans la première boîte qui le contient, le reste dans le tronc', () => {
    const m = createVoxelModel(4, 4, 1);
    setVoxel(m, 0, 0, 0, 1);
    setVoxel(m, 1, 1, 0, 1);
    setVoxel(m, 3, 3, 0, 1);
    const parts = splitParts(m, {
      a: { min: [0, 0, 0], max: [1, 1, 0] },
      b: { min: [1, 1, 0], max: [3, 3, 0] },
    });
    expect(countVoxels(parts.get('a')!)).toBe(2);
    expect(countVoxels(parts.get('b')!)).toBe(1);
    expect(parts.has(BODY_PART)).toBe(false);
    const rest = splitParts(m, { a: { min: [0, 0, 0], max: [0, 0, 0] } });
    expect(countVoxels(rest.get(BODY_PART)!)).toBe(2);
  });

  it('remplace les couleurs demandées sans toucher au modèle d’origine', () => {
    const m = createVoxelModel(1, 1, 1);
    m.palette[1] = 0xff00ff;
    m.palette[2] = 0x123456;
    const r = recolorPalette(m, new Map([[0xff00ff, 0x8fb3f2]]));
    expect(r.palette[1]).toBe(0x8fb3f2);
    expect(r.palette[2]).toBe(0x123456);
    expect(m.palette[1]).toBe(0xff00ff);
  });
});
