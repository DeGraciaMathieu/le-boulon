// Lectures de l'écran Lieu (brief v2 §5, §16 ; carte 25). Pures : elles lisent la campagne et
// le contenu, sans rien modifier, et ne touchent pas au DOM (testées par tests/place.test.js).
//
//   tilePlaces(campaign)    -> [{ id, name, hex, faction, occupied, explored, emptied, here }]
//                              lieux explorables de la tuile courante (les hubs ont leur écran)
//   placeEntry(campaign)    -> null | { id, name, faction, occupied, options: [{ approach,
//                              label, enabled }] }   lieu explorable sous le pion
//   placeScreen(campaign, outcomes?) -> null | { id, name, hex, faction, approach, cards,
//                              remaining, emptied, combat, explore: { cost, enabled }, bolt:
//                              { bolts, enabled }, leave: { enabled } }   pendant une visite
//     cards : [{ position, zone, id, type, label, detail, text, outcome }] dans l'ordre joué,
//     paquet du lieu puis paquet intérieur (zone 'inner') ; outcome : lignes de cardOutcomes
//     ou [] (carte jouée avant le chargement de la page).
//   cardOutcomes(outcomes, events) -> outcomes   résultats des cartes lus dans les événements
//     d'une action : { cards: { 'lieu|zone|position': { card, lines: [{ text, tone }] } },
//     combat } ; tone 'bon' | 'mauvais' | 'neutre'. Le moteur ne garde pas ces résultats :
//     l'écran les accumule action après action (NO_OUTCOMES au départ).
//   placeCrop(hex, calage, size) -> { x, y, width, height }   portion de l'image de la tuile
//   PLACE_LINES               lignes du journal pour les événements des lieux

import content from '../content/index.js';
import { dayState } from '../engine/campaign.js';
import { placeView, EXPLORE_COST, PLACE_FEE } from '../engine/rules/places.js';
import { placeAccess } from '../engine/rules/factions.js';
import { hasPerk } from '../engine/rules/progression.js';
import { countCharges } from '../engine/rules/sheet.js';
import { encounterCards } from '../engine/rules/tile.js';
import { hexCenter } from './geometry.js';

export const CARD_TYPES = Object.freeze({
  butin: 'Butin', cache: 'Cache', anomalie: 'Anomalie', occupant: 'Occupant',
  pnj: 'PNJ', indice: 'Indice', passage: 'Passage', rien: 'Rien',
});

const ANOMALIES = { electro: 'Électro', gravitationnelle: 'Gravitationnelle', bruleuse: 'Brûleuse' };
const APPROACHES = { combattre: 'Combattre', 'se-faufiler': 'Se faufiler', payer: `Payer ${PLACE_FEE} roubles` };
const BOLT_COST = 1;
// Hypothèse v2 : l'illustration montre 3 hexagones de large autour du lieu.
const CROP_HEXES = 3;

const STAT_NAMES = { tir: 'Tir', survie: 'Survie', discretion: 'Discrétion', endurance: 'Endurance' };
const PARLEY_OUTCOMES = ['peage', 'echange', 'fin'];

export const NO_OUTCOMES = Object.freeze({ cards: {}, combat: null });

const factionName = (id) => (id ? content.factions[id]?.name ?? id : null);
const itemName = (id) => content.items[id]?.name ?? id;
const placeName = (id) => content.places[id]?.name ?? id;
const questName = (id) => content.quests[id]?.name ?? id;

export function tilePlaces(campaign) {
  return Object.entries(content.places)
    .filter(([, place]) => place.tile === campaign.world.currentTile && place.deck)
    .map(([id, place]) => {
      const state = campaign.places[id];
      return {
        id,
        name: place.name,
        hex: place.hex,
        faction: factionName(place.faction),
        occupied: isOccupied(campaign, id),
        explored: state?.revealed.length ?? 0,
        emptied: Boolean(state?.emptied),
        here: place.hex === campaign.world.hex,
      };
    });
}

export function placeEntry(campaign) {
  const place = tilePlaces(campaign).find((entry) => entry.here);
  if (!place) return null;
  const options = place.occupied
    ? Object.entries(APPROACHES).map(([approach, label]) => ({
      approach,
      label,
      enabled: approach !== 'payer' || campaign.player.roubles >= PLACE_FEE,
    }))
    : [];
  return { id: place.id, name: place.name, faction: place.faction, occupied: place.occupied, options };
}

export function placeScreen(campaign, outcomes = NO_OUTCOMES) {
  const view = placeView(campaign);
  if (!view) return null;
  const place = content.places[view.place];
  const state = campaign.places[view.place];
  const day = dayState(campaign);
  const combat = Boolean(day.combat);
  const free = !combat && !campaign.dialogue && day.status === 'playing' && view.remaining > 0;
  const exploreCost = hasPerk(campaign, 'fouilleur') && !state.perkUsed ? 0 : EXPLORE_COST;
  const bolts = countCharges(day.inventory, 'boulons');
  return {
    id: view.place,
    name: place.name,
    hex: place.hex,
    faction: factionName(place.faction),
    approach: view.approach ? APPROACHES[view.approach] : null,
    cards: [
      ...state.revealed.map((id, i) => cardInfo(place.deck, id, i + 1, 'main', day.tile)),
      ...(state.inner?.revealed ?? []).map((id, i) => cardInfo(state.inner.deck, id, i + 1, 'inner', day.tile)),
    ].map((card) => ({ ...card, outcome: outcomeOf(outcomes, view.place, card) })),
    remaining: view.remaining,
    emptied: view.emptied,
    combat,
    explore: { cost: exploreCost, enabled: free && day.ap.left >= exploreCost },
    bolt: { bolts, enabled: free && !day.zone?.fog && bolts > 0 && day.ap.left >= BOLT_COST },
    leave: { enabled: !combat && !campaign.dialogue },
  };
}

// Carré centré sur le lieu, gardé dans l'image (et plus petit qu'elle).
export function placeCrop(hex, { cx, cy, taille }, { width, height }) {
  const side = Math.min(CROP_HEXES * Math.sqrt(3) * taille, width, height);
  const center = hexCenter(hex, { cx, cy, taille });
  const clamp = (value, max) => Math.max(0, Math.min(value, max));
  return {
    x: clamp(center.x - side / 2, width - side),
    y: clamp(center.y - side / 2, height - side),
    width: side,
    height: side,
  };
}

// Les lignes d'une carte suivent son événement 'place-card' dans la même action ; l'issue d'un
// combat d'occupant arrive plus tard (combat v2 en rounds), d'où combat : clé de la carte.
export function cardOutcomes(outcomes, events) {
  const cards = { ...outcomes.cards };
  let { combat } = outcomes;
  let current = null;
  const add = (key, text, tone) => {
    if (key && cards[key]) cards[key] = { ...cards[key], lines: [...cards[key].lines, { text, tone }] };
  };
  for (const event of events) {
    if (event.type === 'place-card' || event.type === 'card-defused') {
      current = outcomeKey(event.place, event.zone, event.position);
      cards[current] = { card: event.card, lines: [] };
      if (event.type === 'card-defused') add(current, 'Désamorcée au boulon', 'bon');
      continue;
    }
    if (event.type === 'place-left') {
      current = null;
      combat = null;
      continue;
    }
    const settled = combatSettled(event);
    if (settled && combat) {
      add(combat, ...settled);
      combat = null;
      continue;
    }
    const line = OUTCOME_LINES[event.type]?.(event);
    if (line) add(current, ...line);
    if (event.type === 'encounter-revealed' && current) combat = current;
  }
  return { cards, combat };
}

const OUTCOME_LINES = {
  check: (e) => [`Test de ${STAT_NAMES[e.stat] ?? e.stat} : ${e.roll + e.bonus} sur ${e.target}, ${e.success ? 'réussi' : 'raté'}`, e.success ? 'bon' : 'mauvais'],
  'loot-found': (e) => (e.items.length
    ? [`Obtenu : ${e.items.map(({ item, stored }) => `${itemName(item)}${stored ? '' : ' (pas de place)'}`).join(', ')}`, 'bon']
    : ['Rien trouvé', 'neutre']),
  'trap-triggered': (e) => [e.trap === 'bruit' ? 'Piège : du bruit, on vient' : 'Piège : blessure', 'mauvais'],
  'anomaly-avoided': () => ['Anomalie évitée', 'bon'],
  'anomaly-triggered': () => ['Anomalie déclenchée', 'mauvais'],
  wounded: (e) => [`+${e.amount} blessure${e.amount > 1 ? 's' : ''}`, 'mauvais'],
  'encounter-revealed': () => ['Combat engagé', 'mauvais'],
  'clue-found': () => ['Indice trouvé', 'bon'],
  'quest-started': (e) => [`Quête commencée : ${questName(e.quest)}`, 'bon'],
  'quest-step': (e) => [`Quête avancée : ${questName(e.quest)}`, 'bon'],
  'quest-completed': (e) => [`Quête accomplie : ${questName(e.quest)}`, 'bon'],
  'passage-opened': () => ['Passage ouvert : paquet intérieur', 'bon'],
  'dialogue-started': (e) => [`Conversation avec ${content.npcs[e.npc]?.name ?? e.npc}`, 'neutre'],
};

// Issue d'un combat d'occupant : combat v2 (combat-ended), combat v1 (fight gagné, fled).
function combatSettled(event) {
  if (event.type === 'combat-ended') {
    if (event.outcome === 'victory') return ['Occupant battu', 'bon'];
    if (PARLEY_OUTCOMES.includes(event.outcome)) return ['Accord avec l’occupant', 'neutre'];
    if (event.outcome === 'fled') return ['Fuite', 'mauvais'];
  }
  if (event.type === 'fight' && event.won) return ['Occupant battu', 'bon'];
  if (event.type === 'fled' && event.place) return ['Fuite', 'mauvais'];
  return null;
}

function outcomeKey(place, zone, position) {
  return `${place}|${zone}|${position}`;
}

// Une clé ne vaut que pour la même carte (une carte d'occupant fuie revient dans le paquet).
function outcomeOf(outcomes, place, card) {
  const entry = outcomes.cards[outcomeKey(place, card.zone, card.position)];
  return entry?.card === card.id ? entry.lines : [];
}

export const PLACE_LINES = Object.freeze({
  'place-entered': (e) => `Entrée : ${placeName(e.place)}${e.approach ? ` (${APPROACHES[e.approach]})` : ''}`,
  'place-left': (e) => `Sortie : ${placeName(e.place)}`,
  'place-card': (e) => `Carte ${e.position}${e.zone === 'inner' ? ' (intérieur)' : ''} : ${CARD_TYPES[e.cardType]}${e.text ? `. ${e.text}` : ''}`,
  'place-emptied': (e) => `${placeName(e.place)} : lieu vidé`,
  'place-refilled': (e) => `${placeName(e.place)} : ${e.cards} carte(s) de butin reviennent`,
  'place-revealed': (e) => `Lieu révélé : ${placeName(e.place)}`,
  'place-cleared': (e) => `${placeName(e.place)} : les occupants sont battus`,
  'loot-found': (e) => (e.items.length
    ? `Butin : ${e.items.map(({ item, stored }) => `${itemName(item)}${stored ? '' : ' (pas de place)'}`).join(', ')}`
    : 'Butin : rien'),
  'trap-triggered': (e) => (e.trap === 'bruit' ? 'Piège : du bruit, on vient !' : 'Piège : blessure'),
  'clue-found': () => 'Indice trouvé',
  'passage-opened': () => 'Un passage mène plus loin : paquet intérieur ouvert',
  'sneak-failed': () => 'Repéré en se faufilant : combat !',
  'card-defused': () => 'Boulon : anomalie désamorcée',
  'card-peeked': (e) => `Boulon : la carte suivante est ${CARD_TYPES[e.cardType]}`,
});

function isOccupied(campaign, id) {
  const place = content.places[id];
  return !placeAccess(campaign, place.faction ?? null).free && !campaign.places[id]?.cleared;
}

function cardInfo(deckId, id, position, zone, tile) {
  const card = content.decks[deckId]?.cards.find((entry) => entry.id === id) ?? { id, type: 'rien' };
  return {
    position,
    zone,
    id,
    type: card.type,
    label: CARD_TYPES[card.type],
    detail: cardDetail(card, tile),
    text: card.text ?? null,
  };
}

function cardDetail(card, tile) {
  if (card.type === 'occupant' && card.encounter) return encounterCards(tile)[card.encounter]?.name ?? card.encounter;
  if (card.type === 'anomalie' && card.anomaly) return ANOMALIES[card.anomaly];
  if (card.type === 'pnj') return content.npcs[card.npc]?.name ?? card.npc;
  return null;
}
