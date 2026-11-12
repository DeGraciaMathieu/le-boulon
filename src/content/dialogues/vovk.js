// Dialogue de Vovk, chef des bandits de l'Usine de la Vallée Sombre (brief v2 §8.3 acte 3).
// L'accord : la clé du Complexe contre des roubles, la quête « Le Guide » passe à a3-labo.
// Prix : hypothèse v2.
import { deepFreeze } from '../freeze.js';

export default deepFreeze({
  start: 'accueil',
  nodes: {
    accueil: {
      text: 'Vovk compte des billets sur un bidon retourné. Deux gars armés derrière lui.',
      choices: [
        {
          text: 'Je cherche une clé. Celle du Complexe.',
          next: 'cle',
          conditions: [{ type: 'quete', quest: 'le-guide', step: 'a3-usine', status: 'active' }],
        },
        { text: 'Rien. Je passe.', next: null },
      ],
    },
    cle: {
      text: 'Tout le monde veut descendre là-dessous. Personne ne remonte. 1500 roubles, et je ne t’ai jamais vu.',
      choices: [
        {
          text: 'Marché conclu.',
          next: null,
          conditions: [{ type: 'roubles', min: 1500 }],
          effects: [
            { type: 'roubles', amount: -1500 },
            { type: 'donner', item: 'cle' },
            { type: 'avancer', quest: 'le-guide', step: 'a3-labo' },
          ],
        },
        { text: 'Trop cher.', next: null },
      ],
    },
  },
});
