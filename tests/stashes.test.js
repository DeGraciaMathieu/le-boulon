import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createCampaign, step, dayState, storeDay } from '../src/engine/campaign.js';
import { startCombat } from '../src/engine/rules/combat.js';
import { HUB_SERVICES } from '../src/engine/rules/hubs.js';
import { DAY_HOOKS } from '../src/engine/rules/time.js';
import { emissionAftermath } from '../src/engine/rules/emission.js';
import {
  dropPda, barman, ageRumors, rumorsForSale, rumorPrice, tileLevel,
  RUMOR_PRICES, RUMOR_OFFER, MAX_LEVEL, OPEN_COST, STASH_DRAWS,
} from '../src/engine/rules/stashes.js';
import { createRng } from '../src/engine/rng.js';
import { neighbors } from '../src/engine/hex.js';
import content from '../src/content/index.js';
import { EFFECTS, DIALOGUES, talk, choose } from '../src/engine/rules/dialogue.js';
import { PLACES, DECKS } from '../src/engine/rules/places.js';

const jsonCopy = (value) => JSON.parse(JSON.stringify(value));
const ofType = (events, type) => events.filter((event) => event.type === type);
const one = (events, type) => ofType(events, type)[0];
const ctxOf = (seed, events = []) => ({ rng: createRng(seed), emit: (event) => events.push(event) });

const HUMANS = { name: 'Pillards', threat: 1, wounds: 1, hp: 1, damage: 1, type: 'humain', faction: 'bandits', count: 2 };
const DOGS = { name: 'Chiens', threat: 1, wounds: 1, hp: 1, damage: 1, type: 'mutant', count: 2 };
const ENCOUNTER_HEX = 9;

// Rejoue avec d'autres états du RNG jusqu'à obtenir le tirage voulu.
function stepUntil(campaign, action, predicate) {
  for (let rng = 1; rng < 5000; rng++) {
    const result = step({ ...campaign, rng }, action);
    assert.notEqual(result.events[0]?.type, 'refused', JSON.stringify(result.events[0]));
    if (predicate(result.events, result.state)) return result;
  }
  throw new Error('aucun tirage ne convient');
}

// Campagne au Cordon en combat v2 contre une carte de rencontre de test, sans autre jeton.
function fighting(card) {
  const campaign = jsonCopy(createCampaign({ seed: 1 }));
  const state = campaign.world.tiles.cordon;
  state.tokens = [];
  state.tile = { ...state.tile, encounterCards: { test: card } };
  state.encounters = [{ hex: ENCOUNTER_HEX, card: 'test' }];
  state.combat = { hex: ENCOUNTER_HEX, card: 'test' };
  startCombat(campaign, { hex: ENCOUNTER_HEX, card: 'test' }, { emit() {} });
  return campaign;
}

// Abat tout le groupe : la grenade touche chaque ennemi debout.
function winWith(card, predicate) {
  const campaign = fighting(card);
  campaign.inventory.push({ kind: 'grenade', size: 1 });
  return stepUntil(campaign, { type: 'grenade' }, predicate);
}

function onCordon(hex, { seed = 1 } = {}) {
  const campaign = jsonCopy(createCampaign({ seed }));
  campaign.world.hex = hex;
  campaign.world.tiles.cordon.tokens = [];
  campaign.world.tiles.cordon.encounters = [];
  return campaign;
}

function atBar({ roubles = 1000, seed = 1 } = {}) {
  const campaign = jsonCopy(createCampaign({ seed }));
  const { tile, hex } = content.places.bar;
  campaign.world.currentTile = tile;
  campaign.world.tiles[tile] = { ...structuredClone(campaign.world.tiles.cordon), tile: content.tiles[tile] };
  campaign.world.hex = hex;
  campaign.player.roubles = roubles;
  return step(campaign, { type: 'enter-hub' }).state;
}

const service = (op, extra = {}) => ({ type: 'service', service: 'barman', op, ...extra });

test('niveau des tuiles : level du contenu, sinon le niveau des tables de ses lieux', () => {
  const campaign = createCampaign({ seed: 1 });
  assert.equal(tileLevel(campaign, 'cordon'), 1);
  assert.equal(tileLevel(campaign, 'agroprom'), 3);
  for (const id of Object.keys(content.tiles)) {
    const level = tileLevel(campaign, id);
    assert.ok(level >= 1 && level <= MAX_LEVEL, id);
    assert.ok(content.loot[`n${Math.min(MAX_LEVEL, level + 1)}-cache`], `table de planque de ${id}`);
  }
});

test('PDA : un humain vaincu révèle parfois une planque connue, de niveau +1, ici ou à côté', () => {
  const { events, state } = winWith(HUMANS, (evs) => one(evs, 'pda-found'));
  assert.equal(one(events, 'combat-ended').outcome, 'victory');
  const found = one(events, 'pda-found');
  const stash = state.stashes.find((candidate) => candidate.id === found.stash);
  const nearby = ['cordon', ...Object.values(content.links.cordon).map((link) => link.tile)];
  assert.ok(nearby.includes(stash.tile));
  assert.deepEqual({ known: stash.known, opened: stash.opened, source: stash.source }, { known: true, opened: false, source: 'pda' });
  assert.equal(stash.level, Math.min(MAX_LEVEL, tileLevel(state, stash.tile) + 1));
  const tile = content.tiles[stash.tile];
  assert.notEqual(stash.hex, tile.entry);
  assert.ok(!Object.values(content.places).some((place) => place.tile === stash.tile && place.hex === stash.hex));
});

test('PDA : pas toujours, jamais sur des mutants, un seul par combat', () => {
  winWith(HUMANS, (evs) => one(evs, 'combat-ended') && !one(evs, 'pda-found'));
  for (let seed = 1; seed < 40; seed++) {
    const events = [];
    const draft = createCampaign({ seed: 1 });
    dropPda(draft, [{ type: 'mutant', hp: 0 }, { type: 'mutant', hp: 0 }], ctxOf(seed, events));
    assert.equal(events.length, 0);
    dropPda(draft, Array.from({ length: 4 }, () => ({ type: 'humain', hp: 0 })), ctxOf(seed, events));
    assert.ok(ofType(events, 'pda-found').length <= 1);
  }
  const { events } = winWith(DOGS, (evs) => one(evs, 'combat-ended'));
  assert.equal(one(events, 'pda-found'), undefined);
});

test('fouiller une planque connue : 1 PA, butin de la table cache de son niveau', () => {
  const campaign = onCordon(3);
  campaign.stashes.push({ id: 'planque-1', tile: 'cordon', hex: 3, level: 2, source: 'pda', known: true, opened: false, day: 1 });
  const before = dayState(campaign).ap.left;
  const { state, events } = step(campaign, { type: 'open-stash' });
  const opened = one(events, 'stash-opened');
  assert.equal(opened.stash, 'planque-1');
  assert.ok(opened.items.length >= STASH_DRAWS);
  const table = content.loot['n2-cache'].entries.map((entry) => entry.item);
  for (const { item } of opened.items) assert.ok(table.includes(item), item);
  assert.equal(dayState(state).ap.left, before - OPEN_COST);
  assert.equal(state.stashes[0].opened, true);
  assert.equal(step(state, { type: 'open-stash' }).events[0].reason, 'no-stash');
});

test('fouiller : refus hors de la planque, planque inconnue, sans PA', () => {
  const campaign = onCordon(3);
  campaign.stashes.push({ id: 'planque-1', tile: 'cordon', hex: 4, level: 2, source: 'rumeur', known: true, opened: false, day: 1 });
  campaign.stashes.push({ id: 'planque-2', tile: 'cordon', hex: 3, level: 2, source: 'rumeur', known: false, opened: false, day: 1 });
  assert.equal(step(campaign, { type: 'open-stash' }).events[0].reason, 'no-stash');

  campaign.stashes[1].known = true;
  const day = dayState(campaign);
  day.ap = { ...day.ap, left: 0 };
  storeDay(campaign, day);
  assert.equal(step(campaign, { type: 'open-stash' }).events[0].reason, 'not-enough-ap');
});

test('barman : branché aux hubs qui ont le service, absent du Camp des novices', () => {
  assert.equal(HUB_SERVICES.barman, barman);
  const campaign = jsonCopy(createCampaign({ seed: 1 }));
  const novices = step(campaign, { type: 'enter-hub' }).state;
  assert.equal(step(novices, service('browse')).events[0].reason, 'no-service');
  assert.equal(step(atBar(), service('voler')).events[0].reason, 'unknown-op');
});

test('barman : rumeurs à vendre sans leur contenu, au prix du §10.3', () => {
  const { state, events } = step(atBar(), service('browse'));
  const offered = one(events, 'rumors-offered');
  assert.equal(offered.hub, 'bar');
  assert.ok(offered.rumors.length >= 1 && offered.rumors.length <= RUMOR_OFFER);
  for (const rumor of offered.rumors) {
    assert.deepEqual(Object.keys(rumor).sort(), ['index', 'price', 'type']);
    assert.ok(rumor.price >= 100 && rumor.price <= 300);
  }
  for (const price of Object.values(RUMOR_PRICES)) assert.ok(price >= 100 && price <= 300);
  assert.equal(rumorsForSale(state).length, offered.rumors.length);
  // Une deuxième visite ne gonfle pas l'offre.
  assert.equal(one(step(state, service('browse')).events, 'rumors-offered').rumors.length, offered.rumors.length);
});

test('barman : la rumeur d\'artefact rare de l\'Émission se vend au format de emission.js', () => {
  const campaign = atBar({ roubles: 300 });
  campaign.rumors.push({ type: 'artefact', tile: 'decharge', hex: 7, item: 'oeil-de-chat', day: 1 });
  const { state, events } = step(campaign, service('buy', { index: 0 }));
  const bought = one(events, 'rumor-bought');
  assert.equal(bought.price, RUMOR_PRICES.artefact);
  assert.deepEqual(
    { type: bought.rumor.type, tile: bought.rumor.tile, hex: bought.rumor.hex, item: bought.rumor.item },
    { type: 'artefact', tile: 'decharge', hex: 7, item: 'oeil-de-chat' },
  );
  assert.equal(state.player.roubles, 0);
  assert.equal(state.rumors[0].known, true);
  assert.deepEqual(one(events, 'roubles-changed'), { type: 'roubles-changed', amount: -300, roubles: 0 });
  assert.equal(step(state, service('buy', { index: 0 })).events[0].reason, 'no-rumor');
});

test('barman : une rumeur de planque rend sa planque connue ; refus sans roubles', () => {
  const campaign = atBar({ roubles: 150 });
  barmanBrowseUntilStash(campaign);
  const index = rumorsForSale(campaign).findIndex((rumor) => rumor.type === 'planque');
  assert.equal(step(campaign, service('buy', { index })).events[0].reason, 'not-enough-roubles');

  campaign.player.roubles = 1000;
  const { state, events } = step(campaign, service('buy', { index }));
  const { stash } = one(events, 'rumor-bought').rumor;
  assert.deepEqual(one(events, 'stash-revealed'), { type: 'stash-revealed', stash });
  const revealed = state.stashes.find((candidate) => candidate.id === stash);
  assert.equal(revealed.known, true);
  assert.equal(revealed.source, 'rumeur');
  assert.equal(revealed.level, Math.min(MAX_LEVEL, tileLevel(state, revealed.tile) + 1));
});

function barmanBrowseUntilStash(campaign) {
  for (let seed = 1; seed < 200; seed++) {
    const draft = jsonCopy(campaign);
    barman(draft, { op: 'browse' }, ctxOf(seed), 'bar');
    if (draft.rumors.some((rumor) => rumor.type === 'planque')) return Object.assign(campaign, draft);
  }
  throw new Error('pas de rumeur de planque');
}

test('barman : raccourci sans anomalie et patrouille sur une tuile visitée', () => {
  const campaign = atBar();
  const decharge = structuredClone(campaign.world.tiles.cordon);
  decharge.tile = content.tiles.decharge;
  decharge.tokens = [{ hex: 1, kind: 'anomalie', anomaly: 'brasier', revealed: false, original: true }];
  decharge.encounters = [{ hex: 5, card: 'x' }];
  campaign.world.tiles.decharge = decharge;
  delete campaign.world.tiles.cordon;
  const seen = new Set();
  for (let seed = 1; seed < 100 && seen.size < 2; seed++) {
    const draft = jsonCopy(campaign);
    barman(draft, { op: 'browse' }, ctxOf(seed), 'bar');
    for (const rumor of draft.rumors) {
      if (rumor.type === 'patrouille') {
        assert.deepEqual({ tile: rumor.tile, hex: rumor.hex }, { tile: 'decharge', hex: 5 });
        seen.add(rumor.type);
      }
      if (rumor.type === 'raccourci') {
        assert.equal(rumor.tile, 'decharge');
        assert.equal(rumor.path[0], rumor.from);
        assert.equal(rumor.path.at(-1), rumor.to);
        assert.ok(!rumor.path.includes(1));
        rumor.path.slice(1).forEach((hex, i) => assert.ok(neighbors(rumor.path[i]).includes(hex)));
        seen.add(rumor.type);
      }
    }
  }
  assert.deepEqual([...seen].sort(), ['patrouille', 'raccourci']);
});

test('vieillissement : branché au changement de jour, après le calendrier de l\'Émission', () => {
  assert.deepEqual(DAY_HOOKS.emission.slice(-1), [ageRumors]);
});

test('vieillissement : fausse au matin qui suit l\'Émission, la planque de la rumeur disparaît', () => {
  const draft = createCampaign({ seed: 1 });
  draft.day = 4;
  draft.world.emission = { nextDay: 4, today: true };
  draft.stashes.push({ id: 'planque-1', tile: 'marais', hex: 3, level: 3, source: 'rumeur', known: false, opened: false, day: 4 });
  draft.stashes.push({ id: 'planque-2', tile: 'marais', hex: 4, level: 3, source: 'pda', known: true, opened: false, day: 4 });
  draft.rumors.push({ type: 'planque', tile: 'marais', hex: 3, stash: 'planque-1', day: 4, expires: 4 });
  draft.rumors.push({ type: 'patrouille', tile: 'marais', hex: 5, day: 4, expires: 4, known: true });

  const events = [];
  ageRumors(draft, ctxOf(1, events));
  assert.equal(events.length, 0, 'le jour même, la rumeur est encore vraie');

  draft.day = 5;
  draft.world.emission = { nextDay: 9, today: false };
  ageRumors(draft, ctxOf(1, events));
  assert.deepEqual(ofType(events, 'rumor-aged').map((event) => event.rumor.type), ['planque', 'patrouille']);
  assert.deepEqual(one(events, 'stash-gone'), { type: 'stash-gone', stash: 'planque-1' });
  assert.deepEqual(draft.stashes.map((stash) => stash.id), ['planque-2']);
  assert.ok(draft.rumors.every((rumor) => rumor.stale));
  assert.deepEqual(rumorsForSale(draft), []);
});

test('vieillissement : la rumeur d\'artefact née à l\'Émission vaut jusqu\'à la suivante', () => {
  const draft = jsonCopy(createCampaign({ seed: 3 }));
  draft.day = 4;
  draft.world.emission = { nextDay: 4, today: true };
  emissionAftermath(draft, ctxOf(2));
  const rumor = draft.rumors.find((candidate) => candidate.type === 'artefact');
  const { nextDay } = draft.world.emission;

  draft.day = 5;
  ageRumors(draft, ctxOf(1));
  assert.equal(rumor.expires, nextDay);
  assert.equal(rumor.stale, undefined);
  assert.equal(rumorPrice(rumorsForSale(draft)[0]), RUMOR_PRICES.artefact);

  draft.day = nextDay + 1;
  ageRumors(draft, ctxOf(1));
  assert.equal(rumor.stale, true);
});

test('vieillissement : par le réveil, une rumeur achetée avant l\'Émission de la nuit', () => {
  const campaign = atBar();
  campaign.world.emission = { nextDay: campaign.day, today: true };
  campaign.rumors.push({ type: 'artefact', tile: 'cordon', hex: 7, item: 'oeil-de-chat', day: campaign.day });
  barmanBrowseUntilStash(campaign);
  const fresh = campaign.rumors.filter((rumor) => rumor.type !== 'artefact');
  assert.ok(fresh.every((rumor) => rumor.expires === campaign.day));

  let state = step(campaign, { type: 'sleep' }).state;
  const { events } = step(state, { type: 'wake' });
  state = step(state, { type: 'wake' }).state;
  assert.ok(ofType(events, 'rumor-aged').length >= fresh.length);
  for (const rumor of state.rumors.filter((candidate) => candidate.expires === campaign.day)) assert.equal(rumor.stale, true);
});

test('état sérialisable et rejouable : même graine, mêmes rumeurs', () => {
  const first = step(atBar(), service('browse')).state;
  const second = step(atBar(), service('browse')).state;
  assert.deepEqual(first.rumors, second.rumors);
  assert.deepEqual(jsonCopy(first.stashes), first.stashes);
  assert.deepEqual(jsonCopy(first.rumors), first.rumors);
});

// --- Effet « reveler » { stash } : dialogue et carte d'exploration Indice ---------------------

test('effet reveler { stash } : une planque connue, de niveau +1, ici ou à côté', () => {
  const nearby = ['cordon', ...Object.values(content.links.cordon).map((link) => link.tile)];
  for (let seed = 1; seed < 20; seed++) {
    const events = [];
    const draft = onCordon(5);
    assert.equal(EFFECTS.reveler(draft, { type: 'reveler', stash: true }, ctxOf(seed, events)), undefined);
    const [stash] = draft.stashes;
    assert.ok(nearby.includes(stash.tile));
    assert.deepEqual({ known: stash.known, opened: stash.opened, source: stash.source }, { known: true, opened: false, source: 'indice' });
    assert.equal(stash.level, Math.min(MAX_LEVEL, tileLevel(draft, stash.tile) + 1));
    assert.notEqual(`${stash.tile}:${stash.hex}`, 'cordon:5');
    assert.deepEqual(ofType(events, 'stash-revealed'), [{ type: 'stash-revealed', stash: stash.id }]);
  }
});

test('effet reveler { place } : toujours le lieu (rules/places.js)', () => {
  const draft = onCordon(5);
  const place = Object.keys(content.places)[0];
  assert.equal(EFFECTS.reveler(draft, { type: 'reveler', place }, ctxOf(1)), undefined);
  assert.equal(draft.places[place].known, true);
  assert.equal(draft.stashes.length, 0);
});

test('choix de dialogue avec reveler { stash } : la planque est connue à la fin du choix', () => {
  DIALOGUES['indic-test'] = {
    start: 'a',
    nodes: { a: { text: 'Je sais où il a tout caché.', choices: [{ text: 'Dis-moi.', effects: [{ type: 'reveler', stash: true }] }] } },
  };
  const events = [];
  const ctx = ctxOf(1, events);
  const draft = onCordon(5);
  talk(draft, { type: 'talk', npc: 'indic-test' }, ctx);
  assert.equal(choose(draft, { type: 'choose', index: 0 }, ctx), undefined);
  assert.equal(draft.stashes.length, 1);
  assert.equal(one(events, 'stash-revealed').stash, draft.stashes[0].id);
});

test('carte Indice du contenu : l’icône de l’église révèle une planque', () => {
  const icone = content.decks.eglise.cards.find((card) => card.id === 'icone');
  assert.deepEqual(icone.effects, [{ type: 'reveler', stash: true }]);

  PLACES['eglise-test'] = { name: 'Église test', label: 'Тест', tile: 'cordon', hex: 5, tags: [], deck: 'eglise-test', loot: 'n1-cache' };
  DECKS['eglise-test'] = { kind: 'exploration', place: 'eglise-test', cards: [icone] };
  let campaign = onCordon(5);
  campaign.world.tiles.cordon.zone.deck = [];
  const events = [];
  for (const action of [{ type: 'enter-place', place: 'eglise-test' }, { type: 'explore' }]) {
    const result = step(campaign, action);
    assert.notEqual(result.events[0]?.type, 'refused', JSON.stringify(result.events[0]));
    campaign = result.state;
    events.push(...result.events);
  }
  assert.equal(one(events, 'clue-found').card, 'icone');
  const revealed = one(events, 'stash-revealed');
  const stash = campaign.stashes.find((candidate) => candidate.id === revealed.stash);
  assert.deepEqual({ known: stash.known, source: stash.source }, { known: true, source: 'indice' });
});
