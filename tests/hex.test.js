import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  RADIUS, HEXES, DIRECTIONS, toAxial, toNumber, isOnBoard,
  neighbors, distance, edgeHexes, isEdge,
} from '../src/engine/hex.js';

test('la tuile compte 19 hexagones numérotés de 1 à 19', () => {
  assert.equal(RADIUS, 2);
  assert.equal(HEXES.length, 19);
  assert.deepEqual(HEXES.map((h) => h.n), Array.from({ length: 19 }, (_, i) => i + 1));
});

test('numérotation documentée : centre, cœur puis anneau, en partant du nord, sens horaire', () => {
  const expected = [
    [0, 0],
    [0, -1], [1, -1], [1, 0], [0, 1], [-1, 1], [-1, 0],
    [0, -2], [1, -2], [2, -2], [2, -1], [2, 0], [1, 1],
    [0, 2], [-1, 2], [-2, 2], [-2, 1], [-2, 0], [-1, -1],
  ];
  assert.deepEqual(HEXES.map(({ q, r }) => [q, r]), expected);
});

test('conversion numéro <-> axial aller-retour', () => {
  for (let n = 1; n <= 19; n++) assert.equal(toNumber(toAxial(n)), n);
  assert.deepEqual(toAxial(1), { q: 0, r: 0 });
  assert.equal(toNumber({ q: 2, r: -2 }), 10);
});

test('conversion hors tuile', () => {
  assert.equal(toNumber({ q: 3, r: 0 }), null);
  assert.equal(toAxial(0), null);
  assert.equal(toAxial(20), null);
  assert.equal(isOnBoard({ q: 2, r: 1 }), false);
  assert.equal(isOnBoard({ q: 1, r: 1 }), true);
});

test('les 6 directions : colonnes verticales, hexagones à sommet plat', () => {
  assert.equal(Object.keys(DIRECTIONS).length, 6);
  assert.deepEqual(DIRECTIONS.N, { q: 0, r: -1 });
  assert.deepEqual(DIRECTIONS.S, { q: 0, r: 1 });
});

test('voisins : 6 pour le centre, restreints à la tuile au bord', () => {
  assert.deepEqual(neighbors(1).sort((a, b) => a - b), [2, 3, 4, 5, 6, 7]);
  assert.deepEqual(neighbors(10).sort((a, b) => a - b), [3, 9, 11]);
  assert.deepEqual(neighbors(9).sort((a, b) => a - b), [2, 3, 8, 10]);
  for (const { n } of HEXES) for (const m of neighbors(n)) assert.ok(neighbors(m).includes(n));
});

test('distance en nombre de pas', () => {
  assert.equal(distance(1, 1), 0);
  assert.equal(distance(1, 4), 1);
  assert.equal(distance(1, 16), 2);
  assert.equal(distance(10, 16), 4);
  assert.equal(distance(8, 14), 4);
  assert.equal(distance(2, 5), 2);
});

test('hexagones de bord : les 12 de l\'anneau extérieur', () => {
  assert.deepEqual(edgeHexes(), [8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19]);
  assert.equal(isEdge(12), true);
  assert.equal(isEdge(4), false);
});

test('colonnes 3-4-5-4-3 comme sur la tuile', () => {
  const counts = [-2, -1, 0, 1, 2].map((q) => HEXES.filter((h) => h.q === q).length);
  assert.deepEqual(counts, [3, 4, 5, 4, 3]);
});
