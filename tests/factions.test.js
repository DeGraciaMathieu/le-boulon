import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createCampaign, step, CAMPAIGN_ACTIONS } from '../src/engine/campaign.js';
import { EFFECTS, DIALOGUES } from '../src/engine/rules/dialogue.js';
import {
  REPUTATION_MIN,
  REPUTATION_MAX,
  STANDINGS,
  PRICE_MODIFIERS,
  startingReputation,
  reputationOf,
  tierOf,
  standing,
  changeReputation,
  isMember,
  memberPerks,
  priceModifier,
  placeAccess,
  encounterStance,
} from '../src/engine/rules/factions.js';
import content from '../src/content/index.js';
import FACTIONS from '../src/content/factions.js';

const jsonCopy = (value) => JSON.parse(JSON.stringify(value));

function collector() {
  const events = [];
  return { events, ctx: { emit: (event) => events.push(event) } };
}

function campaignWith({ reputation = {}, faction } = {}) {
  const campaign = createCampaign({ seed: 3 });
  Object.assign(campaign.reputation, reputation);
  if (faction) campaign.player.faction = faction;
  return campaign;
}

test('contenu : les 6 factions du §9, gelées et rangées dans l\'index', () => {
  assert.deepEqual(Object.keys(FACTIONS).sort(), ['bandits', 'ciel-pur', 'devoir', 'liberte', 'militaires', 'solitaires']);
  assert.equal(content.factions, FACTIONS);
  assert.ok(Object.isFrozen(FACTIONS));
  for (const [id, faction] of Object.entries(FACTIONS)) {
    assert.ok(Object.isFrozen(faction));
    assert.equal(faction.id, id);
    for (const key of ['name', 'places', 'joinable', 'start']) assert.ok(key in faction, `${id}.${key}`);
  }
  const joinable = Object.values(FACTIONS).filter((f) => f.joinable).map((f) => f.id).sort();
  assert.deepEqual(joinable, ['devoir', 'liberte', 'solitaires']);
  assert.equal(FACTIONS.solitaires.default, true);
  assert.equal(FACTIONS.devoir.rival, 'liberte');
  assert.equal(FACTIONS.liberte.rival, 'devoir');
});

test('paliers : -3 et -2 hostile, -1 à +1 neutre, +2 amical, +3 allié', () => {
  assert.equal(REPUTATION_MIN, -3);
  assert.equal(REPUTATION_MAX, 3);
  assert.deepEqual(STANDINGS, ['hostile', 'neutre', 'amical', 'allie']);
  const tiers = [-3, -2, -1, 0, 1, 2, 3].map(tierOf);
  assert.deepEqual(tiers, ['hostile', 'hostile', 'neutre', 'neutre', 'neutre', 'amical', 'allie']);
});

test('createCampaign pose la réputation de départ du §9', () => {
  const campaign = createCampaign({ seed: 1 });
  assert.deepEqual(campaign.reputation, startingReputation());
  assert.equal(standing(campaign, 'solitaires'), 'amical');
  assert.equal(standing(campaign, 'devoir'), 'neutre');
  assert.equal(standing(campaign, 'liberte'), 'neutre');
  assert.equal(standing(campaign, 'ciel-pur'), 'neutre');
  assert.equal(standing(campaign, 'bandits'), 'hostile');
  assert.equal(standing(campaign, 'militaires'), 'hostile');
  assert.equal(campaign.player.faction, 'solitaires');
});

test('reputationOf : faction absente = 0, faction inconnue = erreur', () => {
  const campaign = createCampaign({ seed: 1 });
  campaign.reputation = {};
  assert.equal(reputationOf(campaign, 'devoir'), 0);
  assert.throws(() => reputationOf(campaign, 'monolithe'), /faction inconnue/);
});

test('changeReputation : bornée à -3..3, un événement par changement', () => {
  const draft = campaignWith({ reputation: { solitaires: 2 } });
  const { events, ctx } = collector();
  changeReputation(draft, 'solitaires', 5, ctx);
  changeReputation(draft, 'bandits', -4, ctx);
  assert.equal(draft.reputation.solitaires, 3);
  assert.equal(draft.reputation.bandits, -3);
  assert.deepEqual(events, [
    { type: 'reputation-changed', faction: 'solitaires', amount: 5, reputation: 3 },
    { type: 'reputation-changed', faction: 'bandits', amount: -4, reputation: -3 },
  ]);
  assert.throws(() => changeReputation(draft, 'monolithe', 1, ctx), /faction inconnue/);
});

test('effet de dialogue « reputation » passe par changeReputation', () => {
  const draft = campaignWith({ reputation: { devoir: 1 } });
  const { events, ctx } = collector();
  EFFECTS.reputation(draft, { type: 'reputation', faction: 'devoir', amount: 1 }, ctx);
  assert.equal(draft.reputation.devoir, 2);
  assert.equal(events[0].type, 'reputation-changed');
});

test('action join : rejoindre le Devoir passe Liberté à -2 et pose player.faction', () => {
  assert.ok('join' in CAMPAIGN_ACTIONS);
  const start = campaignWith({ reputation: { liberte: 1 } });
  const before = jsonCopy(start);
  const { state, events } = step(start, { type: 'join', faction: 'devoir' });
  assert.deepEqual(start, before, 'la campagne reçue ne change pas');
  assert.equal(state.player.faction, 'devoir');
  assert.equal(state.reputation.liberte, -2);
  assert.equal(standing(state, 'liberte'), 'hostile');
  assert.equal(state.reputation.devoir, start.reputation.devoir, 'la faction rejointe garde sa piste');
  assert.deepEqual(events, [
    { type: 'reputation-changed', faction: 'liberte', amount: -3, reputation: -2 },
    { type: 'faction-joined', faction: 'devoir', previous: 'solitaires' },
  ]);
  assert.deepEqual(jsonCopy(state), state, 'état sérialisable');
});

test('action join : refus sans rien toucher', () => {
  const cases = [
    [campaignWith(), 'monolithe', 'unknown-faction'],
    [campaignWith(), 'bandits', 'not-joinable'],
    [campaignWith(), 'solitaires', 'already-member'],
    [campaignWith({ faction: 'liberte' }), 'devoir', 'already-joined'],
    [campaignWith({ reputation: { devoir: -2 } }), 'devoir', 'hostile'],
  ];
  for (const [campaign, faction, reason] of cases) {
    const result = step(campaign, { type: 'join', faction });
    assert.equal(result.state, campaign, reason);
    assert.deepEqual(result.events, [{ type: 'refused', action: { type: 'join', faction }, reason }]);
  }
});

test('effet de dialogue « rejoindre-faction » : même règle, refus qui annule le choix', () => {
  DIALOGUES['barman-test'] = Object.freeze({
    id: 'adhesion',
    start: 'offre',
    nodes: { offre: { text: 'Tu es avec nous ?', choices: [
      { text: 'Je rejoins Liberté.', next: null, effects: [{ type: 'rejoindre-faction', faction: 'liberte' }] },
    ] } },
  });
  let campaign = step(createCampaign({ seed: 5 }), { type: 'talk', npc: 'barman-test' }).state;
  const { state, events } = step(campaign, { type: 'choose', index: 0 });
  assert.equal(state.player.faction, 'liberte');
  assert.equal(state.reputation.devoir, -2);
  assert.ok(events.some((e) => e.type === 'faction-joined' && e.faction === 'liberte'));

  campaign = step(campaignWith({ faction: 'devoir' }), { type: 'talk', npc: 'barman-test' }).state;
  const refused = step(campaign, { type: 'choose', index: 0 });
  assert.equal(refused.state, campaign);
  assert.equal(refused.events[0].reason, 'already-joined');
});

test('memberPerks : lit gratuit, prix d\'allié et contrats pour le Devoir ou Liberté rejoints', () => {
  const member = campaignWith({ faction: 'devoir' });
  assert.equal(isMember(member, 'devoir'), true);
  assert.deepEqual(memberPerks(member, 'devoir'), { freeBed: true, allyPrices: true, factionContracts: true });
  assert.deepEqual(memberPerks(member, 'liberte'), { freeBed: false, allyPrices: false, factionContracts: false });
  // Solitaires par défaut : seulement le lit gratuit du §4.3.
  const loner = createCampaign({ seed: 1 });
  assert.deepEqual(memberPerks(loner, 'solitaires'), { freeBed: true, allyPrices: false, factionContracts: false });
});

test('priceModifier : table du §6.2, hostile = refus, membre = prix d\'allié', () => {
  assert.deepEqual(PRICE_MODIFIERS, {
    hostile: null,
    neutre: { buy: 1, sell: 0.5 },
    amical: { buy: 0.9, sell: 0.6 },
    allie: { buy: 0.8, sell: 0.7 },
  });
  const campaign = campaignWith({ reputation: { devoir: 2, bandits: -3, liberte: 3 } });
  assert.deepEqual(priceModifier(campaign, 'devoir'), { buy: 0.9, sell: 0.6 });
  assert.deepEqual(priceModifier(campaign, 'liberte'), { buy: 0.8, sell: 0.7 });
  assert.deepEqual(priceModifier(campaign, 'ciel-pur'), { buy: 1, sell: 0.5 });
  assert.equal(priceModifier(campaign, 'bandits'), null);
  const member = campaignWith({ faction: 'devoir', reputation: { devoir: 0 } });
  assert.deepEqual(priceModifier(member, 'devoir'), { buy: 0.8, sell: 0.7 });
});

test('placeAccess : libre en bons termes, sinon combattre, se faufiler ou payer', () => {
  const campaign = campaignWith({ reputation: { devoir: 2, 'ciel-pur': 0 } });
  assert.deepEqual(placeAccess(campaign, 'devoir'), { free: true, options: [] });
  assert.deepEqual(placeAccess(campaign, 'militaires'), { free: false, options: ['combattre', 'se-faufiler', 'payer'] });
  assert.deepEqual(placeAccess(campaign, 'ciel-pur'), { free: false, options: ['combattre', 'se-faufiler', 'payer'] });
  assert.deepEqual(placeAccess(campaign, null), { free: true, options: [] }, 'lieu non tenu');
  const member = campaignWith({ faction: 'liberte', reputation: { liberte: 0 } });
  assert.equal(placeAccess(member, 'liberte').free, true);
});

test('encounterStance : patrouille amicale = échange, sinon combat', () => {
  const campaign = campaignWith({ reputation: { devoir: 3, liberte: 0 } });
  assert.equal(encounterStance(campaign, 'solitaires'), 'echange');
  assert.equal(encounterStance(campaign, 'devoir'), 'echange');
  assert.equal(encounterStance(campaign, 'liberte'), 'combat');
  assert.equal(encounterStance(campaign, 'bandits'), 'combat');
});
