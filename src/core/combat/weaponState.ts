// État d'une arme pendant le combat : cadence, chargeur, rechargement, recul.
// Le recul monte à chaque tir (plus vite en rafale si rampDeg > 0) et redescend
// seulement quand on arrête de tirer.
import type { WeaponStats } from './stats';

export type FireResult = 'fired' | 'empty' | 'busy';

/** Au-delà de cet écart (en intervalles de tir), la rafale est terminée et le recul redescend. */
const BURST_GAP_INTERVALS = 1.5;

export class WeaponState {
  ammo: number;
  reloadUntil: number | null = null;
  reloadStartedAt = 0;
  /** Recul actuel, en degrés (ajouté à l'angle de visée vers le haut). */
  recoilDeg = 0;
  /** Nombre de tirs enchaînés dans la rafale en cours. */
  burst = 0;
  private nextShotAt = 0;
  private lastShotAt = -Infinity;

  constructor(public stats: WeaponStats) {
    this.ammo = stats.magazineSize;
  }

  get reloading(): boolean {
    return this.reloadUntil !== null;
  }

  reloadProgress(now: number): number {
    if (this.reloadUntil === null) return 0;
    return Math.min(1, (now - this.reloadStartedAt) / (this.reloadUntil - this.reloadStartedAt));
  }

  private get interval(): number {
    return 1 / this.stats.fireRate;
  }

  /** Fait avancer le temps. Renvoie true si un rechargement vient de se terminer. */
  update(now: number, dt: number): boolean {
    let reloaded = false;
    if (this.reloadUntil !== null && now >= this.reloadUntil) {
      this.ammo = this.stats.magazineSize;
      this.reloadUntil = null;
      reloaded = true;
    }
    if (now - this.lastShotAt > this.interval * BURST_GAP_INTERVALS) {
      this.burst = 0;
      this.recoilDeg = Math.max(0, this.recoilDeg - this.stats.recoverDegPerSec * dt);
    }
    return reloaded;
  }

  canFire(now: number): boolean {
    return this.reloadUntil === null && this.ammo > 0 && now >= this.nextShotAt;
  }

  fire(now: number): FireResult {
    if (this.reloadUntil !== null || now < this.nextShotAt) return 'busy';
    if (this.ammo <= 0) return 'empty';
    this.ammo--;
    this.burst = now - this.lastShotAt <= this.interval * BURST_GAP_INTERVALS ? this.burst + 1 : 0;
    this.lastShotAt = now;
    this.nextShotAt = now + this.interval;
    const kick = this.stats.kickDeg + this.stats.rampDeg * this.burst;
    this.recoilDeg = Math.min(this.stats.maxRecoilDeg, this.recoilDeg + kick);
    return 'fired';
  }

  /** Lance un rechargement si le chargeur n'est pas plein. */
  reload(now: number): boolean {
    if (this.reloadUntil !== null || this.ammo >= this.stats.magazineSize) return false;
    this.reloadStartedAt = now;
    this.reloadUntil = now + this.stats.reloadSeconds;
    return true;
  }

  /** Change d'arme : un rechargement en cours est annulé. */
  cancelReload(): void {
    this.reloadUntil = null;
  }

  /** Les statistiques peuvent changer en combat (bonus à durée limitée). */
  setStats(stats: WeaponStats): void {
    this.stats = stats;
    this.ammo = Math.min(this.ammo, stats.magazineSize);
  }
}
