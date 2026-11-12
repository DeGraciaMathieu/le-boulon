// Dialogue de base de Fedir, barman du Bar « 100 Rads » (brief v2 §6.1 : rumeurs, quêtes).
// Le nœud rumeur accueillera les rumeurs payantes (carte 23).
import { deepFreeze } from '../freeze.js';

export default deepFreeze({
  start: 'accueil',
  nodes: {
    accueil: {
      text: 'Fedir essuie un verre qui ne sera jamais propre.',
      choices: [
        { text: 'Premier passage ici.', next: 'presentation', conditions: [{ type: 'premiere-visite' }] },
        { text: 'Une rumeur ?', next: 'rumeur' },
        { text: 'Du travail ?', next: 'travail' },
        { text: 'Au revoir.', next: null },
      ],
    },
    presentation: {
      text: 'Bienvenue au 100 Rads. Pas d’arme sortie, pas de bagarre. Le Devoir veille.',
      choices: [{ text: 'Entendu.', next: 'accueil' }],
    },
    rumeur: {
      text: 'Rien de neuf aujourd’hui. Reviens après la prochaine Émission.',
      choices: [{ text: 'D’accord.', next: 'accueil' }],
    },
    travail: {
      text: 'Le tableau, là-bas. Pour le reste, on verra quand je te connaîtrai.',
      choices: [{ text: 'Compris.', next: 'accueil' }],
    },
  },
});
