// Rencontres et combat : jetons de rencontre (3 par défaut), test de Discrétion, combat ou fuite.
// Nombre de jetons et paquet de cartes viennent de la tuile (src/engine/rules/tile.js).
//
// ÉTAT (ajouté par setupEncounters dans createGame) :
//   encounters      [{ hex, card }]  card = id de carte une fois révélée, null avant
//   encounterDeck   [id]             paquet de la tuile (encounterCards) mélangé, on pioche en tête
//   combat          null | { hex, card }   rencontre en cours ; seules fight et flee sont permises
//
// MISE EN PLACE ET RÉUTILISATION :
//   setupEncounters(game) -> game    pose encounterCount(tile) jetons et mélange le paquet
//                                    de la tuile (avance game.rng)
//   placeEncounter(draft, rng, allowed?) -> hex | null
//                                    d20, relance hors de la tuile (20 compris), sur une
//                                    rencontre déjà posée et sur l'entrée. allowed (liste d'hexagones) restreint la pose,
//                                    par exemple « à 2 hexagones » pour la carte Zone chiens
//                                    attirés ; null si aucun hexagone ne convient.
//
// RÉACTION À L'ENTRÉE (ON_ENTER de move.js) : encounterOnEnter
//   Pour chaque rencontre sur l'hexagone ou à côté (la plus proche d'abord) : test de
//   Discrétion, +1 en forêt. Réussite : on contourne, le jeton reste. Échec : la carte est
//   révélée (piochée si le jeton était caché) et le joueur est en combat.
//
// ACTIONS JOUEUR (seulement en combat ; hors combat : 'not-in-combat') :
//   { type: 'fight' }  0 PA. 1d6 + Tir + arme + couverture ≥ Menace : victoire, la rencontre
//                      est retirée. Défaite : blessures de la carte et 1 munition, le combat
//                      continue (on peut relancer).
//                      Arme : pistolet avec munitions +1, sinon -1. Couverture : forêt +1, bâtiment +2.
//   { type: 'flee' }   2 PA, retour sur player.previousHex, le jeton reste. 'not-enough-ap'.
//   combatRefusal(state, action) -> 'in-combat' | undefined, appelé par step pour refuser
//   toute autre action pendant un combat.
//
// ÉVÉNEMENTS :
//   { type: 'encounter-avoided', hex }        { type: 'encounter-revealed', hex, card }
//   { type: 'fight', card, roll, tir, weapon, cover, total, threat, won }
//   { type: 'encounter-removed', hex, card }  { type: 'fled', from, to, cost }
//
// HYPOTHÈSES v1 : se battre ne coûte pas de PA ; une victoire ne dépense pas de munition ;
// une rencontre déjà révélée garde sa carte et redemande un test de Discrétion ; la fuite ne
// déclenche pas les réactions d'entrée ; paquet vide : on remélange toutes les cartes de la tuile.
// HYPOTHÈSE v2 : plus de jetons que d'hexagones libres : on pose ce qui tient.

import { createRng } from '../rng.js';
import { distance } from '../hex.js';
import { countCharges } from './sheet.js';
import { TILE_DEFAULTS, DEFAULT_ENCOUNTER_CARDS, encounterCards, encounterCount, hasHex, tileHexes } from './tile.js';

export const ENCOUNTER_COUNT = TILE_DEFAULTS.encounters;
const FLEE_COST = 2;

// Paquet Agroprom (src/content/paquets/rencontres-agroprom.js), gardé pour l'interface et le banc v1.
export const ENCOUNTER_CARDS = DEFAULT_ENCOUNTER_CARDS;

const WEAPON_BONUS = { loaded: 1, empty: -1 };
const COVER = { foret: 1, batiment: 2 };
const STEALTH_BONUS = { foret: 1 };

export function setupEncounters(game) {
  const rng = createRng(game.rng);
  game.encounters = [];
  for (let i = 0; i < encounterCount(game.tile); i++) placeEncounter(game, rng);
  game.encounterDeck = rng.shuffle(Object.keys(encounterCards(game.tile)));
  game.combat = null;
  game.rng = rng.state();
  return game;
}

export function placeEncounter(draft, rng, allowed = null) {
  const taken = new Set(draft.encounters.map((encounter) => encounter.hex));
  const { tile } = draft;
  const isFree = (hex) =>
    hasHex(tile, hex) && hex !== tile.entry && !taken.has(hex) && (!allowed || allowed.includes(hex));

  const hasRoom = tileHexes(tile).some(isFree);
  if (!hasRoom) return null;

  let hex = rng.d20();
  while (!isFree(hex)) hex = rng.d20();
  draft.encounters.push({ hex, card: null });
  return hex;
}

export function encounterOnEnter(draft, ctx) {
  const here = draft.player.hex;
  const nearby = draft.encounters
    .filter((encounter) => distance(here, encounter.hex) <= 1)
    .sort((a, b) => distance(here, a.hex) - distance(here, b.hex));

  for (const encounter of nearby) {
    if (draft.status !== 'playing') return;
    const terrain = draft.tile.hexes[here].terrain;
    if (ctx.check('discretion', STEALTH_BONUS[terrain] ?? 0)) {
      ctx.emit({ type: 'encounter-avoided', hex: encounter.hex });
      continue;
    }
    encounter.card ??= drawCard(draft, ctx.rng);
    draft.combat = { hex: encounter.hex, card: encounter.card };
    ctx.emit({ type: 'encounter-revealed', hex: encounter.hex, card: encounter.card });
    return;
  }
}

function drawCard(draft, rng) {
  if (draft.encounterDeck.length === 0) draft.encounterDeck = rng.shuffle(Object.keys(encounterCards(draft.tile)));
  return draft.encounterDeck.shift();
}

export function combatRefusal(state, action) {
  if (state.combat && action.type !== 'fight' && action.type !== 'flee') return 'in-combat';
}

export function weaponBonus(inventory) {
  const armed = inventory.some((item) => item.kind === 'pistolet');
  const loaded = armed && countCharges(inventory, 'munitions') > 0;
  return loaded ? WEAPON_BONUS.loaded : WEAPON_BONUS.empty;
}

export function fight(draft, _action, ctx) {
  if (!draft.combat) return 'not-in-combat';
  const { hex, card } = draft.combat;
  const { threat, wounds } = encounterCards(draft.tile)[card];

  const roll = ctx.rng.d6();
  const tir = draft.player.stats.tir;
  const weapon = weaponBonus(draft.inventory);
  const cover = COVER[draft.tile.hexes[draft.player.hex].terrain] ?? 0;
  const total = roll + tir + weapon + cover;
  const won = total >= threat;
  ctx.emit({ type: 'fight', card, roll, tir, weapon, cover, total, threat, won });

  if (won) {
    draft.encounters = draft.encounters.filter((encounter) => encounter.hex !== hex);
    draft.combat = null;
    ctx.emit({ type: 'encounter-removed', hex, card });
    return;
  }
  ctx.wound(wounds, 'combat');
  ctx.useCharge('munitions');
}

export function flee(draft, _action, ctx) {
  if (!draft.combat) return 'not-in-combat';
  if (draft.ap.left < FLEE_COST) return 'not-enough-ap';

  const from = draft.player.hex;
  const to = draft.player.previousHex;
  ctx.spend(FLEE_COST);
  draft.player.hex = to;
  draft.player.previousHex = from;
  draft.combat = null;
  ctx.emit({ type: 'fled', from, to, cost: FLEE_COST });
}
