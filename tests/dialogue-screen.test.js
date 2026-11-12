import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createCampaign, step } from '../src/engine/campaign.js';
import { conditionText, dialogueLine, dialogueWindow, npcsHere, stepObjective } from '../src/ui/dialogue-screen.js';

// Départ au Camp des novices (hexagone 5 du Cordon), où se tient Bohdan.
const talking = (npc = 'bohdan') => step(createCampaign({ seed: 1 }), { type: 'talk', npc }).state;

test('npcsHere : les PNJ vivants du lieu de l’hexagone du joueur', () => {
  const campaign = createCampaign({ seed: 1 });
  const ids = npcsHere(campaign).map((npc) => npc.id);
  assert.ok(ids.includes('bohdan'));
  assert.deepEqual(npcsHere(campaign).find((npc) => npc.id === 'bohdan'), { id: 'bohdan', name: 'Bohdan' });
  campaign.npcs.bohdan.alive = false;
  assert.ok(!npcsHere(campaign).some((npc) => npc.id === 'bohdan'));
  campaign.world.hex = 1;
  assert.deepEqual(npcsHere(campaign), []);
});

test('dialogueWindow : null hors dialogue', () => {
  assert.equal(dialogueWindow(createCampaign({ seed: 1 })), null);
});

test('dialogueWindow : portrait, texte, choix numérotés, choix grisés avec leur condition', () => {
  const view = dialogueWindow(talking());
  assert.equal(view.name, 'Bohdan');
  assert.equal(view.faction, 'solitaires');
  assert.equal(view.factionName, 'Solitaires');
  assert.match(view.text, /Bohdan garde/);
  assert.deepEqual(view.choices.map((c) => c.number), view.choices.map((_, i) => i + 1));
  const calm = view.choices[0];
  assert.deepEqual(calm, { index: 0, number: 1, text: 'Tout est calme ?', available: true, requirement: null });
  const refused = view.choices.find((c) => c.text === 'Je peux entrer ?');
  assert.equal(refused.available, false);
  assert.equal(refused.requirement, 'Réputation Solitaires ≤ -2');
  const debt = view.choices.find((c) => c.text === 'Tu as l’air soucieux.');
  assert.equal(debt.available, true);
  assert.match(debt.requirement, /pas encore prise/);
});

test('dialogueWindow : suit le nœud courant après un choix', () => {
  const view = dialogueWindow(step(talking(), { type: 'choose', index: 0 }).state);
  assert.match(view.text, /chiens/);
  assert.deepEqual(view.choices.map((c) => c.text), ['D’accord.']);
});

test('conditionText : chaque type de condition en clair', () => {
  assert.equal(conditionText({ type: 'reputation', faction: 'devoir', min: 1 }), 'Réputation Devoir ≥ 1');
  assert.equal(conditionText({ type: 'objet', item: 'bandage' }), 'Avoir : Bandage');
  assert.equal(conditionText({ type: 'rang', min: 'veteran' }), 'Rang ≥ Vétéran');
  assert.equal(conditionText({ type: 'stat', stat: 'tir', min: 2, max: 4 }), 'Tir entre 2 et 4');
  assert.equal(conditionText({ type: 'roubles', min: 100 }), 'Roubles ≥ 100');
  assert.equal(conditionText({ type: 'quete', quest: 'dette-bohdan', step: 'retour' }), 'Quête « La dette de Bohdan », étape : Parler à Bohdan');
  assert.equal(conditionText({ type: 'quete', quest: 'le-guide', step: 'a1-retour' }), 'Quête « Le Guide », étape : Parler au Marchand du bunker');
  assert.equal(conditionText({ type: 'quete', quest: 'le-guide', step: 'inconnue' }), 'Quête « Le Guide » plus avancée');
  assert.equal(conditionText({ type: 'inconnue' }), 'condition particulière');
  assert.equal(conditionText({ type: 'premiere-visite' }), 'Première rencontre');
  assert.equal(
    conditionText({ type: 'un', conditions: [{ type: 'roubles', min: 1 }, { type: 'objet', item: 'vodka' }] }),
    'Roubles ≥ 1 ou Avoir : Vodka',
  );
  assert.equal(conditionText({ type: 'non', condition: { type: 'roubles', min: 1 } }), 'Pas : Roubles ≥ 1');
});

test('dialogueLine : lignes de journal du dialogue, nœuds tus, autres événements ignorés', () => {
  const { events } = step(createCampaign({ seed: 1 }), { type: 'talk', npc: 'bohdan' });
  const lines = events.map(dialogueLine);
  assert.ok(lines.includes('Conversation avec Bohdan'));
  assert.ok(lines.includes('Nouveau contact : Bohdan'));
  assert.ok(!lines.some((line) => line?.startsWith('Rencontre')));
  assert.equal(dialogueLine({ type: 'dialogue-node', npc: 'bohdan' }), '');
  assert.equal(dialogueLine({ type: 'reputation-changed', faction: 'devoir', amount: -1, reputation: -1 }), 'Réputation Devoir -1 (-1)');
  assert.equal(dialogueLine({ type: 'item-removed', kind: 'vodka', cause: 'dialogue' }), 'Donné : Vodka');
  assert.equal(dialogueLine({ type: 'item-removed', kind: 'vodka', cause: 'bruleuse' }), undefined);
  assert.equal(dialogueLine({ type: 'refused', reason: 'choice-unavailable' }), 'Refusé : choix indisponible');
  assert.equal(dialogueLine({ type: 'moved' }), undefined);
});

test('stepObjective : l’objectif d’une étape en clair, « à Le » contracté', () => {
  const campaign = createCampaign({ seed: 1 });
  assert.equal(stepObjective('le-guide', 'a1-elevateur', campaign), 'Parler au stalker blessé');
  assert.equal(stepObjective('le-guide', 'a1-atp', campaign), 'Fouiller ATP : retrouver le PDA du courrier');
  assert.equal(stepObjective('le-guide', 'inconnue', campaign), null);
  assert.equal(stepObjective('inconnue', 'a1-atp', campaign), null);
});
