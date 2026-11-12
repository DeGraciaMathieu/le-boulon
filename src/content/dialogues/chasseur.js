// Dialogue de base du Chasseur, itinérant de la Vallée Sombre (brief v2 §7).
import { deepFreeze } from '../freeze.js';

export default deepFreeze({
  start: 'accueil',
  nodes: {
    accueil: {
      text: 'Un homme accroupi près d’une carcasse. Couteau à la main.',
      choices: [
        { text: 'Belle prise.', next: 'presentation', conditions: [{ type: 'premiere-visite' }] },
        { text: 'Tu achètes des trophées ?', next: 'trophees' },
        { text: 'Au revoir.', next: null },
      ],
    },
    presentation: {
      text: 'Pseudo-chien. La Vallée en est pleine. Les bandits aussi.',
      choices: [{ text: 'Je ferai attention.', next: 'accueil' }],
    },
    trophees: {
      text: 'Pas aujourd’hui. Les marchands du Bar paient mieux.',
      choices: [{ text: 'D’accord.', next: 'accueil' }],
    },
  },
});
