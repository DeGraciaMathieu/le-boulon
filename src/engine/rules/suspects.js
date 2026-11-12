// Jetons suspects, boulon et détecteur.
//
// JETON (state.tokens[]) :
//   { hex, kind: 'anomalie' | 'artefact' | 'rien', anomaly?, revealed, original, item? }
//   item     : artefact rare posé par l'Émission globale (rules/emission.js), id d'objet ;
//              ramassé, il donne cet objet au lieu de l'artefact v1 sans nom.
//   anomaly  : 'electro' | 'gravitationnelle' | 'bruleuse' (anomalies seulement)
//   original : true pour les 5 jetons de la mise en place, false pour ceux reposés
//              après l'Émission (mission Cartographie).
//   Un artefact ramassé quitte state.tokens ; les autres jetons restent, révélés ou non.
// DÉTECTEUR : state.detector = { broken }.
//
// MISE EN PLACE :
//   placeSuspects(state, rng, { original = true })
//     remplace state.tokens par des jetons neufs face cachée, selon la composition de la
//     tuile (src/engine/rules/tile.js ; par défaut 5 : 2 anomalies, type tiré au hasard
//     parmi ceux de la tuile pour chacune, 2 artefacts, 1 rien). Chaque jeton est posé au
//     d20, relancé hors de la tuile (20 compris), sur un hexagone déjà pris par un autre
//     jeton suspect, sur l'entrée ou sous le joueur. Une anomalie est aussi relancée sur un
//     hexagone de tile.noAnomaly (tuile de campagne : lieux et liaisons, campaignTile de
//     rules/world.js ; la v1 n'a pas ce champ). Si un artefact n'est pas adjacent à une
//     anomalie, on retire tout et on recommence. L'Émission (LBL-8) l'appelle avec
//     { original: false }.
//
// LECTURE (pures) :
//   tokenAt(state, hex)            jeton de cet hexagone ou undefined
//   isBlocked(state, hex)          true si une anomalie révélée occupe l'hexagone (move refusé)
//
// RÉACTION À L'ENTRÉE (ON_ENTER de src/engine/actions/move.js) : suspectsOnEnter
//   1. Jeton non révélé sous le joueur : il est révélé. Anomalie : test de Survie, réussi
//      il évite l'effet, raté il le subit :
//        electro          2 blessures, détecteur en panne
//        gravitationnelle 3 blessures, projeté sur un voisin au hasard non bloqué, sans
//                         coût de PA ; un jeton non révélé à l'arrivée se déclenche à son tour
//        bruleuse         2 blessures, un consommable au hasard détruit
//   2. Détecteur (s'il marche) : révèle les artefacts à 2 hexagones ou moins.
//      Avec un champ equipment (journée de campagne) : portée du détecteur porté (Écho 1,
//      Ours 2, Vélès 3, aucun détecteur : rien) ; le Vélès révèle aussi les anomalies et leur
//      type (hypothèse v2 : une anomalie ainsi révélée bloque l'hexagone comme au boulon).
//      Savoir-faire Œil de lynx : portée +1, seulement avec un détecteur (rules/progression.js).
//
// ACTIONS JOUEUR :
//   { type: 'bolt', target }  1 PA + 1 boulon, hexagone adjacent ; révèle le jeton (ou rien).
//     Savoir-faire Bouliste : révèle aussi l'hexagone suivant en ligne, s'il est sur la tuile.
//     Refus : 'not-adjacent' | 'no-bolt' | 'not-enough-ap'.
//   { type: 'pickup' }        1 PA + test de Survie sur un artefact révélé sous le joueur.
//     Réussi : l'objet { kind: 'artefact', size: 1, value } entre dans l'inventaire et le
//     jeton disparaît. Raté : PA perdu, le jeton reste.
//     Refus : 'no-artefact' | 'inventory-full' | 'not-enough-ap'.
//
// ÉVÉNEMENTS :
//   { type: 'token-revealed', hex, kind, anomaly?, original, by: 'enter' | 'bolt' | 'detector' }
//   { type: 'anomaly-avoided', hex, anomaly }   { type: 'anomaly-triggered', hex, anomaly }
//   { type: 'detector-broken' }                 { type: 'thrown', from, to }
//   { type: 'bolt-thrown', target }
//   { type: 'artefact-picked', hex, value }     { type: 'pickup-failed', hex }
//   { type: 'artefact-picked', hex, item }      artefact rare (jeton avec item)
//
// HYPOTHÈSES V1 :
//   - Un artefact vaut ARTEFACT_VALUE roubles, la même valeur pour tous.
//   - Le d20 évite aussi l'hexagone du joueur (utile quand l'Émission repose les jetons).
//   - Projection : l'hexagone d'arrivée ne refait pas le test du marais ; les réactions
//     suivantes de ON_ENTER (rencontres) voient la nouvelle position. previousHex ne change pas.
//   - Ramasser raté : on peut réessayer.
// HYPOTHÈSES V2 :
//   - Une composition sans anomalie ne demande pas d'artefact adjacent (sinon pose impossible).
//   - Plus de jetons que d'hexagones libres : erreur à la mise en place.

import { neighbors, distance, toAxial, toNumber } from '../hex.js';
import { hasHex, tileHexes, suspectComposition, anomalyKinds } from './tile.js';
import { consumables, createItem, countCharges, usedSlots, inventoryCapacity } from './sheet.js';
import { detectorOf } from './equipment.js';
import { detectorModifier } from './time.js';
import { hasPerk } from './progression.js';

export const ARTEFACT_VALUE = 1000;
export const DETECTOR_RANGE = 2;
const BOLT_COST = 1;
const PICKUP_COST = 1;
const LYNX_RANGE = 1;

const ANOMALY_EFFECTS = {
  electro: (draft, ctx) => {
    ctx.wound(2, 'electro');
    draft.detector.broken = true;
    ctx.emit({ type: 'detector-broken' });
  },
  gravitationnelle: (draft, ctx) => {
    ctx.wound(3, 'gravitationnelle');
    if (draft.status === 'playing') throwPlayer(draft, ctx);
  },
  bruleuse: (draft, ctx) => {
    ctx.wound(2, 'bruleuse');
    const burnable = consumables(draft.inventory);
    if (burnable.length > 0) ctx.removeItem(ctx.rng.pick(burnable), 'bruleuse');
  },
};

export function placeSuspects(state, rng, { original = true } = {}) {
  const { tile } = state;
  const forbidden = new Set([tile.entry, state.player.hex]);
  const composition = suspectComposition(tile);
  const room = tileHexes(tile).filter((n) => !forbidden.has(n)).length;
  if (composition.length > room) throw new Error(`tuile ${tile.name} : pas assez d'hexagones libres pour les jetons`);
  let tokens;
  do {
    tokens = drawTokens(rng, tile, forbidden, original);
  } while (!artefactsNextToAnomalies(tokens));
  state.tokens = tokens;
}

function drawTokens(rng, tile, forbidden, original) {
  const taken = new Set(forbidden);
  const noAnomaly = tile.noAnomaly ?? [];
  return suspectComposition(tile).map((kind) => {
    const hex = rollFreeHex(rng, tile, kind === 'anomalie' ? new Set([...taken, ...noAnomaly]) : taken);
    taken.add(hex);
    const token = { hex, kind, revealed: false, original };
    if (kind === 'anomalie') token.anomaly = rng.pick(anomalyKinds(tile));
    return token;
  });
}

function rollFreeHex(rng, tile, taken) {
  let hex;
  do {
    hex = rng.d20();
  } while (!hasHex(tile, hex) || taken.has(hex));
  return hex;
}

function artefactsNextToAnomalies(tokens) {
  const anomalyHexes = tokens.filter((t) => t.kind === 'anomalie').map((t) => t.hex);
  if (anomalyHexes.length === 0) return true;
  return tokens
    .filter((t) => t.kind === 'artefact')
    .every((t) => neighbors(t.hex).some((n) => anomalyHexes.includes(n)));
}

export function tokenAt(state, hex) {
  return state.tokens.find((token) => token.hex === hex);
}

export function isBlocked(state, hex) {
  const token = tokenAt(state, hex);
  return Boolean(token && token.revealed && token.kind === 'anomalie');
}

function reveal(token, by, ctx) {
  token.revealed = true;
  const { hex, kind, anomaly, original } = token;
  ctx.emit({ type: 'token-revealed', hex, kind, ...(anomaly && { anomaly }), original, by });
}

export function suspectsOnEnter(draft, ctx) {
  triggerHiddenToken(draft, ctx);
  if (draft.status === 'playing') scanWithDetector(draft, ctx);
}

function triggerHiddenToken(draft, ctx) {
  const token = tokenAt(draft, draft.player.hex);
  if (!token || token.revealed) return;
  reveal(token, 'enter', ctx);
  if (token.kind !== 'anomalie') return;

  const { hex, anomaly } = token;
  if (ctx.check('survie')) {
    ctx.emit({ type: 'anomaly-avoided', hex, anomaly });
    return;
  }
  ctx.emit({ type: 'anomaly-triggered', hex, anomaly });
  ANOMALY_EFFECTS[anomaly](draft, ctx);
}

function throwPlayer(draft, ctx) {
  const from = draft.player.hex;
  const landings = neighbors(from).filter((n) => !isBlocked(draft, n));
  if (landings.length === 0) return;
  const to = ctx.rng.pick(landings);
  draft.player.hex = to;
  ctx.emit({ type: 'thrown', from, to });
  triggerHiddenToken(draft, ctx);
}

function scanWithDetector(draft, ctx) {
  if (draft.detector.broken) return;
  const { range, anomalyType } = draft.equipment
    ? (detectorOf(draft.equipment) ?? { range: -1, anomalyType: false })
    : { range: DETECTOR_RANGE, anomalyType: false };
  const detected = anomalyType ? ['artefact', 'anomalie'] : ['artefact'];
  const lynx = range >= 0 && hasPerk(draft, 'oeil-de-lynx') ? LYNX_RANGE : 0;
  // Météo du jour (pluie : -1, src/engine/rules/time.js), jamais sous l'hexagone du joueur.
  const reach = range >= 0 ? Math.max(0, range + lynx + detectorModifier(draft)) : range;
  for (const token of draft.tokens) {
    const inRange = distance(draft.player.hex, token.hex) <= reach;
    if (detected.includes(token.kind) && !token.revealed && inRange) reveal(token, 'detector', ctx);
  }
}

export function bolt(draft, { target }, ctx) {
  if (!neighbors(draft.player.hex).includes(target)) return 'not-adjacent';
  if (countCharges(draft.inventory, 'boulons') === 0) return 'no-bolt';
  if (draft.ap.left < BOLT_COST) return 'not-enough-ap';

  ctx.spend(BOLT_COST);
  ctx.useCharge('boulons');
  ctx.emit({ type: 'bolt-thrown', target });
  const targets = hasPerk(draft, 'bouliste') ? [target, nextInLine(draft.player.hex, target)] : [target];
  for (const hex of targets) {
    const token = tokenAt(draft, hex);
    if (token && !token.revealed) reveal(token, 'bolt', ctx);
  }
}

// Hexagone qui suit target dans la direction from -> target, s'il est sur la tuile.
function nextInLine(from, target) {
  const a = toAxial(from);
  const b = toAxial(target);
  return toNumber({ q: 2 * b.q - a.q, r: 2 * b.r - a.r });
}

export function pickup(draft, _action, ctx) {
  const hex = draft.player.hex;
  const token = tokenAt(draft, hex);
  if (!token || token.kind !== 'artefact' || !token.revealed) return 'no-artefact';
  // Artefact rare posé par l'Émission (rules/emission.js) : l'objet nommé du jeton.
  const item = token.item ? createItem(token.item) : createItem('artefact', { value: ARTEFACT_VALUE });
  if (usedSlots(draft.inventory) + item.size > inventoryCapacity(draft)) return 'inventory-full';
  if (draft.ap.left < PICKUP_COST) return 'not-enough-ap';

  ctx.spend(PICKUP_COST);
  if (!ctx.check('survie')) {
    ctx.emit({ type: 'pickup-failed', hex });
    return;
  }
  ctx.addItem(item);
  draft.tokens.splice(draft.tokens.indexOf(token), 1);
  const picked = token.item ? { item: token.item } : { value: item.value };
  ctx.emit({ type: 'artefact-picked', hex, ...picked });
}
