// Dialogue de base de Pavlo, éclaireur de Ciel Pur (brief v2 §7).
// Donne la quête « L’icône de l’Église » (src/content/quetes/icone-eglise.js).
import { deepFreeze } from '../freeze.js';

export default deepFreeze({
  start: 'accueil',
  nodes: {
    accueil: {
      text: 'Pavlo vide l’eau de ses bottes.',
      choices: [
        { text: 'Tu reviens d’où ?', next: 'marais' },
        {
          text: 'Ciel Pur a besoin d’un éclaireur ?',
          next: 'eglise',
          conditions: [{ type: 'non', condition: { type: 'quete', quest: 'icone-eglise' } }],
          effects: [{ type: 'quete', quest: 'icone-eglise' }],
        },
        {
          text: 'J’ai vu la carte de l’icône.',
          next: 'icone',
          conditions: [{ type: 'quete', quest: 'icone-eglise', step: 'retour' }],
        },
        { text: 'Au revoir.', next: null },
      ],
    },
    marais: {
      text: 'Du Hameau des pêcheurs. Trois anomalies nouvelles sur la route. Évite l’eau profonde.',
      choices: [{ text: 'Merci.', next: 'accueil' }],
    },
    eglise: {
      text: 'Un de nos gars a caché une carte du Marais à l’Église, derrière l’icône. Il n’est pas revenu. Va voir.',
      choices: [{ text: 'J’y vais.', next: null }],
    },
    icone: {
      text: 'Ses passages dans les roseaux. Des semaines de travail. Merci.',
      choices: [{ text: 'De rien.', next: 'accueil' }],
    },
  },
});
