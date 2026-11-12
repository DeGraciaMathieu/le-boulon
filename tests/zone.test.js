import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createGame, step } from '../src/engine/game.js';
import { distance, neighbors } from '../src/engine/hex.js';
import { createItem, usedSlots } from '../src/engine/rules/sheet.js';
import { ZONE_DECK_SIZE, emissionPositions, zoneAfterAction } from '../src/engine/rules/zone.js';

// Tuile factice : tout en herbe (1 PA par hexagone), entrée 8. Chemin 8 -> 2 -> 1 -> 3.
function fakeTile() {
  const hexes = {};
  for (let n = 1; n <= 19; n++) hexes[n] = { terrain: 'herbe' };
  return { name: 'Test', entry: 8, hexes };
}

// Partie sans jetons ni rencontres, paquet Zone choisi, `spent` PA déjà dépensés.
function gameWith({ deck, spent = 2, encounters = [], abri = [] }) {
  const game = createGame({ seed: 1, tile: fakeTile() });
  for (const n of abri) game.tile.hexes[n].abri = true;
  game.tokens = [];
  game.encounters = encounters;
  game.zone.deck = [...deck];
  game.ap.spent = spent;
  game.ap.left -= spent;
  return game;
}

function play(state, actions) {
  const events = [];
  for (const action of actions) {
    const result = step(state, action);
    state = result.state;
    events.push(...result.events);
  }
  return { state, events };
}

const move = (to) => ({ type: 'move', to });
const types = (events) => events.map((event) => event.type);
const zoneCards = (events) => events.filter((e) => e.type === 'zone-card').map((e) => e.card);

test('paquet : 10 cartes, composition exacte', () => {
  const { deck } = createGame({ seed: 3, tile: fakeTile() }).zone;
  assert.equal(deck.length, ZONE_DECK_SIZE);
  assert.deepEqual([...deck].sort(), [
    'brouillard', 'cachette', 'calme', 'calme', 'calme', 'calme', 'chiens', 'emission', 'patrouille', 'radio',
  ]);
});

test('paquet : avec 10 PA, l\'Émission est en 2e ou 3e pioche, les deux selon la graine', () => {
  const positions = new Set();
  for (let seed = 0; seed < 60; seed++) {
    const game = createGame({ seed, tile: fakeTile() });
    assert.equal(game.ap.max, 10);
    positions.add(game.zone.deck.indexOf('emission') + 1);
  }
  assert.deepEqual([...positions].sort(), [2, 3]);
});

test('positions de l\'Émission : dernier tiers des pioches possibles, au moins 2 places', () => {
  assert.deepEqual(emissionPositions(10), { first: 2, last: 3 });
  assert.deepEqual(emissionPositions(18), { first: 5, last: 6 });
  assert.deepEqual(emissionPositions(27), { first: 7, last: 9 });
  assert.deepEqual(emissionPositions(6), { first: 1, last: 2 });
  assert.deepEqual(emissionPositions(3), { first: 1, last: 1 });
  assert.deepEqual(emissionPositions(60), { first: 7, last: 10 });
});

test('pioche : une carte quand le total de PA dépensés franchit un multiple de 3', () => {
  const { state, events } = play(gameWith({ deck: ['calme', 'radio'] }), [move(2)]);
  assert.deepEqual(zoneCards(events), ['calme']);
  assert.deepEqual(state.zone.deck, ['radio']);
});

test('pioche : rien tant qu\'aucun multiple de 3 n\'est franchi', () => {
  const { events } = play(gameWith({ deck: ['calme'], spent: 0 }), [move(2), move(1)]);
  assert.deepEqual(zoneCards(events), []);
});

test('pioche : un coût de 3 PA de 5 à 8 pioche une fois', () => {
  const game = gameWith({ deck: ['calme', 'radio'], spent: 5 });
  game.tile.hexes[2].terrain = 'marais';
  const { events } = play(game, [move(2)]);
  assert.deepEqual(zoneCards(events), ['calme']);
});

test('pioche : une carte par multiple franchi (2 -> 6 : deux cartes)', () => {
  const draft = gameWith({ deck: ['calme', 'radio', 'calme'], spent: 6 });
  const events = [];
  zoneAfterAction(draft, 2, { emit: (e) => events.push(e) });
  assert.deepEqual(zoneCards(events), ['calme', 'radio']);
});

test('pioche : paquet vide, plus rien', () => {
  const { state, events } = play(gameWith({ deck: [] }), [move(2)]);
  assert.deepEqual(zoneCards(events), []);
  assert.equal(state.status, 'playing');
});

test('patrouille : une rencontre va sur un voisin libre', () => {
  const game = gameWith({ deck: ['patrouille'], encounters: [{ hex: 4, card: null }] });
  const { state, events } = play(game, [move(2)]);
  const patrol = events.find((e) => e.type === 'patrol');
  assert.equal(patrol.from, 4);
  assert.ok(neighbors(4).includes(patrol.to));
  assert.notEqual(patrol.to, state.player.hex);
  assert.equal(state.encounters[0].hex, patrol.to);
});

test('patrouille : sans rencontre, rien ne bouge', () => {
  const { events } = play(gameWith({ deck: ['patrouille'] }), [move(2)]);
  assert.deepEqual(types(events), ['moved', 'zone-card']);
});

test('chiens attirés : un nouveau jeton de rencontre à 2 hexagones du joueur', () => {
  const { state, events } = play(gameWith({ deck: ['chiens'] }), [move(2)]);
  const { hex } = events.find((e) => e.type === 'dogs-placed');
  assert.equal(distance(2, hex), 2);
  assert.deepEqual(state.encounters, [{ hex, card: null }]);
});

test('brouillard : boulon refusé jusqu\'à la pioche suivante', () => {
  const game = gameWith({ deck: ['brouillard', 'calme'] });
  let { state } = play(game, [move(2)]);
  assert.equal(state.zone.fog, true);
  const refused = step(state, { type: 'bolt', target: 1 });
  assert.deepEqual(refused.events, [{ type: 'refused', action: { type: 'bolt', target: 1 }, reason: 'fog' }]);

  ({ state } = play(state, [move(1), move(3), move(4)]));
  assert.equal(state.zone.fog, false);
  const thrown = step(state, { type: 'bolt', target: 3 });
  assert.ok(types(thrown.events).includes('bolt-thrown'));
});

test('cachette : un consommable gratuit entre dans l\'inventaire', () => {
  const game = gameWith({ deck: ['cachette'] });
  const before = game.inventory.length;
  const { state, events } = play(game, [move(2)]);
  const found = events.find((e) => e.type === 'cache-found');
  assert.equal(found.stored, true);
  assert.ok(['bandage', 'vodka', 'ration'].includes(found.item));
  assert.equal(state.inventory.length, before + 1);
  assert.equal(state.inventory.at(-1).kind, found.item);
});

test('cachette : inventaire plein, l\'objet est perdu', () => {
  const game = gameWith({ deck: ['cachette'] });
  while (usedSlots(game.inventory) < 12) game.inventory.push(createItem('artefact', { value: 1000 }));
  const { state, events } = play(game, [move(2)]);
  assert.equal(events.find((e) => e.type === 'cache-found').stored, false);
  assert.deepEqual(state.inventory, game.inventory);
});

test('radio et calme : aucun effet en v1', () => {
  for (const card of ['radio', 'calme']) {
    const game = gameWith({ deck: [card] });
    const { state, events } = play(game, [move(2)]);
    assert.deepEqual(types(events), ['moved', 'zone-card']);
    assert.deepEqual(state.inventory, game.inventory);
  }
});

test('Émission sur un abri : le joueur est sauf tout de suite', () => {
  const { state, events } = play(gameWith({ deck: ['emission'], abri: [2] }), [move(2)]);
  assert.ok(types(events).includes('emission-survived'));
  assert.ok(!types(events).includes('emission-started'));
  assert.equal(state.zone.emissionPassed, true);
});

test('Émission : atteindre un abri avant 3 PA de plus, le joueur est sauf', () => {
  let { state, events } = play(gameWith({ deck: ['emission'], abri: [1] }), [move(2)]);
  assert.deepEqual(events.at(-1), { type: 'emission-started', apLeftToShelter: 3 });
  ({ state, events } = play(state, [move(1)]));
  assert.deepEqual(events.find((e) => e.type === 'emission-survived'), { type: 'emission-survived', hex: 1 });
  assert.equal(state.zone.emission, null);
  assert.equal(state.player.wounds, 0);
  assert.equal(state.status, 'playing');
});

test('Émission : le compte à rebours est annoncé à chaque action', () => {
  const { events } = play(gameWith({ deck: ['emission'] }), [move(2), move(1)]);
  assert.deepEqual(events.at(-1), { type: 'emission-countdown', left: 2 });
});

test('Émission : sans abri après 3 PA, 5 blessures et fin de partie', () => {
  const { state, events } = play(gameWith({ deck: ['emission', 'calme'] }), [move(2), move(1), move(3), move(4)]);
  assert.ok(types(events).includes('emission-caught'));
  assert.deepEqual(events.find((e) => e.type === 'wounded'), { type: 'wounded', amount: 5, cause: 'emission' });
  assert.equal(state.player.wounds, 5);
  assert.equal(state.status, 'emission');
  assert.equal(step(state, move(3)).events[0].reason, 'game-over');
});

test('Émission passée : les jetons non ramassés sont retirés et 5 neufs reposés', () => {
  const game = gameWith({ deck: ['emission'], abri: [2] });
  game.tokens = [{ hex: 5, kind: 'rien', revealed: true, original: true }];
  const { state, events } = play(game, [move(2)]);
  assert.ok(types(events).includes('suspects-reset'));
  assert.equal(state.tokens.length, 5);
  assert.ok(state.tokens.every((t) => !t.revealed && t.original === false));
  assert.ok(state.tokens.every((t) => t.hex !== 2 && t.hex !== 8));
});
