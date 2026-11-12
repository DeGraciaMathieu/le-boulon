// Quête secondaire « Des queues de chien » (brief v2 §8.1, §8.2), donnée par la docteure Zina au
// Bar : abattre les chiens aveugles d’Agroprom (seuls à laisser le trophée queue-chien) et lui
// rapporter une queue. Délai et récompenses : hypothèse v2.
import { deepFreeze } from '../freeze.js';

export default deepFreeze({
  name: 'Des queues de chien',
  giver: 'docteur-zina',
  start: 'chasse',
  deadline: 5,
  rewards: { roubles: 350, xp: 60, items: ['antirad'] },
  steps: {
    chasse: { objective: { type: 'eliminer', encounter: 'chiens', tile: 'agroprom' }, next: ['remise'] },
    remise: { objective: { type: 'rapporter', item: 'queue-chien', npc: 'docteur-zina' }, next: [] },
  },
});
