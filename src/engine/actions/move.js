// Action { type: 'move', to } : entrer sur un hexagone adjacent.

import { neighbors } from '../hex.js';
import { isBlocked, suspectsOnEnter } from '../rules/suspects.js';
import { encounterOnEnter } from '../rules/encounters.js';
import { hasPerk } from '../rules/progression.js';

// Coût d'entrée par terrain. Un lieu coûte toujours 1 PA, quel que soit son terrain.
// Savoir-faire Pied léger (rules/progression.js) : la forêt coûte 1 PA ; state est l'état du joueur.
const TERRAIN_COST = { route: 1, herbe: 1, foret: 2, marais: 3, batiment: 1 };
const LIEU_COST = 1;
const LIGHT_FOOT_FOREST_COST = 1;

export function entryCost(hex, state) {
  if (hex.lieu) return LIEU_COST;
  if (hex.terrain === 'foret' && hasPerk(state, 'pied-leger')) return LIGHT_FOOT_FOREST_COST;
  return TERRAIN_COST[hex.terrain];
}

// Marais : test de Survie, sinon 1 blessure.
function swampSurvival(draft, ctx) {
  const hex = draft.tile.hexes[draft.player.hex];
  if (hex.lieu || hex.terrain !== 'marais') return;
  if (ctx.check('survie')) return;
  ctx.wound(1, 'marais');
}

// Réactions à l'entrée sur un hexagone, dans l'ordre. Les jetons et rencontres s'ajoutent ici.
export const ON_ENTER = [swampSurvival, suspectsOnEnter, encounterOnEnter];

export function move(draft, { to }, ctx) {
  const from = draft.player.hex;
  if (!neighbors(from).includes(to)) return 'not-adjacent';
  if (isBlocked(draft, to)) return 'blocked';
  const cost = entryCost(draft.tile.hexes[to], draft);
  if (cost > draft.ap.left) return 'not-enough-ap';

  ctx.spend(cost);
  draft.player.previousHex = from;
  draft.player.hex = to;
  ctx.emit({ type: 'moved', from, to, cost });
  for (const react of ON_ENTER) react(draft, ctx);
}
