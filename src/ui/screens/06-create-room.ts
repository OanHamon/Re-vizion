// 06 · Créer un salon : l'hôte règle la partie (deck, mode, joueurs, durées, questions, manches, vies, victoire, règles).
// Les modes donnent des réglages de départ ; joueurs, durées, questions et règles restent modifiables dans tous les modes,
// manches, vies et condition de victoire seulement en Personnalisé. Tous les choix viennent de config/*.json.
// Formulaire en lignes à gauche, panneau de création à droite : QR code en grand de l'adresse du jeu (lot 17).
// Le code du salon est donné par le serveur à la création, puis affiché dans le lobby (07).
import type { GameConfig } from '../../core/config/gameConfig';
import type { Deck } from '../../core/deck/validateDeck';
import { allowsUnlimitedCombat, defaultSettings, selectableArenas, type MatchSettings } from '../../core/match/settings';
import { backButton, button, toggleSwitch } from '../components';
import { h, rarityVars } from '../dom';
import { formatClock } from '../format';
import { icon } from '../icons';
import { joinAddress } from '../qr';
import type { Screen } from '../screen';
import { TRAINING_MODE_ID } from '../screen';
import { mapChoice, mapFacts, mapTagVar, type MapChoice } from './06b-map-choice';

export interface CreateRoomActions {
  create(settings: MatchSettings, deck: Deck): void;
  back(): void;
}

/** Sélecteur « − valeur + » parmi une liste de valeurs permises. */
function stepper<T>(label: string, items: readonly T[], current: T, text: (v: T) => string, pick: (v: T) => void): HTMLElement {
  const i = Math.max(0, items.indexOf(current));
  const step = (d: number) => {
    const next = items[i + d];
    if (next !== undefined) pick(next);
  };
  return h(
    'div',
    { class: 'stepper', attrs: { role: 'group', 'aria-label': label } },
    h('button', { class: 'stepper__btn', text: '−', attrs: { type: 'button', 'aria-label': `${label} : moins`, disabled: i <= 0 }, on: { click: () => step(-1) } }),
    h('output', { class: 'stepper__value', text: text(current) }),
    h('button', { class: 'stepper__btn', text: '+', attrs: { type: 'button', 'aria-label': `${label} : plus`, disabled: i >= items.length - 1 }, on: { click: () => step(1) } }),
  );
}

export function createRoomScreen(config: GameConfig, decks: readonly Deck[], selectedDeckId: string, message: string, a: CreateRoomActions): Screen {
  let deck = decks.find((d) => d.deck.id === selectedDeckId) ?? decks[0]!;
  // carte par défaut : celle du mode si elle est jouable, sinon la première carte jouable
  const firstMap = selectableArenas(config)[0]?.id;
  const withMap = (x: MatchSettings): MatchSettings =>
    selectableArenas(config).some((a) => a.id === x.arenaId) || !firstMap ? x : { ...x, arenaId: firstMap };
  let s: MatchSettings = withMap(defaultSettings(config));
  let picker: MapChoice | null = null;
  const form = h('div', { class: 'form' });
  const { doubleOrNothing, negative } = config.quiz.combos;
  const { roundsChoices, livesChoices } = config.modes.custom;
  const livesText = (v: number) => (v === 0 ? 'Vies ∞' : `${v} vie${v > 1 ? 's' : ''}`);
  // « Sans limite » (0) n'est proposé que si les vies sont limitées : sinon la manche ne finirait jamais
  const combatChoices = (lives: number) => config.modes.combatChoicesSeconds.filter((v) => v > 0 || allowsUnlimitedCombat(lives));
  const fitCombat = (x: MatchSettings): MatchSettings =>
    combatChoices(x.lives).includes(x.combatSeconds) ? x : { ...x, combatSeconds: defaultSettings(config, x.modeId).combatSeconds };
  const fixed = (text: string) => h('span', { class: 'stepper is-static' }, h('output', { class: 'stepper__value', text }));

  const row = (label: string, ...controls: (HTMLElement | null)[]) =>
    h('div', { class: 'form__row' }, h('span', { class: 'form__label', text: label }), h('div', { class: 'form__controls' }, ...controls));
  const segmented = <T>(label: string, items: readonly T[], current: T, text: (v: T) => string, pick: (v: T) => void) =>
    h(
      'div',
      { class: 'segmented', attrs: { role: 'group', 'aria-label': label } },
      ...items.map((v) => h('button', { class: 'segmented__item', text: text(v), attrs: { type: 'button', 'aria-pressed': String(v === current) }, on: { click: () => pick(v) } })),
    );
  const rule = (title: string, detail: string, on: boolean, flip: () => void) =>
    h('label', { class: 'rule' }, h('span', { class: 'rule__text' }, h('strong', { text: title }), h('span', { text: detail })), toggleSwitch(title, on, flip));

  function render() {
    const mode = config.modes.modes.find((m) => m.id === s.modeId)!;
    const modes = config.modes.modes.filter((m) => m.id !== TRAINING_MODE_ID);
    const rows: (HTMLElement | null)[] = [
      row('Deck', segmented('Deck', decks, deck, (d) => d.deck.titre, (d) => ((deck = d), render()))),
      row(
        'Mode',
        segmented('Mode', modes.map((m) => m.id), s.modeId, (id) => modes.find((m) => m.id === id)!.label, (id) => {
          const next = defaultSettings(config, id);
          // on garde ce que l'hôte a déjà réglé et que le nouveau mode n'impose pas
          s = fitCombat({
            ...next,
            arenaId: s.arenaId,
            maxPlayers: config.modes.modes.find((m) => m.id === id)?.maxPlayers ?? s.maxPlayers,
            budgetSeconds: s.budgetSeconds,
            maxQuestions: s.maxQuestions,
            combatSeconds: s.combatSeconds,
            doubleOrNothing: s.doubleOrNothing,
            negativeCombo: s.negativeCombo,
          });
          render();
        }),
      ),
      row('Carte', mapButton()),
      row(
        'Joueurs',
        mode.maxPlayers
          ? fixed(`${mode.maxPlayers} joueurs`)
          : stepper('Joueurs max', config.modes.players.choices, s.maxPlayers, (v) => `${v} max`, (v) => ((s = { ...s, maxPlayers: v }), render())),
        h('span', { class: 'form__hint', text: mode.maxPlayers ? 'imposé par le mode' : `départ dès ${config.modes.players.min} prêts` }),
      ),
      row(
        'Quiz',
        stepper('Budget du quiz', config.quiz.budgetChoicesSeconds, s.budgetSeconds, (v) => formatClock(v * 1000), (v) => ((s = { ...s, budgetSeconds: v }), render())),
        stepper('Questions max', config.quiz.maxQuestionsChoices, s.maxQuestions, (v) => (v === 0 ? 'Questions ∞' : `${v} questions`), (v) => ((s = { ...s, maxQuestions: v }), render())),
      ),
      row(
        'Cartes',
        h(
          'ul',
          { class: 'rarity-pills' },
          ...config.quiz.rarities.map((r) => h('li', { class: 'rarity-pill', style: rarityVars(r.id), text: `${r.label} · ${r.costSeconds} s` })),
        ),
      ),
      row(
        'Combat',
        stepper('Durée du combat', combatChoices(s.lives), s.combatSeconds, (v) => (v === 0 ? 'Sans limite' : formatClock(v * 1000)), (v) => ((s = { ...s, combatSeconds: v }), render())),
        mode.editable
          ? stepper('Vies', livesChoices, s.lives, livesText, (v) => ((s = fitCombat({ ...s, lives: v })), render()))
          : fixed(s.lives === 0 ? 'Réapparition' : livesText(s.lives)),
        mode.editable
          ? stepper('Manches', roundsChoices, s.rounds, (v) => `${v} manche${v > 1 ? 's' : ''}`, (v) => ((s = { ...s, rounds: v, roundsToWin: Math.ceil((v + 1) / 2) }), render()))
          : null,
      ),
      mode.editable
        ? row(
            'Victoire',
            segmented('Condition de victoire', ['last_alive', 'most_kills'] as const, s.winCondition, (v) => (v === 'last_alive' ? 'Dernier en vie' : 'Le plus de kills'), (v) => ((s = { ...s, winCondition: v }), render())),
          )
        : null,
      row(
        'Règles',
        rule('Quitte ou double', `${doubleOrNothing.correctStreak} bonnes d’affilée : cartes plus rares, malus si erreur`, s.doubleOrNothing, () => ((s = { ...s, doubleOrNothing: !s.doubleOrNothing }), render())),
        rule('Combo négatif', `${negative.wrongStreak} erreurs d’affilée : malus à chaque nouvelle erreur`, s.negativeCombo, () => ((s = { ...s, negativeCombo: !s.negativeCombo }), render())),
      ),
    ];
    form.replaceChildren(...rows.filter((r): r is HTMLElement => r !== null));
  }
  /** Carte choisie (étiquette de couleur, nom, type) : ouvre le choix de la carte. */
  function mapButton(): HTMLElement {
    const arena = config.arenas.arenas.find((x) => x.id === s.arenaId);
    return h(
      'button',
      { class: 'mapcard mapcard--inline', style: arena ? mapTagVar(arena) : {}, attrs: { type: 'button', 'aria-label': `Carte : ${arena?.label ?? s.arenaId}. Changer de carte` }, on: { click: openPicker } },
      h('span', { class: 'mapcard__swatch', html: icon('map') }),
      h('span', { class: 'mapcard__text' }, h('strong', { text: arena?.label ?? s.arenaId }), h('span', { text: arena ? mapFacts(arena) : '' })),
      h('span', { class: 'mapcard__change', html: `<span>Changer</span>${icon('chevron-right')}` }),
    );
  }

  function closePicker() {
    if (!picker) return;
    picker.destroy();
    picker.el.remove();
    picker = null;
    render();
    (form.querySelector('.mapcard') as HTMLElement | null)?.focus({ preventScroll: true });
  }

  function openPicker() {
    if (picker) return;
    picker = mapChoice(
      config,
      s.arenaId,
      (id) => {
        s = { ...s, arenaId: id };
        closePicker();
      },
      closePicker,
    );
    el.append(picker.el);
    picker.focus();
  }

  render();

  const createButton = button({ kind: 'primary', size: 'lg', block: true, icon: 'check', label: 'Créer le salon', onClick: () => a.create(s, deck) });
  const address = joinAddress(undefined, true);
  const panel = h(
    'aside',
    { class: 'room-panel-wrap' },
    h(
      'div',
      { class: 'room-panel' },
      address,
      h('span', { class: 'room-panel__note', html: `${icon('users')}<span>Même wifi requis</span>` }),
    ),
    createButton,
  );

  const el = h(
    'main',
    { class: 'screen create' },
    h(
      'section',
      { class: 'create__main' },
      h('header', { class: 'page-head' }, backButton(a.back), h('h1', { class: 'page-head__title', text: 'Nouveau salon' })),
      form,
      message ? h('p', { class: 'overlay__message', attrs: { role: 'alert' }, text: message }) : null,
    ),
    panel,
  );
  return {
    el,
    focus: () => createButton.focus({ preventScroll: true }),
    onKey(e) {
      if (picker) picker.onKey(e);
      else if (e.key === 'Escape') a.back();
    },
    destroy() {
      picker?.destroy();
    },
  };
}
