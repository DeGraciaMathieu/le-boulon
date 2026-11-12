import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DICE_TYPES, faceTurn, rollParts, rollSentence, rollView, shotHint } from '../src/ui/bac.js';

const check = (roll, bonus, success) => ({ type: 'check', stat: 'discretion', roll, bonus, target: 5, success });

test('un test de compétence raté s’écrit dé + compétence = total, il faut seuil · RATÉ', () => {
  const view = rollView(check(3, 1, false));
  assert.equal(view.title, 'Test de Discrétion');
  assert.equal(rollSentence(view), 'dé 3 + Discrétion 1 = 4, il faut 5 · RATÉ');
  assert.equal(view.tone, 'mauvais');
});

test('un test réussi est bon ; un bonus négatif s’écrit en retrait', () => {
  const view = rollView({ ...check(6, -1, true), stat: 'survie' });
  assert.equal(rollSentence(view), 'dé 6 − Survie 1 = 5, il faut 5 · RÉUSSI');
  assert.equal(view.tone, 'bon');
});

test('un tir montre Tir, et l’arme et le couvert seulement s’ils comptent', () => {
  const shot = { type: 'shot', name: 'Pillard', roll: 2, tir: 1, weapon: 0, cover: 0, total: 3, threat: 3, hit: true };
  assert.equal(rollSentence(rollView(shot)), 'dé 2 + Tir 1 = 3, il faut 3 · TOUCHÉ');
  const armed = rollView({ ...shot, weapon: 1, cover: 1, total: 5, threat: 6, hit: false });
  assert.equal(armed.title, 'Tir sur Pillard');
  assert.equal(rollSentence(armed), 'dé 2 + Tir 1 + arme 1 + couvert 1 = 5, il faut 6 · RATÉ');
  assert.equal(armed.tone, 'mauvais');
});

test('une attaque ennemie se lit contre la Défense, du point de vue du joueur', () => {
  const attack = { type: 'enemy-attack', name: 'Chiens', roll: 4, threat: 4, total: 8, defense: 7, hit: true, free: true };
  const view = rollView(attack);
  assert.equal(view.title, 'Chiens attaque (attaque gratuite)');
  assert.equal(rollSentence(view), 'dé 4 + Menace 4 = 8, il faut 7 · TOUCHÉ');
  assert.equal(view.tone, 'mauvais');
  assert.equal(rollView({ ...attack, roll: 1, total: 5, hit: false }).tone, 'bon');
});

test('les morceaux de la phrase marquent le verdict ; les autres événements ne jouent pas de dé', () => {
  const parts = rollParts(rollView(check(3, 1, false)));
  assert.deepEqual(parts.at(-1), { text: 'RATÉ', part: 'verdict' });
  assert.deepEqual(DICE_TYPES, ['check', 'shot', 'enemy-attack']);
  assert.equal(rollView({ type: 'moved' }), null);
  assert.equal(rollView(undefined), null);
});

test('avant un tir, le bac donne le seuil et la chance sur le dé', () => {
  assert.equal(shotHint({ name: 'Pillard', threat: 4, toHit: 3 }), 'Tir sur Pillard : il faut 4 · 3+ sur le dé (67 %)');
  assert.equal(shotHint({ name: 'Rat', threat: 1, toHit: 1 }), 'Tir sur Rat : il faut 1 · touche à coup sûr');
});

test('chaque valeur du dé a sa rotation, toutes différentes', () => {
  const turns = [1, 2, 3, 4, 5, 6].map((roll) => JSON.stringify(faceTurn(roll)));
  assert.equal(new Set(turns).size, 6);
  assert.deepEqual(faceTurn(1), { x: 0, y: 0 });
});
