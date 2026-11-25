import { describe, expect, it } from 'vitest';
import { resolveHit, fighterStats } from '../src/core/combat/damage';
import { MatchServer } from '../src/core/match/matchServer';
import type { ServerMessage } from '../src/core/match/protocol';
import { checkSettings, defaultSettings, effectiveConfig } from '../src/core/match/settings';
import { loadConfig, rawDeck } from './helpers';

const config = loadConfig();

/** Serveur avec horloge factice et boîtes aux lettres par client. */
function harness() {
  let now = 1_000_000;
  const inbox = new Map<string, ServerMessage[]>();
  let seed = 0.123;
  const server = new MatchServer(config, (id, m) => inbox.get(id)?.push(m) ?? inbox.set(id, [m]), () => now, () => {
    seed = (seed * 9301 + 49297) % 233280 / 233280;
    return seed;
  });
  const of = <T extends ServerMessage['type']>(id: string, type: T) =>
    (inbox.get(id) ?? []).filter((m): m is Extract<ServerMessage, { type: T }> => m.type === type);
  const last = <T extends ServerMessage['type']>(id: string, type: T) => of(id, type).at(-1);
  const advance = (ms: number, step = 100) => {
    for (let t = 0; t < ms; t += step) {
      now += step;
      server.tick();
    }
  };
  return { server, of, last, advance, clear: () => inbox.clear(), get now() { return now; } };
}

function openRoom(h: ReturnType<typeof harness>, settings = defaultSettings(config, 'duel'), weapons: [string, string] = ['pistol', 'pistol']) {
  h.server.handle('A', { type: 'create', name: 'Alice', weaponId: weapons[0], settings, deck: rawDeck() });
  const code = h.last('A', 'room')!.room.code;
  h.server.handle('B', { type: 'join', name: 'Bob', weaponId: weapons[1], code });
  return code;
}

/** Les deux joueurs laissent filer le quiz (aucune réponse) jusqu'au combat. */
function skipToCombat(h: ReturnType<typeof harness>, budgetSeconds: number) {
  h.advance(budgetSeconds * 1000 + 200);
  h.advance(config.modes.countdownSeconds * 1000 + 200);
}

const at = (x: number, z: number) => ({ x, y: 0, z });
const zero = { x: 0, y: 0, z: 0 };

describe('réglages du salon', () => {
  it('impose les manches et vies du mode, sauf en Personnalisé', () => {
    const duel = checkSettings(config, { ...defaultSettings(config, 'duel'), rounds: 5, lives: 3 });
    expect(duel.ok && duel.settings).toMatchObject({ rounds: 1, lives: 1 });
    const custom = checkSettings(config, { ...defaultSettings(config, 'custom'), rounds: 3, roundsToWin: 5, lives: 2 });
    expect(custom.ok && custom.settings).toMatchObject({ rounds: 3, roundsToWin: 3, lives: 2 });
  });

  it('refuse une durée non proposée par la config', () => {
    expect(checkSettings(config, { ...defaultSettings(config), budgetSeconds: 17 }).ok).toBe(false);
    expect(checkSettings(config, { ...defaultSettings(config), combatSeconds: 5 }).ok).toBe(false);
  });

  it('désactiver le quitte ou double le rend inaccessible', () => {
    const cfg = effectiveConfig(config, { ...defaultSettings(config), doubleOrNothing: false });
    expect(cfg.quiz.combos.doubleOrNothing.correctStreak).toBeGreaterThan(1000);
  });
});

describe('dégâts entre joueurs', () => {
  const pistolOnly = (ids: string[] = []) => {
    const entries = ids.map((id) => {
      const b = config.bonuses.bonuses.find((x) => x.id === id)!;
      return { kind: 'bonus' as const, defId: b.id, label: b.label, icon: b.icon, family: b.family, rarity: b.rarity, severity: null, durationSeconds: b.durationSeconds, effects: b.effects, grantsWeapon: b.grantsWeapon ?? null, turn: 1 };
    });
    return fighterStats(config, { weaponIds: ['pistol'], entries }, 0);
  };

  it('le bouclier absorbe d’abord, le reste va aux PV', () => {
    const a = pistolOnly();
    const v = pistolOnly(['def_shield_c']);
    const out = resolveHit({ weapon: a.weapons[0]!, weaponPiercesShield: false, attacker: a.player, victim: v.player, distance: 10, head: false, health: 100, shield: 15 });
    expect(out).toMatchObject({ damage: 20, shield: 0, health: 95, killed: false });
  });

  it('l’armure réduit les dégâts reçus ; le perce-bouclier ignore le bouclier', () => {
    const a = pistolOnly(['atk_pierce_e']);
    const v = pistolOnly(['def_armor_e']);
    const out = resolveHit({ weapon: a.weapons[0]!, weaponPiercesShield: false, attacker: a.player, victim: v.player, distance: 10, head: false, health: 100, shield: 50 });
    expect(out.shield).toBe(50);
    expect(out.health).toBeCloseTo(84);
  });
});

describe('salon et match', () => {
  it('crée un salon avec un code, l’adversaire le rejoint', () => {
    const h = harness();
    const code = openRoom(h);
    expect(code).toMatch(/^[A-Z]{4}$/);
    expect(h.last('B', 'room')!.room.players.map((p) => p.name)).toEqual(['Alice', 'Bob']);
    expect(h.last('A', 'room')!.room.players.map((p) => p.color)).toEqual([0, 1]);
  });

  it('refuse un deck invalide, un code inconnu, un salon complet', () => {
    const h = harness();
    h.server.handle('A', { type: 'create', name: 'Alice', weaponId: 'pistol', settings: defaultSettings(config), deck: { deck: {} } });
    expect(h.last('A', 'error')!.message).toContain('Deck refusé');
    h.server.handle('B', { type: 'join', name: 'Bob', weaponId: 'pistol', code: 'ZZZZ' });
    expect(h.last('B', 'error')!.message).toContain('Aucun salon');
    const code = openRoom(h);
    h.server.handle('C', { type: 'join', name: 'Carl', weaponId: 'pistol', code });
    expect(h.last('C', 'error')!.message).toContain('complet');
  });

  it('les deux prêts : quiz avec les mêmes cartes, sans la bonne réponse avant de répondre', () => {
    const h = harness();
    openRoom(h);
    h.server.handle('A', { type: 'ready', ready: true });
    expect(h.of('A', 'quiz')).toHaveLength(0);
    h.server.handle('B', { type: 'ready', ready: true });
    const va = h.last('A', 'quiz')!.view;
    const vb = h.last('B', 'quiz')!.view;
    expect(va.hand.map((c) => c.bonusId)).toEqual(vb.hand.map((c) => c.bonusId));
    h.server.handle('A', { type: 'pick', cardId: va.hand[0]!.id });
    h.server.handle('B', { type: 'pick', cardId: vb.hand[0]!.id });
    const qa = h.last('A', 'quiz')!.view.active!.question;
    expect(qa.id).toBe(h.last('B', 'quiz')!.view.active!.question.id);
    expect(qa).not.toHaveProperty('reponse');
    expect(qa).not.toHaveProperty('explication');
    h.server.handle('A', { type: 'answer', answer: 0 });
    const fb = h.last('A', 'quiz')!.view.lastResult!;
    expect(typeof fb.correctIndex).toBe('number');
    expect(fb.explication.length).toBeGreaterThan(10);
  });

  it('fin du budget : transition, compte à rebours, puis combat', () => {
    const h = harness();
    openRoom(h);
    h.server.handle('A', { type: 'ready', ready: true });
    h.server.handle('B', { type: 'ready', ready: true });
    // le quiz s'arrête dès qu'il ne reste plus de quoi jouer une Commune
    while (h.of('A', 'transition').length === 0) h.advance(100);
    expect(h.last('A', 'transition')).toMatchObject({ round: 1, arena: 'Cubes' });
    expect(h.of('A', 'combatStart')).toHaveLength(0);
    h.advance(config.modes.countdownSeconds * 1000 + 200);
    const start = h.last('B', 'combatStart')!;
    expect(start.fighters.map((f) => f.spawnIndex)).toEqual([0, 1]);
    expect(start.fighters.every((f) => f.health === 100)).toBe(true);
  });

  it('duel : 5 tirs de pistolet tuent, la seule vie est perdue, le match se termine', () => {
    const h = harness();
    openRoom(h);
    h.server.handle('A', { type: 'ready', ready: true });
    h.server.handle('B', { type: 'ready', ready: true });
    skipToCombat(h, config.quiz.budgetSeconds);
    h.server.handle('A', { type: 'state', pos: at(0, 10), vel: zero, yaw: 0, pitch: 0, slot: 0, aiming: false });
    h.server.handle('B', { type: 'state', pos: at(0, 0), vel: zero, yaw: 0, pitch: 0, slot: 0, aiming: false });
    expect(h.last('B', 'peer')).toMatchObject({ id: 'A' });
    for (let i = 0; i < 5; i++) {
      h.server.handle('A', { type: 'shot', slot: 0, rays: [] });
      h.server.handle('A', { type: 'hit', victimId: 'B', slot: 0, head: false, distance: 10, point: at(0, 0) });
      h.advance(300);
    }
    const dmg = h.of('B', 'damage');
    expect(dmg.map((d) => d.health)).toEqual([80, 60, 40, 20, 0]);
    expect(dmg.at(-1)!.killed).toBe(true);
    const end = h.last('A', 'matchEnd')!;
    expect(end.winnerId).toBe('A');
    expect(end.results.find((r) => r.id === 'A')).toMatchObject({ kills: 1, shots: 5, hits: 5, roundWins: 1 });
    expect(h.last('B', 'matchEnd')!.recap.total).toBe(0);
  });

  it('refuse les touches invraisemblables : trop loin, distance incohérente, trop rapides', () => {
    const h = harness();
    openRoom(h);
    h.server.handle('A', { type: 'ready', ready: true });
    h.server.handle('B', { type: 'ready', ready: true });
    skipToCombat(h, config.quiz.budgetSeconds);
    h.server.handle('A', { type: 'state', pos: at(0, 10), vel: zero, yaw: 0, pitch: 0, slot: 0, aiming: false });
    h.server.handle('B', { type: 'state', pos: at(0, 0), vel: zero, yaw: 0, pitch: 0, slot: 0, aiming: false });
    h.server.handle('A', { type: 'hit', victimId: 'B', slot: 0, head: false, distance: 500, point: zero });
    h.server.handle('A', { type: 'hit', victimId: 'B', slot: 0, head: false, distance: 30, point: zero });
    h.server.handle('A', { type: 'hit', victimId: 'B', slot: 3, head: false, distance: 10, point: zero });
    expect(h.of('B', 'damage')).toHaveLength(0);
    for (let i = 0; i < 20; i++) h.server.handle('A', { type: 'hit', victimId: 'B', slot: 0, head: false, distance: 10, point: zero });
    expect(h.of('B', 'damage').length).toBeLessThanOrEqual(5);
    expect(h.of('B', 'damage').length).toBeGreaterThan(0);
  });

  it('Best of 3 : fin de manche, nouveau quiz, puis fin du match à 2 manches gagnées', () => {
    const h = harness();
    openRoom(h, defaultSettings(config, 'best_of_3'));
    const winRound = () => {
      h.server.handle('A', { type: 'ready', ready: true });
      h.server.handle('B', { type: 'ready', ready: true });
      skipToCombat(h, config.quiz.budgetSeconds);
      for (let i = 0; i < 5; i++) {
        h.server.handle('A', { type: 'hit', victimId: 'B', slot: 0, head: false, distance: 10, point: zero });
        h.advance(300);
      }
    };
    winRound();
    expect(h.last('A', 'roundEnd')).toMatchObject({ round: 1, winnerId: 'A', matchOver: false });
    h.advance(config.modes.roundEndSeconds * 1000 + 200);
    expect(h.last('A', 'room')!.room).toMatchObject({ phase: 'quiz', round: 2 });
    skipToCombat(h, config.quiz.budgetSeconds);
    for (let i = 0; i < 5; i++) {
      h.server.handle('A', { type: 'hit', victimId: 'B', slot: 0, head: false, distance: 10, point: zero });
      h.advance(300);
    }
    expect(h.last('A', 'roundEnd')).toMatchObject({ round: 2, matchOver: true });
    h.advance(config.modes.roundEndSeconds * 1000 + 200);
    expect(h.last('B', 'matchEnd')).toMatchObject({ winnerId: 'A', forfeit: false });
  });

  it('Chrono : réapparition après le délai, le plus de kills gagne à la fin du chrono', () => {
    const h = harness();
    openRoom(h, defaultSettings(config, 'chrono'));
    h.server.handle('A', { type: 'ready', ready: true });
    h.server.handle('B', { type: 'ready', ready: true });
    skipToCombat(h, config.quiz.budgetSeconds);
    for (let i = 0; i < 5; i++) {
      h.server.handle('A', { type: 'hit', victimId: 'B', slot: 0, head: false, distance: 10, point: zero });
      h.advance(300);
    }
    expect(h.of('A', 'matchEnd')).toHaveLength(0);
    h.advance(config.modes.respawnSeconds * 1000 + 200);
    expect(h.last('B', 'respawn')).toMatchObject({ id: 'B', health: 100 });
    h.advance(defaultSettings(config, 'chrono').combatSeconds * 1000);
    expect(h.last('A', 'matchEnd')!.winnerId).toBe('A');
  });

  it('un joueur qui part en plein match donne la victoire à l’autre ; rejouer ramène au lobby', () => {
    const h = harness();
    openRoom(h);
    h.server.handle('A', { type: 'ready', ready: true });
    h.server.handle('B', { type: 'ready', ready: true });
    h.server.disconnect('B');
    expect(h.last('A', 'matchEnd')).toMatchObject({ winnerId: 'A', forfeit: true });
    expect(h.last('A', 'room')!.room).toMatchObject({ phase: 'lobby' });
    h.server.disconnect('A');
    expect(h.server.roomCount).toBe(0);
  });
});
