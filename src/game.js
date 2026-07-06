/**
 * game.js — the interactive HW06 bowling game.
 *
 * Control flow (a small state machine), modelled on arcade bowling games:
 *   aiming  : ← → move the ball; an aim line shows the line. Space -> power.
 *   power   : an oscillating power bar; Space locks it -> spin.
 *   spin    : an oscillating accuracy/hook marker; Space locks it -> roll.
 *             (locking off-centre gives the ball a hook in that direction.)
 *   rolling : hand-written physics; gutter / bumper bounce; ball-pin hits.
 *   resolving / result : pins settle, score, hold so you SEE the result.
 *
 * Physics (no engine): the ball integrates position += velocity*dt with rolling
 * friction and a hook curve. Collisions are IMPULSE-based (see physics.js): the
 * ball and pins exchange momentum along their line of centres, so the heavy ball
 * deflects only a little while a struck pin is launched the way it would really
 * go. That makes a pocket hit cascade to a strike and a flat nose hit leave a
 * split, with no hand-tuned "carry" factor. Struck pins then slide, hop under
 * gravity and tumble flat. The ball finishes in the pit and is returned to the
 * bowler for the next ball, so you can pick up spares.
 *
 * THREE is a global (r128 CDN).
 */

import { BALL, LANE, GUTTER, PIN_DECK, GAME, COLORS } from './config.js';
import { applyCameraPreset, CAMERA_PRESETS } from './cameras.js';
import { resolveCircleCollision, reflect, separateCircles } from './physics.js';
import { Scorecard } from './scoring.js';
import {
  buildControlsList,
  setOrbitStatus,
  setFollowStatus,
  setBumperStatus,
  renderScorecard,
  setPower,
  setSpin,
  setMessage,
} from './gameui.js';

const UP = new THREE.Vector3(0, 1, 0);
const XAXIS = new THREE.Vector3(1, 0, 0);
const LANE_HALF = LANE.width / 2;
const GUTTER_CENTER = LANE.width / 2 + GUTTER.width / 2;

export class BowlingGame {
  constructor({ scene, camera, controls, ball, pinsGroup, bumpers, sweep, setter, sfx, onScore }) {
    this.scene = scene;
    this.camera = camera;
    this.controls = controls;
    this.ball = ball;
    this.bumpers = bumpers || null;
    this.sweep = sweep || null;
    this.setter = setter || null;
    this.sfx = sfx || {};
    this.onScore = onScore || (() => {});
    this.ballRadius = BALL.radius;
    this.ballInvMass = 1 / GAME.ballMass;
    this.pinInvMass = 1 / GAME.pinMass;

    this.pins = pinsGroup.children.map((mesh) => ({
      mesh,
      home: mesh.position.clone(),
      pos: mesh.position.clone(), // current base position (slides when knocked)
      vel: new THREE.Vector3(), // horizontal slide velocity
      vy: 0, // vertical velocity (hop under gravity when struck)
      invMass: this.pinInvMass,
      standing: true,
      moving: false,
      inPit: false, // dropped off the back of the deck
      swept: false, // raked into the pit by the sweep bar
      fallAxis: new THREE.Vector3(),
      fallAngle: 0,
      angVel: 0, // tumble angular speed
      spinAngle: 0, // spin about its own (world-up) axis while flying/sliding
      spinVel: 0,
      targetAngle: Math.PI / 2,
      dropping: false,
    }));

    // One scorecard per player (1 or 2). `scorecard` always points at whoever is
    // up, so the rest of the code (and the headless sim) is unchanged.
    this.numPlayers = 1;
    this.currentPlayer = 0;
    this.players = [new Scorecard()];
    this.scorecard = this.players[0];

    // Scratch quaternions so the per-frame pin orientation (tumble * spin) is
    // composed without allocating each frame.
    this._qTumble = new THREE.Quaternion();
    this._qSpin = new THREE.Quaternion();

    this.orbitEnabled = true;
    this.followCam = true;
    this.bumpersUp = false;
    if (this.bumpers) this.bumpers.position.y = this.bumpersUp ? 0 : -1.3; // start sunk
    this.keys = { left: false, right: false };
    this.spaceDown = false; // gate so a held Space can't fire power+hook+roll at once
    this._dir = new THREE.Vector3(); // scratch for collision launch directions
    if (this.sweep) this.sweep.position.set(0, GAME.sweepBarRestY, GAME.sweepFrontZ); // retracted
    if (this.setter) this.setter.position.y = GAME.setterRestY;
    this.pinsetterActive = false;
    this.ballReturnActive = false;
    this.gameEnded = false;
    this.pinsReady = true;

    // Roll state.
    this.state = 'aiming';
    this.aimX = 0;
    this.spin = 0;
    this.power = 0;
    this.phase = 0; // shared oscillation phase for power / spin meters
    this.velocity = new THREE.Vector3();
    this.inGutter = false;
    this.standingBefore = 10;
    this.timer = 0;
    this.messageTimer = 0;

    this._buildAimLine();
    this._initInput();
    buildControlsList();
    setOrbitStatus(this.orbitEnabled);
    setFollowStatus(this.followCam);
    setBumperStatus(this.bumpersUp);
    this._rerack();
    this._startAiming(true);
    this._renderScore();
  }

  // ---- aim line ------------------------------------------------------------
  _buildAimLine() {
    const geo = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(0, 0.03, GAME.releaseZ),
      new THREE.Vector3(0, 0.03, -56),
    ]);
    const mat = new THREE.LineDashedMaterial({ color: 0x00e0ff, dashSize: 0.6, gapSize: 0.4 });
    this.aimLine = new THREE.Line(geo, mat);
    this.aimLine.computeLineDistances();
    this.scene.add(this.aimLine);
  }

  _updateAimLine() {
    const show = this.state === 'aiming' || this.state === 'power' || this.state === 'spin';
    this.aimLine.visible = show;
    if (show) this.aimLine.position.x = this.aimX;
  }

  // ---- input ---------------------------------------------------------------
  _initInput() {
    document.addEventListener('keydown', (e) => this._onKeyDown(e));
    document.addEventListener('keyup', (e) => this._onKeyUp(e));
  }

  _onKeyUp(e) {
    if (e.key === 'ArrowLeft') this.keys.left = false;
    if (e.key === 'ArrowRight') this.keys.right = false;
    if (e.key === ' ') this.spaceDown = false; // must release before the next lock
  }

  _onKeyDown(e) {
    const k = e.key;
    if (k === ' ' || k.startsWith('Arrow')) e.preventDefault();

    // One Space action per physical press: ignore the OS key-repeat stream and
    // any Space that is still held, so holding it can't blow through
    // power -> hook -> roll in a single frame burst.
    if (k === ' ' && (e.repeat || this.spaceDown)) return;
    if (k === ' ') this.spaceDown = true;

    if (k === 'o' || k === 'O') {
      this.orbitEnabled = !this.orbitEnabled;
      setOrbitStatus(this.orbitEnabled);
      return;
    }
    if (k === 'c' || k === 'C') {
      this.followCam = !this.followCam;
      setFollowStatus(this.followCam);
      this._flash(this.followCam ? 'Follow camera ON' : 'Follow camera OFF', 'info', 1.0);
      return;
    }
    if (k === 'b' || k === 'B') {
      this.bumpersUp = !this.bumpersUp;
      setBumperStatus(this.bumpersUp);
      this._flash(this.bumpersUp ? 'Bumpers UP' : 'Bumpers DOWN', 'info', 1.0);
      return;
    }
    if (k === 'r' || k === 'R') {
      this.newGame();
      return;
    }
    if (k === 'p' || k === 'P') {
      this.togglePlayers();
      return;
    }
    if (Object.prototype.hasOwnProperty.call(CAMERA_PRESETS, k)) {
      applyCameraPreset(this.camera, this.controls, k);
      for (const n of ['OverheadMonitor', 'OverheadPanels']) {
        const o = this.scene.getObjectByName(n);
        if (o) o.visible = k !== '2';
      }
      return;
    }

    if (this.state === 'aiming') {
      if (k === 'ArrowLeft') this.keys.left = true;
      else if (k === 'ArrowRight') this.keys.right = true;
      else if (k === ' ') this._beginPower();
    } else if (this.state === 'power') {
      if (k === ' ') this._beginSpin();
    } else if (this.state === 'spin') {
      if (k === ' ') this._releaseBall();
    }
  }

  // ---- state transitions ---------------------------------------------------
  _startAiming(resetAim) {
    this.state = 'aiming';
    if (resetAim) this.aimX = 0;
    this.spin = 0;
    this.inGutter = false;
    this.velocity.set(0, 0, 0);
    this.ball.quaternion.identity();
    this.ball.position.set(this.aimX, this.ballRadius, GAME.releaseZ);
    this._applyBallColor(); // show whose turn it is
    setPower(0, false);
    setSpin(0, false);
    if (this.followCam) applyCameraPreset(this.camera, this.controls, '1');
  }

  _beginPower() {
    this.state = 'power';
    this.phase = 0;
    this.power = 0;
    setPower(0, true);
  }

  _beginSpin() {
    this.state = 'spin';
    this.phase = 0;
    setPower(this.power, true); // keep the locked power bar visible
    setSpin(0, true);
  }

  _releaseBall() {
    const speed = GAME.minSpeed + this.power * (GAME.maxSpeed - GAME.minSpeed);
    this.velocity.set(0, 0, -speed);
    this.ball.position.set(this.aimX, this.ballRadius, GAME.releaseZ);
    this.standingBefore = this._standingCount();
    this.firstContact = false; // set true on the first ball-pin contact (telemetry)
    this.inGutter = false; // a freshly released ball is never in the gutter
    this.ballInPit = false;
    this.ballReturnActive = false;
    this.state = 'rolling';
    setPower(0, false);
    setSpin(0, false);
    this.sfx.roll && this.sfx.roll(this.power);
  }

  newGame(numPlayers = this.numPlayers) {
    this.numPlayers = Math.max(1, Math.min(2, numPlayers));
    this.currentPlayer = 0;
    this.players = Array.from({ length: this.numPlayers }, () => new Scorecard());
    this.scorecard = this.players[0];
    this.gameEnded = false;
    this.ballReturnActive = false;
    this.pinsetterActive = false;
    this.pinsReady = true;
    if (this.sweep) this.sweep.position.set(0, GAME.sweepBarRestY, GAME.sweepFrontZ);
    if (this.setter) this.setter.position.y = GAME.setterRestY;
    this._rerack();
    this._startAiming(true);
    this._renderScore();
    this._flash(this.numPlayers === 2 ? 'New 2-player game' : 'New game', 'info', 1.2);
  }

  /** Toggle between one- and two-player and start a fresh game. */
  togglePlayers() {
    this.newGame(this.numPlayers === 1 ? 2 : 1);
  }

  /** Redraw every player's scorecard (current one highlighted) + the monitor. */
  _renderScore() {
    renderScorecard(this.players, this.currentPlayer, this.gameEnded);
    this.onScore(this.scorecard);
  }

  /** Tint the ball (the glossy shell, child 0) with the current player's colour. */
  _applyBallColor() {
    const col = GAME.ballColors[this.currentPlayer % GAME.ballColors.length];
    const shell = this.ball.children && this.ball.children[0];
    if (shell && shell.material && shell.material.color) shell.material.color.setHex(col);
  }

  /** Pick the next player who still has frames to bowl (-1 = game over). */
  _nextPlayer() {
    for (let i = 1; i <= this.numPlayers; i++) {
      const p = (this.currentPlayer + i) % this.numPlayers;
      if (!this.players[p].gameOver) return p;
    }
    return -1;
  }

  // ---- pins ----------------------------------------------------------------
  _standingCount() {
    return this.pins.reduce((n, p) => n + (p.standing ? 1 : 0), 0);
  }

  _rerack() {
    for (const p of this.pins) {
      p.standing = true;
      p.moving = false;
      p.inPit = false;
      p.swept = false;
      p.fallAngle = 0;
      p.angVel = 0;
      p.spinAngle = 0;
      p.spinVel = 0;
      p.vy = 0;
      p.dropping = true;
      p.vel.set(0, 0, 0);
      p.pos.copy(p.home);
      p.pos.y = p.home.y + 2.5; // pinsetter drop-in
      p.mesh.visible = true;
      p.mesh.position.copy(p.pos);
      p.mesh.quaternion.identity();
    }
  }

  _sweepFallen() {
    for (const p of this.pins) if (!p.standing) p.mesh.visible = false;
  }

  /**
   * Turn a pin's current horizontal velocity (just set by an impulse collision)
   * into the visible fall: it tips toward its travel direction, hops, tumbles
   * and spins. Called when a standing pin first goes down, and again if an
   * already-falling pin is hit again so its fall direction tracks the new push.
   */
  _launchPin(pin) {
    // Clamp the launch speed so the short lane doesn't fling pins absurdly far.
    let sp = Math.hypot(pin.vel.x, pin.vel.z);
    if (sp > GAME.pinSpeedCap) {
      const s = GAME.pinSpeedCap / sp;
      pin.vel.x *= s;
      pin.vel.z *= s;
      sp = GAME.pinSpeedCap;
    }
    const firstDown = pin.standing;
    pin.standing = false;
    pin.moving = true;
    if (firstDown) pin.fallAngle = 0;

    this._dir.set(pin.vel.x, 0, pin.vel.z);
    if (this._dir.lengthSq() < 1e-8) this._dir.set(0, 0, -1);
    this._dir.normalize();
    pin.fallAxis.copy(UP).cross(this._dir).normalize(); // tips toward travel
    pin.targetAngle = Math.PI / 2 + 0.12;
    pin.angVel = GAME.pinTumbleBase + sp * GAME.pinTumbleGain;
    pin.vy = Math.max(pin.vy, Math.min(GAME.pinHopMax, sp * GAME.pinHopFactor));
    pin.spinVel = this._dir.x * sp * GAME.pinSpinGain; // glancing hits spin it
    this.sfx.hit && this.sfx.hit(Math.min(0.9, 0.2 + sp * 0.05));
  }

  /** Integrate every moving pin, resolve pin-pin impulses, update the meshes. */
  _updatePins(dt) {
    for (const p of this.pins) {
      if (p.moving) {
        // Horizontal slide with friction (applied in air and on the ground, so
        // the slide distance — and thus how far the cascade reaches — depends on
        // the launch speed, not on how long the pin happens to be airborne).
        p.pos.x += p.vel.x * dt;
        p.pos.z += p.vel.z * dt;
        const sp = Math.hypot(p.vel.x, p.vel.z);
        const ns = Math.max(0, sp - GAME.pinSlideFriction * dt);
        if (sp > 1e-5) { p.vel.x *= ns / sp; p.vel.z *= ns / sp; }
        // Kickback plates: a pin driven into the side wall (while still on the
        // deck) ricochets back across it — real "messenger" pin action. The
        // clearance keeps a flat pin from clipping THROUGH the plate.
        const kbX = GAME.kickbackX - GAME.kickbackClearance;
        if (!p.inPit && Math.abs(p.pos.x) > kbX &&
            p.pos.z >= GAME.pitZ && p.pos.z <= PIN_DECK.zStart + 0.6) {
          p.pos.x = Math.sign(p.pos.x) * kbX;
          if (Math.sign(p.vel.x) === Math.sign(p.pos.x)) {
            p.vel.x = -p.vel.x * GAME.kickbackRestitution;
          }
        }
        // Off the back of the deck it tumbles into the pit and is out of play.
        if (!p.inPit && p.pos.z < GAME.pitZ) {
          p.inPit = true;
          p.vy = Math.min(p.vy, -2);
        }
        // Vertical: gravity, then either fall freely into the pit or land on the
        // lane. (Pit pins must NOT be clamped to the lane or they never fall.)
        p.vy -= GAME.pinGravity * dt;
        p.pos.y += p.vy * dt;
        let grounded = false;
        if (p.inPit) {
          if (p.pos.y < -3) { p.moving = false; p.vel.set(0, 0, 0); p.vy = 0; }
        } else if (p.pos.y <= p.home.y) {
          p.pos.y = p.home.y;
          p.vy = p.vy < -0.4 ? -p.vy * GAME.pinBounce : 0; // a small landing bounce
          grounded = true;
          // Hard stop on the ground so a pile of pins can't creep/jitter forever
          // from mutual contact nudges (it would never satisfy the settle test).
          if (Math.hypot(p.vel.x, p.vel.z) < 0.3) { p.vel.x = 0; p.vel.z = 0; }
        }
        // Tumble toward flat, and spin about its own axis (decays on the ground).
        if (p.fallAngle < p.targetAngle) {
          p.fallAngle = Math.min(p.targetAngle, p.fallAngle + p.angVel * dt);
        }
        p.spinAngle += p.spinVel * dt;
        if (grounded) p.spinVel *= Math.max(0, 1 - 3 * dt); // friction kills the spin
        // Settle once it is flat, grounded and at rest.
        if (!p.inPit && grounded && p.vel.x === 0 && p.vel.z === 0 && p.vy === 0 &&
            p.fallAngle >= p.targetAngle) {
          p.moving = false;
        }
      }
      if (p.dropping) {
        p.pos.y += (p.home.y - p.pos.y) * Math.min(1, dt * 6);
        if (Math.abs(p.pos.y - p.home.y) < 0.01) {
          p.pos.y = p.home.y;
          p.dropping = false;
        }
      }
      p.mesh.position.copy(p.pos);
      if (!p.standing) {
        // Lift as it topples so a flat pin RESTS on its side on the lane.
        // Rotating about the base alone would bury the lower half of the lying
        // pin under the floor (the "sunken pin" bug); the sin() lift cancels it.
        p.mesh.position.y = p.pos.y + GAME.pinRestHeight * Math.sin(Math.min(p.fallAngle, Math.PI / 2));
        // Orientation = tumble toward flat, composed with a spin about the
        // vertical axis, so the pin reads as a tumbling object, not a flat flip.
        this._qTumble.setFromAxisAngle(p.fallAxis, p.fallAngle);
        this._qSpin.setFromAxisAngle(UP, p.spinAngle);
        p.mesh.quaternion.multiplyQuaternions(this._qSpin, this._qTumble);
      }
    }

    // Pin-pin collisions: impulse along the line of centres (this is the chain
    // reaction — a driven pin transfers momentum to the pins it reaches).
    const minDist = 2 * GAME.pinContactRadius;
    const min2 = minDist * minDist;
    for (let i = 0; i < this.pins.length; i++) {
      const a = this.pins[i];
      for (let j = i + 1; j < this.pins.length; j++) {
        const b = this.pins[j];
        if (a.inPit || b.inPit) continue;
        if (!a.moving && !b.moving) continue; // both at rest: nothing to do
        const dx = b.pos.x - a.pos.x;
        const dz = b.pos.z - a.pos.z;
        if (dx * dx + dz * dz >= min2) continue;
        resolveCircleCollision(a.pos, a.vel, a.invMass, b.pos, b.vel, b.invMass, GAME.pinPinRestitution);
        separateCircles(a.pos, a.invMass, b.pos, b.invMass, minDist);
        this._reactToHit(a);
        this._reactToHit(b);
      }
    }
  }

  /** After a collision changed a pin's velocity: knock it down if it was
   *  standing, or just keep it sliding if it had already fallen. */
  _reactToHit(p) {
    const sp = Math.hypot(p.vel.x, p.vel.z);
    if (p.standing) {
      if (sp > GAME.pinKnockThreshold) this._launchPin(p);
    } else if (sp > 0.3) {
      p.moving = true;
    }
  }

  _pinsSettled() {
    // A pin is settled when it isn't moving and is either still standing, gone
    // into the pit, or has finished toppling flat.
    return this.pins.every(
      (p) => !p.moving && (p.standing || p.inPit || p.fallAngle >= p.targetAngle)
    );
  }

  // ---- physics -------------------------------------------------------------
  _updateBall(dt) {
    if (!this.inGutter) {
      // Hook is a lateral acceleration, but scaled by the lane oil: tiny in the
      // oiled front (the ball skids straight), full on the dry back-end (it hooks).
      this.velocity.x += this.spin * this._oilFactor(this.ball.position.z) * dt;
      const speed = this.velocity.length();
      const newSpeed = Math.max(0, speed - GAME.friction * dt);
      if (speed > 1e-5) this.velocity.multiplyScalar(newSpeed / speed);
    }

    this.ball.position.addScaledVector(this.velocity, dt);

    const travel = -this.velocity.z * dt;
    if (Math.abs(travel) > 1e-6) {
      this.ball.rotateOnWorldAxis(new THREE.Vector3(1, 0, 0), travel / this.ballRadius);
    }

    // Bumper (reflection) vs gutter at the lane edge.
    const edge = LANE_HALF - this.ballRadius * 0.5;
    if (!this.inGutter && Math.abs(this.ball.position.x) > edge) {
      const side = Math.sign(this.ball.position.x);
      if (this.bumpersUp) {
        // Reflect off the raised bumper: v' = v - (1+e)(v·n)n, inward normal.
        this.ball.position.x = side * edge;
        reflect(this.velocity, -side, 0, GAME.bumperRestitution);
        this.spin = -this.spin * 0.4;
        this.sfx.hit && this.sfx.hit(0.5);
      } else if (Math.abs(this.ball.position.x) > LANE_HALF) {
        this.inGutter = true;
        this.ball.position.x = side * GUTTER_CENTER;
        this.velocity.x = 0;
        this.sfx.gutter && this.sfx.gutter();
        this._flash('GUTTER', 'gutter', 1.4);
      }
    }
    if (this.inGutter) {
      this.ball.position.x = Math.sign(this.ball.position.x) * GUTTER_CENTER;
      this.ball.position.y += (GAME.gutterDropY - this.ball.position.y) * Math.min(1, dt * 6);
    }

    // Ball-pin collisions: impulse along the line of centres. The heavy ball
    // deflects only slightly; each struck pin is launched the way it really goes.
    if (!this.inGutter) {
      const reach = this.ballRadius + GAME.ballHitRadius;
      const reach2 = reach * reach;
      for (const pin of this.pins) {
        if (!pin.standing || pin.inPit) continue;
        const dx = pin.pos.x - this.ball.position.x;
        const dz = pin.pos.z - this.ball.position.z;
        if (dx * dx + dz * dz < reach2) {
          this.firstContact = true;
          resolveCircleCollision(
            this.ball.position, this.velocity, this.ballInvMass,
            pin.pos, pin.vel, pin.invMass, GAME.ballPinRestitution
          );
          separateCircles(this.ball.position, this.ballInvMass, pin.pos, pin.invMass, reach);
          this._launchPin(pin);
        }
      }
    }

    // Reached the back of the deck: the pit cushion arrests it (it does not pass
    // through the back wall) and it immediately starts toward the collection, so
    // it never freezes against the cushion.
    if (this.ball.position.z < GAME.pitZ && !this.ballInPit) {
      this.ballInPit = true;
      this.ball.position.z = GAME.pitZ;
      this.velocity.set(0, 0, 0);
      this._startReturn();
    }
  }

  _rollEnded() {
    return this.ballInPit || this.velocity.length() < GAME.stopSpeed;
  }

  /** Lane-oil hook multiplier at lane position z (foul line 0 .. pins -60):
   *  near-zero in the oiled front (skid), ramping to full on the dry back-end. */
  _oilFactor(z) {
    const dryStart = -GAME.oilLength;
    if (z > dryStart) return GAME.oilSkid;
    const t = Math.min(1, (dryStart - z) / GAME.oilTransition);
    return GAME.oilSkid + (GAME.oilDry - GAME.oilSkid) * smooth(t);
  }

  // ---- cameras -------------------------------------------------------------
  _followBallCamera(dt) {
    const b = this.ball.position;
    const desired = new THREE.Vector3(b.x * 0.4, 3.0, b.z + 6.5);
    this.camera.up.set(0, 1, 0);
    this.camera.position.lerp(desired, Math.min(1, dt * 3));
    this.camera.lookAt(b.x * 0.4, 0.6, b.z - 6);
  }

  _watchPinsCamera(dt) {
    const desired = new THREE.Vector3(2.6, 3.0, -51);
    this.camera.up.set(0, 1, 0);
    this.camera.position.lerp(desired, Math.min(1, dt * 2.5));
    this.camera.lookAt(0, 0.4, -58.5);
  }

  _watchReturnCamera(dt) {
    const desired = new THREE.Vector3(GAME.returnTrackX + 3.5, 3.6, GAME.returnMachineZ - 7);
    this.camera.up.set(0, 1, 0);
    this.camera.position.lerp(desired, Math.min(1, dt * 3));
    this.camera.lookAt(GAME.returnTrackX, 0.5, GAME.returnMachineZ - 3);
  }

  // ---- resolving / scoring -------------------------------------------------
  _finalizeRoll() {
    const standingAfter = this._standingCount();
    const knocked = this.standingBefore - standingAfter;
    const firstBall = this.standingBefore === 10;

    if (this.inGutter) this._flash('GUTTER · 0 pins', 'gutter', GAME.resultHold);
    else if (firstBall && knocked === 10) {
      this._flash('STRIKE!', 'strike', GAME.resultHold);
      this.sfx.strike && this.sfx.strike();
    } else if (standingAfter === 0 && knocked > 0) {
      this._flash('SPARE!', 'spare', GAME.resultHold);
      this.sfx.strike && this.sfx.strike();
    } else if (knocked === 0) {
      this._flash('MISS · 0 pins', 'info', GAME.resultHold);
    } else {
      this._flash(`${knocked} pin${knocked === 1 ? '' : 's'} down`, 'info', GAME.resultHold);
    }

    this.pendingRoll = this.scorecard.addRoll(knocked);

    // Turn handling. When a player's FRAME is complete, play passes to the next
    // player who still has frames left (in two-player mode); when all players
    // have finished all ten frames, the whole game is over.
    const frameDone = this.pendingRoll.frameComplete || this.pendingRoll.gameOver;
    const nextPlayer = frameDone ? this._nextPlayer() : this.currentPlayer;

    if (frameDone && nextPlayer === -1) {
      this.gameEnded = true;
      this.pinsReady = true; // let the ball finish returning; no re-rack
      this.state = 'gameover';
      this.currentPlayer = 0;
      this.scorecard = this.players[0];
      this._renderScore();
      setMessage(this._gameOverMessage(), 'over');
      return;
    }

    if (frameDone && nextPlayer !== this.currentPlayer) {
      // Hand off to the other player — they bowl a fresh frame, so re-rack.
      this.currentPlayer = nextPlayer;
      this.scorecard = this.players[nextPlayer];
      this._flash(`Player ${nextPlayer + 1}'s turn`, 'info', GAME.resultHold);
      this._startPinsetter(true);
    } else {
      // Same player continues; re-rack on a new frame or when the card asks.
      this._startPinsetter(frameDone || this.pendingRoll.resetRack);
    }
    this._renderScore();
    this.state = 'clearing';
  }

  _gameOverMessage() {
    if (this.numPlayers === 1) {
      return `GAME OVER · Final ${this.players[0].totals().total} — press R for a new game`;
    }
    const t = this.players.map((p) => p.totals().total);
    const winner = t[0] === t[1] ? "It's a tie" : t[0] > t[1] ? 'Player 1 wins' : 'Player 2 wins';
    return `GAME OVER · P1 ${t[0]} · P2 ${t[1]} · ${winner} — press R`;
  }

  /** Begin the full pinsetter cycle (sweep guard -> table picks up the standing
   *  pins -> sweep rakes the deadwood -> table sets the pins back). Cosmetic plus
   *  the logical pin reset (a re-rack swaps in a fresh set). */
  _startPinsetter(rerack) {
    this.pinsetterActive = true;
    this.pinsetterT = 0;
    this.pinsetterRerack = rerack;
    this.freshSet = false;
    this.pinsReady = false;
    for (const p of this.pins) p.swept = false;
  }

  _updatePinsetter(dt) {
    if (!this.pinsetterActive) return;
    this.pinsetterT += dt;
    const s = Math.min(1, this.pinsetterT / GAME.pinsetterDuration);
    const swRest = GAME.sweepBarRestY, swDeck = GAME.sweepDeckY;
    const front = GAME.sweepFrontZ, back = GAME.sweepBackZ;
    const tRest = GAME.setterRestY, tPick = GAME.setterPickY;

    // --- sweep bar: drop to guard, wait while the table lifts the pins, rake
    //     the deadwood to the pit, then retract. ---
    let barY = swRest, barZ = front;
    if (s < 0.12) barY = lerp(swRest, swDeck, smooth(s / 0.12));
    else if (s < 0.46) { barY = swDeck; barZ = front; }
    else if (s < 0.66) { barY = swDeck; barZ = lerp(front, back, smooth((s - 0.46) / 0.2)); }
    else if (s < 0.74) { barY = lerp(swDeck, swRest, smooth((s - 0.66) / 0.08)); barZ = back; }
    if (this.sweep) this.sweep.position.set(0, barY, barZ);

    // --- table: descend onto the pins, lift them clear, hold, set them back. ---
    let tY = tRest;
    if (s >= 0.12 && s < 0.32) tY = lerp(tRest, tPick, smooth((s - 0.12) / 0.2)); // descend & grip
    else if (s >= 0.32 && s < 0.46) tY = lerp(tPick, tRest, smooth((s - 0.32) / 0.14)); // lift clear
    else if (s >= 0.46 && s < 0.74) tY = tRest; // hold up while the sweep rakes
    else if (s >= 0.74 && s < 0.92) tY = lerp(tRest, tPick, smooth((s - 0.74) / 0.18)); // set down
    else if (s >= 0.92) tY = lerp(tPick, tRest, smooth((s - 0.92) / 0.08)); // retract
    if (this.setter) this.setter.position.y = tY;

    // On a re-rack, swap in a fresh standing set just before the table sets it.
    if (this.pinsetterRerack && !this.freshSet && s >= 0.66) {
      this.freshSet = true;
      for (const p of this.pins) {
        p.standing = true; p.moving = false; p.inPit = false; p.swept = false;
        p.fallAngle = 0; p.angVel = 0; p.spinAngle = 0; p.spinVel = 0; p.vy = 0;
        p.dropping = false; p.vel.set(0, 0, 0);
        p.pos.copy(p.home); p.mesh.visible = true; p.mesh.quaternion.identity();
      }
    }

    const gripped = s >= 0.32 && s < 0.92; // standing pins ride with the table
    for (const p of this.pins) {
      if (p.standing) {
        p.pos.y = gripped ? tY - GAME.setterPickY : p.home.y; // carried, else on the deck
        p.mesh.position.copy(p.pos);
      } else if (!p.swept) {
        // Deadwood: the rake pushes it into the pit as it passes.
        if (barY < swRest - 0.3 && barZ < front - 0.1 && barZ <= p.pos.z + 0.2) {
          p.pos.z = Math.min(p.pos.z, barZ - 0.25);
          if (p.pos.z < GAME.pitZ) { p.swept = true; p.mesh.visible = false; }
          p.mesh.position.copy(p.pos);
        }
      }
    }

    if (s >= 1) {
      this.pinsetterActive = false;
      this.pinsReady = true; // the deck is set; the ball may now emerge
      if (this.sweep) this.sweep.position.set(0, swRest, front);
      if (this.setter) this.setter.position.y = tRest;
    }
  }

  /** Start the ball's journey to the collection the INSTANT it reaches the pit,
   *  so it never freezes at the cushion. It drops in, rides the subway, WAITS at
   *  the lift until the pinsetter has set the deck, then is lifted and delivered. */
  _startReturn() {
    this.ballReturnActive = true;
    this.ballPhase = 'fall';
    this.ballPhaseT = 0;
    this.pinsReady = false; // wait underground until this roll's pinsetter is done
    this._r0 = this.ball.position.clone();
  }

  // ---- per-frame -----------------------------------------------------------
  _flash(text, kind, seconds) {
    setMessage(text, kind);
    this.messageTimer = seconds;
  }

  _updateBumpers(dt) {
    if (!this.bumpers) return;
    const targetY = this.bumpersUp ? 0 : -1.3; // sink into the floor when down
    this.bumpers.position.y += (targetY - this.bumpers.position.y) * Math.min(1, dt * 6);
  }

  update(dt) {
    dt = Math.min(dt, 0.05);

    if (this.messageTimer > 0) {
      this.messageTimer -= dt;
      if (this.messageTimer <= 0 && this.state !== 'gameover') setMessage('');
    }

    if (this.state === 'aiming') {
      const move = (this.keys.right ? 1 : 0) - (this.keys.left ? 1 : 0);
      if (move !== 0) {
        this.aimX = Math.max(-GAME.aimRange, Math.min(GAME.aimRange, this.aimX + move * GAME.aimStep * dt));
      }
      this.ball.position.set(this.aimX, this.ballRadius, GAME.releaseZ);
    } else if (this.state === 'power') {
      this.phase += GAME.powerCyclesPerSec * dt;
      this.power = triangle(this.phase);
      setPower(this.power, true);
    } else if (this.state === 'spin') {
      this.phase += GAME.spinCyclesPerSec * dt;
      this.spin = (triangle(this.phase) * 2 - 1) * GAME.spinMax; // -max..+max
      setSpin(this.spin / GAME.spinMax, true);
    } else if (this.state === 'rolling') {
      this._updateBall(dt);
      if (this._rollEnded()) {
        this.state = 'resolving';
        this.timer = 0;
      }
    } else if (this.state === 'resolving') {
      this.timer += dt;
      if (this._pinsSettled() && this.timer > GAME.resolveSettleDelay) this._finalizeRoll();
    } else if (this.state === 'clearing') {
      this._updatePinsetter(dt); // sweep + setting table run the reset cycle
    }

    // The ball return runs whenever it is active, across resolving/clearing, so
    // the ball is always moving toward the collection (never stuck at the wall).
    this._updateReturn(dt);
    this._updatePins(dt);
    this._updateBumpers(dt);
    this._updateAimLine();

    // Camera: follow during the roll, watch the deck while the pinsetter works,
    // then swing to the ball return as the ball is lifted and delivered.
    const followBall = this.state === 'rolling' && this.followCam;
    const ballEmerging = this.ballReturnActive &&
      (this.ballPhase === 'lift' || this.ballPhase === 'deliver');
    const watchReturn = this.followCam && ballEmerging;
    const watchPins = this.followCam && !watchReturn &&
      (this.state === 'resolving' || this.state === 'clearing');
    this.controls.enabled = this.orbitEnabled && !followBall && !watchPins && !watchReturn;
    if (followBall) this._followBallCamera(dt);
    else if (watchReturn) this._watchReturnCamera(dt);
    else if (watchPins) this._watchPinsCamera(dt);
    else if (this.controls.enabled) this.controls.update();
  }

  /** Drive the ball-return journey as a small sub-state machine (runs every frame
   *  while active, independent of the game state). Mirrors the real path: the ball
   *  FALLS into the pit behind the pins, is diverted sideways through the ball
   *  door, rolls back along the underground subway, waits for the deck to be set,
   *  is lifted into the rack, and is delivered to the bowler. */
  _updateReturn(dt) {
    if (!this.ballReturnActive) return;
    this.ballPhaseT += dt;
    const T = GAME.return; // phase durations
    const tx = GAME.returnTrackX;
    const ug = GAME.returnUndergroundY;
    const collZ = GAME.returnTrackFrontZ - 2; // subway entry behind the pit
    const liftZ = GAME.returnMachineZ - 2.9; // rises in the open in front of the hood
    const b = this.ball.position;
    const roll = (dz) => {
      if (Math.abs(dz) > 1e-5) this.ball.rotateOnWorldAxis(XAXIS, -dz / this.ballRadius);
    };
    const advance = (dur, next) => {
      if (this.ballPhaseT >= dur) { this.ballPhase = next; this.ballPhaseT = 0; this._r0.copy(b); }
    };

    if (this.ballPhase === 'fall') {
      // drop straight down into the pit (the collection room behind the pins)
      const e = smooth(Math.min(1, this.ballPhaseT / T.fall));
      b.set(this._r0.x, lerp(this._r0.y, ug, e), this._r0.z);
      advance(T.fall, 'todoor');
    } else if (this.ballPhase === 'todoor') {
      // roll across the pit to the ball door on the right and into the subway
      const e = smooth(Math.min(1, this.ballPhaseT / T.door));
      b.set(lerp(this._r0.x, tx, e), ug, lerp(this._r0.z, collZ, e));
      advance(T.door, 'subway');
    } else if (this.ballPhase === 'subway') {
      // roll back underground to the machine (the long leg)
      const e = smooth(Math.min(1, this.ballPhaseT / T.subway));
      const z = lerp(collZ, liftZ, e);
      roll(z - b.z);
      b.set(tx, ug, z);
      advance(T.subway, 'waiting');
    } else if (this.ballPhase === 'waiting') {
      b.set(tx, ug, liftZ); // hold at the lift until the deck is set
      if (this.pinsReady) { this.ballPhase = 'lift'; this.ballPhaseT = 0; }
    } else if (this.ballPhase === 'lift') {
      const e = smooth(Math.min(1, this.ballPhaseT / T.lift)); // raised into the rack
      b.set(tx, lerp(ug, GAME.returnTrayY, e), liftZ);
      advance(T.lift, 'deliver');
    } else if (this.ballPhase === 'deliver') {
      const e = smooth(Math.min(1, this.ballPhaseT / T.deliver)); // roll to the ready spot
      const z = lerp(liftZ, GAME.releaseZ, e);
      roll(z - b.z);
      b.set(lerp(tx, 0, e), lerp(GAME.returnTrayY, this.ballRadius, e), z);
      if (this.ballPhaseT >= T.deliver) {
        this.ballReturnActive = false;
        if (!this.gameEnded) this._startAiming(true);
      }
    }
  }
}

/** Triangle wave in [0,1] from a phase. */
function triangle(phase) {
  const p = phase % 1;
  return p < 0.5 ? p * 2 : 2 - p * 2;
}

/** Smoothstep easing on [0,1]. */
function smooth(t) {
  const x = Math.max(0, Math.min(1, t));
  return x * x * (3 - 2 * x);
}

/** Linear interpolation. */
function lerp(a, b, t) {
  return a + (b - a) * t;
}
