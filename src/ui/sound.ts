// Moteur de sons : synthèse en direct avec la Web Audio API (aucun fichier, aucune dépendance).
// Le code du jeu ne joue que des ids du catalogue config/sounds.json : `sound.play('quiz.correct')`.
// Le contexte audio n'est créé qu'au premier geste du joueur (règle des navigateurs).
import type { SoundsConfig } from '../core/config/schemas';
import { cooledDown, planSound, type PlannedLayer } from './soundPlan';

const SILENCE = 0.0001;

class SoundEngine {
  private config: SoundsConfig | null = null;
  private user = 1;
  private ctx: AudioContext | null = null;
  private out: GainNode | null = null;
  private noise: AudioBuffer | null = null;
  private readonly lastPlayed = new Map<string, number>();

  init(config: SoundsConfig, userVolume: number): void {
    this.config = config;
    this.user = userVolume;
    // le premier geste débloque l'audio (sinon le navigateur le garde muet)
    const unlock = () => {
      this.context();
      window.removeEventListener('pointerdown', unlock, true);
      window.removeEventListener('keydown', unlock, true);
    };
    window.addEventListener('pointerdown', unlock, true);
    window.addEventListener('keydown', unlock, true);
  }

  setVolume(v: number): void {
    this.user = v;
  }

  has(id: string): boolean {
    return !!this.config?.sounds[id];
  }

  /** Joue un son du catalogue ; `fallback` si l'id n'existe pas (ex. arme sans son propre). */
  play(id: string, opts: { volume?: number; delay?: number; fallback?: string } = {}): void {
    const config = this.config;
    if (!config) return;
    const key = config.sounds[id] ? id : opts.fallback;
    const def = key ? config.sounds[key] : undefined;
    if (!key || !def) return;
    const now = performance.now();
    if (!cooledDown(def, this.lastPlayed.get(key), now)) return;
    const plan = planSound(def, { master: config.masterVolume, user: this.user, volume: opts.volume, delay: opts.delay, jitter: Math.random() * 2 - 1 });
    if (plan.length === 0) return;
    const ctx = this.context();
    if (!ctx || ctx.state !== 'running') return;
    this.lastPlayed.set(key, now);
    for (const layer of plan) this.playLayer(ctx, layer);
  }

  private context(): AudioContext | null {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') void this.ctx.resume();
      return this.ctx;
    }
    const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return null;
    try {
      const ctx = new Ctor();
      // léger compresseur en sortie : plusieurs sons en même temps ne saturent pas
      const comp = ctx.createDynamicsCompressor();
      comp.threshold.value = -14;
      comp.ratio.value = 4;
      comp.connect(ctx.destination);
      this.out = ctx.createGain();
      this.out.connect(comp);
      // 1 s de bruit blanc, réutilisée par toutes les couches « noise »
      this.noise = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
      const data = this.noise.getChannelData(0);
      for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
      this.ctx = ctx;
      if (ctx.state === 'suspended') void ctx.resume();
      return ctx;
    } catch {
      return null;
    }
  }

  private playLayer(ctx: AudioContext, l: PlannedLayer): void {
    const t0 = ctx.currentTime + l.start;
    const t1 = t0 + l.duration;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(SILENCE, t0);
    gain.gain.linearRampToValueAtTime(Math.max(SILENCE, l.peak), t0 + Math.max(0.002, l.attack));
    gain.gain.exponentialRampToValueAtTime(SILENCE, t1);

    let source: AudioScheduledSourceNode;
    if (l.wave === 'noise') {
      const src = ctx.createBufferSource();
      src.buffer = this.noise;
      src.loop = true;
      source = src;
    } else {
      const osc = ctx.createOscillator();
      osc.type = l.wave;
      const [f0, f1] = l.freq ?? [440, 440];
      osc.frequency.setValueAtTime(f0, t0);
      if (f1 !== f0) osc.frequency.exponentialRampToValueAtTime(f1, t1);
      source = osc;
    }

    let last: AudioNode = source;
    if (l.filter) {
      const filter = ctx.createBiquadFilter();
      filter.type = l.filter.type;
      filter.Q.value = l.filter.q;
      const [f0, f1] = l.filter.freq;
      filter.frequency.setValueAtTime(f0, t0);
      if (f1 !== f0) filter.frequency.exponentialRampToValueAtTime(f1, t1);
      last.connect(filter);
      last = filter;
    }
    last.connect(gain);
    gain.connect(this.out!);
    source.start(t0);
    source.stop(t1 + 0.02);
    source.onended = () => gain.disconnect();
  }
}

/** Instance unique : tous les écrans jouent par elle. */
export const sound = new SoundEngine();

/** Sons des clics de l'interface : un seul écouteur pour tous les écrans. */
export function installUiSounds(root: HTMLElement): void {
  root.addEventListener('click', (event) => {
    const target = (event.target as HTMLElement | null)?.closest<HTMLElement>(
      'button, [role="button"]',
    );
    if (!target || target.matches(':disabled, [aria-disabled="true"]')) return;
    // les cartes et les réponses ont leur propre son (quiz.pick, retour de réponse)
    if (target.matches('.card, .answer, .end-countdown')) return;
    sound.play(target.matches('.btn-back') ? 'ui.back' : 'ui.click');
  });
}
