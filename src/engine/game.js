// Cœur du moteur de règles : état de partie et boucle step(state, action).
//
// API :
//   createGame({ seed, tile })  -> state
//   step(state, action)         -> { state, events }
//   step est pur : l'état reçu n'est jamais modifié. Une action refusée rend
//   le même objet state et un seul événement « refused ».
//
// FORME DE L'ÉTAT (sérialisable, structuredClone suffit) :
//   {
//     seed,                        graine de départ
//     rng,                         état interne du RNG (uint32), avance à chaque tirage
//     tile,                        { name, entry, hexes } (format de src/engine/data/agroprom.js)
//     status,                      'playing' | 'exited' | 'night' (0 PA sans être sorti) | 'dead'
//     turn,                        nombre d'actions acceptées
//     ap: { max, left, spent },    budget de PA de la journée
//     player: {
//       hex, previousHex,          position (numéro 1-19) et précédente (null au départ), pour la fuite
//       wounds, radiation,         pistes 0-6 (src/engine/rules/sheet.js)
//       woundPenalty,              true une fois la pénalité de PA des 4 blessures appliquée
//       stats: { tir, survie, discretion, endurance },
//     },
//     inventory,                   [{ kind, size, charges? }], grille de 12 cases (sheet.js)
//     encounters, encounterDeck, combat   rencontres (src/engine/rules/encounters.js)
//     tokens, zone, mission        réservés aux cartes suivantes
//   }
//
// ÉVÉNEMENTS (un objet { type, ... } par ligne de journal) :
//   { type: 'moved', from, to, cost }
//   { type: 'check', stat, roll, bonus, target, success }
//   { type: 'wounded', amount, cause }   et les autres événements de la fiche (sheet.js)
//   { type: 'exited', hex }
//   { type: 'day-ended', reason: 'no-ap' }
//   { type: 'refused', action, reason }
//     reason : 'game-over' | 'unknown-action' | 'not-adjacent' | 'not-enough-ap' | 'not-on-edge'
//              | 'not-usable' | 'no-item' | 'in-combat' | 'not-in-combat'
//   et les événements des rencontres (encounters.js)
//
// BRANCHER UNE RÈGLE :
//   - Nouvelle action (boulon, fouille, fuite…) : écrire un handler
//     (draft, action, ctx) -> string | undefined dans src/engine/actions/ et
//     l'ajouter à ACTIONS. Le handler valide d'abord et rend une raison de
//     refus sans rien toucher, sinon il modifie le brouillon `draft` (copie de
//     l'état) et annonce ce qu'il fait par ctx.emit(event).
//   - Réaction à l'entrée sur un hexagone (jetons, rencontres) : ajouter une
//     fonction (draft, ctx) à ON_ENTER dans src/engine/actions/move.js.
//   - ctx.rng : RNG à graine dont l'état est reporté dans draft.rng à la fin
//     du step ; ctx.spend(cost) dépense des PA ; ctx.check(stat, extra?) fait un test (bonus extra en plus de la stat) et rend sa réussite.
//   - Fiche (blessures, radiations, inventaire) : ctx.wound, ctx.irradiate, ctx.addItem,
//     ctx.removeItem, ctx.useCharge, documentés en tête de src/engine/rules/sheet.js.

import { createRng } from './rng.js';
import { move } from './actions/move.js';
import { exit } from './actions/exit.js';
import { setupEncounters, combatRefusal, fight, flee } from './rules/encounters.js';
import { use, wound, irradiate, addItem, removeItem, useCharge, startingInventory } from './rules/sheet.js';

export const BASE_AP = 10;

const START_STATS = Object.freeze({ tir: 1, survie: 1, discretion: 1, endurance: 0 });

const ACTIONS = { move, exit, use, fight, flee };

export function createGame({ seed, tile }) {
  const stats = { ...START_STATS };
  const max = BASE_AP + stats.endurance;
  return setupEncounters({
    seed,
    rng: seed >>> 0,
    tile: structuredClone(tile),
    status: 'playing',
    turn: 0,
    ap: { max, left: max, spent: 0 },
    player: { hex: tile.entry, previousHex: null, wounds: 0, radiation: 0, woundPenalty: false, stats },
    tokens: [],
    encounters: [],
    inventory: startingInventory(),
    zone: null,
    mission: null,
  });
}

export function step(state, action) {
  const refuse = (reason) => ({ state, events: [{ type: 'refused', action, reason }] });

  if (state.status !== 'playing') return refuse('game-over');
  const handler = ACTIONS[action.type];
  if (!handler) return refuse('unknown-action');
  const inCombat = combatRefusal(state, action);
  if (inCombat) return refuse(inCombat);

  const draft = structuredClone(state);
  const events = [];
  const rng = createRng(draft.rng);
  const ctx = {
    rng,
    emit: (event) => events.push(event),
    spend: (cost) => {
      draft.ap.left -= cost;
      draft.ap.spent += cost;
    },
    check: (stat, extra = 0) => skillCheck(draft, stat, extra, ctx),
    wound: (amount, cause) => wound(draft, amount, cause, ctx.emit),
    irradiate: (amount, cause) => irradiate(draft, amount, cause, ctx.emit),
    addItem: (item) => addItem(draft, item),
    removeItem: (kind, cause) => removeItem(draft, kind, cause, ctx.emit),
    useCharge: (kind) => useCharge(draft, kind),
  };

  const refusal = handler(draft, action, ctx);
  if (refusal) return refuse(refusal);

  draft.turn += 1;
  draft.rng = rng.state();
  endDayIfExhausted(draft, ctx);
  return { state: draft, events };
}

// Test de compétence (hypothèse v1) : 1d6 + stat ≥ 5.
const CHECK_TARGET = 5;

function skillCheck(draft, stat, extra, ctx) {
  const roll = ctx.rng.d6();
  const bonus = draft.player.stats[stat] + extra;
  const success = roll + bonus >= CHECK_TARGET;
  ctx.emit({ type: 'check', stat, roll, bonus, target: CHECK_TARGET, success });
  return success;
}

function endDayIfExhausted(draft, ctx) {
  if (draft.status !== 'playing' || draft.ap.left > 0) return;
  draft.status = 'night';
  ctx.emit({ type: 'day-ended', reason: 'no-ap' });
}
