// Un salon de 2 à N joueurs (réglage maxPlayers) et tout son match : lobby → quiz → transition → combat → fin de manche → … → fin.
// Logique pure : l'horloge et l'envoi des messages sont injectés (testable sans réseau).
// Le serveur est autoritaire : il tire les questions, valide les réponses, calcule dégâts et PV.
import type { GameConfig } from '../config/gameConfig';
import { fighterStats, resolveDamage, resolveHit } from '../combat/damage';
import { worldFromArena, type World } from '../combat/geometry';
import { Destructibles } from '../combat/destruction';
import { blastFactor, blastHits, simulateGrenade, throwVelocity } from '../combat/grenade';
import { questionType } from '../deck/questionTypes';
import { ChestManager, type ChestOutcome } from './chests';
import type { Deck } from '../deck/validateDeck';
import type { InventoryEntry } from '../quiz/inventory';
import { QuizSession, type TurnResult } from '../quiz/quizSession';
import { computeAxes, quizSamples } from './matchStats';
import { matchCoins } from './coins';
import type { FighterInfo, PlayerInfo, PlayerResult, RoomInfo, RoomPhase, RoundStats, ServerPayload } from './protocol';
import { questionView, quizView, recapView } from './quizView';
import { effectiveConfig, type MatchSettings } from './settings';

type Vec = { x: number; y: number; z: number };

export interface Member {
  id: string;
  name: string;
  weaponId: string;
  ready: boolean;
  connected: boolean;
  color: number;
  quiz: QuizSession | null;
  pushedVersion: number;
  rounds: { results: TurnResult[]; bestStreak: number; inventory: InventoryEntry[] }[];
  entries: InventoryEntry[];
  // combat de la manche en cours
  health: number;
  shield: number;
  alive: boolean;
  livesLeft: number;
  respawnAt: number;
  spawnIndex: number;
  pos: Vec | null;
  hitTimes: number[];
  shotHit: boolean;
  lastVitalsAt: number;
  round: RoundStats;
  roundWins: number;
  /** Grenades en poche (manche en cours) et instant du dernier lancer. */
  grenades: number;
  lastThrowAt: number;
  /** Dernier tir qui a abîmé le décor (limite de cadence côté serveur). */
  lastDecorShotAt: number;
  /** Questions des coffres, sur tout le match (récap). */
  chestResults: TurnResult[];
  /** Cumul du match ; damage et opponentHealth servent à l'Agressivité (écran 14). */
  total: { kills: number; headshotKills: number; shots: number; hits: number; damage: number; opponentHealth: number };
}

export type Send = (memberId: string, payload: ServerPayload) => void;

/** Tolérances de la validation des tirs (le client simule, le serveur vérifie la vraisemblance). */
const HIT_RATE_MARGIN = 1.5;
const HIT_DISTANCE_MARGIN = 6;
const VITALS_INTERVAL_MS = 400;

/** Distance max (m) entre la position connue du joueur et le point de départ annoncé d'une grenade. */
const THROW_ORIGIN_MARGIN = 3;

interface LiveGrenade {
  id: number;
  throwerId: string;
  end: Vec;
  explodeAt: number;
}

const emptyStats = (id: string): RoundStats => ({ id, kills: 0, deaths: 0, shots: 0, hits: 0, damage: 0 });

/** Le seul membre en tête selon un score lexicographique (plus haut = mieux), ou null en cas d'égalité. */
function uniqueBest(members: readonly Member[], score: (m: Member) => number[]): string | null {
  if (members.length === 0) return null;
  const compare = (a: number[], b: number[]) => {
    for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return a[i]! - b[i]!;
    return 0;
  };
  const sorted = members.map((m) => ({ id: m.id, s: score(m) })).sort((a, b) => compare(b.s, a.s));
  if (sorted.length > 1 && compare(sorted[0]!.s, sorted[1]!.s) === 0) return null;
  return sorted[0]!.id;
}

export class Room {
  readonly members: Member[] = [];
  phase: RoomPhase = 'lobby';
  round = 0;
  hostId: string;
  private cfg: GameConfig;
  private phaseEndsAt = 0;
  private combatStartedAt = 0;
  private usedQuestions = new Set<string>();
  private chests: ChestManager | null = null;
  private chestsVersion = -1;
  private world: World | null = null;
  private breakables: Destructibles | null = null;
  private grenades: LiveGrenade[] = [];
  private nextGrenadeId = 1;

  constructor(
    readonly code: string,
    private readonly baseConfig: GameConfig,
    readonly settings: MatchSettings,
    readonly deck: Deck,
    private readonly send: Send,
    private readonly now: () => number,
    private readonly random: () => number = Math.random,
  ) {
    this.cfg = effectiveConfig(baseConfig, settings);
    this.hostId = '';
  }

  get full(): boolean {
    return this.members.length >= this.settings.maxPlayers;
  }

  get empty(): boolean {
    return this.members.length === 0;
  }

  private get mode() {
    return this.baseConfig.modes.modes.find((m) => m.id === this.settings.modeId)!;
  }

  private get arena() {
    const id = this.settings.arenaId;
    return this.baseConfig.arenas.arenas.find((a) => a.id === id) ?? this.baseConfig.arenas.arenas.find((a) => a.id === this.mode.arena)!;
  }

  // ---------- lobby ----------

  addMember(id: string, name: string, weaponId: string): void {
    // première couleur libre : elle donne aussi le point d'apparition
    const usedColors = new Set(this.members.map((m) => m.color));
    let color = 0;
    while (usedColors.has(color)) color++;
    this.members.push({
      id, name, weaponId, ready: false, connected: true, color,
      quiz: null, pushedVersion: -1, rounds: [], entries: [],
      health: 0, shield: 0, alive: false, livesLeft: 0, respawnAt: Infinity, spawnIndex: color, pos: null,
      hitTimes: [], shotHit: false, lastVitalsAt: 0, round: emptyStats(id), roundWins: 0,
      grenades: 0, lastThrowAt: -Infinity, lastDecorShotAt: -Infinity, chestResults: [],
      total: { kills: 0, headshotKills: 0, shots: 0, hits: 0, damage: 0, opponentHealth: 0 },
    });
    if (!this.hostId) this.hostId = id;
    this.broadcastRoom();
  }

  setReady(id: string, ready: boolean): void {
    const m = this.member(id);
    if (!m || this.phase !== 'lobby') return;
    m.ready = ready;
    this.broadcastRoom();
    const enough = this.members.length >= this.baseConfig.modes.players.min;
    if (enough && this.members.every((x) => x.ready && x.connected)) this.startMatch();
  }

  /**
   * Un joueur quitte (ou perd la connexion).
   * En plein match : s'il ne reste qu'un joueur, il gagne par forfait ; sinon le match continue sans lui.
   */
  removeMember(id: string): void {
    const m = this.member(id);
    if (!m) return;
    const inMatch = this.phase !== 'lobby' && this.phase !== 'finished';
    const remaining = this.members.filter((x) => x.id !== id);
    if (inMatch && remaining.length < this.baseConfig.modes.players.min) {
      this.finishMatch(remaining[0]?.id ?? null, true);
    }
    this.members.splice(this.members.indexOf(m), 1);
    if (this.hostId === id) this.hostId = this.members[0]?.id ?? '';
    if (this.empty) return;
    if (this.phase === 'lobby' || this.phase === 'finished') {
      this.phase = 'lobby';
      for (const x of this.members) x.ready = false;
      this.broadcastRoom();
      return;
    }
    // le match continue : on prévient les autres, puis on vérifie si sa sortie termine la phase
    this.broadcastRoom();
    this.broadcast({ type: 'peerLeft', id });
    if (this.chests?.abandon(id, this.now())) this.broadcastChests();
    if (this.phase === 'quiz') this.checkQuizEnd();
    else if (this.phase === 'combat') this.checkLastStanding();
  }

  /** Après les résultats : retour au lobby du même salon. */
  rematch(id: string): void {
    if (this.phase !== 'finished' || !this.member(id)) return;
    this.phase = 'lobby';
    this.round = 0;
    for (const m of this.members) m.ready = false;
    this.broadcastRoom();
  }

  roomInfo(forId: string): RoomInfo {
    return {
      code: this.code,
      hostId: this.hostId,
      you: forId,
      settings: this.settings,
      deckTitle: this.deck.deck.titre,
      deckSize: this.deck.questions.length,
      phase: this.phase,
      round: this.round,
      players: this.members.map((m): PlayerInfo => ({ id: m.id, name: m.name, weaponId: m.weaponId, ready: m.ready, connected: m.connected, color: m.color })),
    };
  }

  // ---------- match ----------

  private startMatch(): void {
    this.usedQuestions = new Set();
    for (const m of this.members) {
      m.rounds = [];
      m.roundWins = 0;
      m.chestResults = [];
      m.total = { kills: 0, headshotKills: 0, shots: 0, hits: 0, damage: 0, opponentHealth: 0 };
    }
    this.round = 0;
    this.startRound();
  }

  private startRound(): void {
    this.round++;
    this.phase = 'quiz';
    const now = this.now();
    // même graine pour tous les joueurs : mêmes cartes et questions dans le même ordre
    const seed = Math.floor(this.random() * 2 ** 32);
    for (const m of this.members) {
      m.ready = false;
      m.quiz = new QuizSession({
        config: this.cfg,
        questions: this.deck.questions,
        seed,
        now,
        weaponId: m.weaponId,
        excludeQuestionIds: this.usedQuestions,
      });
      m.pushedVersion = -1;
    }
    this.broadcastRoom();
    this.pushQuizViews();
  }

  pick(id: string, cardId: string): void {
    this.quizAction(id, (q, now) => q.pickCard(cardId, now));
  }

  answer(id: string, answer: number): void {
    this.quizAction(id, (q, now) => q.answer(answer, now));
  }

  next(id: string): void {
    this.quizAction(id, (q, now) => q.next(now));
  }

  private quizAction(id: string, run: (q: QuizSession, now: number) => unknown): void {
    const m = this.member(id);
    if (this.phase !== 'quiz' || !m?.quiz) return;
    run(m.quiz, this.now());
    this.pushQuizViews();
    this.checkQuizEnd();
  }

  private pushQuizViews(): void {
    for (const m of this.members) {
      if (!m.quiz || m.quiz.version === m.pushedVersion) continue;
      m.pushedVersion = m.quiz.version;
      this.send(m.id, { type: 'quiz', view: quizView(m.quiz) });
    }
  }

  private checkQuizEnd(): void {
    if (this.phase !== 'quiz' || !this.members.every((m) => m.quiz?.phase === 'finished')) return;
    for (const m of this.members) {
      const q = m.quiz!;
      m.entries = [...q.inventory.all()];
      m.rounds.push({ results: [...q.results], bestStreak: q.combo.bestStreak, inventory: m.entries });
      for (const r of q.results) this.usedQuestions.add(r.question.id);
    }
    this.phase = 'transition';
    this.phaseEndsAt = this.now() + this.baseConfig.modes.countdownSeconds * 1000;
    const players = this.members.map((m) => ({
      id: m.id,
      name: m.name,
      weaponId: m.weaponId,
      color: m.color,
      entries: m.entries,
      correct: m.quiz!.results.filter((r) => r.correct).length,
      answered: m.quiz!.results.length,
    }));
    this.broadcast({ type: 'transition', round: this.round, endsAt: this.phaseEndsAt, arena: this.arena.label, players });
  }

  private startCombat(): void {
    this.phase = 'combat';
    const now = this.now();
    this.combatStartedAt = now;
    // 0 = sans limite : seule l'élimination termine la manche
    this.phaseEndsAt = this.settings.combatSeconds === 0 ? Infinity : now + this.settings.combatSeconds * 1000;
    const fighters: FighterInfo[] = [];
    for (const m of this.members) {
      const { player } = this.statsOf(m);
      m.health = player.maxHealth;
      m.shield = player.shield;
      m.alive = true;
      m.livesLeft = this.settings.lives === 0 ? Infinity : this.settings.lives;
      m.respawnAt = Infinity;
      m.spawnIndex = m.color;
      m.pos = null;
      m.hitTimes = [];
      m.round = emptyStats(m.id);
      // PV max moyens des adversaires à cette manche (base de l'Agressivité : « un adversaire » de PV)
      const opponents = this.others(m.id);
      if (opponents.length > 0) m.total.opponentHealth += opponents.reduce((sum, o) => sum + this.statsOf(o).player.maxHealth, 0) / opponents.length;
      m.grenades = this.baseConfig.pickups.grenade.startCount;
      m.lastThrowAt = -Infinity;
      m.lastDecorShotAt = -Infinity;
      fighters.push({ id: m.id, name: m.name, weaponId: m.weaponId, color: m.color, entries: m.entries, spawnIndex: m.spawnIndex, health: m.health, shield: m.shield });
    }
    this.world = worldFromArena(this.arena);
    this.breakables = new Destructibles(this.world, this.arena, this.baseConfig.materials);
    this.grenades = [];
    this.chests = new ChestManager(
      (this.arena.chests ?? []).map((c) => ({ x: c.position[0], y: c.position[1], z: c.position[2] })),
      this.baseConfig.pickups.chests,
      this.deck.questions,
      this.usedQuestions,
      this.random,
    );
    this.chestsVersion = -1;
    this.broadcastRoom();
    this.broadcast({ type: 'combatStart', round: this.round, endsAt: Number.isFinite(this.phaseEndsAt) ? this.phaseEndsAt : 0, fighters });
    this.broadcastChests();
    for (const m of this.members) this.send(m.id, { type: 'grenades', count: m.grenades });
  }

  // ---------- coffres et grenades ----------

  /** Le joueur répond à une question de coffre : il ne peut ni tirer ni lancer. */
  private answering(id: string): boolean {
    return this.chests?.attemptOf(id) !== undefined;
  }

  private broadcastChests(): void {
    if (!this.chests || this.chests.version === this.chestsVersion) return;
    this.chestsVersion = this.chests.version;
    this.broadcast({ type: 'chests', chests: this.chests.views() });
  }

  chestOpen(id: string, chestId: number): void {
    const m = this.member(id);
    if (this.phase !== 'combat' || !m?.alive || !this.chests) return;
    const res = this.chests.open(id, m.pos, chestId, this.now());
    if (!res.ok) {
      // l'état a pu changer (fin de blocage) : on le renvoie pour corriger l'affichage
      this.broadcastChests();
      return;
    }
    const q = res.attempt.question;
    this.send(id, { type: 'chestQuestion', chestId, question: questionView(q), deadline: res.attempt.deadline });
    this.broadcastChests();
  }

  chestAnswer(id: string, answer: number): void {
    if (this.phase !== 'combat' || !this.chests) return;
    const outcome = this.chests.answer(id, answer, this.now());
    if (outcome) this.onChestOutcome(outcome);
    this.broadcastChests();
  }

  private onChestOutcome(o: ChestOutcome): void {
    const m = this.member(o.playerId);
    if (!m) return;
    const rules = this.baseConfig.pickups;
    if (o.correct) m.grenades = Math.min(rules.grenade.maxCarried, m.grenades + rules.chests.reward.grenades);
    // pour le récap : une carte « coffre » de la rareté qui correspond à la difficulté de la question
    const rarity = this.baseConfig.quiz.rarities.find((r) => r.difficulties.includes(o.question.difficulte)) ?? this.baseConfig.quiz.rarities[0]!;
    m.chestResults.push({
      turn: m.chestResults.length + 1,
      card: { id: `chest-${this.round}-${o.chestId}-${m.chestResults.length}`, bonusId: 'chest', family: 'weapon', rarity: rarity.id, costMs: rules.chests.answerSeconds * 1000, doubleOrNothing: false },
      question: o.question,
      answer: o.answer,
      correct: o.correct,
      timedOut: o.timedOut,
      gained: null,
      malus: null,
      startedAt: o.startedAt,
      answeredAt: o.answeredAt,
    });
    const def = questionType(o.question);
    this.send(m.id, {
      type: 'chestResult',
      chestId: o.chestId,
      correct: o.correct,
      timedOut: o.timedOut,
      answer: o.answer,
      correctIndex: o.question.reponse,
      correctText: def.correctAnswerText(o.question),
      explication: o.question.explication,
      grenades: m.grenades,
    });
  }

  throwGrenade(id: string, origin: Vec, dir: Vec): void {
    const m = this.member(id);
    if (this.phase !== 'combat' || !m?.alive || !m.pos || !this.world || this.answering(id)) return;
    const p = this.baseConfig.pickups.grenade;
    const now = this.now();
    if (m.grenades <= 0 || now - m.lastThrowAt < p.throwCooldownSeconds * 1000) return;
    if (Math.hypot(origin.x - m.pos.x, origin.y - m.pos.y, origin.z - m.pos.z) > THROW_ORIGIN_MARGIN) return;
    if (Math.hypot(dir.x, dir.y, dir.z) < 1e-6) return;
    m.grenades--;
    m.lastThrowAt = now;
    // le serveur calcule seul la trajectoire (même fonction que l'affichage des clients)
    const velocity = throwVelocity(dir, p);
    const path = simulateGrenade(this.world, origin, velocity, p);
    const grenade: LiveGrenade = { id: this.nextGrenadeId++, throwerId: id, end: path.end, explodeAt: now + p.fuseSeconds * 1000 };
    this.grenades.push(grenade);
    this.send(id, { type: 'grenades', count: m.grenades });
    this.broadcast({ type: 'grenade', id: grenade.id, throwerId: id, origin, velocity, explodeAt: grenade.explodeAt });
  }

  private explode(g: LiveGrenade): void {
    this.broadcast({ type: 'explosion', id: g.id, point: g.end });
    const thrower = this.member(g.throwerId);
    if (!thrower || !this.world) return;
    const p = this.baseConfig.pickups.grenade;
    const { body } = this.baseConfig.player;
    const victims = this.members.flatMap((m) => (m.alive && m.pos ? [{ id: m.id, position: m.pos }] : []));
    const a = this.statsOf(thrower);
    for (const hit of blastHits(this.world, g.end, victims, body, p)) {
      const victim = this.member(hit.id);
      if (!victim?.alive || !victim.pos || this.phase !== 'combat') continue;
      const self = victim === thrower;
      const out = resolveDamage({
        raw: hit.damage * (self ? p.selfDamageFactor : 1),
        piercesShield: false,
        attacker: a.player,
        victim: this.statsOf(victim).player,
        health: victim.health,
        shield: victim.shield,
      });
      if (out.damage <= 0) continue;
      victim.health = out.health;
      victim.shield = out.shield;
      if (!self) {
        thrower.round.damage += out.damage;
        thrower.total.damage += out.damage;
      }
      const point = { x: victim.pos.x, y: victim.pos.y + body.height / 2, z: victim.pos.z };
      this.broadcast({ type: 'damage', victimId: victim.id, attackerId: thrower.id, amount: out.damage, head: false, health: victim.health, shield: victim.shield, killed: out.killed, point });
      if (out.killed) this.onKill(thrower, victim, false);
    }
    // puis le décor cassable dans le rayon
    if (this.breakables && this.phase === 'combat') {
      const destroyed = this.breakables.blast(g.end, p.blastRadius, (d) => p.damage * blastFactor(d, p));
      if (destroyed.length > 0) this.broadcast({ type: 'breaks', cells: destroyed });
    }
  }

  private weaponIdsOf(m: Member): string[] {
    return [m.weaponId, ...new Set(m.entries.flatMap((e) => (e.grantsWeapon ? [e.grantsWeapon] : [])))];
  }

  private statsOf(m: Member) {
    const elapsed = Math.max(0, (this.now() - this.combatStartedAt) / 1000);
    return fighterStats(this.cfg, { weaponIds: this.weaponIdsOf(m), entries: m.entries }, elapsed);
  }

  /** Position relayée à l'adversaire (le client simule son propre déplacement). */
  state(id: string, s: { pos: Vec; vel: Vec; yaw: number; pitch: number; slot: number; aiming: boolean }): void {
    const m = this.member(id);
    if (this.phase !== 'combat' || !m?.alive) return;
    m.pos = s.pos;
    const { pos, vel, yaw, pitch, slot, aiming } = s;
    for (const o of this.others(id)) this.send(o.id, { type: 'peer', id, pos, vel, yaw, pitch, slot, aiming });
  }

  shot(id: string, slot: number, rays: { from: Vec; to: Vec }[]): void {
    const m = this.member(id);
    if (this.phase !== 'combat' || !m?.alive || this.answering(id)) return;
    m.round.shots++;
    m.total.shots++;
    m.shotHit = false;
    for (const o of this.others(id)) this.send(o.id, { type: 'peerShot', id, slot, rays });
    this.shotOnDecor(m, slot, rays);
  }

  /**
   * Un tir abîme le décor cassable au point d'impact de chaque plomb. Vérifications : départ près du tireur,
   * portée de l'arme, cadence (au plus un tir par période de l'arme, avec une marge).
   */
  private shotOnDecor(m: Member, slot: number, rays: { from: Vec; to: Vec }[]): void {
    if (!this.breakables || !m.pos) return;
    const weapon = this.statsOf(m).weapons[slot];
    if (!weapon) return;
    const now = this.now();
    if (now - m.lastDecorShotAt < (1000 / weapon.fireRate) / HIT_RATE_MARGIN) return;
    m.lastDecorShotAt = now;
    const destroyed: number[] = [];
    for (const r of rays.slice(0, weapon.pellets)) {
      if (Math.hypot(r.from.x - m.pos.x, r.from.y - m.pos.y, r.from.z - m.pos.z) > THROW_ORIGIN_MARGIN) continue;
      if (Math.hypot(r.to.x - r.from.x, r.to.y - r.from.y, r.to.z - r.from.z) > weapon.range + 2) continue;
      const cell = this.breakables.shot(r.to, weapon.damagePerShot);
      if (cell !== null) destroyed.push(cell);
    }
    if (destroyed.length > 0) this.broadcast({ type: 'breaks', cells: destroyed });
  }

  /** Touche annoncée par le tireur : vérifiée, puis dégâts calculés ici. */
  hit(id: string, h: { victimId: string; slot: number; head: boolean; distance: number; point: Vec }): void {
    if (this.phase !== 'combat') return;
    const attacker = this.member(id);
    const victim = this.member(h.victimId);
    if (!attacker?.alive || !victim?.alive || victim === attacker || this.answering(id)) return;
    const weaponIds = this.weaponIdsOf(attacker);
    const weaponId = weaponIds[h.slot];
    if (!weaponId) return;
    const a = this.statsOf(attacker);
    const v = this.statsOf(victim);
    const weapon = a.weapons[h.slot]!;
    const now = this.now();
    // cadence : pas plus de touches par seconde que l'arme ne peut en produire
    attacker.hitTimes = attacker.hitTimes.filter((t) => now - t < 1000);
    if (attacker.hitTimes.length >= weapon.fireRate * weapon.pellets * HIT_RATE_MARGIN + 2) return;
    // distance : dans la portée, et cohérente avec les positions connues
    if (h.distance > weapon.range + 2) return;
    if (attacker.pos && victim.pos) {
      const real = Math.hypot(attacker.pos.x - victim.pos.x, attacker.pos.y - victim.pos.y, attacker.pos.z - victim.pos.z);
      if (Math.abs(real - h.distance) > HIT_DISTANCE_MARGIN) return;
    }
    attacker.hitTimes.push(now);

    const traits = this.baseConfig.weapons.weapons.find((w) => w.id === weaponId)?.traits ?? [];
    const out = resolveHit({
      weapon,
      weaponPiercesShield: traits.includes('shield_piercing'),
      attacker: a.player,
      victim: v.player,
      distance: h.distance,
      head: h.head,
      health: victim.health,
      shield: victim.shield,
    });
    if (out.damage <= 0) return;
    victim.health = out.health;
    victim.shield = out.shield;
    attacker.round.damage += out.damage;
    attacker.total.damage += out.damage;
    if (!attacker.shotHit) {
      attacker.shotHit = true;
      attacker.round.hits++;
      attacker.total.hits++;
    }
    if (out.heal > 0) {
      attacker.health = Math.min(a.player.maxHealth, attacker.health + out.heal);
      this.broadcast({ type: 'vitals', id: attacker.id, health: attacker.health, shield: attacker.shield });
    }
    this.broadcast({ type: 'damage', victimId: victim.id, attackerId: attacker.id, amount: out.damage, head: h.head, health: victim.health, shield: victim.shield, killed: out.killed, point: h.point });
    if (out.killed) this.onKill(attacker, victim, h.head);
  }

  private onKill(attacker: Member, victim: Member, head: boolean): void {
    victim.alive = false;
    victim.round.deaths++;
    // mort pendant une question de coffre : échec, coffre bloqué
    const abandoned = this.chests?.abandon(victim.id, this.now());
    if (abandoned) {
      this.onChestOutcome(abandoned);
      this.broadcastChests();
    }
    // sa propre grenade : une mort, pas un kill
    if (attacker !== victim) {
      attacker.round.kills++;
      attacker.total.kills++;
      if (head) attacker.total.headshotKills++;
    }
    victim.livesLeft--;
    if (victim.livesLeft <= 0) {
      this.checkLastStanding();
      return;
    }
    victim.respawnAt = this.now() + this.baseConfig.modes.respawnSeconds * 1000;
  }

  /** Encore en lice : vivant, ou mort avec une vie pour réapparaître. */
  private inPlay(m: Member): boolean {
    return m.alive || m.livesLeft > 0;
  }

  /** Mêlée : la manche se termine quand il ne reste qu'un joueur en lice (ou aucun). */
  private checkLastStanding(): void {
    if (this.phase !== 'combat') return;
    const left = this.members.filter((m) => this.inPlay(m));
    if (left.length <= 1) this.endRound(left[0]?.id ?? null);
  }

  /** Point d'apparition le plus loin de l'adversaire le plus proche. */
  private respawnIndex(m: Member): number {
    const enemies = this.others(m.id).flatMap((o) => (o.alive && o.pos ? [o.pos] : []));
    const spawns = this.arena.spawns;
    if (enemies.length === 0) return m.color % spawns.length;
    let best = 0;
    let bestDist = -1;
    spawns.forEach((s, i) => {
      const d = Math.min(...enemies.map((e) => Math.hypot(s.position[0] - e.x, s.position[2] - e.z)));
      if (d > bestDist) {
        bestDist = d;
        best = i;
      }
    });
    return best;
  }

  private endRound(winnerId: string | null): void {
    if (this.phase !== 'combat') return;
    // questions de coffre en cours et grenades en vol : abandonnées
    this.chests = null;
    this.grenades = [];
    this.breakables = null;
    const winner = winnerId ? this.member(winnerId) : undefined;
    if (winner) winner.roundWins++;
    const matchOver =
      this.members.some((m) => m.roundWins >= this.settings.roundsToWin) || this.round >= this.settings.rounds;
    const roundWins = Object.fromEntries(this.members.map((m) => [m.id, m.roundWins]));
    const stats = this.members.map((m) => m.round);
    // une seule manche : on passe directement au récap (11 → 13)
    if (this.settings.rounds === 1) {
      this.broadcast({ type: 'roundEnd', round: this.round, winnerId, endsAt: this.now(), roundWins, stats, matchOver: true });
      this.finishMatch(this.matchWinner(), false);
      return;
    }
    this.phase = 'roundEnd';
    this.phaseEndsAt = this.now() + this.baseConfig.modes.roundEndSeconds * 1000;
    this.broadcast({ type: 'roundEnd', round: this.round, winnerId, endsAt: this.phaseEndsAt, roundWins, stats, matchOver });
  }

  /** Fin du chrono : selon le réglage, le plus de kills (puis le moins de morts), ou le plus de vies puis de PV. Égalité en tête = null. */
  private timeUpWinner(): string | null {
    const score = (m: Member) =>
      this.settings.winCondition === 'most_kills'
        ? [m.round.kills, -m.round.deaths]
        : [m.livesLeft === Infinity ? 0 : m.livesLeft, m.alive ? m.health : 0];
    return uniqueBest(this.members, score);
  }

  /** Le plus de manches gagnées ; à égalité, le plus de kills sur le match. */
  private matchWinner(): string | null {
    return uniqueBest(this.members, (m) => [m.roundWins, m.total.kills]);
  }

  /** Manches du quiz, plus les questions des coffres (récap 13 ; pas l'hexagone ni les pièces). */
  private recapRounds(m: Member) {
    return m.chestResults.length > 0 ? [...m.rounds, { results: m.chestResults, bestStreak: 0, inventory: [] }] : m.rounds;
  }

  private finishMatch(winnerId: string | null, forfeit: boolean): void {
    this.phase = 'finished';
    const results: PlayerResult[] = this.members.map((m) => {
      const recap = recapView(this.recapRounds(m));
      return {
        id: m.id, name: m.name, color: m.color, roundWins: m.roundWins,
        correct: recap.correct, answered: recap.total, bestStreak: recap.bestStreak,
        kills: m.total.kills, shots: m.total.shots, hits: m.total.hits,
        // pièces : stats de combat seulement (config/economy.json)
        coins: matchCoins({ ...m.total, roundWins: m.roundWins, won: winnerId === m.id }, this.baseConfig.economy),
        axes: computeAxes(
          {
            quiz: quizSamples(m.rounds.flatMap((r) => r.results)),
            bestStreak: recap.bestStreak,
            combat: { shots: m.total.shots, hits: m.total.hits, damage: m.total.damage, opponentHealth: m.total.opponentHealth },
          },
          this.baseConfig.stats,
        ),
      };
    });
    for (const m of this.members) {
      // un abandon pendant le quiz : on garde les réponses déjà données
      if (m.quiz && m.rounds.length < this.round) m.rounds.push({ results: [...m.quiz.results], bestStreak: m.quiz.combo.bestStreak, inventory: [...m.quiz.inventory.all()] });
      this.send(m.id, { type: 'matchEnd', winnerId, forfeit, recap: recapView(this.recapRounds(m)), results });
    }
    for (const m of this.members) m.quiz = null;
    this.broadcastRoom();
  }

  // ---------- horloge ----------

  tick(): void {
    const now = this.now();
    if (this.phase === 'quiz') {
      for (const m of this.members) {
        const q = m.quiz;
        if (!q) continue;
        // budget épuisé pendant le retour : la session lance son compte à rebours puis termine seule
        q.tick(now);
      }
      this.pushQuizViews();
      this.checkQuizEnd();
    } else if (this.phase === 'transition' && now >= this.phaseEndsAt) {
      this.startCombat();
    } else if (this.phase === 'combat') {
      for (const m of this.members) {
        if (!m.alive && now >= m.respawnAt) {
          const { player } = this.statsOf(m);
          m.alive = true;
          m.respawnAt = Infinity;
          m.health = player.maxHealth;
          m.shield = player.shield;
          m.spawnIndex = this.respawnIndex(m);
          this.broadcast({ type: 'respawn', id: m.id, spawnIndex: m.spawnIndex, health: m.health, shield: m.shield });
        } else if (m.alive) {
          const { player } = this.statsOf(m);
          if (player.healthRegen > 0 && m.health < player.maxHealth && now - m.lastVitalsAt >= VITALS_INTERVAL_MS) {
            m.health = Math.min(player.maxHealth, m.health + (player.healthRegen * (now - m.lastVitalsAt)) / 1000);
            m.lastVitalsAt = now;
            this.broadcast({ type: 'vitals', id: m.id, health: m.health, shield: m.shield });
          } else if (now - m.lastVitalsAt >= VITALS_INTERVAL_MS) {
            m.lastVitalsAt = now;
          }
        }
      }
      if (this.chests) {
        for (const outcome of this.chests.tick(now)) this.onChestOutcome(outcome);
        this.broadcastChests();
      }
      for (const g of this.grenades.filter((x) => now >= x.explodeAt)) {
        this.grenades.splice(this.grenades.indexOf(g), 1);
        if (this.phase === 'combat') this.explode(g);
      }
      if (this.phase === 'combat' && now >= this.phaseEndsAt) this.endRound(this.timeUpWinner());
    } else if (this.phase === 'roundEnd' && now >= this.phaseEndsAt) {
      if (this.members.some((m) => m.roundWins >= this.settings.roundsToWin) || this.round >= this.settings.rounds) {
        this.finishMatch(this.matchWinner(), false);
      } else {
        this.startRound();
      }
    }
  }

  // ---------- outils ----------

  member(id: string): Member | undefined {
    return this.members.find((m) => m.id === id);
  }

  private others(id: string): Member[] {
    return this.members.filter((m) => m.id !== id);
  }

  private broadcast(payload: ServerPayload): void {
    for (const m of this.members) this.send(m.id, payload);
  }

  broadcastRoom(): void {
    for (const m of this.members) this.send(m.id, { type: 'room', room: this.roomInfo(m.id) });
  }
}
