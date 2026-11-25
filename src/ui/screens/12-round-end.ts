// 12 · Fin de manche : vainqueur, score des manches, stats, compte à rebours vers le quiz suivant.
import type { RoundStats } from '../../core/match/protocol';
import { h } from '../dom';
import type { Screen } from '../screen';

export interface RoundEndData {
  round: number;
  winnerId: string | null;
  endsAt: number;
  roundWins: Record<string, number>;
  stats: RoundStats[];
  matchOver: boolean;
  youId: string;
  players: { id: string; name: string; color: number }[];
}

const percent = (hits: number, shots: number) => (shots > 0 ? `${Math.round((100 * hits) / shots)} %` : '—');

export function roundEndScreen(d: RoundEndData, serverNow: () => number): Screen {
  const name = (id: string | null) => d.players.find((p) => p.id === id)?.name ?? '';
  const title = d.winnerId === null ? 'Manche nulle' : d.winnerId === d.youId ? 'Manche gagnée' : `Manche pour ${name(d.winnerId)}`;
  const [a, b] = d.players;
  // à 2 : « Alice 1 · 0 Bob » ; au-delà : manches gagnées de chacun, du meilleur au moins bon
  const score =
    d.players.length === 2 && a && b
      ? `${a.name} ${d.roundWins[a.id] ?? 0} · ${d.roundWins[b.id] ?? 0} ${b.name}`
      : [...d.players]
          .sort((x, y) => (d.roundWins[y.id] ?? 0) - (d.roundWins[x.id] ?? 0))
          .map((p) => `${p.name} ${d.roundWins[p.id] ?? 0}`)
          .join(' · ');
  const stat = (value: string, label: string) => h('li', { class: 'stat' }, h('strong', { text: value }), h('span', { text: label }));
  const rows = d.players.map((p) => {
    const s = d.stats.find((x) => x.id === p.id);
    return h(
      'section',
      { class: 'recap__section' },
      h('h2', { class: 'recap__heading player-name', style: { '--player': `var(--player-${p.color + 1})` }, text: p.name }),
      h(
        'ul',
        { class: 'stats-row' },
        stat(String(s?.kills ?? 0), 'kills'),
        stat(percent(s?.hits ?? 0, s?.shots ?? 0), 'précision'),
        stat(String(Math.round(s?.damage ?? 0)), 'dégâts'),
      ),
    );
  });
  const countdown = h('div', { class: 'info' });
  const el = h(
    'main',
    { class: 'screen screen--centered recap' },
    h('div', { class: 'info', text: `Manche ${d.round}` }),
    h('h1', { class: 'results__title', text: title }),
    h('div', { class: 'round-score', text: score }),
    ...rows,
    countdown,
  );
  const update = () => {
    const left = Math.max(0, Math.ceil((d.endsAt - serverNow()) / 1000));
    countdown.textContent = d.matchOver ? `Récap dans ${left}` : `Quiz suivant dans ${left}`;
  };
  update();
  return { el, update };
}
