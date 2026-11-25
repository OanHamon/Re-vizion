// Calcul pur d'un son à jouer (sans navigateur, testable) : pour chaque couche, quand elle démarre,
// combien de temps elle dure, à quel volume et sur quelles fréquences.
// Le moteur Web Audio (sound.ts) ne fait qu'exécuter ce plan.
import type { SoundDef } from '../core/config/schemas';

export interface PlannedLayer {
  wave: 'sine' | 'triangle' | 'square' | 'sawtooth' | 'noise';
  /** Début (s) relatif au moment de la lecture. */
  start: number;
  attack: number;
  duration: number;
  /** Volume final de la couche (0 à 1), tous volumes multipliés. */
  peak: number;
  freq: [number, number] | null;
  filter: { type: 'lowpass' | 'highpass' | 'bandpass'; freq: [number, number]; q: number } | null;
}

export interface PlanOptions {
  /** Volume général de la config (sounds.json). */
  master: number;
  /** Volume choisi par le joueur (0 à 1). */
  user: number;
  /** Volume propre à cette lecture (ex. tirs de l'adversaire plus discrets). */
  volume?: number;
  /** Décalage de la lecture (s). */
  delay?: number;
  /** Tirage entre -1 et 1 pour la variation de hauteur (Math.random() * 2 - 1 en jeu). */
  jitter?: number;
}

const clamp01 = (v: number) => Math.min(1, Math.max(0, v));

/** Plan d'un son, ou liste vide si le volume total est nul (rien à jouer). */
export function planSound(sound: SoundDef, o: PlanOptions): PlannedLayer[] {
  const level = clamp01(o.master) * clamp01(o.user) * clamp01(o.volume ?? 1) * clamp01(sound.volume);
  if (level <= 0) return [];
  const pitch = 1 + sound.pitchJitter * Math.max(-1, Math.min(1, o.jitter ?? 0));
  return sound.layers.map((l) => ({
    wave: l.wave,
    start: (o.delay ?? 0) + l.delay,
    attack: Math.min(l.attack, l.duration),
    duration: l.duration,
    peak: level * l.gain,
    freq: l.freq ? [l.freq[0] * pitch, l.freq[1] * pitch] : null,
    filter: l.filter ? { type: l.filter.type, freq: [l.filter.freq[0] * pitch, l.filter.freq[1] * pitch], q: l.filter.q } : null,
  }));
}

/** true si le son peut rejouer maintenant (écart minimal `cooldownMs` depuis la dernière lecture). */
export function cooledDown(sound: SoundDef, lastAt: number | undefined, now: number): boolean {
  return lastAt === undefined || now - lastAt >= sound.cooldownMs;
}
