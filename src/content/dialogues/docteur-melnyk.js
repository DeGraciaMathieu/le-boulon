// Dialogue de base de la docteure Melnyk, médecin de Ciel Pur (brief v2 §6.1).
// Donne la quête « Le suceur de la Station » (src/content/quetes/suceur-pompage.js).
import { deepFreeze } from '../freeze.js';

export default deepFreeze({
  start: 'accueil',
  nodes: {
    accueil: {
      text: 'Une tente blanche. La docteure Melnyk compte des ampoules.',
      choices: [
        { text: 'Bonjour, docteure.', next: 'presentation', conditions: [{ type: 'premiere-visite' }] },
        { text: 'Un conseil contre les radiations ?', next: 'conseil' },
        {
          text: 'Vous avez l’air inquiète.',
          next: 'suceur',
          conditions: [{ type: 'non', condition: { type: 'quete', quest: 'suceur-pompage' } }],
          effects: [{ type: 'quete', quest: 'suceur-pompage' }],
        },
        {
          text: 'Le suceur est mort.',
          next: 'suceur-mort',
          conditions: [{ type: 'quete', quest: 'suceur-pompage', step: 'rapport' }],
        },
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
    suceur: {
      text: 'Trois blessés en une semaine, vidés de leur sang. Ça vient de la Station de pompage. Tue-le.',
      choices: [{ text: 'J’y vais.', next: null }],
    },
    'suceur-mort': {
      text: 'Enfin. Prends ça. Tu en auras besoin un jour.',
      choices: [{ text: 'Merci.', next: 'accueil' }],
    },
  },
});
