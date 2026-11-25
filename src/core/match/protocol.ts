// Messages échangés entre le client et le serveur de match (JSON sur WebSocket).
// Les messages du client sont validés par zod côté serveur : on ne fait jamais confiance au client.
import type { AxisValues } from './matchStats';
import type { CoinReward } from './coins';
import type { InventoryEntry } from '../quiz/inventory';
import { z } from '../zod';
import type { ChestView } from './chests';
import type { QuestionView, QuizView, RecapView } from './quizView';
import type { MatchSettings } from './settings';

const Vec3Msg = z.strictObject({ x: z.number().finite(), y: z.number().finite(), z: z.number().finite() });
const Name = z.string().trim().min(1).max(20);

export const ClientMessageSchema = z.discriminatedUnion('type', [
  z.strictObject({ type: z.literal('create'), name: Name, weaponId: z.string(), settings: z.unknown(), deck: z.unknown() }),
  z.strictObject({ type: z.literal('join'), name: Name, weaponId: z.string(), code: z.string().trim().min(1).max(8) }),
  z.strictObject({ type: z.literal('ready'), ready: z.boolean() }),
  z.strictObject({ type: z.literal('leave') }),
  z.strictObject({ type: z.literal('rematch') }),
  z.strictObject({ type: z.literal('pick'), cardId: z.string().max(32) }),
  z.strictObject({ type: z.literal('answer'), answer: z.number().int().min(0).max(9) }),
  z.strictObject({ type: z.literal('next') }),
  z.strictObject({
    type: z.literal('state'),
    pos: Vec3Msg,
    vel: Vec3Msg,
    yaw: z.number().finite(),
    pitch: z.number().finite(),
    slot: z.number().int().min(0).max(4),
    aiming: z.boolean(),
  }),
  z.strictObject({ type: z.literal('shot'), slot: z.number().int().min(0).max(4), rays: z.array(z.strictObject({ from: Vec3Msg, to: Vec3Msg })).max(16) }),
  z.strictObject({
    type: z.literal('hit'),
    victimId: z.string().max(32),
    slot: z.number().int().min(0).max(4),
    head: z.boolean(),
    distance: z.number().finite().min(0),
    point: Vec3Msg,
  }),
  z.strictObject({ type: z.literal('chestOpen'), chestId: z.number().int().min(0).max(63) }),
  z.strictObject({ type: z.literal('chestAnswer'), answer: z.number().int().min(0).max(9) }),
  z.strictObject({ type: z.literal('throw'), origin: Vec3Msg, dir: Vec3Msg }),
]);

export type ClientMessage = z.infer<typeof ClientMessageSchema>;

export type RoomPhase = 'lobby' | 'quiz' | 'transition' | 'combat' | 'roundEnd' | 'finished';

export interface PlayerInfo {
  id: string;
  name: string;
  weaponId: string;
  ready: boolean;
  connected: boolean;
  /** 0 à 4 : couleur du joueur (--player-1 à --player-5) et son point d'apparition. */
  color: number;
}

export interface RoomInfo {
  code: string;
  hostId: string;
  you: string;
  settings: MatchSettings;
  deckTitle: string;
  deckSize: number;
  phase: RoomPhase;
  round: number;
  players: PlayerInfo[];
}

export interface LoadoutInfo {
  id: string;
  name: string;
  weaponId: string;
  color: number;
  entries: InventoryEntry[];
  correct: number;
  answered: number;
}

export interface FighterInfo {
  id: string;
  name: string;
  weaponId: string;
  color: number;
  entries: InventoryEntry[];
  spawnIndex: number;
  health: number;
  shield: number;
}

export interface RoundStats {
  id: string;
  kills: number;
  deaths: number;
  shots: number;
  hits: number;
  damage: number;
}

export interface PlayerResult {
  id: string;
  name: string;
  color: number;
  roundWins: number;
  correct: number;
  answered: number;
  bestStreak: number;
  kills: number;
  shots: number;
  hits: number;
  /** Hexagone de l'écran 14 (config/stats.json). */
  axes: AxisValues;
  /** Pièces gagnées sur ce match (config/economy.json), calculées par le serveur. */
  coins: CoinReward;
}

/** Messages du serveur. `serverNow` (ms) permet au client d'aligner son horloge. */
export type ServerMessage = { serverNow: number } & (
  | { type: 'error'; message: string }
  | { type: 'room'; room: RoomInfo }
  | { type: 'left' }
  | { type: 'quiz'; view: QuizView }
  | { type: 'transition'; round: number; endsAt: number; arena: string; players: LoadoutInfo[] }
  /** endsAt = 0 : combat sans limite de temps. */
  | { type: 'combatStart'; round: number; endsAt: number; fighters: FighterInfo[] }
  | { type: 'peer'; id: string; pos: { x: number; y: number; z: number }; vel: { x: number; y: number; z: number }; yaw: number; pitch: number; slot: number; aiming: boolean }
  | { type: 'peerShot'; id: string; slot: number; rays: { from: { x: number; y: number; z: number }; to: { x: number; y: number; z: number } }[] }
  | { type: 'damage'; victimId: string; attackerId: string; amount: number; head: boolean; health: number; shield: number; killed: boolean; point: { x: number; y: number; z: number } }
  | { type: 'vitals'; id: string; health: number; shield: number }
  | { type: 'respawn'; id: string; spawnIndex: number; health: number; shield: number }
  /** État des coffres de la carte (diffusé à chaque changement). */
  | { type: 'chests'; chests: ChestView[] }
  /** Question d'un coffre, pour le joueur qui l'a ouvert seulement (sans la bonne réponse). */
  | { type: 'chestQuestion'; chestId: number; question: QuestionView; deadline: number }
  /** Correction de la question d'un coffre, et nouveau nombre de grenades du joueur. */
  | { type: 'chestResult'; chestId: number; correct: boolean; timedOut: boolean; answer: number | null; correctIndex: number; correctText: string; explication: string; grenades: number }
  /** Grenades du joueur (début de manche, lancer). */
  | { type: 'grenades'; count: number }
  /** Grenade lancée : chaque client rejoue la trajectoire (simulateGrenade) à partir de ces valeurs. */
  | { type: 'grenade'; id: number; throwerId: string; origin: { x: number; y: number; z: number }; velocity: { x: number; y: number; z: number }; explodeAt: number }
  | { type: 'explosion'; id: number; point: { x: number; y: number; z: number } }
  /** Morceaux du décor détruits (ids de Destructibles, identiques chez tout le monde). */
  | { type: 'breaks'; cells: number[] }
  /** Un joueur a quitté en plein match (qui continue sans lui). */
  | { type: 'peerLeft'; id: string }
  | { type: 'roundEnd'; round: number; winnerId: string | null; endsAt: number; roundWins: Record<string, number>; stats: RoundStats[]; matchOver: boolean }
  | { type: 'matchEnd'; winnerId: string | null; forfeit: boolean; recap: RecapView; results: PlayerResult[] }
);

export type ServerPayload = ServerMessage extends infer M ? (M extends { serverNow: number } ? Omit<M, 'serverNow'> : never) : never;
