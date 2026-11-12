// Quêtes (carte 15) : règles de src/engine/rules/quests.js, contenu de src/content/quetes/.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import content from '../src/content/index.js';
import { createCampaign, step } from '../src/engine/campaign.js';
import { DIALOGUES, evaluate } from '../src/engine/rules/dialogue.js';
import { PLACES, DECKS } from '../src/engine/rules/places.js';
import { createItem } from '../src/engine/rules/sheet.js';
import { QUESTS, startQuest, advanceQuest, questsAfterStep, questLog } from '../src/engine/rules/quests.js';

// Lieu factice sur l'hexagone de départ du Cordon (5), avec un paquet de deux cartes.
PLACES['lieu-quete'] = { name: 'Lieu de quête', label: 'Тест', tile: 'cordon', hex: 5, tags: [], deck: 'lieu-quete' };
DECKS['lieu-quete'] = {
  kind: 'exploration',
  place: 'lieu-quete',
  cards: [{ id: 'vide', type: 'rien' }, { id: 'cadavre', type: 'rien', text: 'Un courrier mort.' }],
};

// PNJ factice (hors content.npcs : talk sans contrôle de présence).
DIALOGUES.donneur = {
  start: 'accueil',
  nodes: {
    accueil: {
      text: 'Du travail ?',
      choices: [
        { text: 'Oui.', next: 'offre', effects: [{ type: 'quete', quest: 'fourche' }] },
        { text: 'Le choix.', next: 'choix', conditions: [{ type: 'quete', quest: 'fourche', step: 'debut' }] },
        { text: 'Au revoir.' },
      ],
    },
    offre: { text: 'Viens me voir.', choices: [{ text: 'D’accord.' }] },
    choix: {
      text: 'Par où ?',
      choices: [
        { text: 'La ferme.', effects: [{ type: 'avancer', quest: 'fourche', step: 'ferme' }] },
        { text: 'Le lieu.', effects: [{ type: 'avancer', quest: 'fourche', step: 'lieu' }] },
        { text: 'Ailleurs.', effects: [{ type: 'avancer', quest: 'fourche', step: 'fin' }] },
      ],
    },
  },
};

QUESTS.fourche = {
  name: 'La fourche',
  giver: 'donneur',
  start: 'debut',
  deadline: 3,
  rewards: { roubles: 200, xp: 50, reputation: { solitaires: 1 }, items: ['bandage'] },
  steps: {
    debut: { objective: { type: 'parler', npc: 'donneur', node: 'choix' }, next: ['ferme', 'lieu'] },
    ferme: { objective: { type: 'visiter', place: 'ferme-cordon' }, next: ['fin'] },
    lieu: { objective: { type: 'visiter', place: 'lieu-quete' }, next: ['fin'] },
    fin: { objective: { type: 'parler', npc: 'donneur' }, next: [] },
  },
};

const single = (objective) => ({ name: 'Une étape', start: 'seule', steps: { seule: { objective, next: [] } } });

QUESTS.visite = single({ type: 'visiter', place: 'lieu-quete' });
QUESTS.fouille = single({ type: 'explorer', place: 'lieu-quete', card: 'cadavre' });
QUESTS.colis = single({ type: 'rapporter', item: 'bandage', npc: 'donneur' });
QUESTS.chasse = single({ type: 'eliminer', encounter: 'chiens', tile: 'cordon' });
QUESTS.escorte = single({ type: 'escorter', npc: 'tolik', place: 'ferme-cordon' });
QUESTS.carte = single({ type: 'cartographier', tile: 'cordon' });
QUESTS.jour = single({ type: 'survivre', day: 4 });
QUESTS.emission = single({ type: 'survivre', emission: true });
QUESTS.chaine = {
  name: 'Chaîne',
  start: 'a',
  steps: {
    a: { objective: { type: 'visiter', place: 'lieu-quete' }, next: ['b'] },
    b: { objective: { type: 'visiter', place: 'lieu-quete' }, next: ['c'] },
    c: { objective: { type: 'survivre', day: 1 }, next: [] },
  },
};

function fakeCtx() {
  const events = [];
  return { events, rng: { next: () => 0.5, pick: (items) => items[0] }, emit: (e) => events.push(e) };
}

function campaignWith(change = () => {}) {
  const campaign = createCampaign({ seed: 11 });
  campaign.world.tiles.cordon.zone.deck = [];
  change(campaign);
  return campaign;
}

// Campagne avec la quête déjà démarrée (hors step).
function withQuest(id, change = () => {}) {
  return campaignWith((campaign) => {
    startQuest(campaign, id, fakeCtx());
    change(campaign);
  });
}

// Fait réagir les quêtes à des événements, comme après un step.
function react(campaign, events) {
  const draft = structuredClone(campaign);
  const ctx = fakeCtx();
  questsAfterStep(draft, events, ctx);
  return { campaign: draft, events: ctx.events };
}

function play(campaign, actions) {
  const events = [];
  for (const action of actions) {
    const result = step(campaign, action);
    assert.notEqual(result.events[0]?.type, 'refused', JSON.stringify(result.events[0]));
    campaign = result.state;
    events.push(...result.events);
  }
  return { campaign, events };
}

const types = (events) => events.map((e) => e.type);

// --- Démarrer, avancer --------------------------------------------------------------------

test('démarrer une quête : état sérialisable, étape de départ, délai, journal', () => {
  const campaign = campaignWith((c) => { c.day = 2; });
  const ctx = fakeCtx();
  assert.equal(startQuest(campaign, 'fourche', ctx), undefined);
  assert.deepEqual(campaign.quests.fourche, {
    status: 'active', step: 'debut', started: 2, deadline: 5, waiting: false, history: ['debut'],
  });
  assert.deepEqual(types(ctx.events), ['quest-started', 'quest-step']);
  assert.deepEqual(campaign.journal.map((j) => j.kind), ['quest-started', 'quest-step']);
  assert.deepEqual(JSON.parse(JSON.stringify(campaign.quests)), campaign.quests);
});

test('démarrer : refus quête inconnue, quête déjà connue ; sans délai, deadline null', () => {
  const campaign = campaignWith();
  assert.equal(startQuest(campaign, 'nulle-part', fakeCtx()), 'unknown-quest');
  startQuest(campaign, 'visite', fakeCtx());
  assert.equal(campaign.quests.visite.deadline, null);
  assert.equal(startQuest(campaign, 'visite', fakeCtx()), 'quest-known');
});

test('avancer : seulement vers une suite de l’étape courante d’une quête active', () => {
  const campaign = withQuest('fourche');
  assert.equal(advanceQuest(campaign, 'fourche', 'fin', fakeCtx()), 'bad-step');
  assert.equal(advanceQuest(campaign, 'visite', 'seule', fakeCtx()), 'quest-not-active');
  assert.equal(advanceQuest(campaign, 'fourche', 'lieu', fakeCtx()), undefined);
  assert.equal(campaign.quests.fourche.step, 'lieu');
  assert.deepEqual(campaign.quests.fourche.history, ['debut', 'lieu']);
});

// --- Embranchement par le dialogue (step complet) ---------------------------------------

test('embranchement : parler jusqu’au nœud met la quête en attente, le choix de dialogue choisit la suite', () => {
  const start = campaignWith();
  let { campaign, events } = play(start, [
    { type: 'talk', npc: 'donneur' }, { type: 'choose', index: 0 }, { type: 'choose', index: 0 },
  ]);
  assert.equal(campaign.quests.fourche.step, 'debut');
  assert.ok(types(events).includes('quest-started'));

  ({ campaign, events } = play(campaign, [{ type: 'talk', npc: 'donneur' }, { type: 'choose', index: 1 }]));
  assert.equal(campaign.quests.fourche.waiting, true);
  const branch = events.find((e) => e.type === 'quest-branch');
  assert.deepEqual(branch, { type: 'quest-branch', quest: 'fourche', step: 'debut', options: ['ferme', 'lieu'] });
  assert.deepEqual(questLog(campaign).active[0].options, ['ferme', 'lieu']);

  const refused = step(campaign, { type: 'choose', index: 2 });
  assert.equal(refused.events[0].reason, 'bad-step');

  ({ campaign, events } = play(campaign, [{ type: 'choose', index: 1 }]));
  assert.equal(campaign.quests.fourche.step, 'lieu');
  assert.equal(campaign.quests.fourche.waiting, false);
  assert.equal(evaluate({ type: 'quete', quest: 'fourche', step: 'lieu' }, campaign), true);
});

test('une quête menée au bout par step : visiter le lieu, revenir parler, récompenses', () => {
  let campaign = withQuest('fourche', (c) => advanceQuest(c, 'fourche', 'lieu', fakeCtx()));
  ({ campaign } = play(campaign, [{ type: 'enter-place', place: 'lieu-quete' }, { type: 'leave-place' }]));
  assert.equal(campaign.quests.fourche.step, 'fin');
  const before = campaign.player.roubles;
  const { events } = ({ campaign } = play(campaign, [{ type: 'talk', npc: 'donneur' }]));
  assert.equal(campaign.quests.fourche.status, 'done');
  assert.equal(campaign.player.roubles, before + 200);
  assert.equal(campaign.player.xp, 50);
  assert.equal(campaign.reputation.solitaires, content.factions.solitaires.start + 1);
  assert.ok(campaign.inventory.filter((i) => i.kind === 'bandage').length >= 1);
  assert.deepEqual(
    types(events).filter((t) => ['quest-completed', 'roubles-changed', 'xp-gained', 'reputation-changed', 'item-gained'].includes(t)),
    ['quest-completed', 'roubles-changed', 'xp-gained', 'reputation-changed', 'item-gained'],
  );
  assert.deepEqual(questLog(campaign).done, [{ quest: 'fourche', name: 'La fourche', step: 'fin' }]);
});

// --- Objectifs ----------------------------------------------------------------------------

test('visiter : seul l’événement place-entered du bon lieu compte', () => {
  const campaign = withQuest('visite');
  assert.equal(react(campaign, [{ type: 'place-entered', place: 'atp' }]).campaign.quests.visite.status, 'active');
  assert.equal(react(campaign, [{ type: 'place-entered', place: 'lieu-quete' }]).campaign.quests.visite.status, 'done');
});

test('explorer : la carte est fixée dans le paquet du lieu, la révéler remplit l’objectif', () => {
  const campaign = withQuest('fouille');
  assert.deepEqual(campaign.places['lieu-quete'].fixed, { 1: 'cadavre' });
  const { campaign: after, events } = play(campaign, [{ type: 'enter-place', place: 'lieu-quete' }, { type: 'explore' }]);
  assert.equal(events.find((e) => e.type === 'place-card').card, 'cadavre');
  assert.equal(after.quests.fouille.status, 'done');
});

test('parler : au nœud donné ; sans nœud, le début du dialogue', () => {
  const campaign = withQuest('fourche');
  const wrong = [{ type: 'dialogue-node', npc: 'donneur', node: 'offre' }];
  assert.equal(react(campaign, wrong).campaign.quests.fourche.waiting, false);
  const fin = withQuest('fourche', (c) => { c.quests.fourche.step = 'fin'; });
  assert.equal(react(fin, [{ type: 'dialogue-started', npc: 'donneur' }]).campaign.quests.fourche.status, 'done');
});

test('rapporter : parler au PNJ avec l’objet, qui est remis', () => {
  const without = withQuest('colis', (c) => { c.inventory = []; });
  assert.equal(react(without, [{ type: 'dialogue-started', npc: 'donneur' }]).campaign.quests.colis.status, 'active');
  const holding = withQuest('colis', (c) => { c.inventory = [createItem('bandage')]; });
  const { campaign, events } = react(holding, [{ type: 'dialogue-started', npc: 'donneur' }]);
  assert.equal(campaign.quests.colis.status, 'done');
  assert.deepEqual(campaign.inventory, []);
  assert.ok(events.some((e) => e.type === 'item-removed' && e.kind === 'bandage' && e.cause === 'quete'));
});

test('eliminer : victoire en combat v2 ou v1 sur la carte nommée, sur la bonne tuile', () => {
  const campaign = withQuest('chasse');
  const lost = [{ type: 'combat-ended', outcome: 'fled', card: 'chiens' }];
  assert.equal(react(campaign, lost).campaign.quests.chasse.status, 'active');
  const other = [{ type: 'combat-ended', outcome: 'victory', card: 'bandits' }];
  assert.equal(react(campaign, other).campaign.quests.chasse.status, 'active');
  assert.equal(react(campaign, [{ type: 'combat-ended', outcome: 'victory', card: 'chiens' }]).campaign.quests.chasse.status, 'done');
  assert.equal(react(campaign, [{ type: 'fight', card: 'chiens', won: true }]).campaign.quests.chasse.status, 'done');
  const away = withQuest('chasse', (c) => { c.world.currentTile = 'marais'; });
  assert.equal(react(away, [{ type: 'fight', card: 'chiens', won: true }]).campaign.quests.chasse.status, 'active');
});

test('escorter : arriver au lieu le PNJ vivant le pose dans le lieu ; PNJ mort, quête ratée', () => {
  const campaign = withQuest('escorte');
  const { campaign: after } = react(campaign, [{ type: 'place-entered', place: 'ferme-cordon' }]);
  assert.equal(after.quests.escorte.status, 'done');
  assert.equal(after.npcs.tolik.place, 'ferme-cordon');

  const dead = withQuest('escorte', (c) => { c.npcs.tolik.alive = false; });
  const { campaign: failed, events } = react(dead, []);
  assert.equal(failed.quests.escorte.status, 'failed');
  assert.deepEqual(events.find((e) => e.type === 'quest-failed'),
    { type: 'quest-failed', quest: 'escorte', step: 'seule', reason: 'npc-dead' });
});

test('cartographier : tous les jetons suspects de la tuile révélés', () => {
  const campaign = withQuest('carte');
  assert.equal(react(campaign, []).campaign.quests.carte.status, 'active');
  const mapped = withQuest('carte', (c) => {
    for (const token of c.world.tiles.cordon.tokens) token.revealed = true;
  });
  assert.equal(react(mapped, []).campaign.quests.carte.status, 'done');
});

test('survivre : être au jour J, ou passer l’Émission', () => {
  assert.equal(react(withQuest('jour', (c) => { c.day = 3; }), []).campaign.quests.jour.status, 'active');
  assert.equal(react(withQuest('jour', (c) => { c.day = 4; }), []).campaign.quests.jour.status, 'done');
  assert.equal(react(withQuest('emission'), [{ type: 'emission-ended' }]).campaign.quests.emission.status, 'done');
});

test('changement d’étape : les événements ne remplissent que l’étape active, l’état oui', () => {
  const campaign = withQuest('chaine');
  const { campaign: after } = react(campaign, [{ type: 'place-entered', place: 'lieu-quete' }]);
  assert.equal(after.quests.chaine.step, 'b');
  const { campaign: done } = react(after, [{ type: 'place-entered', place: 'lieu-quete' }]);
  assert.deepEqual(done.quests.chaine.history, ['a', 'b', 'c']);
  assert.equal(done.quests.chaine.status, 'done');
});

// --- Délai --------------------------------------------------------------------------------

test('délai : ratée quand le jour dépasse départ + délai, même en attente d’un choix', () => {
  const onTime = withQuest('fourche', (c) => { c.day = 4; });
  assert.equal(react(onTime, []).campaign.quests.fourche.status, 'active');
  const late = withQuest('fourche', (c) => { c.day = 5; c.quests.fourche.waiting = true; });
  const { campaign, events } = react(late, []);
  assert.equal(campaign.quests.fourche.status, 'failed');
  assert.equal(campaign.quests.fourche.reason, 'deadline');
  assert.ok(events.some((e) => e.type === 'quest-failed' && e.reason === 'deadline'));
  assert.deepEqual(questLog(campaign).failed, [{ quest: 'fourche', name: 'La fourche', step: 'debut', reason: 'deadline' }]);
  assert.equal(campaign.journal.at(-1).kind, 'quest-failed');
});

test('récompense : un objet qui ne tient pas dans l’inventaire est perdu', () => {
  const full = withQuest('fourche', (c) => {
    c.quests.fourche.step = 'fin';
    c.inventory = Array.from({ length: 20 }, () => createItem('bandage'));
  });
  const { campaign, events } = react(full, [{ type: 'dialogue-started', npc: 'donneur' }]);
  assert.equal(campaign.inventory.length, full.inventory.length);
  assert.ok(events.some((e) => e.type === 'item-lost' && e.kind === 'bandage'));
});

// --- Journal (§8.5) -----------------------------------------------------------------------

test('journal : étape en cours, objectif, lieu cible sur la carte et la tuile, jours restants', () => {
  const campaign = withQuest('fourche', (c) => {
    advanceQuest(c, 'fourche', 'ferme', fakeCtx());
    c.day = 2;
  });
  startQuest(campaign, 'escorte', fakeCtx());
  startQuest(campaign, 'carte', fakeCtx());
  startQuest(campaign, 'jour', fakeCtx());
  const { active } = questLog(campaign);
  assert.deepEqual(active[0], {
    quest: 'fourche',
    name: 'La fourche',
    step: 'ferme',
    objective: { type: 'visiter', place: 'ferme-cordon' },
    target: { tile: 'cordon', place: 'ferme-cordon', hex: content.places['ferme-cordon'].hex },
    deadline: 4,
    daysLeft: 2,
    waiting: false,
    options: [],
  });
  assert.deepEqual(active.map((q) => q.target), [
    { tile: 'cordon', place: 'ferme-cordon', hex: content.places['ferme-cordon'].hex },
    { tile: 'cordon', place: 'ferme-cordon', hex: content.places['ferme-cordon'].hex },
    { tile: 'cordon' },
    null,
  ]);
});

// --- Contenu ------------------------------------------------------------------------------

test('contenu : chaque quête secondaire a un donneur dont le dialogue la démarre', () => {
  const quests = Object.entries(content.quests);
  assert.ok(quests.length >= 3, `${quests.length} quêtes`);
  for (const [id, quest] of quests) {
    const dialogue = content.dialogues[content.npcs[quest.giver].dialogue];
    const starts = Object.values(dialogue.nodes)
      .flatMap((node) => [...(node.effects ?? []), ...node.choices.flatMap((c) => c.effects ?? [])])
      .some((effect) => effect.type === 'quete' && effect.quest === id);
    assert.ok(starts, `${id} : le dialogue de ${quest.giver} ne la démarre pas`);
  }
});

test('contenu : la dette de Bohdan se démarre et se choisit par le dialogue, au Camp des novices', () => {
  const camp = content.places['camp-novices'];
  const start = campaignWith((c) => { c.world.hex = camp.hex; });
  const dialogue = content.dialogues.bohdan;
  const index = (node, effectType) => dialogue.nodes[node].choices.findIndex((c) =>
    (c.effects ?? []).some((e) => e.type === effectType));
  const { campaign } = play(start, [
    { type: 'talk', npc: 'bohdan' }, { type: 'choose', index: index('accueil', 'quete') },
  ]);
  assert.equal(campaign.quests['dette-bohdan'].status, 'active');
  assert.equal(campaign.quests['dette-bohdan'].waiting, true);
  const { campaign: chosen } = play(campaign, [{ type: 'choose', index: index('dette', 'avancer') }]);
  assert.ok(content.quests['dette-bohdan'].steps.debut.next.includes(chosen.quests['dette-bohdan'].step));
});
