// Quête secondaire « Le pèlerinage » (brief v2 §8.1, §8.2), donnée par le Pèlerin, itinérant du
// Marais : le conduire vivant jusqu’au Hameau des pêcheurs. Délai et récompenses : hypothèse v2.
import { deepFreeze } from '../freeze.js';

export default deepFreeze({
  name: 'Le pèlerinage',
  giver: 'pelerin',
  start: 'escorte',
  deadline: 2,
  rewards: { xp: 50, items: ['meduse'] },
  steps: {
    escorte: { objective: { type: 'escorter', npc: 'pelerin', place: 'hameau-pecheurs' }, next: [] },
  },
});
