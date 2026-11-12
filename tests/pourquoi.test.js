import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { TRACK_MAX, RADIATION_RESET } from '../src/engine/rules/sheet.js';
import { DRAW_EVERY } from '../src/engine/rules/zone.js';
import { HELD } from '../src/ui/bar.js';
import {
  eventWhy, rollWhy, defenseWhy, trackCauses, notchWhy, BASE_DEFENSE, TAKE_COVER_BONUS, WOUND_CAUSES,
} from '../src/ui/pourquoi.js';

const combatSource = readFileSync(new URL('../src/engine/rules/combat.js', import.meta.url), 'utf8');

test('pourquoi : les valeurs recopiées sont celles du moteur', () => {
  assert.equal(BASE_DEFENSE, Number(combatSource.match(/const BASE_DEFENSE = (\d+);/)[1]));
  assert.equal(TAKE_COVER_BONUS, Number(combatSource.match(/const TAKE_COVER = Object\.freeze\(\{ bonus: (\d+)/)[1]));
});

test('pourquoi : chaque cause de blessure émise par le moteur a sa phrase', () => {
  const engine = ['actions/move.js', 'rules/suspects.js', 'rules/places.js', 'rules/combat.js', 'rules/encounters.js',
    'rules/emission.js', 'rules/zone.js', 'rules/time.js', 'rules/sheet.js']
    .map((file) => readFileSync(new URL(`../src/engine/${file}`, import.meta.url), 'utf8')).join('\n');
  const causes = new Set([...engine.matchAll(/wound\((?:\w+, )?[\w.]+, '([\w-]+)'/g)].map((match) => match[1]));
  assert.ok(causes.size >= 8);
  for (const cause of causes) assert.ok(WOUND_CAUSES[cause], cause);
});

test('rollWhy : un test dit la règle, le dé qu\'il fallait, sa chance et le verdict', () => {
  const why = rollWhy({ type: 'check', stat: 'discretion', roll: 3, bonus: 1, target: 5, success: false });
  assert.equal(why, 'Test de Discrétion : 1d6 + Discrétion (1) ≥ 5, il faut 4+ sur le dé (50 %). Dé 3 : raté.');
});

test('rollWhy : tir et attaque ennemie, chance bornée', () => {
  const shot = rollWhy({ type: 'shot', name: 'Pillard', roll: 2, tir: 1, weapon: 1, cover: 0, total: 4, threat: 3, hit: true });
  assert.match(shot, /Menace 3, tout dé suffit\. Dé 2 : touché\.$/);
  const attack = rollWhy({ type: 'enemy-attack', name: 'Chiens', roll: 1, threat: 4, total: 5, defense: 11, hit: false });
  assert.match(attack, /^Chiens touche si 1d6 \+ Menace 4 ≥ votre Défense 11, aucun dé ne suffit\. Dé 1 : raté\.$/);
  assert.equal(rollWhy({ type: 'moved' }), null);
});

test('eventWhy : blessures, radiations, pénalité de PA, carte Zone', () => {
  assert.equal(eventWhy({ type: 'wounded', amount: 2, cause: 'electro' }), '+2 blessures : anomalie électro déclenchée (détecteur en panne).');
  assert.equal(eventWhy({ type: 'wounded', amount: 1, cause: 'radiation' }), `+1 blessure : ${TRACK_MAX} radiations atteintes, retour à ${RADIATION_RESET}.`);
  assert.equal(eventWhy({ type: 'irradiated', amount: 1, cause: 'ceinture', blocked: 1 }), "+1 radiation : artefacts portés à la ceinture, l'armure en arrête 1.");
  assert.equal(eventWhy({ type: 'ap-penalty', amount: 1, cause: 'wounds' }), `${HELD.blessures.title}.`);
  assert.match(eventWhy({ type: 'zone-card', card: 'calme' }), new RegExp(`multiple de ${DRAW_EVERY}`));
  assert.match(eventWhy({ type: 'check', stat: 'survie', roll: 6, bonus: 0, target: 5, success: true }), /réussi\.$/);
  assert.equal(eventWhy({ type: 'moved' }), null);
});

test('defenseWhy : base, terrain, à couvert et armure', () => {
  assert.equal(defenseWhy({ defense: 4, cover: 0, coverRounds: 0 }), 'Défense 4 = base 4. Un ennemi touche si 1d6 + Menace ≥ Défense.');
  assert.equal(defenseWhy({ defense: 8, cover: 1, coverRounds: 2 }), 'Défense 8 = base 4, terrain +1, à couvert +2, armure +1. Un ennemi touche si 1d6 + Menace ≥ Défense.');
});

test('trackCauses : chaque cran garde sa cause, les soins retirent les derniers', () => {
  let causes = trackCauses(null, [], { wounds: 1, radiation: 0 });
  assert.deepEqual(causes.blessures, [null]);
  causes = trackCauses(causes, [{ type: 'wounded', amount: 2, cause: 'marais' }, { type: 'irradiated', amount: 1, cause: 'nuit' }], { wounds: 3, radiation: 1 });
  assert.deepEqual(causes, { blessures: [null, 'marais', 'marais'], radiations: ['nuit'] });
  causes = trackCauses(causes, [{ type: 'used', item: 'bandage', wounds: -1 }], { wounds: 2, radiation: 1 });
  assert.deepEqual(causes.blessures, [null, 'marais']);
  assert.equal(notchWhy('blessures', 2, causes), 'Blessure 2 : marais, test de Survie raté en y entrant');
  assert.equal(notchWhy('blessures', 1, causes), null);
  assert.equal(notchWhy('radiations', 1, causes), 'Radiation 1 : carte Nuit piochée au bivouac');
  assert.equal(notchWhy('faim', 2, causes), '2 jours sans manger');
});

test('trackCauses : la piste de radiations repart à son seuil de retour', () => {
  const full = Array(TRACK_MAX - 1).fill('ceinture');
  const causes = trackCauses({ blessures: [], radiations: full }, [
    { type: 'irradiated', amount: 1, cause: 'nuit' },
    { type: 'wounded', amount: 1, cause: 'radiation' },
  ], { wounds: 1, radiation: RADIATION_RESET });
  assert.equal(causes.radiations.length, RADIATION_RESET);
  assert.deepEqual(causes.blessures, ['radiation']);
});
