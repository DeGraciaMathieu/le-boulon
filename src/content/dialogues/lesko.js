// Dialogue de base de Lesko, barman de Liberté (brief v2 §6.1 : rumeurs, quêtes).
// Donne la quête « Les ordres du Devoir » (src/content/quetes/ordres-devoir.js).
import { deepFreeze } from '../freeze.js';

export default deepFreeze({
  start: 'accueil',
  nodes: {
    accueil: {
      text: 'Musique grésillante. Lesko sert sans demander.',
      choices: [
        { text: 'Nouveau ici.', next: 'presentation', conditions: [{ type: 'premiere-visite' }] },
        { text: 'Une rumeur ?', next: 'rumeur' },
        { text: 'Du travail ?', next: 'travail' },
        {
          text: 'Un travail discret ?',
          next: 'barriere',
          conditions: [{ type: 'non', condition: { type: 'quete', quest: 'ordres-devoir' } }],
          effects: [{ type: 'quete', quest: 'ordres-devoir' }],
        },
        {
          text: 'J’ai lu les ordres de la Barrière.',
          next: 'ordres',
          conditions: [{ type: 'quete', quest: 'ordres-devoir', step: 'retour' }],
        },
        { text: 'Au revoir.', next: null },
      ],
    },
    presentation: {
      text: 'Ici, personne ne te dit quoi faire. Sauf moi, pour l’addition.',
      choices: [{ text: 'Juste.', next: 'accueil' }],
    },
    rumeur: {
      text: 'Le Devoir prépare quelque chose. Comme toujours.',
      choices: [{ text: 'Merci.', next: 'accueil' }],
    },
    travail: {
      text: 'Le tableau. Ou reviens quand Yasko te fera confiance.',
      choices: [{ text: 'D’accord.', next: 'accueil' }],
    },
    barriere: {
      text: 'Le Devoir affiche ses ordres à sa Barrière, à Rostok. Lis-les. Ne te fais pas voir.',
      choices: [{ text: 'J’y vais.', next: null }],
    },
    ordres: {
      text: 'Ils renforcent la Barrière et nous surveillent. Yasko voudra le savoir. Bon travail.',
      choices: [{ text: 'Au revoir.', next: 'accueil' }],
    },
  },
});
