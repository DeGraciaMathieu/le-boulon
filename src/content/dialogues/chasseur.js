// Dialogue de base du Chasseur, itinérant de la Vallée Sombre (brief v2 §7).
// Donne la quête « Le snork de la Vallée » (src/content/quetes/snork-vallee.js).
import { deepFreeze } from '../freeze.js';

export default deepFreeze({
  start: 'accueil',
  nodes: {
    accueil: {
      text: 'Un homme accroupi près d’une carcasse. Couteau à la main.',
      choices: [
        { text: 'Belle prise.', next: 'presentation', conditions: [{ type: 'premiere-visite' }] },
        { text: 'Tu achètes des trophées ?', next: 'trophees' },
        {
          text: 'Tu chasses quoi, en ce moment ?',
          next: 'traque',
          conditions: [{ type: 'non', condition: { type: 'quete', quest: 'snork-vallee' } }],
          effects: [{ type: 'quete', quest: 'snork-vallee' }],
        },
        {
          text: 'Ton snork est mort.',
          next: 'snork',
          conditions: [{ type: 'quete', quest: 'snork-vallee', step: 'rapport', status: 'active' }],
        },
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
    traque: {
      text: 'Un snork. Il a pris mon chien. Je l’ai raté deux fois. À toi de voir.',
      choices: [{ text: 'J’y vais.', next: null }],
    },
    snork: {
      text: 'Bon tir. Tiens, des cartouches. Je n’en aurai plus besoin cette saison.',
      choices: [{ text: 'Merci.', next: 'accueil' }],
    },
  },
});
