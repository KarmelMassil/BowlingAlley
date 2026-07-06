# Project Configuration

Technical reference for the HW06 interactive bowling game. For the feature list,
controls and screenshots see [README.md](README.md).

## Commands

| Command          | Description                                        |
| ---------------- | -------------------------------------------------- |
| `npm install`    | Install Express (the only runtime dependency)      |
| `npm start`      | Start the static server at <http://localhost:8000> |
| `npm test`       | Run scoring + game-sim + pin-motion + geometry checks |
| `npm run verify:scoring` | Scoring engine unit tests                  |
| `npm run verify:game`    | Headless game-logic + balance simulation   |
| `npm run verify:motion`  | Pin-motion / ball-impact probe             |

There is no build or transpile step; files are served as-is.

## Runtime and Serving

- Three.js r128 is loaded from a CDN script in `index.html`, exposing a global
  `THREE`. It is not imported as a module.
- `index.js` is a small Express server that serves `index.html` at `/` and
  everything under `/src` statically.
- `src/hw6.js` and the modules use relative imports for local files and the
  global `THREE` for the library.

## Project Structure

```text
index.js / index.html      server + HTML shell (loads THREE, styles.css, hw6.js)
src/hw6.js                 orchestrator: scene, camera, lights, controls, loop, game
src/game.js                BowlingGame: state machine, physics, collisions, flow
src/physics.js             pure impulse/reflection collision math (no DOM/THREE)
src/scoring.js             pure ten-frame Scorecard (no DOM/THREE)
src/gameui.js              HUD: scorecards, power/hook meters, banners, controls
src/audio.js               synthesized sound effects (Web Audio)
src/{lane,gutters,bumpers,markings,pins,ball,environment}.js   HW05 scene + props
src/{lighting,cameras,textures}.js   lights, camera presets, canvas textures
src/styles.css             HUD styling
src/OrbitControls.js       vendored Three.js OrbitControls (do not modify)
tools/scoring_test.mjs     scoring unit tests
tools/game_sim.mjs         drives the real game.js under Node (balance, spares, 2-player)
tools/pin_motion_probe.mjs pin fly/scatter/rest + ball impact probe
tools/geometry_check.mjs   scene-dimension checks
screenshots/               gameplay + bonus-system screenshots
```

Note: `src/environment.js` also builds the bonus props (kickback plates, pit room
and cushion, masking unit, the pinsetter sweep + setting table, the ball-return
subway / lift / rack, and the lane-oil overlay).

## Coordinate System and Scale

- Three.js convention: +Y up, +Z toward the viewer (shared with HW05).
- Foul line at Z = 0; lane runs to Z = -60; head pin at Z = -57.
- Lane top surface at Y = 0. Scale: 1 unit = 12 inches.

## Game Loop and Physics

- The render loop is `animate()` in `hw6.js`: `game.update(clock.getDelta())`
  then `renderer.render(...)`.
- The ball integrates as `position += velocity * deltaTime` with rolling
  friction and a hook curve that is scaled by **lane oil** (the ball skids on the
  oiled front and hooks on the dry back-end).
- Collisions are **impulse-based** (`src/physics.js`): ball-pin and pin-pin
  contacts exchange momentum along the line of centres (heavy ball, light pins),
  and the bumpers / kickbacks reflect with restitution. Struck pins then slide,
  hop under gravity and tumble. All hand-written; no external physics engine.
- All tuning constants live in the `GAME` block of `src/config.js` (speeds,
  masses/restitution, kickback, lane-oil zones, pinsetter + ball-return timings,
  per-player ball colours).

## Controls (summary)

← → aim, **Space** locks power then hook then rolls (one press each), R new game,
**P** toggle 1/2 players, B bumpers, C follow camera, O orbit, 1-4 camera presets.
Full table in the README.
