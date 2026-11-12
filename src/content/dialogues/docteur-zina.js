// Dialogue de base de la docteure Zina, médecin du Bar (brief v2 §6.1).
// Donne la quête « Des queues de chien » (src/content/quetes/queues-chien.js).
import { deepFreeze } from '../freeze.js';

export default deepFreeze({
  start: 'accueil',
  nodes: {
    accueil: {
      text: 'Une arrière-salle. Zina recoud un bras sans lever la tête.',
      choices: [
        { text: 'Vous soignez ici ?', next: 'presentation', conditions: [{ type: 'premiere-visite' }] },
        {
          text: 'Vous cherchez quelque chose ?',
          next: 'queues',
          conditions: [{ type: 'non', condition: { type: 'quete', quest: 'queues-chien' } }],
          effects: [{ type: 'quete', quest: 'queues-chien' }],
        },
        {
          text: 'Voici une queue de chien.',
          next: 'remise',
          conditions: [{ type: 'quete', quest: 'queues-chien', step: 'remise' }],
        },
        { text: 'Au revoir.', next: null },
      ],
    },
    presentation: {
      text: 'Contre roubles. Le Devoir paie pour les siens, pas pour toi.',
      choices: [{ text: 'Compris.', next: 'accueil' }],
    },
    queues: {
      text: 'Les chiens aveugles d’Agroprom guérissent plus vite que nous. Rapporte-moi une queue. Fraîche si possible.',
      choices: [{ text: 'J’y vais.', next: null }],
    },
    remise: {
      text: 'Bien. Un antirad pour ta peine. Lave-toi les mains.',
      choices: [{ text: 'Merci.', next: 'accueil' }],
    },
  },
});
