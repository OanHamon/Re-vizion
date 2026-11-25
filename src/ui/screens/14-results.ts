// 14 · Résultats : victoire ou défaite, score, hexagone de comparaison des deux joueurs
// (6 axes de config/stats.json) et tableau des valeurs, la meilleure de chaque axe en gras.
// Pièces gagnées (stats de combat, config/economy.json) et leur détail.
// Rejouer (même salon) → 07 · Revoir le récap → 13 · Accueil → 01.
import type { GameConfig } from '../../core/config/gameConfig';
import type { AxisValues } from '../../core/match/matchStats';
import type { PlayerResult } from '../../core/match/protocol';
import type { RecapView } from '../../core/match/quizView';
import { button } from '../components';
import { icon } from '../icons';
import { h } from '../dom';
import type { Screen } from '../screen';
import { sound } from '../sound';

export interface ResultsData {
  /** null en entraînement solo. */
  match: { youId: string; winnerId: string | null; forfeit: boolean; players: PlayerResult[] } | null;
  recap: RecapView;
  /** Entraînement solo : le joueur seul sur l'hexagone. */
  solo?: { name: string; axes: AxisValues };
}

export interface ResultsActions {
  /** Absent en solo : rejouer passe par le salon (07). */
  replay?: () => void;
  review: () => void;
  home: () => void;
}

interface Series {
  name: string;
  color: number;
  axes: AxisValues;
}

const SVG_NS = 'http://www.w3.org/2000/svg';
const W = 520;
const H = 400;
const CX = W / 2;
const CY = H / 2;
const R = 140;

function svg<K extends keyof SVGElementTagNameMap>(tag: K, attrs: Record<string, string | number>): SVGElementTagNameMap[K] {
  const el = document.createElementNS(SVG_NS, tag);
  for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, String(v));
  return el;
}

/** Point de l'axe i (sur n) à la part `share` du rayon ; l'axe 0 est en haut, sens horaire. */
function point(i: number, n: number, share: number): [number, number] {
  const angle = -Math.PI / 2 + (i * 2 * Math.PI) / n;
  return [CX + Math.cos(angle) * R * share, CY + Math.sin(angle) * R * share];
}

function hexagon(config: GameConfig, series: Series[]): SVGSVGElement {
  const { axes, scale } = config.stats;
  const n = axes.length;
  const root = svg('svg', { viewBox: `0 0 ${W} ${H}`, class: 'hex', role: 'img' });
  const ring = (share: number) => axes.map((_, i) => point(i, n, share).join(',')).join(' ');

  root.append(svg('polygon', { points: ring(1), class: 'hex__frame' }));
  for (const share of [1 / 3, 2 / 3]) root.append(svg('polygon', { points: ring(share), class: 'hex__ring' }));
  axes.forEach((_, i) => {
    const [x, y] = point(i, n, 1);
    root.append(svg('line', { x1: CX, y1: CY, x2: x, y2: y, class: 'hex__spoke' }));
  });

  for (const s of series) {
    const g = svg('g', { class: 'hex__series', style: `--player: var(--player-${s.color + 1})` });
    const pts = axes.map((a, i) => point(i, n, Math.max(0, Math.min(1, (s.axes[a.id] ?? 0) / scale))));
    g.append(svg('polygon', { points: pts.map((p) => p.join(',')).join(' '), class: 'hex__shape' }));
    for (const [x, y] of pts) g.append(svg('circle', { cx: x, cy: y, r: 5, class: 'hex__dot' }));
    root.append(g);
  }

  axes.forEach((a, i) => {
    const [x, y] = point(i, n, 1.12);
    const cos = Math.cos(-Math.PI / 2 + (i * 2 * Math.PI) / n);
    const anchor = cos > 0.2 ? 'start' : cos < -0.2 ? 'end' : 'middle';
    const sin = Math.sin(-Math.PI / 2 + (i * 2 * Math.PI) / n);
    const label = svg('text', { x, y: y + (sin < -0.5 ? -4 : sin > 0.5 ? 12 : 4), 'text-anchor': anchor, class: 'hex__label' });
    label.textContent = a.label;
    root.append(label);
  });

  const summary = series.map((s) => `${s.name} : ${axes.map((a) => `${a.label} ${s.axes[a.id] ?? '—'}`).join(', ')}`).join(' ; ');
  root.setAttribute('aria-label', `Hexagone de comparaison. ${summary}`);
  return root;
}

function valuesTable(config: GameConfig, series: Series[]): HTMLElement {
  const head = h(
    'tr',
    {},
    h('th', { attrs: { scope: 'col' } }),
    ...series.map((s) => h('th', { attrs: { scope: 'col' } }, h('span', { class: 'player-name', style: { '--player': `var(--player-${s.color + 1})` }, text: s.name }))),
  );
  const rows = config.stats.axes.map((a) => {
    const values = series.map((s) => s.axes[a.id] ?? null);
    const known = values.filter((v): v is number => v !== null);
    const best = series.length > 1 && known.length === series.length && new Set(known).size > 1 ? Math.max(...known) : null;
    return h(
      'tr',
      {},
      h('th', { attrs: { scope: 'row' }, text: a.label }),
      ...values.map((v) => h('td', { class: best === null ? '' : v === best ? 'is-best' : 'is-lower', text: v === null ? '—' : String(v) })),
    );
  });
  return h(
    'div',
    { class: 'values' },
    h('table', {}, h('thead', {}, head), h('tbody', {}, ...rows)),
    h('p', { class: 'values__note', text: config.stats.note }),
  );
}

/** « +N pièces » et le détail des gains, séparés par des points médians. */
function coinsBlock(config: GameConfig, you: PlayerResult | undefined): HTMLElement | null {
  if (!you?.coins) return null;
  const { total, lines, capped } = you.coins;
  const detail = lines.map((l) => `${l.label} +${l.coins}`).join(' · ') + (capped ? ` · plafond ${config.economy.maxPerMatch}` : '');
  return h(
    'div',
    { class: 'results__coins', attrs: { 'aria-label': `${total} ${config.economy.currencyLabel} gagnées. ${detail}` } },
    h('div', { class: 'results__coins-total' }, h('span', { class: 'coin-chip__icon', html: icon('coin') }), h('strong', { text: `+${total}` }), ` ${config.economy.currencyLabel}`),
    detail ? h('p', { class: 'results__coins-detail', text: detail }) : null,
  );
}

export function resultsScreen(config: GameConfig, data: ResultsData, actions: ResultsActions): Screen {
  const { match, recap } = data;
  let title = 'Entraînement terminé';
  let tone = 'is-draw';
  let series: Series[] = data.solo ? [{ name: data.solo.name, color: 0, axes: data.solo.axes }] : [];
  let score: HTMLElement | null = h('div', { class: 'results__score' }, h('strong', { text: `${recap.correct}/${recap.total}` }), ' bonnes réponses');
  if (match) {
    if (match.winnerId === null) title = 'Égalité';
    else if (match.winnerId === match.youId) {
      title = match.forfeit ? 'Victoire par abandon' : 'Victoire';
      tone = 'is-win';
    } else {
      title = 'Défaite';
      tone = 'is-loss';
    }
    // toi d'abord, puis les adversaires
    const players = [...match.players].sort((a, b) => Number(b.id === match.youId) - Number(a.id === match.youId));
    series = players.map((p) => ({ name: p.name, color: p.color, axes: p.axes ?? {} }));
    const [a, b] = players;
    const who = (p: PlayerResult) => h('span', { class: 'player-name', style: { '--player': `var(--player-${p.color + 1})` }, text: p.name });
    if (players.length === 2 && a && b) {
      score = h('div', { class: 'results__score' }, who(a), h('strong', { text: `${a.roundWins} – ${b.roundWins}` }), who(b));
    } else {
      // classement : manches gagnées, puis kills
      const ranked = [...players].sort((x, y) => y.roundWins - x.roundWins || y.kills - x.kills);
      score = h(
        'ol',
        { class: 'results__ranking' },
        ...ranked.map((p) => h('li', {}, who(p), h('span', { text: `${p.roundWins} manche${p.roundWins > 1 ? 's' : ''} · ${p.kills} kill${p.kills > 1 ? 's' : ''}` }))),
      );
    }
  }

  if (tone === 'is-win') sound.play('results.victory');
  else if (tone === 'is-loss') sound.play('results.defeat');

  const replay = actions.replay ? button({ kind: 'primary', icon: 'replay', label: 'Rejouer', onClick: actions.replay }) : null;
  const review = button({ kind: replay ? 'secondary' : 'primary', icon: 'book', label: 'Revoir le récap', onClick: actions.review });
  const home = button({ kind: 'ghost', icon: 'home', label: 'Accueil', onClick: actions.home });

  const el = h(
    'main',
    { class: 'screen screen--centered results' },
    h('h1', { class: `results__title ${tone}`, text: title }),
    score,
    match ? coinsBlock(config, match.players.find((p) => p.id === match.youId)) : null,
    series.length ? h('div', { class: 'results__body' }, hexagon(config, series), valuesTable(config, series)) : null,
    h('div', { class: 'btn-row btn-row--center' }, replay, review, home),
  );
  return { el, focus: () => (replay ?? review).focus({ preventScroll: true }) };
}
