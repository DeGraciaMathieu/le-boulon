// Dialogue de base de Rouslan, sentinelle de Liberté (brief v2 §7).
// Donne la quête « La chimère du lac » (src/content/quetes/chimere-lac.js).
import { deepFreeze } from '../freeze.js';

export default deepFreeze({
  start: 'accueil',
  nodes: {
    accueil: {
      text: 'Rouslan monte la garde, un brin d’herbe entre les dents.',
      choices: [
        { text: 'Du nouveau aux Entrepôts ?', next: 'nouvelles' },
        {
          text: 'Quelque chose rôde ?',
          next: 'cabane',
          conditions: [{ type: 'non', condition: { type: 'quete', quest: 'chimere-lac' } }],
          effects: [{ type: 'quete', quest: 'chimere-lac' }],
        },
        {
          text: 'La chimère est morte.',
          next: 'chimere',
          conditions: [{ type: 'quete', quest: 'chimere-lac', step: 'rapport', status: 'active' }],
        },
        { text: 'Au revoir.', next: null },
      ],
    },
    nouvelles: {
      text: 'Le Champ d’anomalies a bougé cette nuit. Personne n’y va.',
      choices: [{ text: 'Merci.', next: 'accueil' }],
    },
    cabane: {
      text: 'Une bête tue nos gars au nord du lac. Le forestier la suivait. Lis son journal, à la cabane, puis trouve-la.',
      choices: [{ text: 'J’y vais.', next: null }],
    },
    chimere: {
      text: 'Une chimère. Et tu es debout. Les gars vont boire à ta santé.',
      choices: [{ text: 'Au revoir.', next: 'accueil' }],
    },
  },
});
