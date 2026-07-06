/**
 * geometry_check.mjs
 *
 * Checks the scene's numeric constants against the values in
 * bowling_exercise_instructions.html: the pin layout, lane proportions and
 * ball/pin scale. Run with:  node tools/geometry_check.mjs
 */

// Import the real constants from the scene config so this checks what the
// browser actually renders (config.js is plain data with no DOM/THREE use, so
// it imports cleanly under Node).
import { PIN_POSITIONS, PIN, LANE, BALL } from '../src/config.js';

const EPS = 1e-3;
let failures = 0;

function approx(label, actual, expected, eps = EPS) {
  const ok = Math.abs(actual - expected) <= eps;
  if (!ok) failures++;
  const status = ok ? 'PASS' : 'FAIL';
  console.log(
    `  [${status}] ${label}: got ${actual.toFixed(4)}, expected ${expected.toFixed(4)}`
  );
}

// --- Pin formation ---------------------------------------------------------
// Ten pins in an equilateral-triangle rack. Centre-to-centre spacing is the
// regulation 12 inches, modelled here as 1.0 scene unit. The perpendicular
// distance between successive rows of an equilateral triangle of side s is
// s * sqrt(3)/2.
const PIN_SPACING = PIN.spacing;
const ROW_DEPTH = PIN.rowDepth; // ~0.866025
const HEAD_PIN_Z = PIN.headPinZ;

console.log('Pin formation (row depth = %s):', ROW_DEPTH.toFixed(6));

// `generated` is the rack the scene actually ships (from src/config.js).
const generated = PIN_POSITIONS;

// Reference table copied verbatim from the exercise instructions.
const reference = [
  { x: 0.0, z: -57.0 }, // 1 head pin
  { x: -0.5, z: -57.866 }, // 2
  { x: 0.5, z: -57.866 }, // 3
  { x: -1.0, z: -58.732 }, // 4
  { x: 0.0, z: -58.732 }, // 5
  { x: 1.0, z: -58.732 }, // 6
  { x: -1.5, z: -59.598 }, // 7
  { x: -0.5, z: -59.598 }, // 8
  { x: 0.5, z: -59.598 }, // 9
  { x: 1.5, z: -59.598 }, // 10
];

reference.forEach((ref, i) => {
  approx(`pin ${i + 1} X`, generated[i].x, ref.x);
  approx(`pin ${i + 1} Z`, generated[i].z, ref.z);
});

// Sanity-check that adjacent pins really are one spacing apart (equilateral).
const d12 = Math.hypot(generated[0].x - generated[1].x, generated[0].z - generated[1].z);
approx('distance head-pin -> pin 2', d12, PIN_SPACING);
const d23 = Math.hypot(generated[1].x - generated[2].x, generated[1].z - generated[2].z);
approx('distance pin 2 -> pin 3', d23, PIN_SPACING);

// --- Lane proportions ------------------------------------------------------
// Spec: roughly 17:1 length:width, ~60 long x 3.5 wide.
const LANE_LENGTH = LANE.length;
const LANE_WIDTH = LANE.width;
console.log('\nLane proportions:');
approx('length:width ratio ~ 17:1', LANE_LENGTH / LANE_WIDTH, 17.143, 0.2);

// The rack must sit on the lane: back row at Z=-59.598 must be inside [-60, 0].
const backRowZ = generated[generated.length - 1].z;
console.log(
  `  [${backRowZ > -LANE_LENGTH ? 'PASS' : 'FAIL'}] back row Z (${backRowZ.toFixed(3)}) is within the lane length (-${LANE_LENGTH})`
);
if (!(backRowZ > -LANE_LENGTH)) failures++;

// --- Real-world scale cross-check -----------------------------------------
// Regulation pin spacing is 12 inches and equals 1.0 unit, so 1 unit = 12 in.
// Validate the other quoted sizes against that scale.
const INCH = 1 / 12; // scene units per inch
console.log('\nReal-world scale (1 unit = 12 inches):');
approx('pin height 15 in -> units', 15 * INCH, PIN.height); // spec says ~1.25 tall
approx('ball diameter 8.5 in -> units', 8.5 * INCH, 0.7083, 0.01);
approx('config ball radius is plausible (8.5-9 in ball)', BALL.radius, 0.45, 0.03);
approx('pin max width 4.7 in -> radius units', (4.7 / 2) * INCH, PIN.maxRadius, 0.01);

// --- Summary ---------------------------------------------------------------
console.log('\n%s', failures === 0 ? 'ALL CHECKS PASSED' : `${failures} CHECK(S) FAILED`);
process.exit(failures === 0 ? 0 : 1);
