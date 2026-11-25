// Pose des personnages adverses : marche, saut, visée, tir, touche, mort (logique pure, sans Three.js).
import { describe, expect, it } from 'vitest';
import { createPoseState, DEATH_VISIBLE_SECONDS, onHurt, onShot, setAim, stepPose, type Pose, type PoseState } from '../src/render/characterPose';

const DT = 1 / 60;
type Vec = { x: number; y: number; z: number };

/** Joue `seconds` secondes ; `at(t)` donne la position à l'instant t. */
function run(s: PoseState, seconds: number, at: (t: number) => Vec, opts: { yaw?: number; alive?: boolean } = {}): Pose {
  let pose!: Pose;
  const steps = Math.round(seconds / DT);
  for (let i = 1; i <= steps; i++) pose = stepPose(s, { position: at(i * DT), yaw: opts.yaw ?? 0, alive: opts.alive ?? true }, DT);
  return pose;
}
const still = () => ({ x: 0, y: 0, z: 0 });

describe('pose des personnages', () => {
  it('immobile : jambes droites, bras qui tiennent l’arme vers l’avant', () => {
    const pose = run(createPoseState(), 1, still);
    expect(Math.abs(pose.legR.x)).toBeLessThan(0.01);
    expect(pose.armR.pitch).toBeLessThan(-1.2);
    expect(pose.visible).toBe(true);
  });

  it('en marche : les jambes bougent en sens opposé et le buste penche vers l’avant', () => {
    const s = createPoseState();
    // yaw 0 : l'avant est −z
    let maxSwing = 0;
    let pose!: Pose;
    for (let i = 1; i <= 60; i++) {
      pose = stepPose(s, { position: { x: 0, y: 0, z: -6 * i * DT }, yaw: 0, alive: true }, DT);
      maxSwing = Math.max(maxSwing, Math.abs(pose.legR.x));
      expect(pose.legL.x).toBeCloseTo(-pose.legR.x, 5);
    }
    expect(maxSwing).toBeGreaterThan(0.3);
    expect(pose.body.pitch).toBeLessThan(0);
  });

  it('à reculons, le buste penche en arrière ; en pas chassés, il penche sur le côté', () => {
    const back = run(createPoseState(), 1, (t) => ({ x: 0, y: 0, z: 6 * t }));
    expect(back.body.pitch).toBeGreaterThan(0);
    const right = run(createPoseState(), 1, (t) => ({ x: 6 * t, y: 0, z: 0 }));
    expect(right.body.roll).toBeLessThan(0);
    expect(Math.abs(right.legR.z)).toBeGreaterThanOrEqual(0);
  });

  it('une téléportation (réapparition) ne fait pas marcher', () => {
    const s = createPoseState();
    run(s, 0.5, still);
    const pose = run(s, DT, () => ({ x: 30, y: 0, z: 0 }));
    expect(s.speed).toBe(0);
    expect(Math.abs(pose.legR.x)).toBeLessThan(0.01);
  });

  it('en l’air, les jambes se replient ; à la réception, le corps se tasse', () => {
    const s = createPoseState();
    run(s, 0.3, still);
    const jump = (t: number) => ({ x: 0, y: Math.max(0, 7.5 * t - 11 * t * t), z: 0 });
    const air = run(s, 0.35, jump);
    expect(air.legR.x).toBeLessThan(-0.3);
    run(s, 0.33, (t) => jump(0.35 + t));
    const landed = run(s, 0.05, still);
    expect(s.land).toBeGreaterThan(0.3);
    expect(landed.body.y).toBeLessThan(0);
  });

  it('les bras et la tête suivent la visée haut/bas', () => {
    const s = createPoseState();
    const flat = run(s, 0.5, still);
    setAim(s, 0.5, false);
    const up = run(s, 0.5, still);
    expect(up.armR.pitch).toBeLessThan(flat.armR.pitch - 0.4);
    expect(up.head.x).toBeLessThan(flat.head.x);
  });

  it('un tir lève les bras un instant, un coup fait sursauter le corps en arrière', () => {
    const s = createPoseState();
    const rest = run(s, 0.5, still);
    onShot(s);
    const shot = run(s, DT, still);
    expect(shot.armR.pitch).toBeLessThan(rest.armR.pitch - 0.2);
    const later = run(s, 0.6, still);
    expect(Math.abs(later.armR.pitch - rest.armR.pitch)).toBeLessThan(0.01);
    onHurt(s);
    const hurt = run(s, DT, still);
    expect(hurt.body.pitch).toBeGreaterThan(0.1);
  });

  it('à la mort : chute en arrière, puis disparition ; il revient à la réapparition', () => {
    const s = createPoseState();
    run(s, 0.5, still);
    const falling = run(s, 0.6, still, { alive: false });
    expect(falling.body.pitch).toBeGreaterThan(1.3);
    expect(falling.visible).toBe(true);
    const gone = run(s, DEATH_VISIBLE_SECONDS, still, { alive: false });
    expect(gone.visible).toBe(false);
    const back = run(s, DT, still);
    expect(back.visible).toBe(true);
    expect(back.body.pitch).toBeLessThan(0.1);
  });

  it('un adversaire jamais vu vivant n’est ni affiché ni animé en chute', () => {
    const pose = run(createPoseState(), 0.5, still, { alive: false });
    expect(pose.visible).toBe(false);
  });
});
