// Dialogue de base de Rouslan, sentinelle de Liberté (brief v2 §7).
import { deepFreeze } from '../freeze.js';

export default deepFreeze({
  start: 'accueil',
  nodes: {
    accueil: {
      text: 'Rouslan monte la garde, un brin d’herbe entre les dents.',
      choices: [
        { text: 'Du nouveau aux Entrepôts ?', next: 'nouvelles' },
        { text: 'Au revoir.', next: null },
      ],
    },
    nouvelles: {
      text: 'Le Champ d’anomalies a bougé cette nuit. Personne n’y va.',
      choices: [{ text: 'Merci.', next: 'accueil' }],
    },
  },
});
