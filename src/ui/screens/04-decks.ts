// 04 · Decks (simplifié : liste et import JSON). Chaque deck : titre, nombre de questions,
// répartition des difficultés, auteur. Import par glisser-déposer ou sélection de fichier,
// avec les erreurs du validateur. Le deck choisi sert à l'entraînement et aux salons créés.
import { DIFFICULTY_MAX, DIFFICULTY_MIN } from '../../core/deck/deckSchema';
import { validateDeck, type Deck } from '../../core/deck/validateDeck';
import { backButton, button } from '../components';
import { h } from '../dom';
import { icon } from '../icons';
import type { Screen } from '../screen';

export interface DeckEntry {
  deck: Deck;
  imported: boolean;
}

export interface DecksActions {
  select(id: string): void;
  import(raw: unknown, deck: Deck): void;
  remove(id: string): void;
  back(): void;
}

function distribution(deck: Deck): HTMLElement {
  const counts: number[] = [];
  for (let d = DIFFICULTY_MIN; d <= DIFFICULTY_MAX; d++) counts.push(deck.questions.filter((q) => q.difficulte === d).length);
  const max = Math.max(1, ...counts);
  return h(
    'div',
    { class: 'difficulty-bars', attrs: { role: 'img', 'aria-label': `Répartition des difficultés de 1 à 5 : ${counts.join(', ')}` } },
    ...counts.map((c, i) => h('span', { style: { '--h': String(c / max) }, attrs: { title: `Difficulté ${i + DIFFICULTY_MIN} : ${c}` } })),
  );
}

export function decksScreen(decks: readonly DeckEntry[], selectedId: string, a: DecksActions): Screen {
  const errors = h('div', { class: 'deck-errors', attrs: { 'aria-live': 'polite' } });
  const showErrors = (file: string, lines: string[]) =>
    errors.replaceChildren(
      h('strong', { text: `${file} · ${lines.length} erreur${lines.length > 1 ? 's' : ''}` }),
      h('ul', {}, ...lines.map((l) => h('li', { text: l }))),
    );

  const list = h(
    'ul',
    { class: 'deck-list' },
    ...decks.map(({ deck, imported }) => {
      const selected = deck.deck.id === selectedId;
      return h(
        'li',
        { class: `deck-row${selected ? ' is-selected' : ''}` },
        h(
          'button',
          {
            class: 'deck-row__pick',
            attrs: { type: 'button', 'aria-pressed': String(selected), 'aria-label': `${deck.deck.titre}${selected ? ', choisi' : ', choisir ce deck'}` },
            on: { click: () => a.select(deck.deck.id) },
          },
          h(
            'span',
            { class: 'deck-row__main' },
            h('strong', { text: deck.deck.titre }),
            h('span', { class: 'deck-row__meta', text: `${deck.deck.matiere} · ${deck.questions.length} questions · ${deck.deck.auteur}${imported ? ' · importé' : ''}` }),
          ),
          distribution(deck),
          h('span', { class: 'badge badge--good', html: icon('check') }, h('span', { text: selected ? 'Choisi' : 'Valide' })),
        ),
        imported ? button({ kind: 'ghost', size: 'sm', icon: 'cross', ariaLabel: `Retirer ${deck.deck.titre}`, title: 'Retirer', onClick: () => a.remove(deck.deck.id) }) : null,
      );
    }),
  );

  const fileInput = h('input', { attrs: { type: 'file', accept: '.json,application/json', hidden: true } });
  async function readFile(file: File) {
    let raw: unknown;
    try {
      raw = JSON.parse(await file.text());
    } catch {
      showErrors(file.name, ['ce n’est pas un JSON valide.']);
      return;
    }
    const result = validateDeck(raw, file.name);
    if (!result.ok) {
      showErrors(file.name, result.errors);
      return;
    }
    if (decks.some((d) => d.deck.deck.id === result.deck.deck.id && !d.imported)) {
      showErrors(file.name, [`un deck intégré utilise déjà l'id « ${result.deck.deck.id} ».`]);
      return;
    }
    a.import(raw, result.deck);
  }
  fileInput.addEventListener('change', () => {
    const file = fileInput.files?.[0];
    if (file) void readFile(file);
  });

  const drop = h(
    'div',
    {
      class: 'dropzone',
      attrs: { role: 'button', tabindex: 0, 'aria-label': 'Importer un deck JSON' },
      on: {
        click: () => fileInput.click(),
        keydown: (e) => {
          if (e.key === 'Enter' || e.key === ' ') fileInput.click();
        },
        dragover: (e) => {
          e.preventDefault();
          drop.classList.add('is-over');
        },
        dragleave: () => drop.classList.remove('is-over'),
        drop: (e) => {
          e.preventDefault();
          drop.classList.remove('is-over');
          const file = e.dataTransfer?.files[0];
          if (file) void readFile(file);
        },
      },
    },
    h('span', { html: icon('upload') }),
    'Glisse un fichier .json ici ou clique pour choisir',
  );

  const el = h(
    'main',
    { class: 'screen menu-page decks' },
    h('header', { class: 'page-head' }, backButton(a.back), h('h1', { class: 'page-head__title', text: 'Mes decks' })),
    list,
    drop,
    fileInput,
    errors,
  );
  return {
    el,
    onKey(e) {
      if (e.key === 'Escape') a.back();
    },
  };
}
