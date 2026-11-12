import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createGame, step } from '../src/engine/game.js';

// Tuile factice au format de src/engine/data/agroprom.js.
//   8 (entrée, bord) route ; 2 herbe ; 9 forêt ; 19 marais ;
//   1 bâtiment avec lieu ; tout le reste herbe.
function fakeTile() {
  const hexes = {};
  for (let n = 1; n <= 19; n++) hexes[n] = { terrain: 'herbe' };
  hexes[8] = { terrain: 'route' };
  hexes[9] = { terrain: 'foret' };
  hexes[19] = { terrain: 'marais' };
  hexes[1] = { terrain: 'batiment', lieu: 'Фабрика', abri: true };
  return { name: 'Test', entry: 8, hexes };
}

// Sans jetons suspects, rencontres ni carte Zone active : ces tests portent sur le déplacement seul.
function newGame(seed = 1) {
  const state = createGame({ seed, tile: fakeTile() });
  const zone = { ...state.zone, deck: Array(10).fill('calme') };
  return { ...state, tokens: [], encounters: [], zone };
}
const move = (to) => ({ type: 'move', to });

// Joue une suite d'actions et rend le dernier état et tous les événements.
function play(state, actions) {
  const events = [];
  for (const action of actions) {
    const result = step(state, action);
    state = result.state;
    events.push(...result.events);
  }
  return { state, events };
}

test('mise en place : 10 PA + Endurance, joueur sur l\'hexagone d\'entrée', () => {
  const state = newGame();
  assert.equal(state.ap.max, 10);
  assert.equal(state.ap.left, 10);
  assert.equal(state.player.hex, 8);
  assert.equal(state.player.previousHex, null);
  assert.equal(state.status, 'playing');
});

test('route et herbe coûtent 1 PA', () => {
  const { state } = play(newGame(), [move(2), move(8)]);
  assert.equal(state.ap.left, 8);
});

test('forêt coûte 2 PA', () => {
  const { state, events } = play(newGame(), [move(9)]);
  assert.equal(state.ap.left, 8);
  assert.deepEqual(events[0], { type: 'moved', from: 8, to: 9, cost: 2 });
});

test('un lieu coûte 1 PA', () => {
  const { state } = play(newGame(), [move(2), move(1)]);
  assert.equal(state.ap.left, 8);
  assert.equal(state.player.hex, 1);
});

test('marais : 3 PA et test de Survie (1d6 + Survie ≥ 5), sinon 1 blessure', () => {
  const outcomes = new Set();
  for (let seed = 1; seed <= 40; seed++) {
    const { state, events } = play(newGame(seed), [move(19)]);
    assert.equal(state.ap.left, 7);
    const check = events.find((e) => e.type === 'check');
    assert.equal(check.stat, 'survie');
    assert.equal(check.success, check.roll + 1 >= 5);
    assert.equal(state.player.wounds, check.success ? 0 : 1);
    outcomes.add(check.success);
  }
  assert.deepEqual([...outcomes].sort(), [false, true]);
});

test('refus si l\'hexagone n\'est pas adjacent', () => {
  const start = newGame();
  const { state, events } = step(start, move(1));
  assert.equal(state, start);
  assert.deepEqual(events, [{ type: 'refused', action: move(1), reason: 'not-adjacent' }]);
});

test('refus si les PA ne suffisent pas', () => {
  // Trois allers-retours 8 <-> 9 (forêt 2, route 1) : reste 1 PA, le marais en coûte 3.
  const { state: tired } = play(newGame(), [move(9), move(8), move(9), move(8), move(9), move(8)]);
  assert.equal(tired.ap.left, 1);
  const { state, events } = step(tired, move(19));
  assert.equal(state, tired);
  assert.equal(events[0].reason, 'not-enough-ap');
});

test('la journée finit à 0 PA', () => {
  const actions = Array.from({ length: 10 }, (_, i) => move(i % 2 === 0 ? 2 : 8));
  const { state, events } = play(newGame(), actions);
  assert.equal(state.ap.left, 0);
  assert.equal(state.status, 'night');
  assert.deepEqual(events.at(-1), { type: 'day-ended', reason: 'no-ap' });
  assert.equal(step(state, move(2)).events[0].reason, 'game-over');
});

test('sortie possible seulement depuis un hexagone de bord', () => {
  const inside = play(newGame(), [move(2)]).state;
  assert.equal(step(inside, { type: 'exit' }).events[0].reason, 'not-on-edge');

  const { state, events } = step(newGame(), { type: 'exit' });
  assert.equal(state.status, 'exited');
  assert.deepEqual(events, [{ type: 'exited', hex: 8 }]);
});

test('la position précédente est mémorisée', () => {
  const { state } = play(newGame(), [move(2), move(1)]);
  assert.equal(state.player.previousHex, 2);
});

test('action inconnue refusée', () => {
  assert.equal(step(newGame(), { type: 'danser' }).events[0].reason, 'unknown-action');
});

test('step ne modifie pas l\'état reçu', () => {
  const start = newGame();
  const snapshot = structuredClone(start);
  step(start, move(19));
  assert.deepEqual(start, snapshot);
});

test('même graine, même partie', () => {
  const actions = [move(19), move(18), move(17)];
  assert.deepEqual(play(newGame(5), actions), play(newGame(5), actions));
});
