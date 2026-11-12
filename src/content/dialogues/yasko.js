// Dialogue de base de Yasko, chef de Liberté (brief v2 §9 : adhésion, carte 15). Quête « Le
// Guide », acte 4, voie de Liberté : nœuds guide (la preuve) et serment (l'adhésion).
import { deepFreeze } from '../freeze.js';

export default deepFreeze({
  start: 'accueil',
  nodes: {
    accueil: {
      text: 'Yasko, pieds sur la table, joue avec un briquet.',
      choices: [
        { text: 'Qu’est-ce que Liberté ?', next: 'presentation', conditions: [{ type: 'premiere-visite' }] },
        { text: 'Liberté a du travail ?', next: 'travail' },
        { text: 'Fedir m’envoie. Pour le Guide.', next: 'guide', conditions: [{ type: 'quete', quest: 'le-guide', step: 'a4-liberte' }] },
        { text: 'Les ordres du Devoir.', next: 'serment', conditions: [{ type: 'quete', quest: 'le-guide', step: 'a4-liberte-serment' }] },
        {
          text: 'Je veux parler.',
          next: 'hostile',
          conditions: [{ type: 'reputation', faction: 'liberte', max: -2 }],
        },
        { text: 'Au revoir.', next: null },
      ],
    },
    presentation: {
      text: 'La Zone appartient à tout le monde. Le Devoir ne l’a pas compris.',
      choices: [{ text: 'Je vois.', next: 'accueil' }],
    },
    travail: {
      text: 'Peut-être. Montre-nous d’abord de quel côté tu es.',
      choices: [{ text: 'D’accord.', next: 'accueil' }],
    },
    guide: {
      text: 'On a un gars qui lit ce genre de bandes. Mais le Devoir prépare un coup. Leurs ordres sont à la Barrière, à Rostok. Rapporte-les et on parle.',
      choices: [{ text: 'J’y vais.', next: null }],
    },
    serment: {
      text: 'Ils viennent ici, donc. Merci. Les bandes sont lues : le Guide est passé chez nous, puis vers le nord. Aide-nous à tenir la base et la route est à toi. Tu restes ?',
      choices: [
        { text: 'Je rejoins Liberté.', next: null, effects: [{ type: 'rejoindre-faction', faction: 'liberte' }] },
        { text: 'Plus tard.', next: null },
      ],
    },
    hostile: {
      text: 'Toi ici ? Rouslan, raccompagne-le.',
      choices: [{ text: 'Partir.', next: null }],
    },
  },
});
