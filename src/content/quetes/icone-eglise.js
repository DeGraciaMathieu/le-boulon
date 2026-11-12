// Quête secondaire « L’icône de l’Église » (brief v2 §8.1, §8.2), donnée par Pavlo l’éclaireur à la
// Base de Ciel Pur : retrouver la carte annotée cachée derrière l’icône de l’Église (carte fixée
// 'icone' de son paquet), puis la lui rapporter. Sans délai. Récompenses : hypothèse v2.
import { deepFreeze } from '../freeze.js';

export default deepFreeze({
  name: 'L’icône de l’Église',
  giver: 'pavlo',
  start: 'eglise',
  rewards: { roubles: 200, xp: 40, reputation: { 'ciel-pur': 1 } },
  steps: {
    eglise: { objective: { type: 'explorer', place: 'eglise', card: 'icone' }, next: ['retour'] },
    retour: { objective: { type: 'parler', npc: 'pavlo', node: 'icone' }, next: [] },
  },
});
