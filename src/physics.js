/**
 * physics.js — the hand-written collision math for the bowling game.
 *
 * Everything here is 2D in the lane plane (X across, Z down the lane); the
 * vertical hop is handled separately in game.js. The model is the standard
 * **impulse-based** response used by real-time physics engines:
 *
 *   - the contact normal n points along the line of centres of the two bodies;
 *   - the impulse scalar is  j = -(1 + e) * (vRel . n) / (1/mA + 1/mB)
 *     where vRel is the relative velocity and e the coefficient of restitution;
 *   - each body's velocity changes by  ±j * n / m  (inverse-mass weighted).
 *
 * Inverse-mass weighting makes a heavy bowling ball barely deflect while a light
 * pin is launched, and it sends the pin off **along the line of centres** — which
 * is what makes a pocket hit cascade to a strike and a flat nose hit leave a
 * split, exactly as in real bowling. No physics engine is used.
 *
 * References used for the math (see README / study guide):
 *   - impulse / restitution collision response (Newcastle Uni game-physics notes,
 *     Gaffer On Games, Euclideanspace 2D collision);
 *   - bowling pin action / pocket geometry (USC Illumin, National Bowling Academy).
 */

/**
 * Resolve a collision between two circular bodies in the XZ plane using an
 * impulse along the line of centres. Mutates the two velocity objects in place.
 *
 * @param {{x:number,z:number}} aPos  centre of body A
 * @param {{x:number,z:number}} aVel  velocity of body A (mutated)
 * @param {number} aInvMass           1 / mass of A (0 = immovable)
 * @param {{x:number,z:number}} bPos  centre of body B
 * @param {{x:number,z:number}} bVel  velocity of body B (mutated)
 * @param {number} bInvMass           1 / mass of B
 * @param {number} restitution        0 (no bounce) .. 1 (perfectly elastic)
 * @returns {number} the impulse magnitude j applied (0 if they were separating)
 */
export function resolveCircleCollision(aPos, aVel, aInvMass, bPos, bVel, bInvMass, restitution) {
  // Contact normal: unit vector from A's centre to B's centre.
  let nx = bPos.x - aPos.x;
  let nz = bPos.z - aPos.z;
  const dist = Math.hypot(nx, nz) || 1e-6;
  nx /= dist;
  nz /= dist;

  // Relative velocity of B with respect to A, projected on the normal.
  const rvx = bVel.x - aVel.x;
  const rvz = bVel.z - aVel.z;
  const velAlongNormal = rvx * nx + rvz * nz;

  // Already separating along the normal: no impulse (avoids sticky double-hits).
  if (velAlongNormal > 0) return 0;

  const invSum = aInvMass + bInvMass;
  if (invSum <= 0) return 0;

  const j = (-(1 + restitution) * velAlongNormal) / invSum;

  aVel.x -= j * aInvMass * nx;
  aVel.z -= j * aInvMass * nz;
  bVel.x += j * bInvMass * nx;
  bVel.z += j * bInvMass * nz;

  return j;
}

/**
 * Reflect a velocity about a wall whose inward unit normal is (nx, nz), with a
 * coefficient of restitution. Used for the bumpers and the back wall (the pit).
 * Mutates `vel`. The standard reflection is  v' = v - (1 + e)(v . n) n.
 *
 * @param {{x:number,z:number}} vel  velocity (mutated)
 * @param {number} nx                wall normal x (pointing back toward the lane)
 * @param {number} nz                wall normal z
 * @param {number} restitution       bounciness 0..1
 * @returns {boolean} true if a bounce was applied (the body was moving into the wall)
 */
export function reflect(vel, nx, nz, restitution) {
  const vn = vel.x * nx + vel.z * nz;
  if (vn >= 0) return false; // moving away from the wall already
  vel.x -= (1 + restitution) * vn * nx;
  vel.z -= (1 + restitution) * vn * nz;
  return true;
}

/**
 * Positionally separate two overlapping circles so they don't sink into each
 * other (a minimal "projection" / penetration-resolution step). Splits the push
 * by inverse mass. Mutates the two position objects in place.
 */
export function separateCircles(aPos, aInvMass, bPos, bInvMass, minDist) {
  let nx = bPos.x - aPos.x;
  let nz = bPos.z - aPos.z;
  const dist = Math.hypot(nx, nz) || 1e-6;
  const overlap = minDist - dist;
  if (overlap <= 0) return;
  nx /= dist;
  nz /= dist;
  const invSum = aInvMass + bInvMass || 1;
  const aPush = (overlap * aInvMass) / invSum;
  const bPush = (overlap * bInvMass) / invSum;
  aPos.x -= nx * aPush;
  aPos.z -= nz * aPush;
  bPos.x += nx * bPush;
  bPos.z += nz * bPush;
}
