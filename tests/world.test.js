import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createCampaign, step, dayState, CAMPAIGN_ACTIONS } from '../src/engine/campaign.js';
import { travel, travelTarget, knownTiles, daysAway, TRAVEL_COST } from '../src/engine/rules/world.js';
import { isEdge } from '../src/engine/hex.js';
import { encounterCount, encounterCards } from '../src/engine/rules/tile.js';
import content from '../src/content/index.js';

const jsonCopy = (value) => JSON.parse(JSON.stringify(value));

// Campagne posée sur un hexagone de la tuile courante, sans combat en cours.
function standOn(campaign, hex) {
  const copy = jsonCopy(campaign);
  copy.world.hex = hex;
  return copy;
}

function travelFrom(campaign, hex) {
  return step(standOn(campaign, hex), { type: 'travel' });
}

// Les 7 liaisons du §3.2, une fois chacune.
const PAIRS = Object.entries(content.links).flatMap(([tile, exits]) =>
  Object.entries(exits)
    .map(([hex, to]) => ({ tile, hex: Number(hex), to }))
    .filter(({ tile, to }) => tile < to.tile),
);

test('travel est une action de campagne', () => {
  assert.equal(CAMPAIGN_ACTIONS.travel, travel);
});

test('les 7 liaisons du §3.2 relient des hexagones de bord', () => {
  assert.equal(PAIRS.length, 7);
  for (const { hex, to } of PAIRS) {
    assert.ok(isEdge(hex));
    assert.ok(isEdge(to.hex));
  }
});

test('chaque liaison se traverse dans les deux sens', () => {
  for (const { tile, hex, to } of PAIRS) {
    const start = createCampaign({ seed: 3, tile });
    const there = travelFrom(start, hex);
    assert.equal(there.state.world.currentTile, to.tile, `${tile} ${hex}`);
    assert.equal(there.state.world.hex, to.hex);
    assert.deepEqual(there.events[0], {
      type: 'traveled', from: { tile, hex }, to, cost: TRAVEL_COST, firstVisit: true,
    });

    const back = step(there.state, { type: 'travel' });
    assert.equal(back.state.world.currentTile, tile, `${to.tile} ${to.hex}`);
    assert.equal(back.state.world.hex, hex);
    assert.equal(back.events[0].firstVisit, false);
  }
});

test('voyager coûte 1 PA, reportés sur la tuile d\'arrivée', () => {
  const start = standOn(createCampaign({ seed: 5 }), 19);
  const before = dayState(start).ap;
  const { state } = step(start, { type: 'travel' });
  const after = dayState(state);
  assert.equal(TRAVEL_COST, 1);
  assert.equal(after.ap.left, before.left - 1);
  assert.equal(after.ap.spent, before.spent + 1);
  assert.equal(after.ap.max, before.max);
  assert.equal(after.player.hex, 13);
  assert.equal(after.player.previousHex, null);
  assert.equal(after.status, 'playing');
});

test('refus hors liaison, sans PA, en combat, journée finie', () => {
  const campaign = createCampaign({ seed: 5 });

  const offLink = standOn(campaign, 1);
  assert.deepEqual(step(offLink, { type: 'travel' }).events[0].reason, 'not-a-link');
  assert.equal(step(offLink, { type: 'travel' }).state, offLink);

  const tired = standOn(campaign, 19);
  tired.world.tiles.cordon.ap.left = 0;
  assert.equal(step(tired, { type: 'travel' }).events[0].reason, 'not-enough-ap');

  const fighting = standOn(campaign, 19);
  fighting.world.tiles.cordon.combat = { hex: 19, card: 'pillard' };
  assert.equal(step(fighting, { type: 'travel' }).events[0].reason, 'in-combat');

  const night = standOn(campaign, 19);
  night.world.tiles.cordon.status = 'night';
  assert.equal(step(night, { type: 'travel' }).events[0].reason, 'game-over');
});

test('le dernier PA dépensé en voyage finit la journée à l\'arrivée', () => {
  const start = standOn(createCampaign({ seed: 5 }), 19);
  start.world.tiles.cordon.ap.left = 1;
  const { state, events } = step(start, { type: 'travel' });
  assert.equal(state.world.currentTile, 'decharge');
  assert.equal(dayState(state).status, 'night');
  assert.deepEqual(events.at(-1), { type: 'day-ended', reason: 'no-ap' });
});

test('première visite : état de tuile créé, hexagone d\'arrivée libre, fiche conservée', () => {
  const start = standOn(createCampaign({ seed: 11 }), 19);
  start.player.wounds = 2;
  assert.equal(start.world.tiles.decharge, undefined);
  const { state } = step(start, { type: 'travel' });
  const decharge = state.world.tiles.decharge;

  assert.equal(decharge.tile.name, content.tiles.decharge.name);
  assert.equal(decharge.encounters.length, encounterCount(content.tiles.decharge));
  assert.ok(decharge.encounters.every((encounter) => encounter.hex !== 13));
  assert.ok(decharge.tokens.every((token) => token.hex !== 13));
  assert.equal(state.player.wounds, 2);
  assert.deepEqual(state.inventory, start.inventory);
  for (const key of ['seed', 'rng', 'inventory', 'equipment', 'lastVisit']) assert.ok(!(key in decharge), key);
  for (const key of ['hex', 'wounds', 'radiation', 'stats']) assert.ok(!(key in decharge.player), key);
});

test('état de tuile conservé à l\'aller-retour le même jour', () => {
  const start = standOn(createCampaign({ seed: 13 }), 19);
  const cordon = jsonCopy(start.world.tiles.cordon);
  const there = step(start, { type: 'travel' }).state;
  const decharge = jsonCopy(there.world.tiles.decharge);
  const back = step(there, { type: 'travel' }).state;
  const again = step(back, { type: 'travel' }).state;

  for (const key of ['tokens', 'encounters', 'encounterDeck', 'zone', 'mission']) {
    assert.deepEqual(back.world.tiles.cordon[key], cordon[key], `cordon.${key}`);
    assert.deepEqual(again.world.tiles.decharge[key], decharge[key], `decharge.${key}`);
  }
});

test('tuiles connues et jour de dernière visite', () => {
  const start = standOn(createCampaign({ seed: 17 }), 19);
  assert.deepEqual(knownTiles(start), ['cordon']);
  assert.equal(daysAway(start, 'cordon'), 0);

  const there = step(start, { type: 'travel' }).state;
  assert.deepEqual(knownTiles(there).sort(), ['cordon', 'decharge']);
  assert.equal(there.world.tiles.cordon.lastVisit, 1);
  there.day = 3;
  assert.equal(daysAway(there, 'cordon'), 2);
  assert.equal(daysAway(there, 'decharge'), 0);
});

test('travelTarget lit la liaison sous le joueur', () => {
  const campaign = createCampaign({ seed: 1 });
  assert.deepEqual(travelTarget(standOn(campaign, 19)), { tile: 'decharge', hex: 13 });
  assert.deepEqual(travelTarget(standOn(campaign, 15)), { tile: 'marais', hex: 11 });
  assert.equal(travelTarget(standOn(campaign, 1)), null);
});

test('rencontres reposées en revenant sur une tuile quittée depuis 1 jour', () => {
  for (const seed of [1, 2, 3, 4, 5]) {
    const start = standOn(createCampaign({ seed }), 19);
    start.world.tiles.cordon.encounters = [{ hex: 2, card: 'pillard' }];
    const there = step(start, { type: 'travel' }).state;
    const tokens = jsonCopy(there.world.tiles.cordon.tokens);

    const sameDay = step(there, { type: 'travel' });
    assert.deepEqual(sameDay.state.world.tiles.cordon.encounters, [{ hex: 2, card: 'pillard' }]);
    assert.ok(sameDay.events.every((event) => event.type !== 'encounters-reset'));

    const nextDay = jsonCopy(there);
    nextDay.day += 1;
    const { state, events } = step(nextDay, { type: 'travel' });
    const cordon = state.world.tiles.cordon;
    assert.equal(cordon.encounters.length, encounterCount(content.tiles.cordon));
    assert.ok(cordon.encounters.every((encounter) => encounter.card === null && encounter.hex !== 19));
    assert.deepEqual(cordon.encounterDeck.sort(), Object.keys(encounterCards(content.tiles.cordon)).sort());
    assert.deepEqual(cordon.tokens, tokens);
    assert.equal(cordon.tile.entry, content.tiles.cordon.entry);
    assert.deepEqual(events.find((event) => event.type === 'encounters-reset'), {
      type: 'encounters-reset', tile: 'cordon', hexes: cordon.encounters.map((encounter) => encounter.hex),
    });
  }
});

test('voyage pur, déterministe et sérialisable', () => {
  const start = standOn(createCampaign({ seed: 21 }), 19);
  const frozen = jsonCopy(start);
  const a = step(start, { type: 'travel' });
  const b = step(jsonCopy(start), { type: 'travel' });
  assert.deepEqual(start, frozen);
  assert.deepEqual(a, b);
  assert.deepEqual(jsonCopy(a.state), a.state);
  assert.notEqual(a.state.rng, start.rng);
});

test('après le voyage, les actions v1 jouent sur la tuile d\'arrivée', () => {
  const there = step(standOn(createCampaign({ seed: 23 }), 19), { type: 'travel' }).state;
  const target = 4;
  const { state, events } = step(there, { type: 'move', to: target });
  assert.equal(events[0].type, 'moved');
  assert.equal(state.world.currentTile, 'decharge');
  assert.equal(state.world.hex, target);
});
