import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createCampaign, step, dayState, CAMPAIGN_ACTIONS, REACTIONS } from '../src/engine/campaign.js';
import { respawn, rememberHub, isDead, respawnHub, deathView, START_HUB, XP_KEPT } from '../src/engine/rules/death.js';
import { RANKS } from '../src/engine/rules/progression.js';
import { createItem } from '../src/engine/rules/sheet.js';
import { emptyEquipment } from '../src/engine/rules/equipment.js';
import content from '../src/content/index.js';

const jsonCopy = (value) => JSON.parse(JSON.stringify(value));
const types = (events) => events.map((event) => event.type);

const CAMP_NOVICES = content.places['camp-novices'];

// Campagne au Cordon, morte sur l'hexagone 13, sans équipement, avec un PDA (objet de quête).
function deadCampaign({ mode = 'normal', seed = 1 } = {}) {
  const campaign = jsonCopy(createCampaign({ seed, mode }));
  campaign.world.hex = 13;
  campaign.inventory = [createItem('ration'), createItem('pda'), createItem('bandage')];
  campaign.equipment = emptyEquipment();
  campaign.player.wounds = 6;
  campaign.player.radiation = 3;
  campaign.player.roubles = 420;
  campaign.chests = { 'camp-novices': [createItem('vodka')] };
  campaign.world.tiles.cordon.status = 'dead';
  return campaign;
}

test('branchement : respawn est une action de campagne, rememberHub une réaction', () => {
  assert.equal(CAMPAIGN_ACTIONS.respawn, respawn);
  assert.ok(REACTIONS.includes(rememberHub));
});

test('isDead : lit le status de la journée de la tuile courante', () => {
  assert.equal(isDead(createCampaign({ seed: 1 })), false);
  assert.equal(isDead(deadCampaign()), true);
});

test('respawnHub : le camp des novices tant qu’aucun hub n’a été visité (hypothèse v2)', () => {
  assert.equal(START_HUB, 'camp-novices');
  assert.equal(respawnHub(createCampaign({ seed: 1 })), START_HUB);
  assert.equal(respawnHub({ ...createCampaign({ seed: 1 }), lastHub: 'bar' }), 'bar');
});

test('rememberHub : entrer dans un hub le retient comme dernier hub visité', () => {
  const campaign = jsonCopy(createCampaign({ seed: 1 }));
  campaign.world.hex = CAMP_NOVICES.hex;
  const { state } = step(campaign, { type: 'enter-hub' });
  assert.equal(state.lastHub, 'camp-novices');
});

test('rememberHub : dormir au lit d’un hub le retient aussi', () => {
  const draft = { lastHub: 'camp-novices' };
  rememberHub(draft, [{ type: 'day-ended', reason: 'sleep', rest: 'lit', place: 'bar' }]);
  assert.equal(draft.lastHub, 'bar');
  rememberHub(draft, [{ type: 'day-ended', reason: 'camp', rest: 'abri' }]);
  assert.equal(draft.lastHub, 'bar');
});

test('respawn : refusé si le joueur est vivant', () => {
  const campaign = createCampaign({ seed: 1 });
  const { state, events } = step(campaign, { type: 'respawn' });
  assert.equal(state, campaign);
  assert.deepEqual(events.map((e) => e.reason), ['not-dead']);
});

test('respawn : refusé en hardcore, la sauvegarde est effacée par l’interface', () => {
  const campaign = deadCampaign({ mode: 'hardcore' });
  const { state, events } = step(campaign, { type: 'respawn' });
  assert.equal(state, campaign);
  assert.deepEqual(events.map((e) => e.reason), ['hardcore']);
});

test('respawn : réveil au dernier hub, la nuit au lit, puis wake lance le jour suivant', () => {
  const campaign = deadCampaign();
  const { state, events } = step(campaign, { type: 'respawn' });
  assert.deepEqual(types(events), ['respawned']);
  assert.equal(state.world.currentTile, 'cordon');
  assert.equal(state.world.hex, CAMP_NOVICES.hex);
  assert.deepEqual(state.hub, { id: 'camp-novices' });
  assert.equal(state.screen, 'night');
  assert.deepEqual(state.night, { rest: 'lit', place: 'camp-novices', cardDrawn: true });
  assert.equal(isDead(state), false);

  const morning = step(state, { type: 'wake' });
  assert.ok(types(morning.events).includes('day-started'));
  assert.equal(morning.state.day, campaign.day + 1);
  assert.equal(morning.state.screen, 'hub');
  assert.equal(dayState(morning.state).status, 'playing');
});

test('respawn : inventaire et équipement perdus, objets de quête rendus', () => {
  const campaign = deadCampaign();
  campaign.equipment.sidearm = createItem('pistolet');
  const { state, events } = step(campaign, { type: 'respawn' });
  assert.deepEqual(state.inventory.map((item) => item.kind), ['pda']);
  assert.equal(state.equipment.sidearm, null);
  assert.deepEqual(events[0].lost.sort(), ['bandage', 'pistolet', 'ration']);
});

test('respawn : roubles et coffre conservés, pistes de survie remises à 0 (hypothèse v2)', () => {
  const { state } = step(deadCampaign(), { type: 'respawn' });
  assert.equal(state.player.roubles, 420);
  assert.deepEqual(state.chests['camp-novices'].map((item) => item.kind), ['vodka']);
  assert.equal(state.player.wounds, 0);
  assert.equal(state.player.radiation, 0);
  assert.equal(state.player.hunger, 0);
});

test('respawn : garde 10 % de l’XP gagnée dans le rang en cours, jamais le rang', () => {
  assert.equal(XP_KEPT, 0.1);
  const campaign = deadCampaign();
  const veteran = RANKS.find((rank) => rank.id === 'veteran');
  campaign.player.rank = 'veteran';
  campaign.player.xp = veteran.xp + 255;
  const { state, events } = step(campaign, { type: 'respawn' });
  assert.equal(state.player.xp, veteran.xp + 25);
  assert.equal(state.player.rank, 'veteran');
  assert.deepEqual(events[0].xp, { before: veteran.xp + 255, after: veteran.xp + 25 });
});

test('respawn : sur une autre tuile, la tuile de la mort est rendue et le hub retrouvé', () => {
  const campaign = deadCampaign();
  campaign.lastHub = 'camp-novices';
  // Mort à la Décharge : la tuile courante change, celle du hub reste celle du Cordon.
  campaign.world.tiles.decharge = { ...jsonCopy(campaign.world.tiles.cordon), status: 'dead' };
  campaign.world.tiles.cordon.status = 'playing';
  campaign.world.currentTile = 'decharge';
  const { state } = step(campaign, { type: 'respawn' });
  assert.equal(state.world.currentTile, 'cordon');
  assert.notEqual(state.world.tiles.decharge.status, 'dead');
  assert.equal(state.world.tiles.cordon.status, 'night');
});

test('respawn : mort la nuit (carte Nuit), l’action reste permise', () => {
  const campaign = deadCampaign();
  campaign.screen = 'night';
  campaign.night = { rest: 'decouvert', cardDrawn: true };
  const { events } = step(campaign, { type: 'respawn' });
  assert.deepEqual(types(events), ['respawned']);
});

test('respawn : mort dans un lieu ou un combat v1, la visite et le combat sont fermés', () => {
  const campaign = deadCampaign();
  campaign.place = { id: 'avant-poste' };
  campaign.screen = 'place';
  campaign.world.tiles.cordon.combat = { hex: 13, card: 'x' };
  const { state } = step(campaign, { type: 'respawn' });
  assert.equal(state.place, undefined);
  assert.equal(dayState(state).combat, null);
});

test('deathView : ce que la mort coûte, sans rien modifier', () => {
  assert.equal(deathView(createCampaign({ seed: 1 })), null);
  const campaign = deadCampaign();
  const before = jsonCopy(campaign);
  const view = deathView(campaign);
  assert.deepEqual(campaign, before);
  assert.deepEqual(view, {
    mode: 'normal',
    hub: 'camp-novices',
    hubName: CAMP_NOVICES.name,
    lost: ['ration', 'bandage'],
    kept: ['pda'],
    roubles: 420,
    xp: { before: 0, after: 0 },
  });
  assert.equal(deathView(deadCampaign({ mode: 'hardcore' })).mode, 'hardcore');
});
