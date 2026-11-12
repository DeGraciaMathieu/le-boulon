// Dialogue de base de Matviï, marchand de Liberté (brief v2 §6.2 : armures légères,
// consommables).
// Donne la quête « La caisse de Matviï » (src/content/quetes/caisse-matvii.js) ; son
// embranchement au nœud caisse.
import { deepFreeze } from '../freeze.js';

export default deepFreeze({
  start: 'accueil',
  nodes: {
    accueil: {
      text: 'Matviï trie des combinaisons sur une bâche, une cigarette au coin des lèvres.',
      choices: [
        { text: 'Salut.', next: 'presentation', conditions: [{ type: 'premiere-visite' }] },
        {
          text: 'Un prix d’ami ?',
          next: 'confiance',
          conditions: [{ type: 'reputation', faction: 'liberte', min: 2 }],
        },
        {
          text: 'Tu as une livraison ?',
          next: 'caisse',
          conditions: [{ type: 'non', condition: { type: 'quete', quest: 'caisse-matvii' } }],
          effects: [{ type: 'quete', quest: 'caisse-matvii' }],
        },
        {
          text: 'À propos de ta caisse.',
          next: 'caisse',
          conditions: [{ type: 'quete', quest: 'caisse-matvii', step: 'caisse', status: 'active' }],
        },
        { text: 'Au revoir.', next: null },
      ],
    },
    presentation: {
      text: 'Légères, pratiques, pas chères. La liberté a un prix, mais il est bas.',
      choices: [{ text: 'Je regarde.', next: 'accueil' }],
    },
    confiance: {
      text: 'Pour toi, je trouverai bien quelque chose.',
      choices: [{ text: 'Merci.', next: 'accueil' }],
    },
    caisse: {
      text: 'Une caisse de munitions pour nos gars du Village abandonné. Ne l’ouvre pas. Ne la vends pas au Devoir.',
      choices: [
        {
          text: 'Je la livre au Village.',
          next: null,
          effects: [{ type: 'avancer', quest: 'caisse-matvii', step: 'livrer' }],
        },
        {
          text: 'Compte sur moi.',
          next: null,
          effects: [{ type: 'avancer', quest: 'caisse-matvii', step: 'devoir' }],
        },
        { text: 'J’y réfléchis.', next: null },
      ],
    },
  },
});
