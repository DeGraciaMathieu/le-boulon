// Patrouilles qui circulent entre les tuiles (brief v2 §10.2, §9 ; carte LBL-49).
// Format : celui de la collection patrols de src/content/validate.js,
//   { [id]: { tile, name, threat, wounds, hp, damage, type, faction, count } }
//     tile      tuile de départ de la patrouille (content.tiles)
//     le reste  une carte de rencontre (format des paquets de rencontres, combat v2) :
//               le jeton de la patrouille porte cette carte, d'id celui de la patrouille.
// Le moteur la lit par encounterCard de src/engine/rules/tile.js et la fait circuler par
// src/engine/rules/patrols.js.
//
// Hypothèse v2 : les cinq patrouilles, leurs tuiles de départ et leurs chiffres (le brief
// n'en donne aucun) ; une patrouille par faction sauf Ciel Pur, partie d'une tuile de la
// faction (Militaires : institut d'Agroprom) ; aucune ne part du Cordon ni de la Décharge, pour
// un début de campagne calme autour du Camp des novices.

import { deepFreeze } from './freeze.js';

const PATROL = { type: 'humain', count: 2 };

export default deepFreeze({
  'patrouille-militaires': {
    ...PATROL, id: 'patrouille-militaires', tile: 'agroprom', name: 'Patrouille militaire',
    threat: 6, wounds: 2, hp: 2, damage: 1, faction: 'militaires',
  },
  'patrouille-bandits': {
    ...PATROL, id: 'patrouille-bandits', tile: 'vallee-sombre', name: 'Bande de bandits',
    threat: 5, wounds: 2, hp: 2, damage: 1, faction: 'bandits',
  },
  'patrouille-solitaires': {
    ...PATROL, id: 'patrouille-solitaires', tile: 'marais', name: 'Groupe de solitaires',
    threat: 4, wounds: 1, hp: 2, damage: 1, faction: 'solitaires',
  },
  'patrouille-devoir': {
    ...PATROL, id: 'patrouille-devoir', tile: 'rostok', name: 'Patrouille du Devoir',
    threat: 6, wounds: 2, hp: 3, damage: 1, faction: 'devoir',
  },
  'patrouille-liberte': {
    ...PATROL, id: 'patrouille-liberte', tile: 'entrepots', name: 'Patrouille de Liberté',
    threat: 6, wounds: 2, hp: 3, damage: 1, faction: 'liberte',
  },
});
