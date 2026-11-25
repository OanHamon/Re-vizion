// Calcul de la pose d'un personnage adverse à chaque image : marche (avant, arrière, pas chassés),
// saut et réception, visée haut/bas, recul du tir, sursaut quand il est touché, chute à la mort.
// Rendu seulement : ces valeurs ne changent rien au jeu. Pur TypeScript (aucun import de Three.js),
// donc testable sans navigateur.
//
// Angles en radians. Repères :
// - parties (bras, jambes, tête) : repère du modèle voxel, visage vers +z ;
// - corps (`body`) : repère du personnage dans la scène, regard vers −z, droite vers +x.

// visée
const ARM_R_BASE = { pitch: -1.45, yaw: 0.25 };
const ARM_L_BASE = { pitch: -1.38, yaw: -0.78 };
const PITCH_SMOOTHING = 14;
const HEAD_PITCH_SHARE = 0.6;
const HEAD_PITCH_MAX = 0.6;
const AIM_SMOOTHING = 10;
const AIM_ARM_RAISE = 0.06;
const AIM_HEAD_TILT = 0.1;
// tir et touche
const RECOIL_DECAY = 12;
const RECOIL_ARM = 0.3;
const FLINCH_DECAY = 7;
const FLINCH_BODY = 0.14;
const FLINCH_HEAD = 0.3;
// marche
const STRIDE_RADIANS_PER_METER = 4.2;
const LEG_SWING = 0.65;
const SIDE_SWING_SHARE = 0.55;
const WALK_BOB = 0.035;
const HEAD_SWAY = 0.04;
const WALK_SPEED_FOR_FULL_SWING = 6;
const LEAN_FORWARD = 0.09;
const LEAN_SIDE = 0.07;
const MOVE_SMOOTHING = 10;
/** Au-delà de cette vitesse, c'est une téléportation (réapparition) : pas de pas. */
const TELEPORT_SPEED = 24;
const IDLE_BREATH = 0.012;
// saut et réception
const AIR_VERTICAL_SPEED = 1.2;
const AIR_LEG_FRONT = -0.7;
const AIR_LEG_BACK = 0.35;
const AIR_BLEND_SPEED = 10;
const LAND_MIN_FALL_SPEED = 3;
const LAND_DECAY = 6;
const LAND_DIP = 0.09;
// mort
const DEATH_FALL_SECONDS = 0.55;
const DEATH_FALL_ANGLE = 1.45;
const DEATH_SINK_START = 1.1;
const DEATH_SINK_SPEED = 0.8;
/** Durée pendant laquelle le corps reste visible après la mort. */
export const DEATH_VISIBLE_SECONDS = 1.6;

type Vec3 = { x: number; y: number; z: number };

export interface PoseState {
  last: Vec3 | null;
  speed: number;
  /** Part de la vitesse vers l'avant et vers la droite (−1 à 1), lissée. */
  forward: number;
  right: number;
  vy: number;
  air: number;
  /** Vitesse verticale la plus basse pendant le saut en cours. */
  fall: number;
  land: number;
  phase: number;
  time: number;
  pitch: number;
  pitchTarget: number;
  aim: number;
  aimTarget: boolean;
  recoil: number;
  flinch: number;
  wasAlive: boolean;
  /** Secondes depuis la mort, −1 en vie. */
  dead: number;
}

export interface Pose {
  visible: boolean;
  legR: { x: number; z: number };
  legL: { x: number; z: number };
  armR: { pitch: number; yaw: number };
  armL: { pitch: number; yaw: number };
  head: { x: number; y: number; z: number };
  body: { y: number; pitch: number; roll: number };
}

export function createPoseState(): PoseState {
  return {
    last: null, speed: 0, forward: 0, right: 0, vy: 0, air: 0, fall: 0, land: 0, phase: 0, time: 0,
    pitch: 0, pitchTarget: 0, aim: 0, aimTarget: false, recoil: 0, flinch: 0, wasAlive: false, dead: -1,
  };
}

/** Visée reçue du réseau (pitch > 0 = regarde vers le haut). */
export function setAim(s: PoseState, pitch: number, aiming: boolean): void {
  s.pitchTarget = pitch;
  s.aimTarget = aiming;
}

export function onShot(s: PoseState): void {
  s.recoil = 1;
}

export function onHurt(s: PoseState): void {
  s.flinch = 1;
}

const approach = (from: number, to: number, rate: number, dt: number) => from + (to - from) * Math.min(1, dt * rate);
const clamp = (v: number, min: number, max: number) => Math.max(min, Math.min(max, v));

export function stepPose(s: PoseState, input: { position: Vec3; yaw: number; alive: boolean }, dt: number): Pose {
  s.time += dt;
  const { position: p, yaw, alive } = input;

  // vie et mort : la chute ne se joue que si on l'a vu vivant
  if (alive) {
    if (!s.wasAlive) {
      s.last = null; // réapparition : on repart de zéro
      s.dead = -1;
      s.speed = s.forward = s.right = s.vy = s.air = s.fall = s.land = 0;
    }
    s.wasAlive = true;
  } else if (s.wasAlive) {
    s.wasAlive = false;
    s.dead = 0;
  } else if (s.dead >= 0) {
    s.dead += dt;
  }

  // déplacement mesuré depuis la dernière image, ramené dans le repère du personnage
  if (alive && s.last && dt > 0) {
    const dx = p.x - s.last.x;
    const dz = p.z - s.last.z;
    const step = Math.hypot(dx, dz);
    const teleport = step / dt >= TELEPORT_SPEED;
    const measured = teleport ? 0 : step / dt;
    s.speed = approach(s.speed, measured, MOVE_SMOOTHING, dt);
    if (!teleport) {
      s.phase += step * STRIDE_RADIANS_PER_METER;
      const localX = dx * Math.cos(yaw) - dz * Math.sin(yaw);
      const localZ = dx * Math.sin(yaw) + dz * Math.cos(yaw);
      const f = step > 1e-6 ? -localZ / step : 0;
      const r = step > 1e-6 ? localX / step : 0;
      s.forward = approach(s.forward, f, MOVE_SMOOTHING, dt);
      s.right = approach(s.right, r, MOVE_SMOOTHING, dt);
      // vitesse verticale brute (les positions réseau sont déjà lissées) : la réception est vue tout de suite
      s.vy = (p.y - s.last.y) / dt;
      const inAir = Math.abs(s.vy) > AIR_VERTICAL_SPEED;
      // réception : on retient la vitesse de chute la plus forte pendant le saut
      if (inAir) s.fall = Math.min(s.fall, s.vy);
      else {
        if (s.fall < -LAND_MIN_FALL_SPEED) s.land = 1;
        s.fall = 0;
      }
      s.air = approach(s.air, inAir ? 1 : 0, AIR_BLEND_SPEED, dt);
    }
  }
  s.last = { ...p };

  s.pitch = approach(s.pitch, s.pitchTarget, PITCH_SMOOTHING, dt);
  s.aim = approach(s.aim, s.aimTarget ? 1 : 0, AIM_SMOOTHING, dt);
  s.recoil *= Math.exp(-RECOIL_DECAY * dt);
  s.flinch *= Math.exp(-FLINCH_DECAY * dt);
  s.land *= Math.exp(-LAND_DECAY * dt);

  const walk = Math.min(1, s.speed / WALK_SPEED_FOR_FULL_SWING) * (1 - s.air);
  const swing = Math.sin(s.phase) * LEG_SWING * walk;
  const sideShare = Math.abs(s.right) * SIDE_SWING_SHARE;
  const legX = swing * (1 - sideShare);
  const legZ = swing * sideShare;

  const armRaise = s.pitch + s.recoil * RECOIL_ARM + s.aim * AIM_ARM_RAISE;
  const pose: Pose = {
    visible: alive || (s.dead >= 0 && s.dead < DEATH_VISIBLE_SECONDS),
    legR: { x: legX + s.air * AIR_LEG_FRONT, z: legZ },
    legL: { x: -legX + s.air * AIR_LEG_BACK, z: -legZ },
    armR: { pitch: ARM_R_BASE.pitch - armRaise, yaw: ARM_R_BASE.yaw },
    armL: { pitch: ARM_L_BASE.pitch - armRaise, yaw: ARM_L_BASE.yaw },
    head: {
      x: clamp(-s.pitch * HEAD_PITCH_SHARE, -HEAD_PITCH_MAX, HEAD_PITCH_MAX) - s.flinch * FLINCH_HEAD,
      y: Math.sin(s.phase) * HEAD_SWAY * walk,
      z: s.aim * AIM_HEAD_TILT,
    },
    body: {
      y: Math.abs(Math.sin(s.phase)) * WALK_BOB * walk + Math.sin(s.time * 2) * IDLE_BREATH * (1 - walk) - s.land * LAND_DIP,
      // penché vers l'avant (−) quand il avance, vers l'arrière (+) quand il est touché
      pitch: -s.forward * LEAN_FORWARD * walk + s.flinch * FLINCH_BODY,
      roll: -s.right * LEAN_SIDE * walk,
    },
  };

  if (s.dead >= 0) {
    // il bascule en arrière, puis s'enfonce dans le sol avant de disparaître
    const t = Math.min(1, s.dead / DEATH_FALL_SECONDS);
    const eased = 1 - (1 - t) * (1 - t);
    pose.body.pitch = eased * DEATH_FALL_ANGLE;
    pose.body.roll = 0;
    pose.body.y = -Math.max(0, s.dead - DEATH_SINK_START) * DEATH_SINK_SPEED;
    pose.armR.pitch = ARM_R_BASE.pitch * (1 - eased * 0.6);
    pose.armL.pitch = ARM_L_BASE.pitch * (1 - eased * 0.8);
    pose.legR = { x: -0.25 * eased, z: 0 };
    pose.legL = { x: 0.15 * eased, z: 0 };
    pose.head = { x: -0.3 * eased, y: 0, z: 0 };
  }
  return pose;
}
