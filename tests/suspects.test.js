import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createGame, step } from '../src/engine/game.js';
import { createRng } from '../src/engine/rng.js';
import { neighbors, distance } from '../src/engine/hex.js';
import { placeSuspects, ARTEFACT_VALUE } from '../src/engine/rules/suspects.js';
import { countCharges, createItem } from '../src/engine/rules/sheet.js';
import { createCampaign } from '../src/engine/campaign.js';
import { campaignTile } from '../src/engine/rules/world.js';
import content from '../src/content/index.js';

// Tuile factice tout en herbe, entrée 14 comme Agroprom.
function fakeTile() {
  const hexes = {};
  for (let n = 1; n <= 19; n++) hexes[n] = { terrain: 'herbe' };
  return { name: 'Test', entry: 14, hexes };
}

const hidden = (hex, kind, anomaly) => ({ hex, kind, ...(anomaly && { anomaly }), revealed: false, original: true });

// Joueur au centre (1, voisins 2 à 7), jetons choisis, Survie forcée : +10 réussit toujours, -10 rate toujours.
function setup(tokens, { survie = 1, seed = 1 } = {}) {
  const state = createGame({ seed, tile: fakeTile() });
  state.player.hex = 1;
  state.player.stats.survie = survie;
  state.tokens = tokens;
  return state;
}

const move = (to) => ({ type: 'move', to });
const bolt = (target) => ({ type: 'bolt', target });
const PICKUP = { type: 'pickup' };
const FAIL = { survie: -10 };
const PASS = { survie: 10 };

test('mise en place : 5 jetons au d20, jamais sur 20, l\'entrée ni deux fois le même hexagone', () => {
  for (let seed = 1; seed <= 200; seed++) {
    const { tokens } = createGame({ seed, tile: fakeTile() });
    const hexes = tokens.map((t) => t.hex);
    assert.equal(tokens.length, 5);
    assert.equal(new Set(hexes).size, 5);
    assert.ok(hexes.every((h) => h >= 1 && h <= 19 && h !== 14));
    assert.ok(tokens.every((t) => !t.revealed && t.original));
  }
});

test('composition : 2 anomalies typées, 2 artefacts, 1 rien', () => {
  const types = new Set();
  for (let seed = 1; seed <= 100; seed++) {
    const { tokens } = createGame({ seed, tile: fakeTile() });
    const kinds = tokens.map((t) => t.kind).sort();
    assert.deepEqual(kinds, ['anomalie', 'anomalie', 'artefact', 'artefact', 'rien']);
    tokens.filter((t) => t.kind === 'anomalie').forEach((t) => types.add(t.anomaly));
  }
  assert.deepEqual([...types].sort(), ['bruleuse', 'electro', 'gravitationnelle']);
});

test('chaque artefact est adjacent à une anomalie', () => {
  for (let seed = 1; seed <= 200; seed++) {
    const { tokens } = createGame({ seed, tile: fakeTile() });
    const anomalies = tokens.filter((t) => t.kind === 'anomalie').map((t) => t.hex);
    for (const artefact of tokens.filter((t) => t.kind === 'artefact')) {
      assert.ok(neighbors(artefact.hex).some((n) => anomalies.includes(n)), `graine ${seed}`);
    }
  }
});

test('placeSuspects repose 5 jetons neufs, hors du joueur, marqués non d\'origine', () => {
  const state = setup([hidden(2, 'rien')]);
  placeSuspects(state, createRng(9), { original: false });
  assert.equal(state.tokens.length, 5);
  assert.ok(state.tokens.every((t) => !t.original && !t.revealed && t.hex !== 1 && t.hex !== 14));
});

test('même graine, même mise en place', () => {
  assert.deepEqual(createGame({ seed: 7, tile: fakeTile() }), createGame({ seed: 7, tile: fakeTile() }));
});

test('entrer à l\'aveugle : Survie réussie évite l\'effet, le jeton est révélé', () => {
  const { state, events } = step(setup([hidden(2, 'anomalie', 'electro')], PASS), move(2));
  assert.equal(state.player.wounds, 0);
  assert.equal(state.detector.broken, false);
  assert.equal(state.tokens[0].revealed, true);
  assert.ok(events.some((e) => e.type === 'anomaly-avoided' && e.anomaly === 'electro'));
  assert.deepEqual(events.find((e) => e.type === 'token-revealed'),
    { type: 'token-revealed', hex: 2, kind: 'anomalie', anomaly: 'electro', original: true, by: 'enter' });
});

test('anomalie électro : 2 blessures et détecteur en panne', () => {
  const { state, events } = step(setup([hidden(2, 'anomalie', 'electro')], FAIL), move(2));
  assert.equal(state.player.wounds, 2);
  assert.equal(state.detector.broken, true);
  assert.ok(events.some((e) => e.type === 'detector-broken'));
});

test('anomalie gravitationnelle : 3 blessures, projeté sur un voisin au hasard sans coût de PA', () => {
  const landings = new Set();
  for (let seed = 1; seed <= 40; seed++) {
    const { state, events } = step(setup([hidden(2, 'anomalie', 'gravitationnelle')], { ...FAIL, seed }), move(2));
    assert.equal(state.player.wounds, 3);
    assert.equal(state.ap.left, 9);
    assert.ok(neighbors(2).includes(state.player.hex));
    assert.deepEqual(events.find((e) => e.type === 'thrown'), { type: 'thrown', from: 2, to: state.player.hex });
    landings.add(state.player.hex);
  }
  assert.ok(landings.size > 1);
});

test('anomalie brûleuse : 2 blessures et un consommable détruit', () => {
  const start = setup([hidden(2, 'anomalie', 'bruleuse')], FAIL);
  const { state, events } = step(start, move(2));
  assert.equal(state.player.wounds, 2);
  assert.equal(state.inventory.length, start.inventory.length - 1);
  const removed = events.find((e) => e.type === 'item-removed');
  assert.ok(['bandage', 'vodka', 'ration'].includes(removed.kind));
  assert.equal(removed.cause, 'bruleuse');
});

test('une anomalie révélée bloque l\'hexagone', () => {
  const start = setup([{ ...hidden(2, 'anomalie', 'electro'), revealed: true }]);
  const { state, events } = step(start, move(2));
  assert.equal(state, start);
  assert.equal(events[0].reason, 'blocked');
});

test('rien : fausse alerte, révélé sans effet', () => {
  const { state, events } = step(setup([hidden(2, 'rien')], FAIL), move(2));
  assert.equal(state.player.wounds, 0);
  assert.equal(state.tokens[0].revealed, true);
  assert.ok(!events.some((e) => e.type === 'check'));
});

test('boulon : 1 PA, 1 boulon, révèle le jeton adjacent sans le déclencher', () => {
  const { state, events } = step(setup([hidden(2, 'anomalie', 'bruleuse')], FAIL), bolt(2));
  assert.equal(state.ap.left, 9);
  assert.equal(countCharges(state.inventory, 'boulons'), 9);
  assert.equal(state.player.wounds, 0);
  assert.equal(state.tokens[0].revealed, true);
  assert.deepEqual(events.map((e) => e.type), ['bolt-thrown', 'token-revealed']);
  assert.equal(events[1].by, 'bolt');
});

test('boulon sur un hexagone vide : ne révèle rien mais coûte quand même', () => {
  const { state, events } = step(setup([]), bolt(3));
  assert.equal(state.ap.left, 9);
  assert.deepEqual(events, [{ type: 'bolt-thrown', target: 3 }]);
});

test('boulon : 10 au départ, refus hors adjacence, sans boulon ou sans PA', () => {
  const start = setup([]);
  assert.equal(countCharges(start.inventory, 'boulons'), 10);
  assert.equal(step(start, bolt(14)).events[0].reason, 'not-adjacent');

  const empty = { ...start, inventory: start.inventory.filter((i) => i.kind !== 'boulons') };
  assert.equal(step(empty, bolt(2)).events[0].reason, 'no-bolt');

  const tired = { ...start, ap: { ...start.ap, left: 0 } };
  assert.equal(step(tired, bolt(2)).events[0].reason, 'not-enough-ap');
});

test('détecteur : révèle les artefacts à 2 hexagones ou moins après un déplacement', () => {
  // 1 -> 2 ; artefacts en 9 (distance 1) et 4 (distance 2), un troisième à distance 3.
  const far = [12, 13, 14, 15, 16].find((h) => distance(2, h) > 2);
  const start = setup([hidden(9, 'artefact'), hidden(4, 'artefact'), hidden(far, 'artefact'), hidden(5, 'rien')]);
  const { state, events } = step(start, move(2));
  const revealed = state.tokens.filter((t) => t.revealed).map((t) => t.hex);
  assert.deepEqual(revealed, [9, 4]);
  assert.ok(events.filter((e) => e.type === 'token-revealed').every((e) => e.by === 'detector'));
});

test('détecteur en panne : ne révèle plus rien', () => {
  const start = setup([hidden(9, 'artefact')]);
  start.detector.broken = true;
  const { state } = step(start, move(2));
  assert.equal(state.tokens[0].revealed, false);
});

test('ramasser : 1 PA + Survie, l\'artefact entre dans l\'inventaire avec sa valeur', () => {
  const start = setup([{ ...hidden(1, 'artefact'), revealed: true }], PASS);
  const { state, events } = step(start, PICKUP);
  assert.equal(state.ap.left, 9);
  assert.equal(state.tokens.length, 0);
  assert.deepEqual(state.inventory.at(-1), { kind: 'artefact', size: 1, value: ARTEFACT_VALUE });
  assert.ok(events.some((e) => e.type === 'artefact-picked' && e.value === ARTEFACT_VALUE));
});

test('ramasser raté : PA perdu, le jeton reste', () => {
  const start = setup([{ ...hidden(1, 'artefact'), revealed: true }], FAIL);
  const { state, events } = step(start, PICKUP);
  assert.equal(state.ap.left, 9);
  assert.equal(state.tokens.length, 1);
  assert.ok(events.some((e) => e.type === 'pickup-failed'));
});

test('ramasser : refus sans artefact révélé, inventaire plein ou sans PA', () => {
  assert.equal(step(setup([hidden(1, 'artefact')]), PICKUP).events[0].reason, 'no-artefact');
  assert.equal(step(setup([]), PICKUP).events[0].reason, 'no-artefact');

  const full = setup([{ ...hidden(1, 'artefact'), revealed: true }]);
  while (full.inventory.reduce((n, i) => n + i.size, 0) < 12) full.inventory.push(createItem('ration'));
  assert.equal(step(full, PICKUP).events[0].reason, 'inventory-full');

  const tired = setup([{ ...hidden(1, 'artefact'), revealed: true }]);
  tired.ap.left = 0;
  assert.equal(step(tired, PICKUP).events[0].reason, 'not-enough-ap');
});

// LBL-55 (4) : en campagne, pas de jeton anomalie sur l'hexagone d'un lieu ou d'une liaison.

const keptClear = (id) => [
  ...Object.values(content.places).filter((place) => place.tile === id).map((place) => place.hex),
  ...Object.keys(content.links[id] ?? {}).map(Number),
];
const anomalyHexes = (tokens) => tokens.filter((t) => t.kind === 'anomalie').map((t) => t.hex);

test('campagne : aucune anomalie posée sur un lieu ou une liaison, sur chaque tuile', () => {
  for (const id of Object.keys(content.tiles)) {
    const clear = keptClear(id);
    for (let seed = 1; seed <= 40; seed++) {
      const state = createGame({ seed, tile: campaignTile(id) });
      for (const hex of anomalyHexes(state.tokens)) assert.ok(!clear.includes(hex), `${id} ${seed} : ${hex}`);
    }
  }
});

test('campagne : la tuile de départ et les jetons reposés suivent la même règle', () => {
  const clear = keptClear('cordon');
  for (let seed = 1; seed <= 40; seed++) {
    const campaign = createCampaign({ seed });
    const tile = campaign.world.tiles.cordon;
    for (const hex of anomalyHexes(tile.tokens)) assert.ok(!clear.includes(hex), `${seed} : ${hex}`);
    const board = { tile: tile.tile, player: { hex: tile.tile.entry } };
    placeSuspects(board, createRng(seed), { original: false });
    for (const hex of anomalyHexes(board.tokens)) assert.ok(!clear.includes(hex), `reposé ${seed} : ${hex}`);
  }
});
