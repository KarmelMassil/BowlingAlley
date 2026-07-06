/**
 * The ten bowling pins. A pin is a surface of revolution (THREE.LatheGeometry)
 * built from a silhouette curve: flared foot, wide belly, narrow neck,
 * swelling head, rounded top. Two red bands wrap the neck. The pin is built
 * once and cloned across the rack (shared geometry and materials) so the ten
 * pins are cheap.
 */

import { PIN, PIN_POSITIONS, SURFACE_Y, COLORS } from './config.js';

/**
 * Silhouette control points {y: height up the pin, r: radius at that height},
 * in scene units for a 1.25-unit-tall pin. The belly peaks at PIN.maxRadius.
 * y=0 starts at a closed base; the final point closes the rounded top.
 */
const PROFILE = [
  { y: 0.0, r: 0.0 }, // closes the base disk
  { y: 0.0, r: 0.09 },
  { y: 0.02, r: 0.108 },
  { y: 0.06, r: 0.118 },
  { y: 0.14, r: 0.142 },
  { y: 0.24, r: 0.176 },
  { y: 0.3, r: 0.192 },
  { y: 0.375, r: PIN.maxRadius }, // belly (widest point)
  { y: 0.45, r: 0.192 },
  { y: 0.56, r: 0.152 },
  { y: 0.68, r: 0.112 },
  { y: 0.8, r: 0.083 },
  { y: 0.86, r: 0.078 }, // neck (narrowest)
  { y: 0.95, r: 0.092 },
  { y: 1.02, r: 0.108 }, // head swell
  { y: 1.08, r: 0.106 },
  { y: 1.14, r: 0.09 },
  { y: 1.19, r: 0.062 },
  { y: 1.23, r: 0.03 },
  { y: PIN.height, r: 0.0 }, // closes the rounded crown
];

/** Piecewise-linear radius lookup along the profile (for stripe fitting). */
function radiusAt(y) {
  for (let i = 0; i < PROFILE.length - 1; i++) {
    const a = PROFILE[i];
    const b = PROFILE[i + 1];
    if (y >= a.y && y <= b.y && b.y !== a.y) {
      const t = (y - a.y) / (b.y - a.y);
      return a.r + (b.r - a.r) * t;
    }
  }
  return PROFILE[PROFILE.length - 1].r;
}

/**
 * Thin lathe band hugging the pin surface between two heights, used for the
 * red neck stripes. `scale` pushes it slightly outside the body so it sits on
 * top of the white surface instead of z-fighting with it.
 */
function makeStripeGeometry(yMin, yMax, scale = 1.015) {
  const points = [];
  const steps = 6;
  for (let s = 0; s <= steps; s++) {
    const y = yMin + ((yMax - yMin) * s) / steps;
    points.push(new THREE.Vector2(radiusAt(y) * scale, y));
  }
  return new THREE.LatheGeometry(points, 32);
}

/** Construct one pin as a Group (white body + two red stripes). */
function buildPinTemplate() {
  const pin = new THREE.Group();
  pin.name = 'Pin';

  const bodyMat = new THREE.MeshPhongMaterial({
    color: COLORS.pinBody,
    shininess: 45,
    specular: 0x555555,
  });
  const stripeMat = new THREE.MeshPhongMaterial({
    color: COLORS.pinStripe,
    shininess: 50,
    specular: 0x553333,
  });

  const bodyGeo = new THREE.LatheGeometry(
    PROFILE.map((p) => new THREE.Vector2(p.r, p.y)),
    32
  );
  bodyGeo.computeVertexNormals();
  const body = new THREE.Mesh(bodyGeo, bodyMat);
  body.castShadow = true;
  body.receiveShadow = true;
  pin.add(body);

  // Two classic red neck stripes.
  for (const [lo, hi] of [[0.855, 0.905], [0.965, 1.015]]) {
    const stripe = new THREE.Mesh(makeStripeGeometry(lo, hi), stripeMat);
    stripe.castShadow = true;
    pin.add(stripe);
  }

  return pin;
}

/**
 * @returns {THREE.Group} all ten pins placed on the rack positions.
 */
export function createPins() {
  const group = new THREE.Group();
  group.name = 'Pins';

  const template = buildPinTemplate();
  PIN_POSITIONS.forEach((pos, i) => {
    const pin = template.clone(); // shares geometry + materials
    pin.position.set(pos.x, SURFACE_Y, pos.z);
    pin.name = `Pin_${i + 1}`;
    group.add(pin);
  });

  return group;
}
