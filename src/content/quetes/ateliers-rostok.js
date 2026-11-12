// Quête secondaire « Les ateliers de Rostok » (brief v2 §8.1, §8.2), donnée par Stas l’armurier au
// Bar : abattre le contrôleur qui tient les ateliers de l’Usine Rostok (paquet intérieur), puis
// revenir. Sans délai. Récompenses : hypothèse v2.
import { deepFreeze } from '../freeze.js';

export default deepFreeze({
  name: 'Les ateliers de Rostok',
  giver: 'stas',
  start: 'controleur',
  rewards: { roubles: 700, xp: 100, reputation: { devoir: 1 }, items: ['munitions-545'] },
  steps: {
    controleur: { objective: { type: 'eliminer', encounter: 'controleur', tile: 'rostok' }, next: ['rapport'] },
    rapport: { objective: { type: 'parler', npc: 'stas', node: 'ateliers' }, next: [] },
  },
});
