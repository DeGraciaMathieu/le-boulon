// Dialogue de base de Bohdan, sentinelle du Camp des novices (brief v2 §7). Donne la quête
// « La dette de Bohdan » (src/content/quetes/dette-bohdan.js) ; son embranchement au nœud dette.
import { deepFreeze } from '../freeze.js';

export default deepFreeze({
  start: 'accueil',
  nodes: {
    accueil: {
      text: 'Bohdan garde l’entrée du camp, fusil sur les genoux.',
      choices: [
        { text: 'Tout est calme ?', next: 'calme' },
        {
          text: 'Tu as l’air soucieux.',
          next: 'dette',
          conditions: [{ type: 'non', condition: { type: 'quete', quest: 'dette-bohdan' } }],
          effects: [{ type: 'quete', quest: 'dette-bohdan' }],
        },
        {
          text: 'À propos de ta dette.',
          next: 'dette',
          conditions: [{ type: 'quete', quest: 'dette-bohdan', step: 'debut', status: 'active' }],
        },
        {
          text: 'Ton créancier est payé.',
          next: 'merci',
          conditions: [{ type: 'quete', quest: 'dette-bohdan', step: 'retour', status: 'active' }],
        },
        {
          text: 'Je peux entrer ?',
          next: 'refus',
          conditions: [{ type: 'reputation', faction: 'solitaires', max: -2 }],
        },
        { text: 'Au revoir.', next: null },
      ],
    },
    calme: {
      text: 'Des chiens rôdent vers l’ATP. Ferme bien ta veste.',
      choices: [{ text: 'D’accord.', next: 'accueil' }],
    },
    dette: {
      text: 'Je dois de l’argent à un type qui attend à la Ferme. Il viendra me chercher ici.',
      choices: [
        { text: 'Je règle ça à la Ferme.', effects: [{ type: 'avancer', quest: 'dette-bohdan', step: 'payer' }] },
        {
          text: 'Je te cache à l’Élévateur.',
          effects: [{ type: 'avancer', quest: 'dette-bohdan', step: 'cacher' }],
        },
        { text: 'J’y réfléchis.', next: null },
      ],
    },
    merci: {
      text: 'Une dette de moins. Je te revaudrai ça.',
      choices: [{ text: 'Au revoir.', next: null }],
    },
    refus: {
      text: 'Pas toi. Les gars se souviennent.',
      choices: [{ text: 'Je pars.', next: null }],
    },
  },
});
