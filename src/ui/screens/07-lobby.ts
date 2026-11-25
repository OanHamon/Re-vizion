// 07 · Lobby : code en grand à partager, résumé des réglages, une place par joueur possible (pseudo, statut prêt,
// arme, deck), Quitter et Je suis prêt. La partie démarre quand tous les présents sont prêts (au moins le minimum).
// À côté du code : adresse locale et QR code qui rejoint directement le salon (lot 16).
import type { GameConfig } from '../../core/config/gameConfig';
import type { RoomInfo } from '../../core/match/protocol';
import { settingsSummary } from '../../core/match/settings';
import { button, setButtonLabel } from '../components';
import { h } from '../dom';
import { weaponLabel } from '../format';
import { weaponIcon } from '../icons';
import { joinAddress } from '../qr';
import type { Screen } from '../screen';

export interface LobbyActions {
  ready(ready: boolean): void;
  leave(): void;
}

export function lobbyScreen(config: GameConfig, room: RoomInfo, message: string, a: LobbyActions): Screen {
  const me = room.players.find((p) => p.id === room.you);
  const mode = config.modes.modes.find((m) => m.id === room.settings.modeId);
  const copy = button({
    icon: 'copy',
    label: 'Copier',
    onClick: () => {
      void navigator.clipboard?.writeText(room.code).then(() => setButtonLabel(copy, 'Copié'));
    },
  });

  const slotCount = Math.max(room.settings.maxPlayers, ...room.players.map((p) => p.color + 1));
  const minPlayers = config.modes.players.min;
  const slots = Array.from({ length: slotCount }, (_, i) => {
    const p = room.players.find((x) => x.color === i);
    const style = { '--player': `var(--player-${i + 1})` };
    if (!p) {
      return h(
        'div',
        { class: 'player-card is-empty', style },
        h('span', { class: 'waiting__dots', attrs: { 'aria-hidden': 'true' } }, h('i'), h('i'), h('i')),
        h('span', { class: 'player-card__empty', text: 'En attente d’un joueur' }),
      );
    }
    const you = p.id === room.you;
    return h(
      'div',
      { class: `player-card${p.ready ? ' is-ready' : ''}${p.connected ? '' : ' is-offline'}`, style },
      h(
        'div',
        { class: 'player-card__head' },
        h('strong', { class: 'player-name', text: p.name }),
        h('span', { class: 'player-card__status', text: !p.connected ? 'Déconnecté' : p.ready ? 'Prêt' : 'Pas prêt' }),
      ),
      h(
        'div',
        { class: 'player-card__weapon' },
        h('span', { html: weaponIcon(p.weaponId) }),
        h('span', { text: `${weaponLabel(config, p.weaponId)}${you ? ' · toi' : ''}${p.id === room.hostId ? ' · hôte' : ''}` }),
      ),
      h('span', { class: 'player-card__label', text: 'Deck' }),
      h('div', { class: 'player-card__deck' }, h('span', { text: room.deckTitle }), h('span', { class: 'player-card__count', text: `${room.deckSize} questions` })),
    );
  });

  const readyButton = button({
    kind: me?.ready ? 'secondary' : 'primary',
    icon: me?.ready ? 'cross' : 'check',
    label: me?.ready ? 'Annuler' : 'Je suis prêt',
    onClick: () => a.ready(!me?.ready),
  });
  const leave = button({ icon: 'chevron-left', label: 'Quitter', onClick: a.leave });

  const el = h(
    'main',
    { class: 'screen screen--centered lobby' },
    h('div', { class: 'info', text: `Salon privé · ${mode?.label ?? room.settings.modeId}` }),
    h(
      'div',
      { class: 'lobby__code' },
      h('strong', { text: room.code, attrs: { 'aria-label': `Code du salon ${room.code.split('').join(' ')}` } }),
      copy,
      joinAddress(room.code),
    ),
    h('div', { class: 'lobby__summary', text: settingsSummary(config, room.settings).join(' · ') }),
    h('div', { class: 'info', text: `${room.players.length}/${room.settings.maxPlayers} joueurs${room.players.length < minPlayers ? ` · il faut ${minPlayers} joueurs` : ' · départ quand tous sont prêts'}` }),
    h('div', { class: `lobby__players${slotCount > 2 ? ' is-many' : ''}` }, ...slots),
    h('div', { class: 'btn-row btn-row--center' }, leave, readyButton),
    message ? h('p', { class: 'overlay__message', attrs: { role: 'alert' }, text: message }) : null,
  );
  return { el, focus: () => readyButton.focus({ preventScroll: true }) };
}
