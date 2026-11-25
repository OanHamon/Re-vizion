// 13 · Récap des erreurs : le cœur pédagogique. Score du quiz, puis pour chaque question ratée :
// énoncé, ta réponse, bonne réponse, explication, et un bouton pour signaler la question.
import type { RecapView } from '../../core/match/quizView';
import { button, gainTag } from '../components';
import { h, rarityVars } from '../dom';
import { icon } from '../icons';
import { isConfirmKey, type Screen } from '../screen';
import { store } from '../store';

const RING_R = 86;
const RING_C = 2 * Math.PI * RING_R;

export function recapScreen(recap: RecapView, deckId: string, onContinue: () => void, deckTitle = ''): Screen {
  const share = recap.total > 0 ? recap.correct / recap.total : 0;
  const score = h('div', {
    class: 'recap__score',
    attrs: { role: 'img', 'aria-label': `${recap.correct} bonnes réponses sur ${recap.total}` },
    html: `<svg viewBox="0 0 200 200"><circle class="track" cx="100" cy="100" r="${RING_R}"/><circle class="fill" cx="100" cy="100" r="${RING_R}" stroke-dasharray="${RING_C}" stroke-dashoffset="${RING_C * (1 - share)}"/></svg>`,
  });
  score.append(h('span', {}, h('span', {}, String(recap.correct), h('small', { text: `/${recap.total}` }))));

  const section = h('section', { class: 'recap__section' }, h('h2', { class: 'recap__heading', text: 'Questions ratées' }));
  if (recap.missed.length === 0) {
    section.append(h('p', { class: 'recap__empty', text: recap.total > 0 ? 'Aucune erreur.' : 'Aucune question jouée.' }));
  } else {
    const reported = new Set(store.reported());
    const list = h('ul', { class: 'missed' });
    for (const r of recap.missed) {
      const key = `${deckId}/${r.question.id}`;
      const given = r.timedOut
        ? h('span', { class: 'tag tag--bad', html: icon('hourglass') }, h('span', { text: 'Temps écoulé' }))
        : h('span', { class: 'tag tag--bad', html: icon('cross') }, h('span', { class: 'txt', text: r.answerText }));
      const report = h('button', {
        class: 'report',
        text: reported.has(key) ? 'Signalée' : 'Signaler la question',
        attrs: { type: 'button', 'aria-pressed': String(reported.has(key)) },
        on: {
          click: () => {
            const all = new Set(store.reported());
            if (all.has(key)) all.delete(key);
            else all.add(key);
            store.setReported([...all]);
            const on = all.has(key);
            report.textContent = on ? 'Signalée' : 'Signaler la question';
            report.setAttribute('aria-pressed', String(on));
          },
        },
      });
      list.append(
        h(
          'li',
          { class: 'missed__item', style: rarityVars(r.card.rarity) },
          h('p', { class: 'missed__q', text: r.question.enonce }),
          h('div', { class: 'missed__answers' }, given, h('span', { class: 'tag tag--good', html: icon('check') }, h('span', { text: r.correctText }))),
          h('p', { class: 'missed__expl', text: r.explication }),
          report,
        ),
      );
    }
    section.append(list);
  }

  const next = button({ kind: 'primary', icon: 'chevron-right', label: 'Voir les résultats', title: 'Voir les résultats (Entrée)', onClick: onContinue });
  const gains = [...recap.bonuses, ...recap.maluses];
  const gainsSection =
    gains.length > 0
      ? h('section', { class: 'recap__section' }, h('h2', { class: 'recap__heading', text: 'Bonus gagnés' }), h('ul', { class: 'gains' }, ...gains.map(gainTag)))
      : null;
  const el = h(
    'main',
    { class: 'screen recap' },
    score,
    h('div', { class: 'info', text: `${deckTitle ? `${deckTitle} · ` : ''}Série max ${recap.bestStreak}` }),
    gainsSection,
    section,
    h('div', { class: 'btn-row btn-row--center' }, next, h('span', { class: 'key-hint', text: 'ou Entrée' })),
  );
  return {
    el,
    focus: () => next.focus({ preventScroll: true }),
    onKey(event) {
      if (isConfirmKey(event) && document.activeElement === document.body) {
        event.preventDefault();
        onContinue();
      }
    },
  };
}
