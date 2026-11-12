// Dialogue de base de Lesko, barman de Liberté (brief v2 §6.1 : rumeurs, quêtes).
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
  },
});
