// Carte « Mine de cristal » (souterrain) : une grande caverne sous un plafond de roche.
// Deux galeries à 3 m (nord et sud) reliées par des passerelles à un piton central couvert de cristaux,
// rails et wagonnets au sol, étais de bois, cristaux et champignons lumineux. Symétrique par rotation de 180°.
import { hash, MapBuilder, pick, smoothNoise, type Paint } from './mapDsl.ts';
import { crate, rock } from './props.ts';

const PLAY = 40;
const H = PLAY / 2;
const CEILING = 10;
const SHELF = 3;

const C = {
  rock: ['#dcd3df', '#d4cad8', '#e2dae4', '#cdc3d1'],
  rockWarm: ['#e9d6cb', '#e3cec2'],
  rockDark: ['#c6bccb', '#bfb4c4'],
  floor: ['#e6ddd4', '#e0d6cc', '#ebe3db', '#dcd1c7'],
  gravel: ['#d2c7bd', '#cbbfb4'],
  wood: ['#dbbb98', '#d4b28d', '#e0c3a3'],
  woodDark: '#b8936f',
  rail: '#b7b1c2',
  sleeper: '#c9a789',
  cart: ['#c9c3d3', '#bfb8cb'],
  cartRim: '#a9a2b7',
  ore: ['#f3d68f', '#f7e2a9'],
  moss: ['#c6e3bf', '#bcdcb4'],
};

// couleurs lumineuses : cristaux, lanternes, champignons
const GLOW = {
  cyan: ['#aeeaf2', '#c8f3f8', '#e6fbfd'],
  pink: ['#f6b6d6', '#f9cfe4', '#fde8f2'],
  lilac: ['#c9b5f5', '#dccdf9', '#efe8fd'],
  mint: ['#b2edd1', '#cdf5e2', '#e8fcf2'],
  lantern: '#fff0bf',
  mushroom: '#ffd3a8',
};

export function buildMine(): MapBuilder {
  const m = new MapBuilder({ play: [PLAY, PLAY], extent: [52, 52], height: CEILING + 2 });
  for (const list of Object.values(GLOW)) for (const hex of Array.isArray(list) ? list : [list]) m.light(hex);

  const rockPaint: Paint = ({ ix, iy, iz }) => {
    const band = Math.floor((iy + smoothNoise(ix, iz, 12, 5) * 6) / 5) % 5;
    const n = hash(ix, iy, iz, 1);
    if (band === 2) return pick(C.rockWarm, n);
    if (n < 0.04) return pick(C.ore, hash(iz, ix, iy));
    return pick(C.rock, hash(ix >> 1, iy >> 1, iz >> 1, 2) * 0.6 + n * 0.39);
  };

  // ---------- sol, murs de la caverne, plafond ----------
  m.vfill(0, 0, 0, m.model.sx, 1, m.model.sz, ({ ix, iz }) => {
    const n = hash(ix, 0, iz, 3);
    return smoothNoise(ix, iz, 10, 4) > 0.62 ? pick(C.gravel, n) : pick(C.floor, hash(ix >> 1, 0, iz >> 1, 5) * 0.5 + n * 0.49);
  });
  // murs : la roche commence un peu au-delà du bord de la zone de jeu, bord irrégulier
  for (let iz = 0; iz < m.model.sz; iz++)
    for (let ix = 0; ix < m.model.sx; ix++) {
      const x = m.mx(ix);
      const z = m.mz(iz);
      const edge = Math.max(Math.abs(x), Math.abs(z));
      const wobble = smoothNoise(x, z, 3, 6) * 1.6 + smoothNoise(x, z, 1.2, 7) * 0.5;
      // la paroi s'évase en bas (éboulis) et surplombe en haut
      for (let iy = 1; iy < m.vy(CEILING); iy++) {
        const y = m.my(iy);
        const lean = y < 1 ? (1 - y) * 0.8 : y > CEILING - 3 ? (y - (CEILING - 3)) * 0.7 : 0;
        if (edge > H + 0.1 + wobble - lean) m.vfill(ix, iy, iz, ix + 1, iy + 1, iz + 1, rockPaint);
      }
    }
  // plafond : dalle de roche, bosselée par-dessous
  for (let iz = 0; iz < m.model.sz; iz++)
    for (let ix = 0; ix < m.model.sx; ix++) {
      const dip = Math.floor(smoothNoise(ix, iz, 14, 8) * 4 + smoothNoise(ix, iz, 5, 9) * 3);
      m.vfill(ix, m.vy(CEILING) - dip, iz, ix + 1, m.model.sy, iz + 1, rockPaint);
    }
  m.collide(-H, CEILING, -H, H, CEILING + 1, H);

  // ---------- moitié nord (z < 0), recopiée ensuite ----------

  // galerie nord à 3 m : roche pleine, bord de façade irrégulier (décor) et poutre de rive
  m.solid(-14, 0, -H, 14, SHELF, -14, rockPaint);
  for (let ix = m.vx(-14); ix < m.vx(14); ix++) {
    const bulge = Math.floor(hash(ix >> 2, 0, 0, 11) * 2);
    for (let k = 0; k < bulge; k++) m.vfill(ix, m.vy(0), m.vz(-14) + k, ix + 1, m.vy(SHELF) - 2, m.vz(-14) + k + 1, rockPaint);
  }
  m.fill(-14, SHELF - 0.25, -14.25, 14, SHELF, -14, C.woodDark);
  // planches au sol de la galerie
  m.fill(-14, SHELF - 0.25, -20, 14, SHELF, -14.25, ({ ix, iz }) => (iz % 3 === 0 ? C.woodDark : pick(C.wood, hash(ix >> 2, 0, iz, 12))));
  // garde-corps de la galerie (sautables), ouverts aux escaliers et à la passerelle
  for (const [x0, x1] of [[-14, -11.5], [-9, -1.25], [1.25, 8.5], [12.5, 14]] as const) {
    m.solid(x0, SHELF, -14.25, x1, SHELF + 1, -14, ({ ix, ly, h }) => (ly === h - 1 || ix % 8 === 0 ? C.woodDark : null));
  }

  // escalier de bois à l'est (6 marches de 0,5 m, 1 m de profondeur)
  m.stairs(10.5, -8, 'n', 2, 6, ({ ix, iz, lx, w }) => (lx === 0 || lx === w - 1 ? C.woodDark : iz % 4 === 0 ? C.woodDark : pick(C.wood, hash(ix, 0, iz, 13))), 0.5, 1);
  // éboulis en marches à l'ouest
  m.stairs(-10.25, -8.5, 'n', 2.5, 6, rockPaint, 0.5, 0.9);

  // piton central à 3 m, passerelle de planches vers la galerie nord
  m.solid(-2.5, 0, -2.5, 2.5, SHELF, 2.5, rockPaint);
  m.solid(-1.25, SHELF - 0.25, -14, 1.25, SHELF, -2.5, ({ ix, iz }) => (iz % 4 === 0 ? C.woodDark : pick(C.wood, hash(ix, 1, iz, 14))));
  for (const x of [-1.25, 1.0]) m.solid(x, SHELF, -13.5, x + 0.25, SHELF + 1, -3, ({ iz, ly, h }) => (ly === h - 1 || iz % 6 === 0 ? C.woodDark : null));
  // étais sous la passerelle
  for (const z of [-10, -6]) for (const x of [-1.25, 1.0]) m.fill(x, 0, z, x + 0.25, SHELF - 0.25, z + 0.25, C.woodDark);

  // cristaux sur le piton (couverture au centre) : amas lumineux
  const crystal = (x: number, z: number, base: number, colors: readonly string[], size: number, seed: number, collide = true) => {
    const spikes = 5;
    for (let k = 0; k < spikes; k++) {
      const a = (k / spikes) * Math.PI * 2 + hash(k, 0, 0, seed) * 0.8;
      const r = k === 0 ? 0 : size * 0.35;
      const cx = x + Math.cos(a) * r;
      const cz = z + Math.sin(a) * r;
      const tall = size * (k === 0 ? 1.6 : 0.8 + hash(k, 1, 0, seed) * 0.6);
      const lean = (hash(k, 2, 0, seed) - 0.5) * 0.6;
      for (let y = 0; y < tall; y += 0.25) {
        const t = y / tall;
        const w = size * 0.28 * (1 - t * 0.8);
        const ox = cx + lean * y * 0.4;
        m.fill(ox - w, base + y, cz - w, ox + w, base + y + 0.25, cz + w, ({ ix, iy, iz }) => pick(colors, t > 0.7 ? 0.99 : hash(ix, iy, iz, seed) * 0.7));
      }
    }
    if (collide) m.collide(x - size * 0.45, base, z - size * 0.45, x + size * 0.45, base + size * 1.4, z + size * 0.45);
  };
  crystal(0, -1, SHELF, GLOW.lilac, 1.4, 21);

  // cristaux au sol et aux parois
  crystal(-12, -4, 0, GLOW.cyan, 1.1, 22);
  crystal(15, -9, 0, GLOW.pink, 1.0, 23);
  crystal(-6, -11, 0, GLOW.mint, 0.8, 24);
  crystal(7, -18.5, SHELF, GLOW.cyan, 0.9, 25);
  crystal(-18.5, -12, 0, GLOW.lilac, 1.2, 26, false);
  crystal(19, -11.5, 0, GLOW.mint, 1.0, 27, false);

  // rails (est-ouest, z = −6) et wagonnets
  for (let ix = m.vx(-H - 4); ix < m.vx(H + 4); ix++) {
    if (ix % 3 === 0) m.vfill(ix, m.vy(0) - 1, m.vz(-6.75), ix + 1, m.vy(0), m.vz(-5.25), C.sleeper);
    for (const z of [-6.5, -5.5]) m.vfill(ix, m.vy(0), m.vz(z), ix + 1, m.vy(0.25), m.vz(z) + 1, C.rail);
  }
  const cart = (x: number, z: number, full: boolean) => {
    m.solid(x - 1.25, 0, z - 0.75, x + 1.25, 1.25, z + 0.75, ({ ix, iy, iz, lx, ly, lz, w, h, d }) => {
      const rim = ly === h - 1 || lx === 0 || lx === w - 1 || lz === 0 || lz === d - 1;
      if (ly === 0) return lx % 4 === 1 ? '#8e8999' : null;
      if (!rim && ly > 1) return ly >= h - 2 && full ? pick(C.ore, hash(ix, iy, iz, 31)) : null;
      return rim && (ly === h - 1 || lx % 5 === 0) ? C.cartRim : pick(C.cart, hash(ix, iy, iz, 32));
    });
  };
  cart(-7, -6, true);
  cart(13, -6, false);

  // étais de bois le long de la paroi et au-dessus des rails
  const frame = (x: number, z: number, alongX: boolean, span: number) => {
    const [dx, dz] = alongX ? [span / 2, 0] : [0, span / 2];
    for (const s of [-1, 1]) m.solid(x + s * dx - 0.2, 0, z + s * dz - 0.2, x + s * dx + 0.2, 3.5, z + s * dz + 0.2, ({ iy }) => (iy % 6 === 0 ? C.woodDark : C.wood[0]!));
    m.fill(x - dx - 0.3, 3.5, z - dz - 0.3, x + dx + 0.3, 3.9, z + dz + 0.3, C.woodDark);
    // lanterne suspendue
    m.fill(x - 0.03, 3.25, z - 0.03, x + 0.03, 3.5, z + 0.03, C.rail);
    m.fill(x - 0.2, 2.75, z - 0.2, x + 0.2, 3.25, z + 0.2, GLOW.lantern);
  };
  frame(-15, -6, false, 3.5);
  frame(4, -6, false, 3.5);

  // sur la galerie : caisses, minerai, lanternes, entrée de tunnel condamnée
  m.breakable('wood', () => {
    for (const [x, z, base] of [[-9, -18, SHELF], [-8, -18, SHELF], [-8.5, -18, SHELF + 1], [11, -19, SHELF]] as const) crate(m, x, z, 1, C.wood, C.woodDark, base);
  });
  m.fill(-3, SHELF, -H - 1, 3, SHELF + 3.5, -H + 0.25, ({ ix, iy }) => (ix % 4 === 0 || iy % 7 === 0 ? C.woodDark : pick(C.wood, hash(ix, iy, 0, 41))));
  m.fill(-3.5, SHELF + 3.5, -H - 1, 3.5, SHELF + 4, -H + 0.5, C.woodDark);
  for (const x of [-3.25, 3.25]) m.fill(x - 0.25, SHELF, -H - 1, x + 0.25, SHELF + 3.5, -H + 0.5, C.woodDark);
  for (const x of [-4.5, 4.5]) m.fill(x - 0.2, SHELF + 2.25, -H - 0.25, x + 0.2, SHELF + 2.75, -H + 0.15, GLOW.lantern);

  // stalagmites (couverture basse) et champignons lumineux
  for (const [x, z, hgt] of [[-3, -8, 1.5], [9, -12, 1.2], [-17, -2, 1.8], [17, -15, 1.4]] as const) {
    for (let y = 0; y < hgt; y += 0.25) {
      const w = 0.55 * (1 - y / hgt) + 0.12;
      m.fill(x - w, y, z - w, x + w, y + 0.25, z + w, rockPaint);
    }
    m.collide(x - 0.4, 0, z - 0.4, x + 0.4, hgt, z + 0.4);
  }
  for (const [x, z] of [[-15, -9], [-4, -13.25], [12, -11], [18, -18], [-18, -18]] as const) {
    for (let k = 0; k < 4; k++) {
      const ox = x + (hash(k, 0, 0, 50 + x) - 0.5) * 1.2;
      const oz = z + (hash(k, 1, 0, 50 + z) - 0.5) * 1.2;
      const h = 0.25 + hash(k, 2, 0, 50) * 0.25;
      m.fill(ox - 0.06, 0, oz - 0.06, ox + 0.06, h, oz + 0.06, '#f6efe6');
      m.fill(ox - 0.25, h, oz - 0.25, ox + 0.25, h + 0.25, oz + 0.25, GLOW.mushroom);
    }
  }
  // rochers éboulés
  rock(m, -16.5, -10.5, 1.3, 1.0, 1.1, C.rock, C.moss, 61);
  rock(m, 6, -11, 1.0, 0.8, 1.2, C.rock, null, 62);

  // cristaux enchâssés dans les parois (décor), tout autour de la moitié nord
  const palettes = [GLOW.cyan, GLOW.pink, GLOW.lilac, GLOW.mint];
  for (let k = 0; k < 16; k++) {
    const t = hash(k, 0, 0, 80);
    // position le long du bord : côté nord, puis côtés est et ouest (z < 0)
    const side = k % 3;
    const along = (t - 0.5) * 2 * (H - 2);
    const x = side === 0 ? along : side === 1 ? H + 0.6 : -H - 0.6;
    const z = side === 0 ? -H - 0.6 : -Math.abs(along) * 0.95 - 1;
    const y = hash(k, 1, 0, 80) < 0.5 ? 0 : 1 + hash(k, 2, 0, 80) * 5;
    if (side === 0 && Math.abs(x) < 4.5 && y >= SHELF) continue; // pas devant le tunnel
    crystal(x, z, y, palettes[k % palettes.length]!, 0.7 + hash(k, 3, 0, 80) * 0.6, 90 + k, false);
  }

  // stalactites au plafond (décor)
  for (let k = 0; k < 70; k++) {
    const x = (hash(k, 0, 0, 70) - 0.5) * 50;
    const z = -hash(k, 1, 0, 70) * 25;
    const len = 0.75 + hash(k, 2, 0, 70) * 2;
    for (let y = 0; y < len; y += 0.25) {
      const w = 0.4 * (1 - y / len) + 0.06;
      m.fill(x - w, CEILING - y - 0.25, z - w, x + w, CEILING - y + 1, z + w, k % 9 === 0 && y > len - 0.6 ? GLOW.cyan[1]! : rockPaint);
    }
  }

  m.mirrorHalf((_x, z) => z < 0);

  // apparitions : coins du sol, galeries, côtés
  m.spawn(-17.5, -17, -135).spawn(17.5, 17, 45);
  m.spawn(17.5, -17.5, 135).spawn(-17.5, 17.5, -45);
  m.spawn(-6, -17, 180).spawn(6, 17, 0);
  m.spawn(-18, 3, -90).spawn(18, -3, 90);
  // coffres à grenades : deux paires symétriques autour du piton
  m.chest(-1, -10).chest(1, 10).chest(-10, -1).chest(10, 1);
  return m;
}
