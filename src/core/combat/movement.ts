// Déplacement du joueur : accélération au sol et en l'air, gravité, saut (+ sauts en plus),
// dash, collisions avec le sol, les blocs et les murs d'enceinte.
// Collisions résolues axe par axe ; appeler avec de petits pas de temps (≤ 1/60 s).
import { overlaps, v3, type Aabb, type Vec3, type World } from './geometry';

export interface MoveState {
  /** Position des pieds (centre du bas de la boîte). */
  pos: Vec3;
  vel: Vec3;
  onGround: boolean;
  airJumpsUsed: number;
  dashCharges: number;
  dashRecharge: number;
  dashTimeLeft: number;
  dashDir: Vec3;
}

export interface MoveInput {
  /** −1 (recule) à 1 (avance). */
  forward: number;
  /** −1 (gauche) à 1 (droite). */
  right: number;
  /** Appui ce pas-ci (front montant). */
  jump: boolean;
  dash: boolean;
  yaw: number;
}

export interface MoveParams {
  walkSpeed: number;
  groundAcceleration: number;
  airAcceleration: number;
  jumpVelocity: number;
  gravity: number;
  extraJumps: number;
  maxDashCharges: number;
  dashSpeed: number;
  dashSeconds: number;
  dashCooldownSeconds: number;
  height: number;
  radius: number;
  /** Marche franchie sans sauter quand on est au sol (0 = jamais). */
  stepHeight: number;
}

export type MoveEvent = { type: 'jump' } | { type: 'land'; speed: number } | { type: 'dash' };

const EPS = 1e-4;

export function createMoveState(pos: Vec3, dashCharges: number): MoveState {
  return {
    pos: { ...pos },
    vel: v3(),
    // posé au sol dès l'apparition (sinon un saut à la première image serait ignoré)
    onGround: pos.y <= 0,
    airJumpsUsed: 0,
    dashCharges,
    dashRecharge: 0,
    dashTimeLeft: 0,
    dashDir: v3(0, 0, -1),
  };
}

function bodyBox(pos: Vec3, p: MoveParams): Aabb {
  return {
    min: v3(pos.x - p.radius, pos.y, pos.z - p.radius),
    max: v3(pos.x + p.radius, pos.y + p.height, pos.z + p.radius),
  };
}

/** Rapproche `from` de `to` d'au plus `maxDelta`. */
function approach(from: number, to: number, maxDelta: number): number {
  return from < to ? Math.min(to, from + maxDelta) : Math.max(to, from - maxDelta);
}

export function stepMovement(s: MoveState, input: MoveInput, p: MoveParams, world: World, dt: number): MoveEvent[] {
  const events: MoveEvent[] = [];

  // direction voulue dans le plan horizontal
  const fx = -Math.sin(input.yaw);
  const fz = -Math.cos(input.yaw);
  const rx = Math.cos(input.yaw);
  const rz = -Math.sin(input.yaw);
  let wx = fx * input.forward + rx * input.right;
  let wz = fz * input.forward + rz * input.right;
  const wishLen = Math.hypot(wx, wz);
  if (wishLen > 1) {
    wx /= wishLen;
    wz /= wishLen;
  }

  // recharge du dash, une charge à la fois
  if (s.dashCharges < p.maxDashCharges) {
    s.dashRecharge += dt;
    if (s.dashRecharge >= p.dashCooldownSeconds) {
      s.dashCharges++;
      s.dashRecharge = 0;
    }
  }
  if (input.dash && s.dashCharges > 0 && s.dashTimeLeft <= 0) {
    s.dashCharges--;
    s.dashTimeLeft = p.dashSeconds;
    s.dashDir = wishLen > 0.01 ? v3(wx / Math.max(1, Math.hypot(wx, wz)), 0, wz / Math.max(1, Math.hypot(wx, wz))) : v3(fx, 0, fz);
    events.push({ type: 'dash' });
  }

  if (s.dashTimeLeft > 0) {
    s.dashTimeLeft -= dt;
    s.vel.x = s.dashDir.x * p.dashSpeed;
    s.vel.z = s.dashDir.z * p.dashSpeed;
    s.vel.y = Math.max(s.vel.y, 0);
  } else {
    const accel = s.onGround ? p.groundAcceleration : p.airAcceleration;
    // en l'air sans commande, on garde son élan
    if (s.onGround || wishLen > 0.01) {
      s.vel.x = approach(s.vel.x, wx * p.walkSpeed, accel * dt);
      s.vel.z = approach(s.vel.z, wz * p.walkSpeed, accel * dt);
    }
    if (input.jump && p.jumpVelocity > 0) {
      if (s.onGround) {
        s.vel.y = p.jumpVelocity;
        s.onGround = false;
        events.push({ type: 'jump' });
      } else if (s.airJumpsUsed < p.extraJumps) {
        s.vel.y = p.jumpVelocity;
        s.airJumpsUsed++;
        events.push({ type: 'jump' });
      }
    }
    s.vel.y -= p.gravity * dt;
  }

  // déplacement axe par axe
  for (const axis of ['x', 'z'] as const) {
    const delta = s.vel[axis] * dt;
    if (delta === 0) continue;
    s.pos[axis] += delta;
    const box = bodyBox(s.pos, p);
    for (const block of world.blocks) {
      if (!overlaps(box, block)) continue;
      // petite marche : on monte dessus si on est au sol et qu'il y a la place au-dessus
      const rise = block.max.y - s.pos.y;
      if (s.onGround && rise > 0 && rise <= p.stepHeight) {
        const raised = bodyBox(v3(s.pos.x, block.max.y, s.pos.z), p);
        if (!world.blocks.some((b) => overlaps(raised, b))) {
          s.pos.y = block.max.y;
          box.min.y = raised.min.y;
          box.max.y = raised.max.y;
          continue;
        }
      }
      s.pos[axis] = delta > 0 ? block.min[axis] - p.radius - EPS : block.max[axis] + p.radius + EPS;
      s.vel[axis] = 0;
      box.min[axis] = s.pos[axis] - p.radius;
      box.max[axis] = s.pos[axis] + p.radius;
    }
  }
  s.pos.x = Math.max(-world.halfX + p.radius, Math.min(world.halfX - p.radius, s.pos.x));
  s.pos.z = Math.max(-world.halfZ + p.radius, Math.min(world.halfZ - p.radius, s.pos.z));

  const wasOnGround = s.onGround;
  const fallSpeed = -s.vel.y;
  s.pos.y += s.vel.y * dt;
  s.onGround = false;
  if (s.pos.y <= 0) {
    s.pos.y = 0;
    s.vel.y = 0;
    s.onGround = true;
  } else {
    const box = bodyBox(s.pos, p);
    for (const block of world.blocks) {
      if (!overlaps(box, block)) continue;
      if (s.vel.y <= 0) {
        s.pos.y = block.max.y;
        s.onGround = true;
      } else {
        s.pos.y = block.min.y - p.height - EPS;
      }
      s.vel.y = 0;
      box.min.y = s.pos.y;
      box.max.y = s.pos.y + p.height;
    }
  }
  if (s.onGround) {
    s.airJumpsUsed = 0;
    if (!wasOnGround) events.push({ type: 'land', speed: fallSpeed });
  }
  return events;
}
