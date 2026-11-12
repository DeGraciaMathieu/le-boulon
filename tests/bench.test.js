import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createGame } from '../src/engine/game.js';
import agroprom from '../src/engine/data/agroprom.js';
import { decide } from '../bench/ai.js';
import { playGame, runBench, MAX_ACTIONS } from '../bench/run.js';

test('banc : même graine, même rapport', () => {
  assert.deepEqual(runBench({ games: 50, seed: 7 }), runBench({ games: 50, seed: 7 }));
});

test('banc : chaque partie se termine avec un résultat, sous le plafond d’actions', () => {
  for (let seed = 0; seed < 300; seed++) {
    const { outcome, actions } = playGame(seed);
    assert.ok(['win', 'loss'].includes(outcome.result));
    assert.notEqual(outcome.cause, 'stuck', `partie ${seed} bloquée`);
    assert.ok(actions < MAX_ACTIONS);
  }
});

test('banc : l’Émission placée en tête sort à la première pioche', () => {
  const { emission } = playGame(3, { emissionPos: 1 });
  assert.equal(emission.draw, 1);
  assert.ok(emission.apSpent >= 3);
});

test('IA : décision déterministe, une action du moteur', () => {
  const state = createGame({ seed: 1, tile: agroprom });
  assert.deepEqual(decide(state), decide(state));
  assert.ok(['move', 'bolt', 'exit', 'use'].includes(decide(state).type));
});
