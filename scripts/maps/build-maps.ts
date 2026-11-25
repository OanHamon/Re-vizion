// Génère les cartes en voxel : assets/models/maps/<id>.vox (décor) et leurs entrées dans
// config/arenas.json (collisions, apparitions, ambiance) et config/assets.json (catalogue du décor).
// Usage : npm run maps            (toutes les cartes)
//         npm run maps -- city    (une seule)
// Les autres arènes et assets des fichiers de config ne sont pas touchés.
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { countVoxels, writeVox, type VoxelModel } from '../../src/core/voxel/voxelModel.ts';
import type { MapBuilder } from './mapDsl.ts';
import { VPM } from './mapDsl.ts';
import { buildCity } from './city.ts';
import { buildForest } from './forest.ts';
import { buildMine } from './mine.ts';

interface MapDef {
  id: string;
  label: string;
  kind: string;
  tagline: string;
  recommendedPlayers: [number, number];
  /** Hauteur des murs invisibles d'enceinte (les tirs s'y arrêtent). */
  wallHeight: number;
  look: { theme: string; sun: number; hemisphere: number; shadows: boolean; fogNear: number; fogFar: number };
  build: () => MapBuilder;
}

const MAPS: MapDef[] = [
  {
    id: 'city',
    label: 'Quartier',
    kind: 'Ville',
    tagline: 'Place à fontaine, toits-terrasses et passerelles',
    recommendedPlayers: [2, 5],
    wallHeight: 30,
    look: { theme: 'city', sun: 1.6, hemisphere: 2.0, shadows: true, fogNear: 40, fogFar: 85 },
    build: buildCity,
  },
  {
    id: 'forest',
    label: 'Vallon',
    kind: 'Nature',
    tagline: 'Rivière, ponts de bois et ruines sur les collines',
    recommendedPlayers: [2, 5],
    wallHeight: 30,
    look: { theme: 'forest', sun: 1.7, hemisphere: 1.9, shadows: true, fogNear: 38, fogFar: 85 },
    build: buildForest,
  },
  {
    id: 'mine',
    label: 'Mine de cristal',
    kind: 'Souterrain',
    tagline: 'Galeries sur deux niveaux, rails et cristaux',
    recommendedPlayers: [2, 5],
    wallHeight: 12,
    look: { theme: 'mine', sun: 1.1, hemisphere: 1.8, shadows: false, fogNear: 18, fogFar: 55 },
    build: buildMine,
  },
];

/**
 * Vide l'intérieur des volumes pleins (relief, roche) : on garde les voxels à moins de `keep` cases d'une case vide
 * ou du ciel. Le rendu de l'extérieur ne change pas (le dessous et les bords du modèle comptent comme pleins),
 * le fichier est beaucoup plus léger.
 */
function hollow(m: VoxelModel, keep = 3): void {
  const { sx, sy, sz, data } = m;
  const at = (x: number, y: number, z: number) => x + sx * (y + sy * z);
  // distance (en pas de 6 voisins) à la plus proche case vide, plafonnée à keep + 1
  const dist = new Uint8Array(sx * sy * sz).fill(keep + 1);
  let frontier: number[] = [];
  for (let z = 0; z < sz; z++)
    for (let y = 0; y < sy; y++)
      for (let x = 0; x < sx; x++) {
        const i = at(x, y, z);
        if (data[i] === 0) dist[i] = 0;
        else if (y === sy - 1) dist[i] = 1;
        else continue;
        frontier.push(i);
      }
  for (let d = 1; d <= keep && frontier.length > 0; d++) {
    const next: number[] = [];
    for (const i of frontier) {
      const x = i % sx;
      const y = Math.floor(i / sx) % sy;
      const z = Math.floor(i / (sx * sy));
      for (const [dx, dy, dz] of [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]] as const) {
        const nx = x + dx;
        const ny = y + dy;
        const nz = z + dz;
        if (nx < 0 || ny < 0 || nz < 0 || nx >= sx || ny >= sy || nz >= sz) continue;
        const j = at(nx, ny, nz);
        if (data[j] !== 0 && dist[j]! > d) {
          dist[j] = d;
          next.push(j);
        }
      }
    }
    frontier = next;
  }
  for (let i = 0; i < data.length; i++) if (data[i] !== 0 && dist[i]! > keep) data[i] = 0;
}

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const only = process.argv.slice(2);

/**
 * JSON lisible, dans le style des fichiers écrits à la main : les tableaux de nombres restent sur une ligne ;
 * avec `inlineObjects`, les petits objets plats aussi (style de assets.json).
 */
function formatJson(value: unknown, indent = '', inlineObjects = false): string {
  const next = `${indent}  `;
  const flat = (v: unknown) => typeof v !== 'object' || v === null || (Array.isArray(v) && v.every((x) => typeof x !== 'object' || x === null));
  if (Array.isArray(value)) {
    if (value.every((v) => typeof v !== 'object' || v === null)) return `[${value.map((v) => JSON.stringify(v)).join(', ')}]`;
    return `[\n${value.map((v) => next + formatJson(v, next, inlineObjects)).join(',\n')}\n${indent}]`;
  }
  if (value !== null && typeof value === 'object') {
    const entries = Object.entries(value).filter(([, v]) => v !== undefined);
    if (entries.length === 0) return '{}';
    // les objets dans des objets (ex. « parts ») sont écrits sur une ligne s'ils sont plats et courts
    if (inlineObjects && indent.length >= 8 && entries.every(([, v]) => Array.isArray(v) && flat(v))) {
      return `{ ${entries.map(([k, v]) => `${JSON.stringify(k)}: ${formatJson(v)}`).join(', ')} }`;
    }
    return `{\n${entries.map(([k, v]) => `${next}${JSON.stringify(k)}: ${formatJson(v, next, inlineObjects)}`).join(',\n')}\n${indent}}`;
  }
  return JSON.stringify(value);
}

const arenasPath = join(root, 'config', 'arenas.json');
const assetsPath = join(root, 'config', 'assets.json');
const arenasFile = JSON.parse(readFileSync(arenasPath, 'utf8')) as { arenas: Record<string, unknown>[] };
const assetsFile = JSON.parse(readFileSync(assetsPath, 'utf8')) as { assets: Record<string, unknown> };
const outDir = join(root, 'assets', 'models', 'maps');
mkdirSync(outDir, { recursive: true });

for (const def of MAPS) {
  if (only.length > 0 && !only.includes(def.id)) continue;
  const started = Date.now();
  const m = def.build();
  const { model } = m;
  const full = countVoxels(model);
  hollow(model);
  writeFileSync(join(outDir, `${def.id}.vox`), writeVox(model));
  // décor cassable : même repère que le décor, seulement les voxels des éléments cassables
  writeFileSync(join(outDir, `${def.id}-breakables.vox`), writeVox(m.breakModel));

  const assetId = `map.${def.id}`;
  assetsFile.assets[assetId] = {
    voxel: { path: `models/maps/${def.id}.vox`, voxelSize: 1 / VPM, glow: [...m.glow].sort() },
    scale: 1,
    rotation: [0, 0, 0],
    // le centre de la zone de jeu, au niveau du sol, est l'origine du monde
    grip: [model.sx / 2, m.ground, model.sz / 2],
  };

  const breakablesId = `${assetId}.breakables`;
  assetsFile.assets[breakablesId] = {
    voxel: { path: `models/maps/${def.id}-breakables.vox`, voxelSize: 1 / VPM, glow: [] },
    scale: 1,
    rotation: [0, 0, 0],
    grip: [model.sx / 2, m.ground, model.sz / 2],
  };

  const arena = {
    id: def.id,
    label: def.label,
    size: m.options.play,
    wallHeight: def.wallHeight,
    selectable: true,
    kind: def.kind,
    tagline: def.tagline,
    recommendedPlayers: def.recommendedPlayers,
    decor: assetId,
    look: def.look,
    spawns: m.spawns,
    chests: m.chests,
    breakables: m.breakables,
    breakableDecor: breakablesId,
    targetHealth: 100,
    targetRespawnSeconds: 3,
    blocks: m.blocks,
    targets: [],
  };
  const at = arenasFile.arenas.findIndex((a) => a.id === def.id);
  if (at >= 0) arenasFile.arenas[at] = arena;
  else arenasFile.arenas.push(arena);

  console.log(
    `${def.id.padEnd(8)} ${model.sx}×${model.sy}×${model.sz}   ${countVoxels(model)} voxels (${full} avant évidage)  ${m.blocks.length} collisions  ${m.spawns.length} apparitions  ${m.breakables.length} cassables (${countVoxels(m.breakModel)} voxels)  ${m.glow.size} couleurs lumineuses  (${Date.now() - started} ms)`,
  );
}

// on garde les fins de ligne du fichier d'origine (CRLF sous Windows)
function save(path: string, text: string): void {
  const eol = readFileSync(path, 'utf8').includes('\r\n') ? '\r\n' : '\n';
  writeFileSync(path, `${text}\n`.replace(/\n/g, eol));
}
save(arenasPath, formatJson(arenasFile));
save(assetsPath, formatJson(assetsFile, '', true));
