// Branche le serveur de match (src/core/match) sur un serveur HTTP Node via WebSocket.
// Utilisé par Vite (npm run dev / npm run preview) : un seul port pour le jeu et le réseau.
import type { IncomingMessage, Server } from 'node:http';
import type { Duplex } from 'node:stream';
import { WebSocketServer, type WebSocket } from 'ws';
import quiz from '../config/quiz.json';
import bonuses from '../config/bonuses.json';
import weapons from '../config/weapons.json';
import player from '../config/player.json';
import modes from '../config/modes.json';
import arenas from '../config/arenas.json';
import assets from '../config/assets.json';
import stats from '../config/stats.json';
import sounds from '../config/sounds.json';
import economy from '../config/economy.json';
import pickups from '../config/pickups.json';
import materials from '../config/materials.json';
import { parseGameConfig } from '../src/core/config/gameConfig';
import { MatchServer } from '../src/core/match/matchServer';

/** Chemin du WebSocket du jeu (le reste du trafic WebSocket appartient à Vite). */
export const MATCH_PATH = '/ws';
const TICK_MS = 50;
/** Taille max d'un message (un deck importé peut peser quelques dizaines de ko). */
const MAX_MESSAGE_BYTES = 512 * 1024;

/** Intervalle du ping : les hébergeurs coupent souvent une connexion silencieuse, et un ping sans réponse révèle une connexion morte. */
const HEARTBEAT_MS = 25_000;

export interface AttachOptions {
  /** Serveur autonome : refuser les WebSocket hors de MATCH_PATH (sous Vite, ils appartiennent au rechargement à chaud). */
  exclusive?: boolean;
}

export function attachMatchServer(http: Server, options: AttachOptions = {}): void {
  const parsed = parseGameConfig({ quiz, bonuses, weapons, player, modes, arenas, assets, stats, sounds, economy, pickups, materials });
  if (!parsed.ok) {
    console.error('[match] configuration invalide, serveur de match désactivé :\n' + parsed.errors.join('\n'));
    return;
  }
  const sockets = new Map<string, WebSocket>();
  const server = new MatchServer(parsed.config, (id, message) => {
    const socket = sockets.get(id);
    if (socket?.readyState === socket?.OPEN) socket?.send(JSON.stringify(message));
  });
  const wss = new WebSocketServer({ noServer: true, maxPayload: MAX_MESSAGE_BYTES });
  let nextId = 1;
  /** Connexions qui ont répondu au dernier ping. */
  const alive = new WeakSet<WebSocket>();

  http.on('upgrade', (req: IncomingMessage, socket: Duplex, head: Buffer) => {
    if (new URL(req.url ?? '/', 'http://localhost').pathname !== MATCH_PATH) {
      if (options.exclusive) socket.destroy();
      return;
    }
    wss.handleUpgrade(req, socket, head, (ws) => wss.emit('connection', ws, req));
  });

  wss.on('connection', (ws: WebSocket) => {
    const id = `p${nextId++}`;
    sockets.set(id, ws);
    alive.add(ws);
    ws.on('pong', () => alive.add(ws));
    ws.on('message', (data) => {
      let msg: unknown;
      try {
        msg = JSON.parse(String(data));
      } catch {
        return;
      }
      server.handle(id, msg);
    });
    ws.on('close', () => {
      sockets.delete(id);
      server.disconnect(id);
    });
  });

  const timer = setInterval(() => server.tick(), TICK_MS);
  const heartbeat = setInterval(() => {
    for (const ws of wss.clients) {
      // pas de pong depuis le dernier ping : connexion morte, le 'close' libère le joueur
      if (!alive.has(ws)) {
        ws.terminate();
        continue;
      }
      alive.delete(ws);
      ws.ping();
    }
  }, HEARTBEAT_MS);
  http.on('close', () => {
    clearInterval(timer);
    clearInterval(heartbeat);
    wss.close();
  });
  console.log(`[match] serveur de match prêt sur ${MATCH_PATH}`);
}
