// Dialogue de base du voyageur, itinérant de la Décharge (brief v2 §3.4, Arrêt de bus).
// Donne la quête « La liste de l’Arrêt » (src/content/quetes/liste-arret.js) ; son
// embranchement au nœud liste.
import { deepFreeze } from '../freeze.js';

export default deepFreeze({
  start: 'accueil',
  nodes: {
    accueil: {
      text: 'Un stalker assis sur son sac. Il compte ses cartouches.',
      choices: [
        { text: 'Tu attends quelqu’un ?', next: 'presentation', conditions: [{ type: 'premiere-visite' }] },
        { text: 'La route est sûre ?', next: 'route' },
        {
          text: 'Tu attends vraiment le bus ?',
          next: 'abri',
          conditions: [{ type: 'non', condition: { type: 'quete', quest: 'liste-arret' } }],
          effects: [{ type: 'quete', quest: 'liste-arret' }],
        },
        {
          text: 'J’ai lu la liste de l’abri.',
          next: 'liste',
          conditions: [{ type: 'quete', quest: 'liste-arret', step: 'retour' }],
        },
        { text: 'Au revoir.', next: null },
      ],
    },
    presentation: {
      text: 'Le bus. Il passe plus depuis vingt ans. J’attends quand même.',
      choices: [{ text: 'Bonne attente.', next: 'accueil' }],
    },
    route: {
      text: 'Les bandits tiennent le Barrage. Paie ou contourne par le Tunnel.',
      choices: [{ text: 'Merci.', next: 'accueil' }],
    },
    abri: {
      text: 'J’attends mon nom. Les racketteurs gravent sur l’abri ceux qui leur doivent. Va lire si j’y suis.',
      choices: [{ text: 'J’y vais.', next: null }],
    },
    liste: {
      text: 'Mon nom est en bas. Avec un jour. Celui de demain.',
      choices: [
        {
          text: 'Je m’occupe des racketteurs.',
          next: null,
          effects: [{ type: 'avancer', quest: 'liste-arret', step: 'racketteurs' }],
        },
        {
          text: 'Pars ce soir. Oublie la liste.',
          next: 'oubli',
          effects: [{ type: 'avancer', quest: 'liste-arret', step: 'oubli' }],
        },
        { text: 'J’y réfléchis.', next: null },
      ],
    },
    oubli: {
      text: 'Partir. Oui. Le bus ne viendra pas de toute façon.',
      choices: [{ text: 'Bonne route.', next: null }],
    },
  },
});
