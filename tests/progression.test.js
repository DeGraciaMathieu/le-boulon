import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createGame, step as stepGame } from '../src/engine/game.js';
import { createCampaign, step, dayState } from '../src/engine/campaign.js';
import { toAxial, toNumber } from '../src/engine/hex.js';
import { RANKS as DIALOGUE_RANKS } from '../src/engine/rules/dialogue.js';
import { createItem, addItem, irradiate } from '../src/engine/rules/sheet.js';
import { emptyEquipment } from '../src/engine/rules/equipment.js';
import perks from '../src/content/savoir-faire.js';
import content from '../src/content/index.js';
import {
  RANKS,
  STAT_MAX,
  rankOf,
  gainXp,
  statPointsLeft,
  perkPicksLeft,
  hasPerk,
  stealthBonus,
} from '../src/engine/rules/progression.js';

const jsonCopy = (value) => JSON.parse(JSON.stringify(value));

// Gain d'XP sur un brouillon, comme le ferait une quête ou un contrat.
function withXp(campaign, n, cause = 'quete') {
  const draft = structuredClone(campaign);
  const events = [];
  gainXp(draft, n, cause, { emit: (event) => events.push(event) });
  return { draft, events };
}

const raise = (stat) => ({ type: 'raise-stat', stat });
const learn = (perk) => ({ type: 'learn-perk', perk });
const refusal = (result) => result.events[0].reason;

// Journée v1 sur une tuile tout en herbe, sans jeton ni rencontre, joueur au centre.
function day({ perks: known = [], terrain = {}, equipment } = {}) {
  const hexes = {};
  for (let n = 1; n <= 19; n++) hexes[n] = { terrain: terrain[n] ?? 'herbe' };
  const state = createGame({ seed: 1, tile: { name: 'Test', entry: 14, hexes } });
  state.player.hex = 1;
  state.player.perks = known;
  state.tokens = [];
  state.encounters = [];
  if (equipment) state.equipment = equipment;
  return state;
}

const hidden = (hex, kind = 'rien') => ({ hex, kind, revealed: false, original: true });

test('rangs du §11.1 : mêmes ids que dialogue.js, seuils 0/150/400/800/1400', () => {
  assert.deepEqual(RANKS.map((rank) => rank.id), [...DIALOGUE_RANKS]);
  assert.deepEqual(RANKS.map((rank) => rank.xp), [0, 150, 400, 800, 1400]);
  assert.equal(rankOf(0), 'bleu');
  assert.equal(rankOf(149), 'bleu');
  assert.equal(rankOf(150), 'experimente');
  assert.equal(rankOf(799), 'veteran');
  assert.equal(rankOf(5000), 'maitre');
});

test('12 savoir-faire au format perks, rangés dans le contenu', () => {
  assert.equal(Object.keys(perks).length, 12);
  assert.ok(Object.isFrozen(perks));
  for (const perk of Object.values(perks)) assert.deepEqual(Object.keys(perk), ['name', 'effect']);
  assert.equal(content.perks, perks);
});

test('gainXp ajoute l\'XP et annonce sa cause', () => {
  const { draft, events } = withXp(createCampaign({ seed: 1 }), 40, 'decouverte');
  assert.equal(draft.player.xp, 40);
  assert.equal(draft.player.rank, 'bleu');
  assert.deepEqual(events, [{ type: 'xp-gained', amount: 40, cause: 'decouverte', xp: 40 }]);
});

test('gainXp : passer un seuil monte de rang, +1 point de stat et 1 savoir-faire', () => {
  const campaign = createCampaign({ seed: 1 });
  assert.equal(statPointsLeft(campaign), 0);
  assert.equal(perkPicksLeft(campaign), 0);
  const { draft, events } = withXp(campaign, 150);
  assert.equal(draft.player.rank, 'experimente');
  assert.deepEqual(events[1], { type: 'rank-up', rank: 'experimente' });
  assert.equal(statPointsLeft(draft), 1);
  assert.equal(perkPicksLeft(draft), 1);
});

test('gainXp : un gros gain passe plusieurs rangs d\'un coup', () => {
  const { draft, events } = withXp(createCampaign({ seed: 1 }), 1400, 'contrat');
  assert.equal(draft.player.rank, 'maitre');
  assert.deepEqual(
    events.filter((e) => e.type === 'rank-up').map((e) => e.rank),
    ['experimente', 'veteran', 'expert', 'maitre'],
  );
  assert.equal(statPointsLeft(draft), 4);
  assert.equal(perkPicksLeft(draft), 4);
});

test('gainXp refuse un montant qui n\'est pas un entier positif (faute de contenu)', () => {
  const campaign = createCampaign({ seed: 1 });
  for (const n of [0, -5, 1.5, '10']) assert.throws(() => withXp(campaign, n));
});

test('raise-stat : refusé sans point, puis +1 à la stat choisie', () => {
  const campaign = createCampaign({ seed: 1 });
  assert.equal(refusal(step(campaign, raise('tir'))), 'no-stat-point');
  const { draft } = withXp(campaign, 150);
  assert.equal(refusal(step(draft, raise('chance'))), 'unknown-stat');

  const { state, events } = step(draft, raise('tir'));
  assert.equal(state.player.stats.tir, 2);
  assert.deepEqual(events, [{ type: 'stat-raised', stat: 'tir', value: 2 }]);
  assert.equal(statPointsLeft(state), 0);
  assert.equal(refusal(step(state, raise('survie'))), 'no-stat-point');
});

test('raise-stat : pas au-delà de 4', () => {
  const { draft } = withXp(createCampaign({ seed: 1 }), 1400);
  let campaign = draft;
  for (let i = 1; i < STAT_MAX; i++) campaign = step(campaign, raise('discretion')).state;
  assert.equal(campaign.player.stats.discretion, STAT_MAX);
  assert.equal(refusal(step(campaign, raise('discretion'))), 'stat-max');
});

test('raise-stat endurance : +1 PA tout de suite, max et restants', () => {
  const { draft } = withXp(createCampaign({ seed: 1 }), 150);
  const before = dayState(draft).ap;
  const { state } = step(draft, raise('endurance'));
  assert.equal(state.player.stats.endurance, 1);
  assert.equal(dayState(state).ap.max, before.max + 1);
  assert.equal(dayState(state).ap.left, before.left + 1);
});

test('learn-perk : refusé sans choix, savoir-faire inconnu ou déjà appris', () => {
  const campaign = createCampaign({ seed: 1 });
  assert.equal(refusal(step(campaign, learn('mule'))), 'no-perk-pick');
  const { draft } = withXp(campaign, 400);
  assert.equal(refusal(step(draft, learn('voler'))), 'unknown-perk');

  const { state, events } = step(draft, learn('mule'));
  assert.deepEqual(state.player.perks, ['mule']);
  assert.deepEqual(events, [{ type: 'perk-learned', perk: 'mule' }]);
  assert.equal(perkPicksLeft(state), 1);
  assert.equal(refusal(step(state, learn('mule'))), 'perk-known');
});

test('hasPerk lit la campagne et la journée prêtée par dayState', () => {
  const { draft } = withXp(createCampaign({ seed: 1 }), 150);
  const { state } = step(draft, learn('coriace'));
  assert.ok(hasPerk(state, 'coriace'));
  assert.ok(hasPerk(dayState(state), 'coriace'));
  assert.equal(hasPerk(state, 'mule'), false);
  assert.equal(hasPerk(createGame({ seed: 1, tile: content.tiles.agroprom }), 'mule'), false);
});

test('la campagne reste sérialisable et les savoir-faire ne fuient pas dans la tuile', () => {
  const { draft } = withXp(createCampaign({ seed: 1 }), 150);
  const { state } = step(draft, learn('pied-leger'));
  assert.deepEqual(jsonCopy(state), state);
  const moved = step(state, { type: 'move', to: 15 }).state;
  assert.equal(moved.world.tiles.agroprom.player.perks, undefined);
  assert.deepEqual(moved.player.perks, ['pied-leger']);
});

test('Pied léger : la forêt coûte 1 PA', () => {
  const plain = stepGame(day({ terrain: { 2: 'foret' } }), { type: 'move', to: 2 });
  assert.equal(plain.events[0].cost, 2);
  const light = stepGame(day({ perks: ['pied-leger'], terrain: { 2: 'foret', 3: 'marais' } }), { type: 'move', to: 2 });
  assert.equal(light.events[0].cost, 1);
  const swamp = stepGame(day({ perks: ['pied-leger'], terrain: { 3: 'marais' } }), { type: 'move', to: 3 });
  assert.equal(swamp.events[0].cost, 3);
});

test('Bouliste : le boulon révèle aussi l\'hexagone suivant en ligne', () => {
  // Du centre (1) vers 3 (est), l'hexagone suivant en ligne est 10.
  const beyond = toNumber({ q: toAxial(3).q * 2, r: toAxial(3).r * 2 });
  const plain = day();
  plain.tokens = [hidden(3), hidden(beyond, 'artefact')];
  const thrown = stepGame(plain, { type: 'bolt', target: 3 });
  assert.deepEqual(thrown.events.filter((e) => e.type === 'token-revealed').map((e) => e.hex), [3]);

  const bouliste = day({ perks: ['bouliste'] });
  bouliste.tokens = [hidden(3), hidden(beyond, 'artefact')];
  const { events } = stepGame(bouliste, { type: 'bolt', target: 3 });
  assert.deepEqual(events.filter((e) => e.type === 'token-revealed').map((e) => e.hex), [3, beyond]);
});

test('Bouliste : rien à révéler au-delà du bord de la tuile', () => {
  const state = day({ perks: ['bouliste'] });
  state.player.hex = 3;
  state.tokens = [hidden(10)];
  const { events } = stepGame(state, { type: 'bolt', target: 10 });
  assert.deepEqual(events.filter((e) => e.type === 'token-revealed').map((e) => e.hex), [10]);
});

test('Œil de lynx : détecteur +1 de portée (v1 et détecteur porté)', () => {
  const scan = (state, hex) => {
    state.tokens = [hidden(hex, 'artefact')];
    return stepGame(state, { type: 'move', to: 2 }).events.some((e) => e.by === 'detector');
  };
  // Depuis 2, l'hexagone 12 est à 3 pas, l'hexagone 4 à 2.
  assert.equal(scan(day(), 12), false);
  assert.equal(scan(day({ perks: ['oeil-de-lynx'] }), 12), true);
  const echo = { ...emptyEquipment(), detector: createItem('echo') };
  assert.equal(scan(day({ equipment: echo }), 4), false);
  assert.equal(scan(day({ perks: ['oeil-de-lynx'], equipment: echo }), 4), true);
  // Sans détecteur porté, le savoir-faire ne détecte rien.
  assert.equal(scan(day({ perks: ['oeil-de-lynx'], equipment: emptyEquipment() }), 3), false);
});

test('Coriace : la mort vient à 7 blessures', () => {
  const wound = (state, n) => {
    state.player.wounds = n - 1;
    state.player.stats.survie = -10;
    state.tokens = [{ hex: 2, kind: 'anomalie', anomaly: 'bruleuse', revealed: false, original: true }];
    return stepGame(state, { type: 'move', to: 2 }).state;
  };
  // La brûleuse fait 2 blessures : de 4 à 6, puis de 5 à 7.
  assert.equal(wound(day(), 5).status, 'dead');
  const tough = wound(day({ perks: ['coriace'] }), 5);
  assert.equal(tough.status, 'playing');
  assert.equal(tough.player.wounds, 6);
  const dead = wound(day({ perks: ['coriace'] }), 6);
  assert.equal(dead.status, 'dead');
  assert.equal(dead.player.wounds, 7);
});

test('Peau dure : -1 radiation à chaque gain, après l\'armure', () => {
  const gain = (perks, amount) => {
    const state = day({ perks });
    const events = [];
    irradiate(state, amount, 'test', (event) => events.push(event));
    return { radiation: state.player.radiation, event: events[0] };
  };
  assert.equal(gain([], 2).radiation, 2);
  const { radiation, event } = gain(['peau-dure'], 2);
  assert.equal(radiation, 1);
  assert.deepEqual(event, { type: 'irradiated', amount: 1, cause: 'test', blocked: 1 });
  assert.equal(gain(['peau-dure'], 1).radiation, 0);
});

test('Tireur : +1 Tir avec un fusil, rien au pistolet', () => {
  const fightWith = (perks, primary) => {
    const equipment = { ...emptyEquipment(), primary: primary && createItem(primary), sidearm: createItem('pistolet') };
    const state = day({ perks, equipment });
    state.inventory.push(createItem('munitions-545'));
    state.combat = { hex: 1, card: 'bandits' };
    return stepGame(state, { type: 'fight' }).events.find((e) => e.type === 'fight');
  };
  assert.equal(fightWith([], 'fusil-assaut').tir, 1);
  assert.equal(fightWith(['tireur'], 'fusil-assaut').tir, 2);
  assert.equal(fightWith(['tireur'], null).tir, 1);
});

test('Infirmier : un bandage soigne 2 blessures', () => {
  const heal = (perks) => {
    const state = day({ perks });
    state.player.wounds = 3;
    return stepGame(state, { type: 'use', item: 'bandage' });
  };
  assert.equal(heal([]).state.player.wounds, 2);
  const { state, events } = heal(['infirmier']);
  assert.equal(state.player.wounds, 1);
  assert.equal(events[0].wounds, -2);
});

test('Mule : la journée de campagne voit les 15 cases', () => {
  const { draft } = withXp(createCampaign({ seed: 1 }), 150);
  const { state } = step(draft, learn('mule'));
  const full = dayState(state);
  while (addItem(full, createItem('bandage')));
  assert.equal(full.inventory.reduce((total, item) => total + item.size, 0), 15);
});

test('Fantôme : +1 Discrétion la nuit ou sous la pluie, exposé pour la carte 7', () => {
  const ghost = { player: { perks: ['fantome'] } };
  assert.equal(stealthBonus(ghost, { night: false, rain: false }), 0);
  assert.equal(stealthBonus(ghost, { night: true, rain: false }), 1);
  assert.equal(stealthBonus(ghost, { night: false, rain: true }), 1);
  assert.equal(stealthBonus(ghost, { night: true, rain: true }), 1);
  assert.equal(stealthBonus({ player: { perks: [] } }, { night: true }), 0);
});
