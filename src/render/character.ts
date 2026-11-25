// Personnage voxel animé (adversaires) : modèle du catalogue à la couleur du joueur,
// arme tenue à deux mains, marche selon la vitesse réelle. Rendu seulement : aucune règle ici.
import * as THREE from 'three';
import type { GameConfig } from '../core/config/gameConfig';
import type { AssetDef } from '../core/config/schemas';
import { loadAsset } from './assets';
import { createPoseState, stepPose, type PoseState } from './characterPose';

/** Main droite dans le repère du bras (en voxels, bras pendant vers −y). */
const HAND_IN_ARM: readonly [number, number, number] = [0, -20, 0.5];

export interface CharacterRig {
  /** Racine à placer dans la scène (pieds à l'origine, regard vers −z). */
  object: THREE.Group;
  /** Matériaux ombrés, pour l'éclair de touche. */
  materials: THREE.MeshLambertMaterial[];
  parts: Map<string, THREE.Group>;
  /** Corps entier : penché, tassé ou couché selon la pose (pivot aux pieds). */
  body: THREE.Group;
  pose: PoseState;
}

/** Modèle du joueur de couleur `color` (index) : les personnages du catalogue sont attribués à tour de rôle. */
export function characterFor(config: GameConfig, color: number): { id: string; def: AssetDef } {
  const { characters } = config.player;
  const id = characters[color % characters.length]!;
  const def = config.assets.assets[id];
  if (!def) throw new Error(`Asset inconnu : ${id}`);
  return { id, def };
}

export async function createCharacter(
  config: GameConfig,
  color: number,
  tint: THREE.ColorRepresentation,
  weapon: { id: string; def: AssetDef } | null,
): Promise<CharacterRig> {
  const { id, def } = characterFor(config, color);
  const character = await loadAsset(id, def, { tint });
  const object = new THREE.Group();
  const body = new THREE.Group();
  body.add(character.object);
  object.add(body);
  const materials: THREE.MeshLambertMaterial[] = [];
  character.object.traverse((o) => {
    if (o instanceof THREE.Mesh && o.material instanceof THREE.MeshLambertMaterial) materials.push(o.material);
  });

  const armR = character.parts.get('arm_r');
  const armL = character.parts.get('arm_l');
  // ordre YXZ : on lève le bras vers l'avant, puis on le ramène vers le centre
  for (const arm of [armR, armL]) arm?.rotation.set(0, 0, 0, 'YXZ');

  if (weapon) {
    const asset = await loadAsset(weapon.id, weapon.def);
    asset.object.traverse((o) => (o.castShadow = true));
    if (armR) {
      // le canon suit le bras (−y), le dessus de l'arme regarde vers l'avant du personnage (+z) ;
      // l'échelle compense celle des voxels du personnage
      const holder = new THREE.Group();
      holder.matrixAutoUpdate = false;
      holder.matrix
        .makeBasis(new THREE.Vector3(0, -1, 0), new THREE.Vector3(0, 0, 1), new THREE.Vector3(-1, 0, 0))
        .scale(new THREE.Vector3().setScalar(1 / character.unit))
        .setPosition(...HAND_IN_ARM);
      holder.add(asset.object);
      armR.add(holder);
    } else {
      // personnage sans bras animé : arme posée devant la hanche droite
      const { radius, height, headHeight } = config.player.body;
      asset.object.rotation.set(0, Math.PI / 2, 0);
      asset.object.position.set(radius * 0.9, (height - headHeight) * 0.78, -radius * 0.7);
      object.add(asset.object);
    }
  }
  const rig: CharacterRig = { object, materials, parts: character.parts, body, pose: createPoseState() };
  return rig;
}

/** Applique la pose de l'image (voir characterPose.ts). Renvoie false quand le personnage doit être caché. */
export function animateCharacter(
  rig: CharacterRig,
  state: { position: { x: number; y: number; z: number }; yaw: number; alive: boolean },
  dt: number,
): boolean {
  const pose = stepPose(rig.pose, state, dt);
  const part = (name: string) => rig.parts.get(name);
  part('leg_r')?.rotation.set(pose.legR.x, 0, pose.legR.z);
  part('leg_l')?.rotation.set(pose.legL.x, 0, pose.legL.z);
  part('arm_r')?.rotation.set(pose.armR.pitch, pose.armR.yaw, 0);
  part('arm_l')?.rotation.set(pose.armL.pitch, pose.armL.yaw, 0);
  part('head')?.rotation.set(pose.head.x, pose.head.y, pose.head.z);
  rig.body.position.y = pose.body.y;
  rig.body.rotation.set(pose.body.pitch, 0, pose.body.roll);
  return pose.visible;
}
