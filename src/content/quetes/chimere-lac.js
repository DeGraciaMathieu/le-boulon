// Quête secondaire « La chimère du lac » (brief v2 §8.1, §8.2), donnée par Rouslan à la Base de
// Liberté : lire le journal du forestier (carte fixée 'journal-forestier' de sa cabane), abattre la
// chimère des Entrepôts, puis revenir. Délai et récompenses : hypothèse v2.
import { deepFreeze } from '../freeze.js';

export default deepFreeze({
  name: 'La chimère du lac',
  giver: 'rouslan',
  start: 'journal',
  deadline: 5,
  rewards: { roubles: 800, xp: 120, reputation: { liberte: 1 } },
  steps: {
    journal: {
      objective: { type: 'explorer', place: 'cabane-forestier', card: 'journal-forestier' },
      next: ['chasse'],
    },
    chasse: { objective: { type: 'eliminer', encounter: 'chimere', tile: 'entrepots' }, next: ['rapport'] },
    rapport: { objective: { type: 'parler', npc: 'rouslan', node: 'chimere' }, next: [] },
  },
});
