import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createCampaign, step } from '../src/engine/campaign.js';
import { OPEN_AIR_MALUS } from '../src/engine/rules/time.js';
import content from '../src/content/index.js';
import {
  parseSeed, titleSlots, campPreview, nightView, wakeReport, daySummary, endingView, isEnding,
  returnReminder, RETURN_REMINDER_AP,
} from '../src/ui/cycle.js';
import { neighbors } from '../src/engine/hex.js';

const jsonCopy = (value) => JSON.parse(JSON.stringify(value));

function standOn(hex) {
  const campaign = jsonCopy(createCampaign({ seed: 1 }));
  campaign.world.hex = hex;
  return campaign;
}

// Cordon : 18 est la Ferme (abri), 13 l'Avant-poste (pas d'abri).
const SHELTER_HEX = 18;
const OPEN_HEX = 13;

test('parseSeed : entier positif sur 32 bits, sinon null', () => {
  assert.equal(parseSeed('42'), 42);
  assert.equal(parseSeed(' 7 '), 7);
  assert.equal(parseSeed(''), null);
  assert.equal(parseSeed('abc'), null);
  assert.equal(parseSeed('-3'), null);
  assert.equal(parseSeed('4294967296'), null);
});

test('titleSlots : Continuer puis les 3 emplacements, vides compris', () => {
  const rows = titleSlots([
    { slot: 'auto', day: 4, mode: 'hardcore', seed: 12, savedAt: '2026-11-12T14:36:00.000Z' },
    { slot: 2, error: 'sauvegarde illisible' },
  ]);
  assert.deepEqual(rows.map((row) => row.slot), ['auto', 1, 2, 3]);
  assert.deepEqual(rows[0], {
    slot: 'auto', label: 'Continuer', detail: 'Jour 4 · hardcore · graine 12 · 2026-11-12 14:36', empty: false, error: false,
  });
  assert.equal(rows[1].label, 'Emplacement 1');
  assert.equal(rows[1].empty, true);
  assert.equal(rows[2].error, true);
  assert.equal(rows[2].detail, 'sauvegarde illisible');
});

test('campPreview : abri sans malus, découvert avec le malus du lendemain', () => {
  assert.deepEqual(campPreview(standOn(SHELTER_HEX)), { rest: 'abri', label: 'Abri', malus: 0, apLost: 10 });
  const open = campPreview(standOn(OPEN_HEX));
  assert.equal(open.rest, 'decouvert');
  assert.equal(open.malus, OPEN_AIR_MALUS);
});

test('nightView : null de jour, le repos et le lieu la nuit', () => {
  const campaign = standOn(SHELTER_HEX);
  assert.equal(nightView(campaign), null);
  const { state } = step(campaign, { type: 'camp' });
  assert.deepEqual(nightView(state), { rest: 'abri', label: 'Bivouac dans un abri', place: null, cardDrawn: false });
});

test('nightView : au lit d’un hub, le nom du hub', () => {
  const campaign = standOn(content.places['camp-novices'].hex);
  const { state } = step(campaign, { type: 'sleep' });
  assert.deepEqual(nightView(state), { rest: 'lit', label: 'Lit du hub', place: 'Camp des novices', cardDrawn: true });
});

test('nightView : null pendant un combat de nuit', () => {
  const campaign = standOn(SHELTER_HEX);
  const { state } = step(campaign, { type: 'camp' });
  assert.equal(nightView({ ...state, combat: { round: 1 } }), null);
});

test('wakeReport : carte Nuit, Météo, repas et budget du jour', () => {
  const report = wakeReport([
    { type: 'night-card', deck: 'nuit-cordon', card: 'vent-radioactif' },
    { type: 'irradiated', amount: 1, cause: 'nuit' },
    { type: 'weather', card: 'pluie' },
    { type: 'meal', item: 'ration' },
    { type: 'day-started', day: 3, ap: 9, weather: 'pluie' },
  ]);
  assert.deepEqual(report, {
    day: 3,
    ap: 9,
    apChanges: [],
    night: 'Vent radioactif',
    weather: 'Pluie : Discrétion +1, détecteur −1',
    meal: 'Ration',
    hunger: null,
    fight: null,
    wounds: 0,
    radiation: 1,
  });
});

test('wakeReport : faim, rencontre, et null sans day-started', () => {
  assert.equal(wakeReport([{ type: 'night-card', card: 'rodeurs' }, { type: 'night-encounter', card: 'x' }]), null);
  const report = wakeReport([
    { type: 'weather', card: 'calme' },
    { type: 'hunger', days: 2, ap: -2, wounds: 1 },
    { type: 'wounded', amount: 1, cause: 'faim' },
    { type: 'day-started', day: 5, ap: 6, weather: 'calme' },
  ]);
  assert.equal(report.night, null);
  assert.equal(report.meal, null);
  assert.equal(report.hunger, 2);
  assert.equal(report.wounds, 1);
});

test('wakeReport : la nuit seule (après day-ended), combat de nuit compris', () => {
  const report = wakeReport([
    { type: 'wounded', amount: 2, cause: 'combat' },
    { type: 'day-ended', reason: 'camp', rest: 'decouvert' },
    { type: 'night-card', deck: 'nuit-cordon', card: 'rodeurs' },
    { type: 'night-encounter', card: 'chair' },
    { type: 'wounded', amount: 3, cause: 'combat' },
    { type: 'combat-ended', outcome: 'victory' },
    { type: 'weather', card: 'calme' },
    { type: 'meal', item: 'ration' },
    { type: 'day-started', day: 2, ap: 7, weather: 'calme' },
  ]);
  assert.equal(report.night, 'Rôdeurs');
  assert.equal(report.fight, 'Victoire');
  assert.equal(report.wounds, 3);
});

test('wakeReport : chaque PA en moins a sa cause', () => {
  const campaign = jsonCopy(createCampaign({ seed: 1 }));
  campaign.player.wounds = 4;
  const events = [
    { type: 'weather', card: 'calme' },
    { type: 'hunger', days: 1, ap: -2, wounds: 0 },
    { type: 'day-started', day: 2, ap: 5, weather: 'calme' },
  ];
  assert.deepEqual(wakeReport(events, { campaign, rest: 'decouvert' }).apChanges, [
    { amount: -2, label: 'faim : rien à manger au réveil' },
    { amount: -OPEN_AIR_MALUS, label: 'nuit à découvert' },
    { amount: -1, label: '4 blessures ou plus' },
  ]);
  assert.deepEqual(wakeReport(events, { campaign, rest: 'abri' }).apChanges.map((c) => c.amount), [-2, -1]);
});

test('wakeReport : une blessure de faim posée après le budget ne coûte pas de PA ce jour-là', () => {
  const campaign = jsonCopy(createCampaign({ seed: 1 }));
  campaign.player.wounds = 4;
  campaign.player.stats.endurance = 1;
  const report = wakeReport([
    { type: 'weather', card: 'calme' },
    { type: 'hunger', days: 2, ap: -2, wounds: 1 },
    { type: 'wounded', amount: 1, cause: 'faim' },
    { type: 'day-started', day: 3, ap: 9, weather: 'calme' },
  ], { campaign, rest: 'lit' });
  assert.deepEqual(report.apChanges, [
    { amount: 1, label: 'Endurance' },
    { amount: -2, label: 'faim : rien à manger au réveil' },
  ]);
});

function withAp(hex, left) {
  const campaign = standOn(hex);
  campaign.world.tiles.cordon.ap.left = left;
  return campaign;
}

// Cordon : le Camp des novices (lit) est sur l'hexagone 5.
test('returnReminder : rien avec plus de PA que le seuil, ni à portée du hub', () => {
  assert.equal(returnReminder(withAp(SHELTER_HEX, RETURN_REMINDER_AP + 1)), null);
  assert.equal(returnReminder(withAp(5, 1)), null);
  assert.equal(returnReminder(withAp(neighbors(5)[0], 1)), null);
});

test('returnReminder : le hub hors de portée, avec son coût en PA', () => {
  const reminder = returnReminder(withAp(SHELTER_HEX, 1));
  assert.equal(reminder.hub, 'Camp des novices');
  assert.ok(reminder.cost > 1);
  assert.equal(reminder.text, `Le hub est à ${reminder.cost} PA (Camp des novices) : le lit soigne et évite la carte Nuit.`);
  const night = step(withAp(SHELTER_HEX, 1), { type: 'camp' }).state;
  assert.equal(returnReminder(night), null);
});

test('daySummary : le résumé de la veille', () => {
  const summary = daySummary([
    { type: 'moved', from: 1, to: 2, cost: 1 },
    { type: 'moved', from: 2, to: 3, cost: 2 },
    { type: 'traveled', from: { tile: 'cordon' }, to: { tile: 'decharge' }, cost: 1 },
    { type: 'roubles-changed', amount: 300, roubles: 300 },
    { type: 'roubles-changed', amount: -50, roubles: 250 },
    { type: 'xp-gained', amount: 20, cause: 'combat', xp: 20 },
    { type: 'wounded', amount: 2, cause: 'combat' },
    { type: 'irradiated', amount: 1, cause: 'anomalie' },
    { type: 'item-gained', kind: 'bandage', cause: 'quete' },
    { type: 'artefact-picked', hex: 4, value: 500 },
    { type: 'quest-completed', quest: 'dette-bohdan' },
    { type: 'combat-ended', outcome: 'victory' },
    { type: 'combat-ended', outcome: 'fled' },
  ]);
  assert.deepEqual(summary, {
    moves: 2,
    tiles: ['Décharge'],
    roubles: 250,
    xp: 20,
    wounds: 2,
    radiation: 1,
    items: ['Bandage', 'Artefact'],
    victories: 1,
    quests: [content.quests['dette-bohdan'].name],
  });
});

test('isEnding / endingView : fin de campagne quand Le Guide est fini', () => {
  const campaign = jsonCopy(createCampaign({ seed: 1 }));
  assert.equal(isEnding(campaign), false);
  assert.equal(endingView(campaign), null);

  campaign.day = 23;
  campaign.player.roubles = 3100;
  campaign.player.faction = 'liberte';
  campaign.player.rank = 'veteran';
  campaign.quests['le-guide'] = {
    status: 'done', step: 'a5-trace', history: ['a1-atp', 'a4-bar', 'a4-liberte', 'a5-defense', 'a5-trace'],
  };
  campaign.quests['souvenir-du-guide'] = { status: 'done', step: 'x', history: [] };
  campaign.quests['dette-bohdan'] = { status: 'failed', step: 'x', history: [] };
  assert.equal(isEnding(campaign), true);
  const before = jsonCopy(campaign);
  const view = endingView(campaign);
  assert.deepEqual(campaign, before);
  assert.deepEqual(view.epilogue, content.quests['le-guide'].epilogue);
  assert.deepEqual(view.stats, [
    ['Jours dans la Zone', 23],
    ['Roubles', 3100],
    ['Rang', 'Vétéran'],
    ['Quêtes finies', 2],
    ['Quêtes ratées', 1],
  ]);
  assert.deepEqual(view.choices, [
    'Acte 4 : le serment à Liberté',
    'Arc du Marais : les notes du Guide retrouvées',
    'Faction : Liberté',
  ]);
});

test('endingView : branche du Devoir, arc du Marais ignoré', () => {
  const campaign = jsonCopy(createCampaign({ seed: 1 }));
  campaign.player.faction = 'devoir';
  campaign.quests['le-guide'] = { status: 'done', step: 'a5-trace', history: ['a4-bar', 'a4-devoir'] };
  assert.deepEqual(endingView(campaign).choices, [
    'Acte 4 : le serment au Devoir',
    'Arc du Marais : laissé de côté',
    'Faction : Devoir',
  ]);
});
