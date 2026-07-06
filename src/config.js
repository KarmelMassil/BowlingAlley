/**
 * Scene dimensions and colours, kept in one place so the geometry stays
 * consistent. tools/geometry_check.mjs checks these against the spec.
 *
 * Coordinate system (Three.js: +Y up, +Z toward the viewer):
 *   - Foul line at Z = 0.
 *   - Lane runs in -Z, from the foul line (0) to the pin end (-60).
 *   - Approach runs in +Z, toward the bowler.
 *   - Lane top surface is at Y = 0, so props rest on Y = 0.
 *
 * Scale: pin spacing (12 in) = 1.0 unit, so 1 unit = 12 inches.
 */

/** Convert degrees to radians (kept from the starter for API familiarity). */
export function degrees_to_radians(degrees) {
  return degrees * (Math.PI / 180);
}

/** Top of the lane surface. Everything that "sits on the lane" rests here. */
export const SURFACE_Y = 0;

export const LANE = {
  length: 60, // -Z extent: foul line (0) to pin end (-60)
  width: 3.5, // X extent (~17:1 length:width per the brief)
  thickness: 0.3, // visual board depth
};

export const APPROACH = {
  length: 15, // +Z extent behind the foul line
  width: LANE.width,
  thickness: LANE.thickness,
};

export const GUTTER = {
  width: 0.45, // channel width on each side of the lane
  depth: 0.22, // how far the channel sits below the lane surface
  length: LANE.length, // gutters run the full lane length
};

// Lane bumpers (bonus): a guard rail along each lane edge - a top rail on
// evenly spaced vertical posts, open between the posts (like a railing).
export const BUMPER = {
  height: 0.3, // top rail height above the lane
  length: LANE.length, // runs the full lane length
  postSpacing: 1.3, // gap between vertical posts (the "windows")
  postSize: 0.07, // square post cross-section
  railRadius: 0.045, // rounded top rail radius
};

export const FOUL_LINE = {
  width: LANE.width,
  depth: 0.09, // thin band along Z
  thickness: 0.012, // proud of the surface to avoid z-fighting
};

/** Approach dots: two rows of inlaid dots used by the bowler to line up. */
export const DOTS = {
  count: 7, // a centred row of 7
  radius: 0.05,
  spacing: 0.45, // X spacing, board-to-board feel
  rowZ: [2.2, 4.6], // +Z distances behind the foul line
};

/** Targeting arrows ("the arrows"): 7 inlaid chevrons in a V formation. */
export const ARROWS = {
  count: 7,
  spacing: 0.42, // X spacing between neighbouring arrows
  baseZ: -15, // central arrow distance from the foul line
  vStep: 0.7, // each step out from centre sits this much deeper (-Z)
  length: 0.45, // arrow length along Z
  width: 0.16, // arrow half-width along X
  thickness: 0.012,
};

export const PIN = {
  height: 1.25, // ~15 in
  maxRadius: 0.199, // belly, ~4.77 in diameter
  spacing: 1.0, // centre-to-centre (12 in)
  headPinZ: -57.0, // head pin distance from foul line
  rowDepth: (1.0 * Math.sqrt(3)) / 2, // equilateral row pitch ≈ 0.866
};

export const PIN_DECK = {
  // The distinct surface the pins stand on (back ~3.5 units of the lane).
  zStart: -56.3,
  zEnd: -60.0,
  width: LANE.width,
};

export const BALL = {
  radius: 0.45, // diameter ~0.9 units
  position: { x: 0, z: 8.5 }, // centred on the approach, ready position
  holeRadius: 0.045,
  holeDepth: 0.16,
};

/**
 * The ten pins in 1-2-3-4 formation, generated as an equilateral rack rather
 * than hand-typed. Index 0 is the head pin; ordering follows the standard
 * bowling numbering 1..10.
 */
export const PIN_POSITIONS = (() => {
  const positions = [];
  for (let row = 0; row < 4; row++) {
    const z = PIN.headPinZ - row * PIN.rowDepth;
    for (let k = 0; k <= row; k++) {
      const x = (k - row / 2) * PIN.spacing;
      positions.push({ x, z });
    }
  }
  return positions;
})();

/** Centre of the play area, handy as an orbit/look-at target. */
export const SCENE_CENTER = { x: 0, y: 0.5, z: -28 };

/**
 * HW06 game-play tuning. All hand-written physics is in scene units and seconds
 * (positions integrate as position += velocity * deltaTime).
 */
export const GAME = {
  releaseZ: 0.4, // ball release point, just past the foul line
  aimRange: 1.55, // |x| limit while aiming (lets you aim at either pocket)
  aimStep: 2.0, // aim move speed (units/sec) while a left/right key is held
  minSpeed: 24, // ball speed (u/s) at 0% power
  maxSpeed: 42, // ball speed (u/s) at 100% power
  ballColors: [0x1f49c0, 0xd2402f], // per-player ball colours (P1 blue, P2 red)
  friction: 2.0, // rolling deceleration (u/s^2)
  // Lane oil: the front of the lane is oiled (the ball SKIDS almost straight),
  // the back is dry (friction grips and the hook takes over) — the real
  // skid -> hook -> roll motion. oilFactor scales the hook by lane position.
  oilLength: 40, // oiled distance from the foul line (units; lane is 60 long)
  oilTransition: 9, // ramp width from oiled to dry
  oilSkid: 0.18, // hook multiplier in the oiled zone (ball holds its line)
  oilDry: 3.6, // hook multiplier in the dry back-end (ball hooks to the pocket)
  powerCyclesPerSec: 0.9, // how fast the power meter sweeps
  spinCyclesPerSec: 1.1, // how fast the spin/accuracy marker sweeps
  spinMax: 1.5, // max lateral curve acceleration at full hook (u/s^2)

  // --- collision (impulse-based; see physics.js). Masses are RELATIVE: a heavy
  // ball barely deflects while a light pin is launched along the line of centres.
  // That single fact is what makes a pocket hit cascade to a strike and a flat
  // nose hit leave a split, exactly as in real bowling (no "carry" fudge factor).
  ballMass: 7.0, // ~15 lb ball (heavy, so it keeps momentum and plows to the pit)
  pinMass: 1.0, // ~3.3 lb pin (ratio ~ real bowling, so the ball plows through)
  ballPinRestitution: 0.62, // bounciness of a ball-pin hit (visible carom)
  pinPinRestitution: 0.5, // bounciness of a pin-pin hit
  pinContactRadius: 0.24, // a pin's effective collision radius (belly ≈ 0.2)
  ballHitRadius: 0.16, // extra reach added to the ball radius for a pin hit
  pinSpeedCap: 17, // clamp a launched pin's speed for the short lane (u/s)
  pinKnockThreshold: 0.5, // a struck STANDING pin goes down once it exceeds this
  // Kickback plates: the rigid side walls just outside the pins. A pin driven
  // into one ricochets back onto the deck (the "messenger" action that clears
  // corner pins in real bowling); rigid kickbacks bounce more = more pin action.
  kickbackX: 2.3, // |x| of the kickback wall (just beyond the gutter)
  // The pin CENTRE is stopped this far inside the wall so that even a pin lying
  // flat (which extends ~0.6u) only just reaches the wall instead of clipping
  // THROUGH it. (Corner pins sit at |x|=1.5, comfortably inside this.)
  kickbackClearance: 0.6,
  // Low restitution on purpose: the wall STOPS pins (they pile against it instead
  // of flying off the deck or passing through the plate) with only a little
  // bounce-back, so it adds realism without turning a dead-centre nose hit into
  // an automatic strike (a rigid, springy wall would clear the corners every
  // time). Tuned with tools/kb_sweep.mjs: centre stays a split, pocket strikes.
  kickbackRestitution: 0.1,

  // --- struck-pin fall visuals: it slides (friction), hops under gravity with a
  // landing bounce, tumbles flat, and spins on its own axis. ---
  pinSlideFriction: 7, // ground decel of a sliding pin (slide distance ~ speed^2)
  pinGravity: 26, // gravity on an airborne pin (u/s^2)
  pinHopFactor: 0.34, // upward launch speed = horizontal launch speed * this
  pinHopMax: 5.0, // cap on a pin's hop (u/s)
  pinBounce: 0.3, // how much a pin bounces when it lands
  pinTumbleBase: 6.5, // base tumble angular speed (rad/sec)
  pinTumbleGain: 0.1, // extra tumble per unit of launch speed
  pinSpinGain: 0.7, // spin about the pin's own axis from a glancing hit (visual)
  // A pin lying on its side rests on its widest circle (the belly), so its axis
  // sits one belly-radius (PIN.maxRadius ≈ 0.199) above the lane. Toppling rotates
  // about the base, so we lift the pin by this * sin(angle) as it falls; without
  // it the flat pin would sink its lower half into the floor (the "sunken" bug).
  pinRestHeight: 0.199,

  // --- ball / lane ---
  bumperRestitution: 0.6, // how bouncy raised bumpers are (reflection)
  gutterDropY: -0.18, // ball centre Y once it drops into a gutter
  pitZ: -60.2, // back of the pin deck: ball and pins drop into the pit here
  stopSpeed: 0.9, // below this speed the ball is treated as stopped
  resolveSettleDelay: 0.5, // extra wait after pins settle before scoring
  resultHold: 1.6, // how long to show the knocked result before the next ball

  // --- ball return system (the underground "subway" path back to the bowler) ---
  // Phase durations (seconds). The ball falls into the pit, is diverted to the
  // ball door, rolls the long underground leg, then is lifted and delivered.
  return: { fall: 0.7, door: 0.7, subway: 2.6, lift: 0.7, deliver: 0.85 },
  returnTrackX: LANE.width / 2 + GUTTER.width + 0.75, // right-side return track X
  returnUndergroundY: -0.9, // ball centre while it rides the underground track
  returnTrayY: 0.62, // ball centre once lifted into the return rack/tray
  returnMachineZ: 6.0, // Z of the ball-return machine (close, so it's in view)
  returnTrackFrontZ: -56, // Z where the subway track starts behind the pit

  // --- pinsetter sweep (rake): clears the deadwood into the pit between balls ---
  sweepFrontZ: -55.8, // where the sweep bar starts (front of the pin deck)
  sweepBackZ: -60.8, // where it ends (over the pit)
  sweepBarRestY: 3.2, // raised/retracted height of the sweep bar
  sweepDeckY: 0.05, // height the bar drops to while sweeping (teeth just off the deck)

  // --- pinsetter setting table (the "pin picker-upper") ---
  setterRestY: 4.6, // retracted height of the setting table
  setterPickY: 0.85, // height it descends to so the cups grip the pin heads
  // Full pinsetter cycle, in the REAL order: sweep drops to guard -> table
  // descends and grips the standing pins and lifts them clear -> sweep rakes the
  // deadwood into the pit -> sweep retracts -> table sets the pins back down.
  pinsetterDuration: 2.8,
};

export const COLORS = {
  background: 0x10101c,
  laneWood: 0xd8b27a,
  approachWood: 0xc49a63,
  pinDeck: 0xcaa873,
  gutter: 0x232a36,
  gutterWall: 0x161b24,
  bumper: 0x9aa1ab, // brushed-steel posts/frame
  bumperTop: 0xd7dde4, // brighter top rail
  foulLine: 0xcf2b25,
  dot: 0x3a2c1d,
  arrow: 0x5d3c1d,
  pinBody: 0xf6f3ec,
  pinStripe: 0xcf2120,
  ballPrimary: 0x1f49c0,
  ballSpecular: 0xffffff,
  holes: 0x0a0a0f,
  wall: 0x202a3a,
  floor: 0x14171f,
  concourse: 0x33405a, // raised carpeted seating area behind the approach
};
