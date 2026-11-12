// Dialogue de base de la docteure Zina, médecin du Bar (brief v2 §6.1).
import { deepFreeze } from '../freeze.js';

export default deepFreeze({
  start: 'accueil',
  nodes: {
    accueil: {
      text: 'Une arrière-salle. Zina recoud un bras sans lever la tête.',
      choices: [
        { text: 'Vous soignez ici ?', next: 'presentation', conditions: [{ type: 'premiere-visite' }] },
        { text: 'Au revoir.', next: null },
      ],
    },
    presentation: {
      text: 'Contre roubles. Le Devoir paie pour les siens, pas pour toi.',
      choices: [{ text: 'Compris.', next: 'accueil' }],
    },
  },
});
