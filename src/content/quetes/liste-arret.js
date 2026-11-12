// Quête secondaire « La liste de l’Arrêt » (brief v2 §8.1, §8.2), donnée par le voyageur de la
// Décharge : relever la liste gravée sur l’abri de l’Arrêt de bus (carte fixée 'horaires'), puis
// la lui montrer. Embranchement au nœud liste de son dialogue : chasser les racketteurs qui
// tiennent la liste, ou l’oublier. Délai et récompenses : hypothèse v2.
import { deepFreeze } from '../freeze.js';

export default deepFreeze({
  name: 'La liste de l’Arrêt',
  giver: 'voyageur-arret',
  start: 'releve',
  deadline: 3,
  rewards: { roubles: 200, xp: 50 },
  steps: {
    releve: { objective: { type: 'explorer', place: 'arret-bus', card: 'horaires' }, next: ['retour'] },
    retour: { objective: { type: 'parler', npc: 'voyageur-arret', node: 'liste' }, next: ['racketteurs', 'oubli'] },
    racketteurs: { objective: { type: 'eliminer', encounter: 'racketteurs', tile: 'decharge' }, next: [] },
    oubli: { objective: { type: 'parler', npc: 'voyageur-arret', node: 'oubli' }, next: [] },
  },
});
