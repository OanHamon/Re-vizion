// Chargement des assets 3D, toujours via config/assets.json (règle d'architecture n°3).
import * as THREE from 'three';
import type { AssetDef } from '../core/config/schemas';
import { meshVoxels, type MeshData } from '../core/voxel/mesher';
import { readVox, type VoxelModel } from '../core/voxel/voxelModel';
import { BODY_PART, recolorPalette, splitParts } from '../core/voxel/parts';

// URLs des fichiers de assets/ (Vite les copie au build) ; aucun fichier n'est lu ici.
const voxUrls = import.meta.glob('../../assets/**/*.vox', { query: '?url', import: 'default', eager: true }) as Record<string, string>;

const modelCache = new Map<string, Promise<VoxelModel>>();

/** Modèle voxel d'un fichier de assets/ (mis en cache). */
export function loadVoxModel(path: string): Promise<VoxelModel> {
  const cached = modelCache.get(path);
  if (cached) return cached;
  const url = voxUrls[`../../assets/${path}`];
  if (!url) return Promise.reject(new Error(`Fichier introuvable : assets/${path}`));
  const promise = fetch(url)
    .then((r) => {
      if (!r.ok) throw new Error(`Chargement impossible : assets/${path} (${r.status})`);
      return r.arrayBuffer();
    })
    .then(readVox);
  modelCache.set(path, promise);
  return promise;
}

/** Géométrie Three.js d'un maillage voxel. */
export function meshGeometry(data: MeshData): THREE.BufferGeometry {
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(data.positions, 3));
  g.setAttribute('normal', new THREE.BufferAttribute(data.normals, 3));
  g.setAttribute('color', new THREE.BufferAttribute(data.colors, 3));
  g.setIndex(new THREE.BufferAttribute(data.indices, 1));
  g.computeBoundingBox();
  g.computeBoundingSphere();
  return g;
}

export interface LoadedAsset {
  /** Pivot = point de prise en main ; échelle et rotation du catalogue appliquées. */
  object: THREE.Group;
  /** Taille en mètres (boîte englobante, avant rotation). */
  size: THREE.Vector3;
  /** Bout du canon dans le repère de `object` (null si le catalogue ne le donne pas). */
  muzzle: THREE.Vector3 | null;
  /** Point de visée dans le repère de `object` (null si absent du catalogue). */
  sight: THREE.Vector3 | null;
  /** Parties animées (personnages), par nom : chacune pivote autour de son pivot. Vide sinon. */
  parts: Map<string, THREE.Group>;
  /** Taille d'une unité du repère du modèle (un voxel), en mètres. */
  unit: number;
}

export interface LoadOptions {
  /** Couleur du joueur, qui remplace les couleurs « tint » du catalogue (personnages). */
  tint?: THREE.ColorRepresentation;
}

/** Ombre du ton foncé dérivé de la couleur du joueur (rendu seulement). */
const TINT_DARK_SHIFT = -0.1;

function voxelMesh(model: VoxelModel, glowColors: ReadonlySet<number>): THREE.Group {
  const group = new THREE.Group();
  const { solid, glow } = meshVoxels(model, { glowColors });
  const solidMesh = new THREE.Mesh(meshGeometry(solid), new THREE.MeshLambertMaterial({ vertexColors: true }));
  solidMesh.castShadow = true;
  solidMesh.receiveShadow = true;
  group.add(solidMesh);
  if (glow.indices.length > 0) {
    group.add(new THREE.Mesh(meshGeometry(glow), new THREE.MeshBasicMaterial({ vertexColors: true, toneMapped: false })));
  }
  return group;
}

export async function loadAsset(id: string, def: AssetDef, options: LoadOptions = {}): Promise<LoadedAsset> {
  const root = new THREE.Group();
  root.name = id;
  const inner = new THREE.Group();
  root.add(inner);
  const size = new THREE.Vector3();
  const parts = new Map<string, THREE.Group>();
  /** Taille d'une unité du repère du modèle, en mètres. */
  let unit = def.scale;

  if (def.voxel) {
    let model = await loadVoxModel(def.voxel.path);
    const tint = def.voxel.tint ?? [];
    if (options.tint !== undefined && tint.length > 0) {
      const light = new THREE.Color(options.tint);
      const dark = light.clone().offsetHSL(0, 0, TINT_DARK_SHIFT);
      const replace = new Map<number, number>();
      tint.forEach((hex, i) => replace.set(parseInt(hex.slice(1), 16), (i === 0 ? light : dark).getHex()));
      model = recolorPalette(model, replace);
    }
    const glowColors = new Set(def.voxel.glow.map((hex) => parseInt(hex.slice(1), 16)));
    if (def.parts) {
      // chaque partie est rangée sous un pivot ; le tronc reste à la racine
      for (const [name, part] of splitParts(model, def.parts)) {
        const mesh = voxelMesh(part, glowColors);
        if (name === BODY_PART) {
          inner.add(mesh);
          continue;
        }
        const [px, py, pz] = def.parts[name]!.pivot as [number, number, number];
        const pivot = new THREE.Group();
        pivot.name = name;
        pivot.position.set(px, py, pz);
        mesh.position.set(-px, -py, -pz);
        pivot.add(mesh);
        inner.add(pivot);
        parts.set(name, pivot);
      }
    } else {
      inner.add(voxelMesh(model, glowColors));
    }
    const s = def.voxel.voxelSize * def.scale;
    unit = s;
    inner.scale.setScalar(s);
    inner.position.set(-def.grip[0] * s, -def.grip[1] * s, -def.grip[2] * s);
    size.set(model.sx * s, model.sy * s, model.sz * s);
  } else if (def.primitive) {
    const [x, y, z] = def.primitive.size;
    const shapes = {
      box: () => new THREE.BoxGeometry(x, y, z),
      cylinder: () => new THREE.CylinderGeometry(x / 2, x / 2, y, 12),
      sphere: () => new THREE.SphereGeometry(x / 2, 12, 8),
      capsule: () => new THREE.CapsuleGeometry(x / 2, Math.max(0, y - x), 4, 12),
    };
    const mesh = new THREE.Mesh(shapes[def.primitive.shape](), new THREE.MeshLambertMaterial({ color: 0xb8b4bf }));
    mesh.castShadow = true;
    inner.add(mesh);
    inner.scale.setScalar(def.scale);
    inner.position.set(-def.grip[0], -def.grip[1], -def.grip[2]);
    size.set(x, y, z).multiplyScalar(def.scale);
  } else {
    throw new Error(`Asset « ${id} » : les modèles GLB ne sont pas encore pris en charge`);
  }

  const [rx, ry, rz] = def.rotation.map(THREE.MathUtils.degToRad) as [number, number, number];
  root.rotation.set(rx, ry, rz);
  const relative = (p: readonly number[] | undefined) =>
    p ? new THREE.Vector3(p[0]! - def.grip[0], p[1]! - def.grip[1], p[2]! - def.grip[2]).multiplyScalar(unit) : null;
  return { object: root, size, muzzle: relative(def.muzzle), sight: relative(def.sight), parts, unit };
}

/** Taille d'un morceau de décor, en voxels (x et z) : les morceaux hors champ ne sont pas dessinés. */
const CHUNK = 32;
const chunkCache = new Map<string, Promise<THREE.Group>>();

/**
 * Gros modèle voxel (décor d'une carte), maillé par morceaux et mis en cache.
 * Le groupe renvoyé est partagé : l'ajouter avec `.clone()` ; disposeObject ne libère pas ses maillages.
 */
export function loadVoxelScenery(id: string, def: AssetDef): Promise<THREE.Group> {
  const cached = chunkCache.get(id);
  if (cached) return cached;
  if (!def.voxel) return Promise.reject(new Error(`Asset « ${id} » : un décor doit être un modèle voxel`));
  const voxel = def.voxel;
  const promise = loadVoxModel(voxel.path).then((model) => {
    const glowColors = new Set(voxel.glow.map((hex) => parseInt(hex.slice(1), 16)));
    const solidMaterial = new THREE.MeshLambertMaterial({ vertexColors: true });
    const glowMaterial = new THREE.MeshBasicMaterial({ vertexColors: true, toneMapped: false });
    const root = new THREE.Group();
    root.name = id;
    const inner = new THREE.Group();
    root.add(inner);
    for (let z0 = 0; z0 < model.sz; z0 += CHUNK)
      for (let x0 = 0; x0 < model.sx; x0 += CHUNK) {
        const { solid, glow } = meshVoxels(model, { glowColors, closedBelow: true, region: { x0, x1: x0 + CHUNK, z0, z1: z0 + CHUNK } });
        for (const [data, material, shadows] of [[solid, solidMaterial, true], [glow, glowMaterial, false]] as const) {
          if (data.indices.length === 0) continue;
          const mesh = new THREE.Mesh(meshGeometry(data), material);
          mesh.castShadow = shadows;
          mesh.receiveShadow = shadows;
          mesh.userData.shared = true;
          inner.add(mesh);
        }
      }
    const s = voxel.voxelSize * def.scale;
    inner.scale.setScalar(s);
    inner.position.set(-def.grip[0] * s, -def.grip[1] * s, -def.grip[2] * s);
    const [rx, ry, rz] = def.rotation.map(THREE.MathUtils.degToRad) as [number, number, number];
    root.rotation.set(rx, ry, rz);
    return root;
  });
  promise.catch(() => chunkCache.delete(id));
  chunkCache.set(id, promise);
  return promise;
}

/** Libère la mémoire GPU d'un objet chargé (sauf les décors partagés, gardés en cache). */
export function disposeObject(object: THREE.Object3D): void {
  object.traverse((o) => {
    if (o instanceof THREE.Mesh && !o.userData.shared) {
      o.geometry.dispose();
      const materials = Array.isArray(o.material) ? o.material : [o.material];
      for (const m of materials) m.dispose();
    }
  });
}
