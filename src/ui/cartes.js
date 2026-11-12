// Cartes physiques (direction plateau, lot L5 ; proposition §4 A8, A12, A13). Lectures pures :
// elles traduisent les événements d'un step et la campagne en cartes à montrer, sans DOM
// (tests/cartes.test.js). Le jeu des cartes est dans cartes-view.js, le style dans cartes.css.
//
//   cardBeats(events) -> events   les événements du step, avec les pas des cartes insérés :
//     { type: BEATS.zone, card, face }        A8 : après zone-card, la carte sort du paquet Zone
//     { type: BEATS.place }                   A8 : après place-card ou card-defused, la carte du
//                                             lieu sort du paquet et rejoint la pile
//     { type: BEATS.peek, face }              A8 : après card-peeked (boulon), la carte est
//                                             montrée puis rendue au paquet
//     { type: BEATS.wakeDeal }                avant day-started : Nuit et Météo posées face cachée
//     { type: BEATS.wake }                    après day-started : elles se retournent
//     { type: BEATS.mission, done }           A13 : après le dernier quest-started, quest-step
//                                             ou quest-completed du step (une seule fois) ; la
//                                             vue ne tamponne que si l'encart Objectif a changé
//     { type: BEATS.enemy, index, hp, damage, down }  A12 : après un tir qui touche (hp, damage)
//                                             ou enemy-down (down)
//   zoneFace(card, events) -> { title, text, gain }   face d'une carte Zone ; gain lu dans les
//                                             événements qui la suivent jusqu'à la carte suivante
//   peekFace(cardType) -> { title, text, gain }
//   zoneDeck(campaign) -> null | { left }     paquet Zone de la tuile courante
//   nextDiscard(discard, events) -> [card]    défausse Zone : vidée au réveil et au voyage
//   wakeCards(events) -> [{ kind, title, text }]   cartes Nuit (si tirée) et Météo du réveil
//   settleEnemies(enemies, events) -> enemies PV et état des ennemis après les tirs du step

import content from '../content/index.js';
import { ZONE_CARD_NAMES, ITEM_NAMES } from './journal.js';
import { CARD_TYPES } from './place.js';

export const BEATS = Object.freeze({
  zone: 'carte-zone',
  place: 'carte-lieu',
  peek: 'carte-apercu',
  wakeDeal: 'carte-reveil-pose',
  wake: 'carte-reveil',
  mission: 'carte-mission',
  enemy: 'carte-ennemi',
});

const ZONE_TEXT = {
  patrouille: 'Une patrouille se déplace sur la tuile.',
  chiens: 'Des chiens approchent, à deux cases.',
  brouillard: 'Boulon impossible jusqu’à la carte suivante.',
  cachette: 'Un consommable oublié.',
  radio: 'Des voix grésillent, rien de plus.',
  calme: 'Rien ne bouge.',
  emission: 'Le ciel vire : rejoindre un abri.',
};

const ZONE_GAINS = {
  'cache-found': (e) => (e.stored ? `+ ${itemName(e.item)}` : `${itemName(e.item)} perdu : sac plein`),
  'dogs-placed': (e) => (e.hex ? 'Chiens posés' : 'Chiens au loin'),
  patrol: () => 'Patrouille déplacée',
  'emission-started': (e) => `${e.apLeftToShelter} PA pour un abri`,
  'emission-survived': () => 'À l’abri',
};

const NIGHT_TEXT = {
  calme: () => 'Le sommeil vient.',
  radiations: (card) => `+${card.amount} radiation${card.amount > 1 ? 's' : ''}`,
  blessure: (card) => `+${card.amount} blessure${card.amount > 1 ? 's' : ''}`,
  rencontre: () => 'Rencontre de nuit',
};

const WEATHER_TEXT = {
  calme: () => 'Journée sans effet.',
  brouillard: () => 'La Zone se cache.',
  pluie: (card) => `Discrétion +${card.stealth}, détecteur ${card.detector}`,
  emission: () => 'L’Émission frappera aujourd’hui.',
};

const NIGHT_NAMES = { 'nuit-calme': 'Nuit calme', 'vent-radioactif': 'Vent radioactif', froid: 'Froid', rodeurs: 'Rôdeurs' };
const WEATHER_NAMES = { calme: 'Calme', brouillard: 'Brouillard', pluie: 'Pluie', 'signes-emission': 'Signes d’Émission' };

function itemName(kind) {
  return ITEM_NAMES[kind] ?? content.items[kind]?.name ?? kind;
}

export function zoneFace(card, events = []) {
  const until = events.findIndex((event) => event.type === 'zone-card');
  const after = until === -1 ? events : events.slice(0, until);
  const gain = after.map((event) => ZONE_GAINS[event.type]?.(event)).find(Boolean) ?? null;
  return { title: ZONE_CARD_NAMES[card] ?? card, text: ZONE_TEXT[card] ?? '', gain };
}

export function peekFace(cardType) {
  return { title: CARD_TYPES[cardType] ?? cardType, text: 'Vue au boulon, remise sur le paquet.', gain: null };
}

const QUEST_MOVES = ['quest-started', 'quest-step', 'quest-completed'];

function questBeat(events) {
  const last = events.findLastIndex((event) => QUEST_MOVES.includes(event.type));
  const done = events.some((event) => event.type === 'quest-completed');
  return { last, done };
}

export function cardBeats(events) {
  const mission = questBeat(events);
  const beats = [];
  events.forEach((event, i) => {
    if (event.type === 'day-started') beats.push({ type: BEATS.wakeDeal });
    beats.push(event);
    if (event.type === 'zone-card') beats.push({ type: BEATS.zone, card: event.card, face: zoneFace(event.card, events.slice(i + 1)) });
    else if (event.type === 'place-card' || event.type === 'card-defused') beats.push({ type: BEATS.place });
    else if (event.type === 'card-peeked') beats.push({ type: BEATS.peek, face: peekFace(event.cardType) });
    else if (event.type === 'day-started') beats.push({ type: BEATS.wake });
    else if (event.type === 'shot' && event.hit) beats.push({ type: BEATS.enemy, index: event.target, hp: event.hp, damage: event.damage, down: false });
    else if (event.type === 'enemy-down') beats.push({ type: BEATS.enemy, index: event.enemy, down: true });
    if (i === mission.last) beats.push({ type: BEATS.mission, done: mission.done });
  });
  return beats;
}

export function zoneDeck(campaign) {
  const deck = campaign.world.tiles[campaign.world.currentTile]?.zone?.deck;
  return deck ? { left: deck.length } : null;
}

export function nextDiscard(discard, events) {
  let next = discard;
  for (const event of events) {
    if (event.type === 'day-started' || event.type === 'traveled') next = [];
    else if (event.type === 'zone-card') next = [...next, event.card];
  }
  return next;
}

// Les cartes du dernier réveil : Nuit (si tirée), puis Météo.
export function wakeCards(events) {
  const night = events.slice(events.findLastIndex((e) => e.type === 'day-ended') + 1);
  const cards = [];
  const drawn = night.find((e) => e.type === 'night-card');
  if (drawn) {
    const card = content.decks[drawn.deck]?.cards.find((c) => c.id === drawn.card);
    cards.push({ kind: 'nuit', title: NIGHT_NAMES[drawn.card] ?? drawn.card, text: NIGHT_TEXT[card?.type]?.(card) ?? '' });
  }
  const weather = night.find((e) => e.type === 'weather');
  if (weather) {
    const card = content.decks.meteo?.cards.find((c) => c.id === weather.card);
    cards.push({ kind: 'meteo', title: WEATHER_NAMES[weather.card] ?? weather.card, text: WEATHER_TEXT[card?.type]?.(card) ?? '' });
  }
  return cards;
}

export function settleEnemies(enemies, events) {
  const next = enemies.map((enemy) => ({ ...enemy }));
  for (const event of events) {
    const enemy = next[event.type === 'shot' ? event.target : event.enemy];
    if (!enemy) continue;
    if (event.type === 'shot' && event.hit) enemy.hp = event.hp;
    if (event.type === 'enemy-down') Object.assign(enemy, { hp: 0, down: true });
  }
  return next;
}
