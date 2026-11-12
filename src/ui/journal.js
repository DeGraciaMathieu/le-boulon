// Journal façon PDA : chaque événement du moteur devient une ligne en français.
// Lecture seule : describeEvent ne touche jamais l'état.

import { ENCOUNTER_CARDS } from '../engine/rules/encounters.js';

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

const ZONE_CARD_NAMES = {
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
  combat: 'combat',
};

const cause = (value) => CAUSES[value] ?? ENCOUNTER_CARDS[value]?.name ?? value;
const cardName = (card) => ENCOUNTER_CARDS[card]?.name ?? card;
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

const LINES = {
  moved: (e) => `Déplacement ${e.from} → ${e.to} (${e.cost} PA)`,
  check: (e) => `Test de ${STAT_NAMES[e.stat] ?? e.stat} : ${e.roll} ${signed(e.bonus)} = ${e.roll + e.bonus} / ${e.target} · ${e.success ? 'réussi' : 'raté'}`,
  wounded: (e) => `+${e.amount} blessure${e.amount > 1 ? 's' : ''} (${cause(e.cause)})`,
  irradiated: (e) => `+${e.amount} radiation${e.amount > 1 ? 's' : ''} (${cause(e.cause)})`,
  'ap-penalty': () => '4 blessures : -1 PA',
  died: (e) => `Mort (${cause(e.cause)})`,
  'item-removed': (e) => `${ITEM_NAMES[e.kind] ?? e.kind} détruit (${cause(e.cause)})`,
  used: (e) => `${ITEM_NAMES[e.item]} utilisé${e.item === 'vodka' || e.item === 'ration' ? 'e' : ''}${e.wounds ? ` · blessures ${e.wounds}` : ''}${e.radiation ? ` · radiations ${e.radiation}` : ''}`,
  exited: (e) => `Sortie de la tuile par l'hexagone ${e.hex}`,
  'day-ended': () => 'Plus de PA : la nuit tombe',
  refused: (e) => `Refusé : ${REFUSALS[e.reason] ?? e.reason}`,
  'token-revealed': (e) => `Jeton de l'hexagone ${e.hex} révélé${e.by === 'bolt' ? ' au boulon' : e.by === 'detector' ? ' par le détecteur' : ''} : ${tokenName(e)}`,
  'anomaly-avoided': (e) => `Anomalie ${ANOMALY_NAMES[e.anomaly]} évitée`,
  'anomaly-triggered': (e) => `Anomalie ${ANOMALY_NAMES[e.anomaly]} déclenchée !`,
  'detector-broken': () => 'Détecteur en panne',
  thrown: (e) => `Projeté de ${e.from} vers ${e.to}`,
  'bolt-thrown': (e) => `Boulon lancé sur l'hexagone ${e.target}`,
  'artefact-picked': (e) => `Artefact ramassé (${e.value} ₽)`,
  'pickup-failed': () => "Ramassage raté, l'artefact reste en place",
  'encounter-avoided': (e) => `Rencontre contournée (hexagone ${e.hex})`,
  'encounter-revealed': (e) => `Rencontre : ${cardName(e.card)} (Menace ${ENCOUNTER_CARDS[e.card]?.threat}) · combat !`,
  fight: (e) => `Combat contre ${cardName(e.card)} : ${e.roll} + Tir ${e.tir} ${signed(e.weapon)} arme ${signed(e.cover)} couvert = ${e.total} / ${e.threat} · ${e.won ? 'victoire' : 'défaite'}`,
  'encounter-removed': (e) => `${cardName(e.card)} écarté`,
  fled: (e) => `Fuite ${e.from} → ${e.to} (${e.cost} PA)`,
  'zone-card': (e) => `Carte Zone : ${ZONE_CARD_NAMES[e.card] ?? e.card}`,
  patrol: (e) => `Une patrouille passe de ${e.from} à ${e.to}`,
  'dogs-placed': (e) => (e.hex ? `Des chiens rôdent sur l'hexagone ${e.hex}` : 'Des chiens au loin, sans place pour approcher'),
  'cache-found': (e) => `Cachette : ${ITEM_NAMES[e.item]}${e.stored ? '' : ' perdu, inventaire plein'}`,
  'emission-started': (e) => `ÉMISSION ! ${e.apLeftToShelter} PA pour rejoindre un abri`,
  'emission-countdown': (e) => `Émission : ${e.left} PA avant l'impact`,
  'emission-survived': (e) => `Émission passée à l'abri (hexagone ${e.hex})`,
  'emission-caught': () => "Pris par l'Émission",
  'suspects-reset': () => 'La Zone a changé : 5 nouveaux jetons suspects',
  'mission-assigned': (e) => `Mission du jour : ${MISSION_NAMES[e.kind]} (${progressText(e.kind, e.progress)})`,
  'mission-progress': (e) => `Mission : ${progressText(e.kind, e.progress)}${e.impossible ? ' · devenue impossible' : ''}`,
  'mission-complete': (e) => `Mission ${MISSION_NAMES[e.kind]} remplie : rejoindre un bord pour sortir`,
  'game-over': (e) => `Fin de partie : ${e.outcome.result === 'win' ? 'victoire' : 'défaite'} · ${e.outcome.score} ₽`,
};

export function describeEvent(event) {
  return LINES[event.type]?.(event) ?? event.type;
}

// Ajoute les lignes en bas du journal et le fait défiler jusqu'à la dernière.
export function appendEvents(list, events) {
  for (const event of events) {
    const line = document.createElement('li');
    line.textContent = describeEvent(event);
    line.dataset.type = event.type;
    list.append(line);
  }
  list.scrollTop = list.scrollHeight;
}
