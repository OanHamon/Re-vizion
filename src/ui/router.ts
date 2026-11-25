// Routeur unique : n'autorise que les liens entre écrans décrits dans ECRANS.md.
import type { Screen } from './screen';

export type ScreenId = '01' | '02' | '04' | '05' | '06' | '07' | '08' | '09' | '10' | '11' | '12' | '13' | '14';

/** Liens de ECRANS.md (« Navigation » et « Mène à »). */
const LINKS: Record<ScreenId, readonly ScreenId[]> = {
  '01': ['02', '04', '05', '06', '07', '08'],
  '02': ['01'],
  '04': ['01'],
  '05': ['01'],
  '06': ['07', '01'],
  '07': ['08', '01'],
  // 08 → 10 et 08 → 13 : le budget peut s'épuiser pendant le choix de carte (point V-026)
  '08': ['09', '10', '13'],
  '09': ['08', '10', '13'],
  '10': ['11'],
  '11': ['12', '13'],
  '12': ['08', '13'],
  '13': ['14'],
  '14': ['07', '13', '01'],
};

/**
 * Sorties d'urgence (point V-026) : abandon de l'adversaire pendant le match → récap (13),
 * perte de la connexion → accueil (01). Elles ne sont pas dans ECRANS.md.
 */
const MATCH_SCREENS: readonly ScreenId[] = ['07', '08', '09', '10', '11', '12'];

/** Filet de sécurité si l'événement de fin d'animation n'arrive pas (onglet en arrière-plan). */
const FADE_FALLBACK_MS = 700;

/** Les fondus suivent le réglage « réduire les animations » du système. */
function animationsOn(): boolean {
  return typeof window !== 'undefined' && !window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

export type RouteReason = 'link' | 'forfeit' | 'disconnect';

export class Router {
  current: ScreenId | null = null;
  private screen: Screen | null = null;

  constructor(private readonly root: HTMLElement) {}

  get active(): Screen | null {
    return this.screen;
  }

  canGo(to: ScreenId, reason: RouteReason = 'link'): boolean {
    const from = this.current;
    if (from === null || from === to) return true;
    if (reason === 'forfeit') return MATCH_SCREENS.includes(from) && to === '13';
    if (reason === 'disconnect') return to === '01';
    return LINKS[from].includes(to);
  }

  /** Affiche un écran. Refuse (et signale) un lien qui n'existe pas dans ECRANS.md. */
  go(to: ScreenId, screen: Screen, reason: RouteReason = 'link'): boolean {
    if (!this.canGo(to, reason)) {
      console.error(`[routeur] lien refusé : ${this.current} → ${to} (absent de ECRANS.md)`);
      screen.destroy?.();
      return false;
    }
    if (this.screen) this.leave(this.screen);
    this.current = to;
    this.screen = screen;
    this.enter(screen.el);
    window.scrollTo(0, 0);
    if (screen.focus) screen.focus();
    else if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
    return true;
  }

  /**
   * Fondu enchaîné : l'écran sortant est libéré tout de suite (écouteurs, 3D, souris capturée),
   * mais son élément reste affiché par-dessus le temps de s'effacer, sans gêner la mise en page du nouveau.
   */
  private leave(old: Screen): void {
    old.destroy?.();
    const el = old.el;
    if (!animationsOn()) {
      el.remove();
      return;
    }
    el.style.top = `${-window.scrollY}px`;
    el.setAttribute('aria-hidden', 'true');
    el.inert = true;
    el.classList.remove('screen-enter');
    el.classList.add('screen-leave');
    const done = () => el.remove();
    el.addEventListener('animationend', (e) => e.target === el && done());
    window.setTimeout(done, FADE_FALLBACK_MS);
  }

  private enter(el: HTMLElement): void {
    if (animationsOn()) {
      el.classList.add('screen-enter');
      el.addEventListener('animationend', (e) => e.target === el && el.classList.remove('screen-enter'));
    }
    this.root.append(el);
  }

  /** Écran technique hors navigation (configuration invalide). */
  showError(screen: Screen): void {
    this.screen?.destroy?.();
    this.screen?.el.remove();
    this.current = null;
    this.screen = screen;
    this.root.append(screen.el);
  }
}
