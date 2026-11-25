// 09 · Quiz : question. Carte en jeu, énoncé, 2 à 4 réponses (clic ou touches 1 à 4),
// minuteur égal au coût de la carte, puis retour bonne ou mauvaise réponse avec l'explication.
import type { ResultView } from '../../core/match/quizView';
import { rarityCostMs } from '../../core/quiz/cardDraw';
import { button, clockPill, lootColumn, waitingBanner } from '../components';
import { familyVars, h, rarityVars } from '../dom';
import { levelLabel, rarityLabel } from '../format';
import { icon } from '../icons';
import { remainingMs, type QuizPort } from '../quizPort';
import { digitIndex, isConfirmKey, type Screen } from '../screen';
import { sound } from '../sound';

const RING_R = 30;
const RING_C = 2 * Math.PI * RING_R;
/** Sous ce seuil, le minuteur passe en couleur d'alerte (sans clignoter). */
const LOW_SHARE = 0.25;
/** Tic sonore sur les dernières secondes de la question. */
const TICK_FROM_SECONDS = 5;

export interface QuestionScreen extends Screen {
  turn: number;
  showFeedback(result: ResultView): void;
  /** Salon : on a fini, l'adversaire joue encore. */
  showWaiting(): void;
}

const END_R = 26;
const END_C = 2 * Math.PI * END_R;

export function questionScreen(port: QuizPort): QuestionScreen {
  const { config } = port;
  const view = port.view();
  const active = view.active;
  if (!active) throw new Error('questionScreen sans question en cours');
  const { card, question } = active;
  const bonus = config.bonuses.bonuses.find((b) => b.id === card.bonusId)!;
  const minCostMs = Math.min(...config.quiz.rarities.map(rarityCostMs));

  const chip = h(
    'div',
    { class: 'chip', style: { ...familyVars(card.family), ...rarityVars(card.rarity) } },
    h('span', { class: 'chip__icon', html: icon(bonus.icon) }),
    h('span', { class: 'chip__label', text: bonus.label }),
    h('span', { class: 'chip__meta', text: `${levelLabel(config, card.rarity)} · ${rarityLabel(config, card.rarity)}` }),
  );
  const countdownText = h('span', { text: '' });
  const countdown = h('div', {
    class: 'countdown',
    style: rarityVars(card.rarity),
    attrs: { role: 'timer', 'aria-label': 'Temps pour répondre' },
    html: `<svg viewBox="0 0 74 74"><circle class="track" cx="37" cy="37" r="${RING_R}"/><circle class="fill" cx="37" cy="37" r="${RING_R}" stroke-dasharray="${RING_C}" stroke-dashoffset="0"/></svg>`,
  });
  countdown.append(countdownText);
  const ring = countdown.querySelector<SVGCircleElement>('.fill')!;

  const statement = h('h1', { class: 'ask__statement', text: question.enonce });
  const answers = h('div', { class: 'answers' });
  const answerButtons = question.choix.map((choice, i) => {
    const button = h(
      'button',
      { class: 'answer', attrs: { type: 'button', 'aria-label': `${choice}. Touche ${i + 1}.` }, on: { click: () => choose(i) } },
      h('span', { class: 'answer__key', text: String(i + 1), attrs: { 'aria-hidden': 'true' } }),
      h('span', { text: choice }),
    );
    answers.append(button);
    return button;
  });

  const feedbackSlot = h('div', { attrs: { 'aria-live': 'polite' } });
  const inner = h('div', { class: 'ask__inner' }, h('div', { class: 'ask__top' }, chip, countdown), statement, answers, feedbackSlot);
  const clock = clockPill(minCostMs);
  let loot = lootColumn(view.inventory);
  const info = h('div', { class: 'info info--corner' }, `Question ${view.questionNumber}${view.maxQuestions > 0 ? `/${view.maxQuestions}` : ''}`);
  if (view.combo.correctStreak > 0) info.append(` · Série ${view.combo.correctStreak}`);
  const el = h('main', { class: 'screen ask is-entering' }, info, inner, clock.el, loot);

  let answered = false;
  let finished = false;
  let waiting = false;
  let lastSeconds = -1;
  // dernier retour : le bouton « continuer » devient un anneau 5 → 0 qui enchaîne seul
  let continueButton: HTMLButtonElement | null = null;
  let endRing: { fill: SVGCircleElement; text: HTMLElement; shown: number } | null = null;
  let continueHint: HTMLElement | null = null;

  function armEndCountdown(button: HTMLButtonElement) {
    button.className = 'end-countdown';
    button.setAttribute('aria-label', 'Fin du quiz. Entrée pour passer.');
    button.title = 'Entrée pour passer';
    button.innerHTML = `<svg viewBox="0 0 60 60" aria-hidden="true"><circle class="track" cx="30" cy="30" r="${END_R}"/><circle class="fill" cx="30" cy="30" r="${END_R}" stroke-dasharray="${END_C}" stroke-dashoffset="0"/></svg>`;
    const text = h('span', { class: 'end-countdown__n' });
    button.append(text, h('span', { class: 'end-countdown__label', text: 'Fin du quiz' }));
    endRing = { fill: button.querySelector<SVGCircleElement>('.fill')!, text, shown: -1 };
    if (continueHint) continueHint.textContent = 'Entrée pour passer';
  }

  function updateEndCountdown(now: number) {
    const autoEndAt = port.view().autoEndAt;
    if (!continueButton || waiting) return;
    if (autoEndAt !== null && !endRing) armEndCountdown(continueButton);
    if (!endRing || autoEndAt === null) return;
    const totalMs = config.quiz.endCountdownSeconds * 1000;
    const left = Math.max(0, autoEndAt - now);
    const seconds = Math.ceil(left / 1000);
    if (seconds !== endRing.shown) {
      if (endRing.shown !== -1 && seconds > 0) sound.play('quiz.endTick');
      endRing.shown = seconds;
      endRing.text.textContent = String(seconds);
      endRing.text.classList.remove('is-tick');
      void endRing.text.offsetWidth;
      endRing.text.classList.add('is-tick');
    }
    endRing.fill.style.strokeDashoffset = String(totalMs > 0 ? END_C * (1 - left / totalMs) : END_C);
  }

  function choose(i: number) {
    if (answered) return;
    answered = true;
    answerButtons.forEach((b, j) => b.classList.toggle('is-chosen', j === i));
    port.answer(i);
  }

  const update = () => {
    const now = port.now();
    clock.update(remainingMs(port, now), view.totalMs);
    if (finished) {
      updateEndCountdown(now);
      return;
    }
    const left = Math.max(0, active.deadline - now);
    const seconds = Math.ceil(left / 1000);
    if (seconds !== lastSeconds) {
      countdownText.textContent = String(seconds);
      // tic discret sur les 5 dernières secondes, tant qu'on n'a pas répondu
      if (lastSeconds !== -1 && seconds > 0 && seconds <= TICK_FROM_SECONDS && !answered) sound.play('quiz.tick');
      lastSeconds = seconds;
    }
    ring.style.strokeDashoffset = String(RING_C * (1 - left / card.costMs));
    countdown.classList.toggle('is-low', left <= card.costMs * LOW_SHARE);
  };
  update();

  return {
    el,
    turn: active.turn,
    update,
    onKey(event) {
      if (finished) {
        if (isConfirmKey(event) && !waiting) {
          event.preventDefault();
          port.next();
        }
        return;
      }
      const index = digitIndex(event);
      if (index !== null && index < answerButtons.length) {
        event.preventDefault();
        choose(index);
      }
    },
    showFeedback(result) {
      if (finished) return;
      finished = true;
      el.classList.remove('is-entering');
      sound.play(result.correct ? 'quiz.correct' : result.timedOut ? 'quiz.timeout' : 'quiz.wrong');
      if (result.malus) sound.play('quiz.malus', { delay: 0.3 });
      answerButtons.forEach((button, i) => {
        button.disabled = true;
        if (i === result.correctIndex) button.classList.add('is-correct');
        else if (i === result.answer) button.classList.add('is-wrong');
        else button.classList.add('is-dim');
      });

      const head = result.correct ? 'Bonne réponse' : result.timedOut ? 'Temps écoulé' : 'Raté';
      const gain = h('div', { class: 'feedback__gain' });
      if (result.gained) gain.append(`+ ${result.gained.label}`);
      if (result.malus) gain.append(h('span', { class: 'malus', text: `Malus : ${result.malus.label}` }));
      if (!result.gained && !result.malus) gain.append('Pas de bonus');

      const text = h('p', { class: 'feedback__text' });
      if (!result.correct) text.append('Bonne réponse : ', h('strong', { text: result.correctText }), '. ');
      text.append(result.explication);

      continueButton = button({ kind: 'primary', icon: 'chevron-right', label: 'Continuer', title: 'Continuer (Entrée)', onClick: () => port.next() });
      continueHint = h('span', { class: 'key-hint', text: 'ou Entrée' });
      feedbackSlot.replaceChildren(
        h(
          'section',
          { class: `feedback ${result.correct ? 'is-good' : 'is-bad'}` },
          h('span', { class: 'feedback__badge', html: icon(result.correct ? 'check' : result.timedOut ? 'hourglass' : 'cross') }),
          h('div', {}, h('div', { class: 'feedback__head', text: head }), gain),
          text,
        ),
        h('div', { class: 'btn-row feedback__next' }, continueButton, continueHint),
      );
      const newLoot = lootColumn(port.view().inventory, result.turn);
      loot.replaceWith(newLoot);
      loot = newLoot;
      update();
      continueButton.focus({ preventScroll: true });
    },
    showWaiting() {
      if (waiting) return;
      waiting = true;
      if (endRing) {
        endRing.text.textContent = '0';
        endRing.fill.style.strokeDashoffset = String(END_C);
      }
      continueButton?.setAttribute('disabled', '');
      if (continueHint) continueHint.textContent = '';
      el.append(waitingBanner());
    },
  };
}
