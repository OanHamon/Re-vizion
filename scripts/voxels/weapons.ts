// Les 4 armes du loadout en voxel.
// Style : métal gris en plusieurs tons (comme la planche de référence), pièces lumineuses cyan (DA).
// Repère : x = longueur (bouche du canon vers +x), y = haut, z = profondeur.
import { VoxelBuilder } from './dsl.ts';

export const PALETTE = {
  black: '#33373f',
  dark: '#484e5a',
  metal: '#68707d',
  light: '#8f97a4',
  pale: '#b8bec8',
  glow: '#5fe3f2',
} as const;

const { black, dark, metal, light, pale, glow } = PALETTE;

/** Damier de la crosse / poignée. */
const checker = (x: number, y: number) => (x + y) % 2 === 0;

/** Arêtes du dessus et du dessous adoucies (retire les coins d'une pièce d'épaisseur t). */
function bevel(b: VoxelBuilder, x0: number, x1: number, yTop: number, yBottom: number | null, t: number): void {
  const [z0, z1] = b.zRange(t);
  for (const z of [z0, z1]) {
    b.box(x0, yTop, z, x1, yTop, z, null);
    if (yBottom !== null) b.box(x0, yBottom, z, x1, yBottom, z, null);
  }
}

/** Rail picatinny : une base et des dents une case sur deux. */
function rail(b: VoxelBuilder, x0: number, x1: number, y: number, t: number): void {
  b.slab(x0, y, x1, y, t, black);
  for (let x = x0; x <= x1; x += 2) b.slab(x, y + 1, x, y + 1, t, black);
}

export function pistol(): VoxelBuilder {
  const b = new VoxelBuilder(35, 23, 9);
  // poignée inclinée + talon
  b.profile([[4, 14], [14, 14], [12.5, 7], [11, 0], [3, 0], [2, 7]], 7, dark);
  b.profile([[1, 14], [5, 14], [5, 12], [2, 12.5]], 5, dark);
  b.paint(4, 2, 11, 11, black, 'both', checker);
  b.paint(6, 9, 6, 9, pale).paint(9, 3, 9, 3, pale);
  b.slab(2, 0, 12, 0, 7, light);
  // carcasse et rail
  b.slab(4, 11, 29, 13, 5, dark);
  b.slab(21, 10, 29, 10, 3, black);
  for (let x = 21; x <= 29; x += 2) b.slab(x, 9, x, 9, 3, black);
  b.box(14, 13, 1, 17, 13, 1, light).box(14, 13, 7, 17, 13, 7, light);
  // pontet et détente
  b.slab(13, 6, 21, 7, 3, dark).slab(20, 7, 21, 10, 3, dark);
  b.slab(17, 9, 17, 10, 1, light).slab(16, 8, 16, 8, 1, light);
  // culasse
  b.slab(3, 14, 31, 19, 5, metal);
  bevel(b, 3, 31, 19, null, 5);
  b.recolor(3, 19, 3, 31, 19, 5, light);
  b.engrave(5, 15, 10, 18, 1, dark, 'both', (x) => x % 2 === 0);
  b.engrave(26, 15, 29, 18, 1, dark, 'both', (x) => x % 2 === 1);
  b.engrave(17, 17, 23, 18, 2, black, 'front');
  b.engrave(12, 16, 24, 16, 1, glow, 'both');
  // canon qui dépasse
  b.cylX(30, 33, 16.5, 1.5, black);
  b.set(33, 16, 4, null);
  // chien
  b.slab(1, 15, 2, 17, 1, black);
  // organes de visée : guidon à point lumineux, hausse à cran
  b.slab(29, 20, 29, 21, 1, black).set(29, 21, 4, glow);
  b.slab(4, 20, 6, 21, 3, black).box(4, 21, 4, 6, 21, 4, null);
  return b;
}

export function assaultRifle(): VoxelBuilder {
  const b = new VoxelBuilder(72, 30, 9);
  // crosse ajourée
  b.profile([[0, 9], [0, 20], [2, 21], [14, 19], [14, 15], [4, 10], [2, 9]], 5, dark);
  b.recolor(0, 0, 0, 1, 29, 8, black);
  b.slab(6, 14, 10, 16, 5, null);
  b.paint(2, 18, 12, 18, glow);
  b.cylX(12, 18, 17.5, 1.5, metal);
  // boîtier inférieur et supérieur
  b.slab(17, 12, 42, 15, 7, dark);
  b.slab(17, 16, 44, 20, 7, metal);
  bevel(b, 17, 44, 20, null, 7);
  rail(b, 18, 44, 21, 5);
  b.box(15, 19, 3, 16, 19, 5, light);
  b.engrave(27, 17, 35, 18, 1, black, 'front');
  b.box(24, 17, 8, 25, 18, 8, light);
  // hausse
  b.slab(19, 23, 21, 25, 3, black).box(19, 25, 4, 21, 25, 4, null);
  // poignée pistolet
  b.profile([[21, 12], [27, 12], [26, 8], [24, 3], [19, 3], [20, 8]], 5, dark);
  b.paint(20, 4, 26, 10, black, 'both', checker);
  // pontet et détente
  b.slab(26, 9, 31, 9, 3, dark).slab(30, 9, 31, 11, 3, dark);
  b.slab(28, 10, 28, 11, 1, light);
  // puits et chargeur courbe avec fenêtre lumineuse
  b.slab(30, 11, 39, 12, 7, dark);
  b.profile([[31, 12], [38, 12], [38.5, 6], [37.5, 0], [31.5, 1], [31, 6]], 5, black);
  b.paint(31, 3, 38, 3, dark).paint(31, 8, 38, 8, dark);
  b.paint(34, 4, 35, 7, glow);
  // garde-main octogonal ventilé
  b.slab(45, 13, 60, 20, 7, light);
  bevel(b, 45, 60, 20, 13, 7);
  b.engrave(47, 15, 58, 18, 2, black, 'both', (x) => (x - 47) % 4 < 2);
  b.paint(46, 14, 59, 14, glow);
  rail(b, 45, 60, 21, 5);
  // poignée avant
  b.slab(50, 7, 52, 12, 3, dark);
  b.paint(50, 9, 52, 9, black).paint(50, 11, 52, 11, black);
  // guidon à pointe lumineuse
  b.slab(56, 23, 59, 24, 3, black).slab(57, 25, 57, 27, 1, black).set(57, 27, 4, glow);
  // canon, bloc de gaz, frein de bouche
  b.cylX(61, 66, 16.5, 1.2, black);
  b.slab(61, 18, 62, 19, 3, dark);
  b.cylX(66, 70, 16.5, 2.3, dark);
  for (const x of [67, 69]) b.set(x, 18, 4, null).set(x, 16, 2, null).set(x, 16, 6, null);
  b.set(70, 16, 4, null);
  return b;
}

export function shotgun(): VoxelBuilder {
  const b = new VoxelBuilder(74, 22, 9);
  // crosse droite avec panneau en creux, plaque de couche striée, anneau de bretelle
  b.profile([[0, 3], [0, 13], [2, 14], [21, 15], [21, 9], [16, 8], [7, 5], [2, 3]], 5, metal);
  b.recolor(0, 0, 0, 1, 21, 8, black);
  b.paint(0, 4, 1, 12, dark, 'both', (_x, y) => y % 2 === 0);
  b.engrave(5, 9, 14, 11, 1, dark);
  b.engrave(16, 10, 19, 12, 1, black, 'both', checker);
  b.slab(8, 3, 9, 7, 1, light).set(8, 2, 4, light).set(9, 2, 4, light);
  // boîtier avec cartouches lumineuses sur le flanc
  b.slab(20, 8, 36, 16, 7, dark);
  bevel(b, 20, 36, 16, null, 7);
  b.engrave(25, 13, 31, 14, 1, black, 'front');
  b.slab(27, 8, 33, 8, 3, null);
  for (let i = 0; i < 4; i++) {
    const x = 22 + i * 3;
    b.box(x, 10, 0, x + 1, 13, 0, glow).box(x, 9, 0, x + 1, 9, 0, pale);
  }
  // pontet et détente
  b.slab(24, 5, 31, 5, 3, dark).slab(24, 5, 24, 7, 3, dark).slab(31, 5, 31, 7, 3, dark);
  b.slab(28, 6, 28, 7, 1, light);
  // canon avec bande ventilée et guidon lumineux
  b.cylX(36, 72, 15.5, 1.3, black);
  b.slab(37, 18, 71, 18, 1, light);
  for (let x = 37; x <= 71; x += 3) b.slab(x, 17, x, 17, 1, light);
  b.set(71, 19, 4, glow);
  b.set(72, 15, 4, null);
  // tube magasin et collier
  b.cylX(36, 62, 10.5, 1.3, metal);
  b.cylX(63, 64, 10.5, 1.6, dark);
  b.slab(60, 9, 61, 16, 5, dark);
  // pompe striée
  b.slab(42, 8, 57, 13, 7, light);
  bevel(b, 42, 57, 13, 8, 7);
  b.engrave(43, 9, 56, 12, 1, metal, 'both', (x) => x % 2 === 0);
  return b;
}

export function sniper(): VoxelBuilder {
  const b = new VoxelBuilder(90, 30, 11);
  // crosse à trou de pouce, appui-joue
  b.profile([[0, 4], [0, 17], [2, 18], [14, 17], [25, 15], [25, 11], [19, 11], [13, 7], [12, 4]], 5, dark);
  b.profile([[14, 10], [18, 12], [19, 14], [15, 14], [13, 12]], 5, null);
  b.recolor(0, 0, 0, 1, 29, 10, black);
  b.slab(3, 18, 12, 19, 3, metal);
  b.paint(3, 15, 11, 15, glow);
  b.paint(19, 8, 24, 10, black, 'both', checker);
  // boîtier, levier de culasse
  b.slab(24, 11, 44, 16, 7, metal);
  bevel(b, 24, 44, 16, null, 7);
  b.engrave(34, 14, 40, 15, 1, black, 'front');
  b.box(33, 14, 9, 33, 14, 9, light).box(33, 13, 10, 34, 14, 10, black);
  // pontet, détente, chargeur
  b.slab(25, 7, 31, 7, 3, dark).slab(31, 7, 31, 10, 3, dark);
  b.slab(28, 8, 28, 10, 1, light);
  b.slab(32, 6, 37, 10, 5, black);
  b.paint(33, 8, 36, 8, glow);
  // canon cannelé, bague lumineuse, frein de bouche
  b.cylX(45, 82, 13.5, 1.3, black);
  b.paint(48, 13, 72, 13, dark, 'both', (x) => x % 3 === 0);
  b.cylX(74, 74, 13.5, 1.7, glow);
  b.cylX(83, 88, 13.5, 2.3, dark);
  b.engrave(84, 12, 85, 14, 1, null);
  b.engrave(87, 12, 87, 14, 1, null);
  b.set(88, 13, 5, null);
  // bipied replié
  b.slab(50, 10, 51, 11, 7, dark);
  b.box(52, 10, 3, 66, 10, 3, dark).box(52, 10, 7, 66, 10, 7, dark);
  b.box(66, 9, 3, 67, 9, 3, black).box(66, 9, 7, 67, 9, 7, black);
  // rail, colliers, lunette
  b.slab(25, 17, 46, 17, 5, black);
  b.slab(30, 18, 31, 20, 3, dark).slab(43, 18, 44, 20, 3, dark);
  b.cylX(26, 52, 22.5, 1.3, black);
  b.cylX(47, 53, 22.5, 2.4, dark);
  b.cylX(53, 53, 22.5, 1.5, glow);
  b.cylX(21, 26, 22.5, 2.0, dark);
  b.cylX(21, 21, 22.5, 1.2, pale);
  b.cylY(24, 25, 38.5, 1.2, metal);
  b.box(37, 22, 7, 39, 23, 8, metal);
  return b;
}

export const WEAPONS: Record<string, () => VoxelBuilder> = {
  pistol,
  assault_rifle: assaultRifle,
  shotgun,
  sniper,
};
