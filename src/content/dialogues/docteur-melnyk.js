// Dialogue de base de la docteure Melnyk, médecin de Ciel Pur (brief v2 §6.1).
import { deepFreeze } from '../freeze.js';

export default deepFreeze({
  start: 'accueil',
  nodes: {
    accueil: {
      text: 'Une tente blanche. La docteure Melnyk compte des ampoules.',
      choices: [
        { text: 'Bonjour, docteure.', next: 'presentation', conditions: [{ type: 'premiere-visite' }] },
        { text: 'Un conseil contre les radiations ?', next: 'conseil' },
        { text: 'Au revoir.', next: null },
      ],
    },
    presentation: {
      text: 'Je soigne tout le monde. Les blessés d’abord, les bavards après.',
      choices: [{ text: 'Compris.', next: 'accueil' }],
    },
    conseil: {
      text: 'Antirad. La vodka aide moins qu’on le dit.',
      choices: [{ text: 'Merci.', next: 'accueil' }],
    },
  },
});
