/**
 * Main file for Computer Graphics Exercise 6 (interactive bowling game).
 * Sets up the renderer, camera, lights and orbit controls, builds the HW05
 * scene (lane, gutters, markings, pins, ball, environment), then hands those
 * objects to the BowlingGame, which drives the HW06 game layer (aiming, power,
 * hand-written physics, collisions, scoring) from the animation loop.
 *
 * THREE is loaded globally from the CDN in index.html; OrbitControls and the
 * prop/game modules are imported as ES modules.
 */

import { OrbitControls } from './OrbitControls.js';
import { COLORS } from './config.js';
import { createLaneSystem } from './lane.js';
import { createGutters } from './gutters.js';
import { createBumpers } from './bumpers.js';
import { createMarkings } from './markings.js';
import { createPins } from './pins.js';
import { createBall } from './ball.js';
import { setupLighting } from './lighting.js';
import { createEnvironment, createSweep, createSetter } from './environment.js';
import { BowlingGame } from './game.js';
import { createSound } from './audio.js';

// ---------------------------------------------------------------------------
// Renderer
// ---------------------------------------------------------------------------
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.outputEncoding = THREE.sRGBEncoding;
document.body.appendChild(renderer.domElement);

// ---------------------------------------------------------------------------
// Scene & camera
// ---------------------------------------------------------------------------
const scene = new THREE.Scene();
scene.background = new THREE.Color(COLORS.background);

const camera = new THREE.PerspectiveCamera(
  60,
  window.innerWidth / window.innerHeight,
  0.1,
  1000
);

// ---------------------------------------------------------------------------
// Lighting & shadows
// ---------------------------------------------------------------------------
setupLighting(scene);

// ---------------------------------------------------------------------------
// Scene props (carried over from HW05). Keep references to the ball and pins
// so the game can move and topple them.
// ---------------------------------------------------------------------------
const env = createEnvironment(); // { group, updateMonitor }
scene.add(env.group);
scene.add(createLaneSystem());
scene.add(createGutters());

const bumpers = createBumpers(); // the game raises/lowers these
scene.add(bumpers);

const sweep = createSweep(); // the game drops/rakes this to clear the deadwood
scene.add(sweep);

const setter = createSetter(); // the game lowers this to set a fresh rack
scene.add(setter);

scene.add(createMarkings());

const pins = createPins();
scene.add(pins);

const ball = createBall();
scene.add(ball);

// ---------------------------------------------------------------------------
// Orbit controls (the game decides when they are enabled vs. the follow camera)
// ---------------------------------------------------------------------------
const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.08;
controls.minDistance = 2;
controls.maxDistance = 120;

// ---------------------------------------------------------------------------
// Game
// ---------------------------------------------------------------------------
const game = new BowlingGame({
  scene,
  camera,
  controls,
  ball,
  pinsGroup: pins,
  bumpers,
  sweep,
  setter,
  sfx: createSound(),
  onScore: env.updateMonitor, // redraw the 3D scoreboard when the score changes
});

// ---------------------------------------------------------------------------
// Animation loop — delta-time driven, as the brief requires
// ---------------------------------------------------------------------------
const clock = new THREE.Clock();
function animate() {
  requestAnimationFrame(animate);
  game.update(clock.getDelta());
  renderer.render(scene, camera);
}
animate();

// ---------------------------------------------------------------------------
// Responsive resize
// ---------------------------------------------------------------------------
window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});
