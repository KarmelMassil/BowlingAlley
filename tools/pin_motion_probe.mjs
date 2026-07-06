/**
 * pin_motion_probe.mjs — confirms knocked pins actually FLY and SCATTER, not
 * just rotate in place. Drives the real game.js (same THREE/DOM stubs as
 * game_sim) and tracks each pin's peak hop height and total horizontal travel.
 * Run: node tools/pin_motion_probe.mjs
 */

class V3 {
  constructor(x = 0, y = 0, z = 0) { this.x = x; this.y = y; this.z = z; }
  set(x, y, z) { this.x = x; this.y = y; this.z = z; return this; }
  copy(v) { this.x = v.x; this.y = v.y; this.z = v.z; return this; }
  clone() { return new V3(this.x, this.y, this.z); }
  add(v) { this.x += v.x; this.y += v.y; this.z += v.z; return this; }
  addScaledVector(v, s) { this.x += v.x * s; this.y += v.y * s; this.z += v.z * s; return this; }
  multiplyScalar(s) { this.x *= s; this.y *= s; this.z *= s; return this; }
  setY(y) { this.y = y; return this; }
  length() { return Math.hypot(this.x, this.y, this.z); }
  lengthSq() { return this.x * this.x + this.y * this.y + this.z * this.z; }
  normalize() { const l = this.length() || 1; return this.multiplyScalar(1 / l); }
  cross(v) {
    const ax = this.x, ay = this.y, az = this.z;
    this.x = ay * v.z - az * v.y; this.y = az * v.x - ax * v.z; this.z = ax * v.y - ay * v.x;
    return this;
  }
  lerp(v, a) { this.x += (v.x - this.x) * a; this.y += (v.y - this.y) * a; this.z += (v.z - this.z) * a; return this; }
}
class Quat {
  identity() { return this; }
  setFromAxisAngle() { return this; }
  multiplyQuaternions() { return this; }
}
class BufferGeometry { setFromPoints() { return this; } }
class Line { constructor() { this.position = new V3(); this.visible = true; } computeLineDistances() {} }
const obj3d = () => ({ position: new V3(), quaternion: new Quat(), visible: true, rotateOnWorldAxis() {} });

global.THREE = { Vector3: V3, Quaternion: Quat, BufferGeometry, Line, LineDashedMaterial: class {} };
global.window = { addEventListener() {} };
global.document = { addEventListener() {}, getElementById: () => null, dispatchEvent() {} };

const { PIN_POSITIONS, PIN, GAME } = await import('../src/config.js');
const { BowlingGame } = await import('../src/game.js');

const pins = { children: PIN_POSITIONS.map((p) => { const m = obj3d(); m.position.set(p.x, 0, p.z); return m; }) };
const ball = obj3d();
const camera = { up: new V3(), position: new V3(), fov: 60, updateProjectionMatrix() {}, lookAt() {} };
const controls = { target: new V3(), update() {}, enabled: true };
const scene = { add() {}, getObjectByName: () => null };
const game = new BowlingGame({ scene, camera, controls, ball, pinsGroup: pins, bumpers: null, sfx: {}, onScore() {} });

const homes = game.pins.map((p) => p.home.clone());

const DT = 1 / 120;
// Warm up: let the pinsetter drop-in finish so it doesn't pollute the hop
// measurement (in real play this happens while the player aims).
game.state = 'aiming';
let warm = 0;
while (game.pins.some((p) => p.dropping) && warm++ < 600) game.update(DT);

const peakY = game.pins.map(() => 0);
const peakTravel = game.pins.map(() => 0);

game.state = 'aiming';
game.aimX = 0.25; game.spin = 0; // the real 1-3 pocket
game.update(DT);
game.power = 0.95;
game._releaseBall();

// Stop at 'result': pins have settled but have NOT been swept/re-racked yet.
let steps = 0;
let speedBefore = 0, speedAfterContact = null, ballXBefore = null, ballXAfter = 0;
let prevContact = false;
while (['rolling', 'resolving'].includes(game.state) && steps < 6000) {
  if (game.state === 'rolling' && !game.firstContact) {
    speedBefore = game.velocity.length(); // ball speed just before it hits pins
    ballXBefore = game.ball.position.x;
  }
  game.update(DT);
  if (game.state === 'rolling' && game.firstContact && !prevContact) prevContact = true;
  if (game.state === 'rolling' && prevContact) {
    speedAfterContact = game.velocity.length(); // keep updating through the pins
    ballXAfter = game.ball.position.x;
  }
  game.pins.forEach((p, i) => {
    peakY[i] = Math.max(peakY[i], p.pos.y - homes[i].y);
    peakTravel[i] = Math.max(peakTravel[i], Math.hypot(p.pos.x - homes[i].x, p.pos.z - homes[i].z));
  });
  steps++;
}

console.log('Pocket shot — per-pin motion (knocked pins should hop and travel):');
let maxHop = 0, maxTravel = 0, moved = 0, minRestY = Infinity;
let lanePins = 0;
game.pins.forEach((p, i) => {
  if (!p.standing) {
    maxHop = Math.max(maxHop, peakY[i]);
    maxTravel = Math.max(maxTravel, peakTravel[i]);
    // Only pins that settled ON the lane must rest on the surface; pins that flew
    // off the back into the pit are SUPPOSED to be below the floor.
    if (!p.inPit) { minRestY = Math.min(minRestY, p.mesh.position.y); lanePins++; }
    if (peakTravel[i] > 0.3) moved++;
    console.log(`  pin ${String(i + 1).padStart(2)}  peakHop=${peakY[i].toFixed(2)}u  travel=${peakTravel[i].toFixed(2)}u  restY=${p.mesh.position.y.toFixed(2)}${p.inPit ? ' (pit)' : ''}`);
  }
});
if (!isFinite(minRestY)) minRestY = PIN.maxRadius; // all fell into the pit
console.log(`\n  max hop   = ${maxHop.toFixed(2)} u  (pins visibly leave the floor)`);
console.log(`  max travel= ${maxTravel.toFixed(2)} u  (pins visibly scatter; spacing is 1.0 u)`);
console.log(`  pins that moved > 0.3 u: ${moved}`);

const slowed = speedBefore - (speedAfterContact ?? speedBefore);
const deflected = Math.abs(ballXAfter - (ballXBefore ?? ballXAfter));
console.log('\nBall impact (should visibly slow and deflect, not glide through):');
console.log(`  ball speed before pins = ${speedBefore.toFixed(1)} u/s`);
console.log(`  ball speed leaving pins = ${(speedAfterContact ?? 0).toFixed(1)} u/s  (lost ${slowed.toFixed(1)})`);
console.log(`  ball lateral deflection through the rack = ${deflected.toFixed(2)} u`);

const bellyBottom = minRestY - PIN.maxRadius; // lowest point of a flat pin
console.log(`\n  fallen pin axis rest Y = ${minRestY.toFixed(3)} u, belly radius = ${PIN.maxRadius.toFixed(3)} u`);
console.log(`  -> lowest point of a flat pin = ${bellyBottom.toFixed(3)} u (must be >= ~0: on the lane, not sunk)`);

const pinsOk = maxHop > 0.15 && maxTravel > 1.0 && moved >= 6;
// Deceleration is the reliable impact signal; a centred pocket shot deflects
// little because the side glances cancel (deflection is reported for info).
const ballOk = slowed > 3;
// Fallen pins must rest on top of the lane, not buried in it: the lift must be
// at least the belly radius so the widest part of a flat pin clears the floor.
const restOk = bellyBottom > -0.03 && GAME.pinRestHeight >= PIN.maxRadius - 1e-6;
const ok = pinsOk && ballOk && restOk;
console.log(`\n  ${pinsOk ? 'PASS' : 'FAIL'}: knocked pins fly and scatter (not static)`);
console.log(`  ${ballOk ? 'PASS' : 'FAIL'}: the ball reacts to the impact (slows by ${slowed.toFixed(1)} u/s)`);
console.log(`  ${restOk ? 'PASS' : 'FAIL'}: fallen pins rest on the lane (not sunk into the floor)`);
process.exit(ok ? 0 : 1);
