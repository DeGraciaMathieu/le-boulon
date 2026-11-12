// Dialogue de base de Fedir, barman du Bar « 100 Rads » (brief v2 §6.1 : rumeurs, quêtes).
// Le nœud rumeur accueillera les rumeurs payantes (carte 23). Nœud donnees : quête « Le
// Guide », acte 4, embranchement Devoir ou Liberté.
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
        {
          text: 'Des bandes du laboratoire, et des documents.',
          next: 'donnees',
          conditions: [{ type: 'quete', quest: 'le-guide', step: 'a4-bar', status: 'active' }, { type: 'objet', item: 'donnees' }, { type: 'objet', item: 'documents' }],
          effects: [{ type: 'prendre', item: 'donnees' }, { type: 'prendre', item: 'documents' }],
        },
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
    donnees: {
      text: 'Fedir range les bandes sous le comptoir. « Je connais quelqu’un qui sait les lire. Mais ici, rien n’est gratuit. Le Devoir ou Liberté paiera le déchiffrage. Choisis ton camp. »',
      choices: [
        { text: 'Le Devoir.', effects: [{ type: 'avancer', quest: 'le-guide', step: 'a4-devoir' }] },
        { text: 'Liberté.', effects: [{ type: 'avancer', quest: 'le-guide', step: 'a4-liberte' }] },
      ],
    },
    travail: {
      text: 'Le tableau, là-bas. Pour le reste, on verra quand je te connaîtrai.',
      choices: [{ text: 'Compris.', next: 'accueil' }],
    },
  },
});
