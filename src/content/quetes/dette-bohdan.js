// Quête secondaire « La dette de Bohdan » (brief v2 §8.1, §8.2), donnée par Bohdan au Camp des
// novices. Embranchement au nœud dette de son dialogue : payer le créancier à la Ferme, ou
// cacher Bohdan à l'Élévateur (escorte). Délai et récompenses : hypothèse v2.
import { deepFreeze } from '../freeze.js';

export default deepFreeze({
  name: 'La dette de Bohdan',
  giver: 'bohdan',
  start: 'debut',
  deadline: 3,
  rewards: { roubles: 150, xp: 40, reputation: { solitaires: 1 } },
  steps: {
    debut: { objective: { type: 'parler', npc: 'bohdan', node: 'dette' }, next: ['payer', 'cacher'] },
    payer: { objective: { type: 'visiter', place: 'ferme-cordon' }, next: ['retour'] },
    retour: { objective: { type: 'parler', npc: 'bohdan', node: 'merci' }, next: [] },
    cacher: { objective: { type: 'escorter', npc: 'bohdan', place: 'elevateur' }, next: [] },
  },
});
