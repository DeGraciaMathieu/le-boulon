// Dialogue de base de Bohdan, sentinelle du Camp des novices (brief v2 §7).
import { deepFreeze } from '../freeze.js';

export default deepFreeze({
  start: 'accueil',
  nodes: {
    accueil: {
      text: 'Bohdan garde l’entrée du camp, fusil sur les genoux.',
      choices: [
        { text: 'Tout est calme ?', next: 'calme' },
        {
          text: 'Je peux entrer ?',
          next: 'refus',
          conditions: [{ type: 'reputation', faction: 'solitaires', max: -2 }],
        },
        { text: 'Au revoir.', next: null },
      ],
    },
    calme: {
      text: 'Des chiens rôdent vers l’ATP. Ferme bien ta veste.',
      choices: [{ text: 'D’accord.', next: 'accueil' }],
    },
    refus: {
      text: 'Pas toi. Les gars se souviennent.',
      choices: [{ text: 'Je pars.', next: null }],
    },
  },
});
