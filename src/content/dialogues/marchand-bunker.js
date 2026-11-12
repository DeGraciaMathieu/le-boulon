// Dialogue de base du Marchand du bunker (brief v2 §7, §8.3 acte 1). Le nœud travail
// accueillera la quête « Le Guide » (cartes 20-21) ; la boutique, la carte 13.
import { deepFreeze } from '../freeze.js';

export default deepFreeze({
  start: 'accueil',
  nodes: {
    accueil: {
      text: 'Bunker. Odeur de graisse et de tabac. Le Marchand ne lève pas les yeux de son registre.',
      choices: [
        { text: 'Je suis nouveau.', next: 'presentation', conditions: [{ type: 'premiere-visite' }] },
        { text: 'Tu as du travail ?', next: 'travail' },
        {
          text: 'Des nouvelles de la Zone ?',
          next: 'confiance',
          conditions: [{ type: 'reputation', faction: 'solitaires', min: 2 }],
        },
        { text: 'Au revoir.', next: null },
      ],
    },
    presentation: {
      text: 'Un bleu de plus. Ici, tout se paie. Tu ramènes des artefacts, je paie bien. Tu me fais perdre mon temps, je l’oublie pas.',
      choices: [{ text: 'Compris.', next: 'accueil' }],
    },
    travail: {
      text: 'Reviens quand tu sauras tenir une arme. Pour l’instant, rien.',
      choices: [{ text: 'D’accord.', next: 'accueil' }],
    },
    confiance: {
      text: 'Les militaires ont doublé la garde à l’Avant-poste. Passe par la Ferme.',
      choices: [{ text: 'Merci.', next: 'accueil' }],
    },
  },
});
