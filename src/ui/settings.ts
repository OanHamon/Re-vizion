// Réglages du joueur gardés dans ce navigateur (confort personnel, pas de gameplay).
// Le stockage peut être indisponible (navigation privée…) : on retombe sur la valeur par défaut.

const REDUCE_EFFECTS_KEY = 'reviz.reduceEffects';

/** Option d'accessibilité « réduire flashs et secousses ». Par défaut : réglage « réduire les animations » du système. */
export function getReduceEffects(): boolean {
  try {
    const stored = localStorage.getItem(REDUCE_EFFECTS_KEY);
    if (stored !== null) return stored === '1';
  } catch {
    // stockage indisponible
  }
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

export function setReduceEffects(value: boolean): void {
  try {
    localStorage.setItem(REDUCE_EFFECTS_KEY, value ? '1' : '0');
  } catch {
    // stockage indisponible : le choix vaut pour cette partie seulement
  }
}
