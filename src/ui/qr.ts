// QR code dessiné en SVG (bibliothèque qrcode). Les couleurs viennent du thème via CSS (.qr), pas d'ici.
import QRCode from 'qrcode';
import { joinUrl, lanBase } from '../net/joinLink';
import { h } from './dom';

/** Bloc QR code vide qui se remplit dès que le SVG est prêt ; reste vide si l'encodage échoue. */
export function qrCode(text: string, label: string): HTMLElement {
  const el = h('div', { class: 'qr', attrs: { role: 'img', 'aria-label': label } });
  QRCode.toString(text, { type: 'svg', errorCorrectionLevel: 'M', margin: 0 })
    .then((svg) => {
      el.innerHTML = svg;
      el.querySelector('svg')?.setAttribute('aria-hidden', 'true');
    })
    .catch(() => el.remove());
  return el;
}

/**
 * Adresse à ouvrir sur l'autre PC, avec son QR code (écrans 06 et 07). Avec un code, le lien rejoint directement le salon.
 * Se remplit quand l'adresse réseau local est connue ; sinon renvoie à npm run host.
 * large : QR en grand, adresse dessous (écran 06).
 */
export function joinAddress(code?: string, large = false): HTMLElement {
  const el = h('div', { class: `join-address${large ? ' join-address--large' : ''}` }, h('p', { class: 'room-panel__note', text: '…' }));
  void lanBase().then((base) => {
    if (!base) {
      el.replaceChildren(h('p', { class: 'room-panel__note', text: 'Pour jouer à plusieurs, lance le jeu avec « npm run host ».' }));
      return;
    }
    const url = joinUrl(base, code);
    el.replaceChildren(
      qrCode(url, code ? `QR code pour rejoindre le salon ${code}` : 'QR code de l’adresse du jeu'),
      h(
        'div',
        { class: 'join-address__text' },
        h('p', { class: 'room-panel__note', text: code ? 'Scanne ou ouvre sur l’autre PC' : 'Sur l’autre PC, ouvre' }),
        h('strong', { class: 'room-panel__address', text: new URL(base).host }),
      ),
    );
  });
  return el;
}
