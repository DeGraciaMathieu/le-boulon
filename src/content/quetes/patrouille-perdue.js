// Quête secondaire « La patrouille perdue » (brief v2 §8.1, §8.2), donnée par le sergent Ostap au
// Bar : venger une patrouille du Devoir tuée par des mercenaires à Agroprom. Délai et
// récompenses : hypothèse v2.
import { deepFreeze } from '../freeze.js';

export default deepFreeze({
  name: 'La patrouille perdue',
  giver: 'ostap',
  start: 'vengeance',
  deadline: 4,
  rewards: { roubles: 400, xp: 70, reputation: { devoir: 1 } },
  steps: {
    vengeance: { objective: { type: 'eliminer', encounter: 'mercenaires', tile: 'agroprom' }, next: ['rapport'] },
    rapport: { objective: { type: 'parler', npc: 'ostap', node: 'patrouille' }, next: [] },
  },
});
