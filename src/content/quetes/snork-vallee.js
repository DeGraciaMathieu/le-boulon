// Quête secondaire « Le snork de la Vallée » (brief v2 §8.1, §8.2), donnée par le Chasseur,
// itinérant de la Vallée Sombre : abattre un snork de la Vallée, puis le retrouver. Sans délai.
// Récompenses : hypothèse v2.
import { deepFreeze } from '../freeze.js';

export default deepFreeze({
  name: 'Le snork de la Vallée',
  giver: 'chasseur',
  start: 'traque',
  rewards: { roubles: 400, xp: 70, items: ['cartouches-12'] },
  steps: {
    traque: { objective: { type: 'eliminer', encounter: 'snork', tile: 'vallee-sombre' }, next: ['rapport'] },
    rapport: { objective: { type: 'parler', npc: 'chasseur', node: 'snork' }, next: [] },
  },
});
