// Dialogue de base du capitaine Hordiy, Devoir (brief v2 §9 : adhésion, carte 15). Quête « Le
// Guide », acte 4, voie du Devoir : nœuds guide (la preuve) et serment (l'adhésion).
import { deepFreeze } from '../freeze.js';

export default deepFreeze({
  start: 'accueil',
  nodes: {
    accueil: {
      text: 'Le capitaine Hordiy, uniforme rouge et noir, bras croisés.',
      choices: [
        { text: 'Qu’est-ce que le Devoir ?', next: 'presentation', conditions: [{ type: 'premiere-visite' }] },
        { text: 'Le Devoir a du travail ?', next: 'travail' },
        { text: 'Fedir m’envoie. Pour le Guide.', next: 'guide', conditions: [{ type: 'quete', quest: 'le-guide', step: 'a4-devoir', status: 'active' }] },
        { text: 'Le contrôleur est mort.', next: 'serment', conditions: [{ type: 'quete', quest: 'le-guide', step: 'a4-devoir-serment', status: 'active' }] },
        {
          text: 'Je veux parler.',
          next: 'hostile',
          conditions: [{ type: 'reputation', faction: 'devoir', max: -2 }],
        },
        { text: 'Au revoir.', next: null },
      ],
    },
    presentation: {
      text: 'Nous protégeons le monde de la Zone. Pas l’inverse.',
      choices: [{ text: 'Je vois.', next: 'accueil' }],
    },
    travail: {
      text: 'Prouve d’abord ta valeur. Le tableau des contrats est un début.',
      choices: [{ text: 'D’accord.', next: 'accueil' }],
    },
    guide: {
      text: 'Le Devoir paiera le déchiffrage. D’abord, un service. Un contrôleur niche dans l’Usine Rostok. Il a pris deux des nôtres. Tue-le.',
      choices: [{ text: 'J’y vais.', next: null }],
    },
    serment: {
      text: 'Bon travail. Les bandes sont lues. Le Guide est parti vers le nord, par les Entrepôts. Liberté tient la route. Elle ne la tiendra plus longtemps. Tu es des nôtres ?',
      choices: [
        { text: 'Je rejoins le Devoir.', next: null, effects: [{ type: 'rejoindre-faction', faction: 'devoir' }] },
        { text: 'Plus tard.', next: null },
      ],
    },
    hostile: {
      text: 'Tu n’as rien à me dire. Sors.',
      choices: [{ text: 'Partir.', next: null }],
    },
  },
});
