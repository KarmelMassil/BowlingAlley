/**
 * scoring_test.mjs — unit tests for the ten-pin scoring engine.
 *
 * Feeds known games into Scorecard (roll by roll, exactly as the game does)
 * and checks the running total and display against hand-verified values.
 * Run with:  node tools/scoring_test.mjs   (or: npm run verify:scoring)
 */

import { Scorecard } from '../src/scoring.js';

let failures = 0;

function play(rolls) {
  const card = new Scorecard();
  for (const r of rolls) card.addRoll(r);
  return card;
}

function eq(label, actual, expected) {
  const ok = actual === expected;
  if (!ok) failures++;
  console.log(`  [${ok ? 'PASS' : 'FAIL'}] ${label}: got ${actual}, expected ${expected}`);
}

function deepEq(label, actual, expected) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  if (!ok) failures++;
  console.log(
    `  [${ok ? 'PASS' : 'FAIL'}] ${label}: got ${JSON.stringify(actual)}, expected ${JSON.stringify(expected)}`
  );
}

console.log('Totals:');

// Perfect game: twelve strikes -> 300.
eq('perfect game (12 strikes)', play(Array(12).fill(10)).totals().total, 300);

// All spares with 5 (5,5 x9 then 5,5,5) -> 150.
const allFives = [];
for (let i = 0; i < 9; i++) allFives.push(5, 5);
allFives.push(5, 5, 5);
eq('all fives (every frame a spare)', play(allFives).totals().total, 150);

// All gutter balls -> 0.
eq('all gutters', play(Array(20).fill(0)).totals().total, 0);

// All nines, missing the spare each time (9,0) -> 90.
const allNines = [];
for (let i = 0; i < 10; i++) allNines.push(9, 0);
eq('all nines, no spare', play(allNines).totals().total, 90);

// Canonical Wikipedia example -> 133.
const wiki = [1, 4, 4, 5, 6, 4, 5, 5, 10, 0, 1, 7, 3, 6, 4, 10, 2, 8, 6];
eq('wikipedia example', play(wiki).totals().total, 133);

// 10th-frame variations (frames 1-9 are all open zeros).
const open18 = Array(18).fill(0);
eq('10th = X X X -> 30', play([...open18, 10, 10, 10]).totals().total, 30);
eq('10th = 5 / 7 (spare + bonus) -> 17', play([...open18, 5, 5, 7]).totals().total, 17);
eq('10th = 3 4 (open) -> 7', play([...open18, 3, 4]).totals().total, 7);

console.log('\nRunning per-frame totals (wikipedia example):');
deepEq(
  'cumulative',
  play(wiki).totals().perFrame,
  [5, 14, 29, 49, 60, 61, 77, 97, 117, 133]
);

console.log('\nDisplay symbols:');
deepEq('frame 1 of a strike', play([10]).display()[0], ['', 'X']);
deepEq('spare frame', play([7, 3]).display()[0], ['7', '/']);
deepEq('open frame with a gutter', play([0, 5]).display()[0], ['-', '5']);
deepEq('perfect 10th frame', play(Array(12).fill(10)).display()[9], ['X', 'X', 'X']);

console.log('\nGame-flow flags:');
{
  const c = new Scorecard();
  const r1 = c.addRoll(10); // frame 1 strike
  eq('strike: frameComplete', r1.frameComplete, true);
  eq('strike: resetRack', r1.resetRack, true);
  eq('strike: not over', r1.gameOver, false);

  const c2 = new Scorecard();
  c2.addRoll(3);
  const r2 = c2.addRoll(4); // open frame
  eq('open frame: resetRack', r2.resetRack, true);
  eq('open 2nd ball before that: keep rack', new Scorecard().addRoll(3).resetRack, false);
}
{
  // Whole perfect game should report game over only on the very last ball.
  const c = new Scorecard();
  let overFlags = 0;
  for (let i = 0; i < 12; i++) if (c.addRoll(10).gameOver) overFlags++;
  eq('perfect game: gameOver fires once at the end', overFlags, 1);
}

console.log('\n%s', failures === 0 ? 'ALL SCORING TESTS PASSED' : `${failures} TEST(S) FAILED`);
process.exit(failures === 0 ? 0 : 1);
