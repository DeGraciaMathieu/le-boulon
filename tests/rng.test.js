import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRng } from '../src/engine/rng.js';

const draw = (rng, n) => Array.from({ length: n }, () => rng.next());

test('même graine, même suite', () => {
  assert.deepEqual(draw(createRng(42), 20), draw(createRng(42), 20));
});

test('graines différentes, suites différentes', () => {
  assert.notDeepEqual(draw(createRng(1), 5), draw(createRng(2), 5));
});

test('next reste dans [0, 1[', () => {
  for (const x of draw(createRng(7), 1000)) assert.ok(x >= 0 && x < 1);
});

test('d6 et d20 couvrent toutes les faces et rien d\'autre', () => {
  const rng = createRng(3);
  for (const [roll, faces] of [[() => rng.d6(), 6], [() => rng.d20(), 20]]) {
    const seen = new Set(Array.from({ length: 2000 }, roll));
    assert.deepEqual([...seen].sort((a, b) => a - b), Array.from({ length: faces }, (_, i) => i + 1));
  }
});

test('shuffle rend une permutation sans toucher l\'original, déterministe', () => {
  const items = [1, 2, 3, 4, 5, 6, 7, 8];
  const shuffled = createRng(9).shuffle(items);
  assert.deepEqual(items, [1, 2, 3, 4, 5, 6, 7, 8]);
  assert.deepEqual([...shuffled].sort((a, b) => a - b), items);
  assert.deepEqual(createRng(9).shuffle(items), shuffled);
});

test('pick prend un élément du tableau', () => {
  const rng = createRng(5);
  const items = ['a', 'b', 'c'];
  for (let i = 0; i < 50; i++) assert.ok(items.includes(rng.pick(items)));
});

test('pick sur un tableau vide lève une erreur', () => {
  assert.throws(() => createRng(1).pick([]));
});

test('state() permet de reprendre la suite', () => {
  const rng = createRng(9);
  rng.next();
  const resumed = createRng(rng.state());
  assert.deepEqual(draw(resumed, 5), draw(rng, 5));
});
