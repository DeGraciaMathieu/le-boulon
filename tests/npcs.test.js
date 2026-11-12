// PNJ (carte 19) : contenu de src/content/pnj.js et dialogues/, règles de src/engine/rules/npcs.js.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import content from '../src/content/index.js';
import { createCampaign, step } from '../src/engine/campaign.js';
import { dialogueView } from '../src/engine/rules/dialogue.js';
import { createItem } from '../src/engine/rules/sheet.js';
import {
  startingNpcs, npcsAt, isIsolated, moveNpcs, endangerNpcs, MOVE_CHANCE, DEATH_CHANCE,
} from '../src/engine/rules/npcs.js';

const { npcs, places, dialogues } = content;
const SERVICE_ROLES = ['marchand', 'barman', 'medecin', 'technicien'];

// ctx de hook : rng qui rend toujours roll et prend le premier élément.
function fakeCtx(roll) {
  const events = [];
  return { events, rng: { next: () => roll, pick: (items) => items[0] }, emit: (e) => events.push(e) };
}

// Campagne posée sur l'hexagone d'un lieu.
function campaignAt(placeId, change = (c) => c) {
  const campaign = createCampaign({ seed: 3 });
  campaign.world.currentTile = places[placeId].tile;
  campaign.world.hex = places[placeId].hex;
  change(campaign);
  return campaign;
}

// --- Contenu -----------------------------------------------------------------------------

test('environ 25 PNJ nommés, chacun avec son dialogue', () => {
  const ids = Object.keys(npcs);
  assert.ok(ids.length >= 23 && ids.length <= 27, `${ids.length} PNJ`);
  for (const [id, npc] of Object.entries(npcs)) {
    assert.ok(npc.name, `${id} sans nom`);
    assert.ok(dialogues[npc.dialogue], `${id} : dialogue ${npc.dialogue} absent`);
  }
});

test('4 à 6 PNJ par hub, et un PNJ pour chaque service du §6.1', () => {
  const hubs = Object.entries(places).filter(([, place]) => place.tags.includes('hub'));
  assert.equal(hubs.length, 4);
  for (const [hubId, hub] of hubs) {
    const here = Object.values(npcs).filter((npc) => npc.place === hubId);
    assert.ok(here.length >= 4 && here.length <= 6, `${hubId} : ${here.length} PNJ`);
    for (const role of SERVICE_ROLES.filter((r) => hub.services.includes(r))) {
      assert.ok(here.some((npc) => npc.role === role), `${hubId} : pas de ${role}`);
    }
  }
  assert.equal(npcs['marchand-bunker'].place, 'camp-novices');
  assert.equal(npcs['marchand-bunker'].role, 'marchand');
});

test('chaque hexagone marqué pnj a son PNJ (blessé de l\'Élévateur, Arrêt de bus…)', () => {
  for (const [tileId, tile] of Object.entries(content.tiles)) {
    for (const hex of Object.values(tile.hexes).filter((h) => h.pnj)) {
      const [placeId] = Object.entries(places).find(([, p]) => p.tile === tileId && p.label === hex.lieu);
      const found = Object.values(npcs).some((npc) => npc.place === placeId || npc.places?.[0] === placeId);
      assert.ok(found, `${tileId} ${hex.lieu} sans PNJ`);
    }
  }
  assert.equal(npcs['blesse-elevateur'].place, 'elevateur');
  assert.equal(npcs['voyageur-arret'].places[0], 'arret-bus');
});

test('un itinérant a place null, une tuile et des lieux de cette tuile', () => {
  const roaming = Object.entries(npcs).filter(([, npc]) => npc.place === null);
  assert.ok(roaming.length >= 2);
  for (const [id, npc] of roaming) {
    assert.ok(npc.places.length >= 2, id);
    for (const place of npc.places) assert.equal(places[place].tile, npc.tile, `${id} : ${place}`);
  }
});

test('les dialogues sont tous rattachés à un PNJ', () => {
  const used = new Set(Object.values(npcs).map((npc) => npc.dialogue));
  for (const id of Object.keys(dialogues)) assert.ok(used.has(id), `dialogue ${id} sans PNJ`);
});

// --- État --------------------------------------------------------------------------------

test('createCampaign pose l\'état de chaque PNJ : vivant, position, pas rencontré', () => {
  const campaign = createCampaign({ seed: 1 });
  assert.deepEqual(campaign.npcs, startingNpcs());
  assert.deepEqual(campaign.npcs['marchand-bunker'],
    { alive: true, tile: 'cordon', place: 'camp-novices', met: false, helped: false });
  assert.deepEqual(campaign.npcs.pelerin,
    { alive: true, tile: 'marais', place: 'eglise', met: false, helped: false });
  assert.deepEqual(JSON.parse(JSON.stringify(campaign.npcs)), campaign.npcs);
});

test('npcsAt et isIsolated', () => {
  const campaign = createCampaign({ seed: 1 });
  assert.deepEqual(npcsAt(campaign, 'camp-novices').sort(), ['bohdan', 'marchand-bunker', 'saveli', 'tolik']);
  campaign.npcs.tolik.alive = false;
  assert.ok(!npcsAt(campaign, 'camp-novices').includes('tolik'));
  assert.equal(isIsolated('marchand-bunker'), false);
  assert.equal(isIsolated('blesse-elevateur'), true);
  assert.equal(isIsolated('pelerin'), true);
});

// --- talk --------------------------------------------------------------------------------

test('talk à un PNJ présent : dialogue ouvert, npc-met, choix de première visite', () => {
  const campaign = createCampaign({ seed: 1 });
  const { state, events } = step(campaign, { type: 'talk', npc: 'marchand-bunker' });
  assert.equal(state.screen, 'dialogue');
  assert.equal(state.npcs['marchand-bunker'].met, true);
  assert.equal(state.dialogue.firstVisit, true);
  assert.ok(events.some((e) => e.type === 'npc-met' && e.npc === 'marchand-bunker'));
  assert.equal(dialogueView(state).choices[0].available, true);
  assert.equal(campaign.npcs['marchand-bunker'].met, false, 'campagne d\'origine intacte');

  const closed = step(state, { type: 'choose', index: 3 }).state;
  const again = step(closed, { type: 'talk', npc: 'marchand-bunker' });
  assert.ok(!again.events.some((e) => e.type === 'npc-met'));
  assert.equal(again.state.dialogue.firstVisit, undefined);
  assert.equal(dialogueView(again.state).choices[0].available, false);
});

test('talk refusé : PNJ ailleurs, PNJ mort, PNJ inconnu', () => {
  const campaign = createCampaign({ seed: 1 });
  assert.equal(step(campaign, { type: 'talk', npc: 'fedir' }).events[0].reason, 'npc-not-here');
  const dead = campaignAt('camp-novices', (c) => { c.npcs.tolik.alive = false; });
  assert.equal(step(dead, { type: 'talk', npc: 'tolik' }).events[0].reason, 'npc-dead');
  assert.equal(step(campaign, { type: 'talk', npc: 'personne' }).events[0].reason, 'unknown-npc');
});

test('talk suit un itinérant là où il se tient', () => {
  const campaign = campaignAt('depot', (c) => { c.npcs['voyageur-arret'].place = 'depot'; });
  assert.equal(step(campaign, { type: 'talk', npc: 'voyageur-arret' }).state.screen, 'dialogue');
  const gone = campaignAt('arret-bus', (c) => { c.npcs['voyageur-arret'].place = 'depot'; });
  assert.equal(step(gone, { type: 'talk', npc: 'voyageur-arret' }).events[0].reason, 'npc-not-here');
});

test('chaque PNJ se parle depuis son lieu de départ, avec au moins un choix disponible', () => {
  for (const [id, state] of Object.entries(startingNpcs())) {
    const campaign = campaignAt(state.place);
    const open = step(campaign, { type: 'talk', npc: id });
    assert.equal(open.state.screen, 'dialogue', id);
    assert.ok(dialogueView(open.state).choices.some((c) => c.available), `${id} : aucun choix disponible`);
  }
});

test('soigner le blessé de l\'Élévateur l\'aide (effet aider) : il ne meurt plus', () => {
  const campaign = campaignAt('elevateur', (c) => { c.inventory = [createItem('bandage')]; });
  const open = step(campaign, { type: 'talk', npc: 'blesse-elevateur' }).state;
  const { state, events } = step(open, { type: 'choose', index: 1 });
  assert.equal(state.npcs['blesse-elevateur'].helped, true);
  assert.ok(events.some((e) => e.type === 'npc-helped' && e.npc === 'blesse-elevateur'));
  assert.equal(state.inventory.length, 0);

  const ctx = fakeCtx(0);
  endangerNpcs(state, ctx, { cause: 'emission' });
  assert.equal(state.npcs['blesse-elevateur'].alive, true);
});

// --- Hooks des cartes 7 et 8 ---------------------------------------------------------------

test('moveNpcs : un itinérant change de lieu sous MOVE_CHANCE, les fixes restent', () => {
  const campaign = createCampaign({ seed: 1 });
  const ctx = fakeCtx(MOVE_CHANCE - 0.01);
  moveNpcs(campaign, ctx);
  assert.equal(campaign.npcs.pelerin.place, 'ruines-village');
  assert.equal(campaign.npcs['marchand-bunker'].place, 'camp-novices');
  assert.deepEqual(ctx.events.find((e) => e.npc === 'pelerin'),
    { type: 'npc-moved', npc: 'pelerin', from: 'eglise', to: 'ruines-village' });

  const still = createCampaign({ seed: 1 });
  const idle = fakeCtx(MOVE_CHANCE);
  moveNpcs(still, idle);
  assert.deepEqual(idle.events, []);
  assert.deepEqual(still.npcs, startingNpcs());
});

test('moveNpcs ne déplace pas un mort', () => {
  const campaign = createCampaign({ seed: 1 });
  campaign.npcs.pelerin.alive = false;
  moveNpcs(campaign, fakeCtx(0));
  assert.equal(campaign.npcs.pelerin.place, 'eglise');
});

test('endangerNpcs : seuls les isolés non aidés meurent, la tuile filtre', () => {
  const campaign = createCampaign({ seed: 1 });
  const ctx = fakeCtx(DEATH_CHANCE.rencontre - 0.01);
  endangerNpcs(campaign, ctx, { cause: 'rencontre', tile: 'decharge' });
  assert.deepEqual(ctx.events, [{ type: 'npc-died', npc: 'voyageur-arret', cause: 'rencontre' }]);
  assert.equal(campaign.npcs['voyageur-arret'].alive, false);

  const emission = fakeCtx(0);
  endangerNpcs(campaign, emission, { cause: 'emission' });
  const dead = emission.events.map((e) => e.npc).sort();
  assert.deepEqual(dead, ['blesse-elevateur', 'chasseur', 'kravets', 'pelerin', 'vovk']);
  for (const id of npcsAt(campaign, 'bar')) assert.equal(campaign.npcs[id].alive, true);

  const safe = createCampaign({ seed: 1 });
  const lucky = fakeCtx(DEATH_CHANCE.emission);
  endangerNpcs(safe, lucky, { cause: 'emission' });
  assert.deepEqual(lucky.events, []);
  assert.throws(() => endangerNpcs(safe, lucky, { cause: 'pluie' }));
});
