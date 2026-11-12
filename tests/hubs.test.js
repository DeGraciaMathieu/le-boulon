import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createCampaign, step, dayState, CAMPAIGN_ACTIONS } from '../src/engine/campaign.js';
import { HUB_SERVICES, hubAt, inHub, hubView } from '../src/engine/rules/hubs.js';
import { BED_PRICE } from '../src/engine/rules/time.js';
import { createItem } from '../src/engine/rules/sheet.js';
import content from '../src/content/index.js';

const jsonCopy = (value) => JSON.parse(JSON.stringify(value));
const types = (events) => events.map((event) => event.type);

const CAMP_NOVICES = content.places['camp-novices'];
const BASE_CIEL_PUR = content.places['base-ciel-pur'];

// Campagne au Cordon, sur l'hexagone du Camp des novices.
function atCamp({ seed = 1 } = {}) {
  const campaign = jsonCopy(createCampaign({ seed }));
  campaign.world.hex = CAMP_NOVICES.hex;
  return campaign;
}

function inCamp(options) {
  return step(atCamp(options), { type: 'enter-hub' }).state;
}

function apLeft(campaign) {
  return dayState(campaign).ap.left;
}

// §6.1 Entrer et quitter

test('enter-hub : écran hub sur l’hexagone du hub, sans PA', () => {
  const campaign = atCamp();
  const { state, events } = step(campaign, { type: 'enter-hub' });
  assert.equal(state.screen, 'hub');
  assert.deepEqual(state.hub, { id: 'camp-novices' });
  assert.deepEqual(events, [{ type: 'hub-entered', hub: 'camp-novices' }]);
  assert.equal(apLeft(state), apLeft(campaign));
  assert.equal(campaign.screen, 'tile', 'la campagne reçue ne change pas');
});

test('enter-place sur un hub ouvre l’écran hub', () => {
  const { state, events } = step(atCamp(), { type: 'enter-place', place: 'camp-novices' });
  assert.equal(state.screen, 'hub');
  assert.equal(state.place, undefined);
  assert.deepEqual(types(events), ['hub-entered']);
});

test('enter-place sur un lieu ordinaire reste la règle des lieux', () => {
  const campaign = atCamp();
  campaign.world.hex = content.places['ferme-cordon'].hex;
  const { state } = step(campaign, { type: 'enter-place', place: 'ferme-cordon' });
  assert.equal(state.screen, 'place');
});

test('enter-hub refusé hors de l’hexagone, déjà dedans, dans un lieu', () => {
  const away = atCamp();
  away.world.hex = 18;
  assert.equal(step(away, { type: 'enter-hub' }).events[0].reason, 'no-hub');
  assert.equal(step(inCamp(), { type: 'enter-hub' }).events[0].reason, 'in-hub');
  const visiting = atCamp();
  visiting.world.hex = content.places['ferme-cordon'].hex;
  const inPlace = step(visiting, { type: 'enter-place', place: 'ferme-cordon' }).state;
  assert.equal(step(inPlace, { type: 'enter-hub' }).events[0].reason, 'in-place');
});

test('enter-hub refusé quand le hub demandé n’est pas ici', () => {
  const result = step(atCamp(), { type: 'enter-hub', hub: 'bar' });
  assert.equal(result.events[0].reason, 'no-hub');
});

test('leave-hub : retour à la tuile, sans PA', () => {
  const campaign = inCamp();
  const { state, events } = step(campaign, { type: 'leave-hub' });
  assert.equal(state.screen, 'tile');
  assert.equal(state.hub, undefined);
  assert.deepEqual(events, [{ type: 'hub-left', hub: 'camp-novices' }]);
  assert.equal(apLeft(state), apLeft(campaign));
  assert.equal(step(state, { type: 'leave-hub' }).events[0].reason, 'not-in-hub');
});

test('hubAt et inHub', () => {
  assert.equal(hubAt(atCamp()), 'camp-novices');
  const away = atCamp();
  away.world.hex = 18;
  assert.equal(hubAt(away), null);
  assert.equal(inHub(atCamp()), false);
  assert.equal(inHub(inCamp()), true);
});

// §6.1 Aucune action ne coûte de PA

test('dans un hub, les actions de la tuile sont refusées', () => {
  const campaign = inCamp();
  for (const type of ['move', 'exit', 'bolt', 'pickup', 'fight', 'flee', 'travel', 'camp', 'explore']) {
    const result = step(campaign, { type, hex: 4, tile: 'marais' });
    assert.equal(result.state, campaign, type);
    assert.equal(result.events[0].reason, 'in-hub', type);
  }
});

test('utiliser un objet dans un hub ne coûte pas de PA', () => {
  const campaign = inCamp();
  campaign.player.wounds = 2;
  const { state, events } = step(campaign, { type: 'use', item: 'bandage' });
  assert.equal(state.player.wounds, 1);
  assert.equal(apLeft(state), apLeft(campaign));
  assert.equal(state.inventory.filter((item) => item.kind === 'bandage').length, 1);
  assert.deepEqual(types(events), ['used']);
});

test('utiliser un objet absent reste refusé', () => {
  const result = step(inCamp(), { type: 'use', item: 'antirad' });
  assert.equal(result.events[0].reason, 'no-item');
});

// §4.3 Lit

test('dormir dans le hub puis se réveiller rend l’écran hub', () => {
  const night = step(inCamp(), { type: 'sleep' }).state;
  assert.equal(night.screen, 'night');
  const { state } = step(night, { type: 'wake' });
  assert.equal(state.screen, 'hub');
  assert.deepEqual(state.hub, { id: 'camp-novices' });
});

test('bivouac dehors puis réveil : écran tuile', () => {
  const campaign = atCamp();
  campaign.world.hex = 18;
  const night = step(campaign, { type: 'camp' }).state;
  assert.equal(step(night, { type: 'wake' }).state.screen, 'tile');
});

// §6.1 Coffre

test('chest-put range un objet dans le coffre du hub, sans PA', () => {
  const campaign = inCamp();
  const { state, events } = step(campaign, { type: 'chest-put', item: 'vodka' });
  assert.deepEqual(state.chests['camp-novices'], [{ kind: 'vodka', size: 1 }]);
  assert.equal(state.inventory.some((item) => item.kind === 'vodka'), false);
  assert.deepEqual(events, [{ type: 'chest-stored', hub: 'camp-novices', item: 'vodka' }]);
  assert.equal(apLeft(state), apLeft(campaign));
});

test('chest-put garde les charges d’une pile', () => {
  const { state } = step(inCamp(), { type: 'chest-put', item: 'boulons' });
  assert.deepEqual(state.chests['camp-novices'], [{ kind: 'boulons', size: 1, charges: 10 }]);
});

test('chest-take rend l’objet à l’inventaire', () => {
  const stored = step(inCamp(), { type: 'chest-put', item: 'vodka' }).state;
  const { state, events } = step(stored, { type: 'chest-take', item: 'vodka' });
  assert.deepEqual(state.chests['camp-novices'], []);
  assert.equal(state.inventory.at(-1).kind, 'vodka');
  assert.deepEqual(events, [{ type: 'chest-taken', hub: 'camp-novices', item: 'vodka' }]);
});

test('le coffre survit à la sortie du hub et à JSON', () => {
  const stored = step(inCamp(), { type: 'chest-put', item: 'vodka' }).state;
  const out = jsonCopy(step(stored, { type: 'leave-hub' }).state);
  const back = step(out, { type: 'enter-hub' }).state;
  assert.equal(step(back, { type: 'chest-take', item: 'vodka' }).state.inventory.at(-1).kind, 'vodka');
});

test('coffre : refus', () => {
  assert.equal(step(atCamp(), { type: 'chest-put', item: 'vodka' }).events[0].reason, 'not-in-hub');
  assert.equal(step(inCamp(), { type: 'chest-put', item: 'antirad' }).events[0].reason, 'no-item');
  assert.equal(step(inCamp(), { type: 'chest-take', item: 'vodka' }).events[0].reason, 'not-in-chest');

  const marais = jsonCopy(createCampaign({ seed: 1, tile: 'marais' }));
  marais.world.hex = BASE_CIEL_PUR.hex;
  const inBase = step(marais, { type: 'enter-hub' }).state;
  assert.equal(step(inBase, { type: 'chest-put', item: 'vodka' }).events[0].reason, 'no-chest');
});

test('chest-take refusé quand l’inventaire est plein', () => {
  const stored = step(inCamp(), { type: 'chest-put', item: 'vodka' }).state;
  while (stored.inventory.length < 12) stored.inventory.push(createItem('ration'));
  assert.equal(step(stored, { type: 'chest-take', item: 'vodka' }).events[0].reason, 'inventory-full');
});

// §6.1 Services : points d'accroche des cartes 13 (marchand) et 22 (contrats)

test('service : refusé hors hub, absent du hub ou pas encore branché', () => {
  assert.equal(step(atCamp(), { type: 'service', service: 'marchand' }).events[0].reason, 'not-in-hub');
  assert.equal(step(inCamp(), { type: 'service', service: 'medecin' }).events[0].reason, 'no-service');
  assert.equal(step(inCamp(), { type: 'service', service: 'contrats' }).events[0].reason, 'service-unavailable');
});

test('service : un handler branché dans HUB_SERVICES est appelé avec le hub', (t) => {
  const { marchand } = HUB_SERVICES;
  t.after(() => { HUB_SERVICES.marchand = marchand; });
  HUB_SERVICES.marchand = (draft, action, ctx, hub) => {
    if (action.refuse) return 'refused-by-trader';
    draft.player.roubles += 10;
    ctx.emit({ type: 'traded', hub });
  };
  const campaign = inCamp();
  const { state, events } = step(campaign, { type: 'service', service: 'marchand' });
  assert.equal(state.player.roubles, campaign.player.roubles + 10);
  assert.deepEqual(events, [{ type: 'traded', hub: 'camp-novices' }]);
  assert.equal(apLeft(state), apLeft(campaign));
  const refused = step(campaign, { type: 'service', service: 'marchand', refuse: true });
  assert.equal(refused.state, campaign);
  assert.equal(refused.events[0].reason, 'refused-by-trader');
});

test('hubView décrit le hub ouvert', () => {
  assert.equal(hubView(atCamp()), null);
  assert.deepEqual(hubView(step(inCamp(), { type: 'chest-put', item: 'vodka' }).state), {
    hub: 'camp-novices',
    faction: 'solitaires',
    services: ['marchand', 'lit', 'coffre', 'contrats'],
    bedPrice: 0,
    chest: [{ kind: 'vodka', size: 1 }],
  });
  const marais = jsonCopy(createCampaign({ seed: 1, tile: 'marais' }));
  marais.world.hex = BASE_CIEL_PUR.hex;
  const view = hubView(step(marais, { type: 'enter-hub' }).state);
  assert.equal(view.bedPrice, BED_PRICE);
  assert.equal(view.chest, null);
});

test('actions branchées dans CAMPAIGN_ACTIONS', () => {
  for (const type of ['enter-hub', 'leave-hub', 'chest-put', 'chest-take', 'service']) {
    assert.equal(typeof CAMPAIGN_ACTIONS[type], 'function', type);
  }
});

test('rejeu à l’identique après JSON', () => {
  const actions = [{ type: 'enter-hub' }, { type: 'chest-put', item: 'vodka' }, { type: 'sleep' }, { type: 'wake' }];
  const play = (campaign) => actions.reduce((state, action) => step(state, action).state, campaign);
  assert.deepEqual(play(atCamp({ seed: 7 })), play(jsonCopy(atCamp({ seed: 7 }))));
});
