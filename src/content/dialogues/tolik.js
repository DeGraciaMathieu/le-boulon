// Dialogue de base de Tolik le Bleu, novice du Camp (brief v2 §7). Donne la quête « Les chiens
// du Cordon » (src/content/quetes/chiens-cordon.js).
import { deepFreeze } from '../freeze.js';

export default deepFreeze({
  start: 'accueil',
  nodes: {
    accueil: {
      text: 'Tolik nettoie un pistolet trop grand pour lui.',
      choices: [
        { text: 'Toi aussi, tu viens d’arriver ?', next: 'presentation', conditions: [{ type: 'premiere-visite' }] },
        { text: 'Tu as besoin d’aide ?', next: 'travail' },
        {
          text: 'Je m’occupe de tes chiens.',
          next: 'chiens',
          conditions: [{ type: 'non', condition: { type: 'quete', quest: 'chiens-cordon' } }],
          effects: [{ type: 'quete', quest: 'chiens-cordon' }],
        },
        {
          text: 'Les chiens sont morts.',
          next: 'chiens-morts',
          conditions: [{ type: 'quete', quest: 'chiens-cordon', step: 'rapport' }],
        },
        { text: 'Au revoir.', next: null },
      ],
    },
    presentation: {
      text: 'Trois jours. J’ai vu un chien à deux têtes. Personne me croit.',
      choices: [{ text: 'Je te crois.', next: 'accueil' }],
    },
    chiens: {
      text: 'Une meute rôde autour du camp. Deux jours, et ils seront dans les tentes.',
      choices: [{ text: 'J’y vais.', next: null }],
    },
    'chiens-morts': {
      text: 'Vraiment ? Tiens, prends ça. Je peux dormir, enfin.',
      choices: [{ text: 'Dors.', next: null }],
    },
    travail: {
      text: 'Plus tard, peut-être. J’ai pas encore le courage de sortir.',
      choices: [{ text: 'Courage.', next: 'accueil' }],
    },
  },
});
