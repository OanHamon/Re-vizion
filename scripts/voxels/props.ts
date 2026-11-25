// Objets du combat dessinés en voxel : coffre à grenades et grenade.
// Repère : x = largeur, y = haut, z = profondeur ; le devant du coffre (serrure) est vers +z.
// Couleurs : famille Arme (jaune pastel) pour le coffre, famille Attaque (orange pastel) pour la grenade,
// gris des armes et cyan lumineux pour les pièces en métal et les voyants.
import { VoxelBuilder } from './dsl.ts';

const yellow = '#fbe8a8';
const yellowDeep = '#dcb853';
const orange = '#ffcfae';
const orangeDeep = '#eba077';
const dark = '#484e5a';
const metal = '#68707d';
const light = '#8f97a4';
const glow = '#5fe3f2';

/** Coffre : 18 × 13 × 12 voxels de 5 cm (0,9 × 0,65 × 0,6 m). */
export function chest(): VoxelBuilder {
  const b = new VoxelBuilder(18, 13, 12);
  // caisse et couvercle bombé
  b.box(0, 0, 0, 17, 7, 10, yellow);
  b.box(0, 8, 0, 17, 10, 10, yellow);
  b.box(0, 11, 1, 17, 11, 9, yellow);
  b.box(0, 12, 3, 17, 12, 7, yellow);
  // socle, joint du couvercle, cerclages
  b.recolor(0, 0, 0, 17, 0, 10, yellowDeep);
  b.recolor(0, 7, 0, 17, 7, 10, yellowDeep);
  for (const x of [3, 14]) b.recolor(x, 0, 0, x, 12, 10, yellowDeep);
  // coins en métal
  for (const x of [0, 17]) for (const z of [0, 10]) b.recolor(x, 0, z, x, 10, z, metal);
  // serrure : plaque, voyant lumineux
  b.box(7, 4, 11, 10, 9, 11, metal);
  b.box(8, 5, 11, 9, 6, 11, glow);
  b.box(7, 9, 11, 10, 9, 11, light);
  // poignées sur les côtés
  for (const x of [0, 17]) b.recolor(x, 5, 4, x, 5, 6, dark);
  return b;
}

/** Grenade : 12 × 15 × 12 voxels de 2 cm (corps de 24 cm de diamètre). */
export function grenade(): VoxelBuilder {
  const b = new VoxelBuilder(12, 15, 12);
  const c = 5.5;
  for (let x = 0; x < 12; x++)
    for (let y = 0; y < 12; y++)
      for (let z = 0; z < 12; z++) {
        const d = Math.hypot(x - c, y - c, z - c);
        if (d > 5.9) continue;
        // sillons en quadrillage, plus foncés
        const groove = (x === 4 || x === 7 || z === 4 || z === 7 || y === 4 || y === 7) && d > 4.6;
        b.set(x, y, z, groove ? orangeDeep : orange);
      }
  // bouchon, levier et anneau
  b.box(4, 11, 4, 7, 12, 7, metal);
  b.box(5, 13, 5, 6, 13, 6, light);
  b.box(8, 9, 5, 8, 12, 6, dark);
  b.box(3, 13, 5, 3, 14, 6, glow).box(2, 14, 5, 2, 14, 6, glow);
  return b;
}

export const PROPS: Record<string, () => VoxelBuilder> = { chest, grenade };
