/**
 * Lane bumpers (bonus): a guard rail along each lane edge. Each side is a
 * rounded top rail carried on evenly spaced vertical posts, open between the
 * posts (the "windows"), plus a thin bottom kick rail tying the posts
 * together. Brushed-steel look.
 *
 * Like real lane bumpers, the rails run from the foul line and stop at the
 * pin deck, ending just before the head pin rather than continuing through
 * the pins.
 */

import { LANE, BUMPER, PIN_DECK, COLORS } from './config.js';

export function createBumpers() {
  const group = new THREE.Group();
  group.name = 'Bumpers';

  // Metallic frame: high shininess + bright specular reads as brushed steel.
  const frameMat = new THREE.MeshPhongMaterial({
    color: COLORS.bumper,
    shininess: 90,
    specular: 0x9fa6ad,
  });
  const railMat = new THREE.MeshPhongMaterial({
    color: COLORS.bumperTop,
    shininess: 110,
    specular: 0xc8ced4,
  });

  // Run from the foul line (0) to the start of the pin deck, so the rail ends
  // just ahead of the head pin (Z = -57), as real lane bumpers do.
  const zFront = 0;
  const zBack = PIN_DECK.zStart;
  const railLength = zFront - zBack;
  const zCenter = (zFront + zBack) / 2;

  // Inner face roughly at the lane edge, over the gutter's inner lip.
  const centerX = LANE.width / 2 + BUMPER.postSize;

  const postGeo = new THREE.BoxGeometry(BUMPER.postSize, BUMPER.height, BUMPER.postSize);
  const topRailGeo = new THREE.CylinderGeometry(
    BUMPER.railRadius,
    BUMPER.railRadius,
    railLength,
    14
  );
  const kickGeo = new THREE.BoxGeometry(BUMPER.postSize * 0.7, 0.05, railLength);

  for (const side of [-1, 1]) {
    const sideGroup = new THREE.Group();

    // Vertical posts at fixed spacing (open windows between them).
    for (let z = zFront; z >= zBack - 0.001; z -= BUMPER.postSpacing) {
      const post = new THREE.Mesh(postGeo, frameMat);
      post.position.set(side * centerX, BUMPER.height / 2 - 0.04, z);
      post.castShadow = true;
      post.receiveShadow = true;
      sideGroup.add(post);
    }

    // Rounded top rail along the whole run.
    const topRail = new THREE.Mesh(topRailGeo, railMat);
    topRail.rotation.x = Math.PI / 2; // lay it down the lane (+Z)
    topRail.position.set(side * centerX, BUMPER.height - 0.04, zCenter);
    topRail.castShadow = true;
    topRail.receiveShadow = true;
    sideGroup.add(topRail);

    // Thin bottom kick rail near the lane surface.
    const kick = new THREE.Mesh(kickGeo, frameMat);
    kick.position.set(side * centerX, 0.03, zCenter);
    kick.castShadow = true;
    kick.receiveShadow = true;
    sideGroup.add(kick);

    group.add(sideGroup);
  }

  return group;
}
