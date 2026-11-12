// Quête secondaire « Le suceur de la Station » (brief v2 §8.1, §8.2), donnée par la docteure
// Melnyk à la Base de Ciel Pur : abattre le suceur de sang du Marais (carte sangsue du paquet de
// rencontres, occupant de la Station de pompage), puis revenir. Délai et récompenses : hypothèse v2.
import { deepFreeze } from '../freeze.js';

export default deepFreeze({
  name: 'Le suceur de la Station',
  giver: 'docteur-melnyk',
  start: 'traque',
  deadline: 4,
  rewards: { roubles: 300, xp: 60, items: ['trousse-soins'] },
  steps: {
    traque: { objective: { type: 'eliminer', encounter: 'sangsue', tile: 'marais' }, next: ['rapport'] },
    rapport: { objective: { type: 'parler', npc: 'docteur-melnyk', node: 'suceur-mort' }, next: [] },
  },
});
