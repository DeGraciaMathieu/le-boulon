import { test } from 'node:test';
import assert from 'node:assert/strict';
import { hexCenter, hexPoints } from '../src/ui/geometry.js';

const calage = { cx: 100, cy: 100, taille: 10 };

test('centre : hexagone 1 au point de calage, 3 à l\'est, 2 au nord-est', () => {
  assert.deepEqual(hexCenter(1, calage), { x: 100, y: 100 });
  assert.ok(Math.abs(hexCenter(3, calage).x - (100 + Math.sqrt(3) * 10)) < 1e-9);
  assert.equal(hexCenter(3, calage).y, 100);
  assert.equal(hexCenter(2, calage).y, 85);
});

test('sommets : six points, le premier en haut (sommet pointu)', () => {
  const points = hexPoints(1, calage).split(' ');
  assert.equal(points.length, 6);
  assert.equal(points[0], '100.0,90.0');
});
