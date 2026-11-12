import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  HELP_SECTIONS, BAR_HINTS, farewellChoice, FLEE_COST, PICKUP_COST, CHECK_TARGET, STARVING_DAYS,
} from '../src/ui/aide.js';

const constant = (file, name) => Number(readFileSync(new URL(`../src/engine/${file}`, import.meta.url), 'utf8')
  .match(new RegExp(`const ${name} = (\\d+);`))[1]);

const entry = (term) => HELP_SECTIONS.flatMap((section) => section.entries).find((e) => e.term === term);

test('aide : les valeurs recopiées sont celles du moteur', () => {
  assert.equal(FLEE_COST, constant('rules/encounters.js', 'FLEE_COST'));
  assert.equal(PICKUP_COST, constant('rules/suspects.js', 'PICKUP_COST'));
  assert.equal(CHECK_TARGET, constant('game.js', 'CHECK_TARGET'));
  assert.equal(STARVING_DAYS, constant('rules/time.js', 'STARVING_DAYS'));
});

test('aide : la notice couvre les symboles de la tuile et les termes du rapport M3', () => {
  for (const term of ['?', '!', 'ART', '☢', 'Crâne', 'Losange', '→ Liaison', 'Test', 'Émission', 'Abri', 'Carte Nuit', 'Carte Zone', 'Boulon', 'Détecteur']) {
    assert.ok(entry(term), term);
  }
  assert.match(entry('Test').text, /1d6 \+ compétence ≥ 5/);
  assert.equal(entry('Forêt').text.startsWith('2 PA'), true);
  assert.equal(entry('Marais').text.startsWith('3 PA'), true);
});

test('aide : chaque élément du bandeau a sa définition', () => {
  for (const id of ['jour', 'tuile', 'pa', 'blessures', 'radiations', 'faim', 'roubles']) {
    assert.equal(typeof BAR_HINTS[id], 'string', id);
  }
  assert.match(BAR_HINTS.blessures, /À 4 : −1 PA/);
});

test('farewellChoice : le choix « Au revoir. » disponible, sinon null', () => {
  const view = {
    choices: [
      { index: 0, text: 'Du travail ?', available: true },
      { index: 1, text: 'Au revoir.', available: true },
    ],
  };
  assert.equal(farewellChoice(view).index, 1);
  assert.equal(farewellChoice({ choices: [{ index: 0, text: 'Au revoir.', available: false }] }), null);
  assert.equal(farewellChoice({ choices: [{ index: 0, text: 'Partir.', available: true }] }), null);
  assert.equal(farewellChoice(null), null);
});
