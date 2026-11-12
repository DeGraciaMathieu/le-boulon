import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createGame, step } from '../src/engine/game.js';
import { neighbors, isEdge } from '../src/engine/hex.js';
import { createItem } from '../src/engine/rules/sheet.js';
import { ARTEFACT_VALUE } from '../src/engine/rules/suspects.js';
import {
  MISSION_KINDS,
  MISSION_BONUS,
  createMission,
  missionAssigned,
  missionAfterStep,
} from '../src/engine/rules/mission.js';

// Tuile factice : tout en herbe, 8 entrée (bord), 1 abri.
function fakeTile() {
  const hexes = {};
  for (let n = 1; n <= 19; n++) hexes[n] = { terrain: 'herbe' };
  hexes[1] = { terrain: 'batiment', lieu: 'Фабрика', abri: true };
  return { name: 'Test', entry: 8, hexes };
}

// Partie calme (ni jetons, ni rencontres, ni carte active) avec la mission voulue.
function newGame(kind, seed = 1) {
  const state = createGame({ seed, tile: fakeTile() });
  const zone = { ...state.zone, deck: Array(10).fill('calme') };
  return { ...state, tokens: [], encounters: [], zone, mission: createMission(kind) };
}

// Applique missionAfterStep à un brouillon avec les événements donnés.
function after(state, events, patch = {}) {
  const draft = structuredClone({ ...state, ...patch });
  const emitted = [];
  missionAfterStep(draft, events, { emit: (e) => emitted.push(e) });
  return { draft, emitted };
}

const revealed = (original) => ({ type: 'token-revealed', hex: 3, kind: 'rien', original, by: 'bolt' });
const artefact = () => createItem('artefact', { value: ARTEFACT_VALUE });

test('mise en place : une mission tirée au hasard, même graine même mission', () => {
  const kinds = new Set();
  for (let seed = 1; seed <= 30; seed++) {
    const state = createGame({ seed, tile: fakeTile() });
    assert.ok(MISSION_KINDS.includes(state.mission.kind));
    assert.equal(state.mission.done, false);
    assert.deepEqual(createGame({ seed, tile: fakeTile() }).mission, state.mission);
    kinds.add(state.mission.kind);
  }
  assert.deepEqual([...kinds].sort(), [...MISSION_KINDS].sort());
  assert.equal(createGame({ seed: 1, tile: fakeTile() }).outcome, null);
});

test('mission-assigned : événement de mise en place lisible par l\'interface', () => {
  const state = newGame('cartographie');
  assert.deepEqual(missionAssigned(state), {
    type: 'mission-assigned',
    kind: 'cartographie',
    progress: { revealed: 0, needed: 5 },
  });
});

test('Récupération : un artefact ramassé remplit la mission', () => {
  const state = newGame('recuperation');
  assert.deepEqual(state.mission.progress, { picked: 0, needed: 1 });
  const { draft, emitted } = after(state, [{ type: 'artefact-picked', hex: 3, value: ARTEFACT_VALUE }]);
  assert.deepEqual(draft.mission, { kind: 'recuperation', done: true, impossible: false, progress: { picked: 1, needed: 1 } });
  assert.deepEqual(emitted, [
    { type: 'mission-progress', kind: 'recuperation', progress: { picked: 1, needed: 1 } },
    { type: 'mission-complete', kind: 'recuperation' },
  ]);
});

test('Cartographie : seuls les jetons d\'origine révélés comptent', () => {
  let state = newGame('cartographie');
  ({ draft: state } = after(state, [revealed(true), revealed(false), revealed(true)]));
  assert.deepEqual(state.mission.progress, { revealed: 2, needed: 5 });
  assert.equal(state.mission.done, false);
  const { draft, emitted } = after(state, [revealed(true), revealed(true), revealed(true)]);
  assert.equal(draft.mission.progress.revealed, 5);
  assert.equal(draft.mission.done, true);
  assert.deepEqual(emitted.at(-1), { type: 'mission-complete', kind: 'cartographie' });
});

test('Cartographie : l\'Émission avant les 5 révélations rend la mission impossible', () => {
  const state = newGame('cartographie');
  const { draft, emitted } = after(state, [revealed(true), { type: 'suspects-reset' }, revealed(false)]);
  assert.equal(draft.mission.impossible, true);
  assert.equal(draft.mission.progress.revealed, 1);
  assert.deepEqual(emitted.at(-1), {
    type: 'mission-progress', kind: 'cartographie', progress: { revealed: 1, needed: 5 }, impossible: true,
  });
});

test('Cartographie remplie avant l\'Émission : elle le reste', () => {
  let state = newGame('cartographie');
  ({ draft: state } = after(state, Array(5).fill(revealed(true))));
  const { draft } = after(state, [{ type: 'suspects-reset' }]);
  assert.equal(draft.mission.done, true);
  assert.equal(draft.mission.impossible, false);
});

test('victoire : mission remplie et sortie par un bord, score = artefacts + prime', () => {
  let state = newGame('recuperation');
  state = { ...state, inventory: [...state.inventory, artefact()] };
  ({ draft: state } = after(state, [{ type: 'artefact-picked', hex: 3, value: ARTEFACT_VALUE }]));
  assert.ok(isEdge(state.player.hex));
  const { state: end, events } = step(state, { type: 'exit' });
  const outcome = { result: 'win', cause: 'mission-complete', score: ARTEFACT_VALUE + MISSION_BONUS.recuperation };
  assert.deepEqual(end.outcome, outcome);
  assert.deepEqual(events.at(-1), { type: 'game-over', outcome });
});

test('sortie sans mission remplie : défaite mission-failed, score = artefacts seuls', () => {
  let state = newGame('cartographie');
  state = { ...state, inventory: [...state.inventory, artefact(), artefact()] };
  const { state: end } = step(state, { type: 'exit' });
  assert.equal(end.status, 'exited');
  assert.deepEqual(end.outcome, { result: 'loss', cause: 'mission-failed', score: 2 * ARTEFACT_VALUE });
});

test('nuit : 0 PA sans être sorti, défaite night', () => {
  let state = newGame('recuperation');
  state = { ...state, ap: { ...state.ap, left: 1 } };
  const to = neighbors(state.player.hex).find((n) => n !== 1);
  const { state: end, events } = step(state, { type: 'move', to });
  assert.equal(end.status, 'night');
  assert.deepEqual(end.outcome, { result: 'loss', cause: 'night', score: 0 });
  assert.equal(events.filter((e) => e.type === 'game-over').length, 1);
});

test('mort et Émission prise : défaites dead et emission', () => {
  const state = newGame('recuperation');
  for (const status of ['dead', 'emission']) {
    const { draft, emitted } = after(state, [], { status });
    assert.deepEqual(draft.outcome, { result: 'loss', cause: status, score: 0 });
    assert.deepEqual(emitted, [{ type: 'game-over', outcome: draft.outcome }]);
  }
});

test('résultat unique : une partie finie ne change plus d\'issue', () => {
  const state = newGame('recuperation');
  const { state: end } = step(state, { type: 'exit' });
  const { draft, emitted } = after(end, []);
  assert.deepEqual(draft.outcome, end.outcome);
  assert.deepEqual(emitted, []);
  assert.equal(step(end, { type: 'exit' }).events[0].reason, 'game-over');
});
