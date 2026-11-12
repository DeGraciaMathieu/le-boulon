// Dialogue de base de Stas, armurier du Bar (brief v2 §6.2 : le Bar vend des armes).
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
  },
});
