import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createCampaign, step } from '../src/engine/campaign.js';
import { candidates, createMind, PROFILES } from '../bench/campaign-ai.js';
import { journalLine, journalLevel } from '../src/ui/journal.js';

// Un identifiant brut : minuscules reliées par des tirets (xp-gained, a1-retour…).
// Les directions (sud-est…) ne sont pas des identifiants.
const DIRECTIONS = /\b(nord|sud)-(est|ouest)\b/g;
const RAW_ID = /\b[a-z]+-[a-z0-9-]+\b|undefined|null|NaN/;

test('journalLine : les événements autrefois bruts sont traduits', () => {
  const campaign = createCampaign({ seed: 1 });
  assert.equal(journalLine({ type: 'xp-gained', amount: 10, cause: 'combat', xp: 30 }, campaign), '+10 XP (combat) · total 30');
  assert.equal(journalLine({ type: 'pda-found', stash: 's1', tile: 'cordon', hex: 3 }, campaign), 'PDA trouvé : une planque est marquée (Cordon)');
  assert.equal(journalLine({ type: 'night-card', deck: 'nuit-cordon', card: 'rodeurs' }, campaign), 'Carte Nuit : rôdeurs');
  assert.equal(journalLine({ type: 'night-card', deck: 'nuit-cordon', card: 'nuit-calme' }, campaign), 'Carte Nuit : nuit calme');
  assert.equal(journalLine({ type: 'weather', card: 'signes-emission' }, campaign), "Météo : signes d'Émission");
  assert.equal(journalLine({ type: 'rank-up', rank: 'experimente' }, campaign), 'Nouveau rang : Expérimenté');
  assert.equal(journalLine({ type: 'wounded', amount: 1, cause: 'fuite' }, campaign), '+1 blessure (fuite)');
  assert.doesNotMatch(journalLine({ type: 'encounter-removed', hex: 2, card: 'chair' }, campaign), /écarté|chair /);
});

test('journalLine : jamais l’identifiant brut, même inconnu', () => {
  const campaign = createCampaign({ seed: 1 });
  assert.equal(journalLine({ type: 'evenement-inconnu' }, campaign), '');
  assert.equal(journalLine({ type: 'refused', reason: 'raison-inconnue' }, campaign), 'Refusé : action impossible');
  assert.equal(journalLine({ type: 'weather', card: 'carte-inconnue' }, campaign), 'Météo : variable');
  assert.equal(journalLine({ type: 'dialogue-node', npc: 'bohdan' }, campaign), '');
});

test('journalLine : une étape de quête dit quoi faire ensuite, et où', () => {
  const campaign = createCampaign({ seed: 1 });
  assert.equal(journalLine({ type: 'quest-started', quest: 'le-guide' }, campaign), 'Nouvelle quête : Le Guide');
  assert.equal(
    journalLine({ type: 'quest-step', quest: 'le-guide', step: 'a1-elevateur' }, campaign),
    'Quête Le Guide : Parler au stalker blessé (Élévateur)',
  );
  assert.equal(journalLine({ type: 'quest-step', quest: 'le-guide', step: 'a1-atp' }, campaign), 'Quête Le Guide : Fouiller ATP : retrouver le PDA du courrier');
  assert.equal(journalLine({ type: 'quest-step', quest: 'le-guide', step: 'inconnue' }, campaign), 'Quête Le Guide : nouvelle étape');
});

test('journalLevel : quête, blessures, butin et alertes en important ; jets et déplacements en détail', () => {
  for (const type of ['quest-step', 'wounded', 'loot-found', 'emission-started', 'refused', 'combat-started']) {
    assert.equal(journalLevel({ type }), 'important', type);
  }
  for (const type of ['check', 'moved', 'combat-round', 'xp-gained', 'hub-left', 'weather']) {
    assert.equal(journalLevel({ type }), 'detail', type);
  }
});

test('journalLine : sur des journées jouées par l’IA du banc, aucune ligne brute', () => {
  const seen = new Set();
  for (const [seed, combatMode] of [[1, 'rapide'], [2, 'rounds']]) {
    let campaign = createCampaign({ seed, combatMode });
    const mind = createMind(PROFILES.gourmande);
    let refused = [];
    for (let n = 0; n < 1500 && campaign.day <= 4; n++) {
      const action = candidates(campaign, mind).find((a) => !refused.some((r) => JSON.stringify(r) === JSON.stringify(a)));
      if (!action) break;
      const result = step(campaign, action);
      for (const event of result.events) {
        const line = journalLine(event, result.state);
        seen.add(event.type);
        assert.notEqual(line, event.type);
        assert.doesNotMatch(line.replace(DIRECTIONS, ''), RAW_ID, `${event.type} : ${line}`);
      }
      if (result.events[0]?.type === 'refused') refused.push(action);
      else [campaign, refused] = [result.state, []];
    }
  }
  assert.ok(seen.size > 20);
});
