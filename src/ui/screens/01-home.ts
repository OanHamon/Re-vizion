// 01 · Accueil (simplifié) : créer un salon, rejoindre avec un code, entraînement solo,
// accès Loadout, Decks, Paramètres ; pseudo et arme équipée ; dernière partie.
import type { GameConfig } from '../../core/config/gameConfig';
import { button, coinChip } from '../components';
import { h } from '../dom';
import { weaponLabel } from '../format';
import { icon, weaponIcon } from '../icons';
import type { Screen } from '../screen';
import type { LastGame } from '../store';

export interface HomeData {
  config: GameConfig;
  name: string;
  weaponId: string;
  deckTitle: string;
  lastGame: LastGame | null;
  coins: number;
  message: string;
}

export interface HomeActions {
  rename(name: string): void;
  create(): void;
  join(code: string): void;
  solo(): void;
  loadout(): void;
  decks(): void;
  settings(): void;
}

const OUTCOME: Record<LastGame['outcome'], string> = { win: 'Victoire', loss: 'Défaite', draw: 'Égalité', solo: 'Entraînement' };

export function homeScreen(d: HomeData, a: HomeActions): Screen {
  const nameInput = h('input', {
    class: 'field',
    attrs: { type: 'text', maxlength: 20, value: d.name, 'aria-label': 'Pseudo', spellcheck: 'false' },
    on: { change: () => a.rename(nameInput.value.trim()) },
  });
  const codeInput = h('input', {
    class: 'field field--code',
    attrs: { type: 'text', maxlength: 4, placeholder: 'CODE', 'aria-label': 'Code du salon', autocomplete: 'off', spellcheck: 'false' },
    on: {
      input: () => (codeInput.value = codeInput.value.toUpperCase().replace(/[^A-Z]/g, '')),
      keydown: (e) => {
        if (e.key === 'Enter' && codeInput.value.length === 4) a.join(codeInput.value);
      },
    },
  });
  const joinButton = button({ icon: 'chevron-right', label: 'Rejoindre', onClick: () => codeInput.value.length === 4 && a.join(codeInput.value) });
  const create = button({ kind: 'primary', block: true, icon: 'chevron-right', label: 'Créer', ariaLabel: 'Créer un salon', onClick: a.create });
  const solo = button({ block: true, icon: 'chevron-right', label: 'Lancer', ariaLabel: 'Entraînement solo', onClick: a.solo });

  // carte d'action : icône + titre, une ligne d'explication, puis le bouton
  const action = (iconId: string, title: string, text: string, ...controls: HTMLElement[]) =>
    h(
      'section',
      { class: 'action-card' },
      h('h2', { class: 'action-card__title' }, h('span', { html: icon(iconId) }), title),
      h('p', { class: 'action-card__text', text }),
      h('div', { class: 'action-card__controls' }, ...controls),
    );

  const weaponChip = h(
    'button',
    { class: 'identity-chip', attrs: { type: 'button', 'aria-label': `Arme équipée : ${weaponLabel(d.config, d.weaponId)}. Changer dans le loadout.` }, on: { click: a.loadout } },
    h('span', { class: 'identity-chip__art', html: weaponIcon(d.weaponId) }),
    weaponLabel(d.config, d.weaponId),
    h('span', { class: 'identity-chip__chevron', html: icon('chevron-right') }),
  );

  const last = d.lastGame ? h('div', { class: 'info', text: `Dernière partie · ${OUTCOME[d.lastGame.outcome]} · ${d.lastGame.correct}/${d.lastGame.total}` }) : null;

  const el = h(
    'main',
    { class: 'screen screen--centered home' },
    h('div', { class: 'home__head' }, h('h1', { class: 'home__title', text: 'Réviz Arena' }), h('p', { class: 'home__tagline', text: 'Révise ton cours · gagne tes bonus · remporte le duel' })),
    h('div', { class: 'home__identity' }, nameInput, weaponChip, coinChip(d.coins, d.config.economy.currencyLabel)),
    h(
      'div',
      { class: 'home__actions' },
      action('users', 'Créer un salon', 'Tu règles la partie et tu partages le code.', create),
      action('chevron-right', 'Rejoindre', 'Entre le code donné par ton adversaire.', codeInput, joinButton),
      action('user', 'Entraînement solo', `Le quiz sans combat · ${d.deckTitle}`, solo),
    ),
    h(
      'nav',
      { class: 'btn-row btn-row--center home__menu', attrs: { 'aria-label': 'Menu' } },
      button({ kind: 'ghost', icon: 'scope', label: 'Loadout', onClick: a.loadout }),
      button({ kind: 'ghost', icon: 'book', label: 'Decks', onClick: a.decks }),
      button({ kind: 'ghost', icon: 'gear', label: 'Paramètres', onClick: a.settings }),
    ),
    last,
    d.message ? h('p', { class: 'overlay__message', attrs: { role: 'alert' }, text: d.message }) : null,
  );
  return { el, focus: () => create.focus({ preventScroll: true }) };
}
