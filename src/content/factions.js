// Factions du brief v2 §9 (carte 16). Règles : src/engine/rules/factions.js.
//
// FORMAT : celui de la collection factions de src/content/validate.js (LBL-47),
//   { name, places, joinable, start, default?, act?, rival? }
//     places    ids de content.places (lieux.js, carte 10) : les bases de la faction
//     joinable  true : on peut en être membre (Solitaires par défaut, Devoir et Liberté à l'acte 4)
//     start     réputation de départ, -3..3 ; attitude du §9 : amical +2, neutre 0, hostile -2
//               (hypothèse v2, valeurs reprises de la carte 16)
//     default   true : faction du joueur au départ (Solitaires, §9)
//     act       acte à partir duquel on peut la rejoindre (§9)
//     rival     faction passée à -2 quand on rejoint celle-ci (§9)
//
// Hypothèse v2 : ids des lieux (places), en attendant lieux.js (carte 10) qui les fixera ;
// le §3.4 ne donne que les noms (Camp des novices, Bar « 100 Rads »…).

import { deepFreeze } from './freeze.js';

export default deepFreeze({
  solitaires: {
    id: 'solitaires', name: 'Solitaires', places: ['camp-novices'],
    joinable: true, default: true, start: 2,
  },
  devoir: {
    id: 'devoir', name: 'Devoir', places: ['bar'],
    joinable: true, act: 4, rival: 'liberte', start: 0,
  },
  liberte: {
    id: 'liberte', name: 'Liberté', places: ['base-liberte'],
    joinable: true, act: 4, rival: 'devoir', start: 0,
  },
  'ciel-pur': {
    id: 'ciel-pur', name: 'Ciel Pur', places: ['base-ciel-pur'],
    joinable: false, start: 0,
  },
  bandits: {
    id: 'bandits', name: 'Bandits', places: ['usine-vallee', 'barrage'],
    joinable: false, start: -2,
  },
  militaires: {
    id: 'militaires', name: 'Militaires', places: ['avant-poste', 'institut-agroprom'],
    joinable: false, start: -2,
  },
});
