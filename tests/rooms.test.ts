// Lot 9 : salons personnalisables (jusqu'à 5 joueurs, durées par 30 s, nombre max de questions, mêlée).
import { describe, expect, it } from 'vitest';
import { MatchServer } from '../src/core/match/matchServer';
import type { ServerMessage } from '../src/core/match/protocol';
import { checkSettings, defaultSettings, effectiveConfig, type MatchSettings } from '../src/core/match/settings';
import { QuizSession } from '../src/core/quiz/quizSession';
import { loadConfig, loadDeck, rawDeck } from './helpers';

const config = loadConfig();
const NAMES = ['Alice', 'Bob', 'Carl', 'Dana', 'Eve', 'Fred'];
const IDS = ['A', 'B', 'C', 'D', 'E', 'F'];
const at = (x: number, z: number) => ({ x, y: 0, z });

function harness() {
  let now = 1_000_000;
  const inbox = new Map<string, ServerMessage[]>();
  let seed = 0.321;
  const server = new MatchServer(config, (id, m) => inbox.get(id)?.push(m) ?? inbox.set(id, [m]), () => now, () => {
    seed = ((seed * 9301 + 49297) % 233280) / 233280;
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
  return { server, of, last, advance };
}

/** Salon créé par A, rejoint par les `count - 1` suivants. */
function openRoom(h: ReturnType<typeof harness>, settings: MatchSettings, count: number) {
  h.server.handle('A', { type: 'create', name: 'Alice', weaponId: 'pistol', settings, deck: rawDeck() });
  const code = h.last('A', 'room')!.room.code;
  for (let i = 1; i < count; i++) h.server.handle(IDS[i]!, { type: 'join', name: NAMES[i]!, weaponId: 'pistol', code });
  return code;
}

function readyAll(h: ReturnType<typeof harness>, count: number) {
  for (let i = 0; i < count; i++) h.server.handle(IDS[i]!, { type: 'ready', ready: true });
}

function toCombat(h: ReturnType<typeof harness>) {
  while (h.of('A', 'combatStart').length === 0) h.advance(100);
}

/** A élimine `victim` au pistolet (5 touches de 20). */
function kill(h: ReturnType<typeof harness>, attacker: string, victim: string) {
  for (let i = 0; i < 5; i++) {
    h.server.handle(attacker, { type: 'hit', victimId: victim, slot: 0, head: false, distance: 10, point: at(0, 0) });
    h.advance(300);
  }
}

const melee = (over: Partial<MatchSettings> = {}): MatchSettings => ({ ...defaultSettings(config, 'best_of_3'), maxPlayers: 4, ...over });

describe('réglages du salon (lot 9)', () => {
  it('durées de 1:00 à 5:00 par pas de 30 s, quiz et combat', () => {
    const steps = [60, 90, 120, 150, 180, 210, 240, 270, 300];
    expect(config.quiz.budgetChoicesSeconds).toEqual(steps);
    // combat : les mêmes pas, plus 0 = sans limite de temps
    expect(config.modes.combatChoicesSeconds).toEqual([...steps, 0]);
    expect(checkSettings(config, { ...defaultSettings(config), budgetSeconds: 150, combatSeconds: 270 }).ok).toBe(true);
    expect(checkSettings(config, { ...defaultSettings(config), budgetSeconds: 330 }).ok).toBe(false);
  });

  it('nombre de joueurs : 2 à 5 au choix, imposé à 2 en Duel', () => {
    const chrono = checkSettings(config, { ...defaultSettings(config, 'chrono'), maxPlayers: 5 });
    expect(chrono.ok && chrono.settings.maxPlayers).toBe(5);
    expect(checkSettings(config, { ...defaultSettings(config, 'chrono'), maxPlayers: 6 }).ok).toBe(false);
    const duel = checkSettings(config, { ...defaultSettings(config, 'duel'), maxPlayers: 5 });
    expect(duel.ok && duel.settings.maxPlayers).toBe(2);
  });

  it('nombre max de questions parmi les choix de la config ; condition de victoire libre seulement en Personnalisé', () => {
    expect(checkSettings(config, { ...defaultSettings(config), maxQuestions: 10 }).ok).toBe(true);
    expect(checkSettings(config, { ...defaultSettings(config), maxQuestions: 7 }).ok).toBe(false);
    const duel = checkSettings(config, { ...defaultSettings(config, 'duel'), winCondition: 'most_kills' });
    expect(duel.ok && duel.settings.winCondition).toBe('last_alive');
    const custom = checkSettings(config, { ...defaultSettings(config, 'custom'), winCondition: 'most_kills' });
    expect(custom.ok && custom.settings.winCondition).toBe('most_kills');
    expect(checkSettings(config, { ...defaultSettings(config, 'custom'), rounds: 4 }).ok).toBe(false);
  });

  it('l’arène de duel a une apparition par joueur possible', () => {
    const duelArena = config.arenas.arenas.find((a) => a.id === 'duel')!;
    expect(duelArena.spawns.length).toBeGreaterThanOrEqual(Math.max(...config.modes.players.choices));
  });
});

describe('combat sans limite de temps', () => {
  it('permis avec des vies limitées, refusé avec des réapparitions illimitées', () => {
    expect(checkSettings(config, { ...defaultSettings(config, 'duel'), combatSeconds: 0 }).ok).toBe(true);
    expect(checkSettings(config, { ...defaultSettings(config, 'chrono'), combatSeconds: 0 }).ok).toBe(false);
    expect(checkSettings(config, { ...defaultSettings(config, 'custom'), lives: 0, combatSeconds: 0 }).ok).toBe(false);
    expect(checkSettings(config, { ...defaultSettings(config, 'custom'), lives: 3, combatSeconds: 0 }).ok).toBe(true);
  });

  it('la manche ne finit pas au temps, seulement au dernier joueur en lice', () => {
    const h = harness();
    openRoom(h, melee({ maxPlayers: 2, combatSeconds: 0 }), 2);
    readyAll(h, 2);
    toCombat(h);
    expect(h.last('A', 'combatStart')!.endsAt).toBe(0);
    h.advance(10 * 60 * 1000, 1000);
    expect(h.of('A', 'roundEnd')).toHaveLength(0);
    kill(h, 'B', 'A');
    expect(h.last('A', 'roundEnd')).toMatchObject({ winnerId: 'B' });
  });
});

describe('nombre max de questions', () => {
  it('le quiz s’arrête après N questions même s’il reste du temps', () => {
    const settings = { ...defaultSettings(config), budgetSeconds: 300, maxQuestions: 3 };
    const cfg = effectiveConfig(config, settings);
    const { questions } = loadDeck();
    let now = 0;
    const s = new QuizSession({ config: cfg, questions, seed: 7, now });
    for (let i = 0; i < 3; i++) {
      expect(s.phase).toBe('choosing');
      const card = s.hand.find((c) => s.isPlayable(c, now))!;
      expect(s.pickCard(card.id, now).ok).toBe(true);
      now += 1000;
      s.answer(0, now);
      if (i < 2) s.next(now);
    }
    // dernier retour : compte à rebours de fin, puis fin de la phase
    expect(s.autoEndAt).not.toBeNull();
    s.next(now);
    expect(s.phase).toBe('finished');
    expect(s.results).toHaveLength(3);
    expect(s.remainingMs(now)).toBeGreaterThan(200_000);
  });

  it('sans limite (0), seul le temps compte', () => {
    const cfg = effectiveConfig(config, { ...defaultSettings(config), budgetSeconds: 300, maxQuestions: 0 });
    const { questions } = loadDeck();
    let now = 0;
    const s = new QuizSession({ config: cfg, questions, seed: 7, now });
    for (let i = 0; i < 4; i++) {
      const card = s.hand.find((c) => s.isPlayable(c, now))!;
      s.pickCard(card.id, now);
      now += 1000;
      s.answer(0, now);
      s.next(now);
    }
    expect(s.phase).toBe('choosing');
  });
});

describe('salon à plusieurs joueurs', () => {
  it('accueille jusqu’au maximum choisi, avec une couleur et une apparition par joueur', () => {
    const h = harness();
    const code = openRoom(h, melee({ maxPlayers: 5 }), 5);
    expect(h.last('A', 'room')!.room.players.map((p) => p.color)).toEqual([0, 1, 2, 3, 4]);
    h.server.handle('F', { type: 'join', name: 'Fred', weaponId: 'pistol', code });
    expect(h.last('F', 'error')!.message).toContain('complet');
    readyAll(h, 5);
    toCombat(h);
    expect(h.last('E', 'combatStart')!.fighters.map((f) => f.spawnIndex)).toEqual([0, 1, 2, 3, 4]);
  });

  it('démarre dès que tous les présents sont prêts, à partir de 2, sans attendre que le salon soit plein', () => {
    const h = harness();
    openRoom(h, melee({ maxPlayers: 5 }), 3);
    readyAll(h, 2);
    expect(h.of('A', 'quiz')).toHaveLength(0);
    h.server.handle('C', { type: 'ready', ready: true });
    expect(h.of('A', 'quiz').length).toBeGreaterThan(0);
    expect(h.of('C', 'quiz').length).toBeGreaterThan(0);
  });

  it('mêlée « dernier en vie » : la manche continue tant qu’il reste 2 joueurs en lice', () => {
    const h = harness();
    openRoom(h, melee({ maxPlayers: 3 }), 3);
    readyAll(h, 3);
    toCombat(h);
    kill(h, 'A', 'B');
    expect(h.of('A', 'roundEnd')).toHaveLength(0);
    kill(h, 'A', 'C');
    expect(h.last('C', 'roundEnd')).toMatchObject({ winnerId: 'A', round: 1 });
  });

  it('fin du chrono en « le plus de kills » : un seul en tête gagne, sinon manche nulle', () => {
    const h = harness();
    const settings = { ...defaultSettings(config, 'custom'), maxPlayers: 3, lives: 0, winCondition: 'most_kills' as const };
    openRoom(h, settings, 3);
    readyAll(h, 3);
    toCombat(h);
    kill(h, 'B', 'C');
    h.advance(settings.combatSeconds * 1000 + 200);
    expect(h.last('A', 'matchEnd')!.winnerId).toBe('B');
    // pièces : calculées par le serveur, le tueur et vainqueur gagne plus que les autres
    const coins = Object.fromEntries(h.last('A', 'matchEnd')!.results.map((r) => [r.id, r.coins]));
    expect(coins.B!.lines.map((l) => l.id)).toEqual(expect.arrayContaining(['kill', 'matchWin']));
    expect(coins.B!.total).toBeGreaterThan(coins.A!.total);
    expect(coins.A!.total).toBe(config.economy.match.participation.coins);
  });

  it('un joueur qui part en plein match : le match continue s’il reste au moins 2 joueurs', () => {
    const h = harness();
    openRoom(h, melee({ maxPlayers: 3 }), 3);
    readyAll(h, 3);
    toCombat(h);
    h.server.disconnect('C');
    expect(h.of('A', 'matchEnd')).toHaveLength(0);
    expect(h.last('A', 'peerLeft')).toMatchObject({ id: 'C' });
    expect(h.last('A', 'room')!.room.players).toHaveLength(2);
    h.server.disconnect('B');
    expect(h.last('A', 'matchEnd')).toMatchObject({ winnerId: 'A', forfeit: true });
  });

  it('un départ pendant le quiz ne bloque pas la fin de la phase des autres', () => {
    const h = harness();
    openRoom(h, melee({ maxPlayers: 3 }), 3);
    readyAll(h, 3);
    h.server.disconnect('C');
    toCombat(h);
    expect(h.last('A', 'combatStart')!.fighters.map((f) => f.id)).toEqual(['A', 'B']);
  });
});
