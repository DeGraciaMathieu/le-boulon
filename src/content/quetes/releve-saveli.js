// Quête secondaire « Le relevé de Saveli » (brief v2 §8.1, §8.2), donnée par Saveli : révéler
// tous les jetons suspects du Cordon, puis lui rapporter le relevé. Sans délai. Récompenses :
// hypothèse v2.
import { deepFreeze } from '../freeze.js';

export default deepFreeze({
  name: 'Le relevé de Saveli',
  giver: 'saveli',
  start: 'releve',
  rewards: { roubles: 120, xp: 40 },
  steps: {
    releve: { objective: { type: 'cartographier', tile: 'cordon' }, next: ['remise'] },
    remise: { objective: { type: 'parler', npc: 'saveli', node: 'releve' }, next: [] },
  },
});
