// Scène 3D de l'armurerie : l'arme tourne sur un socle, ou se voit à la première personne
// dans l'arène d'entraînement (config/arenas.json). Pas de déplacement ni de tir ici.
import * as THREE from 'three';
import type { Arena } from '../core/config/schemas';
import { buildArena, type SceneColors } from './arena';
import { disposeObject, type LoadedAsset } from './assets';
import { orientForCamera, VIEWMODEL_OFFSET } from './viewmodel';

export type ArmoryView = 'turntable' | 'fps';

export interface ArmoryOptions {
  /** Pas de rotation automatique ni de balancement si l'utilisateur réduit les animations. */
  reducedMotion: boolean;
  /** Arène affichée en vue à la première personne, et hauteur des yeux du joueur. */
  arena: Arena;
  eyeHeight: number;
}

const PEDESTAL_TOP = 0.09;
const ROTATION_SPEED = 0.35; // rad/s
/** Part de la largeur de l'écran occupée par l'arme vue de profil. */
const FRAME_WIDTH_SHARE = 0.62;

export class ArmoryScene {
  private readonly renderer: THREE.WebGLRenderer;
  private readonly scene = new THREE.Scene();
  private readonly camera = new THREE.PerspectiveCamera(35, 1, 0.01, 100);
  private readonly turntable = new THREE.Group();
  private readonly pedestal = new THREE.Group();
  private readonly spinner = new THREE.Group();
  private readonly arena: THREE.Group;
  private readonly viewmodel = new THREE.Group();
  private readonly fpsEye: THREE.Vector3;
  private readonly fpsYaw: number;
  private readonly skyColor: THREE.Color;
  private readonly resizeObserver: ResizeObserver;
  private readonly timer = new THREE.Timer();

  private weapon: LoadedAsset | null = null;
  private view: ArmoryView = 'turntable';
  private yaw = -0.55;
  private dragging = false;
  private lastX = 0;
  private idleSince = 0;
  private look = { x: 0, y: 0, tx: 0, ty: 0 };
  private raf = 0;

  constructor(
    private readonly canvas: HTMLCanvasElement,
    colors: SceneColors,
    private readonly options: ArmoryOptions,
  ) {
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFShadowMap;
    this.renderer.setClearColor(0x000000, 0);
    this.skyColor = new THREE.Color(colors.sky);

    // Lumière douce : ciel clair, sol chaud, un soleil pour les ombres
    this.scene.add(new THREE.HemisphereLight(colors.sky, colors.ground, 2.2));
    const sun = new THREE.DirectionalLight(0xffffff, 1.6);
    sun.position.set(1.8, 4, 2.5);
    sun.castShadow = true;
    sun.shadow.mapSize.set(1024, 1024);
    sun.shadow.camera.left = -2;
    sun.shadow.camera.right = 2;
    sun.shadow.camera.top = 2;
    sun.shadow.camera.bottom = -2;
    sun.shadow.bias = -0.0005;
    this.scene.add(sun);

    // Socle hexagonal (géométrique, comme le reste de la DA), mis à l'échelle de l'arme
    const pedestalMaterial = new THREE.MeshLambertMaterial({ color: colors.pedestal });
    const base = new THREE.Mesh(new THREE.CylinderGeometry(0.92, 1, 0.12, 6), pedestalMaterial);
    base.position.y = 0.06;
    base.receiveShadow = true;
    const top = new THREE.Mesh(new THREE.CylinderGeometry(0.74, 0.74, 0.06, 6), pedestalMaterial);
    top.position.y = 0.15;
    top.receiveShadow = true;
    this.pedestal.add(base, top);
    this.turntable.add(this.pedestal, this.spinner);
    this.scene.add(this.turntable);

    // Arène en blocs, vue depuis le point d'apparition
    this.arena = buildArena(options.arena, colors);
    this.scene.add(this.arena);
    const [sx, sy, sz] = options.arena.spawns[0]!.position;
    this.fpsEye = new THREE.Vector3(sx, sy + options.eyeHeight, sz);
    this.fpsYaw = THREE.MathUtils.degToRad(options.arena.spawns[0]!.yawDeg);
    this.camera.add(this.viewmodel);
    this.viewmodel.position.copy(VIEWMODEL_OFFSET);
    this.scene.add(this.camera);

    canvas.addEventListener('pointerdown', this.onPointerDown);
    window.addEventListener('pointermove', this.onPointerMove);
    window.addEventListener('pointerup', this.onPointerUp);
    this.resizeObserver = new ResizeObserver(() => this.resize());
    this.resizeObserver.observe(canvas);

    this.setView('turntable');
    this.resize();
    this.raf = requestAnimationFrame(this.frame);
  }

  setWeapon(asset: LoadedAsset): void {
    if (this.weapon) {
      this.weapon.object.removeFromParent();
      disposeObject(this.weapon.object);
    }
    this.weapon = asset;
    this.mountWeapon();
  }

  setView(view: ArmoryView): void {
    this.view = view;
    const fps = view === 'fps';
    this.turntable.visible = !fps;
    this.arena.visible = fps;
    this.scene.background = fps ? this.skyColor : null;
    this.scene.fog = fps ? new THREE.Fog(this.skyColor, 12, 30) : null;
    this.camera.fov = fps ? 70 : 35;
    this.camera.updateProjectionMatrix();
    this.mountWeapon();
  }

  dispose(): void {
    cancelAnimationFrame(this.raf);
    this.resizeObserver.disconnect();
    this.canvas.removeEventListener('pointerdown', this.onPointerDown);
    window.removeEventListener('pointermove', this.onPointerMove);
    window.removeEventListener('pointerup', this.onPointerUp);
    disposeObject(this.scene);
    this.renderer.dispose();
  }

  // ---------- interne ----------

  /** Place l'arme selon la vue : centrée sur le socle, ou tenue en bas à droite de l'écran. */
  private mountWeapon(): void {
    const weapon = this.weapon;
    if (!weapon) return;
    const object = weapon.object;
    object.removeFromParent();
    object.position.set(0, 0, 0);

    if (this.view === 'turntable') {
      this.spinner.add(object);
      this.frameTurntable();
    } else {
      // le canon (axe +x du modèle) pointe vers l'avant de la caméra (−z)
      this.viewmodel.add(object);
      orientForCamera(object);
      this.camera.position.copy(this.fpsEye);
      this.camera.rotation.set(0, this.fpsYaw, 0, 'YXZ');
    }
  }

  /**
   * Cadrage automatique : l'arme, centrée sur l'axe de rotation, flotte au-dessus d'un socle
   * à sa taille ; la caméra recule pour qu'elle occupe une part fixe de la largeur, et la
   * composition est remontée pour laisser la place à la barre du bas.
   */
  private frameTurntable(): void {
    const object = this.weapon?.object;
    if (!object || object.parent !== this.spinner) return;
    const yaw = this.spinner.rotation.y;
    this.spinner.rotation.y = 0;
    this.spinner.position.set(0, 0, 0);
    object.position.set(0, 0, 0);
    this.spinner.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(object);
    const center = box.getCenter(new THREE.Vector3());
    const size = box.getSize(new THREE.Vector3());
    object.position.copy(center).negate();
    this.spinner.rotation.y = yaw;

    const length = Math.max(size.x, size.z, 0.25);
    const pedestalScale = THREE.MathUtils.clamp(length * 0.3, 0.13, 0.26);
    this.pedestal.scale.setScalar(pedestalScale);
    const weaponY = PEDESTAL_TOP * pedestalScale * 2 + 0.06 + size.y / 2;
    this.spinner.position.y = weaponY;

    const vHalf = THREE.MathUtils.degToRad(this.camera.fov / 2);
    const hHalf = Math.atan(Math.tan(vHalf) * this.camera.aspect);
    const top = weaponY + size.y / 2;
    const distance = Math.max(length / 2 / (Math.tan(hHalf) * FRAME_WIDTH_SHARE), top / 2 / (Math.tan(vHalf) * 0.45));
    const target = top * 0.32;
    this.camera.position.set(0, target + distance * 0.2, distance);
    this.camera.lookAt(0, target, 0);
  }

  private resize(): void {
    const { clientWidth: w, clientHeight: h } = this.canvas;
    if (w === 0 || h === 0) return;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    if (this.view === 'turntable') this.frameTurntable();
  }

  private readonly frame = (time: number): void => {
    this.raf = requestAnimationFrame(this.frame);
    this.timer.update(time);
    const dt = Math.min(this.timer.getDelta(), 0.1);
    const t = this.timer.getElapsed();

    if (this.view === 'turntable') {
      const idle = !this.dragging && t - this.idleSince > 1.2;
      if (idle && !this.options.reducedMotion) this.yaw += ROTATION_SPEED * dt;
      this.spinner.rotation.y = this.yaw;
    } else {
      // regard qui suit doucement la souris, léger balancement de l'arme
      this.look.x += (this.look.tx - this.look.x) * Math.min(1, dt * 6);
      this.look.y += (this.look.ty - this.look.y) * Math.min(1, dt * 6);
      this.camera.rotation.set(-this.look.y * 0.25, this.fpsYaw - this.look.x * 0.45, 0, 'YXZ');
      const sway = this.options.reducedMotion ? 0 : Math.sin(t * 1.7) * 0.004;
      this.viewmodel.position.set(VIEWMODEL_OFFSET.x, VIEWMODEL_OFFSET.y + sway, VIEWMODEL_OFFSET.z);
    }
    this.renderer.render(this.scene, this.camera);
  };

  private readonly onPointerDown = (event: PointerEvent): void => {
    if (this.view !== 'turntable') return;
    this.dragging = true;
    this.lastX = event.clientX;
    this.canvas.setPointerCapture(event.pointerId);
  };

  private readonly onPointerMove = (event: PointerEvent): void => {
    if (this.view === 'turntable') {
      if (!this.dragging) return;
      this.yaw += (event.clientX - this.lastX) * 0.01;
      this.lastX = event.clientX;
    } else {
      const rect = this.canvas.getBoundingClientRect();
      this.look.tx = ((event.clientX - rect.left) / rect.width) * 2 - 1;
      this.look.ty = ((event.clientY - rect.top) / rect.height) * 2 - 1;
    }
  };

  private readonly onPointerUp = (): void => {
    if (!this.dragging) return;
    this.dragging = false;
    this.idleSince = this.timer.getElapsed();
  };
}
