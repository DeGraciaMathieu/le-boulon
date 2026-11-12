import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createCampaign } from '../src/engine/campaign.js';
import { BASE_DEFENSE, ARMOR_DEFENSE } from '../src/engine/rules/combat.js';
import { RANKS } from '../src/engine/rules/progression.js';
import { createItem } from '../src/engine/rules/sheet.js';
import { sheetCard, xpRatio, ficheBeats, FICHE_BEATS, CARE_KINDS } from '../src/ui/fiche.js';

const fresh = () => JSON.parse(JSON.stringify(createCampaign({ seed: 1 })));

test('sheetCard : au départ, Bleu, jauge vide, compétences de départ', () => {
  const card = sheetCard(fresh());
  assert.equal(card.rank.id, 'bleu');
  assert.equal(card.rank.ratio, 0);
  assert.deepEqual(card.rank.next, { name: 'Expérimenté', xp: RANKS[1].xp });
  assert.deepEqual(card.skills.map((s) => [s.id, s.total]), [['tir', 1], ['discretion', 1], ['survie', 1], ['endurance', 0]]);
});

test('sheetCard : ceinture de soins et réserve de boulons comptées depuis l’inventaire', () => {
  const card = sheetCard(fresh());
  assert.deepEqual(card.care.map((c) => [c.kind, c.count]), [['bandage', 2], ['vodka', 1], ['ration', 1]]);
  assert.deepEqual(card.care.map((c) => c.kind), CARE_KINDS);
  assert.equal(card.bolts, 10);
});

test('sheetCard : Défense = base, plus l’armure portée, détaillée au survol', () => {
  const campaign = fresh();
  assert.equal(sheetCard(campaign).defense.total, BASE_DEFENSE);
  campaign.equipment.armor = createItem('veste-cuir');
  const { defense } = sheetCard(campaign);
  assert.equal(defense.total, BASE_DEFENSE + ARMOR_DEFENSE);
  assert.match(defense.detail, /base 4 armure \+1/);
});

test('sheetCard : équipement porté, emplacements d’artefact et bonus de ceinture', () => {
  const campaign = fresh();
  campaign.equipment.belt = [createItem('oeil-de-chat')];
  const card = sheetCard(campaign);
  const names = card.gear.map((g) => [g.slot, g.name]);
  assert.deepEqual(names, [['sidearm', 'Pistolet'], ['armor', 'aucun'], ['detector', 'Écho'], ['belt', 'Œil de chat']]);
  assert.match(card.gear[0].detail, /\+1 · dégâts 1 · \d+ balles/);
  const stealth = card.skills.find((s) => s.id === 'discretion');
  assert.deepEqual([stealth.value, stealth.bonus, stealth.total], [1, 1, 2]);
});

test('xpRatio : remplissage dans le rang, plein au dernier rang', () => {
  assert.equal(xpRatio(0), 0);
  assert.equal(xpRatio(75), 0.5);
  assert.equal(xpRatio(RANKS[1].xp), 0);
  assert.equal(xpRatio(RANKS.at(-1).xp + 500), 1);
});

test('ficheBeats : un pas de fiche après chaque événement concerné, rien pour les autres', () => {
  const events = [
    { type: 'moved', to: 3 },
    { type: 'bolt-thrown', target: 7 },
    { type: 'item-gained', kind: 'bandage', cause: 'quete' },
    { type: 'artefact-picked', hex: 4, value: 1000 },
    { type: 'roubles-changed', amount: 200, roubles: 1200 },
    { type: 'xp-gained', amount: 100, cause: 'quete', xp: 175 },
    { type: 'stat-raised', stat: 'tir', value: 2 },
  ];
  const beats = ficheBeats(events);
  assert.deepEqual(beats.map((e) => e.type), [
    'moved', 'bolt-thrown', FICHE_BEATS.bolt, 'item-gained', FICHE_BEATS.item, 'artefact-picked', FICHE_BEATS.item,
    'roubles-changed', FICHE_BEATS.coins, 'xp-gained', FICHE_BEATS.xp, 'stat-raised', FICHE_BEATS.stat,
  ]);
  assert.equal(beats[2].target, 7);
  assert.equal(beats[6].kind, 'artefact');
  assert.deepEqual(beats[10], { type: FICHE_BEATS.xp, from: 0.5, to: 0.1, ranked: true });
  assert.deepEqual(beats[12], { type: FICHE_BEATS.stat, stat: 'tir', value: 2 });
});
