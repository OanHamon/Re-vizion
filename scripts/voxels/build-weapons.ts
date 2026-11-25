// Génère assets/models/weapons/<id>.vox (weapons.ts), assets/models/characters/<id>.vox (characters.ts)
// et assets/models/props/<id>.vox (props.ts : coffre, grenade).
// Usage : npm run voxels
// Attention : si tu retouches un .vox dans MagicaVoxel, relancer ce script l'écrase.
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { countVoxels, writeVox } from '../../src/core/voxel/voxelModel.ts';
import { WEAPONS } from './weapons.ts';
import { CHARACTERS } from './characters.ts';
import { PROPS } from './props.ts';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const groups = [
  { folder: 'weapons', builders: WEAPONS },
  { folder: 'characters', builders: CHARACTERS },
  { folder: 'props', builders: PROPS },
];

const only = process.argv.slice(2);
for (const { folder, builders } of groups) {
  const outDir = join(root, 'assets', 'models', folder);
  mkdirSync(outDir, { recursive: true });
  for (const [id, build] of Object.entries(builders)) {
    if (only.length > 0 && !only.includes(id)) continue;
    const { model } = build();
    writeFileSync(join(outDir, `${id}.vox`), writeVox(model));
    console.log(`${id.padEnd(14)} ${model.sx}×${model.sy}×${model.sz}  ${countVoxels(model)} voxels  → assets/models/${folder}/${id}.vox`);
  }
}
