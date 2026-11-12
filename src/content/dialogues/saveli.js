// Dialogue de base de Saveli, vétéran du Camp des novices (brief v2 §7). Donne la quête « Le
// relevé de Saveli » (src/content/quetes/releve-saveli.js).
import { deepFreeze } from '../freeze.js';

export default deepFreeze({
  start: 'accueil',
  nodes: {
    accueil: {
      text: 'Saveli fume près du feu. Il te regarde de haut en bas.',
      choices: [
        { text: 'Un conseil pour un nouveau ?', next: 'conseil', conditions: [{ type: 'premiere-visite' }] },
        { text: 'Tu connais le Guide ?', next: 'guide' },
        {
          text: 'Du travail pour un nouveau ?',
          next: 'commande',
          conditions: [{ type: 'non', condition: { type: 'quete', quest: 'releve-saveli' } }],
          effects: [{ type: 'quete', quest: 'releve-saveli' }],
        },
        {
          text: 'Voici ton relevé.',
          next: 'releve',
          conditions: [{ type: 'quete', quest: 'releve-saveli', step: 'remise' }],
        },
        {
          text: 'On parle franchement ?',
          next: 'confiance',
          conditions: [{ type: 'reputation', faction: 'solitaires', min: 2 }],
        },
        { text: 'Au revoir.', next: null },
      ],
    },
    conseil: {
      text: 'Lance des boulons. Écoute ton détecteur. Rentre avant la nuit.',
      choices: [{ text: 'Noté.', next: 'accueil' }],
    },
    commande: {
      text: 'Lance tes boulons sur tout le Cordon. Chaque anomalie, chaque coin sûr. Puis reviens.',
      choices: [{ text: 'Compris.', next: 'accueil' }],
    },
    releve: {
      text: 'Propre. Tu as l’œil. Garde-le ouvert.',
      choices: [{ text: 'Merci.', next: 'accueil' }],
    },
    guide: {
      text: 'Un nom qu’on murmure. Pas plus.',
      choices: [{ text: 'Je vois.', next: 'accueil' }],
    },
    confiance: {
      text: 'La Fosse aux déchets crache des artefacts après chaque Émission. Mais elle tue aussi.',
      choices: [{ text: 'Merci.', next: 'accueil' }],
    },
  },
});
