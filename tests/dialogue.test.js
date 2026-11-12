import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createCampaign, step, CAMPAIGN_ACTIONS } from '../src/engine/campaign.js';
import {
  evaluate,
  dialogueView,
  CONDITIONS,
  EFFECTS,
  DIALOGUES,
  RANKS,
} from '../src/engine/rules/dialogue.js';
import { createItem } from '../src/engine/rules/sheet.js';
import exemple from './fixtures/dialogue-exemple.js';

const NPC = 'sidorovitch';
DIALOGUES[NPC] = exemple;

const jsonCopy = (value) => JSON.parse(JSON.stringify(value));

function play(campaign, actions) {
  const events = [];
  for (const action of actions) {
    const result = step(campaign, action);
    campaign = result.state;
    events.push(...result.events);
  }
  return { campaign, events };
}

// Campagne de départ avec quelques champs posés à la main.
function campaignWith({ reputation = {}, rank, roubles, items = [], quests = {} } = {}) {
  const campaign = createCampaign({ seed: 3 });
  campaign.reputation = { ...reputation };
  if (rank) campaign.player.rank = rank;
  if (roubles !== undefined) campaign.player.roubles = roubles;
  campaign.inventory = [...campaign.inventory, ...items.map((kind) => createItem(kind))];
  campaign.quests = quests;
  return campaign;
}

const count = (campaign, kind) => campaign.inventory.filter((item) => item.kind === kind).length;

// --- Conditions ---------------------------------------------------------------------------

test('sans condition, un choix est toujours disponible', () => {
  assert.equal(evaluate(undefined, campaignWith()), true);
});

test('réputation : bornes min et max incluses, faction absente = 0', () => {
  const campaign = campaignWith({ reputation: { devoir: 2 } });
  assert.equal(evaluate({ type: 'reputation', faction: 'devoir', min: 2 }, campaign), true);
  assert.equal(evaluate({ type: 'reputation', faction: 'devoir', min: 3 }, campaign), false);
  assert.equal(evaluate({ type: 'reputation', faction: 'devoir', max: 2 }, campaign), true);
  assert.equal(evaluate({ type: 'reputation', faction: 'devoir', max: 1 }, campaign), false);
  assert.equal(evaluate({ type: 'reputation', faction: 'bandits', max: 0 }, campaign), true);
  assert.equal(evaluate({ type: 'reputation', faction: 'bandits', min: 1 }, campaign), false);
});

test('objet possédé', () => {
  assert.equal(evaluate({ type: 'objet', item: 'bandage' }, campaignWith()), true);
  assert.equal(evaluate({ type: 'objet', item: 'artefact' }, campaignWith()), false);
  assert.equal(evaluate({ type: 'objet', item: 'artefact' }, campaignWith({ items: ['artefact'] })), true);
});

test('rang : ordre du brief §11.1', () => {
  assert.deepEqual(RANKS, ['bleu', 'experimente', 'veteran', 'expert', 'maitre']);
  const veteran = campaignWith({ rank: 'veteran' });
  assert.equal(evaluate({ type: 'rang', min: 'experimente' }, veteran), true);
  assert.equal(evaluate({ type: 'rang', min: 'expert' }, veteran), false);
  assert.equal(evaluate({ type: 'rang', max: 'veteran' }, veteran), true);
  assert.equal(evaluate({ type: 'rang', min: 'experimente' }, campaignWith()), false);
});

test('étape de quête : quête démarrée, étape précise', () => {
  const campaign = campaignWith({ quests: { courrier: { step: 'pda' } } });
  assert.equal(evaluate({ type: 'quete', quest: 'courrier' }, campaign), true);
  assert.equal(evaluate({ type: 'quete', quest: 'courrier', step: 'pda' }, campaign), true);
  assert.equal(evaluate({ type: 'quete', quest: 'courrier', step: 'ateliers' }, campaign), false);
  assert.equal(evaluate({ type: 'quete', quest: 'le-guide' }, campaign), false);
});

test('stat et roubles', () => {
  const campaign = campaignWith({ roubles: 150 });
  const survie = campaign.player.stats.survie;
  assert.equal(evaluate({ type: 'stat', stat: 'survie', min: survie }, campaign), true);
  assert.equal(evaluate({ type: 'stat', stat: 'survie', min: survie + 1 }, campaign), false);
  assert.equal(evaluate({ type: 'roubles', min: 150 }, campaign), true);
  assert.equal(evaluate({ type: 'roubles', min: 151 }, campaign), false);
  assert.equal(evaluate({ type: 'roubles', max: 100 }, campaign), false);
});

test('composition : tous, un, non', () => {
  const campaign = campaignWith({ roubles: 50 });
  const yes = { type: 'roubles', min: 0 };
  const no = { type: 'roubles', min: 1000 };
  assert.equal(evaluate({ type: 'tous', conditions: [yes, yes] }, campaign), true);
  assert.equal(evaluate({ type: 'tous', conditions: [yes, no] }, campaign), false);
  assert.equal(evaluate({ type: 'un', conditions: [no, yes] }, campaign), true);
  assert.equal(evaluate({ type: 'un', conditions: [no, no] }, campaign), false);
  assert.equal(evaluate({ type: 'non', condition: no }, campaign), true);
  assert.equal(evaluate({ type: 'tous', conditions: [{ type: 'non', condition: { type: 'un', conditions: [no] } }, yes] }, campaign), true);
});

test('evaluate est pure et refuse un type inconnu', () => {
  const campaign = campaignWith({ reputation: { devoir: 1 } });
  const before = jsonCopy(campaign);
  evaluate({ type: 'reputation', faction: 'devoir', min: 1 }, campaign);
  assert.deepEqual(campaign, before);
  assert.throws(() => evaluate({ type: 'meteo' }, campaign), /condition inconnue/);
});

test('une condition peut être enregistrée par une autre carte', () => {
  CONDITIONS.jour = (condition, campaign) => campaign.day >= condition.min;
  try {
    assert.equal(evaluate({ type: 'jour', min: 1 }, campaignWith()), true);
    assert.equal(evaluate({ type: 'jour', min: 2 }, campaignWith()), false);
  } finally {
    delete CONDITIONS.jour;
  }
});

// --- Actions talk et choose --------------------------------------------------------------

test('talk et choose sont des actions de campagne', () => {
  assert.equal(typeof CAMPAIGN_ACTIONS.talk, 'function');
  assert.equal(typeof CAMPAIGN_ACTIONS.choose, 'function');
});

test('talk ouvre le dialogue au premier nœud et passe en écran dialogue', () => {
  const campaign = campaignWith();
  const { state, events } = step(campaign, { type: 'talk', npc: NPC });
  assert.equal(state.screen, 'dialogue');
  assert.equal(campaign.screen, 'tile', 'la campagne reçue ne bouge pas');
  assert.deepEqual(state.dialogue, { npc: NPC, dialogue: exemple.id, node: 'accueil', previousScreen: 'tile' });
  assert.deepEqual(events, [
    { type: 'dialogue-started', npc: NPC, dialogue: exemple.id },
    { type: 'dialogue-node', npc: NPC, dialogue: exemple.id, node: 'accueil' },
  ]);
});

test('talk refusé : PNJ sans dialogue, dialogue déjà ouvert', () => {
  const campaign = campaignWith();
  const unknown = step(campaign, { type: 'talk', npc: 'inconnu' });
  assert.equal(unknown.state, campaign);
  assert.deepEqual(unknown.events, [{ type: 'refused', action: { type: 'talk', npc: 'inconnu' }, reason: 'unknown-npc' }]);

  const open = step(campaign, { type: 'talk', npc: NPC }).state;
  const again = step(open, { type: 'talk', npc: NPC });
  assert.equal(again.state, open);
  assert.equal(again.events[0].reason, 'already-talking');
});

test('dialogueView rend le nœud et grise les choix indisponibles avec leurs conditions', () => {
  assert.equal(dialogueView(campaignWith()), null);
  const campaign = step(campaignWith(), { type: 'talk', npc: NPC }).state;
  const view = dialogueView(campaign);
  assert.equal(view.npc, NPC);
  assert.equal(view.node, 'accueil');
  assert.equal(view.text, exemple.nodes.accueil.text);
  assert.deepEqual(view.choices.map((c) => [c.index, c.available]), [[0, true], [1, false], [2, false], [3, true]]);
  assert.deepEqual(view.choices[1].conditions, exemple.nodes.accueil.choices[1].conditions);
  assert.equal(view.choices[1].text, 'Voici un artefact.');
  assert.equal('conditions' in view.choices[0], false);
});

test('choose suit un choix vers un autre nœud', () => {
  const { campaign, events } = play(campaignWith(), [
    { type: 'talk', npc: NPC },
    { type: 'choose', index: 0 },
  ]);
  assert.equal(campaign.dialogue.node, 'travail');
  assert.equal(campaign.screen, 'dialogue');
  assert.deepEqual(events.at(-1), { type: 'dialogue-node', npc: NPC, dialogue: exemple.id, node: 'travail' });
});

test('choose sans destination ferme le dialogue et rend l\'écran précédent', () => {
  const start = campaignWith();
  start.screen = 'hub';
  const { campaign, events } = play(start, [
    { type: 'talk', npc: NPC },
    { type: 'choose', index: 3 },
  ]);
  assert.equal(campaign.screen, 'hub');
  assert.equal('dialogue' in campaign, false);
  assert.deepEqual(events.at(-1), { type: 'dialogue-ended', npc: NPC, dialogue: exemple.id, node: 'accueil' });
});

test('choose refusé : hors dialogue, index invalide, choix indisponible', () => {
  const idle = campaignWith();
  assert.equal(step(idle, { type: 'choose', index: 0 }).events[0].reason, 'not-in-dialogue');

  const open = step(idle, { type: 'talk', npc: NPC }).state;
  for (const index of [-1, 4, 1.5, undefined]) {
    const result = step(open, { type: 'choose', index });
    assert.equal(result.state, open);
    assert.equal(result.events[0].reason, 'bad-choice');
  }
  const locked = step(open, { type: 'choose', index: 1 });
  assert.equal(locked.state, open);
  assert.equal(locked.events[0].reason, 'choice-unavailable');
});

// --- Effets ------------------------------------------------------------------------------

test('effets : prendre un objet, roubles, réputation', () => {
  const start = campaignWith({ items: ['artefact'], roubles: 20, reputation: { solitaires: 2 } });
  const { campaign, events } = play(start, [
    { type: 'talk', npc: NPC },
    { type: 'choose', index: 1 },
  ]);
  assert.equal(count(campaign, 'artefact'), 0);
  assert.equal(campaign.player.roubles, 520);
  assert.equal(campaign.reputation.solitaires, 3);
  assert.equal(campaign.dialogue.node, 'merci');
  const types = events.map((e) => e.type);
  assert.deepEqual(types.slice(2), ['item-removed', 'roubles-changed', 'reputation-changed', 'dialogue-node']);
  assert.deepEqual(events[2], { type: 'item-removed', kind: 'artefact', cause: 'dialogue' });
  assert.deepEqual(events[3], { type: 'roubles-changed', amount: 500, roubles: 520 });
  assert.deepEqual(events[4], { type: 'reputation-changed', faction: 'solitaires', amount: 1, reputation: 3 });
});

test('effet réputation : piste bornée à -3..3, faction absente partant de 0', () => {
  const draft = campaignWith({ reputation: { solitaires: 3 } });
  const emitted = [];
  const ctx = { emit: (e) => emitted.push(e) };
  EFFECTS.reputation(draft, { type: 'reputation', faction: 'solitaires', amount: 2 }, ctx);
  EFFECTS.reputation(draft, { type: 'reputation', faction: 'bandits', amount: -5 }, ctx);
  assert.deepEqual(draft.reputation, { solitaires: 3, bandits: -3 });
});

test('effet donner un objet, puis fin du dialogue', () => {
  const start = campaignWith();
  const bandages = count(start, 'bandage');
  const { campaign, events } = play(start, [
    { type: 'talk', npc: NPC },
    { type: 'choose', index: 0 },
    { type: 'choose', index: 0 },
  ]);
  assert.equal(count(campaign, 'bandage'), bandages + 1);
  assert.equal(campaign.screen, 'tile');
  assert.ok(events.some((e) => e.type === 'item-gained' && e.kind === 'bandage'));
});

test('un effet impossible refuse tout le choix sans rien appliquer', () => {
  // Inventaire plein : le bandage offert ne rentre pas.
  const full = campaignWith();
  while (full.inventory.reduce((n, item) => n + item.size, 0) < 12) full.inventory.push(createItem('ration'));
  const open = play(full, [{ type: 'talk', npc: NPC }, { type: 'choose', index: 0 }]).campaign;
  const result = step(open, { type: 'choose', index: 0 });
  assert.equal(result.state, open);
  assert.equal(result.events[0].reason, 'inventory-full');
});

test('roubles insuffisants pour un effet négatif : refus', () => {
  const draft = campaignWith({ roubles: 50 });
  const reason = EFFECTS.roubles(draft, { type: 'roubles', amount: -100 }, { emit() {} });
  assert.equal(reason, 'not-enough-roubles');
});

test('un effet sans hook enregistré refuse le choix ; une carte peut le brancher', () => {
  const start = campaignWith({ reputation: { solitaires: 2 }, rank: 'experimente' });
  const open = play(start, [{ type: 'talk', npc: NPC }, { type: 'choose', index: 2 }]).campaign;
  assert.equal(open.dialogue.node, 'confidence');
  // L'effet quete est branché par rules/quests.js (carte 15) : on le retire le temps du test.
  const branched = EFFECTS.quete;
  delete EFFECTS.quete;
  try {
    const refused = step(open, { type: 'choose', index: 0 });
    assert.equal(refused.state, open);
    assert.equal(refused.events[0].reason, 'unknown-effect');

    EFFECTS.quete = (draft, effect, ctx) => {
      draft.quests[effect.quest] = { step: 'debut' };
      ctx.emit({ type: 'quest-started', quest: effect.quest });
    };
    const { state, events } = step(open, { type: 'choose', index: 0 });
    assert.deepEqual(state.quests['le-guide'], { step: 'debut' });
    assert.equal(state.screen, 'tile');
    assert.deepEqual(events.map((e) => e.type), ['quest-started', 'dialogue-ended']);
  } finally {
    EFFECTS.quete = branched;
  }
});

test('une campagne en plein dialogue reste sérialisable et rejoue à l\'identique', () => {
  const actions = [{ type: 'talk', npc: NPC }, { type: 'choose', index: 0 }];
  const a = play(campaignWith(), actions).campaign;
  const b = play(jsonCopy(campaignWith()), actions).campaign;
  assert.deepEqual(jsonCopy(a), a);
  assert.deepEqual(a, b);
  const next = step(jsonCopy(a), { type: 'choose', index: 0 }).state;
  assert.equal(next.screen, 'tile');
});

// --- Format (LBL-47) ---------------------------------------------------------------------

test('un choix porte une liste de conditions, toutes requises', () => {
  const start = campaignWith({ reputation: { solitaires: 2 } });
  const open = step(start, { type: 'talk', npc: NPC }).state;
  assert.equal(dialogueView(open).choices[2].available, false, 'réputation seule : rang manquant');
  const both = step(campaignWith({ reputation: { solitaires: 2 }, rank: 'experimente' }), { type: 'talk', npc: NPC }).state;
  assert.equal(dialogueView(both).choices[2].available, true);
});

test('next absent ferme le dialogue comme next null', () => {
  DIALOGUES['court-test'] = Object.freeze({ start: 'a', nodes: { a: { text: '…', choices: [{ text: 'Salut.' }] } } });
  try {
    const open = step(campaignWith(), { type: 'talk', npc: 'court-test' }).state;
    assert.equal(open.dialogue.dialogue, 'court-test', 'sans champ id, l\'id du dialogue est celui du PNJ');
    const { state, events } = step(open, { type: 'choose', index: 0 });
    assert.equal('dialogue' in state, false);
    assert.deepEqual(events.at(-1), { type: 'dialogue-ended', npc: 'court-test', dialogue: 'court-test', node: 'a' });
  } finally {
    delete DIALOGUES['court-test'];
  }
});

test('les effets d\'un nœud s\'appliquent à l\'arrivée ; un refus annule le choix', () => {
  DIALOGUES['prime-test'] = Object.freeze({
    start: 'a',
    nodes: {
      a: { text: 'Voilà ta prime.', effects: [{ type: 'roubles', amount: 100 }], choices: [{ text: 'Encore.', next: 'b' }] },
      b: { text: 'Rends-la.', effects: [{ type: 'roubles', amount: -1000 }], choices: [] },
    },
  });
  try {
    const start = campaignWith({ roubles: 0 });
    const { state, events } = step(start, { type: 'talk', npc: 'prime-test' });
    assert.equal(state.player.roubles, 100);
    assert.deepEqual(events.map((e) => e.type), ['dialogue-started', 'dialogue-node', 'roubles-changed']);
    const refused = step(state, { type: 'choose', index: 0 });
    assert.equal(refused.state, state);
    assert.equal(refused.events[0].reason, 'not-enough-roubles');
  } finally {
    delete DIALOGUES['prime-test'];
  }
});
