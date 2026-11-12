import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createCampaign } from '../src/engine/campaign.js';
import { startQuest } from '../src/engine/rules/quests.js';
import { createRng } from '../src/engine/rng.js';
import content from '../src/content/index.js';
import { INTRO_LINES, objectiveFocus, giverMarkers } from '../src/ui/objectif.js';

const fakeCtx = () => ({ rng: createRng(1), emit: () => {} });
const camp = content.places['camp-novices'];

test('introduction : trois phrases, la dernière envoie au Marchand du bunker', () => {
  assert.equal(INTRO_LINES.length, 3);
  assert.match(INTRO_LINES[2], /Marchand du bunker/);
});

test('objectif au départ : parler au donneur de la quête principale, au Camp des novices', () => {
  const focus = objectiveFocus(createCampaign({ seed: 1 }));
  assert.deepEqual(focus, {
    title: 'Pour commencer',
    step: 'Parler au Marchand du bunker',
    target: 'Camp des novices (Cordon)',
    tile: 'cordon',
    hex: camp.hex,
    here: true,
  });
});

test('objectif : la quête principale active passe avant les autres, avec sa cible', () => {
  const campaign = createCampaign({ seed: 1 });
  startQuest(campaign, 'chiens-cordon', fakeCtx());
  startQuest(campaign, 'le-guide', fakeCtx());
  const focus = objectiveFocus(campaign);
  assert.equal(focus.title, 'Le Guide');
  assert.equal(focus.step, 'Fouiller ATP (carte 3) : retrouver le PDA du courrier');
  assert.equal(focus.target, 'ATP (Cordon)');
  assert.equal(focus.hex, content.places.atp.hex);
  assert.equal(focus.here, true);
});

test('objectif : sans quête principale, la première quête active ; cible sur une autre tuile', () => {
  const campaign = createCampaign({ seed: 1 });
  startQuest(campaign, 'ami-du-pont', fakeCtx());
  campaign.quests['le-guide'] = { status: 'done' };
  const focus = objectiveFocus(campaign);
  assert.equal(focus.title, content.quests['ami-du-pont'].name);
  assert.equal(focus.here, false);
  assert.equal(focus.tile, 'vallee-sombre');
});

test('objectif : quête en attente d’un choix, puis aucune quête', () => {
  const campaign = createCampaign({ seed: 1 });
  startQuest(campaign, 'le-guide', fakeCtx());
  campaign.quests['le-guide'].waiting = true;
  assert.equal(objectiveFocus(campaign).step, 'Choisir la suite : voir le PDA');
  campaign.quests['le-guide'].status = 'done';
  const none = objectiveFocus(campaign);
  assert.equal(none.title, 'Aucune quête en cours');
  assert.equal(none.target, null);
  assert.equal(none.here, false);
});

test('marqueur « ! » : sur le donneur tant que la quête principale n’est pas prise', () => {
  const campaign = createCampaign({ seed: 1 });
  assert.deepEqual(giverMarkers(campaign), [{ hex: camp.hex, npc: 'marchand-bunker', name: 'Le Marchand du bunker' }]);
  startQuest(campaign, 'le-guide', fakeCtx());
  assert.deepEqual(giverMarkers(campaign), []);
});

test('marqueur « ! » : rien sur une autre tuile ni si le donneur est mort', () => {
  const campaign = createCampaign({ seed: 1 });
  campaign.world.currentTile = 'decharge';
  assert.deepEqual(giverMarkers(campaign), []);
  campaign.world.currentTile = 'cordon';
  campaign.npcs['marchand-bunker'].alive = false;
  assert.deepEqual(giverMarkers(campaign), []);
});
