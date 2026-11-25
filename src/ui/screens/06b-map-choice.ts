// 06b · Choix de la carte : panneau ouvert depuis 06 Créer un salon (ligne « Carte »).
// Liste des cartes jouables à gauche (config/arenas.json, « selectable »), aperçu 3D qui tourne à droite,
// bouton pour choisir. Échap ou Retour referme sans rien changer.
import type { GameConfig } from '../../core/config/gameConfig';
import type { Arena } from '../../core/config/schemas';
import { selectableArenas } from '../../core/match/settings';
import { MapPreview } from '../../render/mapPreview';
import { backButton, button } from '../components';
import { h } from '../dom';
import { icon } from '../icons';

export interface MapChoice {
  el: HTMLElement;
  onKey(event: KeyboardEvent): void;
  focus(): void;
  destroy(): void;
}

/** Couleur d'étiquette d'une carte (variable --map-<theme>-tag du thème). */
export function mapTagVar(arena: Arena): Record<string, string> {
  return { '--map-tag': `var(--map-${arena.look?.theme ?? 'default'}-tag, var(--map-default-tag))` };
}

/** « Ville · 2 à 5 joueurs » */
export function mapFacts(arena: Arena): string {
  const parts = [arena.kind ?? 'Arène'];
  if (arena.recommendedPlayers) parts.push(`${arena.recommendedPlayers[0]} à ${arena.recommendedPlayers[1]} joueurs`);
  return parts.join(' · ');
}

export function mapChoice(config: GameConfig, currentId: string, pick: (arenaId: string) => void, close: () => void): MapChoice {
  const arenas = selectableArenas(config);
  let index = Math.max(0, arenas.findIndex((a) => a.id === currentId));
  const canvas = h('canvas', { class: 'mapchoice__canvas', attrs: { 'aria-hidden': 'true' } });
  const loading = h('span', { class: 'mapchoice__loading', attrs: { role: 'status' } });
  const title = h('strong', { class: 'mapchoice__name' });
  const facts = h('span', { class: 'mapchoice__facts' });
  const tagline = h('span', { class: 'mapchoice__tagline' });
  const head = h('div', { class: 'mapchoice__head' }, title, facts);
  const items = arenas.map((a, i) =>
    h(
      'button',
      { class: 'mapcard', style: mapTagVar(a), attrs: { type: 'button', 'aria-pressed': 'false' }, on: { click: () => select(i) } },
      h('span', { class: 'mapcard__swatch', html: icon('map') }),
      h('span', { class: 'mapcard__text' }, h('strong', { text: a.label }), h('span', { text: mapFacts(a) })),
    ),
  );
  const confirm = button({ kind: 'primary', size: 'lg', icon: 'check', label: 'Choisir cette carte', onClick: () => pick(arenas[index]!.id) });

  let preview: MapPreview | null = null;
  try {
    preview = new MapPreview(canvas, config, {
      reducedMotion: window.matchMedia('(prefers-reduced-motion: reduce)').matches,
      onLoad: (id, error) => {
        if (id !== arenas[index]?.id) return;
        loading.textContent = error ? `Aperçu indisponible (${error.message})` : '';
      },
    });
  } catch (error) {
    loading.textContent = `La 3D ne démarre pas sur ce navigateur (${(error as Error).message}).`;
  }

  function select(i: number) {
    index = (i + arenas.length) % arenas.length;
    const a = arenas[index]!;
    items.forEach((el, k) => el.setAttribute('aria-pressed', String(k === index)));
    title.textContent = a.label;
    facts.textContent = `${mapFacts(a)} · ${a.size[0]} × ${a.size[1]} m`;
    tagline.textContent = a.tagline ?? '';
    for (const [k, v] of Object.entries(mapTagVar(a))) head.style.setProperty(k, v);
    if (preview) {
      loading.textContent = a.decor ? 'Chargement de la carte…' : '';
      preview.show(a);
    }
  }
  select(index);

  const el = h(
    'div',
    { class: 'mapchoice', attrs: { role: 'dialog', 'aria-modal': 'true', 'aria-label': 'Choix de la carte' } },
    h(
      'section',
      { class: 'mapchoice__list' },
      h('header', { class: 'page-head' }, backButton(close), h('h1', { class: 'page-head__title', text: 'Carte' })),
      h('div', { class: 'mapchoice__items' }, ...items),
    ),
    h(
      'section',
      { class: 'mapchoice__view' },
      h('div', { class: 'mapchoice__frame' }, canvas, loading),
      h('div', { class: 'mapchoice__info' }, head, tagline),
      h('div', { class: 'btn-row' }, confirm),
    ),
  );

  return {
    el,
    focus: () => confirm.focus({ preventScroll: true }),
    onKey(e) {
      if (e.key === 'Escape') close();
      else if (e.key === 'ArrowDown' || e.key === 'ArrowRight') select(index + 1);
      else if (e.key === 'ArrowUp' || e.key === 'ArrowLeft') select(index - 1);
      else return;
      e.preventDefault();
    },
    destroy() {
      preview?.dispose();
      preview = null;
    },
  };
}
