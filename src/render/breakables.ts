// Rendu des éléments cassables du décor (lot 15).
// - Cartes voxel : les voxels cassables sont dans un modèle à part (arena.breakableDecor). Chaque voxel est rattaché
//   au morceau (core/combat/destruction) le plus proche de son élément ; chaque élément est maillé à part et
//   remaillé quand un de ses morceaux tombe (petits modèles, remaillage instantané).
// - Arènes en blocs simples : un pavé par morceau, à la couleur --scene-block-N de l'élément.
// Ne contient aucune règle : quels morceaux existent encore, c'est CombatSession.breakables qui le dit.
import * as THREE from 'three';
import type { GameConfig } from '../core/config/gameConfig';
import { distanceToBox, type BreakCell, type Destructibles } from '../core/combat/destruction';
import type { Arena } from '../core/config/schemas';
import { meshVoxels } from '../core/voxel/mesher';
import { createVoxelModel, setVoxel, type VoxelModel } from '../core/voxel/voxelModel';
import { loadVoxModel, meshGeometry } from './assets';
import type { SceneColors } from './arena';

/** Un voxel d'un élément : position dans le modèle, couleur, morceau. */
interface ElementVoxel {
  x: number;
  y: number;
  z: number;
  color: number;
  cell: number;
}

interface ElementView {
  cells: BreakCell[];
  voxels: ElementVoxel[];
  object: THREE.Object3D | null;
}

/** Marge (m) autour d'un élément pour y rattacher les voxels de décor posés dessus (fleurs d'un muret…). */
const ATTACH_MARGIN = 0.3;

/** Couleur des éclats d'un matériau (--material-<id> du thème), ou celle des murs. */
export function materialColor(id: string, colors: SceneColors): string {
  return getComputedStyle(document.documentElement).getPropertyValue(`--material-${id}`).trim() || colors.wall;
}

export class BreakablesView {
  readonly group = new THREE.Group();
  private readonly elements: ElementView[] = [];
  private readonly boxes = new Map<number, THREE.Mesh>();
  private model: VoxelModel | null = null;
  private glowColors = new Set<number>();
  private unit = 1;
  private grip: readonly number[] = [0, 0, 0];
  private readonly solidMaterial = new THREE.MeshLambertMaterial({ vertexColors: true });
  private readonly glowMaterial = new THREE.MeshBasicMaterial({ vertexColors: true, toneMapped: false });

  constructor(
    private readonly arena: Arena,
    private readonly breakables: Destructibles,
    private readonly colors: SceneColors,
  ) {
    for (const c of breakables.cells) (this.elements[c.element] ??= { cells: [], voxels: [], object: null }).cells.push(c);
  }

  async load(config: GameConfig): Promise<void> {
    const id = this.arena.breakableDecor;
    const def = id ? config.assets.assets[id] : undefined;
    if (!def?.voxel) {
      this.buildBoxes();
      return;
    }
    this.model = await loadVoxModel(def.voxel.path);
    this.glowColors = new Set(def.voxel.glow.map((hex) => parseInt(hex.slice(1), 16)));
    this.unit = def.voxel.voxelSize * def.scale;
    this.grip = def.grip;
    this.attachVoxels(this.model);
    this.elements.forEach((_, i) => this.rebuild(i));
  }

  /** Morceaux détruits (déjà retirés de la logique) : disparaissent du rendu. */
  removeCells(cells: readonly BreakCell[]): void {
    const dirty = new Set<number>();
    for (const c of cells) {
      const box = this.boxes.get(c.id);
      if (box) {
        this.group.remove(box);
        box.geometry.dispose();
        this.boxes.delete(c.id);
      }
      dirty.add(c.element);
    }
    if (this.model) for (const i of dirty) this.rebuild(i);
  }

  // ---------- arènes en blocs ----------

  private buildBoxes(): void {
    const materials = new Map<number, THREE.MeshLambertMaterial>();
    for (const c of this.breakables.cells) {
      if (!c.alive) continue;
      const colorIndex = this.arena.breakables?.[c.element]?.color ?? 1;
      let material = materials.get(colorIndex);
      if (!material) materials.set(colorIndex, (material = new THREE.MeshLambertMaterial({ color: this.colors.blocks[(colorIndex - 1) % this.colors.blocks.length] })));
      const size = new THREE.Vector3().subVectors(c.box.max as THREE.Vector3Like, c.box.min as THREE.Vector3Like);
      const mesh = new THREE.Mesh(new THREE.BoxGeometry(size.x, size.y, size.z), material);
      mesh.position.set((c.box.min.x + c.box.max.x) / 2, (c.box.min.y + c.box.max.y) / 2, (c.box.min.z + c.box.max.z) / 2);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      this.group.add(mesh);
      this.boxes.set(c.id, mesh);
    }
  }

  // ---------- cartes voxel ----------

  /** Rattache chaque voxel cassable à un élément (boîte élargie) puis au morceau le plus proche de cet élément. */
  private attachVoxels(m: VoxelModel): void {
    const u = this.unit;
    const [gx, gy, gz] = this.grip as [number, number, number];
    const bounds = this.elements.map((e) => {
      const min = { x: Infinity, y: Infinity, z: Infinity };
      const max = { x: -Infinity, y: -Infinity, z: -Infinity };
      for (const c of e.cells) {
        for (const k of ['x', 'y', 'z'] as const) {
          min[k] = Math.min(min[k], c.box.min[k] - ATTACH_MARGIN);
          max[k] = Math.max(max[k], c.box.max[k] + ATTACH_MARGIN);
        }
      }
      return { min, max };
    });
    const p = { x: 0, y: 0, z: 0 };
    for (let z = 0; z < m.sz; z++)
      for (let y = 0; y < m.sy; y++)
        for (let x = 0; x < m.sx; x++) {
          const color = m.data[x + m.sx * (y + m.sy * z)]!;
          if (color === 0) continue;
          p.x = (x + 0.5 - gx) * u;
          p.y = (y + 0.5 - gy) * u;
          p.z = (z + 0.5 - gz) * u;
          const i = bounds.findIndex((b) => p.x >= b.min.x && p.x <= b.max.x && p.y >= b.min.y && p.y <= b.max.y && p.z >= b.min.z && p.z <= b.max.z);
          if (i < 0) continue;
          const e = this.elements[i]!;
          let cell = e.cells[0]!;
          let best = Infinity;
          for (const c of e.cells) {
            const d = distanceToBox(p, c.box);
            if (d < best) {
              best = d;
              cell = c;
            }
          }
          e.voxels.push({ x, y, z, color, cell: cell.id });
        }
  }

  /** (Re)maille un élément avec les voxels de ses morceaux encore en place. */
  private rebuild(index: number): void {
    const e = this.elements[index]!;
    if (e.object) {
      this.group.remove(e.object);
      e.object.traverse((o) => {
        if (o instanceof THREE.Mesh) o.geometry.dispose();
      });
      e.object = null;
    }
    const alive = new Set(e.cells.filter((c) => c.alive).map((c) => c.id));
    const voxels = e.voxels.filter((v) => alive.has(v.cell));
    if (voxels.length === 0 || !this.model) return;
    const lo = { x: Math.min(...voxels.map((v) => v.x)), y: Math.min(...voxels.map((v) => v.y)), z: Math.min(...voxels.map((v) => v.z)) };
    const hi = { x: Math.max(...voxels.map((v) => v.x)), y: Math.max(...voxels.map((v) => v.y)), z: Math.max(...voxels.map((v) => v.z)) };
    const crop: VoxelModel = { ...createVoxelModel(hi.x - lo.x + 1, hi.y - lo.y + 1, hi.z - lo.z + 1), palette: this.model.palette };
    for (const v of voxels) setVoxel(crop, v.x - lo.x, v.y - lo.y, v.z - lo.z, v.color);
    const { solid, glow } = meshVoxels(crop, { glowColors: this.glowColors });
    const object = new THREE.Group();
    for (const [data, material, shadows] of [[solid, this.solidMaterial, true], [glow, this.glowMaterial, false]] as const) {
      if (data.indices.length === 0) continue;
      const mesh = new THREE.Mesh(meshGeometry(data), material);
      mesh.castShadow = shadows;
      mesh.receiveShadow = shadows;
      object.add(mesh);
    }
    const u = this.unit;
    object.scale.setScalar(u);
    object.position.set((lo.x - this.grip[0]!) * u, (lo.y - this.grip[1]!) * u, (lo.z - this.grip[2]!) * u);
    this.group.add(object);
    e.object = object;
  }
}
