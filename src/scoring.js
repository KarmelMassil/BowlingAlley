/**
 * scoring.js — ten-pin bowling scoring (pure logic, no DOM or THREE).
 *
 * A Scorecard records the pins knocked down on each roll and knows the rules:
 * when a frame is complete, when the rack should be reset, when the game is
 * over, the running per-frame totals (with strike/spare bonuses), and the
 * symbols to print in each box (X for a strike, / for a spare, - for a miss).
 *
 * Kept free of DOM/THREE so it can be unit-tested under Node
 * (see tools/scoring_test.mjs).
 */

const STRIKE = 10;

function pip(n) {
  return n === 0 ? '-' : String(n);
}

/** Display symbols for a normal frame (frames 1-9). */
function frameSymbols(f) {
  if (f.length === 0) return ['', ''];
  if (f.length === 1) {
    return f[0] === STRIKE ? ['', 'X'] : [pip(f[0]), ''];
  }
  if (f[0] === STRIKE) return ['', 'X']; // defensive; a 1-9 strike ends at one roll
  if (f[0] + f[1] === STRIKE) return [pip(f[0]), '/'];
  return [pip(f[0]), pip(f[1])];
}

/** Display symbols for the 10th frame (up to three boxes). */
function tenthSymbols(f) {
  const s = ['', '', ''];
  if (f.length >= 1) s[0] = f[0] === STRIKE ? 'X' : pip(f[0]);
  if (f.length >= 2) {
    if (f[0] === STRIKE) s[1] = f[1] === STRIKE ? 'X' : pip(f[1]);
    else s[1] = f[0] + f[1] === STRIKE ? '/' : pip(f[1]);
  }
  if (f.length >= 3) {
    if (f[2] === STRIKE) s[2] = 'X';
    else if (f[0] === STRIKE) {
      if (f[1] === STRIKE) s[2] = pip(f[2]); // double, third ball on a fresh rack
      else s[2] = f[1] + f[2] === STRIKE ? '/' : pip(f[2]);
    } else {
      s[2] = pip(f[2]); // came here off a spare, third ball on a fresh rack
    }
  }
  return s;
}

export class Scorecard {
  constructor() {
    this.reset();
  }

  reset() {
    this.frames = [[]]; // frames[i] = pinfalls for frame i (0-based)
    this.current = 0;
    this.over = false;
  }

  get currentFrame() {
    return this.current; // 0-based index of the frame in play
  }

  get gameOver() {
    return this.over;
  }

  /**
   * Record a roll (pins knocked down this ball).
   * @returns {{frameComplete: boolean, gameOver: boolean, resetRack: boolean}}
   *   resetRack = the NEXT ball starts on a full rack of ten.
   */
  addRoll(pins) {
    if (this.over) return { frameComplete: true, gameOver: true, resetRack: false };

    const f = this.frames[this.current];
    f.push(pins);
    let frameComplete = false;
    let resetRack = false;

    if (this.current < 9) {
      // Frames 1-9: done after a strike or after the second ball.
      if ((f.length === 1 && pins === STRIKE) || f.length === 2) {
        frameComplete = true;
        this.current += 1;
        this.frames.push([]);
        resetRack = true; // a new frame always starts on a full rack
      }
    } else {
      // 10th frame: up to three balls, with fresh racks after a mark.
      const [r1, r2] = f;
      if (f.length === 1) {
        resetRack = r1 === STRIKE; // strike earns a bonus ball on a fresh rack
      } else if (f.length === 2) {
        const strike1 = r1 === STRIKE;
        const spare = !strike1 && r1 + r2 === STRIKE;
        if (strike1 || spare) {
          resetRack = spare ? true : r2 === STRIKE;
        } else {
          frameComplete = true;
          this.over = true; // open 10th frame ends the game
        }
      } else {
        frameComplete = true;
        this.over = true; // three balls thrown
      }
    }
    return { frameComplete, gameOver: this.over, resetRack };
  }

  /** Is the 10th frame finished? */
  isTenthComplete() {
    const f = this.frames[9];
    if (!f) return false;
    if (f.length === 3) return true;
    if (f.length === 2) return f[0] !== STRIKE && f[0] + f[1] < STRIKE; // open
    return false;
  }

  /**
   * Cumulative score per frame (null where a frame is not yet scorable, e.g. a
   * strike still waiting on its bonus balls) plus the grand total.
   * Recomputed from scratch each call, so it is always consistent.
   */
  totals() {
    const r = this.frames.flat();
    const perFrame = [];
    let total = 0;
    let i = 0;

    for (let frame = 0; frame < 10; frame++) {
      if (frame < 9) {
        if (i >= r.length) {
          perFrame.push(null);
          continue;
        }
        if (r[i] === STRIKE) {
          if (i + 2 < r.length) {
            total += 10 + r[i + 1] + r[i + 2];
            perFrame.push(total);
          } else {
            perFrame.push(null);
          }
          i += 1;
        } else if (i + 1 < r.length && r[i] + r[i + 1] === STRIKE) {
          if (i + 2 < r.length) {
            total += 10 + r[i + 2];
            perFrame.push(total);
          } else {
            perFrame.push(null);
          }
          i += 2;
        } else if (i + 1 < r.length) {
          total += r[i] + r[i + 1];
          perFrame.push(total);
          i += 2;
        } else {
          perFrame.push(null);
        }
      } else {
        const tenth = this.frames[9] || [];
        if (this.isTenthComplete()) {
          total += tenth.reduce((a, b) => a + b, 0);
          perFrame.push(total);
        } else {
          perFrame.push(null);
        }
      }
    }
    return { perFrame, total };
  }

  /** Per-frame box symbols for rendering the scorecard (always 10 frames). */
  display() {
    const out = [];
    for (let i = 0; i < 10; i++) {
      const f = this.frames[i] || [];
      out.push(i === 9 ? tenthSymbols(f) : frameSymbols(f));
    }
    return out;
  }
}
