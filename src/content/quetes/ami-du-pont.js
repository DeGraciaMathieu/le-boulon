// Quête secondaire « L’ami du Pont » (brief v2 §8.1, §8.2), donnée par Vassyl le conteur au Bar :
// chercher au Pont de la Vallée Sombre la trace d’un ami parti il y a un mois (carte fixée
// 'riviere'). Embranchement au nœud trace de son dialogue : lui dire la vérité, ou le laisser
// espérer. Sans délai. Récompenses : hypothèse v2.
import { deepFreeze } from '../freeze.js';

export default deepFreeze({
  name: 'L’ami du Pont',
  giver: 'vassyl',
  start: 'pont',
  rewards: { roubles: 300, xp: 60, reputation: { solitaires: 1 } },
  steps: {
    pont: { objective: { type: 'explorer', place: 'pont', card: 'riviere' }, next: ['retour'] },
    retour: { objective: { type: 'parler', npc: 'vassyl', node: 'trace' }, next: ['verite', 'espoir'] },
    verite: { objective: { type: 'parler', npc: 'vassyl', node: 'verite' }, next: [] },
    espoir: { objective: { type: 'parler', npc: 'vassyl', node: 'espoir' }, next: [] },
  },
});
