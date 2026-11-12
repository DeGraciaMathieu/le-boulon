// Dialogue de base du capitaine Hordiy, Devoir (brief v2 §9 : adhésion, carte 15).
import { deepFreeze } from '../freeze.js';

export default deepFreeze({
  start: 'accueil',
  nodes: {
    accueil: {
      text: 'Le capitaine Hordiy, uniforme rouge et noir, bras croisés.',
      choices: [
        { text: 'Qu’est-ce que le Devoir ?', next: 'presentation', conditions: [{ type: 'premiere-visite' }] },
        { text: 'Le Devoir a du travail ?', next: 'travail' },
        {
          text: 'Je veux parler.',
          next: 'hostile',
          conditions: [{ type: 'reputation', faction: 'devoir', max: -2 }],
        },
        { text: 'Au revoir.', next: null },
      ],
    },
    presentation: {
      text: 'Nous protégeons le monde de la Zone. Pas l’inverse.',
      choices: [{ text: 'Je vois.', next: 'accueil' }],
    },
    travail: {
      text: 'Prouve d’abord ta valeur. Le tableau des contrats est un début.',
      choices: [{ text: 'D’accord.', next: 'accueil' }],
    },
    hostile: {
      text: 'Tu n’as rien à me dire. Sors.',
      choices: [{ text: 'Partir.', next: null }],
    },
  },
});
