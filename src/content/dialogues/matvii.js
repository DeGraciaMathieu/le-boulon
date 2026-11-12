// Dialogue de base de Matviï, marchand de Liberté (brief v2 §6.2 : armures légères,
// consommables).
import { deepFreeze } from '../freeze.js';

export default deepFreeze({
  start: 'accueil',
  nodes: {
    accueil: {
      text: 'Matviï trie des combinaisons sur une bâche, une cigarette au coin des lèvres.',
      choices: [
        { text: 'Salut.', next: 'presentation', conditions: [{ type: 'premiere-visite' }] },
        {
          text: 'Un prix d’ami ?',
          next: 'confiance',
          conditions: [{ type: 'reputation', faction: 'liberte', min: 2 }],
        },
        { text: 'Au revoir.', next: null },
      ],
    },
    presentation: {
      text: 'Légères, pratiques, pas chères. La liberté a un prix, mais il est bas.',
      choices: [{ text: 'Je regarde.', next: 'accueil' }],
    },
    confiance: {
      text: 'Pour toi, je trouverai bien quelque chose.',
      choices: [{ text: 'Merci.', next: 'accueil' }],
    },
  },
});
