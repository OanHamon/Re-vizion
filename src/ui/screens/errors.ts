// Écran affiché quand la config ou les decks sont invalides : on liste les erreurs telles quelles.
import { h } from '../dom';
import type { Screen } from '../screen';

export function errorsScreen(title: string, errors: readonly string[]): Screen {
  const el = h(
    'main',
    { class: 'screen screen--centered errors' },
    h('h1', { text: title }),
    h('p', { text: 'Corrige ces points puis recharge la page.' }),
    h('ul', {}, ...errors.map((e) => h('li', { text: e }))),
  );
  return { el };
}
