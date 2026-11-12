// Dialogue de base de Dzyga, technicien de Liberté (brief v2 §6.1).
import { deepFreeze } from '../freeze.js';

export default deepFreeze({
  start: 'accueil',
  nodes: {
    accueil: {
      text: 'Dzyga démonte une radio. Des vis partout.',
      choices: [
        { text: 'Tu répares ?', next: 'presentation', conditions: [{ type: 'premiere-visite' }] },
        { text: 'Au revoir.', next: null },
      ],
    },
    presentation: {
      text: 'Armes, armures, radios. Apporte des pièces, je fais des miracles.',
      choices: [{ text: 'Bon à savoir.', next: 'accueil' }],
    },
  },
});
