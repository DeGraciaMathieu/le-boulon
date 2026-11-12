// Quête principale « Le Guide » (carte 20, brief v2 §8.3) : src/content/quetes/le-guide.js,
// arc du Marais src/content/quetes/souvenir-du-guide.js, cartes réservées des paquets
// d'exploration (src/content/paquets/exploration.js).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import content from '../src/content/index.js';
import { createCampaign, step } from '../src/engine/campaign.js';
import { createItem } from '../src/engine/rules/sheet.js';
import { startQuest } from '../src/engine/rules/quests.js';

const guide = content.quests['le-guide'];

function fakeCtx() {
  return { rng: { next: () => 0.5, pick: (items) => items[0] }, emit: () => {} };
}

function campaignAt(place, change = () => {}) {
  const { tile, hex } = content.places[place];
  const campaign = createCampaign({ seed: 11, tile });
  campaign.world.tiles[tile].zone.deck = [];
  campaign.world.hex = hex;
  change(campaign);
  return campaign;
}

// Pose le joueur sur l’hexagone d’un lieu de la même tuile.
function moveTo(campaign, place) {
  const moved = structuredClone(campaign);
  moved.world.hex = content.places[place].hex;
  return moved;
}

function play(campaign, actions) {
  const events = [];
  for (const action of actions) {
    const result = step(campaign, action);
    assert.notEqual(result.events[0]?.type, 'refused', JSON.stringify(result.events[0]));
    campaign = result.state;
    events.push(...result.events);
  }
  return { campaign, events };
}

// Index du choix du nœud courant dont le texte commence par start.
function choice(campaign, start) {
  const { npc, node } = campaign.dialogue;
  const index = content.dialogues[content.npcs[npc].dialogue].nodes[node].choices
    .findIndex((c) => c.text.startsWith(start));
  assert.ok(index >= 0, `${npc}.${node} : pas de choix « ${start} »`);
  return { type: 'choose', index };
}

function say(campaign, ...starts) {
  for (const start of starts) campaign = play(campaign, [choice(campaign, start)]).campaign;
  return campaign;
}

const stepOf = (campaign) => campaign.quests['le-guide'].step;

// Suites possibles depuis une étape, jusqu'aux fins.
function paths(stepId, path = []) {
  const { next } = guide.steps[stepId];
  if (next.length === 0) return [[...path, stepId]];
  return next.flatMap((n) => paths(n, [...path, stepId]));
}

test('le Guide : cinq actes, une vingtaine d’étapes, deux voies à l’acte 4 qui se rejoignent', () => {
  const steps = Object.keys(guide.steps);
  for (const act of [1, 2, 3, 4, 5]) {
    assert.ok(steps.some((s) => s.startsWith(`a${act}-`)), `acte ${act} sans étape`);
  }
  assert.ok(steps.length >= 18 && steps.length <= 22, `${steps.length} étapes`);
  assert.equal(guide.giver, 'marchand-bunker');
  const all = paths(guide.start);
  assert.equal(all.length, 2);
  for (const path of all) assert.equal(path.at(-1), 'a5-trace');
  assert.deepEqual(all.map((path) => path.includes('a4-devoir-serment')).sort(), [false, true]);
});

test('le Guide : l’indice de l’acte 1 sort en 3e position à l’ATP (§5.1)', () => {
  assert.deepEqual(guide.steps[guide.start].objective, {
    type: 'explorer', place: 'atp', card: 'indice-acte1', position: 3,
  });
});

test('cartes réservées : hors quête, elles ne sortent jamais du paquet du lieu', () => {
  let campaign = moveTo(createCampaign({ seed: 3 }), 'atp');
  campaign.world.tiles.cordon.zone.deck = [];
  campaign = play(campaign, [{ type: 'enter-place', place: 'atp' }]).campaign;
  assert.ok(!campaign.places.atp.pool.includes('indice-acte1'));
  assert.equal(campaign.places.atp.pool.length, 7);
});

test('cartes réservées : chaque carte d’exploration réservée est fixée par une étape de sa quête', () => {
  const reserved = Object.entries(content.decks)
    .flatMap(([deck, { cards }]) => cards.filter((card) => card.quest).map((card) => ({ deck, ...card })));
  assert.ok(reserved.length >= 9, `${reserved.length} cartes réservées`);
  for (const card of reserved) {
    const fixed = Object.values(content.quests[card.quest].steps).some(({ objective }) =>
      objective.type === 'explorer' && content.places[objective.place].deck === card.deck && objective.card === card.id);
    assert.ok(fixed, `${card.deck}.${card.id} : aucune étape de ${card.quest} ne la fixe`);
  }
});

test('acte 1 de bout en bout par step : Marchand, PDA à l’ATP, blessé de l’Élévateur, retour', () => {
  let campaign = campaignAt('camp-novices');

  campaign = play(campaign, [{ type: 'talk', npc: 'marchand-bunker' }]).campaign;
  campaign = say(campaign, 'Tu as du travail', 'Je prends', 'J’y vais');
  assert.equal(campaign.quests['le-guide'].status, 'active');
  assert.equal(stepOf(campaign), 'a1-atp');
  assert.deepEqual(campaign.places.atp.fixed, { 3: 'indice-acte1' });

  // Les deux premières cartes de l'ATP sans danger, pour ne pas ouvrir de combat.
  campaign = moveTo(campaign, 'atp');
  campaign.places.atp.pool = ['garage', 'butin'];
  const atp = play(campaign, [
    { type: 'enter-place', place: 'atp' }, { type: 'explore' }, { type: 'explore' }, { type: 'explore' },
    { type: 'leave-place' },
  ]);
  campaign = atp.campaign;
  const cards = atp.events.filter((e) => e.type === 'place-card');
  assert.equal(cards[2].card, 'indice-acte1');
  assert.ok(campaign.inventory.some((item) => item.kind === 'pda'));
  assert.equal(stepOf(campaign), 'a1-elevateur');

  campaign = moveTo(campaign, 'elevateur');
  campaign.inventory.push(createItem('bandage'));
  campaign = play(campaign, [{ type: 'talk', npc: 'blesse-elevateur' }]).campaign;
  campaign = say(campaign, 'Donner un bandage', 'Ce PDA');
  assert.equal(campaign.npcs['blesse-elevateur'].helped, true);
  assert.equal(stepOf(campaign), 'a1-retour');
  campaign = say(campaign, 'Merci');

  campaign = moveTo(campaign, 'camp-novices');
  campaign = play(campaign, [{ type: 'talk', npc: 'marchand-bunker' }]).campaign;
  campaign = say(campaign, 'Tu as du travail', 'Le PDA est ouvert');
  assert.ok(!campaign.inventory.some((item) => item.kind === 'pda'));
  assert.equal(stepOf(campaign), 'a2-barrage');
  assert.deepEqual(campaign.journal.filter((e) => e.quest === 'le-guide').map((e) => e.step),
    ['a1-atp', 'a1-atp', 'a1-elevateur', 'a1-retour', 'a2-barrage']);
});

test('acte 3 : l’accord avec Vovk donne la clé et saute l’Usine', () => {
  let campaign = campaignAt('usine-vallee', (c) => {
    startQuest(c, 'le-guide', fakeCtx());
    c.quests['le-guide'].step = 'a3-usine';
    c.player.roubles = 2000;
  });
  campaign = play(campaign, [{ type: 'talk', npc: 'vovk' }]).campaign;
  campaign = say(campaign, 'Je cherche une clé', 'Marché conclu');
  assert.ok(campaign.inventory.some((item) => item.kind === 'cle'));
  assert.equal(stepOf(campaign), 'a3-labo');
  assert.deepEqual(campaign.places.complexe.fixed, { 2: 'passage' });
});

test('acte 3 : la carte du laboratoire prend la clé et donne les données', () => {
  const card = content.decks.complexe.cards.find((c) => c.id === 'donnees-labo');
  assert.deepEqual(card.effects, [{ type: 'prendre', item: 'cle' }, { type: 'donner', item: 'donnees' }]);
});

test('acte 4 : Fedir prend les données et les documents, puis le choix du camp', () => {
  let campaign = campaignAt('bar', (c) => {
    startQuest(c, 'le-guide', fakeCtx());
    c.quests['le-guide'].step = 'a4-bar';
    c.inventory.push(createItem('donnees'), createItem('documents'));
  });
  campaign = play(campaign, [{ type: 'talk', npc: 'fedir' }]).campaign;
  campaign = say(campaign, 'Des bandes du laboratoire');
  assert.equal(campaign.quests['le-guide'].waiting, true);
  assert.ok(!campaign.inventory.some((item) => ['donnees', 'documents'].includes(item.kind)));
  const devoir = say(campaign, 'Le Devoir');
  assert.equal(stepOf(devoir), 'a4-devoir');
  const liberte = say(campaign, 'Liberté');
  assert.equal(stepOf(liberte), 'a4-liberte');
});

test('acte 4 : le serment fait rejoindre la faction, l’acte 5 en découle', () => {
  let campaign = campaignAt('base-liberte', (c) => {
    startQuest(c, 'le-guide', fakeCtx());
    c.quests['le-guide'].step = 'a4-liberte-serment';
  });
  campaign = play(campaign, [{ type: 'talk', npc: 'yasko' }]).campaign;
  campaign = say(campaign, 'Les ordres du Devoir', 'Je rejoins Liberté');
  assert.equal(campaign.player.faction, 'liberte');
  assert.equal(stepOf(campaign), 'a5-defense');
  assert.deepEqual(campaign.places['village-abandonne'].fixed, { 1: 'occupant-commando-devoir' });
});

test('arc du Marais : Yarema démarre « Le souvenir du Guide » une fois le Guide lancé', () => {
  let campaign = campaignAt('base-ciel-pur', (c) => startQuest(c, 'le-guide', fakeCtx()));
  campaign = play(campaign, [{ type: 'talk', npc: 'yarema' }]).campaign;
  campaign = say(campaign, 'Tu as connu le Guide');
  assert.equal(campaign.quests['souvenir-du-guide'].step, 'eglise');
  assert.deepEqual(campaign.places.eglise.fixed, { 2: 'notes-guide' });
});
