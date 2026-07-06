/**
 * The static bowling ball: a glossy sphere on the approach with three drilled
 * finger holes (two adjacent finger holes plus an offset thumb hole). The
 * holes are short dark cylinders sunk along the surface normal rather than
 * real cut-outs. The ball never moves in HW05.
 */

import { BALL, SURFACE_Y, COLORS } from './config.js';

/**
 * Place one drilled hole. `dir` is the unit direction from the ball centre to
 * the hole on the surface; the cylinder is oriented along that normal and sunk
 * so its mouth sits flush with the surface.
 */
function addHole(parent, dir, material) {
  const cyl = new THREE.CylinderGeometry(
    BALL.holeRadius,
    BALL.holeRadius * 0.85, // taper slightly inward
    BALL.holeDepth,
    20
  );
  const hole = new THREE.Mesh(cyl, material);

  // The cylinder's default axis is +Y; rotate it onto the surface normal.
  hole.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir);
  // Centre it so the mouth is flush at the surface and it sinks inward.
  hole.position.copy(dir).multiplyScalar(BALL.radius - BALL.holeDepth / 2 + 0.01);
  parent.add(hole);
}

/**
 * @returns {THREE.Group} the ball positioned on the approach, centred on the
 * lane, holes facing up toward the bowler.
 */
export function createBall() {
  const group = new THREE.Group();
  group.name = 'BowlingBall';

  // Glossy resin shell (Phong: high shininess + bright specular highlight).
  const ballMat = new THREE.MeshPhongMaterial({
    color: COLORS.ballPrimary,
    specular: COLORS.ballSpecular,
    shininess: 100,
    reflectivity: 1,
  });
  const sphere = new THREE.Mesh(
    new THREE.SphereGeometry(BALL.radius, 48, 32),
    ballMat
  );
  sphere.castShadow = true;
  sphere.receiveShadow = true;
  group.add(sphere);

  // --- Drill the three holes ----------------------------------------------
  const holeMat = new THREE.MeshPhongMaterial({
    color: COLORS.holes,
    shininess: 8,
  });

  // Build a tangent frame around the cluster's facing direction (up and a
  // little toward the bowler, so the holes are visible from the default view).
  const c = new THREE.Vector3(0, 0.85, 0.5).normalize();
  const t = new THREE.Vector3().crossVectors(new THREE.Vector3(0, 1, 0), c).normalize();
  const b = new THREE.Vector3().crossVectors(c, t).normalize();

  // Two adjacent finger holes (close together) and one offset thumb hole.
  const finger1 = c.clone().addScaledVector(b, 0.4).addScaledVector(t, -0.28).normalize();
  const finger2 = c.clone().addScaledVector(b, 0.4).addScaledVector(t, 0.28).normalize();
  const thumb = c.clone().addScaledVector(b, -0.6).normalize();

  addHole(group, finger1, holeMat);
  addHole(group, finger2, holeMat);
  addHole(group, thumb, holeMat);

  // Rest on the approach, centred on the lane.
  group.position.set(BALL.position.x, SURFACE_Y + BALL.radius, BALL.position.z);
  return group;
}
