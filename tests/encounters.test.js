import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createGame, step } from '../src/engine/game.js';
import { createRng } from '../src/engine/rng.js';
import { neighbors, distance } from '../src/engine/hex.js';
import { countCharges } from '../src/engine/rules/sheet.js';
import { ENCOUNTER_CARDS, ENCOUNTER_COUNT, placeEncounter } from '../src/engine/rules/encounters.js';

// Tuile factice : 8 entrée (herbe), tout le reste herbe sauf ce que le test change.
function fakeTile() {
  const hexes = {};
  for (let n = 1; n <= 19; n++) hexes[n] = { terrain: 'herbe' };
  return { name: 'Test', entry: 8, hexes };
}

// Premier état de RNG dont les d6 sortent dans cet ordre.
function seedFor(rolls) {
  for (let seed = 0; ; seed++) {
    const rng = createRng(seed);
    if (rolls.every((roll) => rng.d6() === roll)) return seed;
  }
}

// Une partie avec une seule rencontre, sur `hex`, et des dés choisis.
function gameWith({ hex, card = null, deck = ['pillard'], rolls = [], terrain = {} }) {
  const game = createGame({ seed: 1, tile: fakeTile() });
  Object.assign(game.tile.hexes, terrain);
  game.encounters = [{ hex, card }];
  game.encounterDeck = [...deck];
  game.rng = seedFor(rolls);
  return game;
}

// Une rencontre en cours sur l'hexagone `hex`, le joueur venant de 8.
function inCombat({ card = 'pillard', rolls = [], terrain = {} } = {}) {
  const hex = neighbors(8)[0];
  const game = gameWith({ hex, card, rolls, terrain });
  game.player.hex = hex;
  game.player.previousHex = 8;
  game.combat = { hex, card };
  return game;
}

const move = (to) => ({ type: 'move', to });
const fakeD20 = (rolls) => ({ d20: () => rolls.shift() });

test('mise en place : 3 rencontres sur des hexagones distincts, jamais sur l\'entrée', () => {
  for (let seed = 0; seed < 50; seed++) {
    const game = createGame({ seed, tile: fakeTile() });
    const hexes = game.encounters.map((encounter) => encounter.hex);
    assert.equal(hexes.length, ENCOUNTER_COUNT);
    assert.equal(new Set(hexes).size, ENCOUNTER_COUNT);
    for (const hex of hexes) assert.ok(hex >= 1 && hex <= 19 && hex !== 8);
    assert.ok(game.encounters.every((encounter) => encounter.card === null));
    assert.equal(game.combat, null);
  }
});

test('pose : relance sur 20, sur une rencontre déjà posée et sur l\'entrée', () => {
  const game = createGame({ seed: 1, tile: fakeTile() });
  game.encounters = [{ hex: 3, card: null }];
  assert.equal(placeEncounter(game, fakeD20([20, 3, 8, 5])), 5);
  assert.deepEqual(game.encounters.at(-1), { hex: 5, card: null });
});

test('pose : restreinte à une liste d\'hexagones, null s\'il n\'y a pas de place', () => {
  const game = createGame({ seed: 1, tile: fakeTile() });
  game.encounters = [{ hex: 3, card: null }];
  assert.equal(placeEncounter(game, fakeD20([5, 7]), [7, 3]), 7);
  assert.equal(placeEncounter(game, fakeD20([]), [3, 8]), null);
});

test('paquet Agroprom : 6 cartes, Menace 3 à 7, blessures 1 à 3, mélangé à la mise en place', () => {
  const cards = Object.values(ENCOUNTER_CARDS);
  assert.equal(cards.length, 6);
  for (const { threat, wounds } of cards) {
    assert.ok(threat >= 3 && threat <= 7);
    assert.ok(wounds >= 1 && wounds <= 3);
  }
  const game = createGame({ seed: 1, tile: fakeTile() });
  assert.deepEqual([...game.encounterDeck].sort(), Object.keys(ENCOUNTER_CARDS).sort());
  const orders = new Set();
  for (let seed = 0; seed < 10; seed++) orders.add(createGame({ seed, tile: fakeTile() }).encounterDeck.join());
  assert.ok(orders.size > 1);
});

test('entrer à côté d\'une rencontre : Discrétion réussie, on contourne et le jeton reste', () => {
  const to = neighbors(8)[0];
  const hex = neighbors(to).find((n) => n !== 8);
  const { state, events } = step(gameWith({ hex, rolls: [4] }), move(to));
  assert.deepEqual(events.find((event) => event.type === 'check'), {
    type: 'check', stat: 'discretion', roll: 4, bonus: 1, target: 5, success: true,
  });
  assert.deepEqual(events.at(-1), { type: 'encounter-avoided', hex });
  assert.deepEqual(state.encounters, [{ hex, card: null }]);
  assert.equal(state.combat, null);
});

test('Discrétion : +1 si le joueur est en forêt', () => {
  const to = neighbors(8)[0];
  const game = gameWith({ hex: to, rolls: [3], terrain: { [to]: { terrain: 'foret' } } });
  const { state, events } = step(game, move(to));
  const check = events.find((event) => event.type === 'check');
  assert.equal(check.bonus, 2);
  assert.equal(check.success, true);
  assert.equal(state.combat, null);
});

test('Discrétion ratée : la carte est révélée depuis le paquet et le combat commence', () => {
  const to = neighbors(8)[0];
  const { state, events } = step(gameWith({ hex: to, deck: ['militaires', 'pillard'], rolls: [3] }), move(to));
  assert.deepEqual(events.at(-1), { type: 'encounter-revealed', hex: to, card: 'militaires' });
  assert.deepEqual(state.combat, { hex: to, card: 'militaires' });
  assert.deepEqual(state.encounters, [{ hex: to, card: 'militaires' }]);
  assert.deepEqual(state.encounterDeck, ['pillard']);
});

test('une rencontre déjà révélée garde sa carte', () => {
  const to = neighbors(8)[0];
  const { state } = step(gameWith({ hex: to, card: 'chiens', deck: ['militaires'], rolls: [1] }), move(to));
  assert.deepEqual(state.combat, { hex: to, card: 'chiens' });
  assert.deepEqual(state.encounterDeck, ['militaires']);
});

test('une rencontre à 2 hexagones ou plus ne déclenche rien', () => {
  const to = neighbors(8)[0];
  const hex = [...Array(19).keys()].map((i) => i + 1).find((n) => distance(to, n) === 2 && n !== 8);
  const { state, events } = step(gameWith({ hex, rolls: [1] }), move(to));
  assert.ok(!events.some((event) => event.type === 'check'));
  assert.equal(state.combat, null);
});

test('en combat, les autres actions sont refusées', () => {
  const game = inCombat();
  for (const action of [move(8), { type: 'exit' }, { type: 'use', item: 'bandage' }]) {
    const result = step(game, action);
    assert.equal(result.state, game);
    assert.deepEqual(result.events, [{ type: 'refused', action, reason: 'in-combat' }]);
  }
});

test('hors combat, combattre et fuir sont refusés', () => {
  const game = createGame({ seed: 1, tile: fakeTile() });
  assert.equal(step(game, { type: 'fight' }).events[0].reason, 'not-in-combat');
  assert.equal(step(game, { type: 'flee' }).events[0].reason, 'not-in-combat');
});

test('combattre : 1d6 + Tir + arme ≥ Menace, victoire, la rencontre est retirée', () => {
  const { state, events } = step(inCombat({ card: 'bandits', rolls: [3] }), { type: 'fight' });
  assert.deepEqual(events[0], {
    type: 'fight', card: 'bandits', roll: 3, tir: 1, weapon: 1, cover: 0, total: 5, threat: 5, won: true,
  });
  assert.deepEqual(events[1], { type: 'encounter-removed', hex: neighbors(8)[0], card: 'bandits' });
  assert.deepEqual(state.encounters, []);
  assert.equal(state.combat, null);
  assert.equal(countCharges(state.inventory, 'munitions'), 6);
});

test('combattre : défaite, blessures de la carte, 1 munition, et on peut relancer', () => {
  const game = inCombat({ card: 'mercenaires', rolls: [1, 6] });
  const first = step(game, { type: 'fight' });
  assert.equal(first.events[0].won, false);
  assert.equal(first.state.player.wounds, 3);
  assert.equal(countCharges(first.state.inventory, 'munitions'), 5);
  assert.notEqual(first.state.combat, null);
  assert.equal(first.state.encounters.length, 1);

  const second = step(first.state, { type: 'fight' });
  assert.equal(second.events[0].total, 8);
  assert.equal(second.events[0].won, true);
  assert.equal(second.state.combat, null);
});

test('arme : -1 sans munitions', () => {
  const game = inCombat({ rolls: [1] });
  game.inventory = game.inventory.filter((item) => item.kind !== 'munitions');
  const { events } = step(game, { type: 'fight' });
  assert.equal(events[0].weapon, -1);
  assert.equal(events[0].total, 1);
});

test('couverture : +1 en forêt, +2 dans un bâtiment', () => {
  const hex = neighbors(8)[0];
  const inForest = step(inCombat({ rolls: [1], terrain: { [hex]: { terrain: 'foret' } } }), { type: 'fight' });
  assert.equal(inForest.events[0].cover, 1);
  const inBuilding = step(inCombat({ rolls: [1], terrain: { [hex]: { terrain: 'batiment', lieu: 'Фабрика' } } }), { type: 'fight' });
  assert.equal(inBuilding.events[0].cover, 2);
});

test('fuir : 2 PA, retour sur l\'hexagone précédent, le jeton reste', () => {
  const hex = neighbors(8)[0];
  const { state, events } = step(inCombat(), { type: 'flee' });
  assert.deepEqual(events, [{ type: 'fled', from: hex, to: 8, cost: 2 }]);
  assert.equal(state.player.hex, 8);
  assert.equal(state.ap.left, 8);
  assert.equal(state.combat, null);
  assert.deepEqual(state.encounters, [{ hex, card: 'pillard' }]);
});

test('fuir : refusé sans 2 PA', () => {
  const game = inCombat();
  game.ap.left = 1;
  assert.equal(step(game, { type: 'flee' }).events[0].reason, 'not-enough-ap');
});
