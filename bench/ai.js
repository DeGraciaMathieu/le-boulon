// IA naïve du banc : choisit une action à partir de l'état seul, sans hasard.
//
// API : decide(state) -> action   (une action de step, voir src/engine/game.js)
//       nextAction(state, refused) -> action | null
//         comme decide, mais saute les actions déjà refusées à cet état ; null si plus rien.
//
// RÈGLES, dans l'ordre :
//   1. Combat : se bat si la Menace est atteignable (6 au dé + Tir + arme + couverture
//      ≥ Menace) ou si la fuite (2 PA) est hors de portée ; sinon fuit.
//   2. Plus de 3 blessures et un bandage : se soigne.
//   3. Émission en cours hors abri : file vers l'abri le moins cher.
//   4. Mission remplie ou impossible : rentre au bord le moins cher et sort.
//   5. Objectif de la mission :
//        Récupération  artefact révélé sous elle : le ramasse ; sinon l'artefact révélé le
//                      plus proche, à défaut le jeton non révélé le plus proche ;
//        Cartographie  le jeton d'origine non révélé le plus proche.
//      Si le PA restant ne couvre pas « aller à l'objectif + 1 PA (boulon ou ramassage)
//      + rentrer au bord », elle rentre au bord.
//   6. Avant d'entrer sur un jeton non révélé : lance un boulon dessus si elle a des
//      boulons, du PA et pas de brouillard.
// « Le plus proche » = le moins de PA (Dijkstra sur le coût d'entrée des terrains), en
// contournant les anomalies révélées. Égalité : le plus petit numéro d'hexagone.

import { neighbors, isEdge, HEXES } from '../src/engine/hex.js';
import { entryCost } from '../src/engine/actions/move.js';
import { ENCOUNTER_CARDS, weaponBonus } from '../src/engine/rules/encounters.js';
import { countCharges } from '../src/engine/rules/sheet.js';

const BEST_ROLL = 6;
const FLEE_COST = 2;
const HEAL_ABOVE = 3;
const COVER = { foret: 1, batiment: 2 };

export function decide(state) {
  return nextAction(state, []);
}

export function nextAction(state, refused) {
  const isRefused = (action) => refused.some((r) => JSON.stringify(r) === JSON.stringify(action));
  return candidates(state).find((action) => !isRefused(action)) ?? null;
}

// Actions par ordre de préférence : la première est le choix de l'IA, les suivantes des
// replis si le moteur la refuse.
function candidates(state) {
  if (state.combat) return combatActions(state);
  const list = [];
  const heal = healAction(state);
  if (heal) list.push(heal);
  list.push(...towards(state, goal(state)));
  if (isEdge(state.player.hex)) list.push({ type: 'exit' });
  list.push(...fallbackMoves(state));
  return list;
}

function combatActions(state) {
  const { threat } = ENCOUNTER_CARDS[state.combat.card];
  const cover = COVER[state.tile.hexes[state.player.hex].terrain] ?? 0;
  const best = BEST_ROLL + state.player.stats.tir + weaponBonus(state.inventory) + cover;
  const reachable = best >= threat;
  if (reachable || state.ap.left < FLEE_COST) return [{ type: 'fight' }, { type: 'flee' }];
  return [{ type: 'flee' }, { type: 'fight' }];
}

function healAction(state) {
  if (state.player.wounds <= HEAL_ABOVE) return null;
  if (!state.inventory.some((item) => item.kind === 'bandage')) return null;
  return { type: 'use', item: 'bandage' };
}

// Objectif : { hexes, then } — les hexagones visés et l'action à y faire une fois dessus.
function goal(state) {
  const { tile, zone, mission } = state;
  if (zone.emission) return { hexes: allHexes().filter((n) => tile.hexes[n].abri), then: null };
  const home = { hexes: allHexes().filter(isEdge), then: { type: 'exit' } };
  if (mission.done || mission.impossible) return home;

  const target = missionTarget(state);
  if (!target) return home;
  const costs = pathCosts(state, state.player.hex);
  const toEdge = Math.min(...home.hexes.map((n) => pathCosts(state, target.hex)[n]));
  if (costs[target.hex] + 1 + toEdge > state.ap.left) return home;
  return { hexes: [target.hex], then: target.then };
}

function missionTarget(state) {
  const hidden = state.tokens.filter((t) => !t.revealed);
  if (state.mission.kind === 'recuperation') {
    const artefacts = state.tokens.filter((t) => t.revealed && t.kind === 'artefact');
    const pool = artefacts.length > 0 ? artefacts : hidden;
    return nearest(state, pool, { type: 'pickup' });
  }
  return nearest(state, hidden.filter((t) => t.original), null);
}

function nearest(state, tokens, then) {
  const costs = pathCosts(state, state.player.hex);
  const reachable = tokens.filter((t) => Number.isFinite(costs[t.hex]));
  if (reachable.length === 0) return null;
  reachable.sort((a, b) => costs[a.hex] - costs[b.hex] || a.hex - b.hex);
  return { hex: reachable[0].hex, then };
}

// Actions pour avancer vers l'un des hexagones visés.
function towards(state, { hexes, then }) {
  const here = state.player.hex;
  if (hexes.includes(here)) return then ? [then] : [];
  const step = firstStep(state, hexes);
  if (step == null) return [];
  const token = state.tokens.find((t) => t.hex === step && !t.revealed);
  const canBolt = countCharges(state.inventory, 'boulons') > 0 && state.ap.left >= 1 && !state.zone.fog;
  const moveAction = { type: 'move', to: step };
  return token && canBolt ? [{ type: 'bolt', target: step }, moveAction] : [moveAction];
}

// Premier pas du chemin le moins cher vers le plus proche des hexagones visés.
function firstStep(state, hexes) {
  const { cost, parent } = dijkstra(state, state.player.hex);
  const reachable = hexes.filter((n) => Number.isFinite(cost[n]));
  if (reachable.length === 0) return null;
  reachable.sort((a, b) => cost[a] - cost[b] || a - b);
  let n = reachable[0];
  while (parent[n] !== state.player.hex) n = parent[n];
  return n;
}

// Replis : n'importe quel voisin abordable, le moins cher d'abord.
function fallbackMoves(state) {
  return neighbors(state.player.hex)
    .filter((n) => !isBlockedHex(state, n) && entryCost(state.tile.hexes[n]) <= state.ap.left)
    .sort((a, b) => entryCost(state.tile.hexes[a]) - entryCost(state.tile.hexes[b]) || a - b)
    .map((to) => ({ type: 'move', to }));
}

function pathCosts(state, from) {
  return dijkstra(state, from).cost;
}

function dijkstra(state, from) {
  const cost = {};
  const parent = {};
  for (const n of allHexes()) cost[n] = Infinity;
  cost[from] = 0;
  const open = new Set([from]);
  while (open.size > 0) {
    const current = [...open].sort((a, b) => cost[a] - cost[b] || a - b)[0];
    open.delete(current);
    for (const n of neighbors(current)) {
      if (isBlockedHex(state, n)) continue;
      const next = cost[current] + entryCost(state.tile.hexes[n]);
      if (next < cost[n]) {
        cost[n] = next;
        parent[n] = current;
        open.add(n);
      }
    }
  }
  return { cost, parent };
}

function isBlockedHex(state, hex) {
  return state.tokens.some((t) => t.hex === hex && t.revealed && t.kind === 'anomalie');
}

function allHexes() {
  return HEXES.map(({ n }) => n);
}
