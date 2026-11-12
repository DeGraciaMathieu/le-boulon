// Quête secondaire « La caisse de Matviï » (brief v2 §8.1, §8.2), donnée par Matviï à la Base de
// Liberté. Embranchement au nœud caisse de son dialogue : livrer la caisse au Village abandonné, ou
// la vendre au Devoir (sergent Ostap, au Bar : +1 Devoir, −2 Liberté par son dialogue). Délai et
// récompenses : hypothèse v2.
import { deepFreeze } from '../freeze.js';

export default deepFreeze({
  name: 'La caisse de Matviï',
  giver: 'matvii',
  start: 'caisse',
  deadline: 3,
  rewards: { roubles: 300, xp: 50, reputation: { liberte: 1 } },
  steps: {
    caisse: { objective: { type: 'parler', npc: 'matvii', node: 'caisse' }, next: ['livrer', 'devoir'] },
    livrer: { objective: { type: 'visiter', place: 'village-abandonne' }, next: [] },
    devoir: { objective: { type: 'parler', npc: 'ostap', node: 'caisse' }, next: [] },
  },
});
