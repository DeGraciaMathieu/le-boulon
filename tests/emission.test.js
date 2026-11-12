import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createCampaign, step, dayState, REACTIONS } from '../src/engine/campaign.js';
import {
  scheduleEmission, emissionAftermath, emissionAfterStep, rareArtefacts, EMISSION_GAP,
} from '../src/engine/rules/emission.js';
import { DAY_HOOKS } from '../src/engine/rules/time.js';
import { emissionPositions, EMISSION_WOUNDS } from '../src/engine/rules/zone.js';
import { createGame, step as stepDay } from '../src/engine/game.js';
import { PLACES, DECKS } from '../src/engine/rules/places.js';
import { createRng } from '../src/engine/rng.js';
import { neighbors } from '../src/engine/hex.js';
import content from '../src/content/index.js';
import agroprom from '../src/engine/data/agroprom.js';

const jsonCopy = (value) => JSON.parse(JSON.stringify(value));
const types = (events) => events.map((event) => event.type);
const ctxOf = (seed, events = []) => ({ rng: createRng(seed), emit: (event) => events.push(event) });

// Cordon : 18 la Ferme (abri), 13 l'Avant-poste (pas d'abri), 19 une liaison voisine de 18.
const SHELTER_HEX = 18;
const OPEN_HEX = 13;
const LINK_HEX = 19;

// Campagne au Cordon posée sur un hexagone, sans jetons ni rencontres sur la tuile.
function standOn(hex, { seed = 1 } = {}) {
  const campaign = jsonCopy(createCampaign({ seed }));
  campaign.world.hex = hex;
  clearTile(campaign.world.tiles.cordon);
  return campaign;
}

function clearTile(tile) {
  tile.tokens = [];
  tile.encounters = [];
}

// L'Émission tombe aujourd'hui.
function announce(campaign) {
  campaign.world.emission = { nextDay: campaign.day, today: true };
  return campaign;
}

// Aller-retour par la liaison : la tuile voisine existe dans world.tiles, retour au Cordon.
function withTwoTiles() {
  let campaign = standOn(LINK_HEX);
  campaign = step(campaign, { type: 'travel' }).state;
  campaign = step(campaign, { type: 'travel' }).state;
  assert.equal(campaign.world.currentTile, 'cordon');
  clearTile(campaign.world.tiles.cordon);
  return campaign;
}

const otherTile = (campaign) => Object.keys(campaign.world.tiles).find((id) => id !== 'cordon');

test('l\'Émission est branchée sur le hook de changement de jour et les réactions', () => {
  assert.ok(DAY_HOOKS.emission.includes(scheduleEmission));
  assert.ok(REACTIONS.includes(emissionAfterStep));
});

// Calendrier

test('calendrier : première Émission au jour 4 à 6, puis tous les 3 à 5 jours', () => {
  const gaps = new Set();
  for (let seed = 1; seed <= 20; seed++) {
    const draft = createCampaign({ seed });
    const ctx = ctxOf(seed);
    const days = [];
    for (let day = 2; day <= 60; day++) {
      draft.day = day;
      scheduleEmission(draft, ctx);
      if (!draft.world.emission.today) continue;
      days.push(day);
      emissionAftermath(draft, ctx);
    }
    assert.ok(days[0] >= 1 + EMISSION_GAP.min && days[0] <= 1 + EMISSION_GAP.max, `premier jour ${days[0]}`);
    for (let i = 1; i < days.length; i++) {
      const gap = days[i] - days[i - 1];
      assert.ok(gap >= EMISSION_GAP.min && gap <= EMISSION_GAP.max, `écart ${gap}`);
      gaps.add(gap);
    }
  }
  assert.deepEqual([...gaps].sort(), [3, 4, 5]);
});

test('calendrier : le jour annoncé, today est vrai et nextDay ne bouge pas', () => {
  const draft = createCampaign({ seed: 1 });
  draft.day = 5;
  draft.world.emission.nextDay = 5;
  scheduleEmission(draft, ctxOf(1));
  assert.deepEqual(draft.world.emission, { nextDay: 5, today: true });
  draft.day = 4;
  draft.world.emission = { nextDay: 5, today: false };
  scheduleEmission(draft, ctxOf(1));
  assert.deepEqual(draft.world.emission, { nextDay: 5, today: false });
});

// Matin et paquet Zone

test('matin du calendrier : carte signes d\'Émission et carte Émission dans le dernier tiers du paquet Zone', () => {
  const night = step(standOn(SHELTER_HEX), { type: 'camp' }).state;
  night.world.emission.nextDay = 2;
  const { state, events } = step(night, { type: 'wake' });
  assert.equal(events.find((event) => event.type === 'weather').card, 'signes-emission');
  assert.equal(state.world.emission.today, true);
  const day = dayState(state);
  const position = day.zone.deck.indexOf('emission') + 1;
  const { first, last } = emissionPositions(day.ap.max, day.zone.deck.length);
  assert.ok(position >= first && position <= last, `position ${position}`);
});

test('hors calendrier : le paquet Zone du jour n\'a pas de carte Émission', () => {
  const night = step(standOn(SHELTER_HEX), { type: 'camp' }).state;
  night.world.emission.nextDay = 9;
  const { state } = step(night, { type: 'wake' });
  assert.equal(state.world.emission.today, false);
  assert.ok(!dayState(state).zone.deck.includes('emission'));
});

test('jour 1 : pas de carte Émission dans le paquet Zone de la campagne', () => {
  assert.ok(!createCampaign({ seed: 1 }).world.tiles.cordon.zone.deck.includes('emission'));
});

test('tuile neuve hors du jour annoncé : la carte Émission v1 quitte son paquet Zone', () => {
  const { state } = step(standOn(LINK_HEX), { type: 'travel' });
  assert.ok(!state.world.tiles[state.world.currentTile].zone.deck.includes('emission'));
});

// L'Émission sort pendant la journée

function drawEmissionOnto(campaign, from, to) {
  campaign.world.hex = from;
  const tile = campaign.world.tiles.cordon;
  tile.zone.deck = ['emission'];
  tile.ap = { ...tile.ap, spent: 2, left: tile.ap.max - 2 };
  return step(announce(campaign), { type: 'move', to });
}

test('abrité quand elle sort : jetons reposés sur toutes les tuiles, calendrier relancé', () => {
  const campaign = withTwoTiles();
  const other = otherTile(campaign);
  const before = campaign.world.tiles[other].tokens;
  const { state, events } = drawEmissionOnto(campaign, LINK_HEX, SHELTER_HEX);
  assert.ok(types(events).includes('emission-survived'));
  const aftermath = events.find((event) => event.type === 'emission-aftermath');
  assert.deepEqual(aftermath.tiles, [other]);
  const after = state.world.tiles[other].tokens.filter((token) => !token.item);
  assert.notDeepEqual(after, before);
  assert.ok(after.every((token) => token.original === false && !token.revealed));
  assert.equal(state.world.emission.today, false);
  const gap = state.world.emission.nextDay - state.day;
  assert.ok(gap >= EMISSION_GAP.min && gap <= EMISSION_GAP.max);
  assert.equal(state.player.wounds, 0);
  assert.equal(state.screen, 'tile');
});

test('après l\'Émission : un artefact rare sur une tuile connue, et sa rumeur', () => {
  const { state, events } = drawEmissionOnto(withTwoTiles(), LINK_HEX, SHELTER_HEX);
  const found = events.find((event) => event.type === 'rare-artefact');
  assert.ok(rareArtefacts().includes(found.item));
  const tile = state.world.tiles[found.tile];
  const token = tile.tokens.find((t) => t.item === found.item);
  assert.deepEqual(token, { hex: found.hex, kind: 'artefact', revealed: false, original: false, item: found.item });
  assert.equal(tile.tokens.filter((t) => t.hex === found.hex).length, 1);
  assert.notEqual(found.hex, tile.tile.entry);
  assert.deepEqual(state.rumors.at(-1), { type: 'artefact', tile: found.tile, hex: found.hex, item: found.item, day: state.day });
});

test('après l\'Émission : lieux vidés remplis en partie, PNJ isolés en danger', () => {
  const id = 'lieu-emission';
  PLACES[id] = { name: 'Lieu test', label: 'Тест', tile: 'cordon', hex: 5, tags: [], deck: id };
  DECKS[id] = { kind: 'exploration', place: id, cards: [{ id: 'b', type: 'butin', count: 2 }] };
  let died = 0;
  for (let seed = 1; seed <= 10; seed++) {
    const draft = createCampaign({ seed });
    draft.places[id] = { pool: [], fixed: {}, revealed: [], inner: null, emptied: true };
    const events = [];
    emissionAftermath(draft, ctxOf(seed, events));
    assert.equal(draft.places[id].emptied, false);
    assert.ok(types(events).includes('place-refilled'));
    died += events.filter((event) => event.type === 'npc-died' && event.cause === 'emission').length;
  }
  assert.ok(died > 0);
});

test('sans abri quand le compte à rebours finit : 5 blessures, évanoui jusqu\'au lendemain à découvert', () => {
  const campaign = announce(standOn(OPEN_HEX));
  const tile = campaign.world.tiles.cordon;
  tile.zone.deck = [];
  tile.zone.emission = { left: 1 };
  const to = neighbors(OPEN_HEX).find((n) => tile.tile.hexes[n] && !tile.tile.hexes[n].abri);
  const { state, events } = step(campaign, { type: 'move', to });
  assert.ok(types(events).includes('emission-caught'));
  assert.ok(!types(events).includes('game-over'));
  assert.equal(state.player.wounds, EMISSION_WOUNDS);
  assert.deepEqual(events.find((event) => event.type === 'day-ended'), { type: 'day-ended', reason: 'emission', rest: 'decouvert' });
  assert.equal(state.screen, 'night');
  assert.deepEqual(state.night, { rest: 'decouvert', cardDrawn: false });
  const day = dayState(state);
  assert.equal(day.status, 'night');
  assert.equal(day.ap.left, 0);
  assert.equal(day.outcome, null);
  assert.ok(types(events).includes('emission-aftermath'));
  assert.notEqual(step(state, { type: 'wake' }).events[0]?.reason, 'not-night');
});

// L'Émission n'est pas sortie avant la fin de la journée

test('journée finie avant la carte : l\'Émission passe la nuit, sauf à l\'abri', () => {
  const { state, events } = step(announce(standOn(SHELTER_HEX)), { type: 'camp' });
  assert.deepEqual(events.find((event) => event.type === 'emission-night'), { type: 'emission-night', rest: 'abri', sheltered: true });
  assert.equal(state.player.wounds, 0);
  assert.equal(state.world.emission.today, false);
  assert.ok(types(events).includes('emission-aftermath'));
});

test('journée finie avant la carte, à découvert : 5 blessures pendant la nuit', () => {
  const { state, events } = step(announce(standOn(OPEN_HEX)), { type: 'camp' });
  assert.deepEqual(events.find((event) => event.type === 'emission-night'), { type: 'emission-night', rest: 'decouvert', sheltered: false });
  assert.equal(state.player.wounds, EMISSION_WOUNDS);
  assert.equal(state.screen, 'night');
});

// Voyage le jour de l'Émission

test('voyage pendant le compte à rebours : il continue sur la tuile d\'arrivée', () => {
  const campaign = announce(standOn(LINK_HEX));
  campaign.world.tiles.cordon.zone.emission = { left: 2 };
  const { state } = step(campaign, { type: 'travel' });
  const arrival = state.world.tiles[state.world.currentTile].zone;
  assert.deepEqual(arrival.emission, { left: 2 });
  assert.ok(!arrival.deck.includes('emission'));
  assert.equal(state.world.tiles.cordon.zone.emission, null);
});

test('voyage avant la carte : la tuile d\'arrivée reçoit la carte Émission', () => {
  let campaign = announce(standOn(LINK_HEX));
  campaign = step(campaign, { type: 'travel' }).state;
  campaign.world.tiles.cordon.zone.deck = [];
  const { state } = step(campaign, { type: 'travel' });
  assert.equal(state.world.currentTile, 'cordon');
  assert.ok(state.world.tiles.cordon.zone.deck.includes('emission'));
});

// Artefact rare

test('ramasser l\'artefact rare donne l\'objet nommé', () => {
  const game = createGame({ seed: 3, tile: agroprom });
  game.player.stats.survie = 10;
  game.tokens = [{ hex: game.player.hex, kind: 'artefact', revealed: true, original: false, item: 'cristal' }];
  const { state, events } = stepDay(game, { type: 'pickup' });
  assert.deepEqual(events.find((event) => event.type === 'artefact-picked'), { type: 'artefact-picked', hex: game.player.hex, item: 'cristal' });
  assert.ok(state.inventory.some((item) => item.kind === 'cristal'));
});

test('artefacts rares : artefacts du contenu au prix de RARE_PRICE ou plus', () => {
  assert.ok(rareArtefacts().length > 0);
  assert.ok(rareArtefacts().every((id) => content.items[id].category === 'artefact'));
});

test('même graine, même Émission ; l\'état reste en JSON', () => {
  const first = drawEmissionOnto(withTwoTiles(), LINK_HEX, SHELTER_HEX);
  const second = drawEmissionOnto(withTwoTiles(), LINK_HEX, SHELTER_HEX);
  assert.deepEqual(first, second);
  assert.deepEqual(jsonCopy(first.state), first.state);
});
