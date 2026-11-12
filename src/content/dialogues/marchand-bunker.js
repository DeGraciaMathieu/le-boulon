// Dialogue du Marchand du bunker (brief v2 §7, §8.3 acte 1) : donne la quête « Le Guide »
// (nœud travail, vers courrier) et ouvre le PDA du courrier (nœud pda-ouvert). La boutique : carte 13.
import { deepFreeze } from '../freeze.js';

export default deepFreeze({
  start: 'accueil',
  nodes: {
    accueil: {
      text: 'Bunker. Odeur de graisse et de tabac. Le Marchand ne lève pas les yeux de son registre.',
      choices: [
        { text: 'Je suis nouveau.', next: 'presentation', conditions: [{ type: 'premiere-visite' }] },
        { text: 'Tu as du travail ?', next: 'travail' },
        {
          text: 'Des nouvelles de la Zone ?',
          next: 'confiance',
          conditions: [{ type: 'reputation', faction: 'solitaires', min: 2 }],
        },
        { text: 'Au revoir.', next: null },
      ],
    },
    presentation: {
      text: 'Un bleu de plus. Ici, tout se paie. Tu ramènes des artefacts, je paie bien. Tu me fais perdre mon temps, je l’oublie pas.',
      choices: [{ text: 'Compris.', next: 'accueil' }],
    },
    travail: {
      text: 'Du travail, il y en a toujours. Encore faut-il revenir vivant.',
      choices: [
        {
          text: 'Je prends.',
          next: 'courrier',
          conditions: [{ type: 'non', condition: { type: 'quete', quest: 'le-guide' } }],
          effects: [{ type: 'quete', quest: 'le-guide' }],
        },
        {
          text: 'Le PDA est ouvert. Le mot de passe : « Kolos ».',
          next: 'pda-ouvert',
          conditions: [{ type: 'quete', quest: 'le-guide', step: 'a1-retour', status: 'active' }, { type: 'objet', item: 'pda' }],
          effects: [{ type: 'prendre', item: 'pda' }],
        },
        { text: 'D’accord.', next: 'accueil' },
      ],
    },
    courrier: {
      text: 'Un courrier devait passer hier. Il n’est jamais arrivé. Dernier signal près de l’ATP. Ramène son PDA. Ce qu’il porte m’appartient.',
      choices: [{ text: 'J’y vais.', next: null }],
    },
    'pda-ouvert': {
      text: 'Il lit longtemps. « Le Guide. Un stalker qui connaît un chemin vers le centre. Ses papiers sont restés dans les souterrains d’Agroprom. » Il rend l’écran. « Les bandits tiennent le barrage de la Décharge. Paie, cogne ou contourne. »',
      choices: [{ text: 'Je descends à Agroprom.', next: null }],
    },
    confiance: {
      text: 'Les militaires ont doublé la garde à l’Avant-poste. Passe par la Ferme.',
      choices: [{ text: 'Merci.', next: 'accueil' }],
    },
  },
});
