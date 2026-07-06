/**
 * audio.js — synthesized sound effects (bonus), using the Web Audio API.
 *
 * No external audio files: the roll rumble, pin clack, strike chime and gutter
 * swoosh are generated with oscillators and filtered noise. Everything is
 * guarded, so it silently no-ops where audio is unavailable (e.g. headless
 * rendering) and only starts after the first key/pointer gesture (browsers
 * require a user gesture before audio can play).
 */

export function createSound() {
  let ctx = null;

  function ensure() {
    if (ctx) return ctx;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    try {
      ctx = new AC();
    } catch (e) {
      ctx = null;
    }
    return ctx;
  }

  // Browsers start the context suspended until a user gesture.
  const resume = () => {
    const c = ensure();
    if (c && c.state === 'suspended') c.resume();
  };
  window.addEventListener('keydown', resume, { once: true });
  window.addEventListener('pointerdown', resume, { once: true });

  function envGain(c, peak, attack, release) {
    const g = c.createGain();
    const t = c.currentTime;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(peak, t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + attack + release);
    return g;
  }

  function tone(freq, dur, type, peak) {
    const c = ensure();
    if (!c) return;
    const osc = c.createOscillator();
    osc.type = type;
    osc.frequency.value = freq;
    const g = envGain(c, peak, 0.01, dur);
    osc.connect(g).connect(c.destination);
    osc.start();
    osc.stop(c.currentTime + dur + 0.05);
  }

  function noiseBurst(dur, peak, filterHz) {
    const c = ensure();
    if (!c) return;
    const frames = Math.floor(c.sampleRate * dur);
    const buffer = c.createBuffer(1, frames, c.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < frames; i++) data[i] = Math.random() * 2 - 1;
    const src = c.createBufferSource();
    src.buffer = buffer;
    const filt = c.createBiquadFilter();
    filt.type = 'lowpass';
    filt.frequency.value = filterHz;
    const g = envGain(c, peak, 0.005, dur);
    src.connect(filt).connect(g).connect(c.destination);
    src.start();
  }

  return {
    /** Low rolling rumble; louder with power. */
    roll(power = 0.5) {
      noiseBurst(0.9, 0.06 + power * 0.05, 220);
      tone(70 + power * 20, 0.9, 'sine', 0.05);
    },
    /** Sharp pin clack; intensity scales the volume. */
    hit(intensity = 0.6) {
      noiseBurst(0.12, 0.05 + intensity * 0.08, 3500);
      tone(180, 0.08, 'square', 0.03 * intensity);
    },
    /** Bright ascending chime for a strike / spare. */
    strike() {
      [523, 659, 784, 1047].forEach((f, i) =>
        setTimeout(() => tone(f, 0.25, 'triangle', 0.12), i * 80)
      );
    },
    /** Descending swoosh for a gutter ball. */
    gutter() {
      const c = ensure();
      if (!c) return;
      const osc = c.createOscillator();
      osc.type = 'sawtooth';
      const t = c.currentTime;
      osc.frequency.setValueAtTime(300, t);
      osc.frequency.exponentialRampToValueAtTime(80, t + 0.5);
      const g = envGain(c, 0.08, 0.01, 0.5);
      osc.connect(g).connect(c.destination);
      osc.start();
      osc.stop(t + 0.6);
    },
  };
}
