import { test } from 'node:test';
import assert from 'node:assert/strict';
import { MOTION_KEY, REDUCED_CLASS, readMotion, saveMotion, motionReduced, applyMotion } from '../src/ui/animations.js';

function fakeStorage() {
  const items = new Map();
  return {
    getItem: (key) => (items.has(key) ? items.get(key) : null),
    setItem: (key, value) => items.set(key, String(value)),
  };
}

const brokenStorage = {
  getItem() { throw new Error('accès refusé'); },
  setItem() { throw new Error('quota dépassé'); },
};

function fakeRoot() {
  const classes = new Set();
  return { classes, classList: { toggle: (name, on) => (on ? classes.add(name) : classes.delete(name)) } };
}

test('readMotion : normales par défaut, valeur inconnue ou stockage bloqué', () => {
  const storage = fakeStorage();
  assert.equal(readMotion(storage), 'normales');
  storage.setItem(MOTION_KEY, 'rapides');
  assert.equal(readMotion(storage), 'normales');
  assert.equal(readMotion(brokenStorage), 'normales');
});

test('saveMotion mémorise un mode connu et refuse le reste', () => {
  const storage = fakeStorage();
  assert.equal(saveMotion(storage, 'reduites'), true);
  assert.equal(readMotion(storage), 'reduites');
  assert.equal(saveMotion(storage, 'rapides'), false);
  assert.equal(readMotion(storage), 'reduites');
  assert.equal(saveMotion(brokenStorage, 'reduites'), false);
});

test('motionReduced : la préférence système l’emporte sur le réglage', () => {
  assert.equal(motionReduced('normales', false), false);
  assert.equal(motionReduced('reduites', false), true);
  assert.equal(motionReduced('normales', true), true);
});

test('applyMotion pose et retire la classe sur la racine', () => {
  const storage = fakeStorage();
  const root = fakeRoot();
  saveMotion(storage, 'reduites');
  applyMotion(root, storage);
  assert.ok(root.classes.has(REDUCED_CLASS));
  saveMotion(storage, 'normales');
  applyMotion(root, storage);
  assert.ok(!root.classes.has(REDUCED_CLASS));
});
