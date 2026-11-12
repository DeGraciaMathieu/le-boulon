// Dialogue de base de Yasko, chef de Liberté (brief v2 §9 : adhésion, carte 15).
import { deepFreeze } from '../freeze.js';

export default deepFreeze({
  start: 'accueil',
  nodes: {
    accueil: {
      text: 'Yasko, pieds sur la table, joue avec un briquet.',
      choices: [
        { text: 'Qu’est-ce que Liberté ?', next: 'presentation', conditions: [{ type: 'premiere-visite' }] },
        { text: 'Liberté a du travail ?', next: 'travail' },
        {
          text: 'Je veux parler.',
          next: 'hostile',
          conditions: [{ type: 'reputation', faction: 'liberte', max: -2 }],
        },
        { text: 'Au revoir.', next: null },
      ],
    },
    presentation: {
      text: 'La Zone appartient à tout le monde. Le Devoir ne l’a pas compris.',
      choices: [{ text: 'Je vois.', next: 'accueil' }],
    },
    travail: {
      text: 'Peut-être. Montre-nous d’abord de quel côté tu es.',
      choices: [{ text: 'D’accord.', next: 'accueil' }],
    },
    hostile: {
      text: 'Toi ici ? Rouslan, raccompagne-le.',
      choices: [{ text: 'Partir.', next: null }],
    },
  },
});
