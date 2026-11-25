// 08 · Quiz : choix de carte. « Choisis ta carte » seul, puis 3 grandes cartes qui montent du bas,
// petit minuteur du budget en bas, bonus acquis en colonne à droite, indicateur de combo discret.
import type { Card } from '../../core/quiz/cardDraw';
import { rarityCostMs } from '../../core/quiz/cardDraw';
import { clockPill, lootColumn, waitingBanner } from '../components';
import { familyVars, h, rarityVars } from '../dom';
import { familyLabel, formatSeconds, levelLabel, levelPips, rarityLabel } from '../format';
import { icon } from '../icons';
import { isPlayable, remainingMs, type QuizPort } from '../quizPort';
import { digitIndex, type Screen } from '../screen';
import { sound } from '../sound';

export interface CardChoiceScreen extends Screen {
  /** Salon : on a fini, l'adversaire joue encore. */
  showWaiting(): void;
}

export function cardChoiceScreen(port: QuizPort): CardChoiceScreen {
  const { config } = port;
  const view = port.view();
  const doubleOrNothing = view.handMode === 'doubleOrNothing';
  const minCostMs = Math.min(...config.quiz.rarities.map(rarityCostMs));

  // infos courtes, séparées par des points médians ; la série sert d'indicateur de combo
  const info = h('div', { class: 'info info--corner' }, `Question ${view.questionNumber}${view.maxQuestions > 0 ? `/${view.maxQuestions}` : ''}`);
  if (view.combo.correctStreak > 0) info.append(` · Série ${view.combo.correctStreak}`);
  if (view.combo.wrongStreak >= config.quiz.combos.negative.wrongStreak) {
    info.append(' · ', h('span', { class: 'warn', text: 'Prochaine erreur : malus' }));
  }

  const title = h('h1', { class: 'pick__title', text: doubleOrNothing ? 'Quitte ou double' : 'Choisis ta carte' });
  const subtitle = doubleOrNothing ? h('p', { class: 'pick__subtitle', text: 'Quitte ou double : une erreur et tu prends un malus' }) : null;

  const hand = h('div', { class: `hand${doubleOrNothing ? ' is-dod' : ''}`, style: { '--count': String(view.hand.length) } });
  const buttons = view.hand.map((card, i) => {
    const button = cardButton(port, card, i);
    hand.append(button);
    return { card, button };
  });

  const clock = clockPill(minCostMs);
  const el = h('main', { class: 'screen pick' }, info, title, subtitle, hand, clock.el, lootColumn(view.inventory));

  const update = () => {
    const now = port.now();
    clock.update(remainingMs(port, now), view.totalMs);
    for (const { card, button } of buttons) {
      const playable = isPlayable(port, card, now);
      button.classList.toggle('is-disabled', !playable);
      button.setAttribute('aria-disabled', String(!playable));
    }
  };
  update();
  let waiting = false;
  // les cartes arrivent : souffle et petites notes, ou scintillement du quitte ou double
  sound.play(doubleOrNothing ? 'quiz.doubleOrNothing' : 'quiz.deal');

  return {
    el,
    update,
    showWaiting() {
      if (waiting) return;
      waiting = true;
      hand.classList.add('is-over');
      el.append(waitingBanner());
    },
    onKey(event) {
      const index = digitIndex(event);
      const target = index === null ? undefined : buttons[index];
      if (target && isPlayable(port, target.card)) {
        event.preventDefault();
        sound.play('quiz.pick');
        port.pick(target.card.id);
      }
    },
  };
}

function cardButton(port: QuizPort, card: Card, index: number): HTMLButtonElement {
  const { config } = port;
  const bonus = config.bonuses.bonuses.find((b) => b.id === card.bonusId)!;
  const level = levelPips(config, card.rarity);
  const pips = h('span', { class: 'card__pips', attrs: { 'aria-hidden': 'true' } });
  for (let i = 1; i <= level.total; i++) pips.append(h('i', { class: i <= level.on ? 'on' : '' }));
  const levelText = `${levelLabel(config, card.rarity)} · ${formatSeconds(card.costMs)}`;
  const meta = `${familyLabel(config, card.family)} · ${rarityLabel(config, card.rarity)} · ${levelText}`;

  return h(
    'button',
    {
      class: `card${card.doubleOrNothing ? ' is-dod' : ''}`,
      style: { ...familyVars(card.family), ...rarityVars(card.rarity), '--i': String(index), '--tilt': `${(index - 1) * 4}deg` },
      attrs: { type: 'button', 'aria-label': `${bonus.label}. ${meta}. Touche ${index + 1}.` },
      on: {
        click: () => {
          if (!isPlayable(port, card)) return;
          sound.play('quiz.pick');
          port.pick(card.id);
        },
      },
    },
    // grand pictogramme du bonus en filigrane, dans le ton profond de la famille
    h('span', { class: 'card__motif', html: icon(bonus.icon) }),
    h('span', { class: 'card__key', text: String(index + 1), attrs: { 'aria-hidden': 'true' } }),
    h('span', { class: 'card__rarity', text: rarityLabel(config, card.rarity), attrs: { 'aria-hidden': 'true' } }),
    h('span', { class: 'card__medal', html: icon(bonus.icon) }),
    h('span', { class: 'card__label', text: bonus.label }),
    h('span', { class: 'card__meta', text: levelText }),
    pips,
  );
}
