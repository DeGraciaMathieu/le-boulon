import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createCampaign, step } from '../src/engine/campaign.js';
import { candidates, createMind, PROFILES } from '../bench/campaign-ai.js';
import { playCampaign, runCampaignBench, formatCampaignReport } from '../bench/campaign.js';

const SHORT = { campaigns: 2, days: 4, seed: 3 };

test('banc de campagne : même graine, même rapport', () => {
  assert.deepEqual(runCampaignBench(SHORT), runCampaignBench(SHORT));
});

test('banc de campagne : une campagne courte de chaque IA finit sans blocage', () => {
  for (const profile of Object.keys(PROFILES)) {
    for (const seed of [1, 2, 3]) {
      const record = playCampaign(seed, profile, { days: 4 });
      assert.ok(['days', 'dead'].includes(record.end), `${profile} ${seed} : ${record.end}`);
      assert.ok(record.days <= 4);
      assert.ok(record.roubles.length >= 1 && record.roubles.length <= 4);
      assert.equal(record.deathDay === null, record.end !== 'dead');
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
