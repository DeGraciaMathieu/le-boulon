import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createGame, step } from '../src/engine/game.js';
import { neighbors } from '../src/engine/hex.js';
import {
  INVENTORY_SLOTS,
  wound,
  irradiate,
  createItem,
  usedSlots,
  addItem,
  removeItem,
  useCharge,
  countCharges,
  consumables,
} from '../src/engine/rules/sheet.js';

function fakeTile() {
  const hexes = {};
  for (let n = 1; n <= 19; n++) hexes[n] = { terrain: 'herbe' };
  hexes[8] = { terrain: 'route' };
  hexes[19] = { terrain: 'marais' };
  return { name: 'Test', entry: 8, hexes };
}

// Sans jetons suspects : ils sont testés dans tests/suspects.test.js.
const newGame = (seed = 1) => ({ ...createGame({ seed, tile: fakeTile() }), tokens: [] });
const use = (item) => ({ type: 'use', item });

// Brouillon et journal pour appeler les règles hors de step.
function sandbox() {
  const draft = newGame();
  const events = [];
  return { draft, events, emit: (event) => events.push(event) };
}

test('blessures : la piste monte et le joueur est prévenu', () => {
  const { draft, events, emit } = sandbox();
  wound(draft, 2, 'test', emit);
  assert.equal(draft.player.wounds, 2);
  assert.deepEqual(events, [{ type: 'wounded', amount: 2, cause: 'test' }]);
});

test('blessures : atteindre 4 retire 1 PA du budget restant, une seule fois', () => {
  const { draft, events, emit } = sandbox();
  wound(draft, 4, 'test', emit);
  assert.equal(draft.ap.left, 9);
  assert.equal(draft.ap.spent, 0);
  assert.deepEqual(events.at(-1), { type: 'ap-penalty', amount: 1, cause: 'wounds' });

  draft.player.wounds = 3;
  wound(draft, 1, 'test', emit);
  assert.equal(draft.ap.left, 9);
});

test('blessures : la pénalité ne fait pas passer les PA sous 0', () => {
  const { draft, emit } = sandbox();
  draft.ap.left = 0;
  wound(draft, 4, 'test', emit);
  assert.equal(draft.ap.left, 0);
});

test('blessures : à 6, mort et partie perdue', () => {
  const { draft, events, emit } = sandbox();
  wound(draft, 9, 'test', emit);
  assert.equal(draft.player.wounds, 6);
  assert.equal(draft.status, 'dead');
  assert.deepEqual(events.at(-1), { type: 'died', cause: 'test' });
});

test('radiations : la piste monte jusqu\'à 5 sans effet', () => {
  const { draft, events, emit } = sandbox();
  irradiate(draft, 5, 'test', emit);
  assert.equal(draft.player.radiation, 5);
  assert.equal(draft.player.wounds, 0);
  assert.deepEqual(events, [{ type: 'irradiated', amount: 5, cause: 'test' }]);
});

test('radiations : à 6, 1 blessure puis retour à 3', () => {
  const { draft, events, emit } = sandbox();
  irradiate(draft, 8, 'test', emit);
  assert.equal(draft.player.radiation, 3);
  assert.equal(draft.player.wounds, 1);
  assert.deepEqual(events.at(-1), { type: 'wounded', amount: 1, cause: 'radiation' });
});

test('inventaire de départ : pistolet, munitions (6), boulons (10), 2 bandages, vodka, ration', () => {
  const { inventory } = newGame();
  assert.deepEqual(inventory.map((item) => item.kind), ['pistolet', 'munitions', 'boulons', 'bandage', 'bandage', 'vodka', 'ration']);
  assert.equal(usedSlots(inventory), 8);
  assert.equal(countCharges(inventory, 'munitions'), 6);
  assert.equal(countCharges(inventory, 'boulons'), 10);
});

test('inventaire : un artefact occupe 1 case, ajout refusé si la grille est pleine', () => {
  const { draft } = sandbox();
  for (let i = usedSlots(draft.inventory); i < INVENTORY_SLOTS; i++) {
    assert.equal(addItem(draft, createItem('artefact')), true);
  }
  assert.equal(usedSlots(draft.inventory), 12);
  assert.equal(addItem(draft, createItem('artefact')), false);
  assert.equal(draft.inventory.length, 11);
});

test('inventaire : un objet de 2 cases est refusé s\'il ne reste qu\'une case', () => {
  const { draft } = sandbox();
  for (let i = 0; i < 3; i++) addItem(draft, createItem('artefact'));
  assert.equal(addItem(draft, createItem('pistolet')), false);
});

test('inventaire : retirer ou détruire un consommable', () => {
  const { draft, events, emit } = sandbox();
  assert.deepEqual(consumables(draft.inventory), ['bandage', 'bandage', 'vodka', 'ration']);
  assert.equal(removeItem(draft, 'vodka', 'brûleuse', emit).kind, 'vodka');
  assert.deepEqual(events, [{ type: 'item-removed', kind: 'vodka', cause: 'brûleuse' }]);
  assert.equal(removeItem(draft, 'vodka', 'brûleuse', emit), null);
});

test('inventaire : dépenser munitions et boulons, la boîte vide libère sa case', () => {
  const { draft } = sandbox();
  assert.equal(useCharge(draft, 'boulons'), true);
  assert.equal(countCharges(draft.inventory, 'boulons'), 9);

  for (let i = 0; i < 6; i++) assert.equal(useCharge(draft, 'munitions'), true);
  assert.equal(countCharges(draft.inventory, 'munitions'), 0);
  assert.equal(useCharge(draft, 'munitions'), false);
  assert.equal(usedSlots(draft.inventory), 7);
});

test('bandage : 1 PA, -1 blessure, consommé', () => {
  const start = newGame();
  start.player.wounds = 2;
  const { state, events } = step(start, use('bandage'));
  assert.equal(state.ap.left, 9);
  assert.equal(state.player.wounds, 1);
  assert.equal(consumables(state.inventory).filter((kind) => kind === 'bandage').length, 1);
  assert.deepEqual(events, [{ type: 'used', item: 'bandage', wounds: -1 }]);
});

test('vodka : 1 PA, -2 radiations, consommée', () => {
  const start = newGame();
  start.player.radiation = 3;
  const { state, events } = step(start, use('vodka'));
  assert.equal(state.ap.left, 9);
  assert.equal(state.player.radiation, 1);
  assert.deepEqual(events, [{ type: 'used', item: 'vodka', radiation: -2 }]);
});

test('ration : 1 PA, consommée, sans effet en v1', () => {
  const { state, events } = step(newGame(), use('ration'));
  assert.equal(state.ap.left, 9);
  assert.equal(countCharges(state.inventory, 'ration'), 0);
  assert.deepEqual(events, [{ type: 'used', item: 'ration' }]);
});

test('utiliser : refus sans l\'objet, sans PA ou si l\'objet ne s\'utilise pas', () => {
  const noVodka = newGame();
  noVodka.inventory = noVodka.inventory.filter((item) => item.kind !== 'vodka');
  assert.equal(step(noVodka, use('vodka')).events[0].reason, 'no-item');

  const tired = newGame();
  tired.ap.left = 0;
  assert.equal(step(tired, use('bandage')).events[0].reason, 'not-enough-ap');

  assert.equal(step(newGame(), use('pistolet')).events[0].reason, 'not-usable');
});

test('marais : l\'échec passe par la piste de blessures (mort à 6)', () => {
  for (let seed = 1; seed <= 40; seed++) {
    const start = newGame(seed);
    start.player.wounds = 5;
    start.player.hex = neighbors(19)[0];
    const { state, events } = step(start, { type: 'move', to: 19 });
    if (events.find((e) => e.type === 'check').success) continue;
    assert.equal(state.status, 'dead');
    assert.deepEqual(events.at(-2), { type: 'died', cause: 'marais' });
    return;
  }
  assert.fail('aucune graine ne rate le test de Survie');
});
