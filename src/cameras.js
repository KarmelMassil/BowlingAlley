/**
 * Named camera presets (bowler / overhead / pin-end / side) and a helper to
 * snap the camera and orbit target to one of them. Bound to the number keys
 * 1-4 in hw5.js.
 */

/**
 * Each preset has a camera position, an orbit/look-at target, an up vector (it
 * keeps the straight-down overhead view stable) and an optional field of view.
 * The overhead and side presets are framed to take in the whole alley, from the
 * seating area behind the approach to the pins.
 */
export const CAMERA_PRESETS = {
  1: {
    name: 'Bowler',
    position: [0, 3.2, 12.5],
    target: [0, 0.6, -12],
    up: [0, 1, 0],
  },
  2: {
    // High top-down of the whole course (seating at +Z to the pins at -Z),
    // with a wide field of view so the full ~90-unit length fits.
    name: 'Overhead',
    position: [0.001, 62, -16.5],
    target: [0, 0, -16.5],
    up: [0, 0, -1],
    fov: 78,
  },
  3: {
    // Behind the pins, in front of the masking unit, looking back down the
    // lane toward the bowler (the classic reverse "pin-deck" angle).
    name: 'Pin-end',
    position: [0, 3.0, -61.2],
    target: [0, 0.5, -48],
    up: [0, 1, 0],
  },
  4: {
    // Elevated side angle that sweeps the whole alley: seating and ball return
    // in the near field, the lane receding to the pins.
    name: 'Side',
    position: [19, 14, 16],
    target: [0, 0.3, -22],
    up: [0, 1, 0],
    fov: 60,
  },
};

/** Default perspective field of view (degrees) for presets that don't set one. */
const DEFAULT_FOV = 60;

/** The view the scene opens on. */
export const DEFAULT_PRESET = '1';

/**
 * Snap the camera and orbit controls to a preset.
 * @param {THREE.PerspectiveCamera} camera
 * @param {OrbitControls} controls
 * @param {string|number} key  a key of CAMERA_PRESETS
 */
export function applyCameraPreset(camera, controls, key) {
  const preset = CAMERA_PRESETS[key];
  if (!preset) return;
  camera.up.set(...preset.up);
  camera.position.set(...preset.position);
  camera.fov = preset.fov || DEFAULT_FOV;
  camera.updateProjectionMatrix();
  controls.target.set(...preset.target);
  camera.lookAt(controls.target);
  controls.update();
}
