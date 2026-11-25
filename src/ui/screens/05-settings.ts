// 05 · Paramètres (simplifié) : réduire les flashs et secousses, sensibilité de la souris.
import { backButton, toggleSwitch } from '../components';
import { h } from '../dom';
import type { Screen } from '../screen';
import { sound } from '../sound';

export interface SettingsData {
  reduceEffects: boolean;
  sensitivity: number;
  /** Volume des sons (0 à 1). */
  volume: number;
}

export interface SettingsActions {
  setReduceEffects(v: boolean): void;
  setSensitivity(v: number): void;
  setVolume(v: number): void;
  back(): void;
}

/** Plage du multiplicateur de sensibilité proposé (×0,25 à ×3). */
const SENS_MIN = 0.25;
const SENS_MAX = 3;

export function settingsScreen(d: SettingsData, a: SettingsActions): Screen {
  const value = h('output', { class: 'settings__value', text: d.sensitivity.toFixed(2).replace('.', ',') });
  const slider = h('input', {
    class: 'slider',
    attrs: { type: 'range', min: SENS_MIN, max: SENS_MAX, step: 0.05, value: d.sensitivity, 'aria-label': 'Sensibilité de la souris' },
    on: {
      input: () => {
        const v = Number(slider.value);
        value.textContent = v.toFixed(2).replace('.', ',');
        a.setSensitivity(v);
      },
    },
  });

  const pct = (v: number) => `${Math.round(v * 100)} %`;
  const volumeValue = h('output', { class: 'settings__value', text: pct(d.volume) });
  let previewAt = 0;
  const volume = h('input', {
    class: 'slider',
    attrs: { type: 'range', min: 0, max: 1, step: 0.05, value: d.volume, 'aria-label': 'Volume des sons' },
    on: {
      input: () => {
        const v = Number(volume.value);
        volumeValue.textContent = pct(v);
        a.setVolume(v);
        // petit son témoin, pas plus de 6 par seconde
        const now = performance.now();
        if (now - previewAt > 160) {
          previewAt = now;
          sound.play('ui.click');
        }
      },
    },
  });

  // une carte par groupe, une ligne par réglage : libellé (et détail) à gauche, contrôle à droite
  const group = (title: string, ...rows: HTMLElement[]) => h('section', { class: 'panel' }, h('h2', { class: 'panel__title', text: title }), ...rows);
  const line = (label: string, detail: string | null, ...controls: HTMLElement[]) =>
    h(
      'div',
      { class: 'panel__row' },
      h('span', { class: 'panel__label' }, h('strong', { text: label }), detail ? h('span', { text: detail }) : null),
      h('span', { class: 'panel__control' }, ...controls),
    );

  const el = h(
    'main',
    { class: 'screen menu-page settings' },
    h('header', { class: 'page-head' }, backButton(a.back), h('h1', { class: 'page-head__title', text: 'Paramètres' })),
    group('Contrôles', line('Sensibilité de la souris', null, slider, value)),
    group('Audio', line('Volume', '0 % coupe tous les sons', volume, volumeValue)),
    group(
      'Accessibilité',
      line('Réduire les flashs', 'Atténue explosions, secousses et clignotements', toggleSwitch('Réduire les flashs et secousses', d.reduceEffects, (on) => a.setReduceEffects(on))),
    ),
  );
  return {
    el,
    onKey(e) {
      if (e.key === 'Escape') a.back();
    },
  };
}
