// Dialogue de base du commandant Yarema, chef de Ciel Pur (brief v2 §7, §9).
import { deepFreeze } from '../freeze.js';

export default deepFreeze({
  start: 'accueil',
  nodes: {
    accueil: {
      text: 'Yarema étudie une carte couverte de flèches au crayon.',
      choices: [
        { text: 'Qui commande ici ?', next: 'presentation', conditions: [{ type: 'premiere-visite' }] },
        { text: 'Ciel Pur a du travail ?', next: 'travail' },
        {
          text: 'Que cherche Ciel Pur ?',
          next: 'confiance',
          conditions: [{ type: 'reputation', faction: 'ciel-pur', min: 2 }],
        },
        { text: 'Au revoir.', next: null },
      ],
    },
    presentation: {
      text: 'Moi. Nous étudions la Zone. Les Émissions surtout.',
      choices: [{ text: 'Je vois.', next: 'accueil' }],
    },
    travail: {
      text: 'Voir le tableau des contrats. Pour le reste, il faut d’abord gagner notre confiance.',
      choices: [{ text: 'D’accord.', next: 'accueil' }],
    },
    confiance: {
      text: 'Les Émissions viennent du centre. Quelqu’un les provoque. Ne le répète pas.',
      choices: [{ text: 'Promis.', next: 'accueil' }],
    },
  },
});
