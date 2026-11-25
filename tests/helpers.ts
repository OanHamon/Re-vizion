// Chargement des vrais fichiers config/ et decks/ pour les tests.
import quiz from '../config/quiz.json';
import bonuses from '../config/bonuses.json';
import weapons from '../config/weapons.json';
import player from '../config/player.json';
import modes from '../config/modes.json';
import arenas from '../config/arenas.json';
import assets from '../config/assets.json';
import stats from '../config/stats.json';
import sounds from '../config/sounds.json';
import economy from '../config/economy.json';
import pickups from '../config/pickups.json';
import materials from '../config/materials.json';
import tcpIpDeck from '../decks/cesi-reseaux-tcp-ip.json';
import { parseGameConfig, type GameConfig, type RawGameConfig } from '../src/core/config/gameConfig';
import { validateDeck, type Deck } from '../src/core/deck/validateDeck';
import { getVoxel, type VoxelModel } from '../src/core/voxel/voxelModel';

/** Copie profonde des fichiers bruts, que chaque test peut modifier sans gêner les autres. */
export function rawConfig(): RawGameConfig {
  return structuredClone({ quiz, bonuses, weapons, player, modes, arenas, assets, stats, sounds, economy, pickups, materials }) as RawGameConfig;
}

export function rawDeck(): Record<string, unknown> {
  return structuredClone(tcpIpDeck) as Record<string, unknown>;
}

export function loadConfig(): GameConfig {
  const result = parseGameConfig(rawConfig());
  if (!result.ok) throw new Error(result.errors.join('\n'));
  return result.config;
}

export function loadDeck(): Deck {
  const result = validateDeck(rawDeck(), 'cesi-reseaux-tcp-ip.json');
  if (!result.ok) throw new Error(result.errors.join('\n'));
  return result.deck;
}

/** Nombre de voxels reliés au premier voxel trouvé (voisinage par faces). */
export function connectedCount(m: VoxelModel): { connected: number; total: number } {
  const seen = new Uint8Array(m.data.length);
  const index = (x: number, y: number, z: number) => x + m.sx * (y + m.sy * z);
  let total = 0;
  let start: [number, number, number] | null = null;
  for (let z = 0; z < m.sz; z++)
    for (let y = 0; y < m.sy; y++)
      for (let x = 0; x < m.sx; x++)
        if (getVoxel(m, x, y, z)) {
          total++;
          start ??= [x, y, z];
        }
  if (!start) return { connected: 0, total };
  const stack = [start];
  seen[index(...start)] = 1;
  let connected = 0;
  while (stack.length) {
    const [x, y, z] = stack.pop()!;
    connected++;
    for (const [dx, dy, dz] of [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]] as const) {
      const nx = x + dx, ny = y + dy, nz = z + dz;
      if (getVoxel(m, nx, ny, nz) && !seen[index(nx, ny, nz)]) {
        seen[index(nx, ny, nz)] = 1;
        stack.push([nx, ny, nz]);
      }
    }
  }
  return { connected, total };
}
