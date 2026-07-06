/**
 * Inlaid lane markings:
 *   - Foul line: a bright band across the full width at Z = 0.
 *   - Approach dots: two rows of dots on the approach (+Z).
 *   - Targeting arrows: seven darts in a V, about 15 units down the lane.
 *
 * Markings sit a couple of millimetres above their surface and use a little
 * emissive so they stay visible in shadow.
 */

import { LANE, SURFACE_Y, FOUL_LINE, DOTS, ARROWS, COLORS } from './config.js';

/** Flat dart (elongated triangle) lying on the lane, tip pointing +Z. */
function makeArrowGeometry() {
  const shape = new THREE.Shape();
  // Drawn in the XY plane with the tip at -Y. Rotating -90 deg about X lays it
  // flat and turns -Y into +Z, so the dart points back toward the bowler.
  shape.moveTo(0, -ARROWS.length / 2); // tip
  shape.lineTo(ARROWS.width, ARROWS.length / 2); // back-right
  shape.lineTo(-ARROWS.width, ARROWS.length / 2); // back-left
  shape.closePath();
  const geometry = new THREE.ShapeGeometry(shape);
  geometry.rotateX(-Math.PI / 2);
  return geometry;
}

export function createMarkings() {
  const group = new THREE.Group();
  group.name = 'Markings';

  // --- Foul line -----------------------------------------------------------
  const foulMat = new THREE.MeshPhongMaterial({
    color: COLORS.foulLine,
    emissive: COLORS.foulLine,
    emissiveIntensity: 0.25,
    shininess: 20,
  });
  const foul = new THREE.Mesh(
    new THREE.BoxGeometry(FOUL_LINE.width, FOUL_LINE.thickness, FOUL_LINE.depth),
    foulMat
  );
  foul.position.set(0, SURFACE_Y + FOUL_LINE.thickness / 2, 0);
  foul.receiveShadow = true;
  foul.name = 'FoulLine';
  group.add(foul);

  // --- Approach dots -------------------------------------------------------
  const dotMat = new THREE.MeshPhongMaterial({
    color: COLORS.dot,
    emissive: COLORS.dot,
    emissiveIntensity: 0.15,
    shininess: 10,
  });
  const dotGeo = new THREE.CylinderGeometry(DOTS.radius, DOTS.radius, 0.012, 16);
  const half = (DOTS.count - 1) / 2;
  for (const z of DOTS.rowZ) {
    for (let i = 0; i < DOTS.count; i++) {
      const dot = new THREE.Mesh(dotGeo, dotMat);
      dot.position.set((i - half) * DOTS.spacing, SURFACE_Y + 0.006, z);
      dot.receiveShadow = true;
      group.add(dot);
    }
  }

  // --- Targeting arrows ----------------------------------------------------
  const arrowMat = new THREE.MeshPhongMaterial({
    color: COLORS.arrow,
    emissive: COLORS.arrow,
    emissiveIntensity: 0.12,
    shininess: 25,
  });
  const arrowGeo = makeArrowGeometry();
  const aHalf = (ARROWS.count - 1) / 2;
  for (let i = 0; i < ARROWS.count; i++) {
    const offset = i - aHalf; // -3..+3
    const arrow = new THREE.Mesh(arrowGeo, arrowMat);
    arrow.position.set(
      offset * ARROWS.spacing,
      SURFACE_Y + 0.008,
      ARROWS.baseZ - Math.abs(offset) * ARROWS.vStep // deeper toward the edges
    );
    arrow.receiveShadow = true;
    group.add(arrow);
  }

  return group;
}
