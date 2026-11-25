// Éléments partagés entre les écrans : minuteur global, colonne des bonus, pastille de bonus.
import type { InventoryEntry } from '../core/quiz/inventory';
import { familyVars, h, rarityVars } from './dom';
import { formatClock } from './format';
import { icon } from './icons';

/** Solde de pièces (accueil, loadout). */
export function coinChip(amount: number, currencyLabel: string): HTMLElement {
  return h(
    'span',
    { class: 'coin-chip', attrs: { 'aria-label': `${amount} ${currencyLabel}` } },
    h('span', { class: 'coin-chip__icon', html: icon('coin') }),
    String(amount),
  );
}

const RING_R = 10;
const RING_C = 2 * Math.PI * RING_R;

/** Petit minuteur global, en bas de l'écran. */
export function clockPill(lowThresholdMs: number) {
  const fill = `<circle class="fill" cx="13" cy="13" r="${RING_R}" stroke-dasharray="${RING_C}" stroke-dashoffset="0"/>`;
  const ring = h('span', {
    html: `<svg class="clock__ring" viewBox="0 0 26 26"><circle class="track" cx="13" cy="13" r="${RING_R}"/>${fill}</svg>`,
  });
  const text = h('span', { text: '' });
  const el = h('div', { class: 'clock', attrs: { role: 'timer', 'aria-label': 'Temps restant' } }, ring, text);
  const circle = ring.querySelector<SVGCircleElement>('.fill')!;
  let lastText = '';

  return {
    el,
    update(remainingMs: number, totalMs: number) {
      const label = formatClock(remainingMs);
      if (label !== lastText) {
        text.textContent = label;
        lastText = label;
      }
      circle.style.strokeDashoffset = String(RING_C * (1 - remainingMs / totalMs));
      el.classList.toggle('is-low', remainingMs <= lowThresholdMs);
    },
  };
}

/** Colonne d'icônes des bonus (et malus) acquis, à droite. */
export function lootColumn(entries: readonly InventoryEntry[], highlightTurn: number | null = null): HTMLElement {
  const list = h('ul', { class: 'loot', attrs: { 'aria-label': 'Bonus acquis' } });
  for (const entry of entries) {
    const isMalus = entry.kind === 'malus';
    list.append(
      h('li', {
        class: `loot__item${isMalus ? ' is-malus' : ''}${entry.turn === highlightTurn ? ' is-new' : ''}`,
        html: icon(entry.icon),
        style: { ...familyVars(entry.family), ...rarityVars(entry.rarity ?? 'fallback') },
        attrs: { title: isMalus ? `Malus : ${entry.label}` : entry.label, 'aria-label': isMalus ? `Malus : ${entry.label}` : entry.label },
      }),
    );
  }
  return list;
}

/** Pastille « icône + libellé » d'un bonus ou malus (récap). */
export function gainTag(entry: InventoryEntry): HTMLElement {
  const isMalus = entry.kind === 'malus';
  return h(
    'li',
    {
      class: `gain${isMalus ? ' is-malus' : ''}`,
      style: { ...familyVars(entry.family), ...rarityVars(entry.rarity ?? 'fallback') },
    },
    h('span', { class: 'gain__icon', html: icon(entry.icon) }),
    entry.label,
  );
}

export type ButtonKind = 'primary' | 'secondary' | 'ghost';

export interface ButtonOptions {
  /** Libellé visible ; sans libellé, le bouton est carré (icône seule) et `ariaLabel` est obligatoire. */
  label?: string;
  icon?: string;
  kind?: ButtonKind;
  size?: 'sm' | 'md' | 'lg';
  block?: boolean;
  ariaLabel?: string;
  title?: string;
  className?: string;
  disabled?: boolean;
  onClick?: () => void;
}

/** Bouton unique de l'interface : rectangle aux coins légèrement arrondis, icône et libellé. */
export function button(o: ButtonOptions): HTMLButtonElement {
  const cls = ['btn', `btn--${o.kind ?? 'secondary'}`];
  if (o.size && o.size !== 'md') cls.push(`btn--${o.size}`);
  if (o.block) cls.push('btn--block');
  if (!o.label) cls.push('btn--icon');
  if (o.className) cls.push(o.className);
  return h(
    'button',
    {
      class: cls.join(' '),
      attrs: { type: 'button', 'aria-label': o.ariaLabel, title: o.title, disabled: o.disabled },
      on: o.onClick ? { click: o.onClick } : {},
    },
    o.icon ? h('span', { class: 'btn__icon', html: icon(o.icon) }) : null,
    o.label ? h('span', { class: 'btn__label', text: o.label }) : null,
  );
}

/** Change le libellé d'un bouton créé par `button`. */
export function setButtonLabel(b: HTMLButtonElement, label: string): void {
  const el = b.querySelector('.btn__label');
  if (el) el.textContent = label;
}

/** Bouton retour (chevron), en haut à gauche des écrans de menu. */
export function backButton(onClick: () => void, label?: string): HTMLButtonElement {
  return button({ icon: 'chevron-left', label, ariaLabel: label ? undefined : 'Retour (Échap)', title: 'Retour (Échap)', onClick, className: 'btn-back' });
}

/** Interrupteur on/off (role switch). */
export function toggleSwitch(label: string, on: boolean, onChange: (on: boolean) => void): HTMLButtonElement {
  const el = h('button', {
    class: 'switch',
    attrs: { type: 'button', role: 'switch', 'aria-checked': String(on), 'aria-label': label },
    on: {
      click: () => {
        const next = el.getAttribute('aria-checked') !== 'true';
        el.setAttribute('aria-checked', String(next));
        onChange(next);
      },
    },
  });
  return el;
}

/** Bandeau « quiz terminé, en attente de l'adversaire » (salon, quand on a fini avant lui). */
export function waitingBanner(): HTMLElement {
  return h(
    'div',
    { class: 'waiting', attrs: { role: 'status' } },
    h('span', { class: 'waiting__dots', attrs: { 'aria-hidden': 'true' } }, h('i'), h('i'), h('i')),
    h('span', { text: 'Quiz terminé · En attente de l’adversaire' }),
  );
}

/** Décor de fond : grandes formes géométriques pastel. */
export function backdrop(): HTMLElement {
  return h('div', {
    class: 'backdrop',
    attrs: { 'aria-hidden': 'true' },
    html: [
      '<svg class="s1" viewBox="0 0 100 100"><path d="M50 4 97 88H3Z"/></svg>',
      '<svg class="s2" viewBox="0 0 100 100"><circle cx="50" cy="50" r="50"/></svg>',
      '<svg class="s3" viewBox="0 0 100 100"><circle cx="50" cy="50" r="44"/></svg>',
      '<svg class="s4" viewBox="0 0 100 100"><rect x="10" y="10" width="80" height="80" rx="4"/></svg>',
    ].join(''),
  });
}
