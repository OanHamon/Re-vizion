// Serveur de match, indépendant du transport : reçoit des messages bruts par client,
// gère les salons (création, code, entrée) et délègue le match à Room.
import type { GameConfig } from '../config/gameConfig';
import { validateDeck } from '../deck/validateDeck';
import { ClientMessageSchema, type ServerMessage, type ServerPayload } from './protocol';
import { Room } from './room';
import { checkSettings } from './settings';

/** Lettres sans ambiguïté (pas de O/0, I/1). */
const CODE_LETTERS = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
const CODE_LENGTH = 4;

export class MatchServer {
  private readonly rooms = new Map<string, Room>();
  private readonly roomOf = new Map<string, Room>();

  constructor(
    private readonly config: GameConfig,
    private readonly sendRaw: (clientId: string, message: ServerMessage) => void,
    private readonly now: () => number = Date.now,
    private readonly random: () => number = Math.random,
  ) {}

  private send = (clientId: string, payload: ServerPayload): void => {
    this.sendRaw(clientId, { ...payload, serverNow: this.now() } as ServerMessage);
  };

  get roomCount(): number {
    return this.rooms.size;
  }

  room(code: string): Room | undefined {
    return this.rooms.get(code);
  }

  disconnect(clientId: string): void {
    this.leave(clientId);
  }

  handle(clientId: string, raw: unknown): void {
    const parsed = ClientMessageSchema.safeParse(raw);
    if (!parsed.success) {
      this.send(clientId, { type: 'error', message: 'Message invalide.' });
      return;
    }
    const msg = parsed.data;
    const room = this.roomOf.get(clientId);
    switch (msg.type) {
      case 'create':
        return this.create(clientId, msg);
      case 'join':
        return this.join(clientId, msg);
      case 'leave':
        return this.leave(clientId);
      case 'ready':
        return room?.setReady(clientId, msg.ready);
      case 'rematch':
        return room?.rematch(clientId);
      case 'pick':
        return room?.pick(clientId, msg.cardId);
      case 'answer':
        return room?.answer(clientId, msg.answer);
      case 'next':
        return room?.next(clientId);
      case 'state':
        return room?.state(clientId, msg);
      case 'shot':
        return room?.shot(clientId, msg.slot, msg.rays);
      case 'hit':
        return room?.hit(clientId, msg);
      case 'chestOpen':
        return room?.chestOpen(clientId, msg.chestId);
      case 'chestAnswer':
        return room?.chestAnswer(clientId, msg.answer);
      case 'throw':
        return room?.throwGrenade(clientId, msg.origin, msg.dir);
    }
  }

  tick(): void {
    for (const room of this.rooms.values()) room.tick();
  }

  private validWeapon(weaponId: string): boolean {
    return this.config.player.loadout.includes(weaponId);
  }

  private create(clientId: string, msg: { name: string; weaponId: string; settings: unknown; deck: unknown }): void {
    this.leave(clientId);
    if (!this.validWeapon(msg.weaponId)) return this.send(clientId, { type: 'error', message: 'Arme inconnue.' });
    const settings = checkSettings(this.config, msg.settings);
    if (!settings.ok) return this.send(clientId, { type: 'error', message: settings.error });
    const deck = validateDeck(msg.deck, 'deck du salon');
    if (!deck.ok) return this.send(clientId, { type: 'error', message: `Deck refusé : ${deck.errors[0]}` });
    const code = this.newCode();
    const room = new Room(code, this.config, settings.settings, deck.deck, this.send, this.now, this.random);
    this.rooms.set(code, room);
    this.roomOf.set(clientId, room);
    room.addMember(clientId, msg.name, msg.weaponId);
  }

  private join(clientId: string, msg: { name: string; weaponId: string; code: string }): void {
    this.leave(clientId);
    const room = this.rooms.get(msg.code.toUpperCase());
    if (!room) return this.send(clientId, { type: 'error', message: 'Aucun salon avec ce code.' });
    if (room.full) return this.send(clientId, { type: 'error', message: 'Ce salon est complet.' });
    if (room.phase !== 'lobby') return this.send(clientId, { type: 'error', message: 'La partie a déjà commencé.' });
    if (!this.validWeapon(msg.weaponId)) return this.send(clientId, { type: 'error', message: 'Arme inconnue.' });
    this.roomOf.set(clientId, room);
    room.addMember(clientId, msg.name, msg.weaponId);
  }

  private leave(clientId: string): void {
    const room = this.roomOf.get(clientId);
    if (!room) return;
    this.roomOf.delete(clientId);
    room.removeMember(clientId);
    this.send(clientId, { type: 'left' });
    if (room.empty) this.rooms.delete(room.code);
  }

  private newCode(): string {
    for (;;) {
      let code = '';
      for (let i = 0; i < CODE_LENGTH; i++) code += CODE_LETTERS[Math.floor(this.random() * CODE_LETTERS.length)];
      if (!this.rooms.has(code)) return code;
    }
  }
}
