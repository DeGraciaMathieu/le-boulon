// Dialogue de base du Pèlerin, itinérant du Marais (brief v2 §7).
import { deepFreeze } from '../freeze.js';

export default deepFreeze({
  start: 'accueil',
  nodes: {
    accueil: {
      text: 'Un vieil homme en capuche, les bottes pleines de boue. Il prie à voix basse.',
      choices: [
        { text: 'Qui êtes-vous ?', next: 'presentation', conditions: [{ type: 'premiere-visite' }] },
        { text: 'Que cherchez-vous ?', next: 'signe' },
        { text: 'Au revoir.', next: null },
      ],
    },
    presentation: {
      text: 'Personne. Je marche d’une église à l’autre. La Zone m’a laissé vivre.',
      choices: [{ text: 'Je vois.', next: 'accueil' }],
    },
    signe: {
      text: 'Un signe. Peut-être le tien.',
      choices: [{ text: 'Bonne route.', next: 'accueil' }],
    },
  },
});
