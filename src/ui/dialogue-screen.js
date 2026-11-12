// Lectures de l'écran Dialogue (brief v2 §7, §16 ; carte 27) : portrait (pictogramme de
// faction), texte, choix numérotés, choix grisés avec leur condition. Pures : elles lisent la
// campagne et le contenu, sans rien modifier, et ne touchent pas au DOM (testées par
// tests/dialogue-screen.test.js). Fenêtre : src/ui/dialogue-window.js.
//
//   dialogueWindow(campaign)   -> null | { npc, name, faction, factionName, text,
//                                 choices: [{ index, number, text, available, requirement }] }
//     requirement : la condition du choix en clair (null sans condition)
//   conditionText(condition)   -> texte d'une condition de rules/dialogue.js
//   npcsHere(campaign)         -> [{ id, name }]  PNJ vivants du lieu de l'hexagone du joueur
//   dialogueLine(event)        -> ligne du journal pour un événement de dialogue, '' pour un
//                                 événement à taire, undefined s'il n'est pas de ce module

import content from '../content/index.js';
import { dialogueView } from '../engine/rules/dialogue.js';
import { npcsAt } from '../engine/rules/npcs.js';

const STATS = { tir: 'Tir', survie: 'Survie', discretion: 'Discrétion', endurance: 'Endurance' };
// Hypothèse v2 : noms affichés des rangs du §11.1 (ids de RANKS).
const RANK_NAMES = { bleu: 'Bleu', experimente: 'Expérimenté', veteran: 'Vétéran', expert: 'Expert', maitre: 'Maître' };

const npcName = (id) => content.npcs[id]?.name ?? id;
const factionName = (id) => content.factions[id]?.name ?? id;
const itemName = (id) => content.items[id]?.name ?? id;
const questName = (id) => content.quests[id]?.name ?? id;

function bounds(label, { min, max }, name = (value) => value) {
  if (min !== undefined && max !== undefined) return `${label} entre ${name(min)} et ${name(max)}`;
  if (min !== undefined) return `${label} ≥ ${name(min)}`;
  return `${label} ≤ ${name(max)}`;
}

const TEXTS = {
  reputation: (c) => bounds(`Réputation ${factionName(c.faction)}`, c),
  objet: (c) => `Avoir : ${itemName(c.item)}`,
  rang: (c) => bounds('Rang', c, (rank) => RANK_NAMES[rank] ?? rank),
  quete: (c) => `Quête « ${questName(c.quest)} »${c.step === undefined ? ' en cours' : ` à l'étape ${c.step}`}`,
  stat: (c) => bounds(STATS[c.stat] ?? c.stat, c),
  roubles: (c) => bounds('Roubles', c),
  tous: (c) => c.conditions.map(conditionText).join(' et '),
  un: (c) => c.conditions.map(conditionText).join(' ou '),
  non: (c) => (c.condition.type === 'quete' && c.condition.step === undefined
    ? `Quête « ${questName(c.condition.quest)} » pas encore prise`
    : `Pas : ${conditionText(c.condition)}`),
  'premiere-visite': () => 'Première rencontre',
};

export function conditionText(condition) {
  return TEXTS[condition.type]?.(condition) ?? condition.type;
}

export function dialogueWindow(campaign) {
  const view = dialogueView(campaign);
  if (!view) return null;
  const faction = content.npcs[view.npc]?.faction ?? null;
  return {
    npc: view.npc,
    name: npcName(view.npc),
    faction,
    factionName: faction ? factionName(faction) : null,
    text: view.text,
    choices: view.choices.map(({ index, text, available, conditions }) => ({
      index,
      number: index + 1,
      text,
      available,
      requirement: conditions ? conditions.map(conditionText).join(' et ') : null,
    })),
  };
}

export function npcsHere(campaign) {
  const { currentTile, hex } = campaign.world;
  const places = Object.entries(content.places)
    .filter(([, place]) => place.tile === currentTile && place.hex === hex)
    .map(([id]) => id);
  return places.flatMap((place) => npcsAt(campaign, place)).map((id) => ({ id, name: npcName(id) }));
}

const signed = (n) => (n >= 0 ? `+${n}` : `${n}`);

const LINES = {
  'dialogue-started': (e) => `Dialogue avec ${npcName(e.npc)}`,
  'dialogue-node': () => '',
  'dialogue-ended': (e) => `Fin du dialogue avec ${npcName(e.npc)}`,
  'npc-met': (e) => `Rencontre : ${npcName(e.npc)}`,
  'npc-helped': (e) => `${npcName(e.npc)} aidé`,
  'item-gained': (e) => `Reçu : ${itemName(e.kind)}`,
  'roubles-changed': (e) => `${signed(e.amount)} ₽ (${e.roubles} ₽)`,
  'reputation-changed': (e) => `Réputation ${factionName(e.faction)} ${signed(e.amount)} (${e.reputation})`,
  'faction-joined': (e) => `Faction rejointe : ${factionName(e.faction)}`,
};

const REFUSALS = {
  'npc-dead': 'ce PNJ est mort',
  'npc-not-here': "ce PNJ n'est pas ici",
  'already-talking': 'déjà en dialogue',
  'choice-unavailable': 'choix indisponible',
  'not-enough-roubles': 'pas assez de roubles',
};

export function dialogueLine(event) {
  if (event.type === 'refused') return REFUSALS[event.reason] && `Refusé : ${REFUSALS[event.reason]}`;
  // item-removed a une cause v1 ailleurs : seul celui du dialogue est d'ici.
  if (event.type === 'item-removed' && event.cause === 'dialogue') return `Donné : ${itemName(event.kind)}`;
  return LINES[event.type]?.(event);
}
