import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createCampaign, step, dayState, storeDay } from '../src/engine/campaign.js';
import { candidates, createMind, PROFILES } from '../bench/campaign-ai.js';
import { startCombat } from '../src/engine/rules/combat.js';
import { playCampaign, runCampaignBench, formatCampaignReport } from '../bench/campaign.js';

const SHORT = { campaigns: 2, days: 4, seed: 3 };

test('banc de campagne : même graine, même rapport', () => {
  assert.deepEqual(runCampaignBench(SHORT), runCampaignBench(SHORT));
});

test('banc de campagne : une campagne courte de chaque IA finit sans blocage', () => {
  for (const profile of Object.keys(PROFILES)) {
    for (const seed of [1, 2, 3]) {
      const record = playCampaign(seed, profile, { days: 4 });
      assert.equal(record.end, 'days', `${profile} ${seed} : ${record.end}`);
      assert.ok(record.days <= 4);
      assert.ok(record.roubles.length >= 1 && record.roubles.length <= 4);
    }
  }
});

test('banc de campagne : l’IA démarre la quête principale au premier jour', () => {
  for (const profile of Object.keys(PROFILES)) {
    const record = playCampaign(1, profile, { days: 1 });
    assert.notEqual(record.questStep, null, profile);
  }
});

test('IA de campagne : décision déterministe, acceptée par le moteur', () => {
  const campaign = createCampaign({ seed: 1, combatMode: 'rapide' });
  for (const profile of Object.values(PROFILES)) {
    const first = candidates(campaign, createMind(profile));
    assert.deepEqual(first, candidates(campaign, createMind(profile)));
    assert.notEqual(step(campaign, first[0]).events[0]?.type, 'refused');
  }
});

test('rapport : mesures du §17.3 et verdicts sur les cibles', () => {
  const report = runCampaignBench({ ...SHORT, campaigns: 1 });
  for (const profile of Object.keys(PROFILES)) {
    const p = report.profiles[profile];
    for (const key of ['survival', 'deathsPer10Days', 'deathsByWeek', 'deathCauses', 'roublesCurve', 'ranks', 'acts',
      'shoulderWeapon', 'hubFill', 'placesEmptied', 'emissions', 'questsFailed']) {
      assert.ok(key in p, `${profile} : ${key}`);
    }
  }
  const text = formatCampaignReport(report);
  assert.match(text, /acte 1 en 4 à 7 jours/);
  assert.match(text, /arme d'épaule vers le jour 8 à 12/);
  assert.match(text, /moins de 1 mort \/ 10 jours/);
});

// LBL-55 (1) : en mode normal, le banc fait réapparaître au dernier hub au lieu de finir.

test('IA de campagne : morte en mode normal, elle choisit la réapparition', () => {
  const campaign = createCampaign({ seed: 1, combatMode: 'rapide' });
  const day = dayState(campaign);
  day.status = 'dead';
  storeDay(campaign, day);
  const [first] = candidates(campaign, createMind(PROFILES.prudente));
  assert.deepEqual(first, { type: 'respawn' });
  assert.equal(step(campaign, first).events[0].type, 'respawned');
});

test('banc de campagne : les morts réapparaissent, la campagne continue et le rapport les compte', () => {
  const records = [1, 2, 3, 4, 5, 6].map((seed) => playCampaign(seed, 'gourmande', { days: 10 }));
  const died = records.filter((r) => r.deaths > 0);
  assert.ok(died.length > 0, 'au moins une mort');
  for (const r of records) {
    assert.equal(r.respawns, r.deaths);
    assert.notEqual(r.end, 'dead');
    assert.equal(r.deathDay === null, r.deaths === 0);
  }
  const report = runCampaignBench({ ...SHORT, campaigns: 1 });
  for (const p of Object.values(report.profiles)) {
    assert.ok('deaths' in p && 'respawns' in p);
  }
});

// LBL-56 : la nuit, la fuite coûte 1 blessure et 0 PA ; l'IA s'en sert.

function nightFight(card, wounds) {
  const campaign = createCampaign({ seed: 1, combatMode: 'rapide' });
  campaign.screen = 'night';
  campaign.night = { rest: 'decouvert', cardDrawn: true };
  campaign.player.wounds = wounds;
  startCombat(campaign, { hex: campaign.world.hex, card }, { emit() {} });
  return campaign;
}

test('IA de campagne : en combat de nuit, la prudente fuit, la gourmande seulement en danger', () => {
  const fleesFirst = (campaign, profile) => {
    const types = candidates(campaign, createMind(PROFILES[profile])).map((action) => action.type);
    return types.indexOf('escape') < types.indexOf('shoot');
  };
  assert.equal(fleesFirst(nightFight('chiens', 0), 'prudente'), true);
  assert.equal(fleesFirst(nightFight('chiens', 0), 'gourmande'), false);
  assert.equal(fleesFirst(nightFight('chiens', 4), 'gourmande'), true);
  // La blessure de la fuite tuerait : l'IA se bat.
  assert.equal(fleesFirst(nightFight('chiens', 5), 'prudente'), false);
  // Le jour, rien ne change : le tir passe avant la fuite.
  const day = createCampaign({ seed: 1, combatMode: 'rapide' });
  startCombat(day, { hex: day.world.hex, card: 'chiens' }, { emit() {} });
  assert.equal(fleesFirst(day, 'prudente'), false);
});
