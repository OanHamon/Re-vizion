// Connexion WebSocket au serveur de match (même adresse que le jeu, chemin /ws).
import type { ClientMessage, ServerMessage } from '../core/match/protocol';

export type ServerHandler = (message: ServerMessage) => void;

export class Connection {
  private readonly socket: WebSocket;
  private readonly queue: string[] = [];
  /** Écart estimé entre l'horloge du serveur et Date.now() du navigateur. */
  private offset = 0;
  private closedByUs = false;

  constructor(
    private readonly onMessage: ServerHandler,
    private readonly onClose: (unexpected: boolean) => void,
  ) {
    const protocol = location.protocol === 'https:' ? 'wss' : 'ws';
    this.socket = new WebSocket(`${protocol}://${location.host}/ws`);
    this.socket.addEventListener('open', () => {
      for (const data of this.queue.splice(0)) this.socket.send(data);
    });
    this.socket.addEventListener('message', (e) => {
      let msg: ServerMessage;
      try {
        msg = JSON.parse(String(e.data)) as ServerMessage;
      } catch {
        return;
      }
      // moyenne glissante : la latence fait varier la mesure
      const sample = msg.serverNow - Date.now();
      this.offset = this.offset === 0 ? sample : this.offset * 0.9 + sample * 0.1;
      this.onMessage(msg);
    });
    this.socket.addEventListener('close', () => this.onClose(!this.closedByUs));
  }

  /** Heure du serveur (ms), estimée. */
  serverNow(): number {
    return Date.now() + this.offset;
  }

  send(message: ClientMessage): void {
    const data = JSON.stringify(message);
    if (this.socket.readyState === WebSocket.OPEN) this.socket.send(data);
    else if (this.socket.readyState === WebSocket.CONNECTING) this.queue.push(data);
  }

  close(): void {
    this.closedByUs = true;
    this.socket.close();
  }
}
