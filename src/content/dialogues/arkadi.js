// Dialogue de base d'Arkadi, technicien de Ciel Pur (brief v2 §3.4, §6.1).
// Donne la quête « Les mesures d’Arkadi » (src/content/quetes/mesures-arkadi.js).
import { deepFreeze } from '../freeze.js';

export default deepFreeze({
  start: 'accueil',
  nodes: {
    accueil: {
      text: 'Arkadi soude un canon sous une lampe frontale.',
      choices: [
        { text: 'Tu répares les armes ?', next: 'presentation', conditions: [{ type: 'premiere-visite' }] },
        { text: 'Tu as besoin de pièces ?', next: 'travail' },
        {
          text: 'Ciel Pur étudie les Émissions ?',
          next: 'emission',
          conditions: [{ type: 'non', condition: { type: 'quete', quest: 'mesures-arkadi' } }],
          effects: [{ type: 'quete', quest: 'mesures-arkadi' }],
        },
        {
          text: 'Voici tes mesures du Cimetière.',
          next: 'mesures',
          conditions: [{ type: 'quete', quest: 'mesures-arkadi', step: 'retour', status: 'active' }],
        },
        { text: 'Au revoir.', next: null },
      ],
    },
    presentation: {
      text: 'Armes, armures. Tout ce qui rouille. Et ici, tout rouille.',
      choices: [{ text: 'Bon à savoir.', next: 'accueil' }],
    },
    travail: {
      text: 'Toujours. Mais rien de précis pour l’instant.',
      choices: [{ text: 'D’accord.', next: 'accueil' }],
    },
    emission: {
      text: 'Après chaque Émission, le Cimetière de véhicules de la Décharge chauffe. Passe-la, puis va relever les compteurs là-bas.',
      choices: [{ text: 'J’y vais.', next: null }],
    },
    mesures: {
      text: 'Plus haut que la dernière fois. La Zone respire plus fort.',
      choices: [{ text: 'Rassurant.', next: 'accueil' }],
    },
  },
});
