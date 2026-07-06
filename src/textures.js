/**
 * Canvas textures drawn at runtime and wrapped in THREE.CanvasTexture, so the
 * project ships no image files. Used for the wood grain on the lane, the
 * carpet on the floor, and the overhead score monitor.
 */

/** Lerp between two integer colours, returns an rgb() string. */
function mixHex(a, b, t) {
  const ar = (a >> 16) & 255, ag = (a >> 8) & 255, ab = a & 255;
  const br = (b >> 16) & 255, bg = (b >> 8) & 255, bb = b & 255;
  const r = Math.round(ar + (br - ar) * t);
  const g = Math.round(ag + (bg - ag) * t);
  const bl = Math.round(ab + (bb - ab) * t);
  return `rgb(${r},${g},${bl})`;
}

/**
 * Maple-lane wood: long vertical boards (grain runs the length of the canvas)
 * with subtle streaks and seams between boards. Map it so the grain follows
 * the lane's long axis.
 */
export function makeWoodTexture({
  base = 0xd8b27a,
  dark = 0x9c6f3c,
  light = 0xf0d6a8,
  boards = 7,
  width = 256,
  height = 1024,
} = {}) {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');

  // Base fill.
  ctx.fillStyle = mixHex(base, base, 0);
  ctx.fillRect(0, 0, width, height);

  // Fine longitudinal grain streaks.
  for (let i = 0; i < 900; i++) {
    const x = Math.random() * width;
    const len = 60 + Math.random() * 360;
    const y = Math.random() * height;
    const t = Math.random();
    ctx.strokeStyle = mixHex(dark, light, t);
    ctx.globalAlpha = 0.05 + Math.random() * 0.09;
    ctx.lineWidth = 0.5 + Math.random() * 1.5;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.bezierCurveTo(
      x + (Math.random() - 0.5) * 6, y + len * 0.33,
      x + (Math.random() - 0.5) * 6, y + len * 0.66,
      x + (Math.random() - 0.5) * 4, y + len
    );
    ctx.stroke();
  }
  ctx.globalAlpha = 1;

  // Board seams (thin dark vertical lines splitting the lane into planks).
  const boardW = width / boards;
  ctx.strokeStyle = 'rgba(60,40,20,0.55)';
  ctx.lineWidth = 1.5;
  for (let b = 1; b < boards; b++) {
    const x = Math.round(b * boardW) + 0.5;
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, height);
    ctx.stroke();
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.anisotropy = 8;
  return texture;
}

/** Flecked carpet for the surrounding floor / approach trim (bonus). */
export function makeCarpetTexture({ base = 0x33405a, fleck = 0x46557a, size = 256 } = {}) {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = mixHex(base, base, 0);
  ctx.fillRect(0, 0, size, size);
  for (let i = 0; i < 12000; i++) {
    ctx.fillStyle = mixHex(base, fleck, Math.random());
    ctx.globalAlpha = 0.25 + Math.random() * 0.4;
    const x = Math.random() * size;
    const y = Math.random() * size;
    ctx.fillRect(x, y, 1.4, 1.4);
  }
  ctx.globalAlpha = 1;
  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  return texture;
}

/**
 * The lane-oil pattern as a transparent overlay texture: a "house" shape with
 * more oil down the middle, tapering at the edges, and fading out toward the dry
 * back-end. Mapped onto a glossy plane it reads as the oil sheen on the lane.
 * The canvas is laid out foul-line (top) -> dry end (bottom).
 */
export function makeOilTexture({ w = 48, h = 256 } = {}) {
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, w, h);
  for (let y = 0; y < h; y++) {
    const v = 1 - y / h; // 1 at the foul line, 0 at the dry end
    // Stay strong through most of the oiled length, then taper sharply at the end
    // (the "buff out" to the dry boards) so the oil edge is readable.
    const lengthFade = Math.min(1, Math.pow(Math.min(1, v * 1.15), 0.5));
    for (let x = 0; x < w; x++) {
      const edge = Math.abs(x - (w - 1) / 2) / ((w - 1) / 2); // 0 centre .. 1 edge
      const widthShape = Math.max(0.12, 1 - edge * edge); // fuller down the middle
      const a = lengthFade * widthShape * 0.92;
      ctx.fillStyle = `rgba(176,205,255,${a.toFixed(3)})`;
      ctx.fillRect(x, y, 1, 1);
    }
  }
  return new THREE.CanvasTexture(canvas);
}

/**
 * The overhead monitor's live scoreboard. Returns a CanvasTexture and a draw()
 * that re-renders the board from a Scorecard (call draw(scorecard) whenever the
 * score changes, then the texture updates on screen). draw() with no argument
 * shows an empty board.
 */
export function makeScoreboard({ width = 1024, height = 256 } = {}) {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  const texture = new THREE.CanvasTexture(canvas);
  texture.anisotropy = 4;

  function draw(scorecard) {
    const display = scorecard ? scorecard.display() : Array.from({ length: 10 }, () => ['', '']);
    const perFrame = scorecard ? scorecard.totals().perFrame : Array(10).fill(null);
    const total = scorecard ? scorecard.totals().total : 0;
    const current = scorecard && !scorecard.gameOver ? scorecard.currentFrame : -1;

    ctx.fillStyle = '#05080f';
    ctx.fillRect(0, 0, width, height);

    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#00e0ff';
    ctx.font = 'bold 40px Arial';
    ctx.fillText('LANE 1', 24, 44);
    ctx.fillStyle = '#ffd23f';
    ctx.font = 'bold 30px Arial';
    ctx.fillText('PLAYER 1', 200, 46);
    ctx.fillStyle = '#e8eefc';
    ctx.font = 'bold 34px Arial';
    ctx.textAlign = 'right';
    ctx.fillText(`TOTAL ${total}`, width - 24, 46);
    ctx.textAlign = 'left';

    const pad = 18;
    const top = 86;
    const boxH = 150;
    const boxW = (width - pad * 2) / 10;
    ctx.lineWidth = 2;
    for (let i = 0; i < 10; i++) {
      const x = pad + i * boxW;
      ctx.strokeStyle = i === current ? '#00e0ff' : '#1d2a44';
      ctx.strokeRect(x, top, boxW, boxH);
      ctx.fillStyle = '#3a4a6a';
      ctx.font = 'bold 18px Arial';
      ctx.fillText(String(i + 1), x + 6, top + 16);
      // Roll symbols across the top of the box.
      ctx.fillStyle = '#e8eefc';
      ctx.font = 'bold 30px Arial';
      ctx.textAlign = 'center';
      const syms = display[i];
      syms.forEach((s, j) => {
        ctx.fillText(s, x + ((j + 0.5) / syms.length) * boxW, top + 52);
      });
      // Cumulative total at the bottom of the box.
      if (perFrame[i] !== null) {
        ctx.fillStyle = '#00e0ff';
        ctx.font = 'bold 40px Arial';
        ctx.fillText(String(perFrame[i]), x + boxW / 2, top + boxH - 30);
      }
      ctx.textAlign = 'left';
    }
    texture.needsUpdate = true;
  }

  draw();
  return { texture, draw };
}
