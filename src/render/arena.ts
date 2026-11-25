// Construction de l'arène 3D à partir de config/arenas.json : sol, murs d'enceinte et blocs,
// ou décor voxel de la carte (config/assets.json) ; ambiance (ciel, brouillard, lumières) propre à chaque carte.
import * as THREE from 'three';
import type { GameConfig } from '../core/config/gameConfig';
import type { Arena } from '../core/config/schemas';
import { loadVoxelScenery } from './assets';

/** Couleurs de la scène, lues dans le thème CSS par l'interface. */
export interface SceneColors {
  sky: string;
  /** Couleur du brouillard (celle du ciel par défaut). */
  fog: string;
  ground: string;
  floor: string;
  wall: string;
  pedestal: string;
  blocks: string[];
  target: string;
  targetHead: string;
  tracer: string;
  laser: string;
  flash: string;
  /** Explosion de grenade (famille Attaque) et halo des coffres (famille Arme). */
  blast: string;
  blastDeep: string;
  /** Explosion (lot 18) : cœur, flamme chaude, fumée claire et foncée, trace brûlée, étincelles. */
  blastCore: string;
  blastHot: string;
  blastSmoke: string;
  blastSmokeDark: string;
  blastScorch: string;
  blastSpark: string;
  chest: string;
  /** Couleurs des joueurs, dans l'ordre (--player-1, --player-2, …). */
  players: string[];
}

/** Toutes les variables --player-N définies dans le thème. */
function playerColors(v: (name: string) => string): string[] {
  const out: string[] = [];
  for (let i = 1; v(`--player-${i}`); i++) out.push(v(`--player-${i}`));
  return out.length > 0 ? out : ['#8fb3f2'];
}

/**
 * Lit les couleurs de la scène dans les variables CSS du thème.
 * Avec l'ambiance d'une carte, ciel, brouillard et sol viennent de --map-<theme>-sky, -fog et -ground.
 */
export function readSceneColors(theme?: string): SceneColors {
  const css = getComputedStyle(document.documentElement);
  const v = (name: string) => css.getPropertyValue(name).trim();
  const map = (part: string, fallback: string) => (theme ? v(`--map-${theme}-${part}`) : '') || v(fallback);
  return {
    sky: map('sky', '--scene-sky'),
    fog: map('fog', '--scene-sky'),
    ground: map('ground', '--scene-ground'),
    floor: v('--scene-floor'),
    wall: v('--scene-wall'),
    pedestal: v('--scene-pedestal'),
    blocks: [1, 2, 3, 4].map((i) => v(`--scene-block-${i}`)),
    target: v('--scene-target'),
    targetHead: v('--scene-target-head'),
    tracer: v('--scene-tracer'),
    laser: v('--scene-laser'),
    flash: v('--scene-flash'),
    blast: v('--family-attack'),
    blastDeep: v('--family-attack-deep'),
    blastCore: v('--blast-core'),
    blastHot: v('--blast-hot'),
    blastSmoke: v('--blast-smoke'),
    blastSmokeDark: v('--blast-smoke-dark'),
    blastScorch: v('--blast-scorch'),
    blastSpark: v('--blast-spark'),
    chest: v('--family-weapon-deep'),
    players: playerColors(v),
  };
}

/** Réglages de lumière par défaut (arènes sans ambiance propre). */
const DEFAULT_LOOK = { sun: 1.5, hemisphere: 2.1, shadows: true, fogNear: 35, fogFar: 70 };

/**
 * Ciel, brouillard et lumières de la carte. Renvoie le soleil, dont l'ombre couvre la zone de jeu.
 */
export function addLighting(scene: THREE.Scene, arena: Arena, colors: SceneColors): THREE.DirectionalLight {
  const look = arena.look ?? DEFAULT_LOOK;
  scene.background = new THREE.Color(colors.sky);
  scene.fog = new THREE.Fog(new THREE.Color(colors.fog), look.fogNear, look.fogFar);
  scene.add(new THREE.HemisphereLight(colors.sky, colors.ground, look.hemisphere));
  const sun = new THREE.DirectionalLight(0xffffff, look.sun);
  const [w, d] = arena.size;
  const reach = Math.max(w, d) * 0.7;
  sun.position.set(reach * 0.4, reach, reach * 0.3);
  sun.castShadow = look.shadows;
  sun.shadow.mapSize.set(2048, 2048);
  Object.assign(sun.shadow.camera, { left: -reach, right: reach, top: reach, bottom: -reach, near: 1, far: reach * 3 });
  sun.shadow.bias = -0.0008;
  sun.shadow.normalBias = 0.02;
  scene.add(sun);
  return sun;
}

/** Décor voxel de la carte (partagé et mis en cache : à ajouter tel quel, une copie est renvoyée). */
export async function loadArenaDecor(arena: Arena, config: GameConfig): Promise<THREE.Object3D | null> {
  if (!arena.decor) return null;
  const def = config.assets.assets[arena.decor];
  if (!def) throw new Error(`Décor inconnu : ${arena.decor}`);
  return (await loadVoxelScenery(arena.decor, def)).clone();
}

/** Sol, murs et blocs dessinés en formes simples ; rien si la carte a un décor voxel (il est chargé à part). */
export function buildArena(arena: Arena, colors: SceneColors): THREE.Group {
  const group = new THREE.Group();
  group.name = `arena:${arena.id}`;
  if (arena.decor) return group;
  const [w, d] = arena.size;

  const floor = new THREE.Mesh(new THREE.PlaneGeometry(w, d), new THREE.MeshLambertMaterial({ color: colors.floor }));
  floor.rotation.x = -Math.PI / 2;
  floor.receiveShadow = true;
  group.add(floor);

  // murs d'enceinte (épaisseur décorative, la collision est gérée par la logique)
  const wallMaterial = new THREE.MeshLambertMaterial({ color: colors.wall });
  const t = 0.5;
  const h = arena.wallHeight;
  for (const [x, z, sx, sz] of [
    [0, -d / 2 - t / 2, w + 2 * t, t],
    [0, d / 2 + t / 2, w + 2 * t, t],
    [-w / 2 - t / 2, 0, t, d],
    [w / 2 + t / 2, 0, t, d],
  ] as const) {
    const wall = new THREE.Mesh(new THREE.BoxGeometry(sx, h, sz), wallMaterial);
    wall.position.set(x, h / 2, z);
    wall.receiveShadow = true;
    group.add(wall);
  }

  const materials = colors.blocks.map((c) => new THREE.MeshLambertMaterial({ color: c }));
  for (const block of arena.blocks) {
    const [bx, by, bz] = block.position;
    const [bw, bh, bd] = block.size;
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(bw, bh, bd), materials[(block.color - 1) % materials.length]);
    mesh.position.set(bx, by + bh / 2, bz);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    group.add(mesh);
  }
  return group;
}
