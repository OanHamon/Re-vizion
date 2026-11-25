// Lot 15 : destruction limitée du décor (matériaux, morceaux de 50 cm, balles et grenades).
import { describe, expect, it } from 'vitest';
import { CombatSession, IDLE_INPUT } from '../src/core/combat/combatSession';
import { Destructibles, distanceToBox } from '../src/core/combat/destruction';
import { raycastWorld, v3, worldFromArena, type World } from '../src/core/combat/geometry';
import { simulateGrenade, throwVelocity, blastFactor } from '../src/core/combat/grenade';
import { parseGameConfig } from '../src/core/config/gameConfig';
import type { Arena } from '../src/core/config/schemas';
import { MatchServer } from '../src/core/match/matchServer';
import type { ServerMessage } from '../src/core/match/protocol';
import { defaultSettings } from '../src/core/match/settings';
import { loadConfig, rawConfig, rawDeck } from './helpers';

const config = loadConfig();
const mat = (id: string) => config.materials.materials.find((m) => m.id === id)!;
const g = config.pickups.grenade;

/** Arène vide avec un mur cassable de 2 × 1 × 0,5 m centré en (0, 0, -3). */
function wallArena(material: string): Arena {
  return {
    id: 'test', label: 'Test', size: [20, 20], wallHeight: 10, spawns: [{ position: [0, 0, 0], yawDeg: 0 }],
    targetHealth: 100, targetRespawnSeconds: 1, blocks: [], targets: [],
    breakables: [{ material, position: [0, 0, -3], size: [2, 1, 0.5] }],
  };
}

function setup(material: string): { world: World; d: Destructibles } {
  const arena = wallArena(material);
  const world = worldFromArena(arena);
  return { world, d: new Destructibles(world, arena, config.materials) };
}

describe('config des matériaux', () => {
  it('verre fragile, bois moyen, pierre presque insensible aux balles', () => {
    expect(mat('glass').health * 1).toBeLessThanOrEqual(config.weapons.weapons.find((w) => w.id === 'pistol')!.damagePerShot * mat('glass').bulletFactor);
    expect(mat('wood').health).toBeGreaterThan(mat('glass').health);
    expect(mat('stone').health).toBeGreaterThan(mat('wood').health);
    expect(mat('stone').bulletFactor).toBeLessThan(mat('wood').bulletFactor);
  });

  it('refuse un élément d’un matériau inconnu', () => {
    const raw = rawConfig() as Record<string, any>;
    raw.arenas.arenas[1].breakables = [{ material: 'cheese', position: [0, 0, 0], size: [1, 1, 1] }];
    const res = parseGameConfig(raw as never);
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.errors.some((e) => e.includes('cheese'))).toBe(true);
  });
});

describe('morceaux', () => {
  it('un élément est découpé en morceaux d’environ 50 cm, ajoutés aux collisions', () => {
    const { world, d } = setup('wood');
    // 2 × 1 × 0,5 m → 4 × 2 × 1 morceaux
    expect(d.cells).toHaveLength(8);
    expect(world.blocks).toHaveLength(8);
    expect(d.cells.every((c) => c.health === mat('wood').health)).toBe(true);
    // un rayon vers le mur s'arrête dessus
    expect(raycastWorld(world, v3(0, 0.5, 0), v3(0, 0, -1), 10)?.t).toBeCloseTo(2.75);
  });

  it('une balle abîme le morceau touché ; détruit, il ne bloque plus', () => {
    const { world, d } = setup('wood');
    const point = v3(0.25, 0.25, -2.75);
    const perShot = 20 * mat('wood').bulletFactor;
    const shots = Math.ceil(mat('wood').health / perShot);
    for (let i = 1; i < shots; i++) expect(d.shot(point, 20)).toBeNull();
    const id = d.shot(point, 20);
    expect(id).not.toBeNull();
    expect(d.cells[id!]!.alive).toBe(false);
    expect(world.blocks).toHaveLength(7);
    // on voit à travers le trou, mais pas à côté
    expect(raycastWorld(world, v3(0.25, 0.25, 0), v3(0, 0, -1), 10)?.surface).toBe('wall');
    expect(raycastWorld(world, v3(-0.75, 0.25, 0), v3(0, 0, -1), 10)?.t).toBeCloseTo(2.75);
  });

  it('la pierre résiste aux balles bien plus que le verre', () => {
    const stone = setup('stone').d;
    const glass = setup('glass').d;
    const point = v3(0.25, 0.25, -2.75);
    expect(glass.shot(point, 20)).not.toBeNull();
    for (let i = 0; i < 20; i++) expect(stone.shot(point, 20)).toBeNull();
  });

  it('un impact loin de tout morceau ne casse rien', () => {
    const { d } = setup('glass');
    expect(d.shot(v3(5, 0.25, -2.75), 1000)).toBeNull();
  });

  it('une grenade casse le bois à quelques mètres ; la pierre seulement de près', () => {
    const damageAt = (dist: number) => g.damage * blastFactor(dist, g);
    // à 2,25 m du mur : tout le bois casse, la pierre tient
    const wood = setup('wood').d;
    const far = v3(0, 0.12, -0.5);
    const destroyed = wood.blast(far, g.blastRadius, damageAt);
    expect(destroyed.length).toBe(8);
    for (const id of destroyed) expect(distanceToBox(far, wood.cells[id]!.box)).toBeLessThan(g.blastRadius);
    expect(setup('stone').d.blast(far, g.blastRadius, damageAt)).toEqual([]);
    // au pied du mur, elle ouvre un trou dans la pierre
    expect(setup('stone').d.blast(v3(0.25, 0.12, -2.4), g.blastRadius, damageAt).length).toBeGreaterThan(0);
    // hors du rayon : rien
    expect(setup('glass').d.blast(v3(0, 0.12, 3), g.blastRadius, damageAt)).toEqual([]);
  });

  it('remove (ordre du serveur) est sans effet sur un morceau déjà détruit', () => {
    const { world, d } = setup('wood');
    expect(d.remove([0, 0, 3])).toHaveLength(2);
    expect(world.blocks).toHaveLength(6);
  });

  it('une grenade traverse un trou du mur', () => {
    const { world, d } = setup('wood');
    const throwAt = () => simulateGrenade(world, v3(0.25, 0.25, 0), throwVelocity(v3(0, 0, -1), { ...g, throwUpBoost: 0 }), { ...g, throwUpBoost: 0, gravity: 0.01 });
    expect(throwAt().end.z).toBeGreaterThan(-2.75);
    d.remove(d.cells.filter((c) => c.box.min.x >= 0 && c.box.max.x <= 0.5).map((c) => c.id));
    expect(throwAt().end.z).toBeLessThan(-3.25);
  });

  it('le joueur tombe quand le morceau sous ses pieds est détruit', () => {
    const arena = wallArena('wood');
    arena.breakables = [{ material: 'wood', position: [0, 0, 0], size: [1, 1, 1] }];
    arena.spawns = [{ position: [0, 1, 0], yawDeg: 0 }];
    const session = new CombatSession({ config: { ...config, arenas: { arenas: [...config.arenas.arenas, arena] }, modes: { ...config.modes, modes: config.modes.modes.map((m) => (m.id === 'duel' ? { ...m, arena: 'test' } : m)) } }, modeId: 'duel', weaponId: 'pistol', entries: [], seed: 1, networked: true });
    for (let k = 0; k < 30; k++) session.step({ ...IDLE_INPUT }, 1 / 60);
    expect(session.move.pos.y).toBeCloseTo(1, 3);
    session.breakables.remove(session.breakables.cells.map((c) => c.id));
    for (let k = 0; k < 60; k++) session.step({ ...IDLE_INPUT }, 1 / 60);
    expect(session.move.pos.y).toBeCloseTo(0, 3);
  });
});

describe('cartes', () => {
  it('chaque carte jouable a des éléments cassables, dans l’arène, aux matériaux connus', () => {
    for (const arena of config.arenas.arenas.filter((a) => a.selectable)) {
      expect(arena.breakables?.length ?? 0, arena.id).toBeGreaterThan(0);
      for (const b of arena.breakables!) {
        expect(Math.abs(b.position[0])).toBeLessThan(arena.size[0] / 2);
        expect(Math.abs(b.position[2])).toBeLessThan(arena.size[1] / 2);
      }
      // symétrie par rotation de 180° : même nombre d'éléments de chaque matériau de part et d'autre
      const side = (sign: number) => arena.breakables!.filter((b) => Math.sign(b.position[2] || b.position[0]) === sign).map((b) => b.material).sort();
      expect(side(1)).toEqual(side(-1));
    }
  });

  it('les cartes voxel ont leurs voxels cassables dans un décor à part', () => {
    for (const arena of config.arenas.arenas.filter((a) => a.decor)) {
      expect(arena.breakableDecor, arena.id).toBeDefined();
      expect(config.assets.assets[arena.breakableDecor!]?.voxel).toBeDefined();
    }
  });
});

// ---------- serveur ----------

function duel() {
  let now = 1_000_000;
  const inbox = new Map<string, ServerMessage[]>();
  let seed = 0.77;
  const server = new MatchServer(config, (id, m) => inbox.get(id)?.push(m) ?? inbox.set(id, [m]), () => now, () => {
    seed = ((seed * 9301 + 49297) % 233280) / 233280;
    return seed;
  });
  const of = <T extends ServerMessage['type']>(id: string, type: T) => (inbox.get(id) ?? []).filter((m): m is Extract<ServerMessage, { type: T }> => m.type === type);
  const last = <T extends ServerMessage['type']>(id: string, type: T) => of(id, type).at(-1);
  const advance = (ms: number, step = 50) => {
    for (let t = 0; t < ms; t += step) {
      now += step;
      server.tick();
    }
  };
  server.handle('A', { type: 'create', name: 'Alice', weaponId: 'pistol', settings: { ...defaultSettings(config, 'duel'), arenaId: 'duel', budgetSeconds: 60, maxQuestions: 3 }, deck: rawDeck() });
  server.handle('B', { type: 'join', name: 'Bob', weaponId: 'pistol', code: last('A', 'room')!.room.code });
  server.handle('A', { type: 'ready', ready: true });
  server.handle('B', { type: 'ready', ready: true });
  while (of('A', 'combatStart').length === 0) {
    for (const id of ['A', 'B']) {
      const view = last(id, 'quiz')?.view;
      if (view?.phase === 'choosing' && view.hand[0]) server.handle(id, { type: 'pick', cardId: view.hand[0].id });
      else if (view?.phase === 'answering') server.handle(id, { type: 'answer', answer: 0 });
      else if (view?.phase === 'feedback') server.handle(id, { type: 'next' });
    }
    advance(100);
  }
  return { server, of, last, advance };
}

describe('destruction en match', () => {
  const arena = config.arenas.arenas.find((a) => a.id === 'duel')!;
  const pieces = () => {
    const world = worldFromArena(arena);
    return new Destructibles(world, arena, config.materials);
  };

  it('des tirs détruisent un morceau de bois ; tout le monde reçoit son id', () => {
    const h = duel();
    const d = pieces();
    // un morceau sur la face sud d'un élément en bois (face extérieure, touchée de face)
    const outerZ = (c: (typeof d.cells)[number]) => Math.max(...d.cells.filter((x) => x.element === c.element).map((x) => x.box.max.z));
    const wood = d.cells.find((c) => c.material.id === 'wood' && Math.abs(c.box.max.z - outerZ(c)) < 1e-9)!;
    const target = v3((wood.box.min.x + wood.box.max.x) / 2, (wood.box.min.y + wood.box.max.y) / 2, wood.box.max.z - 0.01);
    const pos = { x: target.x, y: 0, z: target.z + 4 };
    h.server.handle('A', { type: 'state', pos, vel: { x: 0, y: 0, z: 0 }, yaw: 0, pitch: 0, slot: 0, aiming: false });
    const from = { x: pos.x, y: 1.6, z: pos.z };
    for (let i = 0; i < 12 && h.of('B', 'breaks').length === 0; i++) {
      h.server.handle('A', { type: 'shot', slot: 0, rays: [{ from, to: target }] });
      h.advance(300);
    }
    expect(h.last('B', 'breaks')?.cells).toEqual([wood.id]);
    expect(h.last('A', 'breaks')?.cells).toEqual([wood.id]);
  });

  it('un tir annoncé loin du tireur ou trop rapproché est ignoré', () => {
    const h = duel();
    const glassless = pieces().cells.find((c) => c.material.id === 'wood')!;
    const target = v3((glassless.box.min.x + glassless.box.max.x) / 2, glassless.box.min.y + 0.1, glassless.box.max.z);
    h.server.handle('A', { type: 'state', pos: { x: 0, y: 0, z: 18 }, vel: { x: 0, y: 0, z: 0 }, yaw: 0, pitch: 0, slot: 0, aiming: false });
    for (let i = 0; i < 20; i++) h.server.handle('A', { type: 'shot', slot: 0, rays: [{ from: { x: target.x, y: 1.6, z: target.z + 1 }, to: target }] });
    expect(h.of('B', 'breaks')).toHaveLength(0);
  });

  it('la carte est intacte au combat suivant (nouvelle manche)', () => {
    // chaque combat recrée ses morceaux depuis arenas.json : les ids détruits ne valent que pour la manche
    const a = pieces();
    a.remove([0]);
    expect(pieces().cells[0]!.alive).toBe(true);
  });
});
