/**
 * Lane bed, approach area, and the pin deck the pins stand on. Each is a maple
 * Phong surface in a slightly different shade so the boundaries are visible.
 * Returns a THREE.Group to add to the scene.
 */

import { LANE, APPROACH, PIN_DECK, SURFACE_Y, COLORS } from './config.js';
import { makeWoodTexture } from './textures.js';

/**
 * @returns {THREE.Group} group containing the lane, approach and pin deck.
 */
export function createLaneSystem() {
  const group = new THREE.Group();
  group.name = 'LaneSystem';

  // --- Lane bed ------------------------------------------------------------
  // Long maple surface from the foul line (Z=0) to the pin end (Z=-60).
  const laneTex = makeWoodTexture({ base: COLORS.laneWood, boards: 39 });
  laneTex.repeat.set(1, 10); // tile the grain down the length so it stays crisp
  const laneMat = new THREE.MeshPhongMaterial({
    map: laneTex,
    color: 0xffffff,
    shininess: 95, // high-gloss oiled lane
    specular: 0x4d4d4d,
  });
  const lane = new THREE.Mesh(
    new THREE.BoxGeometry(LANE.width, LANE.thickness, LANE.length),
    laneMat
  );
  lane.position.set(0, SURFACE_Y - LANE.thickness / 2, -LANE.length / 2);
  lane.receiveShadow = true;
  lane.castShadow = true;
  lane.name = 'Lane';
  group.add(lane);

  // --- Approach area -------------------------------------------------------
  // Behind the foul line (+Z), a subtly darker, less glossy wood so the
  // bowler's standing area is visually distinct from the oiled lane.
  const approachTex = makeWoodTexture({ base: COLORS.approachWood, boards: 24 });
  approachTex.repeat.set(1, 3);
  const approachMat = new THREE.MeshPhongMaterial({
    map: approachTex,
    color: 0xffffff,
    shininess: 35,
    specular: 0x2a2a2a,
  });
  const approach = new THREE.Mesh(
    new THREE.BoxGeometry(APPROACH.width, APPROACH.thickness, APPROACH.length),
    approachMat
  );
  approach.position.set(0, SURFACE_Y - APPROACH.thickness / 2, APPROACH.length / 2);
  approach.receiveShadow = true;
  approach.castShadow = true;
  approach.name = 'Approach';
  group.add(approach);

  // --- Pin deck ------------------------------------------------------------
  // A distinct panel inlaid over the back of the lane where the pins stand.
  // Sits a hair above the lane to read as a separate surface (and to avoid
  // z-fighting with the lane top).
  const deckLength = Math.abs(PIN_DECK.zEnd - PIN_DECK.zStart);
  const deckTex = makeWoodTexture({ base: COLORS.pinDeck, boards: 16 });
  deckTex.repeat.set(1, 2);
  const deckMat = new THREE.MeshPhongMaterial({
    map: deckTex,
    color: 0xffffff,
    shininess: 70,
    specular: 0x3a3a3a,
  });
  const deck = new THREE.Mesh(
    new THREE.BoxGeometry(PIN_DECK.width, 0.02, deckLength),
    deckMat
  );
  deck.position.set(0, SURFACE_Y + 0.006, (PIN_DECK.zStart + PIN_DECK.zEnd) / 2);
  deck.receiveShadow = true;
  deck.name = 'PinDeck';
  group.add(deck);

  return group;
}
