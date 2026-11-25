// Arme tenue à la première personne (« viewmodel ») : position dans le repère de la caméra.
import * as THREE from 'three';

/** Position de la main dans le repère de la caméra (en bas à droite de l'écran). */
export const VIEWMODEL_OFFSET = new THREE.Vector3(0.21, -0.2, -0.42);
/** Position de la main en visant, si l'arme n'a pas de point de visée dans le catalogue. */
export const VIEWMODEL_AIM_OFFSET = new THREE.Vector3(0.0, -0.16, -0.36);
/** Distance minimale entre l'œil et la main en visant (mètres). */
const AIM_GRIP_CLEARANCE = 0.14;

/** Rotation de l'arme à la hanche : légèrement tournée vers le centre. */
const HIP_YAW = 0.06;
const HIP_ROLL = 0.02;

/**
 * Oriente un modèle d'arme (canon vers +x) pour qu'il pointe vers l'avant de la caméra (−z).
 * aim = 0 à la hanche, 1 en visant (axe parfaitement droit).
 */
export function orientForCamera(object: THREE.Object3D, aim = 0): void {
  object.rotation.set(0, Math.PI / 2 + HIP_YAW * (1 - aim), HIP_ROLL * (1 - aim));
}

/**
 * Position de la main qui place le point de visée (relatif à la prise en main) exactement
 * sur l'axe de la caméra, donc sous le réticule.
 * Avec une rotation de +90° autour de y, un point (x, y, z) du modèle devient (z, y, −x).
 */
export function aimOffsetFor(sight: THREE.Vector3 | null): THREE.Vector3 {
  if (!sight) return VIEWMODEL_AIM_OFFSET.clone();
  const distance = sight.x + AIM_GRIP_CLEARANCE;
  return new THREE.Vector3(-sight.z, -sight.y, -distance + sight.x);
}
