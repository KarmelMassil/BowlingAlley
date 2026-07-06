/**
 * gameui.js — the HW06 heads-up display.
 *
 * Owns every DOM update for the game: the live 10-frame scorecard, the
 * oscillating power meter, the event/status banners, the controls list, and the
 * orbit on/off badge. It reuses the HUD containers and scorecard CSS classes
 * carried over from HW05 (see index.html and styles.css).
 *
 * Pure DOM — no THREE — so the game stays separable from how it is drawn.
 */

const $ = (id) => document.getElementById(id);

/** Fill the controls list with the HW06 key bindings. */
export function buildControlsList() {
  const list = $('controls-list');
  if (!list) return;
  const bindings = [
    { keys: ['←', '→'], label: 'Aim (line up the pocket)' },
    { keys: ['Space'], label: 'Lock power, then lock hook, then roll' },
    { keys: ['R'], label: 'Reset pins / new game' },
    { keys: ['P'], label: 'Toggle 1 / 2 players' },
    { keys: ['B'], label: 'Bumpers up / down' },
    { keys: ['C'], label: 'Follow camera on / off' },
    { keys: ['O'], label: 'Orbit camera on / off' },
    { keys: ['1-4'], label: 'Camera presets' },
  ];
  list.innerHTML = '';
  for (const b of bindings) {
    const li = document.createElement('li');
    const label = document.createElement('span');
    label.className = 'label';
    label.textContent = b.label;
    const keys = document.createElement('span');
    keys.innerHTML = b.keys.map((k) => `<kbd>${k}</kbd>`).join(' ');
    li.appendChild(label);
    li.appendChild(keys);
    list.appendChild(li);
  }
}

/** Set a green/red on/off status badge by id. */
function setBadge(id, on, onText, offText) {
  const badge = $(id);
  if (!badge) return;
  badge.textContent = on ? onText : offText;
  badge.classList.toggle('status-on', on);
  badge.classList.toggle('status-off', !on);
}

/** Update the green/red orbit badge. */
export function setOrbitStatus(enabled) {
  setBadge('orbit-status', enabled, 'Orbit: ON', 'Orbit: OFF');
}

/** Update the follow-camera badge (so you can see whether C is on). */
export function setFollowStatus(enabled) {
  setBadge('follow-status', enabled, 'Follow: ON', 'Follow: OFF');
}

/** Update the bumpers badge (so you can see whether B is up). */
export function setBumperStatus(up) {
  setBadge('bumper-status', up, 'Bumpers: UP', 'Bumpers: DOWN');
}

/**
 * Render the live scorecard(s). Accepts either a single Scorecard (one player)
 * or an array of them (multi-player); the player whose turn it is is highlighted.
 * @param {object|object[]} cards a Scorecard or an array of Scorecards
 * @param {number} [currentPlayer] index of the player up
 * @param {boolean} [gameOver] whole game finished (no active highlight)
 */
export function renderScorecard(cards, currentPlayer = 0, gameOver = false) {
  const root = $('scorecard');
  if (!root) return;
  const players = Array.isArray(cards) ? cards : [cards];
  root.innerHTML = '';

  players.forEach((card, pi) => {
    const isCurrent = pi === currentPlayer && !gameOver;
    const multi = players.length > 1;
    const row = document.createElement('div');
    row.className = 'score-row';
    if (multi && isCurrent) row.classList.add('row-active');
    if (multi && !isCurrent) row.classList.add('row-idle'); // dim the waiting player

    const label = document.createElement('div');
    label.className = 'player';
    label.textContent = `P${pi + 1} · ${card.totals().total}`;
    row.appendChild(label);

    const display = card.display();
    const { perFrame } = card.totals();
    for (let f = 0; f < 10; f++) {
      const frame = document.createElement('div');
      frame.className = f === 9 ? 'frame frame-10' : 'frame';
      // Only the player whose turn it is shows the active-frame highlight (so two
      // scorecards aren't both highlighted at once).
      if (f === card.currentFrame && !card.gameOver && (!multi || isCurrent)) {
        frame.classList.add('frame-active');
      }

      const no = document.createElement('div');
      no.className = 'frame-no';
      no.textContent = String(f + 1);
      frame.appendChild(no);

      const rolls = document.createElement('div');
      rolls.className = 'rolls';
      for (const sym of display[f]) {
        const box = document.createElement('div');
        box.className = 'roll';
        box.textContent = sym;
        rolls.appendChild(box);
      }
      frame.appendChild(rolls);

      const cum = document.createElement('div');
      cum.className = 'cumulative';
      cum.textContent = perFrame[f] === null ? '' : String(perFrame[f]);
      frame.appendChild(cum);

      row.appendChild(frame);
    }
    root.appendChild(row);
  });
}

/**
 * Show/update the power meter.
 * @param {number} value 0..1
 * @param {boolean} visible
 */
export function setPower(value, visible) {
  const meter = $('power-meter');
  const fill = $('power-fill');
  if (!meter || !fill) return;
  meter.classList.toggle('hidden', !visible);
  if (!visible) return;
  const pct = Math.max(0, Math.min(1, value));
  fill.style.width = `${(pct * 100).toFixed(1)}%`;
  // Green -> yellow -> red as power increases.
  const hue = 120 - pct * 120;
  fill.style.background = `hsl(${hue}, 85%, 50%)`;
}

/**
 * Show/update the hook (accuracy) meter — a marker that sweeps across a centred
 * track. Locking it near the centre throws straight; off-centre adds a hook.
 * @param {number} value -1..1 (left..right)
 * @param {boolean} visible
 */
export function setSpin(value, visible) {
  const meter = $('spin-meter');
  const marker = $('spin-marker');
  if (!meter || !marker) return;
  meter.classList.toggle('hidden', !visible);
  if (!visible) return;
  const v = Math.max(-1, Math.min(1, value));
  marker.style.left = `${((v + 1) / 2) * 100}%`;
}

/** Big transient event banner (STRIKE!, SPARE!, GUTTER, GAME OVER…). */
export function setMessage(text, kind = '') {
  const el = $('message-banner');
  if (!el) return;
  el.textContent = text || '';
  el.className = text ? `show ${kind}` : '';
}
