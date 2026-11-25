// Cartes jouables (lot 12) : choix de la carte par l'hôte, apparitions, accessibilité à pied, décor voxel.
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { CombatSession } from '../src/core/combat/combatSession';
import { overlaps, v3, worldFromArena, type Aabb, type World } from '../src/core/combat/geometry';
import type { Arena } from '../src/core/config/schemas';
import { checkSettings, defaultSettings, selectableArenas, settingsSummary } from '../src/core/match/settings';
import { readVox } from '../src/core/voxel/voxelModel';
import { loadConfig } from './helpers';

const config = loadConfig();
const { body, movement } = config.player;
const maps = selectableArenas(config);
const mostPlayers = Math.max(...config.modes.players.choices);

const bodyAt = (x: number, y: number, z: number): Aabb => ({
  min: v3(x - body.radius, y, z - body.radius),
  max: v3(x + body.radius, y + body.height, z + body.radius),
});
const free = (world: World, box: Aabb) => !world.blocks.some((b) => overlaps(box, b));

/** Hauteur max d'un saut (v² / 2g), moins une petite marge. */
const JUMP = (movement.jumpVelocity * movement.jumpVelocity) / (2 * movement.gravity) - 0.05;
const CELL = 0.5;

/**
 * Où peut-on se tenir dans une case ? Le sol et le dessus de chaque bloc qui couvre la case,
 * si le corps y tient sans toucher un autre bloc.
 */
function standLevels(world: World, x: number, z: number): number[] {
  const tops = [0];
  for (const b of world.blocks) if (x > b.min.x && x < b.max.x && z > b.min.z && z < b.max.z) tops.push(b.max.y);
  return [...new Set(tops)].filter((y) => {
    const covered = y === 0 || world.blocks.some((b) => x > b.min.x && x < b.max.x && z > b.min.z && z < b.max.z && Math.abs(b.max.y - y) < 1e-6);
    // le corps (plus large qu'une case) doit tenir quelque part autour du centre de la case
    const shifts = [0, 0.2, -0.2, 0.4, -0.4];
    const fits = shifts.some((dx) => shifts.some((dz) => free(world, bodyAt(x + dx, y + 1e-3, z + dz))));
    return covered && fits;
  });
}

/**
 * Parcours en largeur sur une grille de 50 cm : d'une case à sa voisine, on peut monter d'au plus un saut,
 * et descendre de n'importe quelle hauteur. Renvoie l'ensemble des positions (case, hauteur) atteintes.
 */
function reachable(arena: Arena, from: readonly [number, number, number]): Set<string> {
  const world = worldFromArena(arena);
  const [w, d] = arena.size;
  const nx = Math.floor(w / CELL);
  const nz = Math.floor(d / CELL);
  const cx = (i: number) => -w / 2 + (i + 0.5) * CELL;
  const cz = (j: number) => -d / 2 + (j + 0.5) * CELL;
  const levels = new Map<number, number[]>();
  const levelsAt = (i: number, j: number) => {
    const k = i + nx * j;
    let l = levels.get(k);
    if (!l) levels.set(k, (l = standLevels(world, cx(i), cz(j))));
    return l;
  };
  const start = [Math.floor((from[0] + w / 2) / CELL), Math.floor((from[2] + d / 2) / CELL)] as const;
  const startY = levelsAt(start[0], start[1]).reduce((best, y) => (Math.abs(y - from[1]) < Math.abs(best - from[1]) ? y : best), Infinity);
  const seen = new Set<string>([`${start[0]},${start[1]},${startY}`]);
  const queue: [number, number, number][] = [[start[0], start[1], startY]];
  while (queue.length > 0) {
    const [i, j, y] = queue.shift()!;
    for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
      const ni = i + di;
      const nj = j + dj;
      if (ni < 0 || nj < 0 || ni >= nx || nj >= nz) continue;
      for (const ny of levelsAt(ni, nj)) {
        if (ny - y > JUMP) continue;
        const key = `${ni},${nj},${ny}`;
        if (seen.has(key)) continue;
        seen.add(key);
        queue.push([ni, nj, ny]);
      }
    }
  }
  return seen;
}

describe('cartes jouables', () => {
  it('il y a plusieurs cartes au choix, dont une ville, une nature et un souterrain', () => {
    expect(maps.length).toBeGreaterThanOrEqual(4);
    expect(maps.map((a) => a.kind)).toEqual(expect.arrayContaining(['Ville', 'Nature', 'Souterrain']));
  });

  for (const arena of maps) {
    describe(arena.label, () => {
      const world = worldFromArena(arena);

      it(`a une apparition par joueur possible (${mostPlayers}), chacune libre et posée`, () => {
        expect(arena.spawns.length).toBeGreaterThanOrEqual(mostPlayers);
        for (const s of arena.spawns) {
          const [x, y, z] = s.position;
          expect(Math.abs(x)).toBeLessThan(arena.size[0] / 2 - body.radius);
          expect(Math.abs(z)).toBeLessThan(arena.size[1] / 2 - body.radius);
          expect(free(world, bodyAt(x, y + 1e-3, z)), `apparition (${x}, ${y}, ${z}) dans un bloc`).toBe(true);
          const supported = y === 0 || world.blocks.some((b) => Math.abs(b.max.y - y) < 1e-6 && x + body.radius > b.min.x && x - body.radius < b.max.x && z + body.radius > b.min.z && z - body.radius < b.max.z);
          expect(supported, `apparition (${x}, ${y}, ${z}) dans le vide`).toBe(true);
        }
      });

      it('chaque apparition est atteignable à pied depuis la première (marches et sauts)', () => {
        const seen = reachable(arena, arena.spawns[0]!.position);
        for (const s of arena.spawns) {
          const [x, y, z] = s.position;
          const i = Math.floor((x + arena.size[0] / 2) / CELL);
          const j = Math.floor((z + arena.size[1] / 2) / CELL);
          // la case de l'apparition ou une voisine, à la même hauteur (à une marche près : on peut se tenir au bord d'un bloc)
          const near = [...seen].some((k) => {
            const [a, b, c] = k.split(',').map(Number) as [number, number, number];
            return Math.abs(a - i) <= 1 && Math.abs(b - j) <= 1 && Math.abs(c - y) <= movement.stepHeight;
          });
          expect(near, `apparition (${x}, ${y}, ${z}) inaccessible`).toBe(true);
        }
      });

      it('a des coffres à grenades libres, posés, symétriques et atteignables à pied (lot 14)', () => {
        const chests = arena.chests ?? [];
        expect(chests.length).toBeGreaterThanOrEqual(2);
        const seen = reachable(arena, arena.spawns[0]!.position);
        for (const c of chests) {
          const [x, y, z] = c.position;
          // le coffre et la place pour se tenir devant
          const box = { min: v3(x - 0.5, y + 1e-3, z - 0.5), max: v3(x + 0.5, y + 0.7, z + 0.5) };
          expect(free(world, box), `coffre (${x}, ${y}, ${z}) dans un bloc`).toBe(true);
          const supported = y === 0 || world.blocks.some((b) => Math.abs(b.max.y - y) < 1e-6 && x > b.min.x && x < b.max.x && z > b.min.z && z < b.max.z);
          expect(supported, `coffre (${x}, ${y}, ${z}) dans le vide`).toBe(true);
          // un coffre de même hauteur à la position tournée de 180° (équité)
          expect(chests.some((o) => o.position[0] === -x && o.position[2] === -z && Math.abs(o.position[1] - y) < 1e-6), `coffre (${x}, ${z}) sans symétrique`).toBe(true);
          // on peut s'approcher à portée d'ouverture
          const i = Math.floor((x + arena.size[0] / 2) / CELL);
          const j = Math.floor((z + arena.size[1] / 2) / CELL);
          const near = [...seen].some((k) => {
            const [a, b, h] = k.split(',').map(Number) as [number, number, number];
            const d = Math.hypot((a - i) * CELL, (b - j) * CELL, h - y);
            return d <= config.pickups.chests.openRadius - 0.3;
          });
          expect(near, `coffre (${x}, ${y}, ${z}) inaccessible`).toBe(true);
        }
      });

      it('un combat démarre sur cette carte, à chaque apparition', () => {
        arena.spawns.forEach((s, spawnIndex) => {
          const session = new CombatSession({ config, modeId: 'duel', arenaId: arena.id, weaponId: 'pistol', entries: [], seed: 1, spawnIndex, networked: true });
          expect(session.arena.id).toBe(arena.id);
          for (let k = 0; k < 60; k++) session.step({ forward: 0, right: 0, jump: false, dash: false, fire: false, reload: false, aim: false, slot: null, yaw: 0, pitch: 0 }, 1 / 60);
          // posé sur place : ni chute à travers le sol, ni éjection
          expect(session.move.pos.y).toBeCloseTo(s.position[1], 3);
          expect(session.move.onGround).toBe(true);
        });
      });

      if (arena.decor) {
        it('son décor voxel existe dans le catalogue et sur le disque', () => {
          const def = config.assets.assets[arena.decor!];
          expect(def?.voxel).toBeDefined();
          const path = join(__dirname, '..', 'assets', def!.voxel!.path);
          expect(existsSync(path)).toBe(true);
          const model = readVox(new Uint8Array(readFileSync(path)).buffer);
          // le décor couvre la zone de jeu
          expect(model.sx * def!.voxel!.voxelSize).toBeGreaterThanOrEqual(arena.size[0]);
          expect(model.sz * def!.voxel!.voxelSize).toBeGreaterThanOrEqual(arena.size[1]);
        });
      }
    });
  }
});

describe('contrôle d’accessibilité', () => {
  it('repère une apparition perchée sur un pilier de 4 m', () => {
    const cubes = config.arenas.arenas.find((a) => a.id === 'duel')!;
    // pilier de Cubes : position (12, 0, 9), taille 2 × 4 × 2
    const seen = reachable(cubes, cubes.spawns[0]!.position);
    expect([...seen].some((k) => k.endsWith(',4'))).toBe(false);
    expect([...seen].some((k) => k.endsWith(',1'))).toBe(true);
  });

  it('les marches de 0,5 m se montent sans sauter, pas celles de 1 m', () => {
    expect(movement.stepHeight).toBeGreaterThanOrEqual(0.5);
    expect(movement.stepHeight).toBeLessThan(1);
  });
});

describe('choix de la carte dans le salon', () => {
  it('par défaut, la carte du mode', () => {
    const duel = config.modes.modes.find((m) => m.id === 'duel')!;
    expect(defaultSettings(config, 'duel').arenaId).toBe(duel.arena);
  });

  it('accepte toute carte jouable et l’affiche dans le résumé', () => {
    for (const arena of maps) {
      const result = checkSettings(config, { ...defaultSettings(config, 'chrono'), arenaId: arena.id });
      expect(result.ok && result.settings.arenaId).toBe(arena.id);
      expect(settingsSummary(config, { ...defaultSettings(config), arenaId: arena.id })).toContain(arena.label);
    }
  });

  it('refuse une carte inconnue ou non jouable (stand de tir)', () => {
    expect(checkSettings(config, { ...defaultSettings(config), arenaId: 'atlantide' })).toMatchObject({ ok: false });
    expect(checkSettings(config, { ...defaultSettings(config), arenaId: 'training' })).toMatchObject({ ok: false });
  });

  it('la config refuse une carte jouable sans assez d’apparitions', async () => {
    const { parseGameConfig } = await import('../src/core/config/gameConfig');
    const { rawConfig } = await import('./helpers');
    const raw = rawConfig() as unknown as { arenas: { arenas: { id: string; spawns: unknown[] }[] } };
    raw.arenas.arenas.find((a) => a.id === 'city')!.spawns.length = 2;
    const result = parseGameConfig(raw as never);
    expect(result.ok).toBe(false);
    expect(!result.ok && result.errors.join('\n')).toContain('city');
  });
});
