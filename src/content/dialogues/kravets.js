// Dialogue de base du lieutenant Kravets, Institut Agroprom (brief v2 §3.4, §9).
import { deepFreeze } from '../freeze.js';

export default deepFreeze({
  start: 'accueil',
  nodes: {
    accueil: {
      text: 'Un officier derrière des sacs de sable. « Halte. Zone militaire. »',
      choices: [
        {
          text: 'Je veux parler.',
          next: 'echange',
          conditions: [{ type: 'reputation', faction: 'militaires', min: -1 }],
        },
        {
          text: 'Je veux parler.',
          next: 'dehors',
          conditions: [{ type: 'reputation', faction: 'militaires', max: -2 }],
        },
        { text: 'Je m’en vais.', next: null },
      ],
    },
    echange: {
      text: 'Les stalkers volent nos documents. Rapporte-les et on oubliera ta présence.',
      choices: [{ text: 'J’y penserai.', next: null }],
    },
    dehors: {
      text: 'Dix secondes pour disparaître.',
      choices: [{ text: 'Reculer.', next: null }],
    },
  },
});
