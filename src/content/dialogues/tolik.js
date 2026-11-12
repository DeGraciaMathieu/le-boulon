// Dialogue de base de Tolik le Bleu, novice du Camp (brief v2 §7).
import { deepFreeze } from '../freeze.js';

export default deepFreeze({
  start: 'accueil',
  nodes: {
    accueil: {
      text: 'Tolik nettoie un pistolet trop grand pour lui.',
      choices: [
        { text: 'Toi aussi, tu viens d’arriver ?', next: 'presentation', conditions: [{ type: 'premiere-visite' }] },
        { text: 'Tu as besoin d’aide ?', next: 'travail' },
        { text: 'Au revoir.', next: null },
      ],
    },
    presentation: {
      text: 'Trois jours. J’ai vu un chien à deux têtes. Personne me croit.',
      choices: [{ text: 'Je te crois.', next: 'accueil' }],
    },
    travail: {
      text: 'Plus tard, peut-être. J’ai pas encore le courage de sortir.',
      choices: [{ text: 'Courage.', next: 'accueil' }],
    },
  },
});
