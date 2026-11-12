import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createCampaign, step } from '../src/engine/campaign.js';
import { startCombat } from '../src/engine/rules/combat.js';
import { createItem } from '../src/engine/rules/sheet.js';
import { COMBAT_OUTCOMES, combatLine, combatWindow } from '../src/ui/combat-screen.js';

const CARDS = {
  solo: { name: 'Pillard', threat: 3, wounds: 1, hp: 2, damage: 1, type: 'humain', faction: 'bandits' },
  meute: { name: 'Chiens', threat: 4, wounds: 1, hp: 1, damage: 1, type: 'mutant', trophy: 'queue-chien', count: 3 },
};

function testTile() {
  const hexes = {};
  for (let n = 1; n <= 19; n++) hexes[n] = { terrain: 'herbe' };
  return { name: 'Test', entry: 8, hexes, encounterCards: CARDS, composition: { encounters: 0 } };
}

function fighting(card, setup) {
  const campaign = createCampaign({ seed: 1, tile: 'test', tiles: { test: testTile() } });
  const tile = campaign.world.tiles.test;
  tile.encounters = [{ hex: 9, card }];
  tile.combat = { hex: 9, card };
  tile.player.previousHex = 2;
  setup?.(campaign);
  startCombat(campaign, { hex: 9, card }, { emit() {} });
  return campaign;
}

const actionOf = (view, type) => view.actions.find((action) => action.type === type);

test('combatWindow : null hors combat', () => {
  assert.equal(combatWindow(createCampaign({ seed: 1 })), null);
});

test('combatWindow : ennemis avec PV, Menace et dé pour toucher', () => {
  const view = combatWindow(fighting('meute'));
  assert.equal(view.title, 'Chiens');
  assert.equal(view.round, 1);
  assert.equal(view.enemies.length, 3);
  const [first] = view.enemies;
  assert.deepEqual(
    { name: first.name, hp: first.hp, maxHp: first.maxHp, threat: first.threat, down: first.down },
    { name: 'Chiens', hp: 1, maxHp: 1, threat: 4, down: false },
  );
  assert.equal(first.toHit, Math.min(7, Math.max(1, 4 - view.attack)));
  assert.equal(view.weapon.name, 'Pistolet');
  assert.equal(view.defense, 4);
});

test('combatWindow : actions du round disponibles ou non, avec la raison', () => {
  const view = combatWindow(fighting('meute'));
  assert.deepEqual(view.actions.map((a) => a.type), ['take-cover', 'grenade', 'heal', 'escape', 'parley']);
  assert.equal(actionOf(view, 'take-cover').available, true);
  assert.deepEqual(actionOf(view, 'grenade'), { type: 'grenade', label: 'Grenade', action: { type: 'grenade' }, available: false, reason: 'aucune grenade' });
  assert.equal(actionOf(view, 'heal').available, true);
  assert.equal(actionOf(view, 'escape').label, 'Fuir (2 PA)');
  assert.equal(actionOf(view, 'parley').reason, 'les mutants ne parlementent pas');

  const armed = combatWindow(fighting('solo', (c) => {
    c.inventory.push(createItem('grenade'));
    c.inventory = c.inventory.filter((item) => item.kind !== 'bandage');
    c.world.tiles.test.ap.left = 1;
  }));
  assert.equal(actionOf(armed, 'grenade').available, true);
  assert.equal(actionOf(armed, 'heal').reason, 'aucun soin');
  assert.equal(actionOf(armed, 'escape').reason, 'pas assez de PA');
  assert.equal(actionOf(armed, 'parley').reason, 'faction hostile, pas de discussion');
});

test('combatWindow : un ennemi abattu reste affiché, à terre', () => {
  const campaign = fighting('meute');
  campaign.combat.enemies[1].hp = 0;
  assert.deepEqual(combatWindow(campaign).enemies.map((e) => e.down), [false, true, false]);
});

test('combatLine : chaque jet d’un round est lisible', () => {
  const { events } = step(fighting('solo'), { type: 'shoot' });
  const lines = events.map(combatLine).filter(Boolean);
  assert.match(lines[0], /^Round 1$/);
  assert.match(lines.find((l) => l.startsWith('Tir sur Pillard')), /^Tir sur Pillard : \d \+ Tir \d+ [+-]\d arme [+-]\d couvert = \d+ \/ Menace 3 · (touché|raté)/);
  for (const line of lines) assert.doesNotMatch(line, /undefined/);
});

test('combatLine : riposte, couverture, fin, refus', () => {
  assert.equal(
    combatLine({ type: 'enemy-attack', name: 'Pillard', roll: 5, threat: 3, total: 8, defense: 4, hit: true, damage: 2, absorbed: 1, wounds: 1, free: true }),
    "Pillard attaque (attaque gratuite) : 5 + Menace 3 = 8 / défense 4 · touché : 1 blessure, 1 absorbée par l'armure",
  );
  assert.equal(combatLine({ type: 'enemy-attack', name: 'Pillard', roll: 1, threat: 3, total: 4, defense: 6, hit: false }), 'Pillard attaque : 1 + Menace 3 = 4 / défense 6 · raté');
  assert.equal(combatLine({ type: 'took-cover', bonus: 2, rounds: 2 }), 'À couvert : +2 en défense pour 2 rounds');
  assert.equal(combatLine({ type: 'combat-ended', outcome: 'victory', trophies: ['queue-chien'] }).startsWith(`Fin du combat : ${COMBAT_OUTCOMES.victory} · trophées : `), true);
  assert.equal(combatLine({ type: 'parley', outcome: 'peage', toll: 100 }), 'Parlementer : péage de 100 ₽');
  assert.equal(combatLine({ type: 'refused', reason: 'mutants' }), 'Refusé : les mutants ne parlementent pas');
  assert.equal(combatLine({ type: 'moved' }), undefined);
});
