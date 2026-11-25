// Contrat commun des écrans.

export interface Screen {
  el: HTMLElement;
  /** Appelé à chaque image (minuteurs). */
  update?(now: number): void;
  onKey?(event: KeyboardEvent): void;
  /** Élément à focaliser à l'affichage. */
  focus?(): void;
  /** Libère les ressources (scène 3D, écouteurs…) quand l'écran est remplacé. */
  destroy?(): void;
}

/** Mode du stand de tir (outil de développement, pas un écran du jeu). */
export const TRAINING_MODE_ID = 'training';

/** Touche chiffre 1 à 9 (rangée du haut ou pavé numérique) → index 0 à 8, sinon null. */
export function digitIndex(event: KeyboardEvent): number | null {
  const match = /^(?:Digit|Numpad)([1-9])$/.exec(event.code);
  if (match) return Number(match[1]) - 1;
  return /^[1-9]$/.test(event.key) ? Number(event.key) - 1 : null;
}

export function isConfirmKey(event: KeyboardEvent): boolean {
  return event.key === 'Enter' || event.key === ' ';
}
