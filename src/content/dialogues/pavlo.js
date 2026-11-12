// Dialogue de base de Pavlo, éclaireur de Ciel Pur (brief v2 §7).
import { deepFreeze } from '../freeze.js';

export default deepFreeze({
  start: 'accueil',
  nodes: {
    accueil: {
      text: 'Pavlo vide l’eau de ses bottes.',
      choices: [
        { text: 'Tu reviens d’où ?', next: 'marais' },
        { text: 'Au revoir.', next: null },
      ],
    },
    marais: {
      text: 'Du Hameau des pêcheurs. Trois anomalies nouvelles sur la route. Évite l’eau profonde.',
      choices: [{ text: 'Merci.', next: 'accueil' }],
    },
  },
});
