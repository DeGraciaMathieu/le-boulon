// Dialogue de base du sergent Ostap, garde du Devoir au Bar (brief v2 §7).
import { deepFreeze } from '../freeze.js';

export default deepFreeze({
  start: 'accueil',
  nodes: {
    accueil: {
      text: 'Ostap garde la porte. Il fixe ton arme.',
      choices: [
        { text: 'Des règles ici ?', next: 'regles' },
        { text: 'Au revoir.', next: null },
      ],
    },
    regles: {
      text: 'Arme rangée. Pas de bagarre. Pas de Liberté.',
      choices: [{ text: 'Compris.', next: 'accueil' }],
    },
  },
});
