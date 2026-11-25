// Les personnages en voxel (adversaires vus en combat).
// Style : proportions un peu « chibi » (grosse tête, gros yeux), vêtements simples, tons doux.
// Le haut est peint avec deux couleurs « marqueurs » (TINT, TINT_DARK) que le jeu remplace
// par la couleur du joueur au chargement (voir config/assets.json, champ voxel.tint).
//
// Repère : x = largeur, y = haut, z = profondeur ; le visage regarde vers +z.
// Le personnage regarde vers +z, donc sa main droite est du côté des petits x.
// Un voxel = 2,5 cm : 72 voxels de haut = 1,80 m (hauteur de la hitbox).
// Les parties animées (tête, bras, jambes) sont découpées au chargement par les boîtes
// de config/assets.json : un voxel ne doit donc jamais déborder de la boîte de sa partie.
import { VoxelBuilder } from './dsl.ts';

export const SIZE = { sx: 28, sy: 75, sz: 17 } as const;

/** Couleurs remplacées par la couleur du joueur (claire puis foncée). */
export const TINT = '#ff00ff';
export const TINT_DARK = '#b000b0';

const skin = '#f1c7a3';
const skinShade = '#e0ad88';
const skinDeep = '#c98f6d';
const white = '#fbf7f0';
const eye = '#3b2f33';
const lash = '#2a2226';
const mouth = '#c9776b';
const blush = '#f2a99f';

/** Miroir gauche/droite. */
const mx = (x: number) => SIZE.sx - 1 - x;

interface Look {
  hair: string;
  hairLight: string;
  hairDark: string;
  long: boolean;
  /** Bas : short + bottes (true) ou pantalon + baskets (false). */
  shorts: boolean;
  pants: string;
  pantsDark: string;
  shoes: string;
  shoesLight: string;
  accent: string;
}

/** Pavé symétrique : dessine (x0..x1) et son miroir. */
function sym(b: VoxelBuilder, x0: number, y0: number, z0: number, x1: number, y1: number, z1: number, hex: string | null): void {
  b.box(x0, y0, z0, x1, y1, z1, hex);
  b.box(mx(x1), y0, z0, mx(x0), y1, z1, hex);
}

function setSym(b: VoxelBuilder, x: number, y: number, z: number, hex: string | null): void {
  b.set(x, y, z, hex);
  b.set(mx(x), y, z, hex);
}

function legs(b: VoxelBuilder, look: Look): void {
  // jambes : x 8..12 et 15..19, z 5..10
  if (look.shorts) {
    sym(b, 8, 9, 5, 12, 21, 10, skin);
    sym(b, 8, 13, 10, 12, 14, 10, skinShade); // genou
    sym(b, 7, 19, 4, 13, 29, 11, look.pants); // short
    sym(b, 7, 19, 4, 13, 19, 11, look.pantsDark); // ourlet
    sym(b, 13, 22, 11, 13, 26, 11, look.pantsDark); // couture
    // bottes montantes
    sym(b, 7, 0, 4, 13, 8, 12, look.shoes);
    sym(b, 7, 7, 4, 13, 8, 11, look.shoesLight); // revers
    b.box(7, 8, 12, 13, 8, 12, null).box(mx(13), 8, 12, mx(7), 8, 12, null);
    sym(b, 7, 0, 4, 13, 0, 12, look.pantsDark); // semelle
  } else {
    sym(b, 8, 4, 5, 12, 29, 10, look.pants);
    sym(b, 7, 20, 4, 13, 29, 11, look.pants); // haut du pantalon plus large
    sym(b, 8, 4, 5, 12, 5, 10, look.pantsDark); // revers
    sym(b, 10, 8, 10, 10, 26, 10, look.pantsDark); // pli du pantalon
    sym(b, 9, 14, 10, 11, 15, 10, look.pantsDark); // genou
    // baskets
    sym(b, 7, 0, 4, 13, 3, 12, look.shoes);
    sym(b, 7, 0, 4, 13, 0, 12, white); // semelle
    sym(b, 8, 3, 11, 12, 3, 12, null);
    sym(b, 9, 2, 12, 11, 2, 12, look.shoesLight); // lacets
  }
}

function torso(b: VoxelBuilder, look: Look): void {
  // taille plus fine, épaules plus larges
  b.box(8, 30, 5, 19, 40, 11, TINT);
  b.box(7, 41, 5, 20, 56, 11, TINT);
  // épaules arrondies
  for (const z of [5, 11]) setSym(b, 7, 56, z, null);
  // ceinture / taille du pantalon
  b.box(8, 30, 5, 19, 32, 11, look.pants);
  b.box(8, 31, 5, 19, 31, 11, look.accent);
  b.box(13, 30, 12, 14, 32, 12, white); // boucle
  // bas du t-shirt
  b.box(8, 33, 5, 19, 33, 11, TINT_DARK);
  // col : encolure en arrondi
  b.box(11, 53, 11, 16, 56, 11, skin);
  b.box(12, 52, 11, 15, 52, 11, skin);
  b.box(10, 56, 6, 17, 56, 11, TINT_DARK);
  b.box(11, 56, 7, 16, 56, 11, skin);
  b.box(11, 53, 11, 11, 56, 11, TINT_DARK).box(16, 53, 11, 16, 56, 11, TINT_DARK);
  // petit écusson sur la poitrine
  b.box(16, 47, 12, 17, 48, 12, white);
  // plis
  b.box(10, 37, 11, 10, 40, 11, TINT_DARK).box(17, 36, 11, 17, 39, 11, TINT_DARK);
}

function arms(b: VoxelBuilder, look: Look): void {
  // bras : x 3..6 et 21..24, z 6..9 ; épaule en haut (y 55)
  sym(b, 3, 32, 6, 6, 55, 9, skin);
  sym(b, 3, 32, 6, 6, 32, 9, skinShade); // dessous de la main
  sym(b, 3, 46, 5, 6, 55, 10, TINT); // manche
  sym(b, 3, 46, 5, 6, 46, 10, TINT_DARK);
  for (const z of [5, 10]) setSym(b, 3, 55, z, null);
  // coude
  sym(b, 3, 41, 6, 3, 42, 6, skinShade);
  // poignet / bracelet
  sym(b, 3, 36, 6, 6, 37, 9, look.accent);
  // pouce vers l'avant
  sym(b, 5, 33, 10, 6, 34, 10, skin);
  sym(b, 3, 32, 9, 6, 32, 9, skinDeep);
}

function head(b: VoxelBuilder, look: Look): void {
  // cou
  b.box(11, 57, 7, 16, 57, 10, skinShade);
  // crâne : x 7..20, y 58..70, z 4..14
  b.box(7, 58, 4, 20, 70, 14, skin);
  // menton arrondi
  for (const x of [7, 8]) setSym(b, x, 58, 14, null);
  setSym(b, 7, 59, 14, null);
  setSym(b, 7, 58, 13, null);
  // oreilles
  sym(b, 6, 61, 8, 6, 63, 9, skinShade);
  // yeux (3 de haut, 3 de large) : contour foncé, blanc à l'extérieur, reflet
  for (const [x0, outer] of [[8, 8], [17, 19]] as const) {
    b.box(x0, 62, 14, x0 + 2, 64, 14, eye);
    b.set(outer, 62, 14, white);
    b.box(x0, 65, 14, x0 + 2, 65, 14, lash);
  }
  b.set(10, 64, 14, white).set(17, 64, 14, white);
  // sourcils
  b.box(8, 67, 14, 10, 67, 14, look.hairDark).box(17, 67, 14, 19, 67, 14, look.hairDark);
  // nez (dépasse d'une case)
  b.box(13, 61, 15, 14, 61, 15, skinShade);
  // bouche
  b.box(13, 59, 14, 14, 59, 14, mouth);
  // joues
  b.set(8, 60, 14, blush).set(9, 60, 14, blush).set(18, 60, 14, blush).set(19, 60, 14, blush);
}

function hair(b: VoxelBuilder, look: Look): void {
  const { hair: h, hairLight: hl, hairDark: hd } = look;
  // calotte : dessus, arrière, côtés hauts
  b.box(6, 71, 3, 21, 71, 15, h);
  b.box(6, 64, 3, 21, 70, 3, h);
  sym(b, 6, 64, 3, 6, 70, 13, h);
  // frange avec pointes
  b.box(7, 68, 15, 20, 70, 15, h);
  for (let x = 7; x <= 20; x++) if (x % 3 !== 1) b.set(x, 67, 15, h);
  b.box(12, 66, 15, 13, 67, 15, h); // mèche centrale
  // reflets en bandes
  for (let x = 7; x <= 20; x += 3) b.box(x, 71, 5, x, 71, 13, hl);
  // mèches plus claires sur les côtés
  for (let z = 5; z <= 12; z += 3) {
    b.box(6, 65, z, 6, 70, z, hl);
    b.box(21, 65, z, 21, 70, z, hl);
  }
  if (look.long) {
    // cheveux longs : tombent dans le dos jusqu'aux omoplates, mèches qui encadrent le visage
    b.box(6, 57, 2, 21, 70, 3, h);
    b.box(7, 42, 2, 20, 56, 4, h);
    for (let x = 7; x <= 20; x++) {
      const end = 42 + ((x * 7) % 4); // pointes irrégulières
      b.box(x, 42, 2, x, end - 1, 4, null);
    }
    sym(b, 6, 57, 4, 6, 70, 14, h);
    sym(b, 6, 57, 13, 7, 66, 14, h);
    sym(b, 6, 57, 12, 6, 58, 14, hd);
    for (let x = 8; x <= 19; x += 3) b.box(x, 45, 2, x, 68, 2, hl);
  } else {
    // cheveux courts en pics
    for (let x = 7; x <= 20; x += 2) {
      const tall = (x * 5) % 3 === 0 ? 2 : 1;
      b.box(x, 72, 5 + (x % 3), x, 71 + tall, 7 + (x % 3), x % 4 === 1 ? hl : h);
    }
    b.box(10, 72, 12, 15, 73, 14, h); // houppette sur le devant
    b.box(11, 74, 13, 13, 74, 14, hl);
    sym(b, 7, 63, 13, 7, 66, 14, h); // pattes
    b.box(7, 62, 3, 20, 63, 3, hd); // nuque
  }
}

function character(look: Look): VoxelBuilder {
  const b = new VoxelBuilder(SIZE.sx, SIZE.sy, SIZE.sz);
  // ordre des couleurs de palette : les marqueurs d'abord, pour qu'ils soient faciles à repérer
  b.color(TINT);
  b.color(TINT_DARK);
  legs(b, look);
  torso(b, look);
  arms(b, look);
  head(b, look);
  hair(b, look);
  return b;
}

export const CHARACTERS: Record<string, () => VoxelBuilder> = {
  /** Cheveux longs gris-brun, short kaki, bottes (1re image de référence). */
  student_a: () =>
    character({
      hair: '#6a5650',
      hairLight: '#86716a',
      hairDark: '#4b3d39',
      long: true,
      shorts: true,
      pants: '#c3b89d',
      pantsDark: '#a69a7f',
      shoes: '#97644d',
      shoesLight: '#b3806a',
      accent: '#8b6a55',
    }),
  /** Cheveux courts châtains en pics, pantalon bleu doux, baskets (2e image de référence). */
  student_b: () =>
    character({
      hair: '#8a6248',
      hairLight: '#a97b5c',
      hairDark: '#6b4a36',
      long: false,
      shorts: false,
      pants: '#9fb3cf',
      pantsDark: '#8296b3',
      shoes: '#e9e2d6',
      shoesLight: '#c9bfb0',
      accent: '#7c8ba3',
    }),
};
