// Carte « Vallon » (nature) : une rivière serpente au milieu d'un vallon en terrasses ; deux ponts de bois,
// des ruines de pierre sur les collines (points hauts), des arbres et des rochers pour se couvrir,
// des falaises boisées et une cascade tout autour. Symétrique par rotation de 180°.
import { hash, MapBuilder, pick, smoothNoise, type Paint } from './mapDsl.ts';
import { rock, scatterFlowers, tree } from './props.ts';

const PLAY = 44;
const H = PLAY / 2;
const STEP = 0.5;

const C = {
  grass: ['#c4e3b4', '#bbdeaa', '#cbe8bc', '#b3d8a3'],
  grassDark: ['#a9d19a', '#a2cb92'],
  dirt: ['#e3cdb2', '#dcc4a7', '#e8d4bc'],
  dirtDeep: ['#d6bc9f', '#cfb497'],
  sand: ['#f1e4c8', '#ecdcbd'],
  riverbed: ['#d9d0c2', '#cfc6b8', '#e2dacd'],
  water: ['#b4dcee', '#a8d5ea', '#bfe2f1', '#aed8ec'],
  foam: '#f2fafc',
  stone: ['#ddd8d0', '#d4cec5', '#e5e0d9', '#cbc5bc'],
  moss: ['#b7d8a4', '#a9cf95'],
  wood: ['#dbbb98', '#d4b28d', '#e0c3a3'],
  woodDark: '#b8936f',
  trunk: ['#c4a083', '#b99578', '#cfae92'],
  leaves: ['#a8d39a', '#b6dca7', '#9fcc91', '#c3e3b5', '#93c486'],
  pine: ['#9ccaa4', '#8fc19a', '#a7d3ae', '#86b892'],
  blossom: ['#f6c5d5', '#f9d4e0', '#efb7ca', '#fbe2ea'],
  autumn: ['#f7d19c', '#f4c389', '#f9dcae', '#efb97e'],
  flowers: ['#f4a6b8', '#f7d27e', '#c9b3f0', '#fdfbf4', '#a9cdf2'],
  mushroomCap: '#f2a4a0',
  mushroomDot: '#fff8ef',
  lantern: '#fff0bf',
};

/** Axe de la rivière (x en fonction de z) : symétrique par rotation de 180°. */
const riverX = (z: number) => 3 * Math.sin(z / 7);

/** Hauteur du terrain (m, par pas de 0,5) en un point de la zone de jeu. */
function playHeight(x: number, z: number): number {
  const dr = Math.abs(x - riverX(z));
  if (dr < 2.5) return 0; // lit de la rivière
  if (dr < 3.5) return 0.5; // berge
  // plateau de base, collines au nord-est et au sud-ouest (symétriques)
  let h = 1 + Math.min(1, (dr - 3.5) / 6) * 0.5;
  const hill = (cx: number, cz: number, r: number, top: number) => Math.max(0, 1 - Math.hypot(x - cx, z - cz) / r) * top;
  h += hill(13, -12, 10, 3.6) + hill(-13, 12, 10, 3.6);
  // petites bosses
  h += (smoothNoise(x, z, 6, 3) + smoothNoise(-x, -z, 6, 3) - 1) * 0.6;
  // les bords montent vers les falaises
  const edge = Math.max(Math.abs(x), Math.abs(z));
  if (edge > H - 4) h += (edge - (H - 4)) * 0.35;
  return Math.max(0.5, Math.round(h / STEP) * STEP);
}

/** Hauteur du décor hors zone de jeu : falaises qui ferment le vallon, coupées par la rivière. */
function outerHeight(x: number, z: number): number {
  const edge = Math.max(Math.abs(x), Math.abs(z));
  const dr = Math.abs(x - riverX(z));
  const base = 4 + (edge - H) * 0.9 + smoothNoise(x, z, 4, 9) * 3;
  // la rivière sort au nord et au sud par une gorge
  if (Math.abs(z) > H && dr < 3) return Math.abs(z) > H + 3 ? Math.round(base * 0.9 / STEP) * STEP : 0;
  return Math.max(2, Math.round(base / STEP) * STEP);
}

export function buildForest(): MapBuilder {
  const m = new MapBuilder({ play: [PLAY, PLAY], extent: [60, 60], height: 20 });
  m.light(C.lantern);

  // ---------- terrain ----------
  const inPlay = (x: number, z: number) => Math.abs(x) < H && Math.abs(z) < H;
  const heightAt = (x: number, z: number) => (inPlay(x, z) ? playHeight(x, z) : outerHeight(x, z));
  const { sx, sz } = m.model;
  const heights = new Float32Array(sx * sz);
  for (let iz = 0; iz < sz; iz++) for (let ix = 0; ix < sx; ix++) heights[ix + sx * iz] = heightAt(m.mx(ix), m.mz(iz));
  const hAt = (ix: number, iz: number) => heights[Math.max(0, Math.min(sx - 1, ix)) + sx * Math.max(0, Math.min(sz - 1, iz))]!;

  for (let iz = 0; iz < sz; iz++)
    for (let ix = 0; ix < sx; ix++) {
      const top = m.vy(hAt(ix, iz));
      // une marche se voit : on éclaircit le bord des terrasses
      const lowerNeighbour = Math.min(hAt(ix + 1, iz), hAt(ix - 1, iz), hAt(ix, iz + 1), hAt(ix, iz - 1)) < hAt(ix, iz);
      const x = m.mx(ix);
      const z = m.mz(iz);
      const dr = Math.abs(x - riverX(z));
      for (let iy = 0; iy < top; iy++) {
        const depth = top - 1 - iy;
        const n = hash(ix, iy, iz, 21);
        let c: string;
        if (hAt(ix, iz) === 0) c = pick(C.riverbed, n);
        else if (depth === 0) c = dr < 4 ? pick(C.sand, n) : lowerNeighbour && n < 0.5 ? pick(C.grassDark, n * 2) : pick(C.grass, hash(ix >> 1, 0, iz >> 1, 22) * 0.5 + n * 0.49);
        else if (depth === 1 && dr >= 4) c = n < 0.4 ? pick(C.grassDark, n) : pick(C.dirt, n);
        else if (depth < 6) c = pick(C.dirt, n);
        else c = (iy >> 1) % 3 === 0 ? pick(C.dirtDeep, n) : pick(C.stone, n);
        m.vox(ix, iy, iz, c);
      }
    }

  // collisions du terrain : cellules de 1 m fusionnées en rectangles de même hauteur
  const cells = PLAY;
  const grid: number[][] = [];
  for (let j = 0; j < cells; j++) {
    grid.push([]);
    for (let i = 0; i < cells; i++) {
      // hauteur au centre de la cellule = celle des voxels qui la couvrent (pas de 1 m, voxels de 25 cm : on prend le max)
      let hmax = 0;
      for (let a = 0; a < 4; a++) for (let b = 0; b < 4; b++) hmax = Math.max(hmax, hAt(m.vx(-H + i) + a, m.vz(-H + j) + b));
      grid[j]!.push(hmax);
    }
  }
  // rectangles gloutons
  const used = grid.map((r) => r.map(() => false));
  for (let j = 0; j < cells; j++)
    for (let i = 0; i < cells; i++) {
      if (used[j]![i] || grid[j]![i] === 0) continue;
      const hv = grid[j]![i]!;
      let w = 1;
      while (i + w < cells && !used[j]![i + w] && grid[j]![i + w] === hv) w++;
      let d = 1;
      grow: while (j + d < cells) {
        for (let k = 0; k < w; k++) if (used[j + d]![i + k] || grid[j + d]![i + k] !== hv) break grow;
        d++;
      }
      for (let b = 0; b < d; b++) for (let a = 0; a < w; a++) used[j + b]![i + a] = true;
      m.collide(-H + i, 0, -H + j, -H + i + w, hv, -H + j + d);
    }
  // le voxel au bord d'une cellule peut être plus bas que la cellule : on remonte le décor au niveau de la collision
  for (let j = 0; j < cells; j++)
    for (let i = 0; i < cells; i++) {
      const hv = grid[j]![i]!;
      for (let a = 0; a < 4; a++)
        for (let b = 0; b < 4; b++) {
          const ix = m.vx(-H + i) + a;
          const iz = m.vz(-H + j) + b;
          const top = hAt(ix, iz);
          if (top >= hv) continue;
          const topColor = m.colorAt(ix, m.vy(top) - 1, iz) ?? pick(C.grass, 0);
          for (let iy = m.vy(top) - 1; iy < m.vy(hv); iy++) m.vox(ix, iy, iz, iy === m.vy(hv) - 1 ? topColor : pick(C.dirt, hash(ix, iy, iz)));
          heights[ix + sx * iz] = hv;
        }
    }

  // ---------- rivière et cascades ----------
  const waterPaint: Paint = ({ ix, iy, iz }) => (hash(ix, iy, iz, 31) < 0.06 ? C.foam : pick(C.water, hash(ix >> 1, 0, iz >> 1, 32) * 0.7 + hash(ix, iy, iz, 33) * 0.29));
  for (let iz = 0; iz < sz; iz++)
    for (let ix = 0; ix < sx; ix++) {
      if (hAt(ix, iz) !== 0) continue;
      m.vfill(ix, m.vy(0), iz, ix + 1, m.vy(0.5), iz + 1, waterPaint);
    }
  // cascade : rideau d'eau qui tombe de la falaise nord, écume en bas
  for (const sign of [-1, 1]) {
    const zc = sign * (H + 3);
    const xc = riverX(zc);
    const top = outerHeight(xc, zc + sign * 1.5);
    m.fill(xc - 2.5, 0.5, zc - 0.5, xc + 2.5, top, zc + 0.5, ({ ix, iy, iz }) => (hash(ix, iy >> 1, iz, 34) < 0.25 ? C.foam : pick(C.water, hash(ix, iy, iz, 35))));
    m.fill(xc - 3, 0.5, zc - sign * 1.5 - 0.75, xc + 3, 0.75, zc - sign * 1.5 + 0.75, ({ ix, iz }) => (hash(ix, 0, iz, 36) < 0.6 ? C.foam : pick(C.water, 0.2)));
  }

  // ---------- moitié nord (z < 0), recopiée ensuite ----------

  // pont de bois en dos d'âne au-dessus de la rivière (z = −8)
  {
    const z = -8;
    const xr = riverX(z);
    const deck = 2.5;
    const plank: Paint = ({ ix, iy, iz }) => (ix % 3 === 0 ? C.woodDark : pick(C.wood, hash(ix, iy, iz, 41)));
    // tablier au-dessus de l'eau, escaliers de chaque côté (marches de 0,5 m)
    m.solid(xr - 3.5, deck - 0.25, z - 1.25, xr + 3.5, deck, z + 1.25, plank);
    const bankL = playHeight(xr - 6, z);
    const bankR = playHeight(xr + 6, z);
    for (let k = 1; deck - k * 0.5 > bankL; k++) m.solid(xr - 3.5 - k * 0.5, 0, z - 1.25, xr - 3.5 - (k - 1) * 0.5, deck - k * 0.5, z + 1.25, plank);
    for (let k = 1; deck - k * 0.5 > bankR; k++) m.solid(xr + 3.5 + (k - 1) * 0.5, 0, z - 1.25, xr + 3.5 + k * 0.5, deck - k * 0.5, z + 1.25, plank);
    // garde-corps : poteaux et lisses (on peut les sauter)
    for (const zz of [z - 1.25, z + 1.0]) {
      m.solid(xr - 3.5, deck, zz, xr + 3.5, deck + 1, zz + 0.25, ({ ix, ly, h }) => (ly === h - 1 || ix % 6 === 0 ? C.woodDark : null));
    }
    // piliers dans l'eau
    for (const dx of [-2.25, 2.25]) m.fill(xr + dx - 0.25, 0, z - 1.25, xr + dx + 0.25, deck - 0.25, z + 1.25, ({ iy }) => (iy % 4 === 0 ? C.woodDark : C.wood[1]!));
    // lanternes aux quatre coins
    for (const dx of [-3.5, 3.5]) for (const zz of [z - 1.25, z + 1.0]) m.fill(xr + dx - 0.125, deck + 1, zz, xr + dx + 0.125, deck + 1.25, zz + 0.25, C.lantern);
  }

  // ruines sur la colline nord-est : tour éboulée, murs percés d'arches, estrade
  {
    const cx = 13;
    const cz = -13;
    const base = playHeight(cx, cz);
    const stone: Paint = ({ ix, iy, iz }) => {
      const above = m.get(ix, iy + 1, iz);
      if (above === 0 && hash(ix, iy, iz, 51) < 0.55) return pick(C.moss, hash(iz, ix, iy, 52));
      return (iy + ((ix + iz) >> 1)) % 4 === 0 ? C.stone[3]! : pick(C.stone, hash(ix >> 1, iy, iz >> 1, 53));
    };
    // estrade (1 m) avec deux marches au sud et à l'ouest
    m.solid(cx - 4, base, cz - 3, cx + 3, base + 1, cz + 3, stone);
    m.stairs(cx - 0.5, cz + 4, 'n', 2, 2, stone, 0.5, 0.5, base);
    m.solid(cx - 4.5, base, cz - 1, cx - 4, base + 0.5, cz + 1, stone);
    // tour (4 m), accessible par un escalier de pierre collé au mur est
    m.solid(cx + 0.5, base + 1, cz - 3, cx + 3, base + 5, cz - 0.5, stone);
    m.stairs(cx + 2.25, cz + 3, 'n', 1.5, 8, stone, 0.5, 0.45, base + 1);
    // créneaux de la tour (un sur deux, cassés)
    for (let a = 0; a < 5; a++) {
      if (hash(a, 0, 0, 54) < 0.3) continue;
      m.solid(cx + 0.5 + a * 0.5, base + 5, cz - 3, cx + 0.75 + a * 0.5, base + 5.75, cz - 2.75, stone);
    }
    m.solid(cx + 2.75, base + 5, cz - 3, cx + 3, base + 5.75, cz - 1.5, stone);
    // mur ouest percé d'une arche (couverture) et colonnes brisées, en pierre cassable
    m.breakable('stone', () => {
      m.solid(cx - 4, base + 1, cz - 3, cx - 3.5, base + 3, cz - 2, stone);
      m.solid(cx - 4, base + 1, cz - 0.5, cx - 3.5, base + 3, cz + 0.5, stone);
      m.solid(cx - 4, base + 2.5, cz - 2, cx - 3.5, base + 3, cz - 0.5, stone);
      for (const [dx, dz, hh] of [[-2.5, 2.25, 2.25], [-0.5, 2.25, 1.25]] as const) m.solid(cx + dx - 0.375, base + 1, cz + dz - 0.375, cx + dx + 0.375, base + 1 + hh, cz + dz + 0.375, stone);
    });
    // feu de camp éteint et lanterne
    m.fill(cx - 2, base + 1, cz - 1.5, cx - 1.5, base + 1.75, cz - 1, C.lantern);
  }

  // rochers et troncs couchés (couvertures)
  const rocks: [number, number, number, number, number][] = [
    [-6, -14, 1.4, 1.1, 1.2],
    [-15, -5, 1.2, 1.0, 1.6],
    [7, -3, 1.0, 0.8, 1.0],
    [-3.5, -19, 1.6, 1.3, 1.1],
    [18, -2, 1.3, 1.1, 1.3],
  ];
  rocks.forEach(([x, z, rx, ry, rz], i) => rock(m, x, z, rx, ry, rz, C.stone, C.moss, 60 + i, playHeight(x, z)));
  for (const [x, z] of [[-10, -11], [16, -19]] as const) {
    const base = playHeight(x, z);
    // troncs couchés : bois cassable
    m.breakable('wood', () => {
      m.solid(x - 2, base, z - 0.375, x + 2, base + 0.75, z + 0.375, ({ ix, iy, iz, lx, w }) => (lx === 0 || lx === w - 1 ? '#f0dcc4' : pick(C.trunk, hash(ix >> 1, iy, iz, 61))));
      m.fill(x - 1, base + 0.75, z - 0.125, x - 0.5, base + 1, z + 0.125, pick(C.moss, 0));
    });
  }

  // arbres (feuillus, cerisiers, automne, sapins)
  const trees: [number, number, readonly string[], number, number, boolean][] = [
    [-8, -6, C.leaves, 3.2, 2.0, false],
    [-16, -14, C.blossom, 3.0, 2.0, false],
    [-12, -19, C.pine, 2.0, 1.8, true],
    [6, -18, C.autumn, 3.0, 1.9, false],
    [19, -8, C.leaves, 3.4, 2.1, false],
    [9, -8, C.blossom, 2.8, 1.7, false],
    [-19, -8, C.pine, 2.2, 1.9, true],
    [2.5, -15, C.leaves, 3.0, 1.8, false],
  ];
  trees.forEach(([x, z, leaves, hh, crown, pine], i) => tree(m, x, z, { trunk: C.trunk, leaves, height: hh, crown, seed: 70 + i, base: playHeight(x, z), pine }));

  // champignons et buissons (décor)
  for (const [x, z] of [[-9, -8], [-17, -12], [4, -15], [-7, -10]] as const) {
    const base = playHeight(x, z);
    m.fill(x - 0.125, base, z - 0.125, x + 0.125, base + 0.5, z + 0.125, C.mushroomDot);
    m.blob(x, base + 0.55, z, 0.45, 0.2, 0.45, ({ ix, iz }) => (hash(ix, 0, iz, 81) < 0.2 ? C.mushroomDot : C.mushroomCap), 0, 82);
  }
  for (const [x, z] of [[-13, -2], [3, -21], [12, -5], [-20, -18], [15, -15]] as const) {
    const base = playHeight(x, z);
    m.blob(x, base + 0.4, z, 1.0, 0.6, 1.0, ({ ix, iy, iz }) => (hash(ix, iy, iz, 83) < 0.08 ? pick(C.flowers, hash(iz, iy, ix)) : pick(C.leaves, hash(ix, iy, iz, 84))), 0.35, 85);
  }

  // ---------- décor hors jeu : forêt dense sur les falaises ----------
  const palettes = [C.leaves, C.leaves, C.blossom, C.autumn];
  let planted = 0;
  for (let k = 0; k < 400 && planted < 46; k++) {
    const x = (hash(k, 1, 0, 90) - 0.5) * 58;
    const z = -hash(k, 2, 0, 90) * 29;
    // anneau hors jeu (moitié nord), pas dans la gorge de la rivière
    if (Math.abs(x) < H + 1.5 && Math.abs(z) < H + 1.5) continue;
    if (Math.abs(x - riverX(z)) < 4.5 && Math.abs(z) > H) continue;
    planted++;
    const pine = hash(k, 7, 0, 90) < 0.45;
    const leaves = pine ? C.pine : palettes[Math.floor(hash(k, 8, 0, 90) * palettes.length)]!;
    tree(m, x, z, { trunk: C.trunk, leaves, height: 2.5 + hash(k, 9, 0, 90) * 2, crown: 1.6 + hash(k, 10, 0, 90), seed: 100 + k, base: outerHeight(x, z), collide: false, pine });
  }

  m.mirrorHalf((_x, z) => z < 0);

  // fleurs sur l'herbe (après la recopie, pour varier les deux moitiés)
  scatterFlowers(m, -30, -30, 30, 30, (hex) => C.grass.includes(hex), C.flowers, 0.012, 7);

  // apparitions : coins des plateaux, berges, ruines
  m.spawn(-17, -19, -150).spawn(17, 19, 30);
  m.spawn(19, -19.5, 150).spawn(-19, 19.5, -30);
  m.spawn(-18, 2, -90).spawn(18, -2, 90);
  m.spawn(11, -13, 120).spawn(-11, 13, -60);
  // coffres à grenades : au bord de la rivière et sur les terrasses
  m.chest(-2.5, -9.5).chest(2.5, 9.5).chest(-10.5, -1).chest(10.5, 1);
  return m;
}
