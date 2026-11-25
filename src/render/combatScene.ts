// Rendu du combat : arène, cibles, arme tenue en main, effets (flash, traçantes, éclats de voxels,
// laser, secousses). Ne contient aucune règle : tout vient de CombatSession et de ses événements.
// L'option « réduire flashs et secousses » coupe le flash du canon et les secousses de caméra,
// et adoucit les effets de touche.
import * as THREE from 'three';
import type { GameConfig } from '../core/config/gameConfig';
import type { CombatEvent, CombatSession } from '../core/combat/combatSession';
import { grenadePositionAt, type GrenadePath } from '../core/combat/grenade';
import type { BreakCell } from '../core/combat/destruction';
import { BreakablesView, materialColor } from './breakables';
import { ExplosionFx } from './explosionFx';
import type { ChestStatus } from '../core/match/chests';
import { addLighting, buildArena, loadArenaDecor, type SceneColors } from './arena';
import type { AssetDef } from '../core/config/schemas';
import { disposeObject, loadAsset, type LoadedAsset } from './assets';
import { animateCharacter, createCharacter, type CharacterRig } from './character';
import { onHurt, onShot, setAim } from './characterPose';
import { aimOffsetFor, orientForCamera, VIEWMODEL_AIM_OFFSET, VIEWMODEL_OFFSET } from './viewmodel';

export interface CombatSceneOptions {
  reduceEffects: boolean;
}

const BASE_FOV = 75;
/** Au-delà de ce grossissement, l'arme est cachée et l'interface affiche une lunette. */
export const SCOPE_ZOOM = 2;
const DEBRIS_COUNT = 300;
const DEBRIS_SIZE = 0.07;
const DEBRIS_LIFE = 0.65;
const TRACER_LIFE = 0.09;
const FLASH_LIFE = 0.05;
const HIT_FLASH_LIFE = 0.12;
const GRAVITY = 14;
const MUZZLE_LIGHT_INTENSITY = 12;
const MUZZLE_LIGHT_DISTANCE = 7;
// mouvements de tête (rendu seulement, aucun effet sur le jeu)
const HEAD_BOB_FREQUENCY = 1.35;
const HEAD_BOB_HEIGHT = 0.045;
const HEAD_BOB_ROLL = 0.006;
const HEAD_ROLL_PER_SPEED = 0.0045;
const LAND_DIP_PER_SPEED = 0.012;
const LAND_DIP_MAX = 0.14;
const DASH_FOV_BOOST = 8;
/** Vitesse de rattrapage de la caméra après une marche montée (rendu seulement). */
const STEP_SMOOTHING = 14;
// coffres et grenades (rendu seulement)
const CHEST_LOCKED_TINT = 0x9c9aa8;
const CHEST_RING_RADIUS = 0.85;
// explosion : secousse de caméra (rad, m) et à-coup du champ de vision (degrés), qui retombent en ~0,8 s
const BLAST_SHAKE_ROT = 0.07;
const BLAST_SHAKE_POS = 0.14;
const BLAST_SHAKE_DECAY = 1.3;
const BLAST_FOV_PUNCH = 9;
/** Distance (en rayons d'explosion) au-delà de laquelle on ne sent plus rien. */
const BLAST_FELT_RADII = 4;

interface ChestMesh {
  group: THREE.Group;
  ring: THREE.Mesh;
  materials: THREE.Material[];
  status: ChestStatus;
}

interface GrenadeMesh {
  object: THREE.Object3D;
  path: GrenadePath;
  /** Instant du lancer, dans l'horloge de la scène. */
  startedAt: number;
}

interface TargetView {
  group: THREE.Group;
  materials: THREE.MeshLambertMaterial[];
  flash: number;
  /** 1 = debout, 0 = à terre. */
  presence: number;
  /** Personnage voxel animé (adversaires). */
  rig?: CharacterRig;
}

interface Tracer {
  line: THREE.Line;
  life: number;
}

interface Particle {
  pos: THREE.Vector3;
  vel: THREE.Vector3;
  spin: THREE.Vector3;
  life: number;
}

export class CombatScene {
  private readonly renderer: THREE.WebGLRenderer;
  private readonly scene = new THREE.Scene();
  private readonly camera = new THREE.PerspectiveCamera(BASE_FOV, 1, 0.01, 200);
  private readonly viewmodel = new THREE.Group();
  private readonly weapons: (LoadedAsset | null)[] = [];
  private readonly targets: TargetView[] = [];
  /** Adversaires en duel, par id de joueur. */
  private readonly opponents = new Map<string, TargetView>();
  private readonly flash: THREE.Mesh;
  private readonly tracers: Tracer[] = [];
  private readonly debris: THREE.InstancedMesh;
  private readonly particles: Particle[] = [];
  private readonly laser: THREE.Line;
  private readonly resizeObserver: ResizeObserver;
  private readonly colors: SceneColors;
  private readonly tmp = new THREE.Object3D();

  private kick = 0;
  private switchAnim = 0;
  private flashTime = 0;
  private shake = 0;
  private bob = 0;
  private roll = 0;
  private landDip = 0;
  private aimBlend = 0;
  /** Retard de la caméra sur une marche montée (m), résorbé en douceur. */
  private stepLag = 0;
  private lastFeetY: number | null = null;
  private readonly muzzleLight: THREE.PointLight;
  private readonly remoteFlash: THREE.PointLight;
  private remoteFlashTime = 0;
  private debrisCursor = 0;
  /** Horloge de la scène (s), pour les grenades et les halos. */
  private clock = 0;
  private readonly chests: ChestMesh[] = [];
  private readonly grenades = new Map<number, GrenadeMesh>();
  private readonly fx: ExplosionFx;
  /** Secousse d'explosion (0 à 1) et à-coup du champ de vision. */
  private blastShake = 0;
  private fovPunch = 0;
  private grenadeModel: THREE.Object3D | null = null;
  private readonly breakView: BreakablesView;

  constructor(
    private readonly canvas: HTMLCanvasElement,
    colors: SceneColors,
    private readonly session: CombatSession,
    private options: CombatSceneOptions,
  ) {
    this.colors = colors;
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFShadowMap;

    addLighting(this.scene, session.arena, colors);
    this.scene.add(buildArena(session.arena, colors));
    this.buildTargets();
    this.breakView = new BreakablesView(session.arena, session.breakables, colors);
    this.scene.add(this.breakView.group);
    this.fx = new ExplosionFx({
      core: colors.blastCore,
      hot: colors.blastHot,
      fire: colors.blast,
      smoke: colors.blastSmoke,
      smokeDark: colors.blastSmokeDark,
      scorch: colors.blastScorch,
      spark: colors.blastSpark,
      chunk: colors.blastDeep,
    });
    this.scene.add(this.fx.group);

    // arme en main, accrochée à la caméra
    this.camera.add(this.viewmodel);
    this.scene.add(this.camera);

    // flash du canon : petite étoile géométrique
    this.flash = new THREE.Mesh(new THREE.OctahedronGeometry(0.07, 0), new THREE.MeshBasicMaterial({ color: colors.flash, toneMapped: false }));
    this.flash.visible = false;
    this.scene.add(this.flash);
    // lumière du flash : éclaire l'arme et le décor proche pendant un instant
    this.muzzleLight = new THREE.PointLight(colors.flash, 0, MUZZLE_LIGHT_DISTANCE, 2);
    this.scene.add(this.muzzleLight);
    this.remoteFlash = new THREE.PointLight(colors.flash, 0, MUZZLE_LIGHT_DISTANCE, 2);
    this.scene.add(this.remoteFlash);

    // éclats de voxels
    this.debris = new THREE.InstancedMesh(new THREE.BoxGeometry(DEBRIS_SIZE, DEBRIS_SIZE, DEBRIS_SIZE), new THREE.MeshLambertMaterial(), DEBRIS_COUNT);
    this.debris.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    for (let i = 0; i < DEBRIS_COUNT; i++) {
      this.particles.push({ pos: new THREE.Vector3(), vel: new THREE.Vector3(), spin: new THREE.Vector3(), life: 0 });
      this.tmp.scale.setScalar(0);
      this.tmp.updateMatrix();
      this.debris.setMatrixAt(i, this.tmp.matrix);
      this.debris.setColorAt(i, new THREE.Color(colors.wall));
    }
    this.debris.frustumCulled = false;
    this.scene.add(this.debris);

    // viseur laser (bonus)
    this.laser = new THREE.Line(
      new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3()]),
      new THREE.LineBasicMaterial({ color: colors.laser, transparent: true, opacity: 0.85 }),
    );
    this.laser.frustumCulled = false;
    this.laser.visible = false;
    this.scene.add(this.laser);

    this.resizeObserver = new ResizeObserver(() => this.resize());
    this.resizeObserver.observe(canvas);
    this.resize();
  }

  /** Charge les modèles des armes de chaque emplacement (via le catalogue d'assets). */
  /** Décor voxel de la carte (rien pour les arènes en blocs simples). */
  async loadDecor(config: GameConfig): Promise<void> {
    const decor = await loadArenaDecor(this.session.arena, config);
    if (decor) this.scene.add(decor);
  }

  /** Éléments cassables de la carte (voxels ou pavés). */
  async loadBreakables(config: GameConfig): Promise<void> {
    await this.breakView.load(config);
  }

  /** Morceaux du décor détruits (déjà retirés de la logique) : disparaissent dans un nuage d'éclats. */
  breakCells(cells: readonly BreakCell[]): void {
    this.breakView.removeCells(cells);
    const per = this.options.reduceEffects ? 4 : 10;
    for (const c of cells) {
      const center = { x: (c.box.min.x + c.box.max.x) / 2, y: (c.box.min.y + c.box.max.y) / 2, z: (c.box.min.z + c.box.max.z) / 2 };
      this.spawnDebris(center, { x: 0, y: 1, z: 0 }, materialColor(c.material.id, this.colors), per);
    }
  }

  /** Coffres de la carte (positions dans arenas.json, modèle dans config/pickups.json) et modèle de la grenade. */
  async loadPickups(config: GameConfig): Promise<void> {
    const { chests, grenade } = config.pickups;
    const chestDef = config.assets.assets[chests.asset];
    for (const [id, c] of (this.session.arena.chests ?? []).entries()) {
      const group = new THREE.Group();
      group.position.set(...c.position);
      group.rotation.y = THREE.MathUtils.degToRad(c.yawDeg);
      const ring = new THREE.Mesh(
        new THREE.RingGeometry(CHEST_RING_RADIUS * 0.8, CHEST_RING_RADIUS, 32),
        new THREE.MeshBasicMaterial({ color: this.colors.chest, transparent: true, opacity: 0.6, depthWrite: false }),
      );
      ring.rotation.x = -Math.PI / 2;
      ring.position.y = 0.02;
      group.add(ring);
      const view: ChestMesh = { group, ring, materials: [], status: 'ready' };
      if (chestDef) {
        const asset = await loadAsset(chests.asset, chestDef);
        group.add(asset.object);
        asset.object.traverse((o) => {
          if (o instanceof THREE.Mesh) view.materials.push(o.material as THREE.Material);
        });
      }
      this.scene.add(group);
      this.chests[id] = view;
      this.applyChest(view);
    }
    const grenadeDef = config.assets.assets[grenade.asset];
    if (grenadeDef) this.grenadeModel = (await loadAsset(grenade.asset, grenadeDef)).object;
  }

  /** État d'un coffre (donné par le serveur) : halo quand il est libre, grisé quand il est bloqué. */
  setChestStatus(id: number, status: ChestStatus): void {
    const view = this.chests[id];
    if (!view || view.status === status) return;
    view.status = status;
    this.applyChest(view);
  }

  private applyChest(view: ChestMesh): void {
    const locked = view.status === 'locked';
    for (const m of view.materials) {
      if (m instanceof THREE.MeshLambertMaterial || m instanceof THREE.MeshBasicMaterial) m.color.setHex(locked ? CHEST_LOCKED_TINT : 0xffffff);
    }
    view.ring.visible = view.status === 'ready';
  }

  /** Grenade lancée : rejoue la trajectoire calculée par le serveur ; `elapsed` = temps déjà écoulé depuis le lancer. */
  addGrenade(id: number, path: GrenadePath, elapsed: number): void {
    const object = this.grenadeModel ? this.grenadeModel.clone() : new THREE.Mesh(new THREE.SphereGeometry(0.12, 10, 8), new THREE.MeshLambertMaterial({ color: this.colors.blast }));
    object.position.copy(new THREE.Vector3(path.samples[0]!.x, path.samples[0]!.y, path.samples[0]!.z));
    this.scene.add(object);
    this.grenades.set(id, { object, path, startedAt: this.clock - Math.max(0, elapsed) });
  }

  /**
   * Explosion en couches (voir ExplosionFx), secousse et à-coup du champ de vision selon la distance.
   * Renvoie l'intensité ressentie (0 à 1) pour le flash d'écran du HUD (0 avec « réduire flashs et secousses »).
   */
  explode(id: number, point: { x: number; y: number; z: number }, radius: number): number {
    const g = this.grenades.get(id);
    if (g) {
      this.scene.remove(g.object);
      this.grenades.delete(id);
    }
    const reduce = this.options.reduceEffects;
    this.fx.spawn(point, radius, reduce);
    const d = this.camera.position.distanceTo(new THREE.Vector3(point.x, point.y, point.z));
    const felt = Math.max(0, 1 - d / (radius * BLAST_FELT_RADII)) ** 1.5;
    if (reduce) return 0;
    this.blastShake = Math.min(1, this.blastShake + felt);
    this.fovPunch = Math.max(this.fovPunch, felt);
    return felt;
  }

  private updatePickups(dt: number): void {
    this.clock += dt;
    for (const c of this.chests) {
      if (!c?.ring.visible) continue;
      (c.ring.material as THREE.MeshBasicMaterial).opacity = 0.35 + 0.3 * (0.5 + 0.5 * Math.sin(this.clock * 3));
      c.ring.rotation.z = this.clock * 0.6;
    }
    for (const g of this.grenades.values()) {
      const t = this.clock - g.startedAt;
      const p = grenadePositionAt(g.path, t);
      g.object.position.set(p.x, p.y, p.z);
      g.object.rotation.set(t * 7, t * 4, 0);
    }
    this.fx.update(dt);
  }

  async loadWeapons(config: GameConfig): Promise<void> {
    for (const [i, slot] of this.session.slots.entries()) {
      const def = config.assets.assets[slot.assetId];
      if (!def) continue;
      const asset = await loadAsset(slot.assetId, def);
      orientForCamera(asset.object);
      asset.object.traverse((o) => (o.castShadow = false));
      asset.object.visible = false;
      this.viewmodel.add(asset.object);
      this.weapons[i] = asset;
    }
  }

  setOptions(options: CombatSceneOptions): void {
    this.options = options;
  }

  update(dt: number, events: readonly CombatEvent[]): void {
    const s = this.session;
    const reduce = this.options.reduceEffects;
    for (const e of events) this.onEvent(e);

    // --- mouvements de tête : balancement en marchant, inclinaison en pas latéral, à-coup à l'atterrissage
    const vel = s.move.vel;
    const speed = Math.hypot(vel.x, vel.z);
    const walking = s.move.onGround && speed > 0.5;
    if (walking) this.bob += dt * speed * HEAD_BOB_FREQUENCY;
    const motion = reduce ? 0 : 1;
    const bobAmount = motion * Math.min(1, speed / 8) * (walking ? 1 : 0) * (1 - this.aimBlend * 0.8);
    const strafe = vel.x * Math.cos(s.yaw) - vel.z * Math.sin(s.yaw); // vitesse vers la droite
    this.roll += (-strafe * HEAD_ROLL_PER_SPEED * motion - this.roll) * Math.min(1, dt * 8);
    this.landDip *= Math.exp(-dt * 9);

    // une marche montée au sol fait sauter les pieds de 50 cm d'un coup : la caméra suit en douceur
    const feetY = s.move.pos.y;
    if (this.lastFeetY !== null) {
      const rise = feetY - this.lastFeetY;
      if (s.move.onGround && rise > 0.05 && rise <= this.session.config.player.movement.stepHeight + 1e-3) this.stepLag += rise;
    }
    this.lastFeetY = feetY;
    this.stepLag *= Math.exp(-dt * STEP_SMOOTHING);

    // --- caméra : yeux + balancement, regard + recul, grossissement, secousses
    const eye = s.eye;
    // secousse d'explosion : ondulations rapides de plusieurs fréquences (moins hachée qu'un tirage au hasard)
    const bs = reduce ? 0 : this.blastShake * this.blastShake;
    const t = this.clock;
    const wobble = (a: number, b: number) => Math.sin(t * a) * 0.6 + Math.sin(t * b + 1.3) * 0.4;
    this.camera.position.set(
      eye.x + wobble(47, 71) * BLAST_SHAKE_POS * bs,
      eye.y + Math.abs(Math.sin(this.bob)) * HEAD_BOB_HEIGHT * bobAmount - this.landDip - this.stepLag + wobble(53, 89) * BLAST_SHAKE_POS * bs,
      eye.z + wobble(61, 43) * BLAST_SHAKE_POS * bs,
    );
    const shakeRot = reduce ? 0 : this.shake * 0.012;
    this.camera.rotation.set(
      s.viewPitch + (Math.random() - 0.5) * shakeRot + wobble(37, 59) * BLAST_SHAKE_ROT * bs,
      s.yaw + (Math.random() - 0.5) * shakeRot + wobble(41, 67) * BLAST_SHAKE_ROT * bs,
      this.roll + Math.sin(this.bob) * HEAD_BOB_ROLL * bobAmount + wobble(29, 53) * BLAST_SHAKE_ROT * 0.6 * bs,
      'YXZ',
    );
    const fov = BASE_FOV / s.zoom + (s.move.dashTimeLeft > 0 ? DASH_FOV_BOOST * motion : 0);
    this.camera.fov += (fov - this.camera.fov) * Math.min(1, dt * 14);
    // à-coup : le champ de vision s'ouvre d'un coup puis revient
    const punch = reduce ? 0 : this.fovPunch * BLAST_FOV_PUNCH;
    this.camera.fov += punch;
    this.camera.updateProjectionMatrix();
    this.camera.fov -= punch;
    this.shake = Math.max(0, this.shake - dt * 6);
    this.blastShake = Math.max(0, this.blastShake - dt * BLAST_SHAKE_DECAY);
    this.fovPunch *= Math.exp(-dt * 7);

    // --- arme en main : à la hanche, ou guidon pile sous le réticule en visant
    const state = s.weapon.state;
    const scoped = s.zoom >= SCOPE_ZOOM;
    this.aimBlend += ((s.aiming ? 1 : 0) - this.aimBlend) * Math.min(1, dt * 14);
    const active = this.weapons[s.activeSlot] ?? null;
    this.weapons.forEach((w, i) => {
      if (!w) return;
      w.object.visible = i === s.activeSlot && !scoped;
      orientForCamera(w.object, this.aimBlend);
    });
    const dip = Math.sin(state.reloadProgress(s.time) * Math.PI);
    this.viewmodel.position.lerpVectors(VIEWMODEL_OFFSET, active ? aimOffsetFor(active.sight) : VIEWMODEL_AIM_OFFSET, this.aimBlend);
    this.viewmodel.position.x += Math.cos(this.bob) * 0.012 * bobAmount;
    this.viewmodel.position.y += Math.abs(Math.sin(this.bob)) * 0.014 * bobAmount - dip * 0.12 - this.switchAnim * 0.2 - this.landDip * 0.4;
    this.viewmodel.position.z += this.kick * 0.05 * (1 - this.aimBlend * 0.5);
    this.viewmodel.rotation.set(this.kick * 0.14 * (1 - this.aimBlend * 0.6), 0, dip * 0.5);
    this.kick *= Math.exp(-dt * 16);
    this.switchAnim *= Math.exp(-dt * 10);
    this.camera.updateMatrixWorld(true);

    // --- effets : flash et lumière du canon (coupés par l'option d'accessibilité)
    const muzzle = this.muzzleWorld();
    this.flashTime -= dt;
    const flashing = !reduce && this.flashTime > 0 && muzzle !== null;
    this.flash.visible = flashing && !scoped;
    this.muzzleLight.intensity = flashing ? MUZZLE_LIGHT_INTENSITY * (this.flashTime / FLASH_LIFE) : 0;
    if (flashing && muzzle) {
      this.muzzleLight.position.copy(muzzle);
      this.flash.position.copy(muzzle);
      this.flash.rotation.set(Math.random() * 3, Math.random() * 3, 0);
      this.flash.scale.setScalar(1 + Math.random() * 1.2);
    }
    for (const t of this.tracers) {
      t.life -= dt;
      t.line.visible = t.life > 0;
      (t.line.material as THREE.LineBasicMaterial).opacity = Math.max(0, t.life / TRACER_LIFE);
    }
    this.remoteFlashTime -= dt;
    this.remoteFlash.intensity = this.remoteFlashTime > 0 && !reduce ? MUZZLE_LIGHT_INTENSITY : 0;
    this.updatePickups(dt);
    this.updateDebris(dt);
    this.updateLaser(muzzle);
    this.updateTargets(dt);

    this.renderer.render(this.scene, this.camera);
  }

  /** Ajoute le modèle d'un adversaire : personnage voxel à sa couleur, arme dans les mains. */
  async addOpponent(playerId: string, color: number, weapon: { id: string; def: AssetDef } | null): Promise<void> {
    const tint = this.colors.players[color % this.colors.players.length]!;
    const rig = await createCharacter(this.session.config, color, tint, weapon);
    const group = new THREE.Group();
    group.add(rig.object);
    group.visible = false;
    this.scene.add(group);
    this.opponents.set(playerId, { group, materials: rig.materials, flash: 0, presence: 0, rig });
  }

  /** Visée d'un adversaire (reçue du réseau) : bras, arme et tête la suivent. */
  setOpponentAim(playerId: string, pitch: number, aiming: boolean): void {
    const rig = this.opponents.get(playerId)?.rig;
    if (rig) setAim(rig.pose, pitch, aiming);
  }

  /** Un adversaire prend des dégâts (de n'importe qui) : il sursaute. */
  opponentHurt(playerId: string): void {
    const rig = this.opponents.get(playerId)?.rig;
    if (rig) onHurt(rig.pose);
  }

  /** Tirs d'un adversaire : traçantes et lumière depuis son arme. */
  remoteShot(playerId: string, rays: readonly { from: { x: number; y: number; z: number }; to: { x: number; y: number; z: number } }[]): void {
    const view = this.opponents.get(playerId);
    if (!view) return;
    if (view.rig) onShot(view.rig.pose);
    const yaw = view.group.rotation.y;
    const start = view.group.position.clone().add(new THREE.Vector3(Math.cos(yaw) * 0.3, 1.3, -Math.sin(yaw) * 0.3));
    for (const r of rays) this.spawnTracer(start, new THREE.Vector3(r.to.x, r.to.y, r.to.z));
    if (!this.options.reduceEffects) {
      this.remoteFlash.position.copy(start);
      this.remoteFlashTime = FLASH_LIFE * 1.5;
    }
  }

  /** Point au-dessus de la tête d'un adversaire (étiquette de nom), null s'il est invisible. */
  labelAnchor(playerId: string): { x: number; y: number; z: number } | null {
    const view = this.opponents.get(playerId);
    if (!view?.group.visible) return null;
    const p = view.group.position;
    return { x: p.x, y: p.y + this.session.config.player.body.height + 0.35, z: p.z };
  }

  /** Position à l'écran (en pixels CSS, dans le canvas) d'un point du monde ; null s'il est derrière la caméra. */
  project(point: { x: number; y: number; z: number }): { x: number; y: number } | null {
    const v = new THREE.Vector3(point.x, point.y, point.z).project(this.camera);
    if (v.z > 1) return null;
    return { x: ((v.x + 1) / 2) * this.canvas.clientWidth, y: ((1 - v.y) / 2) * this.canvas.clientHeight };
  }

  dispose(): void {
    this.resizeObserver.disconnect();
    disposeObject(this.scene);
    this.renderer.dispose();
  }

  // ---------- interne ----------

  private onEvent(e: CombatEvent): void {
    switch (e.type) {
      case 'shot': {
        const stats = this.session.weapon.state.stats;
        this.kick = Math.min(1.5, this.kick + 0.6 + stats.kickDeg * 0.15);
        this.shake = Math.min(1, this.shake + stats.kickDeg * 0.15);
        this.flashTime = FLASH_LIFE;
        this.camera.updateMatrixWorld(true);
        const from = this.muzzleWorld() ?? new THREE.Vector3(e.rays[0]!.from.x, e.rays[0]!.from.y - 0.1, e.rays[0]!.from.z);
        for (const ray of e.rays) this.spawnTracer(from, new THREE.Vector3(ray.to.x, ray.to.y, ray.to.z));
        break;
      }
      case 'impact': {
        // impact sur un élément cassable : éclats de la couleur de son matériau
        const cell = e.surface === 'block' ? this.session.breakables.cellAt(e.point) : undefined;
        const color = cell ? materialColor(cell.material.id, this.colors) : e.surface === 'target' ? this.colors.target : e.surface === 'floor' ? this.colors.floor : this.colors.wall;
        this.spawnDebris(e.point, e.normal, color, this.options.reduceEffects ? 3 : 6);
        break;
      }
      case 'hit': {
        const hitTarget = this.session.targets[e.targetId];
        const view = hitTarget?.playerId ? this.opponents.get(hitTarget.playerId) : this.targets[e.targetId];
        if (view) {
          view.flash = HIT_FLASH_LIFE;
          if (view.rig) onHurt(view.rig.pose);
        }
        break;
      }
      case 'kill': {
        const target = this.session.targets[e.targetId];
        if (target) {
          const { x, y, z } = target.position;
          const height = this.session.config.player.body.height;
          this.spawnDebris({ x, y: y + height * 0.6, z }, { x: 0, y: 1, z: 0 }, this.colors.target, this.options.reduceEffects ? 8 : 24);
        }
        break;
      }
      case 'land':
        if (!this.options.reduceEffects) this.landDip = Math.min(LAND_DIP_MAX, e.speed * LAND_DIP_PER_SPEED);
        if (e.speed > 9) this.shake = Math.min(1, this.shake + 0.3);
        break;
      case 'switch':
        this.switchAnim = 1;
        break;
    }
  }

  private buildTargets(): void {
    const { radius, height, headHeight } = this.session.config.player.body;
    const bodyH = height - headHeight;
    const headR = radius * 0.6;
    for (const target of this.session.targets) {
      if (target.playerId) continue;
      const bodyMat = new THREE.MeshLambertMaterial({ color: this.colors.target });
      const headMat = new THREE.MeshLambertMaterial({ color: this.colors.targetHead });
      const group = new THREE.Group();
      const body = new THREE.Mesh(new THREE.BoxGeometry(radius * 2, bodyH, radius * 2), bodyMat);
      body.position.y = bodyH / 2;
      const head = new THREE.Mesh(new THREE.BoxGeometry(headR * 2, headHeight, headR * 2), headMat);
      head.position.y = bodyH + headHeight / 2;
      // cible dessinée sur le torse (anneau + point)
      const ring = new THREE.Mesh(new THREE.RingGeometry(radius * 0.32, radius * 0.5, 6), headMat);
      ring.position.set(0, bodyH * 0.62, radius + 0.002);
      const dot = new THREE.Mesh(new THREE.CircleGeometry(radius * 0.16, 6), headMat);
      dot.position.set(0, bodyH * 0.62, radius + 0.002);
      for (const m of [body, head]) {
        m.castShadow = true;
        m.receiveShadow = true;
      }
      group.add(body, head, ring, dot);
      group.rotation.y = target.yaw;
      this.scene.add(group);
      this.targets.push({ group, materials: [bodyMat, headMat], flash: 0, presence: 1 });
    }
  }

  private updateTargets(dt: number): void {
    const reduce = this.options.reduceEffects;
    this.session.targets.forEach((t) => {
      const view = t.playerId ? this.opponents.get(t.playerId) : this.targets[t.id];
      if (!view) return;
      if (t.playerId) view.group.rotation.y = t.yaw;
      view.presence += ((t.alive ? 1 : 0) - view.presence) * Math.min(1, dt * (t.alive ? 8 : 14));
      view.group.visible = view.presence > 0.02;
      view.group.position.set(t.position.x, t.position.y, t.position.z);
      if (view.rig) view.group.visible = animateCharacter(view.rig, t, dt);
      if (!t.playerId) view.group.scale.set(1, Math.max(0.02, view.presence), 1);
      else if (!view.rig) view.group.visible = t.alive;
      view.flash = Math.max(0, view.flash - dt);
      const glow = (view.flash / HIT_FLASH_LIFE) * (reduce ? 0.25 : 0.7);
      for (const m of view.materials) m.emissive.setScalar(glow);
    });
  }

  private muzzleWorld(): THREE.Vector3 | null {
    const w = this.weapons[this.session.activeSlot];
    if (!w?.muzzle) return null;
    return w.object.localToWorld(w.muzzle.clone());
  }

  private spawnTracer(from: THREE.Vector3, to: THREE.Vector3): void {
    let tracer = this.tracers.find((t) => t.life <= 0);
    if (!tracer) {
      const line = new THREE.Line(
        new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3()]),
        new THREE.LineBasicMaterial({ color: this.colors.tracer, transparent: true }),
      );
      line.frustumCulled = false;
      this.scene.add(line);
      tracer = { line, life: 0 };
      this.tracers.push(tracer);
    }
    const pos = tracer.line.geometry.getAttribute('position') as THREE.BufferAttribute;
    pos.setXYZ(0, from.x, from.y, from.z);
    pos.setXYZ(1, to.x, to.y, to.z);
    pos.needsUpdate = true;
    tracer.life = TRACER_LIFE;
    tracer.line.visible = true;
  }

  private spawnDebris(point: { x: number; y: number; z: number }, normal: { x: number; y: number; z: number }, color: string, count: number): void {
    const c = new THREE.Color(color);
    for (let n = 0; n < count; n++) {
      const i = this.debrisCursor;
      this.debrisCursor = (this.debrisCursor + 1) % DEBRIS_COUNT;
      const p = this.particles[i]!;
      p.pos.set(point.x, point.y, point.z);
      p.vel.set(normal.x * 2.5 + (Math.random() - 0.5) * 3, normal.y * 2.5 + Math.random() * 2.5, normal.z * 2.5 + (Math.random() - 0.5) * 3);
      p.spin.set(Math.random() * 10, Math.random() * 10, 0);
      p.life = DEBRIS_LIFE * (0.6 + Math.random() * 0.4);
      this.debris.setColorAt(i, c);
    }
    if (this.debris.instanceColor) this.debris.instanceColor.needsUpdate = true;
  }

  private updateDebris(dt: number): void {
    let any = false;
    this.particles.forEach((p, i) => {
      if (p.life <= 0) return;
      any = true;
      p.life -= dt;
      p.vel.y -= GRAVITY * dt;
      p.pos.addScaledVector(p.vel, dt);
      if (p.pos.y < DEBRIS_SIZE / 2) {
        p.pos.y = DEBRIS_SIZE / 2;
        p.vel.multiplyScalar(0.4);
        p.vel.y = Math.abs(p.vel.y) * 0.3;
      }
      this.tmp.position.copy(p.pos);
      this.tmp.rotation.set(p.spin.x * p.life, p.spin.y * p.life, 0);
      this.tmp.scale.setScalar(Math.max(0, p.life / DEBRIS_LIFE));
      this.tmp.updateMatrix();
      this.debris.setMatrixAt(i, this.tmp.matrix);
    });
    if (any) this.debris.instanceMatrix.needsUpdate = true;
  }

  private updateLaser(muzzle: THREE.Vector3 | null): void {
    const s = this.session;
    const on = s.stats.laserSight && muzzle !== null && s.zoom < SCOPE_ZOOM;
    this.laser.visible = on;
    if (!on || !muzzle) return;
    const target = s.aimPoint();
    const pos = this.laser.geometry.getAttribute('position') as THREE.BufferAttribute;
    pos.setXYZ(0, muzzle.x, muzzle.y, muzzle.z);
    pos.setXYZ(1, target.x, target.y, target.z);
    pos.needsUpdate = true;
  }

  private resize(): void {
    const { clientWidth: w, clientHeight: h } = this.canvas;
    if (w === 0 || h === 0) return;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  }
}
