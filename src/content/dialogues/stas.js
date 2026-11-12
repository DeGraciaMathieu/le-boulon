// Dialogue de base de Stas, armurier du Bar (brief v2 §6.2 : le Bar vend des armes).
// Donne la quête « Les ateliers de Rostok » (src/content/quetes/ateliers-rostok.js).
import { deepFreeze } from '../freeze.js';

export default deepFreeze({
  start: 'accueil',
  nodes: {
    accueil: {
      text: 'Des fusils accrochés au mur. Stas lit un vieux manuel.',
      choices: [
        { text: 'Tu vends des armes ?', next: 'presentation', conditions: [{ type: 'premiere-visite' }] },
        {
          text: 'Quelque chose de spécial ?',
          next: 'confiance',
          conditions: [{ type: 'reputation', faction: 'devoir', min: 2 }],
        },
        {
          text: 'Tu cherches quelqu’un ?',
          next: 'controleur',
          conditions: [{ type: 'non', condition: { type: 'quete', quest: 'ateliers-rostok' } }],
          effects: [{ type: 'quete', quest: 'ateliers-rostok' }],
        },
        {
          text: 'Les ateliers sont libres.',
          next: 'ateliers',
          conditions: [{ type: 'quete', quest: 'ateliers-rostok', step: 'rapport' }],
        },
        { text: 'Au revoir.', next: null },
      ],
    },
    presentation: {
      text: 'À ceux qui savent s’en servir. Les bleus, je leur vends des pistolets.',
      choices: [{ text: 'Juste.', next: 'accueil' }],
    },
    confiance: {
      text: 'Un fusil de précision, peut-être. Pour un ami du Devoir.',
      choices: [{ text: 'J’y penserai.', next: 'accueil' }],
    },
    controleur: {
      text: 'Les ateliers de l’Usine Rostok. Mes pièces sont dedans. Un contrôleur aussi. Ne le regarde pas trop longtemps.',
      choices: [{ text: 'J’y vais.', next: null }],
    },
    ateliers: {
      text: 'Tu es encore toi ? Bien. Voilà des munitions. Les bonnes.',
      choices: [{ text: 'Merci.', next: 'accueil' }],
    },
  },
});
