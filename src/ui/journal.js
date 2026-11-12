// Journal façon PDA : chaque événement du moteur devient une ligne en français.
// Lecture seule : rien ici ne touche l'état ni le DOM (testé par tests/journal.test.js).
//
//   journalLine(event, campaign) -> texte de la ligne, '' pour un événement à taire ;
//                                   jamais l'identifiant brut d'un événement
//   journalLevel(event)          -> 'important' (quête, butin, blessure, alerte, refus)
//                                   | 'detail' (jets, déplacements, sauvegarde…)

import content from '../content/index.js';
import { ENCOUNTER_CARDS } from '../engine/rules/encounters.js';
import { tileArea, towards } from './hex-hints.js';
import { encounterCards } from '../engine/rules/tile.js';
import { HUB_LINES, HUB_REFUSALS } from './hub-view.js';
import { PLACE_LINES } from './place.js';
import { PDA_LINES, RANK_NAMES } from './pda.js';
import { INVENTORY_LINES } from './inventory.js';
import { combatLine } from './combat-screen.js';
import { dialogueLine, stepObjective } from './dialogue-screen.js';

export const ITEM_NAMES = {
  pistolet: 'Pistolet', munitions: 'Munitions', boulons: 'Boulons', bandage: 'Bandage',
  vodka: 'Vodka', ration: 'Ration', artefact: 'Artefact',
};

export const ANOMALY_NAMES = { electro: 'Électro', gravitationnelle: 'Gravitationnelle', bruleuse: 'Brûleuse' };

export const MISSION_NAMES = { recuperation: 'Récupération', cartographie: 'Cartographie' };

export const CAUSE_NAMES = {
  'mission-complete': 'Mission remplie, sortie de la tuile',
  'mission-failed': 'Sortie sans avoir rempli la mission',
  dead: 'Mort dans la Zone',
  night: 'La nuit tombe : plus de PA',
  emission: "Pris par l'Émission sans abri",
};

const STAT_NAMES = { tir: 'Tir', survie: 'Survie', discretion: 'Discrétion', endurance: 'Endurance' };

export const ZONE_CARD_NAMES = {
  patrouille: 'Patrouille', chiens: 'Chiens attirés', brouillard: 'Brouillard', cachette: 'Cachette',
  radio: 'Radio', calme: 'Calme', emission: 'Émission',
};

const REFUSALS = {
  'game-over': 'la partie est finie',
  'unknown-action': 'action inconnue',
  'not-adjacent': "hexagone pas adjacent",
  'not-enough-ap': 'pas assez de PA',
  'not-on-edge': "pas sur un hexagone de bord",
  'not-usable': 'objet inutilisable',
  'no-item': "objet absent de l'inventaire",
  blocked: 'anomalie sur la route',
  'in-combat': "en combat : combattre ou fuir d'abord",
  'not-in-combat': 'aucun combat en cours',
  fog: 'brouillard : impossible de lancer un boulon',
  'no-bolt': 'plus de boulons',
  'no-artefact': 'aucun artefact révélé ici',
  'inventory-full': 'inventaire plein',
};

const CAUSES = {
  radiation: 'radiations', emission: 'Émission', marais: 'marais', electro: 'anomalie électro',
  gravitationnelle: 'anomalie gravitationnelle', bruleuse: 'anomalie brûleuse', wounds: 'blessures',
  combat: 'combat', quete: 'quête', contrat: 'contrat', dialogue: 'dialogue', decouverte: 'découverte',
  nuit: 'nuit', faim: 'faim', fuite: 'fuite', blessure: 'blessure', ceinture: 'ceinture', piege: 'piège', froid: 'froid', 'vent-radioactif': 'vent radioactif',
};

const cause = (value) => CAUSES[value] ?? ENCOUNTER_CARDS[value]?.name ?? 'Zone';
const cardName = (card) => ENCOUNTER_CARDS[card]?.name ?? content.patrols[card]?.name ?? 'rencontre';
const signed = (n) => (n >= 0 ? `+${n}` : `${n}`);

function tokenName({ kind, anomaly }) {
  if (kind === 'anomalie') return `anomalie ${ANOMALY_NAMES[anomaly] ?? anomaly}`;
  if (kind === 'artefact') return 'artefact';
  return 'rien';
}

function progressText(kind, progress) {
  return kind === 'recuperation'
    ? `${progress.picked}/${progress.needed} artefact`
    : `${progress.revealed}/${progress.needed} jetons révélés`;
}

function fightLine(e, name) {
  return `Combat contre ${name} : ${e.roll} + Tir ${e.tir} ${signed(e.weapon)} arme ${signed(e.cover)} couvert = ${e.total} / ${e.threat} · ${e.won ? 'victoire' : 'défaite'}`;
}

const LINES = {
  moved: (e) => `Déplacement ${towards(e.from, e.to)} (${e.cost} PA)`,
  check: (e) => `Test de ${STAT_NAMES[e.stat] ?? e.stat} : ${e.roll} ${signed(e.bonus)} = ${e.roll + e.bonus} / ${e.target} · ${e.success ? 'réussi' : 'raté'}`,
  wounded: (e) => `+${e.amount} blessure${e.amount > 1 ? 's' : ''} (${cause(e.cause)})`,
  irradiated: (e) => `+${e.amount} radiation${e.amount > 1 ? 's' : ''} (${cause(e.cause)})`,
  'ap-penalty': () => '4 blessures : -1 PA',
  died: (e) => `Mort (${cause(e.cause)})`,
  'item-removed': (e) => `${ITEM_NAMES[e.kind] ?? e.kind} détruit (${cause(e.cause)})`,
  used: (e) => `${ITEM_NAMES[e.item]} utilisé${e.item === 'vodka' || e.item === 'ration' ? 'e' : ''}${e.wounds ? ` · blessures ${e.wounds}` : ''}${e.radiation ? ` · radiations ${e.radiation}` : ''}`,
  exited: (e) => `Sortie de la tuile (${tileArea(e.hex)})`,
  'day-ended': () => 'Plus de PA : la nuit tombe',
  refused: (e) => `Refusé : ${REFUSALS[e.reason] ?? e.reason}`,
  'token-revealed': (e) => `Jeton révélé (${tileArea(e.hex)})${e.by === 'bolt' ? ' au boulon' : e.by === 'detector' ? ' par le détecteur' : ''} : ${tokenName(e)}`,
  'anomaly-avoided': (e) => `Anomalie ${ANOMALY_NAMES[e.anomaly]} évitée`,
  'anomaly-triggered': (e) => `Anomalie ${ANOMALY_NAMES[e.anomaly]} déclenchée !`,
  'detector-broken': () => 'Détecteur en panne',
  thrown: (e) => `Projeté ${towards(e.from, e.to)}`,
  'bolt-thrown': (e) => `Boulon lancé (${tileArea(e.target)})`,
  'artefact-picked': (e) => `Artefact ramassé (${e.value} ₽)`,
  'pickup-failed': () => "Ramassage raté, l'artefact reste en place",
  'encounter-avoided': (e) => `Rencontre contournée (${tileArea(e.hex)})`,
  'encounter-revealed': (e) => `Rencontre : ${cardName(e.card)} (Menace ${ENCOUNTER_CARDS[e.card]?.threat}) · combat !`,
  fight: (e) => fightLine(e, cardName(e.card)),
  'encounter-removed': (e) => `${cardName(e.card)} écarté`,
  fled: (e) => `Fuite ${towards(e.from, e.to)} (${e.cost} PA)`,
  'zone-card': (e) => `Carte Zone : ${ZONE_CARD_NAMES[e.card] ?? e.card}`,
  patrol: (e) => `Une patrouille passe : ${tileArea(e.from)} → ${tileArea(e.to)}`,
  'dogs-placed': (e) => (e.hex ? `Des chiens rôdent (${tileArea(e.hex)})` : 'Des chiens au loin, sans place pour approcher'),
  'cache-found': (e) => `Cachette : ${ITEM_NAMES[e.item]}${e.stored ? '' : ' perdu, inventaire plein'}`,
  'emission-started': (e) => `ÉMISSION ! ${e.apLeftToShelter} PA pour rejoindre un abri`,
  'emission-countdown': (e) => `Émission : ${e.left} PA avant l'impact`,
  'emission-survived': () => "Émission passée à l'abri",
  'emission-caught': () => "Pris par l'Émission",
  'suspects-reset': () => 'La Zone a changé : 5 nouveaux jetons suspects',
  'mission-assigned': (e) => `Mission du jour : ${MISSION_NAMES[e.kind]} (${progressText(e.kind, e.progress)})`,
  'mission-progress': (e) => `Mission : ${progressText(e.kind, e.progress)}${e.impossible ? ' · devenue impossible' : ''}`,
  'mission-complete': (e) => `Mission ${MISSION_NAMES[e.kind]} remplie : rejoindre un bord pour sortir`,
  'game-over': (e) => `Fin de partie : ${e.outcome.result === 'win' ? 'victoire' : 'défaite'} · ${e.outcome.score} ₽`,
};

// --- Campagne v2 -------------------------------------------------------------------------

const WEATHER_NAMES = { calme: 'calme', brouillard: 'brouillard', pluie: 'pluie', 'signes-emission': "signes d'Émission" };
const NIGHT_CARDS = { 'nuit-calme': 'nuit calme', 'vent-radioactif': 'vent radioactif', froid: 'froid', rodeurs: 'rôdeurs' };
const XP_CAUSES = { combat: 'combat', decouverte: 'découverte', quete: 'quête', contrat: 'contrat' };
const DAY_ENDS = { sleep: 'nuit au lit', camp: 'bivouac', 'no-ap': 'plus de PA', emission: "l'Émission" };

const CAMPAIGN_REFUSALS = {
  ...HUB_REFUSALS,
  'not-a-link': 'pas sur un hexagone de liaison',
  night: "c'est la nuit : se réveiller d'abord",
  'in-place': "dans un lieu : le quitter d'abord",
  'place-occupied': 'lieu occupé : combattre, se faufiler ou payer',
  'not-enough-roubles': 'pas assez de roubles',
  'not-enough-ap': 'pas assez de PA',
  'no-bolt': 'plus de boulons',
  fog: 'brouillard : le boulon ne sert à rien',
};

const tileName = (id) => content.tiles[id]?.name ?? 'tuile inconnue';
const placeName = (id) => content.places[id]?.name ?? 'lieu inconnu';
const npcName = (id) => content.npcs[id]?.name ?? 'un stalker';
const patrolName = (id) => content.patrols[id]?.name ?? 'Une patrouille';
// Un contrat est une quête générée : sa définition est dans la campagne (rules/contracts.js).
const questOf = (id, campaign) => content.quests[id] ?? campaign?.quests[id]?.quest;
const questName = (id, campaign) => questOf(id, campaign)?.name ?? 'quête';

function encounterName(card, campaign) {
  const tile = campaign && content.tiles[campaign.world.currentTile];
  return (tile && encounterCards(tile)[card]?.name) ?? content.patrols[card]?.name ?? ENCOUNTER_CARDS[card]?.name ?? 'Rencontre';
}

// L'étape en clair, avec le lieu du PNJ à qui parler : « Parler au stalker blessé (Élévateur) ».
function nextStep(quest, step, campaign) {
  const text = stepObjective(quest, step, campaign);
  const npc = text && questOf(quest, campaign).steps[step].objective.npc;
  const place = npc && campaign?.npcs[npc]?.place;
  return place ? `${text} (${placeName(place)})` : text;
}

const CAMPAIGN_LINES = {
  traveled: (e) => `Voyage : ${tileName(e.from.tile)} → ${tileName(e.to.tile)} (${e.cost} PA)${e.firstVisit ? ', première visite' : ''}`,
  'encounter-revealed': (e, c) => {
    const tile = content.tiles[c.world.currentTile];
    const card = encounterCards(tile)[e.card] ?? content.patrols[e.card];
    return `Rencontre : ${card?.name ?? 'inconnue'}${card ? ` (Menace ${card.threat})` : ''} · combat !`;
  },
  'encounter-removed': (e, c) => `${encounterName(e.card, c)} : la voie est libre`,
  fight: (e, c) => fightLine(e, encounterName(e.card, c)),
  // Artefact rare : le jeton porte un objet, pas une valeur.
  'artefact-picked': (e) => (e.item ? `Artefact ramassé : ${content.items[e.item]?.name ?? 'artefact rare'}` : `Artefact ramassé (${e.value} ₽)`),
  'encounters-reset': (e) => `${tileName(e.tile)} : les rencontres ont bougé`,
  'day-ended': (e) => `La journée est finie${DAY_ENDS[e.reason] ? ` (${DAY_ENDS[e.reason]})` : ''}`,
  'night-card': (e) => `Carte Nuit : ${NIGHT_CARDS[e.card] ?? 'imprévu'}`,
  'night-encounter': () => 'Rencontre de nuit',
  weather: (e) => `Météo : ${WEATHER_NAMES[e.card] ?? 'variable'}`,
  meal: (e) => `Repas : ${ITEM_NAMES[e.item] ?? content.items[e.item]?.name ?? 'provisions'}`,
  hunger: (e) => `Faim : ${e.days} jour(s) sans manger`,
  'day-started': (e) => `Jour ${e.day} : ${e.ap} PA`,
  // Le moteur fait suivre quest-started de la quest-step de départ, qui dit l'objectif.
  'quest-started': (e, c) => `Nouvelle quête : ${questName(e.quest, c)}`,
  'quest-step': (e, c) => {
    const next = nextStep(e.quest, e.step, c);
    return `Quête ${questName(e.quest, c)} : ${next ?? 'nouvelle étape'}`;
  },
  'quest-branch': (e, c) => `Quête ${questName(e.quest, c)} : un choix à faire (voir le PDA)`,
  'quest-completed': (e, c) => `Quête terminée : ${questName(e.quest, c)}`,
  'quest-failed': (e, c) => `Quête ratée : ${questName(e.quest, c)}`,
  respawned: (e) => `Réveil au ${placeName(e.hub)} : inventaire perdu, XP ${e.xp.before} → ${e.xp.after}`,
  'xp-gained': (e) => `+${e.amount} XP${XP_CAUSES[e.cause] ? ` (${XP_CAUSES[e.cause]})` : ''} · total ${e.xp}`,
  'rank-up': (e) => `Nouveau rang : ${RANK_NAMES[e.rank] ?? 'supérieur'}`,
  'pda-found': (e) => `PDA trouvé : une planque est marquée (${tileName(e.tile)})`,
  'stash-opened': (e) => (e.items.length
    ? `Planque fouillée : ${e.items.map(({ item, stored }) => `${content.items[item]?.name ?? 'objet'}${stored ? '' : ' (pas de place)'}`).join(', ')}`
    : 'Planque fouillée : vide'),
  'npc-died': (e) => `${npcName(e.npc)} est mort${e.cause ? ` (${cause(e.cause)})` : ''}`,
  'npc-moved': (e) => `${npcName(e.npc)} est parti vers ${placeName(e.to)}`,
  'item-lost': (e) => `Perdu : ${content.items[e.kind]?.name ?? 'objet'}${e.cause ? ` (${cause(e.cause)})` : ''}`,
  'patrol-arrived': (e) => `${patrolName(e.patrol)} arrive sur ${tileName(e.tile)}`,
  'patrol-left': (e) => `${patrolName(e.patrol)} quitte ${tileName(e.tile)}`,
  'patrol-met': (e) => `${patrolName(e.patrol)} : ${e.stance === 'echange' ? 'on se salue, pas de combat' : 'combat !'}`,
  'patrol-dispersed': (e) => `${patrolName(e.patrol)} est dispersée`,
  'emission-night': (e) => `Nuit d'Émission ${e.sheltered ? "passée à l'abri" : 'à découvert'}`,
  'emission-aftermath': () => "Après l'Émission : la Zone a changé",
  'rare-artefact': (e) => `Un artefact rare est apparu (${tileName(e.tile)})`,
  ...HUB_LINES,
  ...PLACE_LINES,
  ...PDA_LINES,
  ...INVENTORY_LINES,
};

function refusalLine(event) {
  return `Refusé : ${CAMPAIGN_REFUSALS[event.reason] ?? REFUSALS[event.reason] ?? 'action impossible'}`;
}

export function journalLine(event, campaign) {
  if (event.type === 'refused' && CAMPAIGN_REFUSALS[event.reason]) return refusalLine(event);
  const line = CAMPAIGN_LINES[event.type]?.(event, campaign) ?? combatLine(event) ?? dialogueLine(event);
  if (line !== undefined) return line ?? '';
  if (event.type === 'refused') return refusalLine(event);
  return LINES[event.type]?.(event) ?? '';
}

// Ce qui raconte la partie ; le reste (jets, déplacements, rounds…) est du détail.
const IMPORTANT = new Set([
  'quest-started', 'quest-step', 'quest-branch', 'quest-completed', 'quest-failed',
  'wounded', 'irradiated', 'died', 'ap-penalty', 'hunger', 'respawned', 'npc-died',
  'item-gained', 'item-lost', 'loot-found', 'cache-found', 'artefact-picked', 'stash-opened',
  'pda-found', 'clue-found', 'trophy-lost', 'rare-artefact',
  'encounter-revealed', 'combat-started', 'combat-ended', 'night-encounter', 'patrol-met',
  'anomaly-triggered', 'trap-triggered', 'sneak-failed', 'refused', 'game-over',
  'rank-up', 'faction-joined', 'contract-accepted', 'contract-failed', 'day-started',
  'mission-complete', 'place-revealed', 'passage-opened',
]);

export function journalLevel(event) {
  return IMPORTANT.has(event.type) || event.type.startsWith('emission') ? 'important' : 'detail';
}
