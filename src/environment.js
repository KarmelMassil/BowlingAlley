/**
 * Extra props for bonus credit:
 *   - Carpeted floor beneath the raised lane.
 *   - Ball pit and masking unit behind the pin deck.
 *   - Ball-return rack with two spare balls on the approach.
 *   - Carpeted seating concourse with two benches behind the approach.
 *   - Overhead score monitor (uses the generated scoreboard texture).
 *
 * No side walls or ceiling, so they don't block the overhead/side/pin-end
 * camera presets.
 */

import { LANE, GUTTER, APPROACH, PIN_DECK, PIN_POSITIONS, BALL, GAME, COLORS } from './config.js';
import { makeCarpetTexture, makeScoreboard, makeOilTexture } from './textures.js';

const alleyHalfWidth = LANE.width / 2 + GUTTER.width + 0.3; // lane + gutters + trim

/**
 * The lane-oil pattern: a glossy, transparent "house" overlay on the front of
 * the lane. It's only a visual cue for the oil the physics applies (the ball
 * skids on the oiled front and hooks on the dry back-end).
 */
function oilPattern() {
  const mat = new THREE.MeshPhongMaterial({
    map: makeOilTexture(),
    transparent: true,
    opacity: 1,
    shininess: 170,
    specular: 0xe2eeff,
    depthWrite: false,
  });
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(LANE.width - 0.12, GAME.oilLength), mat);
  mesh.rotation.x = -Math.PI / 2;
  mesh.position.set(0, 0.014, -GAME.oilLength / 2); // just above the lane surface
  mesh.name = 'OilPattern';
  return mesh;
}

/** One carpet rectangle (its own texture so the weave density stays even). */
function carpetPiece(w, l, cx, cz) {
  const tex = makeCarpetTexture({ base: COLORS.floor, fleck: 0x2a3450 });
  tex.repeat.set(Math.max(1, w / 2.6), Math.max(1, l / 2.6));
  const mat = new THREE.MeshPhongMaterial({ map: tex, color: 0xffffff, shininess: 4 });
  const m = new THREE.Mesh(new THREE.PlaneGeometry(w, l), mat);
  m.rotation.x = -Math.PI / 2;
  m.position.set(cx, -0.4, cz);
  m.receiveShadow = true;
  return m;
}

/**
 * The carpeted floor, built with a NOTCH cut out over the ball-return subway on
 * the right side so the ball is visible rolling back underground. A transparent
 * cover sits over the notch (you can see down through it into the channel).
 */
function carpetFloor() {
  const group = new THREE.Group();
  group.name = 'Floor';

  // Subway notch bounds (matches the channel built in ballReturn()).
  const nxL = GAME.returnTrackX - 0.55;
  const nxR = GAME.returnTrackX + 0.55;
  const nzF = GAME.returnTrackFrontZ - 2; // front of the channel
  const nzB = GAME.returnMachineZ; // up to the machine
  const X0 = -13, X1 = 13, Z0 = -70, Z1 = 26;

  group.add(carpetPiece(nxL - X0, Z1 - Z0, (X0 + nxL) / 2, (Z0 + Z1) / 2)); // left of notch
  group.add(carpetPiece(X1 - nxR, Z1 - Z0, (nxR + X1) / 2, (Z0 + Z1) / 2)); // right of notch
  group.add(carpetPiece(nxR - nxL, nzF - Z0, GAME.returnTrackX, (Z0 + nzF) / 2)); // front of notch
  group.add(carpetPiece(nxR - nxL, Z1 - nzB, GAME.returnTrackX, (nzB + Z1) / 2)); // behind notch

  // Transparent cover over the open notch, so the subway is visible but enclosed.
  const glass = new THREE.Mesh(
    new THREE.PlaneGeometry(nxR - nxL, nzB - nzF),
    new THREE.MeshPhongMaterial({
      color: 0x9fb6d8,
      transparent: true,
      opacity: 0.16,
      shininess: 130,
      specular: 0xffffff,
      side: THREE.DoubleSide,
    })
  );
  glass.rotation.x = -Math.PI / 2;
  glass.position.set(GAME.returnTrackX, -0.36, (nzF + nzB) / 2);
  group.add(glass);

  return group;
}

function pitAndMaskingUnit() {
  const group = new THREE.Group();
  group.name = 'PitAndMasking';
  const w = alleyHalfWidth * 2;
  const backZ = PIN_DECK.zEnd; // -60: behind the back row of pins

  // --- The PIT: a deep, dark recessed room behind the pins that the ball and
  // the flying pins fall into. Open at the top; a floor, a back and two sides. ---
  const pitMat = new THREE.MeshPhongMaterial({ color: 0x05070b, shininess: 2 });
  const pitFloor = new THREE.Mesh(new THREE.BoxGeometry(w + 1.6, 0.2, 4.4), pitMat);
  pitFloor.position.set(0, -1.55, backZ - 1.7);
  pitFloor.receiveShadow = true;
  group.add(pitFloor);
  const pitBack = new THREE.Mesh(new THREE.BoxGeometry(w + 1.6, 2.0, 0.3), pitMat);
  pitBack.position.set(0, -0.6, backZ - 3.7);
  pitBack.receiveShadow = true;
  group.add(pitBack);
  for (const sx of [-1, 1]) {
    const side = new THREE.Mesh(new THREE.BoxGeometry(0.3, 2.0, 4.4), pitMat);
    side.position.set(sx * (w / 2 + 0.65), -0.6, backZ - 1.7);
    side.receiveShadow = true;
    group.add(side);
  }

  // --- Pit cushion: the padded shock backstop just behind the pins that arrests
  // the ball and pins so they drop into the pit. A stack of horizontal padded
  // rolls, leaning back slightly (the classic pit cushion look). ---
  const cushionMat = new THREE.MeshPhongMaterial({ color: 0x171c25, shininess: 6 });
  const cushion = new THREE.Group();
  for (let i = 0; i < 4; i++) {
    const roll = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.24, w, 12), cushionMat);
    roll.rotation.z = Math.PI / 2;
    roll.position.set(0, 0.3 + i * 0.46, 0);
    roll.castShadow = true;
    roll.receiveShadow = true;
    cushion.add(roll);
  }
  cushion.position.set(0, 0, backZ - 0.45);
  cushion.rotation.x = -0.18; // lean the cushion back over the pit
  group.add(cushion);

  // --- Masking unit: the big backdrop graphic panel above the pit that screens
  // the pinsetter machinery, set back behind the cushion so the pit reads as a
  // recess. Bottom sits a little above the pins, as on a real masking unit. ---
  const maskMat = new THREE.MeshPhongMaterial({ color: 0x1b2434, shininess: 24 });
  const mask = new THREE.Mesh(new THREE.BoxGeometry(w + 1.0, 3.4, 0.3), maskMat);
  mask.position.set(0, 3.5, backZ - 3.55);
  mask.castShadow = true;
  mask.receiveShadow = true;
  group.add(mask);
  for (const [y, col, em] of [[2.35, COLORS.foulLine, 0x551111], [4.5, COLORS.ballPrimary, 0x112255]]) {
    const stripe = new THREE.Mesh(
      new THREE.BoxGeometry(w + 1.0, 0.45, 0.04),
      new THREE.MeshPhongMaterial({ color: col, emissive: em })
    );
    stripe.position.set(0, y, backZ - 3.38);
    group.add(stripe);
  }

  return group;
}

/**
 * The ball-return system the ball actually travels through (see the matching
 * animation in game.js): an underground "subway" channel down the right side, a
 * lift tower at the bowler end that raises the ball up through the floor, and the
 * return rack/hood that cradles it. Modelled on a real belt-lift ball return.
 */
function ballReturn() {
  const group = new THREE.Group();
  group.name = 'BallReturn';
  const x = GAME.returnTrackX; // the X the ball rides on (shared with game.js)
  const machineZ = GAME.returnMachineZ;
  const ugY = GAME.returnUndergroundY;

  const bodyMat = new THREE.MeshPhongMaterial({ color: 0x2b3340, shininess: 50 });
  const darkMat = new THREE.MeshPhongMaterial({ color: 0x0c0f15, shininess: 10 });
  const trayMat = new THREE.MeshPhongMaterial({ color: 0x161b24, shininess: 30 });
  const steelMat = new THREE.MeshPhongMaterial({ color: 0x9aa1ab, specular: 0xc8ced4, shininess: 90 });

  // --- Underground subway channel: a dark U-trough running the length of the
  // lane on the right, below the floor, that the ball rolls back through. ---
  const subwayFrontZ = GAME.returnTrackFrontZ - 2; // behind the pit (collection)
  const subwayLen = machineZ - subwayFrontZ;
  const subwayZ = (machineZ + subwayFrontZ) / 2;
  const trough = new THREE.Mesh(new THREE.BoxGeometry(1.0, 0.5, subwayLen), darkMat);
  trough.position.set(x, ugY - 0.35, subwayZ); // floor of the channel
  trough.receiveShadow = true;
  group.add(trough);
  for (const sx of [-0.55, 0.55]) {
    const wall = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.9, subwayLen), bodyMat);
    wall.position.set(x + sx, ugY, subwayZ);
    wall.receiveShadow = true;
    group.add(wall);
  }

  // --- Lift tower at the machine: the ball rises up through here, out of the
  // floor, into the rack. A steel-look housing with an open front slot. ---
  const tower = new THREE.Mesh(new THREE.BoxGeometry(1.2, 2.0, 1.4), bodyMat);
  tower.position.set(x, 0.0, machineZ);
  tower.castShadow = true;
  tower.receiveShadow = true;
  group.add(tower);
  // Two belt-look strips on the front of the tower (the lift belts that carry
  // the ball up), and a dark slot between them where the ball emerges.
  const slot = new THREE.Mesh(new THREE.BoxGeometry(0.7, 1.7, 0.1), darkMat);
  slot.position.set(x, 0.1, machineZ - 0.7);
  group.add(slot);
  for (const sx of [-0.32, 0.32]) {
    const belt = new THREE.Mesh(new THREE.BoxGeometry(0.12, 1.7, 0.12), steelMat);
    belt.position.set(x + sx, 0.1, machineZ - 0.72);
    group.add(belt);
  }

  // --- Return rack hood + tray that cradles the returned balls (the visible
  // part the bowler picks up from). ---
  const housing = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.9, 2.6), bodyMat);
  housing.position.set(x, 0.05, machineZ - 1.9);
  housing.castShadow = true;
  housing.receiveShadow = true;
  group.add(housing);

  const tray = new THREE.Mesh(
    new THREE.CylinderGeometry(0.5, 0.5, 2.4, 20, 1, true, Math.PI, Math.PI),
    trayMat
  );
  tray.rotation.x = Math.PI / 2;
  tray.position.set(x, 0.55, machineZ - 1.9);
  group.add(tray);

  // A curved hood over the rack (the classic ball-return cowling).
  const hood = new THREE.Mesh(
    new THREE.CylinderGeometry(0.75, 0.75, 2.7, 22, 1, true, 0, Math.PI),
    steelMat
  );
  hood.rotation.x = Math.PI / 2;
  hood.position.set(x, 0.95, machineZ - 1.7);
  hood.castShadow = true;
  group.add(hood);

  // Two spare balls resting in the tray.
  const spareMats = [
    new THREE.MeshPhongMaterial({ color: 0x8a1f3a, specular: 0xffffff, shininess: 90 }),
    new THREE.MeshPhongMaterial({ color: 0x1f7a4a, specular: 0xffffff, shininess: 90 }),
  ];
  for (const [z, mat] of [[machineZ - 1.9, spareMats[0]], [machineZ - 1.2, spareMats[1]]]) {
    const ball = new THREE.Mesh(new THREE.SphereGeometry(BALL.radius, 32, 24), mat);
    ball.position.set(x, 0.62, z);
    ball.castShadow = true;
    ball.receiveShadow = true;
    group.add(ball);
  }

  return group;
}

/**
 * Kickback plates: the rigid side walls just outside the pins that enclose the
 * pin deck. Pins ricochet off them (the matching bounce physics is in game.js).
 */
function kickbacks() {
  const group = new THREE.Group();
  group.name = 'Kickbacks';
  const zs = PIN_POSITIONS.map((p) => p.z);
  const cz = (Math.min(...zs) + Math.max(...zs)) / 2;
  const len = Math.max(...zs) - Math.min(...zs) + 1.6;
  const plateMat = new THREE.MeshPhongMaterial({ color: 0x33405a, shininess: 40 });
  const trimMat = new THREE.MeshPhongMaterial({ color: COLORS.bumperTop, shininess: 90, specular: 0xc8ced4 });
  for (const side of [-1, 1]) {
    const plate = new THREE.Mesh(new THREE.BoxGeometry(0.12, 1.9, len), plateMat);
    plate.position.set(side * GAME.kickbackX, 0.95, cz);
    plate.castShadow = true;
    plate.receiveShadow = true;
    group.add(plate);
    // A bright trim rail along the top edge.
    const rail = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.1, len), trimMat);
    rail.position.set(side * GAME.kickbackX, 1.9, cz);
    group.add(rail);
  }
  return group;
}

/**
 * The pinsetter SETTING TABLE (the "pin picker-upper"): a table with ten
 * spotting cups that descends over the deck to set a fresh rack. The game drops
 * and lifts it (in Y) on each re-rack; the new pins drop in underneath it.
 */
export function createSetter() {
  const group = new THREE.Group();
  group.name = 'Setter';
  const zs = PIN_POSITIONS.map((p) => p.z);
  const cz = (Math.min(...zs) + Math.max(...zs)) / 2;
  const plateMat = new THREE.MeshPhongMaterial({ color: 0x2b3340, shininess: 60 });
  const cupMat = new THREE.MeshPhongMaterial({ color: 0x12161e, shininess: 30 });
  const frameMat = new THREE.MeshPhongMaterial({ color: 0x9aa1ab, specular: 0xc8ced4, shininess: 90 });

  const plate = new THREE.Mesh(new THREE.BoxGeometry(LANE.width - 0.1, 0.2, 3.6), plateMat);
  plate.position.set(0, 0.55, 0);
  plate.castShadow = true;
  group.add(plate);
  // A frame rail around the plate edge.
  const rail = new THREE.Mesh(new THREE.BoxGeometry(LANE.width + 0.05, 0.12, 0.12), frameMat);
  rail.position.set(0, 0.45, -1.85);
  group.add(rail);

  // Ten spotting cups, one over each pin position.
  for (const p of PIN_POSITIONS) {
    const cup = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.15, 0.45, 14, 1, true), cupMat);
    cup.position.set(p.x, 0.2, p.z - cz);
    group.add(cup);
  }
  group.position.set(0, GAME.setterRestY, cz);
  return group;
}

/**
 * The pinsetter SWEEP BAR (rake). Built around its own origin at deck level: the
 * teeth hang just above the deck and the bar sits above them. The game moves the
 * whole group in Y (drop / lift) and Z (rake the deadwood toward the pit).
 * Returned separately so hw6.js can add it and the game can animate it.
 */
export function createSweep() {
  const group = new THREE.Group();
  group.name = 'Sweep';
  const w = LANE.width + 0.5;
  const barMat = new THREE.MeshPhongMaterial({ color: 0x2b3340, shininess: 60 });
  const accentMat = new THREE.MeshPhongMaterial({ color: COLORS.foulLine, emissive: 0x441111 });

  // Top bar across the lane.
  const bar = new THREE.Mesh(new THREE.BoxGeometry(w, 0.3, 0.22), barMat);
  bar.position.set(0, 0.62, 0);
  bar.castShadow = true;
  group.add(bar);

  // Red guard strip on the front face of the bar.
  const strip = new THREE.Mesh(new THREE.BoxGeometry(w, 0.14, 0.03), accentMat);
  strip.position.set(0, 0.62, -0.13);
  group.add(strip);

  // Comb of teeth hanging down to just above the deck.
  const teeth = Math.round(w / 0.34);
  for (let i = 0; i <= teeth; i++) {
    const x = -w / 2 + (i * w) / teeth;
    const tooth = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.55, 0.07), barMat);
    tooth.position.set(x, 0.3, 0);
    tooth.castShadow = true;
    group.add(tooth);
  }
  return group;
}

/** One bench (seat + backrest + four legs) facing the lane, centred at z=bz. */
function makeBench(bz, woodMat, frameMat) {
  const bench = new THREE.Group();

  const seat = new THREE.Mesh(new THREE.BoxGeometry(3.6, 0.14, 0.9), woodMat);
  seat.position.set(0, 0.55, bz);
  seat.castShadow = true;
  seat.receiveShadow = true;
  bench.add(seat);

  const back = new THREE.Mesh(new THREE.BoxGeometry(3.6, 0.7, 0.12), woodMat);
  back.position.set(0, 0.95, bz + 0.4); // backrest behind, so it faces the lane
  back.castShadow = true;
  bench.add(back);

  for (const sx of [-1.6, 1.6]) {
    for (const sz of [bz - 0.35, bz + 0.35]) {
      const leg = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.55, 0.12), frameMat);
      leg.position.set(sx, 0.275, sz); // foot at y=0, resting on the concourse
      leg.castShadow = true;
      bench.add(leg);
    }
  }
  return bench;
}

/**
 * The seating area behind the approach: a raised carpeted concourse (its own
 * distinct floor, level with the approach, like a real alley) with two rows of
 * benches resting on it.
 */
function seatingArea() {
  const group = new THREE.Group();
  group.name = 'SeatingArea';

  // Carpeted concourse. Box top sits at Y=0 (level with the approach) so the
  // benches have a floor under them instead of floating above the lower floor.
  const carpetTex = makeCarpetTexture({ base: COLORS.concourse, fleck: 0x4a5f86 });
  carpetTex.repeat.set(7, 8);
  const carpetMat = new THREE.MeshPhongMaterial({ map: carpetTex, color: 0xffffff, shininess: 6 });
  const concourse = new THREE.Mesh(new THREE.BoxGeometry(12, 0.5, 15), carpetMat);
  concourse.position.set(0, -0.25, APPROACH.length + 7.5); // behind the approach
  concourse.receiveShadow = true;
  group.add(concourse);

  const woodMat = new THREE.MeshPhongMaterial({ color: 0x6b4326, shininess: 30 });
  const frameMat = new THREE.MeshPhongMaterial({ color: 0x20242c, shininess: 60 });

  // Two rows of benches facing the lane.
  group.add(makeBench(APPROACH.length + 4.5, woodMat, frameMat)); // ~z = 19.5
  group.add(makeBench(APPROACH.length + 9.5, woodMat, frameMat)); // ~z = 24.5

  return group;
}

function overheadMonitor() {
  const group = new THREE.Group();
  group.name = 'OverheadMonitor';
  const z = 1.5;
  const y = 8.0;

  // Housing.
  const housing = new THREE.Mesh(
    new THREE.BoxGeometry(4.6, 1.5, 0.3),
    new THREE.MeshPhongMaterial({ color: 0x0b0e16, shininess: 40 })
  );
  housing.position.set(0, y, z);
  housing.rotation.x = degToRad(12); // tilt the face down toward the bowler
  group.add(housing);

  // Emissive screen showing the LIVE scoreboard (updated as the game scores).
  const board = makeScoreboard();
  const screen = new THREE.Mesh(
    new THREE.PlaneGeometry(4.3, 1.25),
    new THREE.MeshBasicMaterial({ map: board.texture })
  );
  screen.position.set(0, y, z + 0.16);
  screen.rotation.x = degToRad(12);
  group.add(screen);

  // Mounting stems up to the (implied) ceiling.
  const stemMat = new THREE.MeshPhongMaterial({ color: 0x20242c });
  for (const sx of [-1.6, 1.6]) {
    const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 4, 10), stemMat);
    stem.position.set(sx, y + 2.6, z - 0.2);
    group.add(stem);
  }
  return { group, draw: board.draw };
}

function degToRad(d) {
  return (d * Math.PI) / 180;
}

/**
 * @returns {{ group: THREE.Group, updateMonitor: (scorecard) => void }}
 * the bonus props plus a hook to redraw the live overhead scoreboard.
 */
export function createEnvironment() {
  const group = new THREE.Group();
  group.name = 'Environment';
  group.add(carpetFloor());
  group.add(oilPattern());
  group.add(pitAndMaskingUnit());
  group.add(kickbacks());
  group.add(ballReturn());
  group.add(seatingArea());
  const monitor = overheadMonitor();
  group.add(monitor.group);
  return { group, updateMonitor: monitor.draw };
}
