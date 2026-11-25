// Aperçu 3D d'une carte (écran de choix de la carte) : vue plongeante qui tourne lentement autour du centre.
// On peut faire glisser pour tourner. Le décor voxel est partagé avec le combat (même cache).
import * as THREE from 'three';
import type { GameConfig } from '../core/config/gameConfig';
import type { Arena } from '../core/config/schemas';
import { addLighting, buildArena, loadArenaDecor, readSceneColors } from './arena';
import { disposeObject } from './assets';
import { Destructibles } from '../core/combat/destruction';
import { worldFromArena } from '../core/combat/geometry';
import { BreakablesView } from './breakables';

export interface MapPreviewOptions {
  /** Pas de rotation automatique si l'utilisateur réduit les animations. */
  reducedMotion: boolean;
  /** Appelé quand le décor d'une carte est prêt (ou en erreur). */
  onLoad?(arenaId: string, error: Error | null): void;
}

const ROTATION_SPEED = 0.12; // rad/s
const DRAG_SPEED = 0.006; // rad par pixel
const RESUME_AFTER_MS = 2500;

export class MapPreview {
  private readonly renderer: THREE.WebGLRenderer;
  private readonly camera = new THREE.PerspectiveCamera(40, 1, 0.1, 300);
  private readonly resizeObserver: ResizeObserver;
  private readonly timer = new THREE.Timer();
  private scene = new THREE.Scene();
  private arena: Arena | null = null;
  private yaw = 0.7;
  private dragging = false;
  private lastX = 0;
  private idleSince = 0;
  private raf = 0;
  /** Numéro de la carte affichée : un chargement fini trop tard est ignoré. */
  private token = 0;

  private readonly canvas: HTMLCanvasElement;
  private readonly config: GameConfig;
  private readonly options: MapPreviewOptions;

  constructor(canvas: HTMLCanvasElement, config: GameConfig, options: MapPreviewOptions) {
    this.canvas = canvas;
    this.config = config;
    this.options = options;
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFShadowMap;
    this.resizeObserver = new ResizeObserver(() => this.resize());
    this.resizeObserver.observe(canvas);
    canvas.addEventListener('pointerdown', this.onPointerDown);
    window.addEventListener('pointermove', this.onPointerMove);
    window.addEventListener('pointerup', this.onPointerUp);
    this.resize();
    this.loop();
  }

  /** Affiche une carte (le décor se charge en arrière-plan ; la précédente est retirée). */
  show(arena: Arena): void {
    if (this.arena?.id === arena.id) return;
    this.arena = arena;
    const token = ++this.token;
    disposeObject(this.scene);
    this.scene = new THREE.Scene();
    const colors = readSceneColors(arena.look?.theme);
    addLighting(this.scene, arena, colors);
    // vue de loin : pas de brouillard proche
    if (this.scene.fog instanceof THREE.Fog) {
      this.scene.fog.near = Math.max(arena.size[0], arena.size[1]) * 1.4;
      this.scene.fog.far = this.scene.fog.near * 2.5;
    }
    this.scene.add(buildArena(arena, colors));
    // éléments cassables, intacts
    const breakables = new BreakablesView(arena, new Destructibles(worldFromArena(arena), arena, this.config.materials), colors);
    const scene = this.scene;
    scene.add(breakables.group);
    Promise.all([loadArenaDecor(arena, this.config), breakables.load(this.config)])
      .then(([decor]) => {
        if (token !== this.token) return;
        if (decor) scene.add(decor);
        this.options.onLoad?.(arena.id, null);
      })
      .catch((error: Error) => {
        if (token === this.token) this.options.onLoad?.(arena.id, error);
      });
  }

  private resize(): void {
    const w = this.canvas.clientWidth || 1;
    const h = this.canvas.clientHeight || 1;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  }

  private readonly onPointerDown = (e: PointerEvent) => {
    this.dragging = true;
    this.lastX = e.clientX;
  };

  private readonly onPointerMove = (e: PointerEvent) => {
    if (!this.dragging) return;
    this.yaw -= (e.clientX - this.lastX) * DRAG_SPEED;
    this.lastX = e.clientX;
    this.idleSince = performance.now();
  };

  private readonly onPointerUp = () => {
    this.dragging = false;
    this.idleSince = performance.now();
  };

  private readonly loop = () => {
    this.raf = requestAnimationFrame(this.loop);
    this.timer.update();
    const dt = Math.min(0.1, this.timer.getDelta());
    const idle = !this.dragging && performance.now() - this.idleSince > RESUME_AFTER_MS;
    if (idle && !this.options.reducedMotion) this.yaw += ROTATION_SPEED * dt;
    const size = this.arena ? Math.max(this.arena.size[0], this.arena.size[1]) : 40;
    // un souterrain se regarde de plus près et de moins haut (sous le plafond)
    const low = this.arena?.look?.shadows === false;
    const radius = size * (low ? 0.38 : 0.95);
    const height = low ? 8.5 : size * 0.62;
    this.camera.position.set(Math.sin(this.yaw) * radius, height, Math.cos(this.yaw) * radius);
    this.camera.lookAt(0, low ? 1.5 : 0, 0);
    this.renderer.render(this.scene, this.camera);
  };

  dispose(): void {
    cancelAnimationFrame(this.raf);
    this.resizeObserver.disconnect();
    this.canvas.removeEventListener('pointerdown', this.onPointerDown);
    window.removeEventListener('pointermove', this.onPointerMove);
    window.removeEventListener('pointerup', this.onPointerUp);
    disposeObject(this.scene);
    this.renderer.dispose();
  }
}
