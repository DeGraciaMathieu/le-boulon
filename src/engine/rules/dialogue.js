// Dialogues (brief v2 §7, carte 14) : nœuds, choix conditionnés, effets.
//
// FORMAT D'UN DIALOGUE : celui de la collection dialogues de src/content/validate.js (LBL-47),
// contenu gelé de la carte 19 (src/content/dialogues/<pnj>.js) :
//   { id?, start, nodes: { [nodeId]: { text, effects?, choices: [choix] } } }
//   choix = { text, next?, conditions?, effects? }
//     next        id du nœud suivant ; null ou absent : le choix ferme le dialogue
//     conditions  [condition], toutes requises (voir CONDITIONS) ; absentes : toujours disponible
//     effects     [effet], appliqués dans l'ordre avant d'aller vers le nœud suivant
//   effects d'un nœud : appliqués à l'arrivée sur le nœud (talk pour start, choose sinon).
//   id : facultatif, l'id du dialogue est sinon celui du PNJ (clé de DIALOGUES ou de
//   content.dialogues).
//
// CONDITIONS { type, ... } évaluées par evaluate(condition, campaign) -> bool (pure) :
//   { type: 'reputation', faction, min?, max? }   piste de la faction, absente = 0
//   { type: 'objet', item }                       un objet de ce type dans l'inventaire
//   { type: 'rang', min?, max? }                  ids de RANKS, ordre du §11.1
//   { type: 'quete', quest, step? }               quête démarrée, à l'étape donnée si précisée
//   { type: 'stat', stat, min?, max? }            player.stats[stat]
//   { type: 'roubles', min?, max? }
//   { type: 'tous', conditions } | { type: 'un', conditions } | { type: 'non', condition }
//   Bornes min et max incluses. Un type inconnu lève une erreur (faute de contenu).
//   Une autre carte ajoute ou remplace une condition : CONDITIONS[type] = (condition, campaign) -> bool.
//
// EFFETS { type, ... } appliqués par les hooks EFFECTS[type] (draft, effet, ctx) -> raison | undefined.
//   Comme un handler : une raison refuse tout le choix (le brouillon est jeté, rien n'est appliqué).
//   Branchés ici (champs déjà présents) :
//     { type: 'donner', item }                 refus 'inventory-full'      -> item-gained
//     { type: 'prendre', item }                refus 'no-item'             -> item-removed
//     { type: 'roubles', amount }              refus 'not-enough-roubles'  -> roubles-changed
//     { type: 'reputation', faction, amount }  piste bornée -3..3          -> reputation-changed
//     { type: 'rejoindre-faction', faction }   refus de joinFaction        -> faction-joined
//     (ces deux effets : src/engine/rules/factions.js, carte 16)
//   À brancher par leur carte : 'quete' { quest } (démarrer), 'avancer' { quest, step }
//   (carte 15), 'reveler' { place } (carte 10) ou { stash } (carte 23) ;
//   la carte 16 peut remplacer 'reputation'. Un effet sans hook refuse le choix ('unknown-effect').
//
// ACTIONS DE CAMPAGNE (enregistrées dans CAMPAIGN_ACTIONS de campaign.js) :
//   { type: 'talk', npc }     ouvre le dialogue du PNJ au nœud start, screen = 'dialogue'.
//                             Refus : 'unknown-npc' | 'already-talking' | raison d'un effet.
//   { type: 'choose', index } index dans node.choices (y compris les choix indisponibles).
//                             Refus : 'not-in-dialogue' | 'bad-choice' | 'choice-unavailable'
//                             | raison d'un effet. Sans next : fin, retour à l'écran d'avant.
//
// ÉTAT : campaign.dialogue = { npc, dialogue, node, previousScreen } pendant un dialogue
// seulement ; le champ est retiré à la fin.
//
// LECTURE (pure, pour l'UI) : dialogueView(campaign) -> null |
//   { npc, dialogue, node, text, choices: [{ index, text, available, conditions? }] }
//
// DIALOGUES : où talk trouve l'arbre d'un PNJ. DIALOGUES[npc] d'abord (tests, ajouts), puis
// content.dialogues[content.npcs[npc].dialogue], ou content.dialogues[npc] (carte 19).
// L'action talk de campagne passe d'abord par talkTo (rules/npcs.js : PNJ vivant et présent).
//
// ÉVÉNEMENTS :
//   { type: 'dialogue-started', npc, dialogue }   { type: 'dialogue-node', npc, dialogue, node }
//   { type: 'dialogue-ended', npc, dialogue, node }  (node : le nœud quitté)
//   { type: 'item-gained', kind, cause: 'dialogue' }  { type: 'item-removed', kind, cause: 'dialogue' }
//   { type: 'roubles-changed', amount, roubles }  { type: 'reputation-changed', faction, amount, reputation }
//   'dialogue-node' sert à l'objectif « parler » des quêtes (§8.2).

import content from '../../content/index.js';
import { INVENTORY_SLOTS, createItem, usedSlots } from './sheet.js';
import { changeReputation, joinFaction } from './factions.js';

// Hypothèse v2 : ids des rangs du §11.1, sans accents, 'bleu' comme dans campaign.js.
export const RANKS = Object.freeze(['bleu', 'experimente', 'veteran', 'expert', 'maitre']);

export const DIALOGUES = {};

const within = (value, { min = -Infinity, max = Infinity }) => value >= min && value <= max;

export const CONDITIONS = {
  reputation: (condition, campaign) => within(campaign.reputation[condition.faction] ?? 0, condition),
  objet: (condition, campaign) => campaign.inventory.some((item) => item.kind === condition.item),
  rang: (condition, campaign) => {
    const bounds = {
      min: condition.min === undefined ? undefined : RANKS.indexOf(condition.min),
      max: condition.max === undefined ? undefined : RANKS.indexOf(condition.max),
    };
    return within(RANKS.indexOf(campaign.player.rank), bounds);
  },
  // Hypothèse v2 : questState porte son étape courante dans `etape` (forme à fixer par la carte 15).
  quete: (condition, campaign) => {
    const quest = campaign.quests[condition.quest];
    if (!quest) return false;
    return condition.step === undefined || quest.etape === condition.step;
  },
  stat: (condition, campaign) => within(campaign.player.stats[condition.stat], condition),
  roubles: (condition, campaign) => within(campaign.player.roubles, condition),
  tous: (condition, campaign) => condition.conditions.every((c) => evaluate(c, campaign)),
  un: (condition, campaign) => condition.conditions.some((c) => evaluate(c, campaign)),
  non: (condition, campaign) => !evaluate(condition.condition, campaign),
};

export function evaluate(condition, campaign) {
  if (!condition) return true;
  const check = CONDITIONS[condition.type];
  if (!check) throw new Error(`condition inconnue : ${condition.type}`);
  return check(condition, campaign);
}

const allMet = (conditions, campaign) => (conditions ?? []).every((c) => evaluate(c, campaign));

export const EFFECTS = {
  donner: (draft, effect, ctx) => {
    const item = createItem(effect.item);
    if (usedSlots(draft.inventory) + item.size > INVENTORY_SLOTS) return 'inventory-full';
    draft.inventory.push(item);
    ctx.emit({ type: 'item-gained', kind: effect.item, cause: 'dialogue' });
  },
  prendre: (draft, effect, ctx) => {
    const index = draft.inventory.findIndex((item) => item.kind === effect.item);
    if (index < 0) return 'no-item';
    draft.inventory.splice(index, 1);
    ctx.emit({ type: 'item-removed', kind: effect.item, cause: 'dialogue' });
  },
  roubles: (draft, effect, ctx) => {
    const roubles = draft.player.roubles + effect.amount;
    if (roubles < 0) return 'not-enough-roubles';
    draft.player.roubles = roubles;
    ctx.emit({ type: 'roubles-changed', amount: effect.amount, roubles });
  },
  reputation: (draft, effect, ctx) => changeReputation(draft, effect.faction, effect.amount, ctx),
  'rejoindre-faction': (draft, effect, ctx) => joinFaction(draft, effect.faction, ctx),
};

export function dialogueView(campaign) {
  if (!campaign.dialogue) return null;
  const { npc, dialogue } = campaign.dialogue;
  const node = currentNode(campaign);
  return {
    npc,
    dialogue,
    node: campaign.dialogue.node,
    text: node.text,
    choices: node.choices.map((choice, index) => {
      const view = { index, text: choice.text, available: allMet(choice.conditions, campaign) };
      if (choice.conditions) view.conditions = choice.conditions;
      return view;
    }),
  };
}

export function talk(draft, action, ctx) {
  if (draft.dialogue) return 'already-talking';
  const tree = dialogueOf(action.npc);
  if (!tree) return 'unknown-npc';

  const dialogue = tree.id ?? action.npc;
  draft.dialogue = { npc: action.npc, dialogue, node: tree.start, previousScreen: draft.screen };
  draft.screen = 'dialogue';
  ctx.emit({ type: 'dialogue-started', npc: action.npc, dialogue });
  return enterNode(draft, tree.start, ctx);
}

export function choose(draft, action, ctx) {
  if (!draft.dialogue) return 'not-in-dialogue';
  const node = currentNode(draft);
  const choice = Number.isInteger(action.index) ? node.choices[action.index] : undefined;
  if (!choice) return 'bad-choice';
  if (!allMet(choice.conditions, draft)) return 'choice-unavailable';

  const refusal = applyEffects(draft, choice.effects ?? [], ctx);
  if (refusal) return refusal;

  const { npc, dialogue, node: left, previousScreen } = draft.dialogue;
  if (choice.next === null || choice.next === undefined) {
    draft.screen = previousScreen;
    delete draft.dialogue;
    ctx.emit({ type: 'dialogue-ended', npc, dialogue, node: left });
    return;
  }
  return enterNode(draft, choice.next, ctx);
}

function enterNode(draft, nodeId, ctx) {
  const { npc, dialogue } = draft.dialogue;
  draft.dialogue.node = nodeId;
  ctx.emit({ type: 'dialogue-node', npc, dialogue, node: nodeId });
  return applyEffects(draft, currentNode(draft).effects ?? [], ctx);
}

function applyEffects(draft, effects, ctx) {
  for (const effect of effects) {
    const apply = EFFECTS[effect.type];
    if (!apply) return 'unknown-effect';
    const refusal = apply(draft, effect, ctx);
    if (refusal) return refusal;
  }
}

function dialogueOf(npc) {
  return DIALOGUES[npc] ?? content.dialogues?.[content.npcs?.[npc]?.dialogue ?? npc];
}

function currentNode(campaign) {
  const { npc, node } = campaign.dialogue;
  return dialogueOf(npc).nodes[node];
}
