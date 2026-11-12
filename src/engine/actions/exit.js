// Action { type: 'exit' } : quitter la tuile depuis un hexagone de bord, ce qui finit la journée.
// Sans coût en PA (hypothèse v1). La victoire (mission remplie) se juge ailleurs.

import { isEdge } from '../hex.js';

export function exit(draft, _action, ctx) {
  if (!isEdge(draft.player.hex)) return 'not-on-edge';
  draft.status = 'exited';
  ctx.emit({ type: 'exited', hex: draft.player.hex });
}
