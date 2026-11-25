// Carte « Quartier » (ville) : une place à fontaine au croisement de quatre rues, deux cafés à toit-terrasse
// reliés par des passerelles au-dessus des rues, voitures et caisses pour se couvrir, façades pastel tout autour.
// La carte est symétrique par rotation de 180° : on dessine la moitié nord (z < 0), puis on la recopie.
import { hash, MapBuilder, pick, type Paint } from './mapDsl.ts';
import { building, car, crate, lamp, tree, type BuildingPalette, type CarPalette } from './props.ts';

const PLAY = 44;
const H = PLAY / 2;

const C = {
  asphalt: ['#cbc6d1', '#c6c1cc', '#cfcad5', '#c9c4cf'],
  line: '#fbf3dc',
  curb: '#ddd3c3',
  sidewalk: ['#ece3d2', '#e8dfcd', '#efe7d7'],
  joint: '#dbd0bd',
  plazaA: ['#f1e5d0', '#eee1cb'],
  plazaB: ['#f3d6c7', '#f0d0c0'],
  plazaC: ['#d4e5ec', '#cde0e8'],
  grass: ['#c3e2b7', '#badcad', '#cbe7c0', '#b4d6a7'],
  stone: ['#e0d6c6', '#d9cebd', '#e6ddcf'],
  water: ['#b5dcec', '#a9d4e8', '#c2e4f1'],
  foam: '#eef8fb',
  wood: ['#d9b896', '#d2af8c', '#ddbf9f'],
  woodDark: '#b8936f',
  trunk: ['#bf9a7a', '#b48f70'],
  leaves: ['#a9d39b', '#b7dca8', '#9fcb92', '#c4e3b6'],
  blossom: ['#f5c6d6', '#f8d3df', '#efb8cb', '#fbe0e8'],
  metal: '#a9a4b5',
  lampGlow: '#fff2c6',
  barrierA: '#f4a9a0',
  barrierB: '#fff8ec',
  cone: '#f6b48f',
};

const P: BuildingPalette = {
  glass: ['#b7d3ea', '#aecde6', '#e6f2fb'],
  curtains: ['#f5c4cf', '#cfe3f3', '#f7e3b6', '#d9cdf1'],
  frame: '#fdf8ef',
  plinth: ['#d9ccb9', '#d3c5b1'],
  roof: ['#d7cbc2', '#d1c4ba', '#dcd1c9'],
  tiles: ['#e3a99d', '#d99e92', '#e9b5a9', '#dda397'],
  door: '#c4a58f',
  metal: '#b4afbf',
  flowers: ['#f4a6b8', '#f7d27e', '#c9b3f0', '#fbfbf6'],
  leaves: ['#a9d39b', '#9fcb92'],
};

const WALLS = {
  pink: ['#f5cbc6', '#f2c4bf', '#f7d2cd'],
  peach: ['#f7d8bc', '#f4d0b2', '#f9dec6'],
  mint: ['#d0e9d8', '#c8e3d0', '#d7eddf'],
  blue: ['#cde0f1', '#c5dbed', '#d4e5f3'],
  lilac: ['#ddd2f1', '#d6caec', '#e3d9f4'],
  butter: ['#f7e8b9', '#f4e2ab', '#f9edc6'],
  cream: ['#f6efe2', '#f2eadb', '#f9f3e8'],
};

const CARS: CarPalette[] = [
  { body: '#9fc4ea', bodyDark: '#8db5df', glass: '#e4f1fb', wheel: '#8e8999', hub: '#d8d4df', lightFront: '#fff4cf', lightBack: '#f49aa8' },
  { body: '#f2a8b8', bodyDark: '#e797aa', glass: '#e4f1fb', wheel: '#8e8999', hub: '#d8d4df', lightFront: '#fff4cf', lightBack: '#f49aa8' },
  { body: '#a8dcc4', bodyDark: '#95d0b5', glass: '#e4f1fb', wheel: '#8e8999', hub: '#d8d4df', lightFront: '#fff4cf', lightBack: '#f49aa8' },
  { body: '#f7d88f', bodyDark: '#efcb78', glass: '#e4f1fb', wheel: '#8e8999', hub: '#d8d4df', lightFront: '#fff4cf', lightBack: '#f49aa8' },
];

export function buildCity(): MapBuilder {
  const m = new MapBuilder({ play: [PLAY, PLAY], extent: [60, 60], height: 24 });
  for (const hex of [P.glass[2]!]) m.color(hex);
  m.light(C.lampGlow);

  // ---------- sol ----------
  const groundPaint: Paint = ({ ix, iy, iz }) => {
    const x = m.mx(ix);
    const z = m.mz(iz);
    const ax = Math.abs(x);
    const az = Math.abs(z);
    const n = hash(ix, iy, iz, 11);
    // place : cercles concentriques et rayons
    if (ax < 8.5 && az < 8.5) {
      const r = Math.hypot(x, z);
      if (r < 8.25) {
        const ring = Math.floor(r / 1.25);
        const angle = Math.atan2(z, x);
        const ray = Math.abs(Math.sin(angle * 4)) < 0.06 && r > 3;
        if (ray) return pick(C.plazaC, n);
        return pick(ring % 2 === 0 ? C.plazaA : C.plazaB, n);
      }
      return pick(C.plazaA, n);
    }
    // rues : |x| < 3 (nord-sud) ou |z| < 3 (est-ouest)
    const streetNS = ax < 3;
    const streetEW = az < 3;
    if (streetNS || streetEW) {
      // passage piéton près de la place
      const along = streetNS ? az : ax;
      const across = streetNS ? x : z;
      if (along > 9 && along < 11) return Math.floor((across + 3) * 2) % 2 === 0 ? C.line : pick(C.asphalt, n);
      // ligne centrale en tirets
      if (Math.abs(across) < 0.2 && Math.floor(along) % 3 < 2 && along > 11) return C.line;
      return pick(C.asphalt, n);
    }
    // bordure puis trottoir
    if (ax < 3.25 || az < 3.25) return C.curb;
    if (ax < 4.5 || az < 4.5) {
      const tile = (Math.floor(x * 2) + Math.floor(z * 2)) % 6 === 0 && (ix % 4 === 0 || iz % 4 === 0);
      return tile ? C.joint : pick(C.sidewalk, n);
    }
    // cours : dalles de 1 m, joints clairs
    if (ix % 4 === 0 || iz % 4 === 0) return C.joint;
    return pick(C.stone, hash(ix >> 2, 0, iz >> 2, 12) * 0.6 + n * 0.39);
  };
  m.vfill(0, 0, 0, m.model.sx, 1, m.model.sz, groundPaint);

  // ---------- moitié nord (z < 0), recopiée ensuite ----------

  // fontaine au centre : bassin rond, colonne, vasque, eau
  m.cylinder(0, 0, 2.6, 0, 0.75, ({ ix, iy, iz }) => pick(C.stone, hash(ix, iy, iz, 3)));
  m.cylinder(0, 0, 2.35, 0.25, 0.75, null);
  m.cylinder(0, 0, 2.35, 0, 0.5, ({ ix, iy, iz }) => (hash(ix, iy, iz, 4) < 0.08 ? C.foam : pick(C.water, hash(ix >> 1, 0, iz >> 1, 4))));
  m.cylinder(0, 0, 2.6, 0.75, 1.0, '#efe6d8');
  m.cylinder(0, 0, 2.35, 0.75, 1.0, null);
  m.cylinder(0, 0, 0.5, 0.5, 2.25, ({ ix, iy, iz }) => pick(C.stone, hash(ix, iy, iz, 5)));
  m.cylinder(0, 0, 1.25, 2.25, 2.5, '#efe6d8');
  m.cylinder(0, 0, 1.1, 2.5, 2.75, ({ ix, iy, iz }) => pick(C.water, hash(ix, iy, iz, 6)));
  m.cylinder(0, 0, 0.25, 2.75, 3.5, C.foam);
  m.collide(-1.85, 0, -1.85, 1.85, 1.0, 1.85);
  m.collide(-0.5, 1.0, -0.5, 0.5, 2.75, 0.5);

  // arbres en jarre sur la place, bancs, lampadaires
  for (const [x, z] of [[-6.2, -6.2], [6.2, -6.2]] as const) {
    m.solid(x - 0.8, 0, z - 0.8, x + 0.8, 0.5, z + 0.8, ({ ix, iy, iz, lx, ly, lz, w, h, d }) => (ly === h - 1 && lx > 0 && lx < w - 1 && lz > 0 && lz < d - 1 ? '#c7a98f' : pick(C.stone, hash(ix, iy, iz))));
    tree(m, x, z, { trunk: C.trunk, leaves: x < 0 ? C.blossom : C.leaves, height: 2.6, crown: 1.7, seed: x < 0 ? 21 : 22, base: 0.5 });
  }
  for (const [x, z, alongX] of [[-3.75, -5.4, true], [5.4, -3.75, false]] as const) {
    const [hx, hz] = alongX ? [1, 0.25] : [0.25, 1];
    m.fill(x - hx, 0.25, z - hz, x + hx, 0.5, z + hz, C.wood[0]!);
    for (const s of [-0.75, 0.75]) m.fill(x + (alongX ? s : 0) - 0.125, 0, z + (alongX ? 0 : s) - 0.125, x + (alongX ? s : 0) + 0.125, 0.25, z + (alongX ? 0 : s) + 0.125, C.metal);
  }
  for (const [x, z] of [[-8.75, -8.75], [8.75, -8.75], [-3.9, -12], [3.9, -20], [-20, -3.9], [14, -3.9]] as const) lamp(m, x, z, C.metal, C.lampGlow);

  // murets de la place (couverture), en pierre cassable
  for (const x of [-4.75, 4.75]) {
    m.breakable('stone', () => {
      m.solid(x - 1.25, 0, -8.25, x + 1.25, 0.75, -7.75, ({ ix, iy, iz, ly }) => (ly === 2 ? '#efe6d8' : pick(C.stone, hash(ix, iy, iz, 8))));
      m.fill(x - 1.25, 0.75, -8.25, x + 1.25, 1.0, -7.75, ({ ix, iy, iz }) => pick([...P.flowers, ...P.leaves, ...P.leaves], hash(ix, iy, iz, 9)));
    });
  }

  // café nord-est : toit-terrasse à 4,5 m, vitrine au sud, escalier à l'ouest
  building(m, { x0: 8, z0: -19, x1: 15, z1: -12, h: 4.5, wall: WALLS.butter, trim: '#fff9ec', seed: 31, palette: P, roofAccess: true, shop: { side: 's', awning: ['#f4b0a6', '#fff8ec'] }, blind: ['w'] });
  m.stairs(6.5, -11.5, 'n', 3, 9, ({ ix, iy, iz, ly, h }) => (ly === h - 1 ? '#efe2cc' : pick(C.stone, hash(ix, iy, iz, 13))));
  // terrasse du café : tables, parasols, jardinières
  for (const [x, z, c] of [[10, -9, '#f4b0a6'], [13.5, -8, '#bfdff0'], [17, -9.5, '#f7dc94']] as const) {
    m.solid(x - 0.5, 0, z - 0.5, x + 0.5, 0.75, z + 0.5, ({ lx, ly, lz }) => (ly === 2 ? '#fbf6ee' : lx === 1 && lz === 1 ? C.metal : null));
    m.fill(x - 0.125, 0.75, z - 0.125, x + 0.125, 2.25, z + 0.125, C.metal);
    m.blob(x, 2.35, z, 1.4, 0.35, 1.4, ({ ix, iz }) => (((ix + iz) >> 1) % 2 === 0 ? c : '#fffaf0'), 0, 1);
    for (const [dx, dz] of [[-0.9, 0], [0.9, 0]] as const) m.fill(x + dx - 0.25, 0, z + dz - 0.25, x + dx + 0.25, 0.5, z + dz + 0.25, C.woodDark);
  }
  for (const x of [8.5, 19]) {
    m.solid(x - 1, 0, -6, x + 1, 0.5, -5.25, ({ ix, iy, iz, ly }) => (ly === 1 ? pick(['#a9d39b', '#f4a6b8', '#f7d27e'], hash(ix, iy, iz, 2)) : '#d8c7b0'));
  }

  // atelier nord-ouest : toit à 4,5 m relié au café par une passerelle, escalier à l'est
  building(m, { x0: -16, z0: -20, x1: -8, z1: -12, h: 4.5, wall: WALLS.lilac, trim: '#fbf7ff', seed: 32, palette: P, roofAccess: true, door: 's', blind: ['e'] });
  m.stairs(-6.5, -11.5, 'n', 3, 9, ({ ix, iy, iz, ly, h }) => (ly === h - 1 ? '#efe2cc' : pick(C.stone, hash(ix, iy, iz, 14))));
  // passerelle au-dessus de la rue nord (x de −8 à 8), garde-corps franchissables d'un saut
  // (garde-corps au-dessus de la rue seulement, pour laisser l'arrivée des escaliers libre)
  m.solid(-8, 4.25, -18, 8, 4.5, -15.5, ({ ix, iy, iz }) => (ix % 4 === 0 ? C.woodDark : pick(C.wood, hash(ix, iy, iz, 15))));
  for (const z of [-18, -15.75]) {
    m.solid(-5, 4.5, z, 5, 5.5, z + 0.25, ({ ix, ly, h }) => (ly === h - 1 || ix % 6 === 0 ? C.metal : null));
  }
  for (const x of [-3.75, 3.75]) m.solid(x - 0.25, 0, -17, x + 0.25, 4.25, -16.5, ({ ly }) => (ly % 6 === 0 ? '#fdf8ef' : C.metal));
  // jardinières suspendues sous la passerelle
  for (let x = -7; x <= 7; x += 2) m.fill(x - 0.25, 4.0, -18.25, x + 0.25, 4.25, -18, pick(P.flowers, hash(x, 0, 0, 7)));

  // ruelle nord-ouest : camionnette, caisses, poubelles
  car(m, -19, -9, false, CARS[2]!);
  m.breakable('wood', () => {
    for (const [x, z, s, base] of [[-11, -9.5, 1, 0], [-12, -9.5, 1, 0], [-11.5, -9.5, 1, 1], [-14, -6, 1, 0]] as const) crate(m, x, z, s, C.wood, C.woodDark, base);
  });
  // abri de bus au bord de la rue ouest
  // vitre de l'abri (cassable, cadre compris)
  m.breakable('glass', () => m.solid(-16, 0, -5.0, -12, 2.5, -4.75, ({ lx, ly }) => (ly > 1 && ly < 8 && lx > 0 && lx < 15 ? '#d9ecf6' : C.metal)));
  m.fill(-16.25, 2.5, -6.25, -11.75, 2.75, -4.5, ({ ix }) => (ix % 3 === 0 ? '#9fc4ea' : '#bcd8f0'));
  m.fill(-15.5, 0, -5.75, -12.5, 0.5, -5.25, C.wood[0]!);
  // panneau d'affichage (couleurs de famille)
  m.fill(-11.75, 0.5, -5.0, -11.5, 2.25, -4.75, ({ iy }) => pick(['#f7c59f', '#bde3ea', '#cfe7c9', '#f6e7a1'], ((iy >> 1) % 4) / 4));

  // voitures garées
  car(m, 1.8, -20, false, CARS[0]!);
  car(m, -1.8, -13.5, false, CARS[1]!);
  car(m, 13, -1.8, true, CARS[3]!);
  // caisses dans la cour nord-est
  m.breakable('wood', () => {
    for (const [x, z, base] of [[18, -14, 0], [19, -14, 0], [18.5, -14, 1], [19, -18, 0]] as const) crate(m, x, z, 1, C.wood, C.woodDark, base);
  });
  tree(m, 20, -20, { trunk: C.trunk, leaves: C.leaves, height: 3, crown: 1.8, seed: 41 });
  tree(m, -20, -16, { trunk: C.trunk, leaves: C.blossom, height: 3, crown: 1.8, seed: 42 });

  // ---------- décor hors jeu au nord : façades et fond de rue ----------
  const ring: { x0: number; x1: number; h: number; wall: readonly string[]; gable?: boolean; seed: number }[] = [
    { x0: -30, x1: -22, h: 15, wall: WALLS.blue, seed: 51 },
    { x0: -22, x1: -14, h: 12, wall: WALLS.peach, gable: true, seed: 52 },
    { x0: -14, x1: -4.5, h: 18, wall: WALLS.mint, seed: 53 },
    { x0: 4.5, x1: 12, h: 13.5, wall: WALLS.pink, gable: true, seed: 54 },
    { x0: 12, x1: 22, h: 16.5, wall: WALLS.cream, seed: 55 },
    { x0: 22, x1: 30, h: 12, wall: WALLS.lilac, gable: true, seed: 56 },
  ];
  for (const b of ring) building(m, { x0: b.x0, z0: -30, x1: b.x1, z1: -H, h: b.h, wall: b.wall, trim: '#fffaf1', seed: b.seed, palette: P, gable: b.gable, collide: false, balconies: true });
  // fond de la rue nord
  building(m, { x0: -4.5, z0: -30, x1: 4.5, z1: -27, h: 13.5, wall: WALLS.butter, trim: '#fffaf1', seed: 57, palette: P, collide: false, balconies: true, door: 's' });
  // côté est (moitié nord), recopié à l'ouest ensuite
  const east: { z0: number; z1: number; h: number; wall: readonly string[]; gable?: boolean; seed: number }[] = [
    { z0: -22, z1: -14, h: 13.5, wall: WALLS.blue, gable: true, seed: 61 },
    { z0: -14, z1: -4.5, h: 10.5, wall: WALLS.pink, seed: 62 },
  ];
  for (const b of east) building(m, { x0: H, z0: b.z0, x1: 30, z1: b.z1, h: b.h, wall: b.wall, trim: '#fffaf1', seed: b.seed, palette: P, gable: b.gable, collide: false, balconies: true });
  building(m, { x0: 27, z0: -4.5, x1: 30, z1: 0, h: 12, wall: WALLS.cream, trim: '#fffaf1', seed: 63, palette: P, collide: false });
  // côté ouest (moitié nord), recopié à l'est
  const west: { z0: number; z1: number; h: number; wall: readonly string[]; gable?: boolean; seed: number }[] = [
    { z0: -22, z1: -13, h: 10.5, wall: WALLS.butter, seed: 64 },
    { z0: -13, z1: -4.5, h: 15, wall: WALLS.peach, gable: true, seed: 65 },
  ];
  for (const b of west) building(m, { x0: -30, z0: b.z0, x1: -H, z1: b.z1, h: b.h, wall: b.wall, trim: '#fffaf1', seed: b.seed, palette: P, gable: b.gable, collide: false, balconies: true });
  building(m, { x0: -30, z0: -4.5, x1: -27, z1: 0, h: 13.5, wall: WALLS.mint, trim: '#fffaf1', seed: 66, palette: P, collide: false });
  // barrières de chantier au bout des rues
  const barrier: Paint = ({ ix, iy }) => (((ix + iy) >> 1) % 2 === 0 ? C.barrierA : C.barrierB);
  m.fill(-3, 0.5, -H - 0.25, 3, 1.0, -H, barrier);
  for (const x of [-2.5, 2.5]) m.fill(x - 0.125, 0, -H - 0.25, x + 0.125, 0.5, -H, C.metal);
  m.fill(H, 0.5, -3, H + 0.25, 1.0, 0, barrier);
  m.fill(-H - 0.25, 0.5, -3, -H, 1.0, 0, barrier);
  for (const [x, z] of [[-1.25, -23], [1.5, -24]] as const) m.cylinder(x, z, 0.3, 0, 0.75, C.cone);

  // ---------- recopie tournée de 180° ----------
  m.mirrorHalf((_x, z) => z < 0);

  // apparitions : bouts de rue, cours, toits
  m.spawn(0, -20.5, 180).spawn(0, 20.5, 0);
  m.spawn(20.5, 0, 90).spawn(-20.5, 0, -90);
  m.spawn(11.5, -15.5, 160).spawn(-11.5, 15.5, -20);
  m.spawn(17, -7, 135).spawn(-17, 7, -45);
  // coffres à grenades : deux paires symétriques autour de la place (pas dans la fontaine, qui ne bloque pas)
  m.chest(-1, -10).chest(1, 10).chest(-10, -1).chest(10, 1);
  return m;
}
