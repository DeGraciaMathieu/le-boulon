// Dialogues (brief v2 §7, carte 14) : nœuds, choix conditionnés, effets.
//
// FORMAT D'UN DIALOGUE (contenu gelé, carte 19 : src/content/dialogues/<pnj>.js) :
//   { id, debut, noeuds: [{ id, texte, choix: [choix] }] }
//   choix = { texte, vers?, condition?, effets? }
//     vers       id du nœud suivant ; absent : le choix ferme le dialogue
//     condition  voir CONDITIONS ; absente : toujours disponible
//     effets     [effet], appliqués dans l'ordre avant d'aller vers le nœud suivant
//
// CONDITIONS { type, ... } évaluées par evaluate(condition, campaign) -> bool (pure) :
//   { type: 'reputation', faction, min?, max? }   piste de la faction, absente = 0
//   { type: 'objet', objet }                      un objet de ce type dans l'inventaire
//   { type: 'rang', min?, max? }                  ids de RANKS, ordre du §11.1
//   { type: 'quete', quete, etape? }              quête démarrée, à l'étape donnée si précisée
//   { type: 'stat', stat, min?, max? }            player.stats[stat]
//   { type: 'roubles', min?, max? }
//   { type: 'tous', conditions } | { type: 'un', conditions } | { type: 'non', condition }
//   Bornes min et max incluses. Un type inconnu lève une erreur (faute de contenu).
//   Une autre carte ajoute ou remplace une condition : CONDITIONS[type] = (condition, campaign) -> bool.
//
// EFFETS { type, ... } appliqués par les hooks EFFECTS[type] (draft, effet, ctx) -> raison | undefined.
//   Comme un handler : une raison refuse tout le choix (le brouillon est jeté, rien n'est appliqué).
//   Branchés ici (champs déjà présents) :
//     { type: 'donner-objet', objet }          refus 'inventory-full'      -> item-gained
//     { type: 'prendre-objet', objet }         refus 'no-item'             -> item-removed
//     { type: 'roubles', montant }             refus 'not-enough-roubles'  -> roubles-changed
//     { type: 'reputation', faction, montant } piste bornée -3..3          -> reputation-changed
//     { type: 'rejoindre-faction', faction }   refus de joinFaction        -> faction-joined
//     (ces deux effets : src/engine/rules/factions.js, carte 16)
//   À brancher par leur carte : 'demarrer-quete' { quete }, 'avancer-quete' { quete, etape }
//   (carte 15), 'reveler-lieu' { lieu } (carte 10), 'reveler-planque' { planque } (carte 23) ;
//   la carte 16 peut remplacer 'reputation'. Un effet sans hook refuse le choix ('unknown-effect').
//
// ACTIONS DE CAMPAGNE (enregistrées dans CAMPAIGN_ACTIONS de campaign.js) :
//   { type: 'talk', npc }     ouvre le dialogue du PNJ au nœud debut, screen = 'dialogue'.
//                             Refus : 'unknown-npc' | 'already-talking'.
//   { type: 'choose', index } index dans node.choix (y compris les choix indisponibles).
//                             Refus : 'not-in-dialogue' | 'bad-choice' | 'choice-unavailable'
//                             | raison d'un effet. Sans 'vers' : fin, retour à l'écran d'avant.
//
// ÉTAT : campaign.dialogue = { npc, dialogue, node, previousScreen } pendant un dialogue
// seulement ; le champ est retiré à la fin.
//
// LECTURE (pure, pour l'UI) : dialogueView(campaign) -> null |
//   { npc, dialogue, node, texte, choix: [{ index, texte, disponible, condition? }] }
//
// DIALOGUES : où talk trouve l'arbre d'un PNJ. DIALOGUES[npc] d'abord (tests, ajouts), puis
// content.dialogues[npc] (carte 19).
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
  objet: (condition, campaign) => campaign.inventory.some((item) => item.kind === condition.objet),
  rang: (condition, campaign) => {
    const bounds = {
      min: condition.min === undefined ? undefined : RANKS.indexOf(condition.min),
      max: condition.max === undefined ? undefined : RANKS.indexOf(condition.max),
    };
    return within(RANKS.indexOf(campaign.player.rank), bounds);
  },
  // Hypothèse v2 : questState porte son étape courante dans `etape` (forme à fixer par la carte 15).
  quete: (condition, campaign) => {
    const quest = campaign.quests[condition.quete];
    if (!quest) return false;
    return condition.etape === undefined || quest.etape === condition.etape;
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

export const EFFECTS = {
  'donner-objet': (draft, effect, ctx) => {
    const item = createItem(effect.objet);
    if (usedSlots(draft.inventory) + item.size > INVENTORY_SLOTS) return 'inventory-full';
    draft.inventory.push(item);
    ctx.emit({ type: 'item-gained', kind: effect.objet, cause: 'dialogue' });
  },
  'prendre-objet': (draft, effect, ctx) => {
    const index = draft.inventory.findIndex((item) => item.kind === effect.objet);
    if (index < 0) return 'no-item';
    draft.inventory.splice(index, 1);
    ctx.emit({ type: 'item-removed', kind: effect.objet, cause: 'dialogue' });
  },
  roubles: (draft, effect, ctx) => {
    const roubles = draft.player.roubles + effect.montant;
    if (roubles < 0) return 'not-enough-roubles';
    draft.player.roubles = roubles;
    ctx.emit({ type: 'roubles-changed', amount: effect.montant, roubles });
  },
  reputation: (draft, effect, ctx) => changeReputation(draft, effect.faction, effect.montant, ctx),
  'rejoindre-faction': (draft, effect, ctx) => joinFaction(draft, effect.faction, ctx),
};

export function dialogueView(campaign) {
  if (!campaign.dialogue) return null;
  const { npc, dialogue } = campaign.dialogue;
  const node = currentNode(campaign);
  return {
    npc,
    dialogue,
    node: node.id,
    texte: node.texte,
    choix: node.choix.map((choice, index) => {
      const view = { index, texte: choice.texte, disponible: evaluate(choice.condition, campaign) };
      if (choice.condition) view.condition = choice.condition;
      return view;
    }),
  };
}

export function talk(draft, action, ctx) {
  if (draft.dialogue) return 'already-talking';
  const tree = dialogueOf(action.npc);
  if (!tree) return 'unknown-npc';

  draft.dialogue = { npc: action.npc, dialogue: tree.id, node: tree.debut, previousScreen: draft.screen };
  draft.screen = 'dialogue';
  ctx.emit({ type: 'dialogue-started', npc: action.npc, dialogue: tree.id });
  ctx.emit({ type: 'dialogue-node', npc: action.npc, dialogue: tree.id, node: tree.debut });
}

export function choose(draft, action, ctx) {
  if (!draft.dialogue) return 'not-in-dialogue';
  const node = currentNode(draft);
  const choice = Number.isInteger(action.index) ? node.choix[action.index] : undefined;
  if (!choice) return 'bad-choice';
  if (!evaluate(choice.condition, draft)) return 'choice-unavailable';

  const refusal = applyEffects(draft, choice.effets ?? [], ctx);
  if (refusal) return refusal;

  const { npc, dialogue, previousScreen } = draft.dialogue;
  if (choice.vers === undefined) {
    draft.screen = previousScreen;
    delete draft.dialogue;
    ctx.emit({ type: 'dialogue-ended', npc, dialogue, node: node.id });
    return;
  }
  draft.dialogue.node = choice.vers;
  ctx.emit({ type: 'dialogue-node', npc, dialogue, node: choice.vers });
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
  return DIALOGUES[npc] ?? content.dialogues?.[npc];
}

function currentNode(campaign) {
  const { npc, node } = campaign.dialogue;
  return dialogueOf(npc).noeuds.find((candidate) => candidate.id === node);
}
