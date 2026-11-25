// 11 · HUD de combat : le duel ou la mêlée FPS (ou le stand de tir, outil de développement).
// Contenu : score, chrono, manche · réticule · vie et bouclier · munitions et arme · bonus actifs ·
// capacités (dash) · fil des éliminations · étiquette de chaque ennemi · coffres (question en 10 s) et grenades.
// En match, le serveur fait foi pour les PV, les morts, les réapparitions et la fin de manche ;
// ce client simule son propre déplacement et annonce ses tirs.
import type { GameConfig } from '../../core/config/gameConfig';
import { CombatSession, IDLE_INPUT, type CombatEvent, type CombatInput, type CombatSummary } from '../../core/combat/combatSession';
import { lookDirection } from '../../core/combat/geometry';
import { simulateGrenade } from '../../core/combat/grenade';
import type { ChestView } from '../../core/match/chests';
import type { ClientMessage, FighterInfo, ServerMessage } from '../../core/match/protocol';
import type { QuestionView } from '../../core/match/quizView';
import type { InventoryEntry } from '../../core/quiz/inventory';
import { readSceneColors } from '../../render/arena';
import { CombatScene, SCOPE_ZOOM } from '../../render/combatScene';
import { button, gainTag, lootColumn } from '../components';
import { h } from '../dom';
import { formatClock } from '../format';
import { icon, weaponIcon } from '../icons';
import type { Screen } from '../screen';
import { sound } from '../sound';
import { getReduceEffects, setReduceEffects } from '../settings';
import { store } from '../store';

export interface CombatNet {
  selfId: string;
  /** Vies par manche du salon (0 = réapparition). */
  lives: number;
  round: number;
  rounds: number;
  endsAt: number;
  fighters: FighterInfo[];
  serverNow(): number;
  send(message: ClientMessage): void;
}

export interface CombatScreenOptions {
  config: GameConfig;
  modeId: string;
  /** Carte choisie par l'hôte (sinon celle du mode). */
  arenaId?: string;
  weaponId: string;
  entries: readonly InventoryEntry[];
  /** null = stand de tir local (cibles), sinon duel en réseau. */
  net: CombatNet | null;
  /** Stand de tir seulement : fin du chrono ou « Terminer ». */
  onEnd?(summary: CombatSummary): void;
}

export interface CombatScreen extends Screen {
  onServer(message: ServerMessage): void;
}

/** Les tirs de l'adversaire sont plus discrets que les siens. */
const ENEMY_SHOT_VOLUME = 0.5;
const MAX_PITCH = (89 * Math.PI) / 180;
const HITMARKER_MS = 160;
const END_DELAY_MS = 900;
const DAMAGE_NUMBER_MS = 750;
/** Fréquence d'envoi de la position au serveur. */
const STATE_INTERVAL_MS = 50;
/** Lissage de la position affichée de l'adversaire (par seconde). */
const PEER_SMOOTHING = 15;
const KILLFEED_MS = 4000;
const HURT_MS = 350;
/** Au-delà de cette distance (m), une explosion ne s'entend presque plus. */
const EXPLOSION_HEARING = 40;

type Vec = { x: number; y: number; z: number };

/** Un adversaire vu par ce client : position lissée, PV, étiquette. */
interface Enemy {
  info: FighterInfo;
  /** Armes par emplacement, dans le même ordre que CombatSession (arme du loadout, puis armes données par les bonus). */
  weapons: string[];
  health: number;
  maxHealth: number;
  target: Vec | null;
  shown: Vec | null;
  yaw: number;
  alive: boolean;
  label: HTMLElement;
  fill: HTMLElement;
}

export function combatScreen(o: CombatScreenOptions): CombatScreen {
  const { config, net } = o;
  const self = net?.fighters.find((f) => f.id === net.selfId) ?? null;
  const enemies = new Map<string, Enemy>();
  for (const f of net?.fighters ?? []) {
    if (f.id === net?.selfId) continue;
    const fill = h('div', { class: 'bar__fill enemy-label__fill' });
    const label = h('div', { class: 'enemy-label', style: { '--player': `var(--player-${f.color + 1})` } }, h('span', { text: f.name }), h('div', { class: 'bar' }, fill));
    label.hidden = true;
    enemies.set(f.id, {
      info: f,
      weapons: [f.weaponId, ...new Set(f.entries.flatMap((e) => (e.grantsWeapon ? [e.grantsWeapon] : [])))],
      health: f.health,
      maxHealth: Math.max(1, f.health),
      target: null,
      shown: null,
      yaw: 0,
      alive: false,
      label,
      fill,
    });
  }
  const session = new CombatSession({
    config,
    modeId: o.modeId,
    arenaId: o.arenaId,
    weaponId: o.weaponId,
    entries: o.entries,
    seed: Math.floor(Math.random() * 2 ** 32),
    spawnIndex: self?.spawnIndex ?? 0,
    opponents: [...enemies.keys()],
    networked: net !== null,
  });
  if (self) session.setVitals(self.health, self.shield);
  let reduceEffects = getReduceEffects();
  const sensitivity = config.player.controls.mouseSensitivity * store.sensitivity();
  const nameOf = (id: string) => net?.fighters.find((f) => f.id === id)?.name ?? '';

  // ---------- DOM ----------
  const canvas = h('canvas', { class: 'combat__canvas', attrs: { 'aria-label': 'Arène' } });
  const scope = h('div', { class: 'scope', attrs: { 'aria-hidden': 'true' } });
  const hurt = h('div', { class: 'hurt', attrs: { 'aria-hidden': 'true' } });
  // flash d'écran d'une explosion proche (jamais avec « réduire flashs et secousses » : scene.explode renvoie 0)
  const blastFlash = h('div', { class: 'blast-flash', attrs: { 'aria-hidden': 'true' } });

  const timer = h('span', { class: 'hud__timer' });
  const score = h('span', { class: 'hud__kills' });
  const killPop = h('span', { class: 'hud__pop' });
  const roundLabel = net && net.rounds > 1 ? h('span', { class: 'hud__round', text: `Manche ${net.round}` }) : null;
  const top = h('div', { class: 'hud__top' }, roundLabel, timer, h('span', { class: 'hud__kills-wrap', html: icon('target') }, score, killPop));

  const crosshair = h('div', { class: 'crosshair', attrs: { 'aria-hidden': 'true' } }, h('i'), h('i'), h('i'), h('i'), h('b'));
  const hitmarker = h('div', { class: 'hitmarker', attrs: { 'aria-hidden': 'true' } }, h('i'), h('i'), h('i'), h('i'));

  const shieldFill = h('div', { class: 'bar__fill bar__fill--shield' });
  const healthFill = h('div', { class: 'bar__fill bar__fill--health' });
  const healthText = h('span', { class: 'vitals__number' });
  const shieldBar = h('div', { class: 'bar bar--shield' }, shieldFill);
  const dashPips = h('div', { class: 'vitals__dash', attrs: { 'aria-label': 'Dash' } });
  const jumpPips = h('div', { class: 'vitals__dash vitals__jump', attrs: { 'aria-label': 'Sauts en plus' } });
  const vitals = h('div', { class: 'hud__vitals' }, healthText, h('div', { class: 'vitals__bars' }, shieldBar, h('div', { class: 'bar' }, healthFill)), dashPips, jumpPips);

  const ammoNow = h('span', { class: 'ammo__now' });
  const ammoMax = h('span', { class: 'ammo__max' });
  const weaponArt = h('div', { class: 'ammo__art' });
  const weaponName = h('div', { class: 'ammo__weapon' });
  let shownWeaponId = '';
  const reloadHint = h('div', { class: 'ammo__hint' });
  const slotsLine = h('div', { class: 'ammo__slots' });
  const grenadeCountEl = h('span', { class: 'ammo__grenade-count' });
  const grenadeLine = h('div', { class: 'ammo__grenades', attrs: { 'aria-label': 'Grenades' }, html: icon('grenade') }, grenadeCountEl, h('kbd', { text: 'G' }));
  grenadeLine.hidden = !net;
  const ammo = h('div', { class: 'hud__ammo' }, weaponArt, h('div', { class: 'ammo__count' }, ammoNow, ammoMax), weaponName, reloadHint, slotsLine, grenadeLine);

  // coffres : invite quand on est à portée, question en bas de l'écran
  const chestPrompt = h('div', { class: 'chest-prompt', attrs: { 'aria-live': 'polite' } });
  chestPrompt.hidden = true;
  const chestTimer = h('div', { class: 'chest-q__timer', attrs: { 'aria-hidden': 'true' } }, h('i'));
  const chestText = h('p', { class: 'chest-q__text' });
  const chestChoices = h('ol', { class: 'chest-q__choices' });
  const chestNote = h('p', { class: 'chest-q__note', attrs: { 'aria-live': 'polite' } });
  const chestPanel = h('div', { class: 'chest-q', attrs: { role: 'dialog', 'aria-label': 'Question du coffre' } }, chestTimer, chestText, chestChoices, chestNote);
  chestPanel.hidden = true;

  const killfeed = h('ul', { class: 'killfeed', attrs: { 'aria-live': 'polite' } });
  const deathBanner = h('div', { class: 'death', attrs: { 'aria-live': 'assertive' } });

  const damageLayer = h('div', { class: 'dmg-layer', attrs: { 'aria-hidden': 'true' } });
  const hud = h('div', { class: 'hud' }, damageLayer, ...[...enemies.values()].map((e) => e.label), top, killfeed, crosshair, hitmarker, vitals, ammo, lootColumn(o.entries), deathBanner, chestPrompt, chestPanel);

  // ---------- départ / pause ----------
  const playButton = button({ kind: 'primary', size: 'lg', icon: 'play', label: 'Jouer', onClick: () => start() });
  const effectsToggle = h('button', {
    class: 'choice',
    attrs: { type: 'button', 'aria-pressed': String(reduceEffects) },
    on: {
      click: () => {
        reduceEffects = !reduceEffects;
        setReduceEffects(reduceEffects);
        effectsToggle.setAttribute('aria-pressed', String(reduceEffects));
        scene?.setOptions({ reduceEffects });
      },
    },
  }, h('span', { html: icon('eye') }), 'Réduire flashs et secousses');
  const endButton = net ? null : h('button', { class: 'choice', attrs: { type: 'button' }, on: { click: () => finish() } }, h('span', { html: icon('next') }), 'Terminer');
  const message = h('p', { class: 'overlay__message', attrs: { 'aria-live': 'polite' } });

  const controls = ['ZQSD bouger', 'Espace sauter', 'Clic tirer', 'Clic droit viser', 'R recharger'];
  if (session.stats.dashCharges > 0) controls.push('Maj dash');
  if (session.slots.length > 1) controls.push('1 · 2 changer d’arme');
  if (net && (session.arena.chests?.length ?? 0) > 0) controls.push('E coffre', 'G grenade');
  const gains = o.entries.length > 0 ? h('ul', { class: 'gains overlay__gains' }, ...o.entries.map(gainTag)) : null;
  const overlay = h(
    'div',
    { class: 'overlay' },
    h('div', { class: 'info', text: net ? `Le combat continue · clique pour reprendre la main` : `${session.mode.label} · ${formatClock(session.duration * 1000)}` }),
    gains,
    playButton,
    h('p', { class: 'overlay__controls', text: controls.join(' · ') }),
    message,
    h('div', { class: 'choices' }, effectsToggle, endButton),
  );

  const el = h('main', { class: 'combat' }, canvas, scope, hurt, blastFlash, hud, overlay);

  // ---------- rendu ----------
  let scene: CombatScene | null = null;
  try {
    scene = new CombatScene(canvas, readSceneColors(session.arena.look?.theme), session, { reduceEffects });
    scene.loadWeapons(config).catch((error: Error) => (message.textContent = error.message));
    scene.loadDecor(config).catch((error: Error) => (message.textContent = error.message));
    scene.loadBreakables(config).catch((error: Error) => (message.textContent = error.message));
    scene.loadPickups(config).catch((error: Error) => (message.textContent = error.message));
    for (const { info } of enemies.values()) {
      const assetId = config.weapons.weapons.find((w) => w.id === info.weaponId)?.asset;
      const def = assetId ? config.assets.assets[assetId] : undefined;
      scene.addOpponent(info.id, info.color, assetId && def ? { id: assetId, def } : null).catch(() => undefined);
    }
  } catch (error) {
    message.textContent = `La 3D ne démarre pas sur ce navigateur (${(error as Error).message}).`;
  }

  // ---------- entrées ----------
  const keys = new Set<string>();
  let fire = false;
  let aim = false;
  let yaw = session.yaw;
  let pitch = 0;
  let slot: number | null = null;
  let playing = false;
  let ended = false;
  let devInput: Partial<CombatInput> = {};

  const pressed = (...codes: string[]) => codes.some((c) => keys.has(c));
  const readInput = (): CombatInput => {
    if (!playing && Object.keys(devInput).length === 0) return { ...IDLE_INPUT, yaw, pitch };
    // question de coffre : on peut tourner la tête, rien d'autre
    if (chestQuestion) return { ...IDLE_INPUT, yaw, pitch };
    return {
      ...IDLE_INPUT,
      forward: (pressed('KeyW', 'ArrowUp') ? 1 : 0) - (pressed('KeyS', 'ArrowDown') ? 1 : 0),
      right: (pressed('KeyD', 'ArrowRight') ? 1 : 0) - (pressed('KeyA', 'ArrowLeft') ? 1 : 0),
      jump: pressed('Space'),
      dash: pressed('ShiftLeft', 'ShiftRight'),
      reload: pressed('KeyR'),
      fire,
      aim,
      slot,
      yaw,
      pitch,
      ...devInput,
    };
  };
  const releaseAll = () => {
    keys.clear();
    fire = false;
    aim = false;
  };

  function start() {
    if (ended) return;
    message.textContent = '';
    const request = canvas.requestPointerLock() as Promise<void> | undefined;
    request?.catch?.(() => (message.textContent = 'La souris n’a pas pu être capturée. Clique dans la fenêtre puis réessaie.'));
  }

  function setPlaying(value: boolean) {
    playing = value && !ended;
    overlay.hidden = playing || ended;
    el.classList.toggle('is-playing', playing);
    if (!playing) releaseAll();
  }

  /** Stand de tir : fin locale. En match, c'est le serveur qui termine la manche. */
  function finish() {
    if (ended) return;
    ended = true;
    setPlaying(false);
    if (document.pointerLockElement) document.exitPointerLock();
    el.classList.add('is-ended');
    window.setTimeout(() => o.onEnd?.(session.summary()), END_DELAY_MS);
  }

  const onLockChange = () => setPlaying(document.pointerLockElement === canvas);
  const onKeyDown = (e: KeyboardEvent) => {
    if (!playing) return;
    const digit = /^(?:Digit|Numpad)([1-9])$/.exec(e.code);
    if (chestQuestion && digit) {
      answerChest(Number(digit[1]) - 1);
      return;
    }
    if (e.code === 'KeyE' && !e.repeat) tryOpenChest();
    if (e.code === 'KeyG' && !e.repeat) throwGrenade();
    keys.add(e.code);
    if (e.code === 'Digit1' || e.code === 'Numpad1') slot = 0;
    if (e.code === 'Digit2' || e.code === 'Numpad2') slot = 1;
    if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) e.preventDefault();
  };
  const onKeyUp = (e: KeyboardEvent) => keys.delete(e.code);
  const onMouseDown = (e: MouseEvent) => {
    if (!playing) return;
    if (e.button === 0) fire = true;
    if (e.button === 2) aim = true;
  };
  const onMouseUp = (e: MouseEvent) => {
    if (e.button === 0) fire = false;
    if (e.button === 2) aim = false;
  };
  const onMouseMove = (e: MouseEvent) => {
    if (!playing || document.pointerLockElement !== canvas) return;
    const sens = sensitivity / session.zoom;
    yaw -= e.movementX * sens;
    pitch = Math.max(-MAX_PITCH, Math.min(MAX_PITCH, pitch - e.movementY * sens));
  };
  const onContextMenu = (e: Event) => e.preventDefault();
  const onBlur = () => releaseAll();
  document.addEventListener('pointerlockchange', onLockChange);
  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('keyup', onKeyUp);
  window.addEventListener('mousedown', onMouseDown);
  window.addEventListener('mouseup', onMouseUp);
  window.addEventListener('mousemove', onMouseMove);
  window.addEventListener('blur', onBlur);
  el.addEventListener('contextmenu', onContextMenu);

  // ---------- coffres et grenades (état donné par le serveur) ----------
  const pickups = config.pickups;
  const chestSpots = (session.arena.chests ?? []).map((c) => ({ x: c.position[0], y: c.position[1], z: c.position[2] }));
  let chestStates: ChestView[] = chestSpots.map((_, id) => ({ id, status: 'ready', until: 0 }));
  let chestQuestion: { chestId: number; question: QuestionView; deadline: number } | null = null;
  let chestFeedbackUntil = 0;
  let promptKey = '';
  let grenadeCount = 0;
  let lastThrowAt = -Infinity;

  /** Coffre le plus proche à portée d'ouverture, ou null. */
  function nearestChest(): number | null {
    const p = session.move.pos;
    let best: number | null = null;
    let bestDistance = Infinity;
    chestSpots.forEach((c, id) => {
      const d = Math.hypot(p.x - c.x, p.y - c.y, p.z - c.z);
      if (d <= pickups.chests.openRadius && d < bestDistance) {
        best = id;
        bestDistance = d;
      }
    });
    return best;
  }

  function tryOpenChest() {
    if (!net || chestQuestion || !session.alive) return;
    const id = nearestChest();
    if (id !== null && chestStates[id]?.status === 'ready') net.send({ type: 'chestOpen', chestId: id });
  }

  function answerChest(index: number) {
    if (!net || !chestQuestion || index >= chestQuestion.question.choix.length) return;
    if (chestChoices.querySelector('.is-picked')) return;
    chestChoices.children[index]?.classList.add('is-picked');
    net.send({ type: 'chestAnswer', answer: index });
  }

  function throwGrenade() {
    if (!net || chestQuestion || !session.alive || grenadeCount <= 0) return;
    const now = performance.now();
    if (now - lastThrowAt < pickups.grenade.throwCooldownSeconds * 1000) return;
    lastThrowAt = now;
    net.send({ type: 'throw', origin: session.eye, dir: lookDirection(session.yaw, session.viewPitch) });
  }

  function showChestQuestion(q: { chestId: number; question: QuestionView; deadline: number }) {
    chestQuestion = q;
    chestFeedbackUntil = 0;
    chestPanel.hidden = false;
    chestPanel.classList.remove('is-right', 'is-wrong');
    chestText.textContent = q.question.enonce;
    chestChoices.replaceChildren(...q.question.choix.map((text, i) => h('li', {}, h('kbd', { text: String(i + 1) }), h('span', { text }))));
    chestNote.textContent = 'Touches 1 à ' + q.question.choix.length;
    sound.play('quiz.pick');
  }

  function showChestResult(r: Extract<ServerMessage, { type: 'chestResult' }>) {
    chestQuestion = null;
    grenadeCount = r.grenades;
    chestFeedbackUntil = performance.now() + pickups.chests.feedbackSeconds * 1000;
    chestPanel.classList.toggle('is-right', r.correct);
    chestPanel.classList.toggle('is-wrong', !r.correct);
    [...chestChoices.children].forEach((li, i) => {
      li.classList.toggle('is-right', i === r.correctIndex);
      li.classList.toggle('is-wrong', !r.correct && i === r.answer);
    });
    chestNote.textContent = r.correct
      ? `Bonne réponse · +${pickups.chests.reward.grenades} ${pickups.grenade.label.toLowerCase()}`
      : `${r.timedOut ? 'Temps écoulé' : 'Raté'} · ${r.correctText} · ${r.explication}`;
    sound.play(r.correct ? 'quiz.correct' : r.timedOut ? 'quiz.timeout' : 'quiz.wrong');
  }

  function updateChestHud() {
    if (!net) return;
    const now = performance.now();
    if (chestQuestion) {
      const total = pickups.chests.answerSeconds * 1000;
      const left = Math.max(0, chestQuestion.deadline - net.serverNow());
      chestTimer.style.setProperty('--left', String(left / total));
      chestTimer.classList.toggle('is-low', left <= 3000);
    } else if (!chestPanel.hidden && now >= chestFeedbackUntil) {
      chestPanel.hidden = true;
    }
    // invite : seulement à portée, hors question et en vie
    const id = chestPanel.hidden && session.alive ? nearestChest() : null;
    const state = id !== null ? chestStates[id] : undefined;
    let key = '';
    if (state?.status === 'ready') key = 'ready';
    else if (state?.status === 'busy') key = 'busy';
    else if (state?.status === 'locked') key = `locked:${Math.max(0, Math.ceil((state.until - net.serverNow()) / 1000))}`;
    if (key !== promptKey) {
      promptKey = key;
      chestPrompt.hidden = key === '';
      chestPrompt.classList.toggle('is-locked', key !== 'ready');
      if (key === 'ready') chestPrompt.replaceChildren(h('kbd', { text: 'E' }), h('span', { text: pickups.chests.label }));
      else if (key === 'busy') chestPrompt.replaceChildren(h('span', { html: icon('hourglass') }), h('span', { text: `${pickups.chests.label} occupé` }));
      else if (key) chestPrompt.replaceChildren(h('span', { html: icon('lock') }), h('span', { text: `${pickups.chests.label} · ${key.split(':')[1]} s` }));
    }
    grenadeCountEl.textContent = String(grenadeCount);
    grenadeLine.classList.toggle('is-empty', grenadeCount === 0);
  }

  /** Explosion à l'écran : effet 3D, secousse, flash d'écran selon la distance (rien de tout ça avec l'option d'accessibilité). */
  function onExplosionFx(id: number, point: { x: number; y: number; z: number }) {
    const felt = scene?.explode(id, point, pickups.grenade.blastRadius) ?? 0;
    if (felt <= 0.02) return;
    blastFlash.style.setProperty('--felt', felt.toFixed(2));
    blastFlash.classList.remove('is-on');
    void blastFlash.offsetWidth;
    blastFlash.classList.add('is-on');
  }

  // ---------- état du match (donné par le serveur) ----------
  const kills = new Map<string, number>();
  let lastStateAt = 0;
  let hurtUntil = 0;

  function addKill(attackerId: string, victimId: string, head: boolean) {
    kills.set(attackerId, (kills.get(attackerId) ?? 0) + 1);
    const item = h('li', {}, h('strong', { text: nameOf(attackerId) }), h('span', { html: icon(head ? 'target' : 'cross') }), h('span', { text: nameOf(victimId) }));
    killfeed.prepend(item);
    while (killfeed.childElementCount > 4) killfeed.lastElementChild?.remove();
    window.setTimeout(() => item.remove(), KILLFEED_MS);
    if (attackerId === net?.selfId) popKill();
  }

  function onServer(msg: ServerMessage) {
    if (!net) return;
    switch (msg.type) {
      case 'peer': {
        const e = enemies.get(msg.id);
        if (!e) break;
        e.target = msg.pos;
        e.shown ??= { ...msg.pos };
        e.yaw = msg.yaw;
        e.alive = true;
        scene?.setOpponentAim(msg.id, msg.pitch, msg.aiming);
        break;
      }
      case 'peerShot': {
        const e = enemies.get(msg.id);
        scene?.remoteShot(msg.id, msg.rays);
        if (e) sound.play(`shot.${e.weapons[msg.slot] ?? e.info.weaponId}`, { volume: ENEMY_SHOT_VOLUME, fallback: 'shot.default' });
        break;
      }
      case 'peerLeft': {
        const e = enemies.get(msg.id);
        if (!e) break;
        e.alive = false;
        e.label.hidden = true;
        session.setOpponent(msg.id, { position: e.shown ?? { x: 0, y: -100, z: 0 }, yaw: e.yaw, alive: false });
        enemies.delete(msg.id);
        break;
      }
      case 'damage':
        if (msg.victimId === net.selfId) {
          session.setVitals(msg.health, msg.shield);
          sound.play(msg.killed ? 'combat.death' : 'combat.hurt');
          if (!reduceEffects) hurtUntil = performance.now() + HURT_MS;
          if (msg.killed) {
            session.die();
            deathBanner.textContent = net.lives === 0 ? 'Éliminé · réapparition…' : 'Éliminé';
          }
        } else {
          const e = enemies.get(msg.victimId);
          if (e) {
            e.health = msg.health;
            if (msg.killed) e.alive = false;
            else scene?.opponentHurt(msg.victimId);
          }
          if (msg.attackerId === net.selfId) showDamage(msg.point, msg.amount, msg.head);
          if (msg.killed && msg.attackerId === net.selfId) sound.play('combat.kill');
        }
        if (msg.killed) addKill(msg.attackerId, msg.victimId, msg.head);
        break;
      case 'vitals':
        if (msg.id === net.selfId) session.setVitals(msg.health, msg.shield);
        else {
          const e = enemies.get(msg.id);
          if (e) e.health = msg.health;
        }
        break;
      case 'respawn':
        if (msg.id === net.selfId) {
          session.respawn(msg.spawnIndex, msg.health, msg.shield);
          yaw = session.yaw;
          pitch = 0;
          deathBanner.textContent = '';
        } else {
          const e = enemies.get(msg.id);
          if (e) {
            e.health = msg.health;
            e.maxHealth = Math.max(e.maxHealth, msg.health);
            e.alive = true;
            e.shown = null;
          }
        }
        break;
      case 'chests':
        chestStates = msg.chests;
        for (const c of msg.chests) scene?.setChestStatus(c.id, c.status);
        promptKey = '?'; // force le redessin de l'invite (≠ '' qui veut dire « cachée »)
        break;
      case 'chestQuestion':
        showChestQuestion(msg);
        break;
      case 'chestResult':
        showChestResult(msg);
        break;
      case 'grenades':
        grenadeCount = msg.count;
        break;
      case 'grenade': {
        // même trajectoire que le serveur, rejouée à partir du lancer
        const path = simulateGrenade(session.world, msg.origin, msg.velocity, pickups.grenade);
        const elapsed = (net.serverNow() - (msg.explodeAt - pickups.grenade.fuseSeconds * 1000)) / 1000;
        scene?.addGrenade(msg.id, path, elapsed);
        if (msg.throwerId === net.selfId) sound.play('combat.grenadeThrow');
        break;
      }
      case 'explosion': {
        onExplosionFx(msg.id, msg.point);
        const p = session.eye;
        const d = Math.hypot(p.x - msg.point.x, p.y - msg.point.y, p.z - msg.point.z);
        sound.play('combat.explosion', { volume: Math.max(0.15, 1 - d / EXPLOSION_HEARING) });
        break;
      }
      case 'breaks':
        scene?.breakCells(session.breakables.remove(msg.cells));
        break;
      case 'roundEnd':
        chestQuestion = null;
        chestPanel.hidden = true;
        ended = true;
        setPlaying(false);
        if (document.pointerLockElement) document.exitPointerLock();
        el.classList.add('is-ended');
        break;
    }
  }

  // ---------- HUD ----------
  const maxShield = Math.max(session.shield, 1);
  let hitUntil = 0;
  let hitClass = '';
  let lastKills = 0;

  function popKill() {
    killPop.textContent = '+1';
    killPop.classList.remove('is-on');
    void killPop.offsetWidth;
    killPop.classList.add('is-on');
  }

  function showDamage(point: { x: number; y: number; z: number }, damage: number, head: boolean) {
    const at = scene?.project(point);
    if (!at) return;
    const tag = h('span', {
      class: `dmg${head ? ' is-head' : ''}`,
      text: String(Math.round(damage)),
      style: { left: `${at.x + (Math.random() - 0.5) * 24}px`, top: `${at.y}px` },
    });
    damageLayer.append(tag);
    window.setTimeout(() => tag.remove(), DAMAGE_NUMBER_MS);
  }

  function updateHud(events: readonly CombatEvent[]) {
    const now = performance.now();
    for (const e of events) {
      if (e.type === 'hit' || e.type === 'kill') {
        const cls = e.type === 'kill' ? 'is-kill' : e.head ? 'is-head' : 'is-hit';
        if (cls === 'is-kill' || hitClass !== 'is-kill' || now > hitUntil) hitClass = cls;
        hitUntil = now + HITMARKER_MS;
      }
      // stand de tir : dégâts calculés ici ; en duel, on attend la confirmation du serveur
      if (e.type === 'hit' && e.playerId === null) showDamage(e.point, e.damage, e.head);
    }
    hitmarker.className = `hitmarker ${now < hitUntil ? hitClass : ''}`;
    hurt.classList.toggle('is-on', now < hurtUntil);

    if (net) {
      // endsAt = 0 : sans limite de temps
      const unlimited = net.endsAt <= 0;
      timer.textContent = unlimited ? '∞' : formatClock(Math.max(0, net.endsAt - net.serverNow()));
      timer.classList.toggle('is-low', !unlimited && net.endsAt - net.serverNow() <= 10_000);
      // mes kills · ceux du meilleur adversaire
      const best = Math.max(0, ...[...enemies.keys()].map((id) => kills.get(id) ?? 0));
      score.textContent = `${kills.get(net.selfId) ?? 0} · ${best}`;
      for (const e of enemies.values()) {
        // étiquette seulement si l'ennemi est en vue (sinon elle trahirait sa position à travers les murs)
        const anchor = e.alive ? scene?.labelAnchor(e.info.id) : null;
        const visible = anchor !== null && anchor !== undefined && session.canSee({ x: anchor.x, y: anchor.y - 0.4, z: anchor.z });
        const at = visible ? scene?.project(anchor) : null;
        e.label.hidden = !at;
        if (at) e.label.style.transform = `translate(${at.x}px, ${at.y}px) translate(-50%, -100%)`;
        e.fill.style.transform = `scaleX(${Math.max(0, e.health / e.maxHealth)})`;
      }
    } else {
      timer.textContent = formatClock(session.timeLeft * 1000);
      timer.classList.toggle('is-low', session.timeLeft <= 10);
      score.textContent = String(session.score.kills);
      if (session.score.kills !== lastKills) {
        lastKills = session.score.kills;
        popKill();
      }
    }

    updateChestHud();
    healthText.textContent = String(Math.ceil(session.health));
    healthFill.style.transform = `scaleX(${Math.max(0, session.health / session.stats.maxHealth)})`;
    shieldBar.hidden = session.shield <= 0;
    shieldFill.style.transform = `scaleX(${Math.max(0, session.shield / maxShield)})`;
    const charges = session.stats.dashCharges;
    if (dashPips.childElementCount !== charges) dashPips.replaceChildren(...Array.from({ length: charges }, () => h('i')));
    [...dashPips.children].forEach((pip, i) => pip.classList.toggle('on', i < session.move.dashCharges));
    const jumps = session.stats.extraJumps;
    if (jumpPips.childElementCount !== jumps) jumpPips.replaceChildren(...Array.from({ length: jumps }, () => h('i')));
    [...jumpPips.children].forEach((pip, i) => pip.classList.toggle('on', i < jumps - session.move.airJumpsUsed));

    const state = session.weapon.state;
    ammoNow.textContent = state.reloading ? '…' : String(state.ammo);
    ammoMax.textContent = `/${state.stats.magazineSize}`;
    if (session.weapon.weaponId !== shownWeaponId) {
      shownWeaponId = session.weapon.weaponId;
      weaponArt.innerHTML = weaponIcon(shownWeaponId);
      weaponName.textContent = session.weapon.label;
    }
    reloadHint.textContent = state.reloading ? 'Rechargement' : state.ammo === 0 ? 'R pour recharger' : '';
    ammo.classList.toggle('is-empty', state.ammo === 0 && !state.reloading);
    ammo.style.setProperty('--reload', String(state.reloadProgress(session.time)));
    if (session.slots.length > 1) slotsLine.textContent = session.slots.map((s, i) => `${i + 1} ${s.label}`).join(' · ');

    const scoped = session.zoom >= SCOPE_ZOOM;
    scope.classList.toggle('is-on', scoped);
    crosshair.hidden = scoped || !session.alive;
    const speed = Math.hypot(session.move.vel.x, session.move.vel.z);
    const gap = 5 + state.recoilDeg * 2.5 + state.stats.spreadDeg * 2 + (session.move.onGround ? speed * 0.4 : 6);
    crosshair.style.setProperty('--gap', `${gap.toFixed(1)}px`);
  }

  // ---------- boucle ----------
  let raf = 0;
  let last = performance.now();
  const advance = (dt: number) => {
    let events: CombatEvent[] = [];
    const simulate = net ? !ended : playing && !session.finished;
    if (simulate) {
      const k = Math.min(1, dt * PEER_SMOOTHING);
      for (const e of enemies.values()) {
        if (!e.target) continue;
        const from = e.shown ?? e.target;
        e.shown = { x: from.x + (e.target.x - from.x) * k, y: from.y + (e.target.y - from.y) * k, z: from.z + (e.target.z - from.z) * k };
        session.setOpponent(e.info.id, { position: e.shown, yaw: e.yaw, alive: e.alive });
      }
      events = session.step(readInput(), dt);
      slot = null;
      if (net) sendNetwork(events);
    }
    scene?.update(simulate ? dt : 0, events);
    playSounds(events);
    updateHud(events);
    if (!net && events.some((e) => e.type === 'end')) finish();
  };

  /** Sons des événements de ce client (ses tirs, ses touches) ; ceux venus du serveur sont dans onServer. */
  function playSounds(events: readonly CombatEvent[]) {
    for (const e of events) {
      switch (e.type) {
        case 'shot':
          sound.play(`shot.${session.slots[e.slot]?.weaponId ?? ''}`, { fallback: 'shot.default' });
          break;
        case 'empty':
          sound.play('combat.empty');
          break;
        case 'reload':
          sound.play('combat.reload');
          break;
        case 'reloaded':
          sound.play('combat.reloaded');
          break;
        case 'switch':
          sound.play('combat.switch');
          break;
        case 'hit':
          sound.play(e.head ? 'combat.headshot' : 'combat.hit');
          break;
        case 'kill':
          // cibles du stand de tir ; l'élimination d'un joueur est annoncée par le serveur
          sound.play('combat.kill');
          break;
      }
    }
  }

  function sendNetwork(events: readonly CombatEvent[]) {
    if (!net) return;
    for (const e of events) {
      if (e.type === 'shot') net.send({ type: 'shot', slot: e.slot, rays: e.rays.slice(0, 16) });
      if (e.type === 'hit' && e.playerId) {
        net.send({ type: 'hit', victimId: e.playerId, slot: session.activeSlot, head: e.head, distance: e.distance, point: e.point });
      }
    }
    const now = performance.now();
    if (session.alive && now - lastStateAt >= STATE_INTERVAL_MS) {
      lastStateAt = now;
      const { pos, vel } = session.move;
      net.send({ type: 'state', pos: { ...pos }, vel: { ...vel }, yaw: session.yaw, pitch: session.pitch, slot: session.activeSlot, aiming: session.aiming });
    }
  }

  const frame = (time: number) => {
    raf = requestAnimationFrame(frame);
    const dt = Math.min(0.1, (time - last) / 1000);
    last = time;
    advance(dt);
  };
  raf = requestAnimationFrame(frame);
  setPlaying(false);

  if (import.meta.env.DEV) {
    Object.assign(window, {
      __revizCombat: {
        session,
        play: () => setPlaying(true),
        pause: () => setPlaying(false),
        input: (partial: Partial<CombatInput>) => (devInput = partial),
        look: (newYaw: number, newPitch: number) => ((yaw = newYaw), (pitch = newPitch)),
        // explosion de test au point donné (rendu seulement, aucun dégât)
        blast: (x: number, y: number, z: number) => onExplosionFx(-1, { x, y, z }),
        tick: (frames = 1) => {
          for (let i = 0; i < frames; i++) advance(1 / 60);
        },
      },
    });
  }

  return {
    el,
    onServer,
    focus: () => playButton.focus({ preventScroll: true }),
    destroy() {
      cancelAnimationFrame(raf);
      document.removeEventListener('pointerlockchange', onLockChange);
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('mousedown', onMouseDown);
      window.removeEventListener('mouseup', onMouseUp);
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('blur', onBlur);
      if (document.pointerLockElement) document.exitPointerLock();
      scene?.dispose();
      scene = null;
    },
  };
}
