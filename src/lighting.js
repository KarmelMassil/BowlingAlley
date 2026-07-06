/**
 * The scene's lights:
 *   - HemisphereLight for soft ambient fill.
 *   - A key DirectionalLight that casts the shadows; its orthographic shadow
 *     frustum is widened to cover the 60-unit lane so the pins and ball both
 *     cast shadows without clipping.
 *   - A dim fill DirectionalLight from the opposite side to lift the shadows.
 *   - A point light near the pin deck.
 *   - Emissive overhead panels (cosmetic glowing boxes, they don't light).
 */

import { LANE } from './config.js';

export function setupLighting(scene) {
  // Soft ambient: cool "ceiling" tint above, warm "wood" bounce below.
  const hemi = new THREE.HemisphereLight(0xbcccff, 0x4a3a2a, 0.55);
  scene.add(hemi);

  // Key light, the only shadow caster.
  const key = new THREE.DirectionalLight(0xfff4e2, 0.95);
  key.position.set(9, 26, 4);
  key.target.position.set(0, 0, -26);
  key.castShadow = true;
  key.shadow.mapSize.set(2048, 2048);
  key.shadow.camera.near = 1;
  key.shadow.camera.far = 160;
  // Orthographic frustum sized to wrap the entire lane (long axis = top/bottom).
  key.shadow.camera.left = -14;
  key.shadow.camera.right = 14;
  key.shadow.camera.top = 44;
  key.shadow.camera.bottom = -44;
  key.shadow.bias = -0.0004;
  key.shadow.normalBias = 0.02;
  scene.add(key);
  scene.add(key.target);

  // Fill light: opposite side, low intensity, no shadow.
  const fill = new THREE.DirectionalLight(0x9fb4e0, 0.3);
  fill.position.set(-12, 14, 10);
  scene.add(fill);

  // Point light near the pin deck to brighten the pins at the far end.
  const deckLight = new THREE.PointLight(0xfff0d8, 0.5, 40, 2);
  deckLight.position.set(0, 9, -57);
  scene.add(deckLight);

  // Overhead panels: emissive boxes that glow but cast no light. Grouped and
  // named so the overhead camera preset can hide them (they would otherwise
  // sit between a top-down camera and the lane).
  const panels = new THREE.Group();
  panels.name = 'OverheadPanels';
  const panelMat = new THREE.MeshBasicMaterial({ color: 0xfdf6e3 });
  const panelGeo = new THREE.BoxGeometry(LANE.width * 0.8, 0.1, 2.4);
  for (const z of [-8, -24, -40, -54]) {
    const panel = new THREE.Mesh(panelGeo, panelMat);
    panel.position.set(0, 11.5, z);
    panels.add(panel);
  }
  scene.add(panels);

  return { key, fill, hemi, deckLight, panels };
}
