// Quête secondaire « Les ordres du Devoir » (brief v2 §8.1, §8.2), donnée par Lesko, barman de
// Liberté : lire les ordres affichés à la Barrière du Devoir (carte fixée 'ordres'), puis les lui
// répéter. Sans délai. Récompenses : hypothèse v2 ; le Devoir n’apprécie pas (−1).
import { deepFreeze } from '../freeze.js';

export default deepFreeze({
  name: 'Les ordres du Devoir',
  giver: 'lesko',
  start: 'barriere',
  rewards: { roubles: 500, xp: 70, reputation: { liberte: 1, devoir: -1 } },
  steps: {
    barriere: { objective: { type: 'explorer', place: 'barriere-devoir', card: 'ordres' }, next: ['retour'] },
    retour: { objective: { type: 'parler', npc: 'lesko', node: 'ordres' }, next: [] },
  },
});
