// Quêtes (brief v2 §8.1, §8.2, §8.5 ; carte 15). Contenu : src/content/quetes/.
//
// FORMAT D'UNE QUÊTE : celui de la collection quests de src/content/validate.js :
//   { name, giver?, start, deadline?, rewards?, steps: { [stepId]: { objective, next } } }
//   deadline : délai en jours, compté depuis le jour du départ (voir DÉLAI).
//   rewards  : { roubles?, xp?, reputation?: { [factionId]: n }, items?: [itemId] }.
//   next     : [] fin de la quête ; [id] suite ; [a, b…] embranchement (voir EMBRANCHEMENT).
//
// OBJECTIFS (objective.type, OBJECTIVES de validate.js), vérifiés après chaque step accepté :
//   'visiter'       { place }            événement place-entered du lieu
//   'explorer'      { place, card, position? }  événement place-card de cette carte du lieu.
//                                        À l'entrée dans l'étape, la carte est fixée dans le
//                                        paquet du lieu (fixCard de rules/places.js) à la position
//                                        donnée ; hypothèse v2 : 1 par défaut (la carte suivante).
//   'parler'        { npc, node? }       événement dialogue-node du PNJ à ce nœud ; sans node,
//                                        le début du dialogue suffit (dialogue-started)
//   'rapporter'     { item, npc }        dialogue-started avec le PNJ, l'objet dans l'inventaire.
//                                        Hypothèse v2 : l'objet est remis (retiré, item-removed).
//   'eliminer'      { encounter, tile? } victoire sur la carte de rencontre encounter (combat v2
//                                        combat-ended 'victory', ou combat v1 fight gagné), sur la
//                                        tuile tile si elle est donnée. Hypothèse v2 : la
//                                        « rencontre nommée » est l'id d'une carte de rencontre.
//   'escorter'      { npc, place }       place-entered du lieu, le PNJ vivant. Hypothèse v2 : le
//                                        PNJ ne suit pas pas à pas ; il est posé dans le lieu
//                                        à l'arrivée.
//   'cartographier' { tile }             tous les jetons suspects de la tuile révélés (état)
//   'survivre'      { day } | { emission: true }  campaign.day >= day ; ou événement
//                                        emission-aftermath (rules/emission.js)
//   Un objectif rempli par des événements ne compte que ceux du step où l'étape est active :
//   après un changement d'étape dans la même réaction, seule l'étape suivante est revue sur
//   l'état (cartographier, survivre { day }).
//
// EMBRANCHEMENT (§8.2, « selon un choix de dialogue ») : l'objectif d'une étape à plusieurs
//   suites rempli, la quête attend (waiting) ; un effet 'avancer' d'un choix de dialogue choisit
//   la suite. 'avancer' vers une suite de l'étape courante est permis à tout moment : le choix
//   de dialogue vaut alors objectif (hypothèse v2).
//
// DÉLAI : deadline jours après le jour du départ ; la quête est ratée quand campaign.day
//   dépasse started + deadline (hypothèse v2 : le jour du départ ne compte pas).
// ÉCHEC : délai dépassé ('deadline') ; PNJ de l'objectif courant mort ('npc-dead',
//   hypothèse v2 : une quête qui a besoin d'un PNJ mort est ratée).
// RÉCOMPENSES (à la fin) : roubles, XP (gainXp, cause 'quete'), réputation (changeReputation),
//   objets. Hypothèse v2 : un objet qui ne tient pas dans l'inventaire est perdu (item-lost).
//
// ÉTAT : campaign.quests[id] = { status, step, started, deadline, waiting, history, reason? }
//   status  'active' | 'done' | 'failed' ; step : étape courante (dernière étape une fois finie)
//   started jour du départ ; deadline : jour limite ou null ; waiting : objectif d'un
//   embranchement rempli, en attente du choix ; history : étapes passées, dans l'ordre ;
//   reason : cause de l'échec ; quest : la quête elle-même, pour une quête générée (contrat).
//   campaign.journal (PDA) reçoit { day, kind, quest, step } à chaque événement de quête.
//
// EFFETS DE DIALOGUE (EFFECTS de rules/dialogue.js) :
//   { type: 'quete', quest }          démarre la quête. Refus : 'unknown-quest' | 'quest-known'
//   { type: 'avancer', quest, step }  passe à la suite step. Refus : 'quest-not-active'
//                                     | 'bad-step' (pas une suite de l'étape courante)
//   La condition { type: 'quete', quest, step?, status? } de dialogue.js lit campaign.quests[quest].
//
// RÉACTION (REACTIONS de campaign.js) : questsAfterStep(draft, events, ctx).
//
// LECTURE (pure, pour le PDA, §8.5) : questLog(campaign) ->
//   { active: [{ quest, name, step, objective, target, deadline, daysLeft, waiting, options }],
//     done: [{ quest, name, step }], failed: [{ quest, name, step, reason }] }
//   target : { tile, place?, hex? } lieu cible à marquer sur la carte du monde et sur la tuile,
//   ou null ; options : suites d'un embranchement en attente, sinon [].
//
// QUESTS : quêtes en plus du contenu (tests), lues avant content.quests.
// QUÊTES GÉNÉRÉES (contrats, rules/contracts.js) : startQuest(draft, id, ctx, quest) range la
//   quête dans campaign.quests[id].quest, lue avant QUESTS et le contenu.
//
// ÉVÉNEMENTS :
//   { type: 'quest-started', quest }   { type: 'quest-step', quest, step }
//   { type: 'quest-branch', quest, step, options }   { type: 'quest-completed', quest }
//   { type: 'quest-failed', quest, step, reason }    { type: 'item-lost', kind, cause: 'quete' }
//   { type: 'item-removed', kind, cause: 'quete' }   et ceux des récompenses (roubles-changed,
//   xp-gained, rank-up, reputation-changed, item-gained).

import content from '../../content/index.js';
import { EFFECTS } from './dialogue.js';
import { fixCard, PLACES } from './places.js';
import { gainXp } from './progression.js';
import { changeReputation } from './factions.js';
import { INVENTORY_SLOTS, createItem, usedSlots } from './sheet.js';

export const QUESTS = {};

// Hypothèse v2 : la carte d'un objectif 'explorer' sort en premier si rien d'autre n'est dit.
const EXPLORE_POSITION = 1;

const questOf = (id, campaign) => campaign.quests[id]?.quest ?? QUESTS[id] ?? content.quests?.[id];
const placeOf = (id) => PLACES[id] ?? content.places?.[id];
const has = (events, predicate) => events.some(predicate);

const OBJECTIVE_MET = {
  visiter: (o, draft, events) => has(events, (e) => e.type === 'place-entered' && e.place === o.place),
  explorer: (o, draft, events) =>
    has(events, (e) => e.type === 'place-card' && e.place === o.place && e.card === o.card),
  parler: (o, draft, events) => has(events, (e) => e.npc === o.npc && (o.node === undefined
    ? e.type === 'dialogue-started'
    : e.type === 'dialogue-node' && e.node === o.node)),
  rapporter: (o, draft, events) =>
    has(events, (e) => e.type === 'dialogue-started' && e.npc === o.npc)
    && draft.inventory.some((item) => item.kind === o.item),
  eliminer: (o, draft, events) =>
    (o.tile === undefined || draft.world.currentTile === o.tile)
    && has(events, (e) => e.card === o.encounter
      && ((e.type === 'combat-ended' && e.outcome === 'victory') || (e.type === 'fight' && e.won))),
  escorter: (o, draft, events) =>
    draft.npcs[o.npc]?.alive === true && OBJECTIVE_MET.visiter(o, draft, events),
  cartographier: (o, draft) => {
    const tokens = draft.world.tiles[o.tile]?.tokens;
    return Boolean(tokens) && tokens.every((token) => token.revealed);
  },
  survivre: (o, draft, events) => (o.day !== undefined
    ? draft.day >= o.day
    : o.emission === true && has(events, (e) => e.type === 'emission-aftermath')),
};

// Effets d'un objectif rempli, avant le passage à la suite.
const ON_MET = {
  rapporter: (o, draft, ctx) => {
    draft.inventory.splice(draft.inventory.findIndex((item) => item.kind === o.item), 1);
    ctx.emit({ type: 'item-removed', kind: o.item, cause: 'quete' });
  },
  escorter: (o, draft) => {
    Object.assign(draft.npcs[o.npc], { place: o.place, tile: placeOf(o.place).tile });
  },
};

export function startQuest(draft, id, ctx, generated) {
  if (draft.quests[id]) return 'quest-known';
  const quest = generated ?? questOf(id, draft);
  if (!quest) return 'unknown-quest';
  draft.quests[id] = {
    status: 'active',
    step: quest.start,
    started: draft.day,
    deadline: quest.deadline === undefined ? null : draft.day + quest.deadline,
    waiting: false,
    history: [],
    ...(generated && { quest: generated }),
  };
  ctx.emit({ type: 'quest-started', quest: id });
  note(draft, 'quest-started', id);
  enterStep(draft, id, quest.start, ctx);
}

export function advanceQuest(draft, id, stepId, ctx) {
  const state = draft.quests[id];
  if (state?.status !== 'active') return 'quest-not-active';
  if (!stepOf(draft, id, state.step).next.includes(stepId)) return 'bad-step';
  enterStep(draft, id, stepId, ctx);
}

export function questsAfterStep(draft, events, ctx) {
  for (const id of Object.keys(draft.quests)) {
    const state = draft.quests[id];
    let seen = events;
    while (state.status === 'active') {
      // Un embranchement en attente reste soumis au délai et aux morts.
      const reason = failureOf(draft, id);
      if (reason) fail(draft, id, reason, ctx);
      if (reason || state.waiting) break;
      const { objective } = stepOf(draft, id, state.step);
      if (!OBJECTIVE_MET[objective.type](objective, draft, seen)) break;
      ON_MET[objective.type]?.(objective, draft, ctx);
      completeStep(draft, id, ctx);
      seen = [];
    }
  }
}

export function questLog(campaign) {
  const log = { active: [], done: [], failed: [] };
  for (const [id, state] of Object.entries(campaign.quests)) {
    const { name } = questOf(id, campaign);
    if (state.status === 'done') log.done.push({ quest: id, name, step: state.step });
    else if (state.status === 'failed') log.failed.push({ quest: id, name, step: state.step, reason: state.reason });
    else {
      const { objective, next } = stepOf(campaign, id, state.step);
      log.active.push({
        quest: id,
        name,
        step: state.step,
        objective,
        target: targetOf(objective, campaign),
        deadline: state.deadline,
        daysLeft: state.deadline === null ? null : state.deadline - campaign.day,
        waiting: state.waiting,
        options: state.waiting ? next : [],
      });
    }
  }
  return log;
}

function stepOf(campaign, id, stepId) {
  const step = questOf(id, campaign).steps[stepId];
  return { ...step, next: step.next ?? [] };
}

function enterStep(draft, id, stepId, ctx) {
  const state = draft.quests[id];
  state.step = stepId;
  state.waiting = false;
  state.history.push(stepId);
  ctx.emit({ type: 'quest-step', quest: id, step: stepId });
  note(draft, 'quest-step', id);
  const { objective } = stepOf(draft, id, stepId);
  if (objective.type === 'explorer') {
    fixCard(draft, objective.place, objective.card, objective.position ?? EXPLORE_POSITION);
  }
}

function completeStep(draft, id, ctx) {
  const state = draft.quests[id];
  const { next } = stepOf(draft, id, state.step);
  if (next.length === 0) finish(draft, id, ctx);
  else if (next.length === 1) enterStep(draft, id, next[0], ctx);
  else {
    state.waiting = true;
    ctx.emit({ type: 'quest-branch', quest: id, step: state.step, options: next });
    note(draft, 'quest-branch', id);
  }
}

function failureOf(draft, id) {
  const state = draft.quests[id];
  if (state.deadline !== null && draft.day > state.deadline) return 'deadline';
  const { npc } = stepOf(draft, id, state.step).objective;
  if (npc && draft.npcs[npc]?.alive === false) return 'npc-dead';
}

function finish(draft, id, ctx) {
  const state = draft.quests[id];
  state.status = 'done';
  ctx.emit({ type: 'quest-completed', quest: id });
  note(draft, 'quest-completed', id);
  giveRewards(draft, questOf(id, draft).rewards ?? {}, ctx);
}

function fail(draft, id, reason, ctx) {
  const state = draft.quests[id];
  state.status = 'failed';
  state.reason = reason;
  ctx.emit({ type: 'quest-failed', quest: id, step: state.step, reason });
  note(draft, 'quest-failed', id);
}

function giveRewards(draft, { roubles, xp, reputation = {}, items = [] }, ctx) {
  if (roubles) {
    draft.player.roubles += roubles;
    ctx.emit({ type: 'roubles-changed', amount: roubles, roubles: draft.player.roubles });
  }
  if (xp) gainXp(draft, xp, 'quete', ctx);
  for (const [faction, amount] of Object.entries(reputation)) changeReputation(draft, faction, amount, ctx);
  for (const kind of items) {
    const item = createItem(kind);
    if (usedSlots(draft.inventory) + item.size > INVENTORY_SLOTS) {
      ctx.emit({ type: 'item-lost', kind, cause: 'quete' });
      continue;
    }
    draft.inventory.push(item);
    ctx.emit({ type: 'item-gained', kind, cause: 'quete' });
  }
}

function targetOf(objective, campaign) {
  if (objective.place) {
    const { tile, hex } = placeOf(objective.place);
    return { tile, place: objective.place, hex };
  }
  const npc = objective.npc && campaign.npcs[objective.npc];
  if (npc?.place) return { tile: npc.tile, place: npc.place, hex: placeOf(npc.place).hex };
  if (npc?.tile) return { tile: npc.tile };
  if (objective.tile) return { tile: objective.tile };
  return null;
}

function note(draft, kind, id) {
  draft.journal.push({ day: draft.day, kind, quest: id, step: draft.quests[id].step });
}

EFFECTS.quete = (draft, effect, ctx) => startQuest(draft, effect.quest, ctx);
EFFECTS.avancer = (draft, effect, ctx) => advanceQuest(draft, effect.quest, effect.step, ctx);
