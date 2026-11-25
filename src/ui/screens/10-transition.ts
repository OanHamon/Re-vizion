// 10 · Transition avant combat : les bonus de chaque joueur, leurs scores au quiz,
// compte à rebours 3, 2, 1, numéro de manche et arène.
import type { LoadoutInfo } from '../../core/match/protocol';
import { gainTag } from '../components';
import { h } from '../dom';
import { weaponLabel } from '../format';
import { weaponIcon } from '../icons';
import type { GameConfig } from '../../core/config/gameConfig';
import type { Screen } from '../screen';
import { sound } from '../sound';

export function transitionScreen(
  config: GameConfig,
  data: { round: number; endsAt: number; arena: string; players: LoadoutInfo[]; youId: string },
  serverNow: () => number,
): Screen {
  const count = h('div', { class: 'countdown-big', attrs: { 'aria-live': 'polite' } });
  const column = (p: LoadoutInfo) =>
    h(
      'section',
      { class: 'loadout-col', style: { '--player': `var(--player-${p.color + 1})` } },
      h('div', { class: 'loadout-col__head' }, h('h2', { text: p.id === data.youId ? `${p.name} (toi)` : p.name }), h('span', { class: 'loadout-col__quiz', text: `Quiz ${p.correct}/${p.answered}` })),
      h('div', { class: 'loadout-col__line' }, h('span', { class: 'loadout-col__weapon', html: weaponIcon(p.weaponId) }), weaponLabel(config, p.weaponId)),
      p.entries.length > 0 ? h('ul', { class: 'gains' }, ...p.entries.map(gainTag)) : h('p', { class: 'recap__empty', text: 'Aucun bonus' }),
    );
  const center = h('div', { class: 'transition__center' }, count, h('span', { class: 'transition__label', text: 'Le combat commence' }));
  // à 2 : face à face avec le compte à rebours au milieu ; au-delà : compte à rebours en haut, puis une grille
  const [a, b] = data.players;
  const body =
    data.players.length <= 2
      ? h('div', { class: 'transition__row' }, a ? column(a) : null, center, b ? column(b) : null)
      : h('div', { class: 'transition__many' }, center, h('div', { class: 'transition__grid' }, ...data.players.map(column)));
  const el = h(
    'main',
    { class: 'screen screen--centered transition' },
    h('div', { class: 'info', text: `Manche ${data.round} · ${data.arena}` }),
    body,
  );
  let shown = -1;
  const update = () => {
    const left = Math.max(0, Math.ceil((data.endsAt - serverNow()) / 1000));
    if (left !== shown) {
      sound.play(left > 0 ? 'match.countdown' : 'match.go');
      shown = left;
      count.textContent = left > 0 ? String(left) : '';
      count.classList.remove('is-tick');
      void count.offsetWidth;
      count.classList.add('is-tick');
    }
  };
  update();
  return { el, update };
}
