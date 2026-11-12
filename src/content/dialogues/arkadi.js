// Dialogue de base d'Arkadi, technicien de Ciel Pur (brief v2 §3.4, §6.1).
import { deepFreeze } from '../freeze.js';

export default deepFreeze({
  start: 'accueil',
  nodes: {
    accueil: {
      text: 'Arkadi soude un canon sous une lampe frontale.',
      choices: [
        { text: 'Tu répares les armes ?', next: 'presentation', conditions: [{ type: 'premiere-visite' }] },
        { text: 'Tu as besoin de pièces ?', next: 'travail' },
        { text: 'Au revoir.', next: null },
      ],
    },
    presentation: {
      text: 'Armes, armures. Tout ce qui rouille. Et ici, tout rouille.',
      choices: [{ text: 'Bon à savoir.', next: 'accueil' }],
    },
    travail: {
      text: 'Toujours. Mais rien de précis pour l’instant.',
      choices: [{ text: 'D’accord.', next: 'accueil' }],
    },
  },
});
