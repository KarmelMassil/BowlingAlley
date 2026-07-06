/**
 * Recessed channels on each side of the lane. Each gutter is a rounded
 * half-pipe trough running the full lane length, sitting just below the lane
 * surface, with a low rail on the outer edge.
 *
 * Orientation: a CylinderGeometry's axis is local +Y, surface at
 * (x = r*sin t, z = r*cos t). Rotating +90 deg about X maps local +Y to world
 * +Z (so the trough runs down the lane) and a surface point to world
 * Y = -r*cos t, so t in [-90, +90] gives the lower half: a concave-up channel
 * with its rim at Y=0 and floor at Y=-r.
 */

import { LANE, GUTTER, COLORS } from './config.js';

function makeTrough(material) {
  const radius = GUTTER.width / 2;
  const geometry = new THREE.CylinderGeometry(
    radius,
    radius,
    GUTTER.length,
    28, // radial segments, smooth channel
    1,
    true, // open-ended
    -Math.PI / 2, // thetaStart
    Math.PI // thetaLength → exactly the lower half
  );
  const trough = new THREE.Mesh(geometry, material);
  trough.rotation.x = Math.PI / 2; // lay the axis down the lane (+Z)
  trough.receiveShadow = true;
  return trough;
}

/**
 * @returns {THREE.Group} both gutters plus their outer capping rails.
 */
export function createGutters() {
  const group = new THREE.Group();
  group.name = 'Gutters';

  const radius = GUTTER.width / 2;
  const channelMat = new THREE.MeshPhongMaterial({
    color: COLORS.gutter,
    shininess: 60,
    specular: 0x222222,
    side: THREE.DoubleSide, // the inside of the trough must render
  });
  const railMat = new THREE.MeshPhongMaterial({
    color: COLORS.gutterWall,
    shininess: 30,
  });

  // Gutter centre X: lane half-width + trough radius, so the inner rim lands
  // precisely on the lane edge (x = ±LANE.width/2) with no gap.
  const centerX = LANE.width / 2 + radius;
  const zCenter = -LANE.length / 2;

  for (const side of [-1, 1]) {
    const trough = makeTrough(channelMat);
    trough.position.set(side * centerX, -0.02, zCenter); // rim a hair below lane
    group.add(trough);

    // Low capping rail along the outer edge.
    const rail = new THREE.Mesh(
      new THREE.BoxGeometry(0.12, 0.22, GUTTER.length),
      railMat
    );
    rail.position.set(side * (LANE.width / 2 + GUTTER.width + 0.06), -0.04, zCenter);
    rail.castShadow = true;
    rail.receiveShadow = true;
    group.add(rail);
  }

  return group;
}
