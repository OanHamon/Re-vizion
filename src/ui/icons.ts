// Icônes géométriques en SVG (trait = currentColor, donc colorées par le thème).
// Les ids correspondent au champ « icon » de config/bonuses.json.

const stroke = (body: string) =>
  `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${body}</svg>`;

const ICONS: Record<string, string> = {
  damage: stroke('<path d="M12 3 21 19H3Z"/><path d="M12 10.5 15 16H9Z" fill="currentColor"/>'),
  ammo: stroke('<rect x="4" y="8" width="4" height="12" rx="2"/><rect x="10" y="4" width="4" height="16" rx="2"/><rect x="16" y="8" width="4" height="12" rx="2"/>'),
  target: stroke('<circle cx="12" cy="12" r="7.5"/><circle cx="12" cy="12" r="2" fill="currentColor"/><path d="M12 1.5v4M12 18.5v4M1.5 12h4M18.5 12h4"/>'),
  shield: stroke('<path d="M12 2.5 20.5 7.25v9.5L12 21.5l-8.5-4.75v-9.5Z"/><path d="M12 8l4 2.25v4.5L12 17l-4-2.25v-4.5Z" fill="currentColor"/>'),
  helmet: stroke('<path d="M4 16a8 8 0 0 1 16 0"/><path d="M2.5 16h19"/><path d="M12 8v8"/>'),
  heart: stroke('<circle cx="12" cy="12" r="9"/><path d="M12 7.5v9M7.5 12h9"/>'),
  speed: stroke('<path d="M5 6l6 6-6 6M13 6l6 6-6 6"/>'),
  jump: stroke('<path d="M6 12l6-6 6 6M6 19l6-6 6 6"/>'),
  dash: stroke('<path d="M3 8h6M2 12h8M3 16h6"/><path d="M14 6l6 6-6 6"/>'),
  reload: stroke('<path d="M20 12a8 8 0 1 1-2.34-5.66"/><path d="M20 4v5h-5"/>'),
  scope: stroke('<circle cx="12" cy="12" r="6"/><path d="M12 2v6M12 16v6M2 12h6M16 12h6"/>'),
  recoil: stroke('<path d="M2.5 15l4-6 4 6 4-6 4 6 3-4"/>'),
  star: stroke('<path d="M12 2l2.6 7.4L22 12l-7.4 2.6L12 22l-2.6-7.4L2 12l7.4-2.6Z"/>'),
  check: stroke('<path d="M5 12.5l4.5 4.5L19 7.5"/>'),
  cross: stroke('<path d="M6 6l12 12M18 6L6 18"/>'),
  next: stroke('<path d="M5 12h13M13 6l6 6-6 6"/>'),
  play: stroke('<path d="M8 4.5 19.5 12 8 19.5Z" fill="currentColor"/>'),
  replay: stroke('<path d="M20 12a8 8 0 1 1-2.34-5.66"/><path d="M20 4v5h-5"/>'),
  clock: stroke('<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>'),
  back: stroke('<path d="M19 12H6M11 6l-6 6 6 6"/>'),
  eye: stroke('<path d="M2 12s3.6-6.5 10-6.5S22 12 22 12s-3.6 6.5-10 6.5S2 12 2 12Z"/><circle cx="12" cy="12" r="3"/>'),
  rotate: stroke('<path d="M3 12a9 4 0 1 0 9-4"/><path d="M9 5l3 3-3 3"/>'),
  hourglass: stroke('<path d="M6 3h12M6 21h12M7 3c0 5 10 5 10 9s-10 4-10 9M17 3c0 5-10 5-10 9s10 4 10 9"/>'),
  // interface (lot 7)
  'chevron-left': stroke('<path d="M15 5l-7 7 7 7"/>'),
  'chevron-right': stroke('<path d="M9 5l7 7-7 7"/>'),
  'chevron-down': stroke('<path d="M5 9l7 7 7-7"/>'),
  users: stroke('<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20a6.5 6.5 0 0 1 13 0"/><path d="M15.5 4.6a3.5 3.5 0 0 1 0 6.8M18 14a6.5 6.5 0 0 1 3.5 6"/>'),
  user: stroke('<circle cx="12" cy="8" r="4"/><path d="M4.5 21a7.5 7.5 0 0 1 15 0"/>'),
  copy: stroke('<rect x="8" y="8" width="12" height="12" rx="2.5"/><path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2"/>'),
  upload: stroke('<path d="M12 15V4M7 9l5-5 5 5"/><path d="M4 15v3a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-3"/>'),
  home: stroke('<path d="M3.5 11 12 4l8.5 7"/><path d="M6 9.5V20h12V9.5"/><path d="M10 20v-5h4v5"/>'),
  book: stroke('<path d="M5 4h9a3 3 0 0 1 3 3v13H8a3 3 0 0 1-3-3Z"/><path d="M5 17a3 3 0 0 1 3-3h9"/>'),
  gear: stroke('<circle cx="12" cy="12" r="3"/><path d="M12 2.5v3M12 18.5v3M2.5 12h3M18.5 12h3M5.3 5.3l2.1 2.1M16.6 16.6l2.1 2.1M5.3 18.7l2.1-2.1M16.6 7.4l2.1-2.1"/>'),
  lock: stroke('<rect x="5" y="10.5" width="14" height="10" rx="2.5"/><path d="M8 10.5V8a4 4 0 0 1 8 0v2.5"/>'),
  warning: stroke('<path d="M12 3.5 21.5 20h-19Z"/><path d="M12 10v4.5"/><path d="M12 17.2v.1"/>'),
  trophy: stroke('<path d="M7 4h10v5a5 5 0 0 1-10 0Z"/><path d="M7 6H4v1.5A3.5 3.5 0 0 0 7.5 11M17 6h3v1.5a3.5 3.5 0 0 1-3.5 3.5M12 14v4M8 20h8"/>'),
  map: stroke('<path d="M3 6.5 9 4l6 2.5L21 4v13.5L15 20l-6-2.5L3 20Z"/><path d="M9 4v13.5M15 6.5V20"/>'),
  coin: stroke('<circle cx="12" cy="12" r="9"/><path d="M12 6.5 15.5 12 12 17.5 8.5 12Z" fill="currentColor"/>'),
  grenade: stroke('<circle cx="12" cy="14.5" r="6.5"/><path d="M10 8.2V5h4v3.2"/><path d="M14 6h3.5l2 2.5"/><path d="M8.5 14.5h7M12 11v7" opacity=".6"/>'),
  bolt: stroke('<path d="M13 2.5 5 13.5h6l-1 8 8-11h-6Z"/>'),

};

/** Grand motif de fond d'une carte, par famille (viewBox 100 × 100, deux couches façon papier découpé). */
const FAMILY_MOTIFS: Record<string, string> = {
  attack: '<path d="M50 4 97 88H3Z" opacity=".5"/><path d="M50 34 76 80H24Z"/>',
  defense: '<path d="M50 3 92 27v46L50 97 8 73V27Z" opacity=".5"/><path d="M50 30 72 42.5v25L50 80 28 67.5v-25Z"/>',
  mobility: '<path d="M6 18h24l28 32-28 32H6l28-32Z" opacity=".5"/><path d="M44 18h24l28 32-28 32H44l28-32Z"/>',
  weapon:
    '<circle cx="50" cy="50" r="40" fill="none" stroke="currentColor" stroke-width="12" opacity=".5"/><circle cx="50" cy="50" r="14"/><path d="M50 2v20M50 78v20M2 50h20M78 50h20" stroke="currentColor" stroke-width="8" stroke-linecap="round"/>',
};

export function icon(id: string): string {
  return ICONS[id] ?? ICONS.star!;
}

export function familyMotif(familyId: string): string {
  const body = FAMILY_MOTIFS[familyId] ?? '<circle cx="50" cy="50" r="44" opacity=".5"/><circle cx="50" cy="50" r="22"/>';
  return `<svg viewBox="0 0 100 100" fill="currentColor" aria-hidden="true">${body}</svg>`;
}

// ---------- Armes ----------
// Silhouettes de profil, canon à droite, en deux tons : pièces principales pleines,
// pièces secondaires (crosse, poignée, garde-main) en ton clair. Format large 64 × 32.
// Un léger contour arrondi (même couleur) adoucit les angles, dans l'esprit géométrique de la DA.

const W_SOFT = 'opacity=".5"';

const WEAPONS: Record<string, string> = {
  pistol: [
    // culasse, guidon, hausse
    '<rect x="15" y="8" width="31" height="7" rx="2"/>',
    '<rect x="16" y="6.2" width="3" height="2.4" rx=".6"/><rect x="42" y="6.2" width="2.4" height="2.4" rx=".6"/>',
    `<rect x="46" y="9.2" width="3.2" height="4" rx="1" ${W_SOFT}/>`,
    // carcasse, poignée, pontet, détente
    '<rect x="17" y="15" width="22" height="3" rx="1"/>',
    `<path d="M18 17.5h9l-2 9a1.6 1.6 0 0 1-1.6 1.3h-5.2a1.4 1.4 0 0 1-1.4-1.7Z" ${W_SOFT}/>`,
    `<path d="M28 18v2.6a3 3 0 0 0 3 3h3.4a1.8 1.8 0 0 0 1.8-1.8V18" fill="none" stroke="currentColor" stroke-width="1.6" ${W_SOFT}/>`,
    '<path d="M30.4 18v2.8l1.6 1" fill="none" stroke="currentColor" stroke-width="1.4"/>',
  ].join(''),
  assault_rifle: [
    // crosse et poignée
    `<path d="M19 11.5 6.2 12a1.8 1.8 0 0 0-1.7 1.8l.4 6.3a1.6 1.6 0 0 0 1.6 1.5h2.7L19 17.5Z" ${W_SOFT}/>`,
    `<path d="M22.5 17.5h5l-1.6 7.4a1.3 1.3 0 0 1-1.3 1h-3.2a1 1 0 0 1-1-1.2Z" ${W_SOFT}/>`,
    // boîtier, rail, chargeur courbe
    '<rect x="18" y="11" width="22" height="7" rx="1.6"/>',
    '<rect x="21" y="8.4" width="15" height="2" rx="1"/><rect x="21" y="7" width="2.4" height="2" rx=".5"/>',
    '<path d="M30.5 18h6l2.4 8.6a1.3 1.3 0 0 1-1.3 1.6h-3.3a1.6 1.6 0 0 1-1.5-1.1Z"/>',
    // garde-main, canon, cache-flamme, guidon
    `<rect x="40" y="11.4" width="11" height="6" rx="1.6" ${W_SOFT}/>`,
    '<rect x="51" y="13" width="6" height="2.4" rx="1"/><rect x="56.4" y="12" width="4" height="4.4" rx="1.1"/>',
    '<rect x="48" y="8.6" width="2" height="3" rx=".5"/>',
  ].join(''),
  shotgun: [
    // crosse
    `<path d="M18.5 11 5.4 13a1.8 1.8 0 0 0-1.5 1.8v5.4a1.6 1.6 0 0 0 1.9 1.6L18.5 17Z" ${W_SOFT}/>`,
    // boîtier, poignée
    '<rect x="18" y="10" width="11" height="7.4" rx="1.6"/>',
    '<path d="M19.5 16.8h5l-2.2 6.2a1.3 1.3 0 0 1-1.2.9h-2.6a1 1 0 0 1-1-1.3Z"/>',
    `<path d="M24.6 17.4v1.8a2.6 2.6 0 0 0 2.6 2.6h1.4" fill="none" stroke="currentColor" stroke-width="1.5" ${W_SOFT}/>`,
    // canon et réservoir tubulaire
    '<rect x="29" y="10.2" width="31" height="3" rx="1.2"/>',
    `<rect x="29" y="14" width="26" height="2.6" rx="1.2" ${W_SOFT}/>`,
    // pompe striée
    '<path d="M36 13.2h12.6a1.6 1.6 0 0 1 1.6 1.6v2.4a1.6 1.6 0 0 1-1.6 1.6H36a1.6 1.6 0 0 1-1.6-1.6v-2.4a1.6 1.6 0 0 1 1.6-1.6Zm2.4 1.4v3.2h1.2v-3.2Zm3 0v3.2h1.2v-3.2Zm3 0v3.2h1.2v-3.2Z" fill-rule="evenodd"/>',
    '<rect x="57.6" y="8.8" width="1.8" height="1.8" rx=".5"/>',
  ].join(''),
  sniper: [
    // crosse à trou de pouce
    `<path d="M17 13.2 4.2 13.8a1.8 1.8 0 0 0-1.7 1.8v5.6a1.6 1.6 0 0 0 1.6 1.6h4.8l3.8-3.6H17Zm-9 3.2h3.6l-2 2.2H8Z" fill-rule="evenodd" ${W_SOFT}/>`,
    // boîtier, poignée, levier de culasse
    '<rect x="16" y="13" width="22" height="5" rx="1.5"/>',
    '<path d="M21.5 17.6h4.6l-1.5 6.5a1.2 1.2 0 0 1-1.2.9h-2.6a1 1 0 0 1-1-1.2Z"/>',
    '<circle cx="29.5" cy="19.6" r="1.4"/><rect x="28.8" y="17.4" width="1.4" height="2.4" rx=".5"/>',
    // lunette et montages
    '<rect x="18.5" y="7.4" width="17" height="3.4" rx="1.7"/>',
    '<rect x="15.6" y="6.4" width="4.4" height="5.4" rx="1.4"/><rect x="33.6" y="5.6" width="6" height="7" rx="1.6"/>',
    `<rect x="22" y="10.4" width="2" height="2.8" ${W_SOFT}/><rect x="30" y="10.4" width="2" height="2.8" ${W_SOFT}/>`,
    // canon, frein de bouche, bipied
    '<rect x="38" y="14" width="20" height="2.2" rx="1"/><rect x="57.4" y="13" width="4.4" height="4.2" rx="1"/>',
    `<path d="M43 16.6 39.6 25.6M45 16.6l3.4 9" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" ${W_SOFT}/>`,
  ].join(''),
  bubble_launcher: [
    `<path d="M16 12 6 13a1.8 1.8 0 0 0-1.6 1.8v4a1.6 1.6 0 0 0 1.8 1.6L16 19Z" ${W_SOFT}/>`,
    '<rect x="15" y="10" width="26" height="11" rx="5.5"/>',
    '<path d="M20.5 20.6h5l-1.6 6a1.3 1.3 0 0 1-1.3 1h-2.6a1 1 0 0 1-1-1.2Z"/>',
    '<rect x="41" y="11.8" width="9" height="7.4" rx="2"/><rect x="49" y="10.2" width="4" height="10.6" rx="1.6"/>',
    `<circle cx="27" cy="6.6" r="3.2" ${W_SOFT}/><circle cx="57" cy="9" r="2.6" ${W_SOFT}/><circle cx="60" cy="17" r="1.8" ${W_SOFT}/>`,
  ].join(''),
  beam: [
    `<path d="M17 12.4 6.4 13.4a1.8 1.8 0 0 0-1.6 1.8v4.2a1.6 1.6 0 0 0 1.8 1.6L17 19.4Z" ${W_SOFT}/>`,
    '<rect x="16" y="10.6" width="22" height="9.6" rx="3"/>',
    '<path d="M21.5 19.8h4.8l-1.6 6.6a1.3 1.3 0 0 1-1.3 1h-2.6a1 1 0 0 1-1-1.2Z"/>',
    `<rect x="24" y="7.4" width="10" height="3.4" rx="1.7" ${W_SOFT}/>`,
    '<rect x="38" y="12.6" width="12" height="5.6" rx="1.4"/>',
    `<rect x="40.5" y="10.8" width="1.8" height="9.2" rx=".9" ${W_SOFT}/><rect x="44.5" y="10.8" width="1.8" height="9.2" rx=".9" ${W_SOFT}/>`,
    '<path d="M50 13.4 56 11v8.8l-6-2.4Z"/><circle cx="59.4" cy="15.4" r="2"/>',
  ].join(''),
  crossbow: [
    `<path d="M22 13 7 14.2a1.8 1.8 0 0 0-1.6 1.8v3.6a1.6 1.6 0 0 0 1.8 1.6L22 19Z" ${W_SOFT}/>`,
    '<rect x="20" y="13.2" width="28" height="4.4" rx="1.6"/>',
    '<path d="M25 17.2h4.6l-1.5 6.6a1.2 1.2 0 0 1-1.2.9h-2.6a1 1 0 0 1-1-1.2Z"/>',
    // arc et corde
    '<path d="M47 4.6c3.6 2.4 5.6 6.4 5.6 10.8s-2 8.4-5.6 10.8" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"/>',
    `<path d="M47 4.6 34 15.4 47 26.2" fill="none" stroke="currentColor" stroke-width="1" ${W_SOFT}/>`,
    // carreau
    '<rect x="32" y="11.8" width="24" height="1.6" rx=".8"/><path d="M55 10.2 60 12.6 55 15Z"/>',
  ].join(''),
};

/** Silhouette d'une arme (format large). Une arme inconnue reçoit une silhouette générique. */
export function weaponIcon(weaponId: string): string {
  const body =
    WEAPONS[weaponId] ??
    '<rect x="16" y="11" width="30" height="7" rx="2"/><rect x="46" y="12.6" width="10" height="3" rx="1"/><path d="M19 17.5h5l-1.6 7a1.2 1.2 0 0 1-1.2 1h-2.4a1 1 0 0 1-1-1.2Z" opacity=".5"/>';
  return `<svg class="wicon" viewBox="0 0 64 32" fill="currentColor" stroke="currentColor" stroke-width=".6" stroke-linejoin="round" aria-hidden="true">${body}</svg>`;
}
