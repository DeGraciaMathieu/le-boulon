import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createGame, step } from '../src/engine/game.js';
import { createCampaign, step as stepCampaign, dayState } from '../src/engine/campaign.js';
import { createRng } from '../src/engine/rng.js';
import { distance, neighbors } from '../src/engine/hex.js';
import { ENCOUNTER_CARDS } from '../src/engine/rules/encounters.js';
import { zoneAfterAction } from '../src/engine/rules/zone.js';
import {
  TILE_DEFAULTS,
  tileHexes,
  hasHex,
  suspectComposition,
  anomalyKinds,
  encounterCount,
  encounterCards,
  cardsById,
  zoneCards,
} from '../src/engine/rules/tile.js';
import agroprom from '../src/engine/data/agroprom.js';
import agropromEncounters from '../src/content/paquets/rencontres-agroprom.js';

// Tuile factice différente de l'Agroprom : forêt partout, entrée 12, abri en 1, son propre
// paquet de rencontres et sa propre composition.
const CARDS = {
  rats: { name: 'Rats', threat: 2, wounds: 1 },
  snork: { name: 'Snork', threat: 9, wounds: 4 },
};

function fakeTile(overrides = {}) {
  const hexes = {};
  for (let n = 1; n <= 19; n++) hexes[n] = { terrain: 'foret' };
  hexes[1] = { terrain: 'batiment', lieu: 'Bunker', abri: true };
  return {
    name: 'Factice',
    entry: 12,
    hexes,
    encounterCards: CARDS,
    composition: {
      suspects: ['anomalie', 'artefact', 'artefact'],
      anomalies: ['electro'],
      encounters: 2,
      zone: ['brouillard', 'chiens'],
    },
    ...overrides,
  };
}

// Premier état de RNG dont les d6 sortent dans cet ordre.
function seedFor(rolls) {
  for (let seed = 0; ; seed++) {
    const rng = createRng(seed);
    if (rolls.every((roll) => rng.d6() === roll)) return seed;
  }
}

test('sans surcharge, la tuile prend les valeurs globales', () => {
  const plain = { name: 'Nue', entry: 8, hexes: { 1: { terrain: 'herbe' } } };
  assert.deepEqual(suspectComposition(plain), TILE_DEFAULTS.suspects);
  assert.deepEqual(anomalyKinds(plain), TILE_DEFAULTS.anomalies);
  assert.equal(encounterCount(plain), 3);
  assert.equal(zoneCards(plain).length, 9);
  assert.equal(encounterCards(plain), ENCOUNTER_CARDS);
});

test("l'Agroprom porte son paquet de rencontres, gelé en profondeur", () => {
  assert.equal(agroprom.encounterCards, cardsById(agropromEncounters));
  assert.equal(encounterCards(agroprom), ENCOUNTER_CARDS);
  assert.ok(Object.isFrozen(agropromEncounters));
  assert.ok(agropromEncounters.cards.every(Object.isFrozen));
});

test('tileHexes et hasHex suivent les clés de tile.hexes', () => {
  const tile = { hexes: { 3: {}, 1: {}, 12: {} } };
  assert.deepEqual(tileHexes(tile), [1, 3, 12]);
  assert.ok(hasHex(tile, 12));
  assert.ok(!hasHex(tile, 2));
  assert.ok(!hasHex(tile, 20));
});

test('createGame : suspects, rencontres et paquet Zone suivent la tuile factice', () => {
  for (let seed = 1; seed <= 40; seed++) {
    const game = createGame({ seed, tile: fakeTile() });

    assert.deepEqual(game.tokens.map((t) => t.kind).sort(), ['anomalie', 'artefact', 'artefact']);
    assert.ok(game.tokens.every((t) => t.hex !== 12 && (t.kind !== 'anomalie' || t.anomaly === 'electro')));
    const anomaly = game.tokens.find((t) => t.kind === 'anomalie');
    for (const artefact of game.tokens.filter((t) => t.kind === 'artefact')) {
      assert.ok(neighbors(artefact.hex).includes(anomaly.hex));
    }

    assert.equal(game.encounters.length, 2);
    assert.ok(game.encounters.every((e) => e.hex !== 12));
    assert.deepEqual([...game.encounterDeck].sort(), ['rats', 'snork']);

    assert.deepEqual([...game.zone.deck].sort(), ['brouillard', 'chiens', 'emission']);
  }
});

test('une tuile partielle ne reçoit jetons et rencontres que sur ses hexagones', () => {
  const hexes = {};
  for (let n = 1; n <= 9; n++) hexes[n] = { terrain: 'herbe' };
  for (let seed = 1; seed <= 40; seed++) {
    const game = createGame({ seed, tile: { name: 'Petite', entry: 8, hexes } });
    for (const hex of [...game.tokens, ...game.encounters].map((x) => x.hex)) {
      assert.ok(hex >= 1 && hex <= 9 && hex !== 8, `seed ${seed} : hexagone ${hex}`);
    }
  }
});

test('trop de jetons pour la tuile : erreur à la mise en place', () => {
  const tile = { name: 'Minuscule', entry: 1, hexes: { 1: { terrain: 'herbe' }, 2: { terrain: 'herbe' } } };
  assert.throws(() => createGame({ seed: 1, tile }), /pas assez d'hexagones/);
});

test('rencontre : la carte piochée et sa Menace viennent du paquet de la tuile', () => {
  const game = createGame({ seed: 1, tile: fakeTile() });
  const to = neighbors(12)[0];
  game.tokens = [];
  game.encounters = [{ hex: to, card: null }];
  game.encounterDeck = ['snork'];
  // Discrétion ratée (1 + 1 + forêt 1 < 5), puis combat : 6 + 1 + pistolet 1 + forêt 1 = 9.
  game.rng = seedFor([1, 6]);

  let { state, events } = step(game, { type: 'move', to });
  assert.deepEqual(state.combat, { hex: to, card: 'snork' });

  ({ state, events } = step(state, { type: 'fight' }));
  const fight = events.find((e) => e.type === 'fight');
  assert.equal(fight.threat, 9);
  assert.equal(fight.total, 9);
  assert.ok(fight.won);
});

test('rencontre : paquet vide, on remélange les cartes de la tuile', () => {
  const game = createGame({ seed: 1, tile: fakeTile() });
  const to = neighbors(12)[0];
  game.tokens = [];
  game.encounters = [{ hex: to, card: null }];
  game.encounterDeck = [];
  game.rng = seedFor([1]);
  const { state } = step(game, { type: 'move', to });
  assert.ok(Object.keys(CARDS).includes(state.combat.card));
  assert.equal(state.encounterDeck.length, 1);
});

test('Zone : les chiens ne se posent que sur un hexagone de la tuile', () => {
  const hexes = {};
  for (let n = 1; n <= 7; n++) hexes[n] = { terrain: 'herbe' };
  hexes[8] = { terrain: 'herbe' };
  const game = createGame({ seed: 1, tile: { name: 'Petite', entry: 8, hexes } });
  game.player.hex = 1;
  game.encounters = [];
  game.zone.deck = ['chiens'];
  game.ap.spent = 3;
  const events = [];
  zoneAfterAction(game, 2, { rng: createRng(5), emit: (e) => events.push(e) });
  // Distance 2 de 1 : seul l'anneau extérieur, dont seul 8 (l'entrée) est sur la tuile.
  assert.deepEqual(events.at(-1), { type: 'dogs-placed', hex: null });
  assert.deepEqual(game.encounters, []);
});

test("Zone : l'abri de la tuile factice protège de l'Émission", () => {
  const game = createGame({ seed: 1, tile: fakeTile() });
  game.player.hex = 1;
  game.tokens = [];
  game.zone.deck = ['emission'];
  game.ap.spent = 3;
  const events = [];
  zoneAfterAction(game, 2, { rng: createRng(5), emit: (e) => events.push(e) });
  assert.ok(events.some((e) => e.type === 'emission-survived'));
  assert.deepEqual(game.tokens.map((t) => t.kind).sort(), ['anomalie', 'artefact', 'artefact']);
  assert.ok(game.tokens.every((t) => !t.original && distance(1, t.hex) >= 1));
});

test('createCampaign démarre sur une tuile factice et relaie les actions v1', () => {
  const tiles = { factice: fakeTile() };
  const campaign = createCampaign({ seed: 3, tile: 'factice', tiles });
  assert.equal(campaign.world.currentTile, 'factice');
  assert.equal(campaign.world.hex, 12);
  const day = dayState(campaign);
  assert.equal(day.encounters.length, 2);
  assert.equal(day.tokens.length, 3);

  const to = neighbors(12).find((n) => !day.tokens.some((t) => t.hex === n && t.revealed));
  const { state, events } = stepCampaign(campaign, { type: 'move', to });
  assert.notEqual(state, campaign);
  assert.equal(events[0].type, 'moved');
  assert.deepEqual(JSON.parse(JSON.stringify(state)), state);
});

test('createCampaign refuse une tuile inconnue', () => {
  assert.throws(() => createCampaign({ seed: 1, tile: 'nulle-part' }), /tuile inconnue/);
});
