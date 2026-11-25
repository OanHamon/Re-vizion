// Lot 14 : grenades trouvées dans des coffres (question de difficulté 3 en 10 s, coffre bloqué 30 s).
import { describe, expect, it } from 'vitest';
import { resolveDamage } from '../src/core/combat/damage';
import { v3, worldFromArena, type World } from '../src/core/combat/geometry';
import { blastFactor, blastHits, grenadePositionAt, GRENADE_SAMPLE_SECONDS, simulateGrenade, throwVelocity } from '../src/core/combat/grenade';
import { collectModifiers, playerStats } from '../src/core/combat/stats';
import { parseGameConfig } from '../src/core/config/gameConfig';
import type { Question } from '../src/core/deck/questionTypes';
import { ChestManager, pickChestQuestion } from '../src/core/match/chests';
import { MatchServer } from '../src/core/match/matchServer';
import type { ServerMessage } from '../src/core/match/protocol';
import { defaultSettings } from '../src/core/match/settings';
import { loadConfig, loadDeck, rawConfig, rawDeck } from './helpers';

const config = loadConfig();
const g = config.pickups.grenade;
const rules = config.pickups.chests;
const emptyWorld: World = { blocks: [], halfX: 20, halfZ: 20, wallHeight: 10 };

const question = (id: string, difficulte: number): Question => ({
  id, type: 'qcm', difficulte, enonce: `Question ${id}`, choix: ['A', 'B', 'C'], reponse: 1, explication: 'Parce que.', tags: [],
}) as Question;

describe('config des coffres et des grenades', () => {
  it('reprend les règles demandées : difficulté 3, 10 s, coffre bloqué 30 s après une erreur', () => {
    expect(rules.questionDifficulties).toEqual([3]);
    expect(rules.answerSeconds).toBe(10);
    expect(rules.lockSecondsOnFail).toBe(30);
  });

  it('une grenade à pleine puissance ne tue pas un joueur à pleine vie', () => {
    expect(g.damage).toBeLessThan(config.player.maxHealth);
  });

  it('refuse un asset inconnu et un départ au-dessus du maximum', () => {
    const raw = rawConfig() as Record<string, any>;
    raw.pickups.chests.asset = 'prop.nope';
    raw.pickups.grenade.startCount = 9;
    const res = parseGameConfig(raw as never);
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.errors.some((e) => e.includes('chests.asset'))).toBe(true);
      expect(res.errors.some((e) => e.includes('grenade.startCount'))).toBe(true);
    }
  });
});

describe('trajectoire de la grenade', () => {
  it('lâchée, elle tombe, rebondit et s’arrête posée sur le sol', () => {
    const path = simulateGrenade(emptyWorld, v3(0, 2, 0), v3(0, 0, 0), g);
    expect(path.end.y).toBeCloseTo(g.radius, 2);
    expect(path.end.x).toBeCloseTo(0, 6);
    // un point toutes les GRENADE_SAMPLE_SECONDS, du lancer à l'explosion
    expect(path.samples.length).toBe(Math.round(g.fuseSeconds / GRENADE_SAMPLE_SECONDS) + 1);
    expect(grenadePositionAt(path, 99)).toEqual(path.end);
    expect(grenadePositionAt(path, 0)).toEqual(v3(0, 2, 0));
  });

  it('rebondit sur un mur au lieu de le traverser', () => {
    const wall: World = { ...emptyWorld, blocks: [{ min: v3(3, 0, -5), max: v3(4, 5, 5) }] };
    const path = simulateGrenade(wall, v3(0, 1.5, 0), throwVelocity(v3(1, 0, 0), g), g);
    for (const p of path.samples) expect(p.x).toBeLessThanOrEqual(3 - g.radius + 1e-6);
    expect(path.end.x).toBeLessThan(3);
  });

  it('ne sort jamais de l’arène', () => {
    const path = simulateGrenade(emptyWorld, v3(18, 1.5, 0), throwVelocity(v3(1, 0.3, 0), g), g);
    for (const p of path.samples) expect(Math.abs(p.x)).toBeLessThanOrEqual(20);
  });

  it('est déterministe : serveur et clients obtiennent la même trajectoire', () => {
    const arena = config.arenas.arenas.find((a) => a.id === 'city')!;
    const world = worldFromArena(arena);
    const v = throwVelocity(v3(0.6, 0.2, -0.77), g);
    expect(simulateGrenade(world, v3(0, 1.6, 15), v, g)).toEqual(simulateGrenade(world, v3(0, 1.6, 15), v, g));
  });
});

describe('explosion', () => {
  const body = config.player.body;

  it('dégâts pleins au centre, puis de moins en moins jusqu’au bord du rayon', () => {
    expect(blastFactor(0, g)).toBe(1);
    expect(blastFactor(g.blastRadius / 2, g)).toBeCloseTo(1 - (1 - g.minFactor) / 2);
    expect(blastFactor(g.blastRadius, g)).toBe(0);
  });

  it('touche les joueurs dans le rayon, pas ceux trop loin ni ceux derrière un mur', () => {
    const wall: World = { ...emptyWorld, blocks: [{ min: v3(-3, 0, 1), max: v3(3, 4, 1.5) }] };
    const hits = blastHits(wall, v3(0, g.radius, 0), [
      { id: 'near', position: v3(1, 0, -1) },
      { id: 'far', position: v3(0, 0, -(g.blastRadius + 2)) },
      { id: 'hidden', position: v3(0, 0, 2.5) },
    ], body, g);
    expect(hits.map((h) => h.id)).toEqual(['near']);
    expect(hits[0]!.damage).toBeGreaterThan(0);
    expect(hits[0]!.damage).toBeLessThanOrEqual(g.damage);
  });

  it('le bouclier absorbe les dégâts de l’explosion en premier', () => {
    const stats = playerStats(config.player, collectModifiers([], 0));
    const out = resolveDamage({ raw: 40, piercesShield: false, attacker: stats, victim: stats, health: 100, shield: 25 });
    expect(out.shield).toBe(0);
    expect(out.health).toBe(85);
    expect(out.damage).toBe(40);
  });
});

describe('tirage de la question d’un coffre', () => {
  const pool = [question('a', 1), question('b', 3), question('c', 4), question('d', 5)];

  it('prend la difficulté demandée, et ne la redonne jamais', () => {
    const used = new Set<string>();
    expect(pickChestQuestion(pool, used, [3], () => 0)?.id).toBe('b');
    expect(used.has('b')).toBe(true);
    // plus de difficulté 3 : la plus proche (4)
    expect(pickChestQuestion(pool, used, [3], () => 0)?.id).toBe('c');
  });

  it('ignore les questions déjà posées pendant le quiz, et renvoie undefined quand le deck est épuisé', () => {
    const used = new Set(['a', 'b', 'c', 'd']);
    expect(pickChestQuestion(pool, used, [3], () => 0)).toBeUndefined();
  });
});

describe('coffre', () => {
  const pool = [question('q1', 3), question('q2', 3), question('q3', 3)];
  const make = () => new ChestManager([{ x: 0, y: 0, z: 0 }], rules, pool, new Set(), () => 0);
  const close = { x: 1, y: 0, z: 0 };

  it('ne s’ouvre qu’à portée', () => {
    const c = make();
    expect(c.open('A', { x: rules.openRadius + 1, y: 0, z: 0 }, 0, 0).ok).toBe(false);
    expect(c.open('A', close, 0, 0).ok).toBe(true);
    expect(c.views()[0]!.status).toBe('busy');
  });

  it('un seul joueur à la fois', () => {
    const c = make();
    c.open('A', close, 0, 0);
    expect(c.open('B', close, 0, 100)).toEqual({ ok: false, reason: 'coffre occupé' });
  });

  it('bonne réponse : coffre refermé pour tout le monde pendant lockSecondsOnSuccess', () => {
    const c = make();
    c.open('A', close, 0, 0);
    const out = c.answer('A', 1, 3000)!;
    expect(out.correct).toBe(true);
    expect(c.views()[0]).toEqual({ id: 0, status: 'locked', until: 3000 + rules.lockSecondsOnSuccess * 1000 });
    expect(c.open('B', close, 0, 3000 + rules.lockSecondsOnSuccess * 1000 - 1).ok).toBe(false);
    expect(c.open('B', close, 0, 3000 + rules.lockSecondsOnSuccess * 1000).ok).toBe(true);
  });

  it('mauvaise réponse : bloqué 30 s pour tout le monde', () => {
    const c = make();
    c.open('A', close, 0, 0);
    expect(c.answer('A', 0, 2000)?.correct).toBe(false);
    expect(c.views()[0]!.until).toBe(2000 + 30_000);
    expect(c.open('B', close, 0, 31_000).ok).toBe(false);
    expect(c.open('B', close, 0, 32_000).ok).toBe(true);
  });

  it('temps écoulé (10 s) : échec et blocage', () => {
    const c = make();
    c.open('A', close, 0, 0);
    expect(c.tick(9_999)).toEqual([]);
    const [out] = c.tick(10_000);
    expect(out).toMatchObject({ playerId: 'A', correct: false, timedOut: true, answer: null });
    expect(c.views()[0]!.status).toBe('locked');
    // trop tard : la réponse ne compte plus
    expect(c.answer('A', 1, 10_500)).toBeUndefined();
  });

  it('mort pendant la question : échec et blocage', () => {
    const c = make();
    c.open('A', close, 0, 0);
    expect(c.abandon('A', 4000)).toMatchObject({ correct: false, timedOut: true });
    expect(c.views()[0]!.status).toBe('locked');
  });

  it('réponse invalide ignorée (la question reste ouverte)', () => {
    const c = make();
    c.open('A', close, 0, 0);
    expect(c.answer('A', 7, 1000)).toBeUndefined();
    expect(c.attemptOf('A')).toBeDefined();
  });
});

// ---------- serveur de match ----------

function harness() {
  let now = 1_000_000;
  const inbox = new Map<string, ServerMessage[]>();
  let seed = 0.123;
  const server = new MatchServer(config, (id, m) => inbox.get(id)?.push(m) ?? inbox.set(id, [m]), () => now, () => {
    seed = ((seed * 9301 + 49297) % 233280) / 233280;
    return seed;
  });
  const of = <T extends ServerMessage['type']>(id: string, type: T) =>
    (inbox.get(id) ?? []).filter((m): m is Extract<ServerMessage, { type: T }> => m.type === type);
  const last = <T extends ServerMessage['type']>(id: string, type: T) => of(id, type).at(-1);
  const advance = (ms: number, step = 50) => {
    for (let t = 0; t < ms; t += step) {
      now += step;
      server.tick();
    }
  };
  return { server, of, last, advance };
}

/** Duel sur Cubes jusqu'au combat ; les joueurs se placent où on veut. */
function duelInCombat() {
  const h = harness();
  const settings = { ...defaultSettings(config, 'duel'), arenaId: 'duel', budgetSeconds: 60, maxQuestions: 3 };
  h.server.handle('A', { type: 'create', name: 'Alice', weaponId: 'pistol', settings, deck: rawDeck() });
  const code = h.last('A', 'room')!.room.code;
  h.server.handle('B', { type: 'join', name: 'Bob', weaponId: 'pistol', code });
  h.server.handle('A', { type: 'ready', ready: true });
  h.server.handle('B', { type: 'ready', ready: true });
  while (h.of('A', 'combatStart').length === 0) {
    // chaque joueur choisit une carte, répond, puis passe
    for (const id of ['A', 'B']) {
      const view = h.last(id, 'quiz')?.view;
      if (view?.phase === 'choosing' && view.hand[0]) h.server.handle(id, { type: 'pick', cardId: view.hand[0].id });
      else if (view?.phase === 'answering') h.server.handle(id, { type: 'answer', answer: 0 });
      else if (view?.phase === 'feedback') h.server.handle(id, { type: 'next' });
    }
    h.advance(100);
  }
  const arena = config.arenas.arenas.find((a) => a.id === 'duel')!;
  const place = (id: string, x: number, y: number, z: number) =>
    h.server.handle(id, { type: 'state', pos: { x, y, z }, vel: { x: 0, y: 0, z: 0 }, yaw: 0, pitch: 0, slot: 0, aiming: false });
  return { h, arena, place };
}

/** Bonne réponse à la question en cours d'un joueur (lue dans le deck : le client, lui, ne la reçoit pas). */
function rightAnswer(questionId: string): number {
  return loadDeck().questions.find((q) => q.id === questionId)!.reponse;
}

describe('coffres et grenades en match', () => {
  it('au début du combat : coffres ouverts, aucune grenade', () => {
    const { h, arena } = duelInCombat();
    expect(h.last('A', 'chests')!.chests).toHaveLength(arena.chests!.length);
    expect(h.last('A', 'chests')!.chests.every((c) => c.status === 'ready')).toBe(true);
    expect(h.last('A', 'grenades')!.count).toBe(g.startCount);
  });

  it('question sans la réponse, bonne réponse = une grenade, coffre bloqué pour l’autre joueur', () => {
    const { h, arena, place } = duelInCombat();
    const [x, y, z] = arena.chests![0]!.position;
    place('A', x + 1, y, z);
    place('B', x - 1, y, z);
    h.server.handle('A', { type: 'chestOpen', chestId: 0 });
    const q = h.last('A', 'chestQuestion')!;
    expect(q.question).not.toHaveProperty('reponse');
    expect(q.question).not.toHaveProperty('explication');
    expect(q.question.difficulte).toBe(3);
    expect(q.deadline).toBeGreaterThan(0);
    // B ne reçoit pas la question, et le coffre est occupé
    expect(h.of('B', 'chestQuestion')).toHaveLength(0);
    expect(h.last('B', 'chests')!.chests[0]!.status).toBe('busy');
    h.server.handle('B', { type: 'chestOpen', chestId: 0 });
    expect(h.of('B', 'chestQuestion')).toHaveLength(0);

    h.server.handle('A', { type: 'chestAnswer', answer: rightAnswer(q.question.id) });
    const res = h.last('A', 'chestResult')!;
    expect(res.correct).toBe(true);
    expect(res.grenades).toBe(Math.min(g.maxCarried, g.startCount + rules.reward.grenades));
    expect(h.last('B', 'chests')!.chests[0]!.status).toBe('locked');
  });

  it('pendant la question, le joueur ne peut ni tirer ni toucher', () => {
    const { h, arena, place } = duelInCombat();
    const [x, y, z] = arena.chests![0]!.position;
    place('A', x + 1, y, z);
    place('B', x + 4, y, z);
    h.server.handle('A', { type: 'chestOpen', chestId: 0 });
    h.server.handle('A', { type: 'hit', victimId: 'B', slot: 0, head: false, distance: 3, point: { x, y, z } });
    expect(h.of('B', 'damage')).toHaveLength(0);
  });

  it('erreur : rien de gagné, coffre bloqué 30 s pour tout le monde, puis rouvert', () => {
    const { h, arena, place } = duelInCombat();
    const [x, y, z] = arena.chests![0]!.position;
    place('A', x + 1, y, z);
    h.server.handle('A', { type: 'chestOpen', chestId: 0 });
    const q = h.last('A', 'chestQuestion')!;
    h.server.handle('A', { type: 'chestAnswer', answer: (rightAnswer(q.question.id) + 1) % q.question.choix.length });
    expect(h.last('A', 'chestResult')).toMatchObject({ correct: false, grenades: g.startCount });
    expect(h.last('B', 'chests')!.chests[0]!.status).toBe('locked');
    h.advance(rules.lockSecondsOnFail * 1000 - 200);
    expect(h.last('B', 'chests')!.chests[0]!.status).toBe('locked');
    h.advance(400);
    expect(h.last('B', 'chests')!.chests[0]!.status).toBe('ready');
  });

  it('pas de grenade = pas de lancer ; une grenade lancée explose et blesse l’adversaire proche', () => {
    const { h, arena, place } = duelInCombat();
    const [x, y, z] = arena.chests![0]!.position;
    place('A', x + 1, y, z);
    place('B', x + 2, y, z);
    h.server.handle('A', { type: 'throw', origin: { x: x + 1, y: y + 1.6, z }, dir: { x: 0, y: -1, z: 0 } });
    expect(h.of('A', 'grenade')).toHaveLength(0);

    h.server.handle('A', { type: 'chestOpen', chestId: 0 });
    h.server.handle('A', { type: 'chestAnswer', answer: rightAnswer(h.last('A', 'chestQuestion')!.question.id) });
    // A s'éloigne et lance la grenade à ses pieds, vers B
    place('A', x + 1, y, z);
    h.server.handle('A', { type: 'throw', origin: { x: x + 1.5, y: y + 1, z }, dir: { x: 0.3, y: -1, z: 0 } });
    const thrown = h.last('B', 'grenade')!;
    expect(thrown.throwerId).toBe('A');
    expect(h.last('A', 'grenades')!.count).toBe(g.startCount);
    place('A', x + 12, y, z);
    h.advance(g.fuseSeconds * 1000 + 100);
    expect(h.last('B', 'explosion')!.id).toBe(thrown.id);
    const dmg = h.of('B', 'damage').filter((d) => d.victimId === 'B');
    expect(dmg).toHaveLength(1);
    expect(dmg[0]!.attackerId).toBe('A');
    expect(dmg[0]!.amount).toBeGreaterThan(0);
    expect(dmg[0]!.amount).toBeLessThanOrEqual(g.damage);
    // A était trop loin : pas touché
    expect(h.of('A', 'damage').filter((d) => d.victimId === 'A')).toHaveLength(0);
  });

  it('une question de coffre ratée apparaît dans le récap', () => {
    const { h, arena, place } = duelInCombat();
    const [x, y, z] = arena.chests![0]!.position;
    place('A', x + 1, y, z);
    h.server.handle('A', { type: 'chestOpen', chestId: 0 });
    const q = h.last('A', 'chestQuestion')!;
    h.advance(rules.answerSeconds * 1000 + 100);
    expect(h.last('A', 'chestResult')).toMatchObject({ correct: false, timedOut: true });
    // fin du combat au chrono
    h.advance(config.modes.modes.find((m) => m.id === 'duel')!.combatMaxSeconds * 1000 + 2000, 500);
    const end = h.last('A', 'matchEnd')!;
    expect(end.recap.missed.some((r) => r.question.id === q.question.id && r.timedOut)).toBe(true);
  });
});
