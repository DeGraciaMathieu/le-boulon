// Quête secondaire « Les mesures d’Arkadi » (brief v2 §8.1, §8.2), donnée par Arkadi, technicien
// de Ciel Pur : passer une Émission, relever les mesures au Cimetière de véhicules de la Décharge,
// puis les lui rapporter. Sans délai. Récompenses : hypothèse v2.
import { deepFreeze } from '../freeze.js';

export default deepFreeze({
  name: 'Les mesures d’Arkadi',
  giver: 'arkadi',
  start: 'emission',
  rewards: { roubles: 250, xp: 50, reputation: { 'ciel-pur': 1 } },
  steps: {
    emission: { objective: { type: 'survivre', emission: true }, next: ['mesures'] },
    mesures: { objective: { type: 'visiter', place: 'cimetiere-vehicules' }, next: ['retour'] },
    retour: { objective: { type: 'parler', npc: 'arkadi', node: 'mesures' }, next: [] },
  },
});
