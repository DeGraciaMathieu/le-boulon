// Arc secondaire facultatif de l'acte 2 du Guide (brief v2 §8.3) : « Ciel Pur a connu le
// Guide ». Donné par Yarema une fois la quête principale lancée ; les notes du Guide sont une
// carte réservée de l'Église. Sans délai. Position de la carte et récompenses : hypothèse v2.
import { deepFreeze } from '../freeze.js';

export default deepFreeze({
  name: 'Le souvenir du Guide',
  giver: 'yarema',
  start: 'souvenir',
  rewards: { xp: 60, reputation: { 'ciel-pur': 1 } },
  steps: {
    souvenir: { objective: { type: 'parler', npc: 'yarema', node: 'guide' }, next: ['eglise'] },
    eglise: { objective: { type: 'explorer', place: 'eglise', card: 'notes-guide', position: 2 }, next: ['retour'] },
    retour: { objective: { type: 'parler', npc: 'yarema', node: 'notes-guide' }, next: [] },
  },
});
