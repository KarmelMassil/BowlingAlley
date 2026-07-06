/**
 * game_sim.mjs — headless simulation of the real game logic.
 *
 * Headless Chrome throttles requestAnimationFrame, so it can't exercise the
 * rolling animation. This drives the ACTUAL src/game.js with tiny THREE/DOM
 * stubs at a fixed timestep, so the physics, gutter detection, moving-pin
 * collisions and scoring are verified (and tuned) deterministically.
 * Run with: node tools/game_sim.mjs
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

const { PIN_POSITIONS, GAME } = await import('../src/config.js');
const { BowlingGame } = await import('../src/game.js');

function makeGame() {
  const pins = { children: PIN_POSITIONS.map((p) => { const m = obj3d(); m.position.set(p.x, 0, p.z); return m; }) };
  const ball = obj3d();
  const camera = { up: new V3(), position: new V3(), fov: 60, updateProjectionMatrix() {}, lookAt() {} };
  const controls = { target: new V3(), update() {}, enabled: true };
  const scene = { add() {}, getObjectByName: () => null };
  return new BowlingGame({ scene, camera, controls, ball, pinsGroup: pins, bumpers: null, sfx: {}, onScore() {} });
}

const DT = 1 / 120;

/** Throw one ball; returns the result. */
function roll(game, { aimX = 0, spin = 0, power = 0.9, bumpers = false } = {}) {
  game.bumpersUp = bumpers;
  game.state = 'aiming';
  game.aimX = aimX;
  game.spin = spin; // u/s^2 hook
  game.update(DT);
  game.power = power;
  game._releaseBall();

  const before = game.standingBefore;
  let minZ = 0, minStanding = before, steps = 0, sawGutter = false;
  while (['rolling', 'resolving', 'clearing'].includes(game.state) && steps < 6000) {
    game.update(DT);
    minZ = Math.min(minZ, game.ball.position.z);
    minStanding = Math.min(minStanding, game._standingCount());
    if (game.inGutter) sawGutter = true;
    steps++;
  }
  return { knocked: before - minStanding, minZ, inGutter: sawGutter, steps };
}

let failures = 0;
const check = (label, cond, extra = '') => {
  if (!cond) failures++;
  console.log(`  [${cond ? 'PASS' : 'FAIL'}] ${label}${extra ? ' — ' + extra : ''}`);
};

console.log('Shot outcomes (knocked pins for various aims):');
const center = roll(makeGame(), { aimX: 0.0, spin: 0, power: 0.9 });
const pocketStraight = roll(makeGame(), { aimX: 0.25, spin: 0, power: 0.95 }); // real 1-3 pocket
const edge = roll(makeGame(), { aimX: 1.45, spin: 0, power: 0.85 });
const gutter = roll(makeGame(), { aimX: 1.45, spin: 4, power: 0.9 });
const bumperShot = roll(makeGame(), { aimX: 1.5, spin: 3, power: 0.9, bumpers: true });
console.log(`  centre(0.0)       knocked=${center.knocked}  minZ=${center.minZ.toFixed(1)}`);
console.log(`  pocket str(0.25)  knocked=${pocketStraight.knocked}`);
console.log(`  edge(1.45)        knocked=${edge.knocked}`);
console.log(`  gutter            knocked=${gutter.knocked} inGutter=${gutter.inGutter}`);
console.log(`  bumper(1.5,up)    knocked=${bumperShot.knocked} inGutter=${bumperShot.inGutter}`);

// Straight-shot aim sweep, to see the knock profile across the lane.
console.log('  -- straight aim sweep (aimX -> knocked) --');
let sweep = '';
for (let ax = -1.5; ax <= 1.51; ax += 0.15) {
  const r = roll(makeGame(), { aimX: ax, spin: 0, power: 0.95 });
  sweep += `${ax.toFixed(2)}:${r.knocked}  `;
}
console.log('     ' + sweep);

// Sweep hooks to find shots that strike (the skill path on an oiled lane: aim
// out toward the dry boards and let the ball skid, then hook back to the pocket).
console.log('  -- hook sweep (aimX, spin) -> knocked --');
let bestHook = 0;
for (const [ax, sp] of [
  [0.9, -1.5], [1.1, -1.5], [1.2, -1.5], [1.3, -1.5], [1.0, -1.2], [1.2, -1.2], [0.8, -1.5],
]) {
  const r = roll(makeGame(), { aimX: ax, spin: sp, power: 0.95 });
  bestHook = Math.max(bestHook, r.knocked);
  console.log(`     (${ax}, ${sp}) -> ${r.knocked}${r.inGutter ? ' [gutter]' : ''}`);
}

console.log('\nChecks:');
check('the ball reaches the pins', center.minZ < -56, `minZ=${center.minZ.toFixed(1)}`);
check('a good shot can strike (>=10)', Math.max(bestHook, pocketStraight.knocked) >= 10,
  `bestHook=${bestHook}, straight=${pocketStraight.knocked}`);
check('a flat centre hit is NOT an automatic strike (<10)', center.knocked < 10, `centre=${center.knocked}`);
check('an edge hit leaves most pins (<=6)', edge.knocked <= 6, `edge=${edge.knocked}`);
check('gutter ball: detected and 0 pins', gutter.inGutter && gutter.knocked === 0, `knocked=${gutter.knocked}`);
check('raised bumpers keep the ball on the lane (not a gutter)', !bumperShot.inGutter);

console.log('\nScoring integration:');
{
  const g = makeGame();
  const r1 = roll(g, { aimX: 0.25, spin: 0, power: 0.95 });
  check('first roll recorded with the right pin count',
    g.scorecard.frames[0][0] === r1.knocked, `frame1=${g.scorecard.frames[0][0]}, knocked=${r1.knocked}`);
  let guard = 0;
  while (!g.scorecard.gameOver && guard++ < 60) roll(g, { aimX: 0.25, spin: 0, power: 0.95 });
  check('game reaches game over', g.scorecard.gameOver === true);
  const total = g.scorecard.totals().total;
  check('final total in 0..300', total >= 0 && total <= 300, `total=${total}`);
}

// Spare flow: a non-strike first ball must LEAVE the standing pins for a second
// ball that can clear them — i.e. the rack isn't reset between balls and the
// ball is returned. Gutter (0) then a pocket strike (10) = a spare.
console.log('\nSpare flow (ball 1 leaves pins, ball 2 clears them):');
{
  const g = makeGame();
  roll(g, { aimX: 1.45, spin: 4, power: 0.9 }); // gutter: 0 pins
  const standingForBall2 = g._standingCount();
  const b2 = roll(g, { aimX: 0.25, spin: 0, power: 0.95 }); // clear the rack
  const disp = g.scorecard.display()[0];
  check('after a 0-pin ball, all 10 are still standing for ball 2', standingForBall2 === 10,
    `standing=${standingForBall2}`);
  check('the second ball can clear the remaining pins', b2.knocked === 10, `knocked=${b2.knocked}`);
  check('the frame scores as a SPARE', disp[1] === '/', `display=[${disp.join(',')}]`);
}

// Two-player mode: players alternate frames, each keeps its own scorecard, and
// the game ends only when BOTH have finished all ten frames.
console.log('\nTwo-player mode:');
{
  const g = makeGame();
  g.newGame(2);
  const seen = new Set();
  let guard = 0;
  while (!g.gameEnded && guard++ < 200) {
    seen.add(g.currentPlayer);
    roll(g, { aimX: 0.25, spin: 0, power: 0.9 });
  }
  check('two players are set up', g.numPlayers === 2 && g.players.length === 2);
  check('both players took turns', seen.has(0) && seen.has(1));
  check('the game ends after both finish', g.gameEnded === true);
  check('both scorecards reached game over',
    g.players[0].gameOver && g.players[1].gameOver,
    `p1=${g.players[0].gameOver}, p2=${g.players[1].gameOver}`);
  const t = g.players.map((p) => p.totals().total);
  check('both totals are valid (0..300)', t.every((x) => x >= 0 && x <= 300), `totals=${t}`);
}

console.log('\n%s', failures === 0 ? 'ALL GAME-SIM CHECKS PASSED' : `${failures} CHECK(S) FAILED`);
process.exit(failures === 0 ? 0 : 1);
