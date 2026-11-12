// Contrats générés (carte 22) : règles de src/engine/rules/contracts.js, modèles de
// src/content/contrats.js.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import content from '../src/content/index.js';
import { checkContracts } from '../src/content/validate.js';
import { createCampaign, step, dayState } from '../src/engine/campaign.js';
import { createRng } from '../src/engine/rng.js';
import { HUB_SERVICES } from '../src/engine/rules/hubs.js';
import { DAY_HOOKS } from '../src/engine/rules/time.js';
import { questLog } from '../src/engine/rules/quests.js';
import { encounterCards } from '../src/engine/rules/tile.js';
import {
  BOARD_SIZE, OFFER_DAYS, FAILURE_REPUTATION, CONTRACT_TYPES,
  tileDistance, maxTileLevel, contractReward, offerContract, contractBoard, renewContracts,
} from '../src/engine/rules/contracts.js';

const jsonCopy = (value) => JSON.parse(JSON.stringify(value));
const types = (events) => events.map((event) => event.type);
const HUB = 'camp-novices';
const CONTRACT_HUBS = Object.keys(content.places).filter((id) => content.places[id].services?.includes('contrats'));

function inCamp({ seed = 1 } = {}) {
  const campaign = jsonCopy(createCampaign({ seed }));
  campaign.world.hex = content.places[HUB].hex;
  return step(campaign, { type: 'enter-hub' }).state;
}

const consult = (campaign) => step(campaign, { type: 'service', service: 'contrats' });
const accept = (campaign, contract) => step(campaign, { type: 'service', service: 'contrats', contract });

// Pose sur le tableau du Camp une offre du modèle donné, tirée avec une graine fixe.
function withOffer(campaign, templateId, { rank = 'bleu', seed = 7 } = {}) {
  const draft = jsonCopy(campaign);
  draft.player.rank = rank;
  const offer = offerContract(draft, HUB, templateId, createRng(seed), `test-${templateId}`);
  assert.ok(offer, `offre du modèle ${templateId}`);
  draft.contracts[HUB] = [offer];
  return { campaign: draft, offer };
}

// §8.4 Modèles

test('les modèles : les 5 types de la v1, aux 4 hubs, délai de 2 à 5 jours', () => {
  const templates = Object.values(content.contracts);
  assert.deepEqual([...new Set(templates.map((t) => t.type))].sort(), [...CONTRACT_TYPES].sort());
  for (const hub of CONTRACT_HUBS) {
    const here = templates.filter((t) => t.places.includes(hub));
    assert.deepEqual([...new Set(here.map((t) => t.type))].sort(), [...CONTRACT_TYPES].sort(), hub);
    for (const t of here) assert.equal(t.faction, content.places[hub].faction, 'faction du hub');
  }
  for (const t of templates) assert.ok(t.deadline[0] >= 2 && t.deadline[1] <= 5 && t.deadline[0] <= t.deadline[1]);
  assert.deepEqual(checkContracts(content), []);
});

test('checkContracts : type, délai, hub sans tableau, objet manquant', () => {
  const bad = {
    places: content.places,
    contracts: {
      a: { type: 'pillage', faction: 'solitaires', places: [HUB], reward: 100, deadline: [2, 3] },
      b: { type: 'elimination', faction: 'solitaires', places: [HUB], reward: 100, deadline: [4, 2] },
      c: { type: 'elimination', faction: 'solitaires', places: ['ferme-cordon'], reward: 100, deadline: [2, 3] },
      d: { type: 'livraison', faction: 'solitaires', places: [HUB], reward: 100, deadline: [2, 3] },
    },
  };
  assert.deepEqual(checkContracts(bad), [
    'contracts.a.type : type inconnu « pillage »',
    'contracts.b.deadline : [min, max] attendu',
    'contracts.c.places[0] : « ferme-cordon » n’affiche pas de contrats',
    'contracts.d.item : objet requis pour livraison',
  ]);
});

// §8.4 Récompense = base × distance en tuiles × niveau de la tuile

test('tileDistance : nombre de liaisons entre deux tuiles', () => {
  assert.equal(tileDistance('cordon', 'cordon'), 0);
  assert.equal(tileDistance('cordon', 'marais'), 1);
  assert.equal(tileDistance('cordon', 'rostok'), 2);
  assert.equal(tileDistance('cordon', 'entrepots'), 3);
  assert.equal(tileDistance('marais', 'vallee-sombre'), 3);
});

test('contractReward : base × distance × niveau, la tuile du hub compte pour 1', () => {
  assert.equal(contractReward(300, 0, 1), 300);
  assert.equal(contractReward(300, 2, 4), 2400);
});

test('maxTileLevel : le rang ouvre les tuiles plus dures', () => {
  assert.deepEqual(['bleu', 'experimente', 'veteran', 'expert', 'maitre'].map(maxTileLevel), [1, 2, 3, 4, 4]);
});

test('offerContract : tuile cible selon le rang, récompense, délai dans la fourchette', () => {
  const campaign = inCamp();
  for (const [rank, seed] of [['bleu', 1], ['veteran', 2], ['maitre', 3], ['maitre', 4]]) {
    campaign.player.rank = rank;
    const offer = offerContract(campaign, HUB, 'elimination-camp-novices', createRng(seed), 'x');
    const template = content.contracts['elimination-camp-novices'];
    const level = content.tiles[offer.tile].level;
    assert.ok(level <= maxTileLevel(rank), `${rank} : ${offer.tile}`);
    assert.equal(offer.quest.rewards.roubles,
      contractReward(template.reward, tileDistance('cordon', offer.tile), level));
    assert.ok(offer.quest.deadline >= template.deadline[0] && offer.quest.deadline <= template.deadline[1]);
    assert.deepEqual(offer.quest.contract, { hub: HUB, faction: 'solitaires', template: 'elimination-camp-novices' });
  }
});

test('offerContract : un Bleu au Camp n’a que le Cordon', () => {
  const campaign = inCamp();
  for (let seed = 1; seed <= 10; seed += 1) {
    for (const templateId of Object.keys(content.contracts).filter((id) => id.endsWith(HUB))) {
      const offer = offerContract(campaign, HUB, templateId, createRng(seed), 'x');
      if (offer) assert.equal(offer.tile, 'cordon', templateId);
    }
  }
});

test('offerContract : chaque type devient une quête aux objectifs de quests.js', () => {
  const campaign = inCamp();
  const objectives = (templateId) => {
    const { quest } = offerContract(campaign, HUB, templateId, createRng(5), 'x');
    return Object.values(quest.steps).map((s) => s.objective);
  };
  const [livraison] = objectives('livraison-camp-novices');
  assert.equal(livraison.type, 'rapporter');
  assert.equal(livraison.item, 'colis');
  assert.equal(content.npcs[livraison.npc].place === HUB, false, 'livré hors du hub');
  const [aller, rapporter] = objectives('recuperation-camp-novices');
  assert.equal(aller.type, 'visiter');
  assert.deepEqual([rapporter.type, rapporter.item, content.npcs[rapporter.npc].place], ['rapporter', 'meduse', HUB]);
  const [eliminer] = objectives('elimination-camp-novices');
  assert.ok(Object.hasOwn(encounterCards(content.tiles[eliminer.tile]), eliminer.encounter));
  const [escorter] = objectives('escorte-camp-novices');
  assert.equal(escorter.type, 'escorter');
  assert.equal(content.npcs[escorter.npc].place, HUB);
  assert.notEqual(escorter.place, HUB);
  assert.deepEqual(objectives('cartographie-camp-novices'), [{ type: 'cartographier', tile: 'cordon' }]);
});

// §8.1 Tableau des hubs : 3 contrats visibles

test('service contrats : le tableau se remplit à la première consultation, sans PA', () => {
  const campaign = inCamp();
  const { state, events } = consult(campaign);
  assert.equal(state.contracts[HUB].length, BOARD_SIZE);
  assert.deepEqual(events, [{ type: 'contracts-board', hub: HUB, contracts: state.contracts[HUB].map((c) => c.id) }]);
  assert.equal(dayState(state).ap.left, dayState(campaign).ap.left);
  assert.deepEqual(contractBoard(state, HUB), state.contracts[HUB]);
  assert.deepEqual(campaign.contracts, {}, 'la campagne reçue ne change pas');
  assert.equal(new Set(state.contracts[HUB].map((c) => c.id)).size, BOARD_SIZE, 'ids uniques');
});

test('service contrats : même graine, même tableau ; une 2e consultation ne retire rien', () => {
  const first = consult(inCamp()).state;
  assert.deepEqual(consult(inCamp()).state.contracts, first.contracts);
  assert.deepEqual(consult(first).state.contracts, first.contracts);
});

test('HUB_SERVICES.contrats est branché', () => {
  assert.equal(typeof HUB_SERVICES.contrats, 'function');
});

// Accepter : un contrat accepté = une quête générée

test('accepter : le contrat quitte le tableau et devient une quête active', () => {
  const board = consult(inCamp()).state;
  const [offer] = board.contracts[HUB];
  const { state, events } = accept(board, offer.id);
  assert.equal(state.contracts[HUB].length, BOARD_SIZE - 1);
  assert.equal(state.quests[offer.id].status, 'active');
  assert.deepEqual(state.quests[offer.id].quest, offer.quest);
  assert.equal(state.quests[offer.id].deadline, state.day + offer.quest.deadline);
  assert.ok(types(events).includes('contract-accepted'));
  assert.ok(types(events).includes('quest-started'));
  const [entry] = questLog(state).active;
  assert.equal(entry.quest, offer.id);
  assert.equal(entry.name, offer.quest.name);
});

test('accepter : refus d’un contrat absent de ce tableau', () => {
  const board = consult(inCamp()).state;
  assert.equal(accept(board, 'nope').events[0].reason, 'unknown-contract');
});

test('livraison : le colis est remis ; refus si l’inventaire est plein', () => {
  const { campaign, offer } = withOffer(inCamp(), 'livraison-camp-novices');
  const { state, events } = accept(campaign, offer.id);
  assert.ok(state.inventory.some((item) => item.kind === 'colis'));
  assert.ok(events.some((e) => e.type === 'item-gained' && e.kind === 'colis' && e.cause === 'contrat'));

  const full = jsonCopy(campaign);
  full.inventory = Array.from({ length: 40 }, () => ({ kind: 'colis', size: 1 }));
  assert.equal(accept(full, offer.id).events[0].reason, 'inventory-full');
});

test('contrat rempli : récompense en roubles et XP par le moteur des quêtes', () => {
  const { campaign, offer } = withOffer(inCamp(), 'cartographie-camp-novices');
  const accepted = accept(campaign, offer.id).state;
  const roubles = accepted.player.roubles;
  for (const token of accepted.world.tiles.cordon.tokens) token.revealed = true;
  const { state, events } = step(accepted, { type: 'leave-hub' });
  assert.equal(state.quests[offer.id].status, 'done');
  assert.equal(state.player.roubles, roubles + offer.quest.rewards.roubles);
  assert.ok(events.some((e) => e.type === 'xp-gained'));
});

test('contrat raté : délai dépassé, réputation de la faction du hub', () => {
  const { campaign, offer } = withOffer(inCamp(), 'elimination-camp-novices');
  const accepted = jsonCopy(accept(campaign, offer.id).state);
  accepted.day = accepted.quests[offer.id].deadline + 1;
  const before = accepted.reputation.solitaires;
  const { state, events } = step(accepted, { type: 'leave-hub' });
  assert.equal(state.quests[offer.id].status, 'failed');
  assert.equal(state.reputation.solitaires, before + FAILURE_REPUTATION);
  assert.ok(events.some((e) => e.type === 'contract-failed' && e.contract === offer.id && e.faction === 'solitaires'));
});

test('une quête écrite ratée ne coûte pas de réputation de contrat', () => {
  const campaign = inCamp();
  campaign.quests.autre = { status: 'active', step: 'x', started: 1, deadline: 0, waiting: false, history: [],
    quest: { name: 'Autre', start: 'x', steps: { x: { objective: { type: 'survivre', day: 99 }, next: [] } } } };
  const { events } = step(campaign, { type: 'leave-hub' });
  assert.ok(types(events).includes('quest-failed'));
  assert.ok(!types(events).includes('contract-failed'));
});

// Renouvellement (DAY_HOOKS de rules/time.js)

test('renewContracts est un hook de changement de jour', () => {
  assert.ok(Object.values(DAY_HOOKS).flat().includes(renewContracts));
});

test('nouveau jour : offres périmées retirées, tous les tableaux complétés', () => {
  const board = consult(inCamp()).state;
  const [taken, kept] = board.contracts[HUB];
  const accepted = jsonCopy(accept(board, taken.id).state);
  accepted.contracts[HUB].find((c) => c.id === kept.id).offered = accepted.day + 1 - OFFER_DAYS;
  const { state, events } = step(step(accepted, { type: 'sleep' }).state, { type: 'wake' });
  assert.equal(state.day, accepted.day + 1);
  for (const hub of CONTRACT_HUBS) assert.equal(state.contracts[hub].length, BOARD_SIZE, hub);
  const ids = state.contracts[HUB].map((c) => c.id);
  assert.ok(!ids.includes(kept.id), 'offre périmée retirée');
  assert.ok(!ids.includes(taken.id), 'contrat accepté pas reproposé');
  assert.equal(new Set(ids).size, BOARD_SIZE);
  assert.ok(events.some((e) => e.type === 'contracts-renewed'));
});

test('état sérialisable : le JSON rejoue à l’identique', () => {
  const board = consult(inCamp()).state;
  const accepted = accept(board, board.contracts[HUB][0].id).state;
  const replay = (c) => step(step(c, { type: 'leave-hub' }).state, { type: 'enter-hub' });
  assert.deepEqual(replay(jsonCopy(accepted)), replay(accepted));
});
