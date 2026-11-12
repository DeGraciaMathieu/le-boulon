import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createCampaign, step } from '../src/engine/campaign.js';
import { startQuest } from '../src/engine/rules/quests.js';
import { createRng } from '../src/engine/rng.js';
import content from '../src/content/index.js';
import { PDA_TABS, PDA_LINES, objectiveText, pdaQuests, pdaJournal, pdaRumors, pdaFactions, pdaSheet } from '../src/ui/pda.js';

const fakeCtx = () => ({ rng: createRng(1), emit: () => {} });

function withQuest(id) {
  const campaign = createCampaign({ seed: 1 });
  startQuest(campaign, id, fakeCtx());
  return campaign;
}

// Rang Expérimenté : un point de stat et un savoir-faire à dépenser.
function experienced() {
  const campaign = createCampaign({ seed: 1 });
  campaign.player.xp = 150;
  campaign.player.rank = 'experimente';
  return campaign;
}

test('onglets : Quêtes, Carte du monde, Journal, Rumeurs, Factions, Fiche (§16)', () => {
  assert.deepEqual(PDA_TABS.map((tab) => tab.id), ['quetes', 'carte', 'journal', 'rumeurs', 'factions', 'fiche', 'aide']);
});

test('rumeurs : au départ, aucune ; une rumeur en vente non achetée ne s’affiche pas', () => {
  const campaign = createCampaign({ seed: 1 });
  assert.deepEqual(pdaRumors(campaign), []);
  campaign.rumors.push({ type: 'patrouille', tile: 'cordon', hex: 4, day: 1, known: false });
  assert.deepEqual(pdaRumors(campaign), []);
});

test('rumeurs : contenu lisible, fraîches d’abord, la plus récente en premier', () => {
  const campaign = createCampaign({ seed: 1 });
  campaign.rumors.push(
    { type: 'patrouille', tile: 'cordon', hex: 4, day: 1, known: true, stale: true },
    { type: 'artefact', tile: 'cordon', hex: 7, item: 'meduse', day: 2, known: true, expires: 5 },
    { type: 'raccourci', tile: 'cordon', path: [3, 9], day: 3, known: true },
  );
  const rumors = pdaRumors(campaign);
  assert.deepEqual(rumors.map((rumor) => rumor.type), ['raccourci', 'artefact', 'patrouille']);
  assert.equal(rumors[1].name, 'Artefact rare');
  assert.equal(rumors[1].text, `${content.items.meduse.name} à ${content.tiles.cordon.name}, au nord-ouest`);
  assert.equal(rumors[1].age, 'Fraîche jusqu’à l’Émission du jour 5');
  assert.equal(rumors[2].stale, true);
  assert.equal(rumors[2].age, 'Périmée : une Émission est passée');
});

test('objectif : texte lisible avec les noms du contenu', () => {
  const campaign = createCampaign({ seed: 1 });
  assert.equal(objectiveText({ type: 'explorer', place: 'pont', card: 'riviere' }, campaign), 'Fouiller Pont');
  assert.equal(objectiveText({ type: 'cartographier', tile: 'cordon' }, campaign), 'Cartographier Cordon');
  assert.equal(objectiveText({ type: 'survivre', emission: true }, campaign), "Survivre à l'Émission");
  assert.equal(objectiveText({ type: 'inconnu' }, campaign), 'inconnu');
});

test('objectif explorer : rang de la carte cherchée et ce qu’on cherche (P3)', () => {
  const campaign = withQuest('le-guide');
  const objective = content.quests['le-guide'].steps['a1-atp'].objective;
  assert.equal(objectiveText(objective, campaign), 'Fouiller ATP (carte 3) : retrouver le PDA du courrier');
  campaign.places.atp.revealed = ['cache'];
  assert.equal(objectiveText(objective, campaign), 'Fouiller ATP (carte 3, encore 2 à tirer) : retrouver le PDA du courrier');
  campaign.places.atp.revealed.push('rien');
  assert.equal(objectiveText(objective, campaign), 'Fouiller ATP (prochaine carte) : retrouver le PDA du courrier');
});

test('objectif : goal s’ajoute à tout type d’objectif', () => {
  const campaign = createCampaign({ seed: 1 });
  assert.equal(objectiveText({ type: 'cartographier', tile: 'cordon', goal: 'noter les anomalies' }, campaign), 'Cartographier Cordon : noter les anomalies');
});

test('quêtes : au départ, aucune', () => {
  assert.deepEqual(pdaQuests(createCampaign({ seed: 1 })), { active: [], done: [], failed: [] });
});

test('quêtes : une quête active montre son objectif et son lieu cible', () => {
  const [entry] = pdaQuests(withQuest('ami-du-pont')).active;
  assert.equal(entry.name, content.quests['ami-du-pont'].name);
  assert.equal(entry.objective, 'Fouiller Pont (prochaine carte)');
  assert.equal(entry.place, `Pont (${content.tiles['vallee-sombre'].name})`);
  assert.equal(entry.deadline, null);
  assert.deepEqual(entry.options, []);
});

test('quêtes : terminées et ratées, avec la cause', () => {
  const campaign = withQuest('ami-du-pont');
  startQuest(campaign, 'chiens-cordon', fakeCtx());
  campaign.quests['ami-du-pont'].status = 'done';
  Object.assign(campaign.quests['chiens-cordon'], { status: 'failed', reason: 'deadline' });
  const log = pdaQuests(campaign);
  assert.equal(log.active.length, 0);
  assert.deepEqual(log.done.map((q) => q.quest), ['ami-du-pont']);
  assert.deepEqual(log.failed.map((q) => q.reason), ['délai dépassé']);
});

test('journal : une ligne par note de quête, la plus récente en premier', () => {
  const campaign = withQuest('ami-du-pont');
  startQuest(campaign, 'chiens-cordon', fakeCtx());
  const lines = pdaJournal(campaign);
  assert.equal(lines.length, campaign.journal.length);
  assert.equal(lines.at(-1).text, `Quête reçue : ${content.quests['ami-du-pont'].name}`);
  assert.equal(lines.at(-2).text, `Nouvelle étape : ${content.quests['ami-du-pont'].name} · Fouiller Pont (prochaine carte)`);
  assert.ok(lines[0].text.includes(content.quests['chiens-cordon'].name));
  assert.equal(lines[0].day, 1);
});

test('factions : toutes les factions, réputation de départ et palier', () => {
  const factions = pdaFactions(createCampaign({ seed: 1 }));
  assert.equal(factions.length, Object.keys(content.factions).length);
  const byId = Object.fromEntries(factions.map((f) => [f.id, f]));
  assert.deepEqual(byId.solitaires, { id: 'solitaires', name: 'Solitaires', reputation: 2, standing: 'Amical', member: true });
  assert.equal(byId.bandits.standing, 'Hostile');
});

test('fiche : bleu au départ, rien à dépenser, rang suivant à 150 XP', () => {
  const sheet = pdaSheet(createCampaign({ seed: 1 }));
  assert.equal(sheet.rank, 'Bleu');
  assert.deepEqual(sheet.nextRank, { name: 'Expérimenté', xp: 150 });
  assert.equal(sheet.statPoints, 0);
  assert.equal(sheet.perkPicks, 0);
  assert.ok(sheet.stats.every((stat) => !stat.canRaise));
  assert.equal(sheet.available.length, Object.keys(content.perks).length);
  assert.equal(sheet.faction, 'Solitaires');
});

test('fiche : un rang passé ouvre un point de stat et un savoir-faire', () => {
  const sheet = pdaSheet(experienced());
  assert.equal(sheet.statPoints, 1);
  assert.equal(sheet.perkPicks, 1);
  assert.ok(sheet.stats.every((stat) => stat.canRaise));
});

test('fiche : suit les actions raise-stat et learn-perk', () => {
  let campaign = experienced();
  campaign = step(campaign, { type: 'raise-stat', stat: 'tir' }).state;
  campaign = step(campaign, { type: 'learn-perk', perk: 'mule' }).state;
  const sheet = pdaSheet(campaign);
  assert.equal(sheet.stats.find((stat) => stat.id === 'tir').value, 2);
  assert.ok(sheet.stats.every((stat) => !stat.canRaise));
  assert.deepEqual(sheet.perks, [{ id: 'mule', name: 'Mule', effect: content.perks.mule.effect }]);
  assert.ok(!sheet.available.some((perk) => perk.id === 'mule'));
});

test('fiche : une stat au maximum ne se monte plus', () => {
  const campaign = experienced();
  campaign.player.stats.tir = 4;
  campaign.player.stats.survie = 0;
  assert.equal(pdaSheet(campaign).stats.find((stat) => stat.id === 'tir').canRaise, false);
});

test('fiche : au rang Maître, pas de rang suivant', () => {
  const campaign = createCampaign({ seed: 1 });
  Object.assign(campaign.player, { xp: 1500, rank: 'maitre' });
  assert.equal(pdaSheet(campaign).nextRank, null);
});

test('lignes du journal : actions de la fiche', () => {
  assert.equal(PDA_LINES['stat-raised']({ stat: 'discretion', value: 2 }), 'Discrétion monte à 2');
  assert.equal(PDA_LINES['perk-learned']({ perk: 'mule' }), 'Savoir-faire appris : Mule');
});
