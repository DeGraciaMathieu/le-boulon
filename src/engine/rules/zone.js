// Paquet Zone et Émission.
//
// ÉTAT (state.zone, posé par setupZone dans createGame) :
//   {
//     deck,            [id] cartes restantes, on pioche en tête
//     fog,             true de la pioche d'un brouillard jusqu'à la pioche suivante
//     emission,        null | { left }  compte à rebours en cours : PA restant à dépenser
//                      avant d'être pris
//     emissionPassed,  true une fois l'Émission subie ou évitée
//   }
//
// PAQUET (10 cartes par défaut) : patrouille, chiens, brouillard, cachette, radio, calme ×4,
//   emission. Le brief en liste 9 (calme ×3) ; une 4e carte calme complète les 10.
//   Une tuile peut remplacer les cartes hors Émission (composition.zone, src/engine/rules/tile.js) ;
//   une carte sans effet connu ne fait rien. Les cartes hors Émission sont mélangées, puis l'Émission est insérée au hasard dans
//   le dernier tiers des cartes RÉELLEMENT piochables (sinon elle ne sortirait jamais) :
//     nbPioches = floor(PA de départ (ap.max) / DRAW_EVERY), plafonné à la taille du paquet
//     (Émission comprise)
//     positions possibles : de nbPioches - ceil(nbPioches / 3) + 1 à nbPioches (1 = première
//     carte piochée), élargies à nbPioches - 1 si nbPioches ≥ 2 pour garder au moins 2 positions.
//   Exemple : 10 PA -> 3 pioches -> Émission en 2e ou 3e pioche.
//
// MISE EN PLACE : setupZone(game) -> game   mélange le paquet (avance game.rng)
//
// BRANCHEMENT (src/engine/game.js) :
//   zoneRefusal(state, action) -> 'fog' | undefined   boulon refusé sous le brouillard
//   zoneAfterAction(draft, spentBefore, ctx)          appelé après chaque action acceptée
//     1. Émission en cours : le compte à rebours baisse des PA dépensés par l'action.
//        Joueur sur un abri (tile.hexes[n].abri) : sauf. Compte à 0 : pris.
//     2. Une carte piochée par multiple de 3 franchi par ap.spent (2 -> 4 : une ; 5 -> 8 :
//        une ; 2 -> 6 : deux). Paquet vide : plus de pioche.
//
// EFFETS DES CARTES :
//   patrouille  une rencontre au hasard va sur un voisin libre au hasard (ni autre
//               rencontre, ni joueur, ni entrée) ; aucune rencontre ou aucun voisin libre : rien
//   chiens      placeEncounter avec allowed = hexagones de la tuile à distance 2 du joueur
//   brouillard  zone.fog = true jusqu'à la pioche suivante
//   cachette    un consommable au hasard (bandage, vodka, ration) ; perdu si l'inventaire
//               est plein
//   radio, calme  rien en v1
//   emission    joueur sur un abri : sauf tout de suite ; sinon compte à rebours de 3 PA
//
// ÉMISSION :
//   Sauf : on retire tous les jetons suspects non ramassés et on en repose 5 neufs
//   (placeSuspects avec { original: false }).
//   Pris : 5 blessures (ctx.wound, cause 'emission'), puis status 'emission' si le joueur
//   n'en est pas mort (sinon 'dead').
//
// ÉVÉNEMENTS :
//   { type: 'zone-card', card }
//   { type: 'patrol', from, to }                { type: 'dogs-placed', hex }   hex null si aucune place
//   { type: 'cache-found', item, stored }       stored false : objet perdu, inventaire plein
//   { type: 'emission-started', apLeftToShelter }
//   { type: 'emission-countdown', left }
//   { type: 'emission-survived', hex }          { type: 'emission-caught' }
//   { type: 'suspects-reset' }
//
// HYPOTHÈSES V1 :
//   - Le compte à rebours part de la fin de l'action qui pioche l'Émission : les PA de cette
//     action au-delà du multiple de 3 ne comptent pas.
//   - Le joueur est sauf s'il est sur un abri à la fin d'une action où il reste du compte
//     (entrer sur l'abri avec le 3e PA suffit).
//   - Une patrouille ne déclenche ni test de Discrétion ni combat, même à côté du joueur.
//   - Fin de partie en cours d'action (mort) : plus de pioche.

import { distance, neighbors } from '../hex.js';
import { placeEncounter } from './encounters.js';
import { placeSuspects } from './suspects.js';
import { createItem } from './sheet.js';
import { createRng } from '../rng.js';
import { TILE_DEFAULTS, tileHexes, zoneCards } from './tile.js';

export const DRAW_EVERY = 3;
export const EMISSION_COUNTDOWN = 3;
export const EMISSION_WOUNDS = 5;
const DOGS_DISTANCE = 2;
const CACHE_ITEMS = ['bandage', 'vodka', 'ration'];

export const ZONE_DECK_SIZE = TILE_DEFAULTS.zone.length + 1;

export function setupZone(game) {
  const rng = createRng(game.rng);
  const deck = rng.shuffle(zoneCards(game.tile));
  const { first, last } = emissionPositions(game.ap.max, deck.length + 1);
  deck.splice(rng.int(first - 1, last - 1), 0, 'emission');
  game.zone = { deck, fog: false, emission: null, emissionPassed: false };
  game.rng = rng.state();
  return game;
}

// Positions (1 = première carte piochée) où l'Émission peut tomber : le dernier tiers des pioches
// que le budget de PA de départ permet, dans un paquet de deckSize cartes (Émission comprise).
export function emissionPositions(apMax, deckSize = ZONE_DECK_SIZE) {
  const draws = Math.max(1, Math.min(deckSize, Math.floor(apMax / DRAW_EVERY)));
  const lastThird = draws - Math.ceil(draws / 3) + 1;
  const first = draws >= 2 ? Math.min(lastThird, draws - 1) : 1;
  return { first, last: draws };
}

export function zoneRefusal(state, action) {
  if (state.zone?.fog && action.type === 'bolt') return 'fog';
}

export function zoneAfterAction(draft, spentBefore, ctx) {
  const spent = draft.ap.spent - spentBefore;
  if (draft.zone.emission) tickEmission(draft, spent, ctx);

  const draws = Math.floor(draft.ap.spent / DRAW_EVERY) - Math.floor(spentBefore / DRAW_EVERY);
  for (let i = 0; i < draws; i++) {
    if (draft.status !== 'playing' || draft.zone.deck.length === 0) return;
    drawZoneCard(draft, ctx);
  }
}

function drawZoneCard(draft, ctx) {
  const card = draft.zone.deck.shift();
  draft.zone.fog = false;
  ctx.emit({ type: 'zone-card', card });
  CARD_EFFECTS[card]?.(draft, ctx);
}

const CARD_EFFECTS = {
  patrouille: patrol,
  chiens: (draft, ctx) => {
    const allowed = tileHexes(draft.tile).filter((n) => distance(draft.player.hex, n) === DOGS_DISTANCE);
    ctx.emit({ type: 'dogs-placed', hex: placeEncounter(draft, ctx.rng, allowed) });
  },
  brouillard: (draft) => {
    draft.zone.fog = true;
  },
  cachette: (draft, ctx) => {
    const item = ctx.rng.pick(CACHE_ITEMS);
    ctx.emit({ type: 'cache-found', item, stored: ctx.addItem(createItem(item)) });
  },
  emission: startEmission,
};

function patrol(draft, ctx) {
  if (draft.encounters.length === 0) return;
  const encounter = ctx.rng.pick(draft.encounters);
  const taken = new Set([...draft.encounters.map((e) => e.hex), draft.player.hex, draft.tile.entry]);
  const free = neighbors(encounter.hex).filter((n) => !taken.has(n));
  if (free.length === 0) return;
  const from = encounter.hex;
  encounter.hex = ctx.rng.pick(free);
  ctx.emit({ type: 'patrol', from, to: encounter.hex });
}

function startEmission(draft, ctx) {
  if (isSheltered(draft)) {
    survive(draft, ctx);
    return;
  }
  draft.zone.emission = { left: EMISSION_COUNTDOWN };
  ctx.emit({ type: 'emission-started', apLeftToShelter: EMISSION_COUNTDOWN });
}

function tickEmission(draft, spent, ctx) {
  const emission = draft.zone.emission;
  emission.left = Math.max(0, emission.left - spent);
  if (isSheltered(draft)) survive(draft, ctx);
  else if (emission.left === 0) catchPlayer(draft, ctx);
  else if (spent > 0) ctx.emit({ type: 'emission-countdown', left: emission.left });
}

function isSheltered(draft) {
  return Boolean(draft.tile.hexes[draft.player.hex].abri);
}

function survive(draft, ctx) {
  endEmission(draft);
  ctx.emit({ type: 'emission-survived', hex: draft.player.hex });
  placeSuspects(draft, ctx.rng, { original: false });
  ctx.emit({ type: 'suspects-reset' });
}

function catchPlayer(draft, ctx) {
  endEmission(draft);
  ctx.emit({ type: 'emission-caught' });
  ctx.wound(EMISSION_WOUNDS, 'emission');
  if (draft.status === 'playing') draft.status = 'emission';
}

function endEmission(draft) {
  draft.zone.emission = null;
  draft.zone.emissionPassed = true;
}
