// 02 · Loadout (simplifié : choix d'arme), façon CoD : fiche de l'arme à gauche (stats en barres),
// aperçu 3D au centre, bonus d'arme possibles et bouton Équiper à droite,
// bandeau d'armes qui défile en bas (prévu pour accueillir de nouvelles armes).
import type { GameConfig } from '../../core/config/gameConfig';
import type { Weapon } from '../../core/config/schemas';
import { readSceneColors } from '../../render/arena';
import { ArmoryScene, type ArmoryView } from '../../render/armoryScene';
import { loadAsset } from '../../render/assets';
import { backButton, button, coinChip, setButtonLabel } from '../components';
import { familyVars, h, rarityVars } from '../dom';
import { rarityLabel, weaponLabel } from '../format';
import { icon, weaponIcon } from '../icons';
import { digitIndex, isConfirmKey, TRAINING_MODE_ID, type Screen } from '../screen';

export interface ArmoryOptions {
  config: GameConfig;
  weaponId: string;
  coins: number;
  onSelect(weaponId: string): void;
  onBack(): void;
}

/** Emplacements « Bientôt » au bout du bandeau : la place des futures armes. */
const UPCOMING_SLOTS = 2;

const fmt = (n: number) => String(Math.round(n * 10) / 10).replace('.', ',');

/** Une ligne de stat : valeur affichée et part de la barre (0 à 1, relative à la meilleure arme du loadout). */
interface StatRow {
  label: string;
  value: (w: Weapon) => number;
  text: (w: Weapon) => string;
  /** true si une valeur basse est meilleure (barre inversée). */
  lowerIsBetter?: boolean;
}

const STAT_ROWS: StatRow[] = [
  { label: 'Dégâts par tir', value: (w) => w.damagePerShot * w.pellets, text: (w) => (w.pellets > 1 ? `${w.pellets} × ${w.damagePerShot}` : String(w.damagePerShot)) },
  { label: 'Cadence', value: (w) => w.fireRate, text: (w) => `${fmt(w.fireRate)} tirs/s` },
  { label: 'Chargeur', value: (w) => w.magazineSize, text: (w) => String(w.magazineSize) },
  { label: 'Portée', value: (w) => w.range, text: (w) => `${w.range} m` },
  { label: 'Recul', value: (w) => w.recoil.kickDeg, text: (w) => `${fmt(w.recoil.kickDeg)}°` },
];

export function loadoutScreen(o: ArmoryOptions): Screen {
  const { config } = o;
  const loadout = config.player.loadout;
  const weapons = loadout.map((id) => config.weapons.weapons.find((w) => w.id === id)).filter((w): w is Weapon => !!w);
  const maxOf = (row: StatRow) => Math.max(...weapons.map(row.value), 1e-9);
  let equipped = o.weaponId;
  let current = o.weaponId;
  let view: ArmoryView = 'turntable';
  let request = 0;

  const canvas = h('canvas', { class: 'armory__canvas', attrs: { 'aria-label': 'Arme en 3D' } });
  const status = h('div', { class: 'armory__status', attrs: { 'aria-live': 'polite' } });

  // ---------- fiche de l'arme (gauche) ----------
  const kicker = h('div', { class: 'sheet__kicker' });
  const name = h('h1', { class: 'sheet__name' });
  const description = h('p', { class: 'sheet__desc' });
  const statBars = STAT_ROWS.map((row) => {
    const fill = h('i');
    const value = h('strong');
    return { row, fill, value, el: h('div', { class: 'stat-bar' }, h('span', { text: row.label }), h('span', { class: 'stat-bar__track' }, fill), value) };
  });
  const dps = h('span', { class: 'sheet__dps' });
  const sheet = h('section', { class: 'sheet' }, kicker, name, description, h('div', { class: 'sheet__stats' }, ...statBars.map((s) => s.el)), dps);

  // ---------- bonus d'arme et Équiper (droite) ----------
  const bonusList = h('ul', { class: 'perks' });
  const equipButton = button({ kind: 'primary', size: 'lg', block: true, icon: 'check', label: 'Équiper', title: 'Équiper (Entrée)', onClick: () => equip() });
  const side = h('aside', { class: 'loadout__side' }, h('div', { class: 'loadout__side-title', text: 'Bonus d’arme possibles' }), bonusList, equipButton);

  // ---------- bandeau d'armes (bas) ----------
  const strip = h('div', { class: 'strip__track', attrs: { role: 'listbox', 'aria-label': 'Armes' } });
  const tiles = weapons.map((w, i) => {
    const badge = h('span', { class: 'tile__badge', text: 'Équipée' });
    const tile = h(
      'button',
      {
        class: 'tile',
        attrs: { type: 'button', role: 'option', 'aria-label': `${w.label} (touche ${i + 1})` },
        on: { click: () => void preview(w.id) },
      },
      h('span', { class: 'tile__art', html: weaponIcon(w.id) }),
      h('span', { class: 'tile__name' }, h('span', { text: w.label }), badge),
      h('span', { class: 'tile__sub', text: w.description }),
    );
    strip.append(tile);
    return { id: w.id, tile, badge };
  });
  for (let i = 0; i < UPCOMING_SLOTS; i++) {
    strip.append(
      h(
        'div',
        { class: 'tile is-locked', attrs: { 'aria-hidden': 'true' } },
        h('span', { class: 'tile__art', html: icon('lock') }),
        h('span', { class: 'tile__name', text: 'Bientôt' }),
        h('span', { class: 'tile__sub', text: 'Nouvelle arme' }),
      ),
    );
  }
  const scroll = (dir: number) => strip.scrollBy({ left: dir * strip.clientWidth * 0.6, behavior: 'smooth' });
  const stripEl = h(
    'div',
    { class: 'strip' },
    button({ icon: 'chevron-left', ariaLabel: 'Armes précédentes', onClick: () => scroll(-1) }),
    strip,
    button({ icon: 'chevron-right', ariaLabel: 'Armes suivantes', onClick: () => scroll(1) }),
  );

  const viewButton = button({ kind: 'ghost', size: 'sm', icon: 'eye', label: 'Vue FPS', onClick: () => toggleView() });
  const back = backButton(() => o.onBack(), 'Retour');
  const tabs = h(
    'nav',
    { class: 'tabs', attrs: { 'aria-label': 'Loadout' } },
    h('span', { class: 'tabs__item is-active', text: 'Arme principale' }),
    h('span', { class: 'tabs__item is-off', text: 'Skins', attrs: { title: 'Plus tard' } }),
  );

  const el = h(
    'main',
    { class: 'armory loadout' },
    h('span', { class: 'loadout__halo', attrs: { 'aria-hidden': 'true' } }),
    canvas,
    h('header', { class: 'loadout__top' }, back, tabs, coinChip(o.coins, o.config.economy.currencyLabel)),
    status,
    sheet,
    side,
    h('div', { class: 'loadout__view' }, viewButton),
    stripEl,
  );

  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  let scene: ArmoryScene | null = null;
  // vue à la première personne : l'arène du mode Entraînement
  const trainingArena = config.modes.modes.find((m) => m.id === TRAINING_MODE_ID)?.arena;
  const arena = config.arenas.arenas.find((a) => a.id === trainingArena) ?? config.arenas.arenas[0]!;
  try {
    scene = new ArmoryScene(canvas, readSceneColors(), { reducedMotion, arena, eyeHeight: config.player.body.eyeHeight });
  } catch (error) {
    status.textContent = `La 3D ne démarre pas sur ce navigateur (${(error as Error).message}).`;
  }

  function refresh() {
    const weapon = weapons.find((w) => w.id === current);
    name.textContent = weaponLabel(config, current);
    if (weapon) {
      kicker.textContent = `${weapon.label} · ${weapon.automatic ? 'Automatique' : 'Coup par coup'}`;
      description.textContent = weapon.description;
      for (const s of statBars) {
        const share = s.row.value(weapon) / maxOf(s.row);
        s.fill.style.width = `${Math.round(100 * Math.min(1, share))}%`;
        s.value.textContent = s.row.text(weapon);
      }
      const perSecond = weapon.damagePerShot * weapon.pellets * weapon.fireRate;
      dps.textContent = `≈ ${Math.round(perSecond)} dégâts par seconde`;
    }
    // bonus propres à cette arme (famille Arme), du plus commun au plus rare
    const ranks = new Map(config.quiz.rarities.map((r, i) => [r.id, i]));
    const perks = config.bonuses.bonuses
      .filter((b) => b.family === 'weapon' && b.weapons.includes(current))
      .sort((a, b) => (ranks.get(a.rarity) ?? 0) - (ranks.get(b.rarity) ?? 0));
    bonusList.replaceChildren(
      ...perks.map((b) =>
        h(
          'li',
          { class: 'perk', style: { ...familyVars(b.family), ...rarityVars(b.rarity) }, attrs: { title: rarityLabel(config, b.rarity) } },
          h('span', { class: 'perk__icon', html: icon(b.icon) }),
          b.label,
        ),
      ),
    );
    if (perks.length === 0) bonusList.append(h('li', { class: 'perks__empty', text: 'Aucun bonus propre à cette arme' }));

    const isEquipped = current === equipped;
    equipButton.disabled = isEquipped;
    setButtonLabel(equipButton, isEquipped ? 'Équipée' : 'Équiper');
    for (const t of tiles) {
      t.tile.classList.toggle('is-selected', t.id === current);
      t.tile.setAttribute('aria-selected', String(t.id === current));
      t.badge.hidden = t.id !== equipped;
    }
    const fps = view === 'fps';
    setButtonLabel(viewButton, fps ? 'Vue en rotation' : 'Vue FPS');
    viewButton.title = `${fps ? 'Vue en rotation' : 'Vue à la première personne'} (V)`;
    el.classList.toggle('is-fps', fps);
  }

  async function preview(id: string) {
    current = id;
    refresh();
    tiles.find((t) => t.id === id)?.tile.scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: 'smooth' });
    const weapon = config.weapons.weapons.find((w) => w.id === id);
    const assetId = weapon?.asset;
    const def = assetId ? config.assets.assets[assetId] : undefined;
    if (!scene || !assetId || !def) return;
    const mine = ++request;
    status.textContent = 'Chargement…';
    try {
      const asset = await loadAsset(assetId, def);
      if (mine !== request || !scene) return; // une autre arme a été demandée entre-temps
      scene.setWeapon(asset);
      status.textContent = '';
    } catch (error) {
      if (mine === request) status.textContent = (error as Error).message;
    }
  }

  function equip() {
    if (current === equipped) return;
    equipped = current;
    o.onSelect(current);
    refresh();
  }

  function toggleView() {
    view = view === 'turntable' ? 'fps' : 'turntable';
    scene?.setView(view);
    refresh();
  }

  void preview(current);

  return {
    el,
    focus: () => equipButton.focus({ preventScroll: true }),
    onKey(event) {
      const index = digitIndex(event);
      if (index !== null && loadout[index]) {
        event.preventDefault();
        void preview(loadout[index]!);
      } else if (event.key === 'v' || event.key === 'V') {
        event.preventDefault();
        toggleView();
      } else if (isConfirmKey(event) && document.activeElement === document.body) {
        event.preventDefault();
        equip();
      } else if (event.key === 'Escape') {
        event.preventDefault();
        o.onBack();
      }
    },
    destroy() {
      request++;
      scene?.dispose();
      scene = null;
    },
  };
}
