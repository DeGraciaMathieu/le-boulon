// Dialogue de base du commandant Yarema, chef de Ciel Pur (brief v2 §7, §9). Donne l'arc
// facultatif « Le souvenir du Guide » (src/content/quetes/souvenir-du-guide.js).
import { deepFreeze } from '../freeze.js';

export default deepFreeze({
  start: 'accueil',
  nodes: {
    accueil: {
      text: 'Yarema étudie une carte couverte de flèches au crayon.',
      choices: [
        { text: 'Qui commande ici ?', next: 'presentation', conditions: [{ type: 'premiere-visite' }] },
        { text: 'Ciel Pur a du travail ?', next: 'travail' },
        {
          text: 'Tu as connu le Guide ?',
          next: 'guide',
          conditions: [
            { type: 'quete', quest: 'le-guide' },
            { type: 'non', condition: { type: 'quete', quest: 'souvenir-du-guide' } },
          ],
          effects: [{ type: 'quete', quest: 'souvenir-du-guide' }],
        },
        {
          text: 'J’ai trouvé ses notes.',
          next: 'notes-guide',
          conditions: [{ type: 'quete', quest: 'souvenir-du-guide', step: 'retour', status: 'active' }],
        },
        {
          text: 'Que cherche Ciel Pur ?',
          next: 'confiance',
          conditions: [{ type: 'reputation', faction: 'ciel-pur', min: 2 }],
        },
        { text: 'Au revoir.', next: null },
      ],
    },
    presentation: {
      text: 'Moi. Nous étudions la Zone. Les Émissions surtout.',
      choices: [{ text: 'Je vois.', next: 'accueil' }],
    },
    travail: {
      text: 'Voir le tableau des contrats. Pour le reste, il faut d’abord gagner notre confiance.',
      choices: [{ text: 'D’accord.', next: 'accueil' }],
    },
    guide: {
      text: 'Il a dormi ici, un hiver. Il parlait peu. Il priait à l’Église, au milieu des anomalies. S’il a laissé quelque chose, c’est là-bas.',
      choices: [{ text: 'J’irai voir.', next: null }],
    },
    'notes-guide': {
      text: 'Yarema relit la phrase deux fois. « Les Émissions suivent le vent. » Il avait compris avant nous. Garde ça en tête, au nord.',
      choices: [{ text: 'Je n’oublierai pas.', next: 'accueil' }],
    },
    confiance: {
      text: 'Les Émissions viennent du centre. Quelqu’un les provoque. Ne le répète pas.',
      choices: [{ text: 'Promis.', next: 'accueil' }],
    },
  },
});
