// Dialogue de base du sergent Ostap, garde du Devoir au Bar (brief v2 §7).
// Donne la quête « La patrouille perdue » (src/content/quetes/patrouille-perdue.js) ; reçoit
// la caisse de Matviï (src/content/quetes/caisse-matvii.js, branche devoir).
import { deepFreeze } from '../freeze.js';

export default deepFreeze({
  start: 'accueil',
  nodes: {
    accueil: {
      text: 'Ostap garde la porte. Il fixe ton arme.',
      choices: [
        { text: 'Des règles ici ?', next: 'regles' },
        {
          text: 'Mauvaise nouvelle ?',
          next: 'mercenaires',
          conditions: [{ type: 'non', condition: { type: 'quete', quest: 'patrouille-perdue' } }],
          effects: [{ type: 'quete', quest: 'patrouille-perdue' }],
        },
        {
          text: 'Les mercenaires ont payé.',
          next: 'patrouille',
          conditions: [{ type: 'quete', quest: 'patrouille-perdue', step: 'rapport', status: 'active' }],
        },
        {
          text: 'Une caisse de Liberté, ça t’intéresse ?',
          next: 'caisse',
          conditions: [{ type: 'quete', quest: 'caisse-matvii', step: 'devoir', status: 'active' }],
        },
        { text: 'Au revoir.', next: null },
      ],
    },
    regles: {
      text: 'Arme rangée. Pas de bagarre. Pas de Liberté.',
      choices: [{ text: 'Compris.', next: 'accueil' }],
    },
    mercenaires: {
      text: 'Une patrouille à Agroprom. Quatre hommes. Des mercenaires les ont abattus. Venge-les.',
      choices: [{ text: 'J’y vais.', next: null }],
    },
    patrouille: {
      text: 'Le Devoir n’oublie pas. Toi non plus, maintenant.',
      choices: [{ text: 'Au revoir.', next: 'accueil' }],
    },
    caisse: {
      text: 'Des munitions pour Liberté ? Elles serviront mieux ici. On te paie.',
      effects: [
        { type: 'reputation', faction: 'devoir', amount: 1 },
        { type: 'reputation', faction: 'liberte', amount: -2 },
      ],
      choices: [{ text: 'Marché conclu.', next: 'accueil' }],
    },
  },
});
