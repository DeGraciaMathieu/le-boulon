import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createCampaign, dayState } from '../src/engine/campaign.js';
import { TRIGGERS } from '../src/ui/bulles.js';
import {
  STEPS, startTutorial, advance, skipTutorial, currentStep, readProgress, saveProgress, readSetting, saveSetting,
} from '../src/ui/tutoriel.js';

const fresh = () => createCampaign({ seed: 1 });

// Événements qui font chaque étape, dans l'ordre du tutoriel.
const EVENTS = {
  marchand: [{ type: 'dialogue-node' }, { type: 'quest-started', quest: 'le-guide' }],
  boulon: [{ type: 'bolt-thrown', target: 6 }, { type: 'token-revealed', hex: 6, by: 'bolt' }],
  discretion: [{ type: 'moved', from: 5, to: 4 }, { type: 'check', stat: 'discretion' }],
  atp: [{ type: 'place-card', place: 'atp' }, { type: 'place-card', place: 'atp' }, { type: 'place-card', place: 'atp' }],
  bandage: [{ type: 'used', item: 'bandage', wounds: 1 }],
  dormir: [{ type: 'day-ended', reason: 'sleep', rest: 'lit' }],
};

function memoryStorage() {
  const data = new Map();
  return { getItem: (key) => data.get(key) ?? null, setItem: (key, value) => data.set(key, String(value)) };
}

test('tutoriel : six étapes, ids uniques, chacune avec un texte et une cible', () => {
  assert.deepEqual(STEPS.map((step) => step.id), Object.keys(EVENTS));
  const campaign = fresh();
  for (const step of STEPS) {
    assert.ok(step.text.length > 20, step.id);
    assert.ok(step.target({ campaign, day: dayState(campaign) }).length > 0, step.id);
  }
});

test('tutoriel : les bulles tues sont des déclencheurs L7', () => {
  const ids = TRIGGERS.map((trigger) => trigger.id);
  for (const step of STEPS) for (const id of step.mutes) assert.ok(ids.includes(id), id);
});

test('tutoriel : dans l\'ordre, chaque étape passe à la suivante avec son compteur', () => {
  let progress = startTutorial();
  for (const [index, step] of STEPS.entries()) {
    assert.deepEqual(currentStep(progress), { step, number: index + 1, total: 6 });
    progress = advance(progress, EVENTS[step.id]);
  }
  assert.equal(currentStep(progress), null);
  assert.equal(progress.active, false);
});

test('tutoriel : une étape faite dans le désordre est validée quand même', () => {
  let progress = startTutorial();
  progress = advance(progress, EVENTS.bandage);
  assert.equal(currentStep(progress).step.id, 'marchand');
  progress = advance(progress, [...EVENTS.marchand, ...EVENTS.boulon, ...EVENTS.discretion, ...EVENTS.atp]);
  assert.equal(currentStep(progress).step.id, 'dormir');
});

test('tutoriel : les événements d\'une étape s\'additionnent d\'un step à l\'autre, dans l\'ordre', () => {
  let progress = startTutorial();
  progress = advance(progress, [{ type: 'place-card' }]);
  progress = advance(progress, [{ type: 'place-card' }]);
  assert.equal(progress.steps.atp, 2);
  progress = advance(progress, [{ type: 'place-card' }]);
  assert.equal(progress.steps.atp, 3);
  // Le boulon doit précéder la révélation ; un jeton révélé en entrant ne compte pas.
  progress = advance(progress, [{ type: 'token-revealed', by: 'bolt' }, { type: 'bolt-thrown' }]);
  assert.equal(progress.steps.boulon, 1);
  progress = advance(progress, [{ type: 'token-revealed', by: 'enter' }]);
  assert.equal(progress.steps.boulon, 1);
  // Un autre objet que le bandage, un bivouac : pas d'étape.
  progress = advance(progress, [{ type: 'used', item: 'vodka' }, { type: 'day-ended', reason: 'camp' }]);
  assert.equal(progress.steps.bandage, 0);
  assert.equal(progress.steps.dormir, 0);
});

test('tutoriel : passer l\'éteint, ses étapes restent', () => {
  let progress = advance(startTutorial(), EVENTS.marchand);
  progress = skipTutorial(progress);
  assert.equal(currentStep(progress), null);
  assert.equal(advance(progress, EVENTS.boulon), progress);
  assert.equal(progress.steps.marchand, 1);
});

test('tutoriel : la reprise garde les étapes faites et repart de la première non faite', () => {
  const storage = memoryStorage();
  const campaign = fresh();
  let progress = advance(startTutorial(), [...EVENTS.boulon, ...EVENTS.bandage]);
  saveProgress(storage, campaign.seed, skipTutorial(progress));
  assert.equal(readProgress(storage, 2), null);
  progress = startTutorial(readProgress(storage, campaign.seed), campaign);
  assert.equal(currentStep(progress).step.id, 'marchand');
  progress = advance(progress, EVENTS.marchand);
  assert.equal(currentStep(progress).step.id, 'discretion');
});

test('tutoriel : relancé sur une partie où la quête est prise, l\'étape du Marchand est acquise', () => {
  const campaign = { ...fresh(), quests: { 'le-guide': { step: 0 } } };
  assert.equal(currentStep(startTutorial(undefined, campaign)).step.id, 'boulon');
});

test('tutoriel : progression et réglage survivent à un stockage absent ou cassé', () => {
  const broken = { getItem: () => { throw new Error('bloqué'); }, setItem: () => { throw new Error('bloqué'); } };
  assert.equal(readProgress(broken, 1), null);
  assert.equal(saveProgress(broken, 1, startTutorial()), false);
  assert.equal(readSetting(broken), true);
  assert.equal(saveSetting(broken, false), false);
  const storage = memoryStorage();
  assert.equal(readSetting(storage), true);
  saveSetting(storage, false);
  assert.equal(readSetting(storage), false);
  saveSetting(storage, true);
  assert.equal(readSetting(storage), true);
});
