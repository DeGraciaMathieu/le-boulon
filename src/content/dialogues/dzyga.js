// Dialogue de base de Dzyga, technicien de Liberté (brief v2 §6.1).
// Donne la quête « Le champ qui bouge » (src/content/quetes/champ-anomalies.js).
import { deepFreeze } from '../freeze.js';

export default deepFreeze({
  start: 'accueil',
  nodes: {
    accueil: {
      text: 'Dzyga démonte une radio. Des vis partout.',
      choices: [
        { text: 'Tu répares ?', next: 'presentation', conditions: [{ type: 'premiere-visite' }] },
        {
          text: 'Besoin d’aide ?',
          next: 'champ',
          conditions: [{ type: 'non', condition: { type: 'quete', quest: 'champ-anomalies' } }],
          effects: [{ type: 'quete', quest: 'champ-anomalies' }],
        },
        {
          text: 'Voici le relevé des Entrepôts.',
          next: 'releve',
          conditions: [{ type: 'quete', quest: 'champ-anomalies', step: 'remise', status: 'active' }],
        },
        { text: 'Au revoir.', next: null },
      ],
    },
    presentation: {
      text: 'Armes, armures, radios. Apporte des pièces, je fais des miracles.',
      choices: [{ text: 'Bon à savoir.', next: 'accueil' }],
    },
    champ: {
      text: 'Le Champ d’anomalies a bougé. Mes cartes ne valent plus rien. Lance tes boulons partout et reviens.',
      choices: [{ text: 'J’y vais.', next: null }],
    },
    releve: {
      text: 'Parfait. Je redessine tout ce soir. Garde ces boulons.',
      choices: [{ text: 'Merci.', next: 'accueil' }],
    },
  },
});
