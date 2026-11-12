// Dialogue de base de Lev, marchand de Ciel Pur (brief v2 §6.2 : vend des détecteurs).
import { deepFreeze } from '../freeze.js';

export default deepFreeze({
  start: 'accueil',
  nodes: {
    accueil: {
      text: 'Lev range des détecteurs sur une planche. Chacun porte une étiquette écrite à la main.',
      choices: [
        { text: 'Bonjour.', next: 'presentation', conditions: [{ type: 'premiere-visite' }] },
        {
          text: 'Un modèle pour un ami ?',
          next: 'confiance',
          conditions: [{ type: 'reputation', faction: 'ciel-pur', min: 2 }],
        },
        { text: 'Au revoir.', next: null },
      ],
    },
    presentation: {
      text: 'Sans détecteur, le Marais te mange. Avec, il te mange moins vite.',
      choices: [{ text: 'Rassurant.', next: 'accueil' }],
    },
    confiance: {
      text: 'Celui-là, je le garde pour ceux qui aident Ciel Pur. Reviens avec des roubles.',
      choices: [{ text: 'Merci.', next: 'accueil' }],
    },
  },
});
