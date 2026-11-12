// Dialogue de base du voyageur, itinérant de la Décharge (brief v2 §3.4, Arrêt de bus).
import { deepFreeze } from '../freeze.js';

export default deepFreeze({
  start: 'accueil',
  nodes: {
    accueil: {
      text: 'Un stalker assis sur son sac. Il compte ses cartouches.',
      choices: [
        { text: 'Tu attends quelqu’un ?', next: 'presentation', conditions: [{ type: 'premiere-visite' }] },
        { text: 'La route est sûre ?', next: 'route' },
        { text: 'Au revoir.', next: null },
      ],
    },
    presentation: {
      text: 'Le bus. Il passe plus depuis vingt ans. J’attends quand même.',
      choices: [{ text: 'Bonne attente.', next: 'accueil' }],
    },
    route: {
      text: 'Les bandits tiennent le Barrage. Paie ou contourne par le Tunnel.',
      choices: [{ text: 'Merci.', next: 'accueil' }],
    },
  },
});
