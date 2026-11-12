// Dialogue de base de Saveli, vétéran du Camp des novices (brief v2 §7).
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
