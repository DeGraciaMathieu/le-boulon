// Lieux et exploration (brief v2 §5.1, §5.2, §5.4 ; carte 10).
// Contenu : places (src/content/lieux.js), decks de kind 'exploration' et loot (carte 11),
// formats en tête de src/content/validate.js.
//
// CARTE D'EXPLORATION (deck.cards[]) : { id, type, count?, text?, quest?, ...champs du type }
//   count : nombre d'exemplaires (1 par défaut). text : phrase affichée (rien, indice…).
//   quest : carte réservée à cette quête (carte 20) : hors de la pioche, elle ne sort que
//           fixée par fixCard (objectif 'explorer').
//   'butin'     loot?          table de butin (sinon celle du lieu, place.loot) : 1 tirage
//   'cache'     stat?, trap?, loot?   test de stat ('survie' | 'discretion' ; sans stat, la
//                              meilleure des deux, hypothèse v2). Réussi : 2 tirages (hypothèse
//                              v2). Raté : piège trap, 'blessure' (1 blessure, hypothèse v2,
//                              par défaut) ou 'bruit' (rencontre comme un occupant).
//   'anomalie'  anomaly?       comme un jeton suspect à l'aveugle (rules/suspects.js) : test de
//                              Survie, raté = effet de l'anomalie (electro, gravitationnelle,
//                              bruleuse ; sans anomaly, tirée parmi celles de la tuile). Hypothèse
//                              v2 : la gravitationnelle ne projette pas, on est dans un bâtiment.
//   'occupant'  encounter?     rencontre : PLACE_COMBAT.start (carte encounter du paquet de
//                              rencontres de la tuile, sinon piochée dans ce paquet). Combat selon
//                              campaign.combatMode (voir COMBAT ci-dessous).
//   'pnj'       npc            lance le dialogue du PNJ (talk de rules/dialogue.js) ; sa fin
//                              ramène à l'écran du lieu
//   'indice'    effects?       événement clue-found, puis les effets, au format des effets de
//                              dialogue (EFFECTS de rules/dialogue.js : 'quete', 'avancer',
//                              'reveler'… branchés par leurs cartes)
//   'passage'   deck           ouvre le paquet intérieur deck : les explorations suivantes le
//                              piochent jusqu'au bout, puis le paquet du lieu reprend. Hypothèse
//                              v2 : un seul paquet intérieur par lieu, un passage de plus ne fait rien.
//   'rien'                     rien d'autre que la carte et son texte
//
// COMBAT (occupant, piège 'bruit', se faufiler raté, approche 'combattre') : PLACE_COMBAT.start
//   pose la rencontre sur la journée (combat.hex = null) et émet 'encounter-revealed'.
//   - combatMode 'rapide' : combat v1, fight et flee relayés à la journée (PLACE_OVERRIDES.flee).
//   - combatMode 'rounds' : la réaction combatOnReveal (rules/combat.js) ouvre le combat v2 par
//     startCombat ; sa fin rend l'écran du lieu (previousScreen). placesAfterStep règle l'issue :
//     victoire ou parlementer, la carte d'occupant reste jouée (et 'combattre' vide le lieu) ;
//     fuite ('escape'), on reste sur l'hexagone et on quitte le lieu, la carte d'occupant revient
//     en tête de son paquet (hypothèse v2 : l'occupant est toujours là à la visite suivante).
//
// ÉTAT : campaign.place = { id, approach?, occupant? } pendant une visite seulement
//   (screen = 'place') ; occupant = zone ('main' | 'inner') de la carte d'occupant dont le
//   combat v2 est en cours.
//   campaign.places[id] (créé à la première entrée, à fixCard ou par « reveler ») :
//   { pool,        cartes restantes du paquet, ids mélangés (un par exemplaire), null avant
//                  la première entrée
//     fixed,       { [position]: cardId } cartes fixées par une quête (positions de 1 à n)
//     revealed,    ids des cartes jouées du paquet du lieu, dans l'ordre (position = rang + 1)
//     inner,       null | { deck, pool, revealed } paquet intérieur ouvert par un passage
//     emptied,     true quand tout est joué (lieu vidé)
//     perkUsed,    exploration gratuite du savoir-faire Fouilleur déjà prise
//     cleared,     occupants battus (approche 'combattre')
//     known }      révélé par un effet « reveler » (carte de la tuile, PDA)
//
// ACTIONS DE CAMPAGNE (CAMPAIGN_ACTIONS de campaign.js) :
//   { type: 'enter-place', place, approach? }   0 PA : le pas sur l'hexagone du lieu a déjà
//     coûté 1 PA (LIEU_COST de actions/move.js, « 1 PA comme en v1 »). Il faut être sur
//     l'hexagone du lieu. Lieu tenu par une faction hors de bons termes (placeAccess de
//     rules/factions.js) : approach requise, une de ses options :
//       'combattre'    combat tout de suite ; la victoire vide le lieu de ses occupants (cleared)
//       'se-faufiler'  test de Discrétion avant chaque carte ; raté : combat, la carte reste
//       'payer'        PLACE_FEE roubles, pour cette visite
//     Refus : 'in-place' | 'in-dialogue' | 'unknown-place' | 'not-here' | 'in-combat'
//             | 'day-over' | 'place-occupied' | 'bad-approach' | 'not-enough-roubles'
//   { type: 'explore' }      EXPLORE_COST PA (0 la première fois dans chaque lieu avec Fouilleur),
//                            joue la carte suivante. Refus : 'not-in-place' | 'in-dialogue'
//                            | 'in-combat' | 'day-over' | 'place-occupied' | 'no-deck'
//                            | 'place-emptied' | 'not-enough-ap' | raison d'un effet d'indice
//                            ou du dialogue d'un PNJ
//   { type: 'bolt-card' }    1 PA + 1 boulon : une anomalie en carte suivante est désamorcée
//                            (jouée sans effet) ; une autre carte est montrée sans être jouée.
//                            Refus : ceux d'explore (sauf effets) | 'fog' | 'no-bolt'
//   { type: 'leave-place' }  0 PA, à tout moment hors combat et dialogue ; la progression reste.
//                            Refus : 'not-in-place' | 'in-dialogue' | 'in-combat'
//   Dans un lieu, PLACE_OVERRIDES remplace les actions v1 : move, exit, bolt, pickup refusées
//   ('in-place') ; flee : 2 PA comme en v1, on reste sur l'hexagone et on quitte le lieu.
//   fight est relayé au combat v1 (combat.hex = null : aucune rencontre de la tuile retirée).
//
// API POUR LES AUTRES CARTES :
//   fixCard(draft, place, card, position) -> raison | undefined         carte 15 Quêtes
//     Fixe la carte card du paquet du lieu à la position donnée (1 = première). Position
//     déjà passée ou prise : la suivante libre (hypothèse v2). Refus : 'unknown-place'
//     | 'unknown-card' | 'bad-position'.
//   refillPlaces(draft, ctx), refillPlace(draft, place, ctx)            carte 8 Émission
//     Un lieu vidé reprend la moitié de ses cartes de butin, arrondie au-dessus (hypothèse v2).
//   rollLoot(table, rng, draws = 1) -> [{ item, qty }]                  carte 11 Butin
//     Tirage pondéré dans loot[table] ({ level, entries: [{ item, weight, qty? }] }) ;
//     table inconnue : [].
//   PLACE_COMBAT.start(day, dctx, { place, encounter? })                combat
//     Démarre la rencontre d'un lieu sur la journée v1 day (contexte dayContext de game.js) ;
//     en mode 'rounds', combatOnReveal en fait un combat v2.
//   placeView(campaign) -> null | { place, approach, revealed, remaining, emptied }   carte 25
//   PLACES, DECKS, LOOT : lieux, paquets et tables en plus du contenu (tests), lus avant lui.
//
// EFFET DE DIALOGUE (EFFECTS de dialogue.js) : { type: 'reveler', place } -> places[id].known.
//   { type: 'reveler', stash } reste à la carte 23 ('unknown-effect' en attendant).
//
// ÉVÉNEMENTS :
//   { type: 'place-entered', place, approach? }   { type: 'place-left', place }
//   { type: 'place-card', place, card, cardType, position, zone: 'main' | 'inner', text? }
//   { type: 'place-emptied', place }   { type: 'place-refilled', place, cards }
//   { type: 'place-revealed', place }  { type: 'place-cleared', place }
//   { type: 'loot-found', place, card, items: [{ item, stored }] }
//   { type: 'trap-triggered', place, card, trap }   { type: 'clue-found', place, card }
//   { type: 'passage-opened', place, deck }   { type: 'sneak-failed', place }
//   { type: 'card-defused', place, card }   { type: 'card-peeked', place, card, cardType }
//   { type: 'encounter-revealed', hex: null, card, place }   { type: 'fled', from, to, cost, place }
//   et ceux des règles v1 (check, wounded, anomaly-avoided, anomaly-triggered…).

import content from '../../content/index.js';
import { dayState, storeDay } from '../campaign.js';
import { dayContext, endDayIfExhausted } from '../game.js';
import { createItem, consumables, countCharges } from './sheet.js';
import { zoneAfterAction } from './zone.js';
import { encounterCards, anomalyKinds } from './tile.js';
import { placeAccess } from './factions.js';
import { hasPerk } from './progression.js';
import { talk, EFFECTS } from './dialogue.js';
import { combatMode } from './combat.js';

export const PLACES = {};
export const DECKS = {};
export const LOOT = {};

export const EXPLORE_COST = 1;
const BOLT_COST = 1;
// Comme la fuite v1 (rules/encounters.js).
const FLEE_COST = 2;
// Hypothèse v2 : le brief ne chiffre ni le péage d'un lieu occupé, ni le piège, ni la cache.
export const PLACE_FEE = 100;
const TRAP_WOUNDS = 1;
const CACHE_DRAWS = 2;

export const PLACE_COMBAT = {
  start(day, dctx, { place, encounter }) {
    const card = encounter ?? drawEncounter(day, dctx.rng);
    day.combat = { hex: null, card, place };
    dctx.emit({ type: 'encounter-revealed', hex: null, card, place });
  },
};

// Mêmes effets que les jetons suspects (rules/suspects.js), sans projection.
const ANOMALY_EFFECTS = {
  electro: (day, dctx) => {
    dctx.wound(2, 'electro');
    day.detector.broken = true;
    dctx.emit({ type: 'detector-broken' });
  },
  gravitationnelle: (_day, dctx) => dctx.wound(3, 'gravitationnelle'),
  bruleuse: (day, dctx) => {
    dctx.wound(2, 'bruleuse');
    const burnable = consumables(day.inventory);
    if (burnable.length > 0) dctx.removeItem(dctx.rng.pick(burnable), 'bruleuse');
  },
};

// Règles par type de carte : day sur la journée v1, campaign sur la campagne (après storeDay).
const CARD_RULES = {
  butin: {
    day: (day, dctx, { place, card }) => findLoot(day, dctx, place, card, 1),
  },
  cache: {
    day: (day, dctx, { place, card }) => {
      const { survie, discretion } = day.player.stats;
      const stat = card.stat ?? (survie >= discretion ? 'survie' : 'discretion');
      if (dctx.check(stat)) {
        findLoot(day, dctx, place, card, CACHE_DRAWS);
        return;
      }
      const trap = card.trap ?? 'blessure';
      dctx.emit({ type: 'trap-triggered', place, card: card.id, trap });
      if (trap === 'bruit') PLACE_COMBAT.start(day, dctx, { place });
      else dctx.wound(TRAP_WOUNDS, 'piege');
    },
  },
  anomalie: {
    day: (day, dctx, { card }) => {
      const anomaly = card.anomaly ?? dctx.rng.pick(anomalyKinds(day.tile));
      if (dctx.check('survie')) {
        dctx.emit({ type: 'anomaly-avoided', hex: null, anomaly });
        return;
      }
      dctx.emit({ type: 'anomaly-triggered', hex: null, anomaly });
      ANOMALY_EFFECTS[anomaly](day, dctx);
    },
  },
  occupant: {
    day: (day, dctx, { place, card }) => PLACE_COMBAT.start(day, dctx, { place, encounter: card.encounter }),
  },
  pnj: {
    campaign: (draft, ctx, { card }) => talk(draft, { type: 'talk', npc: card.npc }, ctx),
  },
  indice: {
    campaign: (draft, ctx, { place, card }) => {
      ctx.emit({ type: 'clue-found', place, card: card.id });
      for (const effect of card.effects ?? []) {
        const apply = EFFECTS[effect.type];
        if (!apply) return 'unknown-effect';
        const refusal = apply(draft, effect, ctx);
        if (refusal) return refusal;
      }
    },
  },
  passage: {
    day: (_day, dctx, { place, card, state }) => {
      if (state.inner) return;
      state.inner = { deck: card.deck, pool: dctx.rng.shuffle(expand(deckById(card.deck))), revealed: [] };
      dctx.emit({ type: 'passage-opened', place, deck: card.deck });
    },
  },
  rien: {},
};

EFFECTS.reveler = (draft, effect, ctx) => {
  if (!effect.place) return 'unknown-effect';
  if (!placeOf(effect.place)) return 'unknown-place';
  placeState(draft, effect.place).known = true;
  ctx.emit({ type: 'place-revealed', place: effect.place });
};

export const PLACE_OVERRIDES = {
  move: () => 'in-place',
  exit: () => 'in-place',
  bolt: () => 'in-place',
  pickup: () => 'in-place',
  flee: fleePlace,
};

export function enterPlace(draft, { place: id, approach }, ctx) {
  if (draft.place) return 'in-place';
  if (draft.dialogue) return 'in-dialogue';
  const place = placeOf(id);
  if (!place) return 'unknown-place';
  if (place.tile !== draft.world.currentTile || place.hex !== draft.world.hex) return 'not-here';
  const day = dayState(draft);
  if (day.combat) return 'in-combat';
  if (day.status !== 'playing') return 'day-over';
  const access = placeAccess(draft, place.faction ?? null);
  const occupied = !access.free && !draft.places[id]?.cleared;
  if (occupied && !approach) return 'place-occupied';
  if (occupied && !access.options.includes(approach)) return 'bad-approach';
  if (occupied && approach === 'payer' && draft.player.roubles < PLACE_FEE) return 'not-enough-roubles';

  const state = placeState(draft, id);
  state.pool ??= ctx.rng.shuffle(withoutFixed(drawable(deckById(place.deck)), state.fixed));
  draft.place = occupied ? { id, approach } : { id };
  draft.screen = 'place';
  ctx.emit({ type: 'place-entered', place: id, ...(occupied && { approach }) });
  if (approach === 'payer' && occupied) {
    draft.player.roubles -= PLACE_FEE;
    ctx.emit({ type: 'roubles-changed', amount: -PLACE_FEE, roubles: draft.player.roubles });
  }
  if (approach === 'combattre' && occupied) {
    PLACE_COMBAT.start(day, dayContext(day, ctx.rng, ctx.emit), { place: id });
    storeDay(draft, day);
  }
}

export function explore(draft, _action, ctx) {
  const refusal = visitRefusal(draft) ?? deckRefusal(draft);
  if (refusal) return refusal;
  const { id, approach } = draft.place;
  const state = draft.places[id];
  const free = hasPerk(draft, 'fouilleur') && !state.perkUsed;
  const cost = free ? 0 : EXPLORE_COST;
  const day = dayState(draft);
  if (day.ap.left < cost) return 'not-enough-ap';

  const dctx = dayContext(day, ctx.rng, ctx.emit);
  const spentBefore = day.ap.spent;
  dctx.spend(cost);
  if (free) state.perkUsed = true;
  if (approach === 'se-faufiler' && !state.cleared && !dctx.check('discretion')) {
    ctx.emit({ type: 'sneak-failed', place: id });
    PLACE_COMBAT.start(day, dctx, { place: id });
    settleDay(draft, day, spentBefore, dctx);
    return;
  }

  const { card, zone, position } = takeCard(state, placeOf(id).deck);
  const rule = CARD_RULES[card.type];
  const info = { place: id, card, state };
  ctx.emit({
    type: 'place-card', place: id, card: card.id, cardType: card.type, position, zone,
    ...(card.text && { text: card.text }),
  });
  rule.day?.(day, dctx, info);
  settleDay(draft, day, spentBefore, dctx);
  if (card.type === 'occupant' && day.combat && combatMode(draft) === 'rounds') draft.place.occupant = zone;
  const effectRefusal = rule.campaign?.(draft, ctx, info);
  if (effectRefusal) return effectRefusal;
  markEmptied(draft, id, ctx);
}

export function boltCard(draft, _action, ctx) {
  const refusal = visitRefusal(draft) ?? deckRefusal(draft);
  if (refusal) return refusal;
  const day = dayState(draft);
  if (day.zone?.fog) return 'fog';
  if (countCharges(day.inventory, 'boulons') === 0) return 'no-bolt';
  if (day.ap.left < BOLT_COST) return 'not-enough-ap';

  const { id } = draft.place;
  const state = draft.places[id];
  const dctx = dayContext(day, ctx.rng, ctx.emit);
  const spentBefore = day.ap.spent;
  dctx.spend(BOLT_COST);
  dctx.useCharge('boulons');
  const { deck } = placeOf(id);
  const next = cardOf(nextCard(state, deck));
  if (next.type === 'anomalie') {
    takeCard(state, deck);
    ctx.emit({ type: 'card-defused', place: id, card: next.id });
  } else {
    ctx.emit({ type: 'card-peeked', place: id, card: next.id, cardType: next.type });
  }
  settleDay(draft, day, spentBefore, dctx);
  markEmptied(draft, id, ctx);
}

export function leavePlace(draft, _action, ctx) {
  if (!draft.place) return 'not-in-place';
  if (draft.dialogue) return 'in-dialogue';
  if (dayState(draft).combat) return 'in-combat';
  exitPlace(draft, ctx);
}

function fleePlace(draft, _action, ctx) {
  const day = dayState(draft);
  if (!day.combat) return 'not-in-combat';
  if (day.ap.left < FLEE_COST) return 'not-enough-ap';
  const dctx = dayContext(day, ctx.rng, ctx.emit);
  const spentBefore = day.ap.spent;
  dctx.spend(FLEE_COST);
  day.combat = null;
  const hex = draft.world.hex;
  ctx.emit({ type: 'fled', from: hex, to: hex, cost: FLEE_COST, place: draft.place.id });
  settleDay(draft, day, spentBefore, dctx);
  exitPlace(draft, ctx);
}

// Réaction (REACTIONS de campaign.js, après combatOnReveal) : une victoire en approche
// 'combattre' vide le lieu de ses occupants ; la fin d'un combat v2 règle la visite.
export function placesAfterStep(draft, events, ctx) {
  if (!draft.place) return;
  clearOccupants(draft, events, ctx);
  const ended = events.find((event) => event.type === 'combat-ended');
  if (ended) settlePlaceCombat(draft, ended.outcome, ctx);
}

function clearOccupants(draft, events, ctx) {
  if (draft.place.approach !== 'combattre') return;
  const state = draft.places[draft.place.id];
  if (state.cleared || !events.some((event) => event.type === 'encounter-removed')) return;
  state.cleared = true;
  ctx.emit({ type: 'place-cleared', place: draft.place.id });
}

function settlePlaceCombat(draft, outcome, ctx) {
  const { id, occupant } = draft.place;
  delete draft.place.occupant;
  if (outcome !== 'fled') return;
  if (occupant) putBack(draft.places[id], occupant);
  exitPlace(draft, ctx);
}

export function fixCard(draft, id, cardId, position) {
  const place = placeOf(id);
  if (!place) return 'unknown-place';
  if (!deckById(place.deck)?.cards.some((card) => card.id === cardId)) return 'unknown-card';
  if (!Number.isInteger(position) || position < 1) return 'bad-position';

  const state = placeState(draft, id);
  const index = state.pool?.indexOf(cardId) ?? -1;
  if (index >= 0) state.pool.splice(index, 1);
  let at = Math.max(position, state.revealed.length + 1);
  while (state.fixed[at]) at += 1;
  state.fixed[at] = cardId;
  state.emptied = false;
}

export function refillPlaces(draft, ctx) {
  for (const [id, state] of Object.entries(draft.places)) {
    if (state.emptied) refillPlace(draft, id, ctx);
  }
}

export function refillPlace(draft, id, ctx) {
  const { deck } = placeOf(id);
  const loot = expand(deckById(deck)).filter((card) => cardOf({ deck, card }).type === 'butin');
  const cards = Math.ceil(loot.length / 2);
  if (cards === 0) return;
  const state = draft.places[id];
  state.pool = ctx.rng.shuffle(loot).slice(0, cards);
  state.emptied = false;
  ctx.emit({ type: 'place-refilled', place: id, cards });
}

export function rollLoot(tableId, rng, draws = 1) {
  const table = LOOT[tableId] ?? content.loot?.[tableId];
  if (!table) return [];
  const total = table.entries.reduce((sum, entry) => sum + entry.weight, 0);
  return Array.from({ length: draws }, () => {
    let roll = rng.int(1, total);
    const entry = table.entries.find(({ weight }) => (roll -= weight) <= 0);
    return { item: entry.item, qty: entry.qty ?? 1 };
  });
}

export function placeView(campaign) {
  if (!campaign.place) return null;
  const { id, approach } = campaign.place;
  const state = campaign.places[id];
  return {
    place: id,
    approach: approach ?? null,
    revealed: [...state.revealed, ...(state.inner?.revealed ?? [])],
    remaining: remaining(state),
    emptied: state.emptied,
  };
}

function placeOf(id) {
  return PLACES[id] ?? content.places?.[id];
}

function deckById(id) {
  if (!id) return undefined;
  return DECKS[id] ?? content.decks?.[id];
}

function placeState(draft, id) {
  draft.places[id] ??= {
    pool: null, fixed: {}, revealed: [], inner: null, emptied: false, perkUsed: false, cleared: false, known: false,
  };
  return draft.places[id];
}

// Ids des cartes d'un paquet, un par exemplaire.
function expand(deck) {
  return (deck?.cards ?? []).flatMap((card) => Array(card.count ?? 1).fill(card.id));
}

// Ids de la pioche : sans les cartes réservées à une quête, qui ne sortent que fixées.
function drawable(deck) {
  return expand({ cards: (deck?.cards ?? []).filter((card) => !card.quest) });
}

function withoutFixed(ids, fixed) {
  const pool = [...ids];
  for (const cardId of Object.values(fixed)) {
    const index = pool.indexOf(cardId);
    if (index >= 0) pool.splice(index, 1);
  }
  return pool;
}

function remaining(state) {
  return (state.pool?.length ?? 0) + Object.keys(state.fixed).length + (state.inner?.pool.length ?? 0);
}

// Prochaine carte : { deck, card, zone } ou null. Le paquet intérieur ouvert passe d'abord ;
// dans le paquet du lieu, la carte fixée à la position suivante, sinon la pioche, sinon la
// carte fixée la plus proche.
function nextCard(state, deck) {
  if (state.inner?.pool.length) return { deck: state.inner.deck, card: state.inner.pool[0], zone: 'inner' };
  const position = state.revealed.length + 1;
  if (state.fixed[position]) return { deck, card: state.fixed[position], zone: 'main', fixedAt: position };
  if (state.pool.length) return { deck, card: state.pool[0], zone: 'main' };
  const later = Object.keys(state.fixed).map(Number).sort((a, b) => a - b)[0];
  return later === undefined ? null : { deck, card: state.fixed[later], zone: 'main', fixedAt: later };
}

function takeCard(state, deck) {
  const next = nextCard(state, deck);
  if (next.zone === 'inner') {
    state.inner.revealed.push(state.inner.pool.shift());
    return { card: cardOf(next), zone: 'inner', position: state.inner.revealed.length };
  }
  if (next.fixedAt) delete state.fixed[next.fixedAt];
  else state.pool.shift();
  state.revealed.push(next.card);
  return { card: cardOf(next), zone: 'main', position: state.revealed.length };
}

// Remet la dernière carte jouée de la zone en tête de sa pioche.
function putBack(state, zone) {
  const pile = zone === 'inner' ? state.inner : state;
  pile.pool.unshift(pile.revealed.pop());
  state.emptied = false;
}

function cardOf({ deck, card }) {
  return deckById(deck).cards.find(({ id }) => id === card);
}

function visitRefusal(draft) {
  if (!draft.place) return 'not-in-place';
  if (draft.dialogue) return 'in-dialogue';
  const day = dayState(draft);
  if (day.combat) return 'in-combat';
  if (day.status !== 'playing') return 'day-over';
}

function deckRefusal(draft) {
  const { id, approach } = draft.place;
  const state = draft.places[id];
  if (approach === 'combattre' && !state.cleared) return 'place-occupied';
  const { deck } = placeOf(id);
  if (!deck) return 'no-deck';
  if (!nextCard(state, deck)) return 'place-emptied';
}

function findLoot(day, dctx, place, card, draws) {
  const items = [];
  for (const { item, qty } of rollLoot(card.loot ?? placeOf(place).loot, dctx.rng, draws)) {
    for (let i = 0; i < qty; i++) items.push({ item, stored: dctx.addItem(createItem(item)) });
  }
  dctx.emit({ type: 'loot-found', place, card: card.id, items });
}

function drawEncounter(day, rng) {
  if (day.encounterDeck.length === 0) day.encounterDeck = rng.shuffle(Object.keys(encounterCards(day.tile)));
  return day.encounterDeck.shift();
}

function settleDay(draft, day, spentBefore, dctx) {
  if (day.status === 'playing') zoneAfterAction(day, spentBefore, dctx);
  endDayIfExhausted(day, dctx);
  storeDay(draft, day);
}

function markEmptied(draft, id, ctx) {
  const state = draft.places[id];
  if (state.emptied || nextCard(state, placeOf(id).deck)) return;
  state.emptied = true;
  ctx.emit({ type: 'place-emptied', place: id });
}

function exitPlace(draft, ctx) {
  const { id } = draft.place;
  delete draft.place;
  draft.screen = 'tile';
  ctx.emit({ type: 'place-left', place: id });
}
