import { test } from 'node:test';
import assert from 'node:assert/strict';
import { tileArea, towards, hexWarnings } from '../src/ui/hex-hints.js';
import { describeEvent } from '../src/ui/journal.js';

// État minimal d'une journée : 19 hexagones d'herbe, pion au centre.
function day({ player = 1, encounters = [], tokens = [], forest = [] } = {}) {
  const hexes = Object.fromEntries(Array.from({ length: 19 }, (_, i) => [i + 1, { terrain: forest.includes(i + 1) ? 'foret' : 'herbe' }]));
  return { player: { hex: player }, tile: { hexes }, encounters, tokens };
}

test('position sur la tuile : centre, cœur, bord', () => {
  assert.equal(tileArea(1), 'centre');
  assert.equal(tileArea(3), 'est');
  assert.equal(tileArea(2), 'nord-est');
  assert.equal(tileArea(6), 'ouest');
  assert.equal(tileArea(19), 'bord nord');
  assert.equal(tileArea(13), 'bord sud');
});

test('direction d\'un pas, avec élision', () => {
  assert.equal(towards(1, 3), "vers l'est");
  assert.equal(towards(1, 6), "vers l'ouest");
  assert.equal(towards(1, 2), 'vers le nord-est');
  assert.equal(towards(1, 5), 'vers le sud-ouest');
  assert.equal(towards(3, 1), "vers l'ouest");
});

test('infobulle : rencontre voisine annonce le test de Discrétion', () => {
  assert.deepEqual(hexWarnings(day({ encounters: [{ hex: 10, card: null }] }), 3), ['Rencontre voisine : test de Discrétion']);
  assert.deepEqual(hexWarnings(day({ encounters: [{ hex: 3, card: null }] }), 3), ['Rencontre voisine : test de Discrétion']);
  assert.deepEqual(hexWarnings(day({ encounters: [{ hex: 3, card: null }], forest: [2] }), 2), ['Rencontre voisine : test de Discrétion (+1 en forêt)']);
  assert.deepEqual(hexWarnings(day({ encounters: [{ hex: 16, card: null }] }), 3), []);
});

test('infobulle : jeton inconnu, boulon conseillé s\'il est voisin', () => {
  const tokens = [{ hex: 3, revealed: false }, { hex: 10, revealed: false }, { hex: 4, revealed: true, kind: 'rien' }];
  assert.deepEqual(hexWarnings(day({ tokens }), 3), ['Jeton inconnu : boulon conseillé']);
  assert.deepEqual(hexWarnings(day({ tokens }), 10), ['Jeton inconnu']);
  assert.deepEqual(hexWarnings(day({ tokens }), 4), []);
});

test('infobulle : rien sur l\'hexagone du pion', () => {
  assert.deepEqual(hexWarnings(day({ encounters: [{ hex: 2, card: null }], tokens: [{ hex: 1, revealed: false }] }), 1), []);
});

test('journal : plus de numéro d\'hexagone, une direction ou une position', () => {
  assert.equal(describeEvent({ type: 'moved', from: 1, to: 3, cost: 1 }), "Déplacement vers l'est (1 PA)");
  assert.equal(describeEvent({ type: 'fled', from: 1, to: 5, cost: 2 }), 'Fuite vers le sud-ouest (2 PA)');
  assert.equal(describeEvent({ type: 'bolt-thrown', target: 2 }), 'Boulon lancé (nord-est)');
  assert.equal(describeEvent({ type: 'encounter-avoided', hex: 19 }), 'Rencontre contournée (bord nord)');
  assert.equal(describeEvent({ type: 'patrol', from: 4, to: 12 }), 'Une patrouille passe : sud-est → bord sud-est');
  assert.equal(describeEvent({ type: 'emission-survived', hex: 7 }), "Émission passée à l'abri");
});
