// Quête secondaire « Le champ qui bouge » (brief v2 §8.1, §8.2), donnée par Dzyga, technicien de
// Liberté : révéler tous les jetons suspects des Entrepôts depuis que le Champ d’anomalies a bougé,
// puis lui rapporter le relevé. Sans délai. Récompenses : hypothèse v2.
import { deepFreeze } from '../freeze.js';

export default deepFreeze({
  name: 'Le champ qui bouge',
  giver: 'dzyga',
  start: 'releve',
  rewards: { roubles: 500, xp: 80, items: ['boulons'] },
  steps: {
    releve: { objective: { type: 'cartographier', tile: 'entrepots' }, next: ['remise'] },
    remise: { objective: { type: 'parler', npc: 'dzyga', node: 'releve' }, next: [] },
  },
});
