import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createCampaign, step, dayState, CAMPAIGN_ACTIONS, REACTIONS } from '../src/engine/campaign.js';
import {
  sleep, camp, wake, endDayOnExhaustion, newDay, weatherOf, conditionsBonus, detectorModifier,
  DAY_HOOK_ORDER, BED_PRICE, OPEN_AIR_MALUS, HUNGER_MALUS,
} from '../src/engine/rules/time.js';
import { createGame, step as stepDay, skillCheck, BASE_AP } from '../src/engine/game.js';
import { createRng } from '../src/engine/rng.js';
import { createItem } from '../src/engine/rules/sheet.js';
import { neighbors } from '../src/engine/hex.js';
import { suspectsOnEnter } from '../src/engine/rules/suspects.js';
import content from '../src/content/index.js';
import agroprom from '../src/engine/data/agroprom.js';

const jsonCopy = (value) => JSON.parse(JSON.stringify(value));
const types = (events) => events.map((event) => event.type);

// Campagne au Cordon posée sur un hexagone, la journée v1 en cours.
function standOn(hex, { seed = 1 } = {}) {
  const campaign = jsonCopy(createCampaign({ seed }));
  campaign.world.hex = hex;
  return campaign;
}

const CAMP_NOVICES = content.places['camp-novices'];
const BASE_CIEL_PUR = content.places['base-ciel-pur'];
// Cordon : 18 est la Ferme (abri), 13 l'Avant-poste (pas d'abri).
const SHELTER_HEX = 18;
const OPEN_HEX = 13;

function onMarais(hex) {
  const campaign = jsonCopy(createCampaign({ seed: 1, tile: 'marais' }));
  campaign.world.hex = hex;
  return campaign;
}

// Bivouac puis réveil : rend la campagne au matin et les événements de la nuit et du réveil.
function campAndWake(campaign) {
  const night = step(campaign, { type: 'camp' }).state;
  return step(night, { type: 'wake' });
}

// Première graine dont la nuit pioche une carte du type voulu (la pioche dépend du RNG).
function campaignDrawing(type, hex, stealth, { tile = 'cordon', perks = [] } = {}) {
  const deck = content.decks[`nuit-${tile}`].cards;
  for (let seed = 1; seed < 500; seed++) {
    const campaign = jsonCopy(createCampaign({ seed, tile }));
    campaign.world.hex = hex;
    campaign.player.stats.discretion = stealth;
    campaign.player.perks = perks;
    const night = step(campaign, { type: 'camp' }).state;
    const result = step(night, { type: 'wake' });
    const card = result.events.find((event) => event.type === 'night-card')?.card;
    if (deck.find((c) => c.id === card)?.type === type) return { campaign, night, result };
  }
  throw new Error(`aucune graine ne pioche ${type}`);
}

// §4.1 La journée

test('sleep, camp et wake sont des actions de campagne ; la fin de journée forcée est une réaction', () => {
  assert.equal(CAMPAIGN_ACTIONS.sleep, sleep);
  assert.equal(CAMPAIGN_ACTIONS.camp, camp);
  assert.equal(CAMPAIGN_ACTIONS.wake, wake);
  assert.ok(REACTIONS.includes(endDayOnExhaustion));
});

test('camp finit la journée : PA restants perdus, écran nuit', () => {
  const { state, events } = step(standOn(SHELTER_HEX), { type: 'camp' });
  assert.deepEqual(events, [{ type: 'day-ended', reason: 'camp', rest: 'abri' }]);
  assert.equal(state.screen, 'night');
  assert.equal(dayState(state).ap.left, 0);
  assert.equal(dayState(state).status, 'night');
  assert.deepEqual(state.night, { rest: 'abri', cardDrawn: false });
});

test('0 PA : bivouac forcé là où l\'on est, sans défaite par la nuit', () => {
  const campaign = standOn(SHELTER_HEX);
  campaign.world.tiles.cordon.ap.left = 1;
  const { state, events } = step(campaign, { type: 'use', item: 'bandage' });
  assert.equal(dayState(state).ap.left, 0);
  assert.equal(dayState(state).status, 'night');
  assert.equal(state.screen, 'night');
  assert.deepEqual(state.night, { rest: 'abri', cardDrawn: false });
  assert.ok(events.some((event) => event.type === 'day-ended' && event.reason === 'no-ap'));
  assert.ok(!events.some((event) => event.type === 'game-over'));
  assert.equal(state.world.tiles.cordon.outcome, null);
  assert.equal(step(state, { type: 'wake' }).state.day, 2);
});

test('le voyage qui dépense le dernier PA mène au bivouac forcé à l\'arrivée', () => {
  const start = standOn(19);
  start.world.tiles.cordon.ap.left = 1;
  const { state } = step(start, { type: 'travel' });
  assert.equal(state.world.currentTile, 'decharge');
  assert.equal(state.screen, 'night');
});

test('pendant la nuit, seules wake et les actions de combat passent', () => {
  const night = step(standOn(SHELTER_HEX), { type: 'camp' }).state;
  for (const action of [{ type: 'move', to: 17 }, { type: 'camp' }, { type: 'travel' }, { type: 'equip', item: 'pistolet' }]) {
    const { state, events } = step(night, action);
    assert.equal(state, night);
    assert.equal(events[0].reason, 'night');
  }
  assert.equal(step(standOn(SHELTER_HEX), { type: 'wake' }).events[0].reason, 'not-night');
});

test('camp refusé en combat', () => {
  const fighting = standOn(SHELTER_HEX);
  fighting.world.tiles.cordon.combat = { hex: 17, card: 'pillard' };
  assert.equal(step(fighting, { type: 'camp' }).events[0].reason, 'in-combat');
});

// §4.3 Dormir

test('lit du hub de sa faction : gratuit, -1 blessure, journée suivante à 10 PA', () => {
  const campaign = standOn(CAMP_NOVICES.hex);
  campaign.player.wounds = 2;
  const { state, events } = step(campaign, { type: 'sleep' });
  assert.deepEqual(events, [{ type: 'day-ended', reason: 'sleep', rest: 'lit', place: 'camp-novices', cost: 0, healed: 1 }]);
  assert.equal(state.player.roubles, campaign.player.roubles);
  assert.equal(state.player.wounds, 1);
  assert.equal(state.screen, 'night');

  const morning = step(state, { type: 'wake' });
  assert.ok(!morning.events.some((event) => event.type === 'night-card'));
  assert.equal(dayState(morning.state).ap.max, BASE_AP + campaign.player.stats.endurance);
});

test('lit d\'un autre hub : 50 roubles, refusé sans l\'argent ; pas de lit hors d\'un hub', () => {
  assert.equal(BED_PRICE, 50);
  const poor = onMarais(BASE_CIEL_PUR.hex);
  assert.equal(step(poor, { type: 'sleep' }).events[0].reason, 'not-enough-roubles');
  const rich = onMarais(BASE_CIEL_PUR.hex);
  rich.player.roubles = 80;
  const { state, events } = step(rich, { type: 'sleep' });
  assert.equal(events[0].cost, 50);
  assert.equal(state.player.roubles, 30);
  assert.equal(step(standOn(SHELTER_HEX), { type: 'sleep' }).events[0].reason, 'no-bed');
});

test('écran hub : le lit se prend aussi depuis l\'écran du hub', () => {
  const campaign = standOn(CAMP_NOVICES.hex);
  campaign.screen = 'hub';
  assert.equal(step(campaign, { type: 'sleep' }).events[0].place, 'camp-novices');
});

test('bivouac dans un abri : carte Nuit du paquet de la tuile, pas de soin, pas de test', () => {
  const campaign = standOn(SHELTER_HEX);
  campaign.player.wounds = 2;
  campaign.player.stats.discretion = 10;
  const { state, events } = campAndWake(campaign);
  const card = events.find((event) => event.type === 'night-card');
  assert.equal(card.deck, 'nuit-cordon');
  assert.ok(content.decks['nuit-cordon'].cards.some((c) => c.id === card.card));
  assert.ok(!events.some((event) => event.type === 'check'));
  assert.ok(state.player.wounds >= 2);
});

test('bivouac à découvert : test de Discrétion, échec = rencontre de nuit en combat', () => {
  const { result } = campaignDrawing('calme', OPEN_HEX, -10);
  const { state, events } = result;
  assert.ok(events.some((event) => event.type === 'check' && event.stat === 'discretion' && !event.success));
  assert.ok(events.some((event) => event.type === 'night-encounter'));
  assert.equal(state.screen, 'combat');
  assert.equal(state.combat.previousScreen, 'night');
  assert.equal(state.day, 1, 'le jour ne passe qu\'après le combat');
});

test('bivouac à découvert réussi : pas de rencontre, lendemain à -2 PA', () => {
  assert.equal(OPEN_AIR_MALUS, 2);
  const { result } = campaignDrawing('calme', OPEN_HEX, 10);
  const { state, events } = result;
  assert.ok(!events.some((event) => event.type === 'night-encounter'));
  assert.equal(state.day, 2);
  assert.equal(dayState(state).ap.max, BASE_AP + state.player.stats.endurance - OPEN_AIR_MALUS);
});

test('carte Nuit rencontre : combat sans test de Discrétion, même dans un abri', () => {
  const { result } = campaignDrawing('rencontre', SHELTER_HEX, 10);
  assert.ok(!result.events.some((event) => event.type === 'check'));
  assert.equal(result.state.screen, 'combat');
});

test('cartes Nuit radiations et blessure', () => {
  const vent = campaignDrawing('radiations', SHELTER_HEX, 10).result.events;
  assert.ok(vent.some((event) => event.type === 'irradiated' && event.cause === 'nuit'));
  const marais = content.places['station-pompage'];
  const { campaign, result } = campaignDrawing('blessure', marais.hex, 10, { tile: 'marais' });
  assert.ok(result.events.some((event) => event.type === 'wounded' && event.cause === 'nuit'));
  assert.equal(result.state.player.wounds, campaign.player.wounds + 1);
});

test('après le combat de nuit, retour à l\'écran nuit puis wake lance la journée', () => {
  const { result } = campaignDrawing('calme', OPEN_HEX, -10);
  const fighting = jsonCopy(result.state);
  for (const enemy of fighting.combat.enemies) enemy.hp = 0;
  fighting.combat.enemies[0].hp = 1;
  fighting.player.stats.tir = 20;
  const won = step(fighting, { type: 'shoot' });
  assert.equal(won.state.screen, 'night');
  assert.ok(!won.events.some((event) => event.type === 'day-ended'), 'pas de seconde fin de journée');
  const morning = step(won.state, { type: 'wake' });
  assert.equal(morning.state.day, 2);
  assert.equal(morning.state.screen, 'tile');
  assert.ok(!morning.events.some((event) => event.type === 'night-card'), 'la carte Nuit est déjà tirée');
});

test('mort pendant la nuit : wake refusé', () => {
  const night = step(standOn(SHELTER_HEX), { type: 'camp' }).state;
  night.world.tiles.cordon.status = 'dead';
  assert.equal(step(night, { type: 'wake' }).events[0].reason, 'game-over');
});

// §4.2 Le calendrier et la météo

test('nouveau jour : jour + 1, carte Météo du matin, écran tuile, événements dans l\'ordre', () => {
  const { state, events } = campAndWake(standOn(SHELTER_HEX));
  assert.equal(state.day, 2);
  assert.equal(state.screen, 'tile');
  assert.equal(state.night, undefined);
  const weather = events.find((event) => event.type === 'weather');
  assert.ok(['calme', 'brouillard', 'pluie'].includes(weather.card));
  assert.equal(state.world.weather, weather.card);
  const order = types(events).filter((type) => ['night-card', 'weather', 'meal', 'hunger', 'day-started'].includes(type));
  assert.deepEqual(order, ['night-card', 'weather', 'meal', 'day-started']);
  assert.deepEqual(events.at(-1), { type: 'day-started', day: 2, ap: dayState(state).ap.max, weather: weather.card });
  assert.equal(dayState(state).status, 'playing');
});

test('signes d\'Émission : la carte sort le matin du calendrier (hook carte 8)', () => {
  const night = step(standOn(SHELTER_HEX), { type: 'camp' }).state;
  night.world.emission.nextDay = 2;
  const { events } = step(night, { type: 'wake' });
  assert.equal(events.find((event) => event.type === 'weather').card, 'signes-emission');
});

test('la pioche Météo ne sort jamais les signes d\'Émission hors calendrier', () => {
  const seen = new Set();
  for (let seed = 1; seed < 80; seed++) {
    const { state } = campAndWake(standOn(SHELTER_HEX, { seed }));
    if (!state.combat) seen.add(state.world.weather);
  }
  assert.deepEqual([...seen].sort(), ['brouillard', 'calme', 'pluie']);
});

test('pluie : Discrétion +1 et détecteur -1', () => {
  const day = dayState(standOn(SHELTER_HEX));
  day.weather = 'pluie';
  assert.equal(weatherOf(day).id, 'pluie');
  assert.equal(conditionsBonus(day, 'discretion'), 1);
  assert.equal(conditionsBonus(day, 'tir'), 0);
  assert.equal(detectorModifier(day), -1);
  const events = [];
  skillCheck(day, 'discretion', 0, { rng: createRng(1), emit: (event) => events.push(event) });
  assert.equal(events[0].bonus, day.player.stats.discretion + 1);
  day.weather = 'calme';
  assert.equal(conditionsBonus(day, 'discretion'), 0);
  assert.equal(detectorModifier(day), 0);
});

test('pluie : le détecteur porte un hexagone de moins', () => {
  // Écho (portée 1) : un artefact voisin est vu par temps calme, pas sous la pluie.
  const day = dayState(standOn(SHELTER_HEX));
  const near = neighbors(day.player.hex).find((n) => day.tile.hexes[n]);
  day.tokens = [{ hex: near, kind: 'artefact', revealed: false, original: true }];
  const scan = (weather) => {
    const draft = { ...structuredClone(day), weather };
    const events = [];
    suspectsOnEnter(draft, { rng: createRng(1), emit: (event) => events.push(event) });
    return events.some((event) => event.type === 'token-revealed' && event.by === 'detector');
  };
  assert.equal(content.items.echo.detector.range, 1);
  assert.equal(scan('calme'), true);
  assert.equal(scan('pluie'), false);
});

test('Fantôme : +1 Discrétion la nuit et sous la pluie, pas de cumul', () => {
  const day = dayState(standOn(SHELTER_HEX));
  day.player.perks = ['fantome'];
  assert.equal(conditionsBonus(day, 'discretion'), 0);
  day.isNight = true;
  assert.equal(conditionsBonus(day, 'discretion'), 1);
  day.weather = 'pluie';
  assert.equal(conditionsBonus(day, 'discretion'), 2, 'pluie +1, Fantôme +1');
  day.isNight = false;
  assert.equal(conditionsBonus(day, 'discretion'), 2);
});

test('Fantôme compte au test de Discrétion du bivouac à découvert', () => {
  const { campaign, result } = campaignDrawing('calme', OPEN_HEX, 1, { perks: ['fantome'] });
  const check = result.events.find((event) => event.type === 'check');
  assert.equal(check.bonus, campaign.player.stats.discretion + 1);
});

test('la journée v1 n\'a ni météo ni nuit : aucun bonus', () => {
  const v1 = createGame({ seed: 1, tile: agroprom });
  assert.equal(weatherOf(v1), null);
  assert.equal(conditionsBonus(v1, 'discretion'), 0);
  assert.equal(detectorModifier(v1), 0);
});

// §4.4 Faim

test('repas au réveil : une ration est mangée, la faim retombe à 0', () => {
  const campaign = standOn(SHELTER_HEX);
  campaign.player.hunger = 1;
  const rations = campaign.inventory.filter((item) => item.kind === 'ration').length;
  const { state, events } = campAndWake(campaign);
  assert.deepEqual(events.find((event) => event.type === 'meal'), { type: 'meal', item: 'ration' });
  assert.equal(state.player.hunger, 0);
  assert.equal(state.inventory.filter((item) => item.kind === 'ration').length, rations - 1);
});

test('repas : tout objet de catégorie nourriture convient', () => {
  const campaign = standOn(SHELTER_HEX);
  campaign.inventory = campaign.inventory.filter((item) => item.kind !== 'ration');
  campaign.inventory.push(createItem('saucisson'));
  const { events } = campAndWake(campaign);
  assert.equal(events.find((event) => event.type === 'meal').item, 'saucisson');
});

test('un jour sans manger : -2 PA', () => {
  assert.equal(HUNGER_MALUS, 2);
  const campaign = standOn(SHELTER_HEX);
  campaign.inventory = campaign.inventory.filter((item) => item.kind !== 'ration');
  const { state, events } = campAndWake(campaign);
  assert.deepEqual(events.find((event) => event.type === 'hunger'), { type: 'hunger', days: 1, ap: -2, wounds: 0 });
  assert.equal(state.player.hunger, 1);
  assert.equal(dayState(state).ap.max, BASE_AP + state.player.stats.endurance - HUNGER_MALUS);
  assert.equal(state.player.wounds, campaign.player.wounds);
});

test('deux jours de suite sans manger : -2 PA et 1 blessure', () => {
  const campaign = standOn(SHELTER_HEX);
  campaign.inventory = campaign.inventory.filter((item) => item.kind !== 'ration');
  campaign.player.hunger = 1;
  const { state, events } = campAndWake(campaign);
  assert.deepEqual(events.find((event) => event.type === 'hunger'), { type: 'hunger', days: 2, ap: -2, wounds: 1 });
  assert.ok(events.some((event) => event.type === 'wounded' && event.cause === 'faim'));
  assert.equal(state.player.wounds, campaign.player.wounds + 1);
});

// Budget de PA du matin

test('budget : 10 + Endurance + PA de ceinture, coût de ceinture en radiations', () => {
  const campaign = standOn(SHELTER_HEX);
  campaign.player.stats.endurance = 2;
  campaign.equipment.belt = [createItem('flamme')];
  const { state, events } = campAndWake(campaign);
  assert.equal(dayState(state).ap.max, BASE_AP + 2 + 1);
  assert.equal(dayState(state).ap.left, dayState(state).ap.max);
  assert.equal(dayState(state).ap.spent, 0);
  assert.ok(events.some((event) => event.type === 'irradiated' && event.cause === 'ceinture' && event.amount === 1));
});

test('budget : -1 PA à 4 blessures ou plus (v1), une seule fois', () => {
  const campaign = standOn(SHELTER_HEX);
  campaign.player.wounds = 4;
  const { state } = campAndWake(campaign);
  assert.equal(dayState(state).ap.max, BASE_AP + state.player.stats.endurance - 1);
  assert.equal(dayState(state).player.woundPenalty, true);
});

test('nouveau jour : boisson énergétique de nouveau permise, paquet Zone remélangé', () => {
  const campaign = standOn(SHELTER_HEX);
  const tile = campaign.world.tiles.cordon;
  tile.ap.boosted = true;
  tile.zone.deck = [];
  tile.zone.emissionPassed = true;
  const { state } = campAndWake(campaign);
  const day = dayState(state);
  assert.equal(day.ap.boosted, undefined);
  assert.equal(day.zone.deck.length, createCampaign({ seed: 1 }).world.tiles.cordon.zone.deck.length);
  assert.ok(day.zone.deck.includes('emission'));
  assert.equal(day.zone.emissionPassed, false);
});

// Hooks de changement de jour

test('hooks de changement de jour dans l\'ordre documenté, avant la Météo', () => {
  assert.deepEqual(DAY_HOOK_ORDER, ['npcs', 'traders', 'emission', 'quests']);
  const calls = [];
  const hook = (name) => (draft, ctx) => {
    calls.push([name, draft.day]);
    ctx.emit({ type: `hook-${name}` });
  };
  const hooks = Object.fromEntries(DAY_HOOK_ORDER.map((name) => [name, [hook(name)]]));
  hooks.emission.push((draft) => { draft.world.emission.nextDay = draft.day; });
  const draft = step(standOn(SHELTER_HEX), { type: 'camp' }).state;
  draft.night.cardDrawn = true;
  const events = [];
  newDay(draft, { rng: createRng(7), emit: (event) => events.push(event) }, hooks);
  assert.deepEqual(calls, DAY_HOOK_ORDER.map((name) => [name, 2]));
  assert.deepEqual(types(events).slice(0, 5), ['hook-npcs', 'hook-traders', 'hook-emission', 'hook-quests', 'weather']);
  assert.equal(events.find((event) => event.type === 'weather').card, 'signes-emission');
});

// Contrats du moteur

test('la nuit et le réveil restent purs et sérialisables', () => {
  const campaign = standOn(SHELTER_HEX);
  const frozen = jsonCopy(campaign);
  const night = step(campaign, { type: 'camp' }).state;
  assert.deepEqual(campaign, frozen);
  assert.deepEqual(jsonCopy(night), night);
  const morning = step(jsonCopy(night), { type: 'wake' });
  assert.deepEqual(step(night, { type: 'wake' }), morning);
  assert.deepEqual(jsonCopy(morning.state), morning.state);
});

test('la v1 garde sa défaite par la nuit', () => {
  const state = createGame({ seed: 1, tile: agroprom });
  state.ap.left = 1;
  const { state: night, events } = stepDay(state, { type: 'use', item: 'bandage' });
  assert.equal(night.status, 'night');
  assert.ok(events.some((event) => event.type === 'game-over' && event.outcome.cause === 'night'));
});
