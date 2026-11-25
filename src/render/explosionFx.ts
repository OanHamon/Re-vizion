// Explosion de grenade, en couches (rendu seulement, aucune règle de jeu) :
//   flash de lumière · cœur crème · boule de feu pastel · onde de choc (sphère + anneau au sol)
//   · champignon de fumée qui monte · étincelles · braises · éclats · trace brûlée qui s'efface.
// Style cartoon pastel de la DA : couleurs du thème (--blast-*), jamais de néon.
// « Réduire flashs et secousses » : lumière et boule de feu adoucies, trois fois moins de particules.
import * as THREE from 'three';

export interface BlastColors {
  core: string;
  hot: string;
  fire: string;
  smoke: string;
  smokeDark: string;
  scorch: string;
  spark: string;
  chunk: string;
}

// durées (s) et tailles relatives au rayon de l'explosion
const CORE_LIFE = 0.18;
const FIRE_LIFE = 0.95;
const SHOCK_LIFE = 0.35;
const RING_LIFE = 0.6;
const LIGHT_LIFE = 0.5;
const SCORCH_LIFE = 10;
const LIGHT_INTENSITY = 90;
const SPARKS = 90;
const EMBERS = 60;
const SMOKE = 46;
const CHUNKS = 70;
const GRAVITY = 14;

interface Particle {
  pos: THREE.Vector3;
  vel: THREE.Vector3;
  spin: THREE.Vector3;
  life: number;
  maxLife: number;
  size: number;
  /** Sol sous l'explosion : les particules rebondissent dessus. */
  floor: number;
  /** Attente avant d'apparaître (s) : la fumée naît derrière la boule de feu. */
  delay: number;
}

/** Réserve de particules dessinées en une fois (InstancedMesh). */
class Pool {
  readonly mesh: THREE.InstancedMesh;
  private readonly items: Particle[] = [];
  private cursor = 0;
  private readonly tmp = new THREE.Object3D();
  private readonly dir = new THREE.Vector3();

  constructor(
    geometry: THREE.BufferGeometry,
    material: THREE.Material,
    private readonly count: number,
    private readonly behave: (p: Particle, dt: number) => void,
    private readonly shape: (p: Particle, o: THREE.Object3D, dir: THREE.Vector3) => void,
  ) {
    this.mesh = new THREE.InstancedMesh(geometry, material, count);
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.mesh.frustumCulled = false;
    for (let i = 0; i < count; i++) {
      this.items.push({ pos: new THREE.Vector3(), vel: new THREE.Vector3(), spin: new THREE.Vector3(), life: 0, maxLife: 1, size: 1, floor: 0, delay: 0 });
      this.tmp.scale.setScalar(0);
      this.tmp.updateMatrix();
      this.mesh.setMatrixAt(i, this.tmp.matrix);
      this.mesh.setColorAt(i, new THREE.Color(0xffffff));
    }
  }

  add(init: (p: Particle) => void, color: THREE.Color): void {
    const i = this.cursor;
    this.cursor = (this.cursor + 1) % this.count;
    const p = this.items[i]!;
    p.delay = 0;
    init(p);
    p.maxLife = p.life;
    this.mesh.setColorAt(i, color);
    if (this.mesh.instanceColor) this.mesh.instanceColor.needsUpdate = true;
  }

  update(dt: number): void {
    let any = false;
    this.items.forEach((p, i) => {
      if (p.life <= 0) return;
      any = true;
      if (p.delay > 0) {
        p.delay -= dt;
        this.tmp.scale.setScalar(0);
        this.tmp.updateMatrix();
        this.mesh.setMatrixAt(i, this.tmp.matrix);
        return;
      }
      p.life -= dt;
      this.behave(p, dt);
      this.tmp.position.copy(p.pos);
      this.tmp.rotation.set(0, 0, 0);
      this.tmp.scale.setScalar(1);
      this.dir.copy(p.vel);
      this.shape(p, this.tmp, this.dir);
      if (p.life <= 0) this.tmp.scale.setScalar(0);
      this.tmp.updateMatrix();
      this.mesh.setMatrixAt(i, this.tmp.matrix);
    });
    if (any) this.mesh.instanceMatrix.needsUpdate = true;
  }
}

interface Blast {
  point: THREE.Vector3;
  radius: number;
  age: number;
  soft: boolean;
  core: THREE.Mesh;
  fire: THREE.Mesh;
  fireOuter: THREE.Mesh;
  shock: THREE.Mesh;
  ring: THREE.Mesh;
  scorch: THREE.Mesh;
  light: THREE.PointLight;
}

const rand = (a: number, b: number) => a + Math.random() * (b - a);
const easeOut = (t: number) => 1 - (1 - t) ** 3;

/** Direction au hasard dans la demi-sphère du haut (plus ou moins à plat selon `up`). */
function burst(up: number): THREE.Vector3 {
  const theta = Math.random() * Math.PI * 2;
  const y = rand(up, 1);
  const r = Math.sqrt(1 - y * y);
  return new THREE.Vector3(Math.cos(theta) * r, y, Math.sin(theta) * r);
}

export class ExplosionFx {
  readonly group = new THREE.Group();
  private readonly blasts: Blast[] = [];
  private readonly sparks: Pool;
  private readonly embers: Pool;
  private readonly smoke: Pool;
  private readonly chunks: Pool;
  private readonly c: Record<keyof BlastColors, THREE.Color>;
  private readonly sphere = new THREE.IcosahedronGeometry(1, 2);
  private readonly lumpy = new THREE.IcosahedronGeometry(1, 1);

  constructor(colors: BlastColors) {
    this.c = Object.fromEntries(Object.entries(colors).map(([k, v]) => [k, new THREE.Color(v)])) as Record<keyof BlastColors, THREE.Color>;
    const glow = new THREE.MeshBasicMaterial({ toneMapped: false });
    // étincelles : traits fins étirés dans le sens de la vitesse, très rapides, avec gravité
    this.sparks = new Pool(new THREE.BoxGeometry(0.035, 0.035, 1), glow, SPARKS * 2, (p, dt) => {
      p.vel.y -= GRAVITY * 0.6 * dt;
      p.vel.multiplyScalar(Math.exp(-dt * 2.2));
      p.pos.addScaledVector(p.vel, dt);
    }, (p, o, dir) => {
      const len = Math.min(0.9, dir.length() * 0.045) * (p.life / p.maxLife);
      o.lookAt(o.position.clone().add(dir));
      o.scale.set(p.size, p.size, Math.max(0.01, len));
    });
    // braises : petits cubes lumineux qui retombent lentement en tournant
    this.embers = new Pool(new THREE.BoxGeometry(0.06, 0.06, 0.06), glow, EMBERS * 2, (p, dt) => {
      p.vel.y -= GRAVITY * 0.35 * dt;
      p.vel.multiplyScalar(Math.exp(-dt * 1.5));
      p.pos.addScaledVector(p.vel, dt);
      if (p.pos.y < p.floor) {
        p.pos.y = p.floor;
        p.vel.set(p.vel.x * 0.3, 0, p.vel.z * 0.3);
      }
    }, (p, o) => {
      o.rotation.set(p.spin.x * p.life, p.spin.y * p.life, 0);
      o.scale.setScalar(p.size * Math.min(1, (p.life / p.maxLife) * 2));
    });
    // fumée : boules cartoon lisses et opaques, qui montent, gonflent puis rétrécissent
    this.smoke = new Pool(this.sphere, new THREE.MeshLambertMaterial(), SMOKE * 2, (p, dt) => {
      p.vel.multiplyScalar(Math.exp(-dt * 2.6));
      p.vel.y += 1.2 * dt;
      p.pos.addScaledVector(p.vel, dt);
    }, (p, o) => {
      const t = 1 - p.life / p.maxLife;
      const grow = t < 0.3 ? easeOut(t / 0.3) : 1 - ((t - 0.3) / 0.7) ** 2;
      o.rotation.set(p.spin.x * t, p.spin.y * t, 0);
      o.scale.setScalar(Math.max(0.001, p.size * (0.5 + 0.7 * Math.min(1, t * 2.5)) * grow));
    });
    // éclats : cubes qui volent, rebondissent et s'arrêtent au sol
    this.chunks = new Pool(new THREE.BoxGeometry(0.11, 0.11, 0.11), new THREE.MeshLambertMaterial(), CHUNKS * 2, (p, dt) => {
      p.vel.y -= GRAVITY * dt;
      p.pos.addScaledVector(p.vel, dt);
      if (p.pos.y < p.floor) {
        p.pos.y = p.floor;
        p.vel.set(p.vel.x * 0.45, Math.abs(p.vel.y) * 0.3, p.vel.z * 0.45);
      }
    }, (p, o) => {
      o.rotation.set(p.spin.x * p.life, p.spin.y * p.life, p.spin.z * p.life);
      o.scale.setScalar(p.size * Math.min(1, (p.life / p.maxLife) * 3));
    });
    this.group.add(this.sparks.mesh, this.embers.mesh, this.smoke.mesh, this.chunks.mesh);
  }

  /** Nouvelle explosion au point donné (centre de la grenade, posée au sol). */
  spawn(at: { x: number; y: number; z: number }, radius: number, soft: boolean): void {
    const point = new THREE.Vector3(at.x, at.y, at.z);
    const basic = (color: THREE.Color, opacity: number) => new THREE.MeshBasicMaterial({ color, transparent: true, opacity, depthWrite: false, toneMapped: false });
    const core = new THREE.Mesh(this.sphere, basic(this.c.core, soft ? 0.6 : 1));
    const fire = new THREE.Mesh(this.lumpy, new THREE.MeshBasicMaterial({ color: this.c.hot, transparent: true, opacity: soft ? 0.5 : 0.95, toneMapped: false }));
    const fireOuter = new THREE.Mesh(this.lumpy, new THREE.MeshBasicMaterial({ color: this.c.fire, transparent: true, opacity: soft ? 0.4 : 0.85, depthWrite: false, toneMapped: false }));
    const shock = new THREE.Mesh(this.sphere, basic(this.c.core, soft ? 0.15 : 0.35));
    const ring = new THREE.Mesh(new THREE.RingGeometry(0.85, 1, 48), basic(this.c.core, soft ? 0.4 : 0.8));
    ring.rotation.x = -Math.PI / 2;
    const scorch = new THREE.Mesh(new THREE.CircleGeometry(1, 24), new THREE.MeshBasicMaterial({ color: this.c.scorch, transparent: true, opacity: 0.45, depthWrite: false }));
    scorch.rotation.x = -Math.PI / 2;
    const floor = point.y - 0.11;
    for (const m of [core, fire, fireOuter, shock]) m.position.copy(point);
    ring.position.set(point.x, floor + 0.03, point.z);
    scorch.position.set(point.x, floor + 0.02, point.z);
    scorch.scale.setScalar(radius * 0.45);
    fire.rotation.set(Math.random() * 3, Math.random() * 3, 0);
    fireOuter.rotation.set(Math.random() * 3, Math.random() * 3, 0);
    const light = new THREE.PointLight(this.c.core, soft ? LIGHT_INTENSITY * 0.25 : LIGHT_INTENSITY, radius * 5, 1.6);
    light.position.copy(point).add(new THREE.Vector3(0, 0.6, 0));
    this.group.add(core, fire, fireOuter, shock, ring, scorch, light);
    this.blasts.push({ point, radius, age: 0, soft, core, fire, fireOuter, shock, ring, scorch, light });

    const n = (count: number) => Math.round(soft ? count / 3 : count);
    for (let i = 0; i < n(SPARKS); i++) {
      this.sparks.add((p) => {
        p.pos.copy(point);
        p.vel.copy(burst(-0.1)).multiplyScalar(rand(9, 22));
        p.life = rand(0.25, 0.6);
        p.size = rand(0.7, 1.4);
      }, Math.random() < 0.5 ? this.c.spark : this.c.hot);
    }
    for (let i = 0; i < n(EMBERS); i++) {
      this.embers.add((p) => {
        p.pos.copy(point).add(new THREE.Vector3(rand(-0.3, 0.3), rand(0, 0.4), rand(-0.3, 0.3)));
        p.vel.copy(burst(0.2)).multiplyScalar(rand(2, 8));
        p.spin.set(rand(5, 15), rand(5, 15), 0);
        p.life = rand(0.8, 1.8);
        p.size = rand(0.6, 1.3);
        p.floor = floor + 0.03;
      }, Math.random() < 0.6 ? this.c.fire : this.c.hot);
    }
    for (let i = 0; i < n(SMOKE); i++) {
      const column = i < n(SMOKE) * 0.45;
      this.smoke.add((p) => {
        // une colonne qui monte (champignon) et un anneau qui roule au sol
        if (column) {
          p.pos.copy(point).add(new THREE.Vector3(rand(-0.3, 0.3), rand(0.2, 1), rand(-0.3, 0.3)));
          p.vel.set(rand(-0.6, 0.6), rand(3, 6.5), rand(-0.6, 0.6));
        } else {
          const d = burst(0.0);
          p.pos.copy(point).addScaledVector(d, 0.3);
          p.vel.set(d.x, 0.15, d.z).multiplyScalar(rand(5, 9));
        }
        p.spin.set(rand(-2, 2), rand(-2, 2), 0);
        p.life = rand(1.4, 2.6);
        p.delay = column ? rand(0.25, 0.5) : rand(0.12, 0.3);
        p.size = rand(0.22, 0.5) * (radius / 4.5) * (column ? 1.15 : 1);
      }, Math.random() < 0.65 ? this.c.smoke : this.c.smokeDark);
    }
    for (let i = 0; i < n(CHUNKS); i++) {
      this.chunks.add((p) => {
        p.pos.copy(point);
        p.vel.copy(burst(0.15)).multiplyScalar(rand(4, 11));
        p.spin.set(rand(-12, 12), rand(-12, 12), rand(-12, 12));
        p.life = rand(1, 2.2);
        p.size = rand(0.5, 1.3);
        p.floor = floor + 0.05;
      }, Math.random() < 0.5 ? this.c.chunk : this.c.scorch);
    }
  }

  update(dt: number): void {
    for (let i = this.blasts.length - 1; i >= 0; i--) {
      const b = this.blasts[i]!;
      b.age += dt;
      const r = b.radius;
      const k = (life: number) => Math.min(1, b.age / life);
      // cœur : éclair blanc crème, très bref
      const tc = k(CORE_LIFE);
      b.core.visible = tc < 1;
      b.core.scale.setScalar(0.2 + r * 0.35 * easeOut(tc));
      (b.core.material as THREE.MeshBasicMaterial).opacity = (b.soft ? 0.6 : 1) * (1 - tc);
      // boule de feu : gonfle vite, monte un peu, puis fond en rétrécissant
      const tf = k(FIRE_LIFE);
      const fireScale = r * (tf < 0.25 ? 0.65 * easeOut(tf / 0.25) : 0.65 * (1 - ((tf - 0.25) / 0.75) ** 1.5));
      b.fire.visible = b.fireOuter.visible = tf < 1;
      b.fire.scale.setScalar(Math.max(0.001, fireScale * 0.7));
      b.fireOuter.scale.setScalar(Math.max(0.001, fireScale));
      b.fire.position.y = b.fireOuter.position.y = b.point.y + tf * 0.8;
      b.fire.rotation.y += dt * 1.5;
      b.fireOuter.rotation.y -= dt;
      (b.fireOuter.material as THREE.MeshBasicMaterial).opacity = (b.soft ? 0.4 : 0.85) * (1 - tf * tf);
      // onde de choc : sphère transparente et anneau au sol qui filent vers le bord du rayon
      const ts = k(SHOCK_LIFE);
      b.shock.visible = ts < 1;
      b.shock.scale.setScalar(0.3 + r * 1.1 * easeOut(ts));
      (b.shock.material as THREE.MeshBasicMaterial).opacity = (b.soft ? 0.15 : 0.35) * (1 - ts);
      const tr = k(RING_LIFE);
      b.ring.visible = tr < 1;
      b.ring.scale.setScalar(0.3 + r * 1.4 * easeOut(tr));
      (b.ring.material as THREE.MeshBasicMaterial).opacity = (b.soft ? 0.4 : 0.8) * (1 - tr);
      // lumière : pic immédiat puis chute
      const tl = k(LIGHT_LIFE);
      b.light.intensity = (b.soft ? LIGHT_INTENSITY * 0.25 : LIGHT_INTENSITY) * (1 - tl) ** 2;
      // trace brûlée : reste, puis s'efface
      const tsc = k(SCORCH_LIFE);
      (b.scorch.material as THREE.MeshBasicMaterial).opacity = 0.45 * (1 - tsc * tsc);
      if (b.age >= SCORCH_LIFE) {
        for (const o of [b.core, b.fire, b.fireOuter, b.shock, b.ring, b.scorch, b.light]) this.group.remove(o);
        for (const m of [b.core, b.fire, b.fireOuter, b.shock, b.ring, b.scorch]) (m.material as THREE.Material).dispose();
        b.ring.geometry.dispose();
        b.scorch.geometry.dispose();
        this.blasts.splice(i, 1);
      }
    }
    this.sparks.update(dt);
    this.embers.update(dt);
    this.smoke.update(dt);
    this.chunks.update(dt);
  }
}
