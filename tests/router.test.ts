import { describe, expect, it } from 'vitest';
import { Router, type ScreenId } from '../src/ui/router';

/** Routeur sans DOM : on ne teste que les liens autorisés. */
function routerAt(screen: ScreenId | null) {
  const r = new Router({} as HTMLElement);
  r.current = screen;
  return r;
}

describe('routeur (liens de ECRANS.md)', () => {
  it('suit le parcours d’un match : 07 → 08 → 09 → 10 → 11 → 12 → 08, puis 11 → 13 → 14 → 07', () => {
    const path: ScreenId[] = ['07', '08', '09', '10', '11', '12', '08', '09', '08'];
    for (let i = 1; i < path.length; i++) expect(routerAt(path[i - 1]!).canGo(path[i]!), `${path[i - 1]} → ${path[i]}`).toBe(true);
    expect(routerAt('11').canGo('13')).toBe(true);
    expect(routerAt('13').canGo('14')).toBe(true);
    expect(routerAt('14').canGo('07')).toBe(true);
  });

  it('entraînement solo : 01 → 08 → 09 → 13', () => {
    expect(routerAt('01').canGo('08')).toBe(true);
    expect(routerAt('09').canGo('13')).toBe(true);
  });

  it('refuse les liens absents de ECRANS.md', () => {
    expect(routerAt('01').canGo('11')).toBe(false);
    expect(routerAt('02').canGo('04')).toBe(false);
    expect(routerAt('13').canGo('01')).toBe(false);
    expect(routerAt('10').canGo('08')).toBe(false);
  });

  it('sorties d’urgence : abandon → 13 depuis un écran de match, connexion perdue → 01', () => {
    expect(routerAt('10').canGo('13', 'forfeit')).toBe(true);
    expect(routerAt('02').canGo('13', 'forfeit')).toBe(false);
    expect(routerAt('11').canGo('01', 'disconnect')).toBe(true);
  });
});
