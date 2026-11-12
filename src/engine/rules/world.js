// Voyage entre tuiles et état du monde (brief v2 §3.2, §10.2 ; carte 6).
// Contenu : content.links (src/content/liaisons.js), content.tiles.
//
// ACTION DE CAMPAGNE { type: 'travel' } (CAMPAIGN_ACTIONS de campaign.js) :
//   Depuis un hexagone de liaison de la tuile courante, 1 PA (TRAVEL_COST) : le joueur arrive
//   sur l'hexagone de liaison correspondant de la tuile voisine (content.links). Les PA restants
//   de la journée passent sur la tuile d'arrivée.
//   Refus : 'game-over' (journée finie), 'in-combat', 'not-a-link' (hexagone sans liaison),
//   'not-enough-ap'.
//
// ÉTAT DES TUILES (§10.2) : world.tiles[id] garde l'état v1 de chaque tuile visitée (jetons
// suspects, rencontres, paquets, mission v1). Il est créé à la première visite et conservé
// ensuite. Lieux (campaign.places) et planques (campaign.stashes) sont rangés par id au niveau
// de la campagne et portent leur tuile : ils sont conservés sans rien faire ici.
//   world.tiles[id].lastVisit   jour où le joueur a quitté la tuile pour la dernière fois
//                               (absent tant qu'il ne l'a jamais quittée ; facultatif, donc
//                               pas de changement de CAMPAIGN_VERSION)
//
// RENCONTRES REPOSÉES : en entrant sur une tuile quittée depuis au moins RESET_AFTER_DAYS jour,
// ses jetons de rencontre sont retirés et reposés (paquet de la tuile remélangé). Les jetons
// suspects restent.
//
// HOOK TEMPS (carte 7) : le jour n'avance pas encore. La règle lit seulement campaign.day :
// la carte 7 n'a qu'à l'incrémenter, la repose se fera à l'entrée suivante sur chaque tuile.
//
// LECTURE (pure) :
//   travelTarget(campaign)        -> { tile, hex } | null   liaison sous le joueur
//   knownTiles(campaign)          -> [id]   tuiles visitées (carte du monde, carte 24)
//   daysAway(campaign, id)        -> nombre de jours depuis le départ de la tuile, 0 si jamais quittée
//
// PATROUILLES (LBL-49) : à l'arrivée, après la repose, syncPatrols (rules/patrols.js) pose les
// jetons des patrouilles présentes sur la tuile et retire ceux des autres tuiles.
//
// ÉVÉNEMENTS :
//   { type: 'traveled', from: { tile, hex }, to: { tile, hex }, cost, firstVisit }
//   { type: 'encounters-reset', tile, hexes }
//   { type: 'day-ended', reason: 'no-ap' }   le voyage a dépensé le dernier PA
//
// ENTRY DES TUILES : l'arrivée d'un voyage est l'hexagone de la liaison empruntée, jamais
// tile.entry. entry reste utile à trois choses : hexagone de départ d'une campagne ou d'une
// journée v1 sur la tuile (Camp des novices au Cordon), hexagone tenu libre de jetons par les
// règles v1 (suspects, rencontres, carte Zone chiens). Les entry provisoires des tuiles hors
// Cordon (LBL-19) ne servent donc plus qu'à ce dernier rôle et à démarrer une campagne de test
// sur cette tuile. À la création d'une tuile et à la repose, l'hexagone d'arrivée est tenu
// libre à la place de entry.
//
// HYPOTHÈSES V2 :
//   - Arriver sur une tuile ne déclenche pas les réactions d'entrée (jetons, rencontres
//     voisines, radiation), comme la fuite v1.
//   - Le PA du voyage ne fait pas piocher le paquet Zone (la carte 7 reprendra le rythme).
//   - Un voyage qui dépense le dernier PA finit la journée sur la tuile d'arrivée (status
//     'night'), sans résultat de mission v1.
//   - La nouvelle tuile tire ses jetons dans un flux dérivé du RNG de campagne (une graine
//     tirée par ctx.rng), ce qui garde la campagne déterministe.

import { createGame } from '../game.js';
import { dayState, storeDay } from '../campaign.js';
import { setupEncounters } from './encounters.js';
import { syncPatrols } from './patrols.js';
import content from '../../content/index.js';

export const TRAVEL_COST = 1;
// « quittée depuis au moins 1 jour » (§10.2).
export const RESET_AFTER_DAYS = 1;

const UINT32_MAX = 0xffffffff;

export function travelTarget(campaign) {
  const { currentTile, hex } = campaign.world;
  return content.links[currentTile]?.[hex] ?? null;
}

export function knownTiles(campaign) {
  return Object.keys(campaign.world.tiles);
}

export function daysAway(campaign, id) {
  const { lastVisit } = campaign.world.tiles[id] ?? {};
  return lastVisit === undefined ? 0 : campaign.day - lastVisit;
}

export function travel(draft, _action, ctx) {
  const departure = dayState(draft);
  const target = travelTarget(draft);
  if (departure.status !== 'playing') return 'game-over';
  if (departure.combat) return 'in-combat';
  if (!target) return 'not-a-link';
  if (departure.ap.left < TRAVEL_COST) return 'not-enough-ap';

  const from = { tile: draft.world.currentTile, hex: draft.world.hex };
  const ap = { ...departure.ap, left: departure.ap.left - TRAVEL_COST, spent: departure.ap.spent + TRAVEL_COST };
  storeDay(draft, { ...departure, ap });
  draft.world.tiles[from.tile].lastVisit = draft.day;

  const firstVisit = !draft.world.tiles[target.tile];
  if (firstVisit) draft.world.tiles[target.tile] = newTileState(target, ctx);
  draft.world.currentTile = target.tile;
  draft.world.hex = target.hex;
  const arrival = dayState(draft);
  arrival.ap = ap;
  arrival.status = 'playing';
  // La pénalité des 4 blessures est déjà dans les PA de la journée.
  arrival.player = { ...arrival.player, previousHex: null, woundPenalty: departure.player.woundPenalty };
  ctx.emit({ type: 'traveled', from, to: target, cost: TRAVEL_COST, firstVisit });

  if (!firstVisit && daysAway(draft, target.tile) >= RESET_AFTER_DAYS) resetEncounters(arrival, target, ctx);
  if (ap.left === 0) {
    arrival.status = 'night';
    ctx.emit({ type: 'day-ended', reason: 'no-ap' });
  }
  storeDay(draft, arrival);
  syncPatrols(draft, ctx);
}

// État v1 neuf de la tuile, jetons posés hors de l'hexagone d'arrivée, sans les champs tenus
// par la campagne (voir storeDay).
function newTileState(target, ctx) {
  const tile = content.tiles[target.tile];
  const fresh = createGame({ seed: ctx.rng.int(0, UINT32_MAX), tile: { ...tile, entry: target.hex } });
  const { seed, rng, inventory, player: { hex, wounds, radiation, stats, ...player }, ...tileState } = fresh;
  return { ...tileState, tile: structuredClone(tile), player };
}

function resetEncounters(day, target, ctx) {
  const { tile, rng } = day;
  day.tile = { ...tile, entry: target.hex };
  day.rng = ctx.rng.int(0, UINT32_MAX);
  setupEncounters(day);
  day.tile = tile;
  day.rng = rng;
  ctx.emit({ type: 'encounters-reset', tile: target.tile, hexes: day.encounters.map((encounter) => encounter.hex) });
}
