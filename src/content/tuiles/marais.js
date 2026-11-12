// Tuile Marais (brief v2 §3.1, §3.4), lue sur assets/tuiles/marais.png. Même format et
// même lecture de l'image que src/content/tuiles/cordon.js.
//
//   18  19   8
//   17   7   2   9
//   16   6   1   3  10
//   15   5   4  11
//   14  13  12
//
// La majorité des hexagones sont en 'marais' (§3.4) : la tuile lente.

import { deepFreeze } from '../freeze.js';

export default deepFreeze({
  name: 'Marais',
  label: 'Болото',
  image: 'assets/tuiles/marais.png',
  // Image 735 x 679, vérifiée par superposition.
  calage: { cx: 367.5, cy: 339.5, taille: 84.9 },
  level: 2,
  // Hypothèse v2 : on arrive par la liaison du Cordon.
  entry: 11,
  // Hypothèse v2 : niveau 2, Menace 3 à 6, 1 à 2 blessures.
  encounterCards: {
    chair: { name: 'Chair', threat: 3, wounds: 1 },
    chiens: { name: 'Chiens aveugles', threat: 4, wounds: 1 },
    pillards: { name: 'Pillards', threat: 4, wounds: 1 },
    sanglier: { name: 'Sanglier muté', threat: 5, wounds: 2 },
    renegats: { name: 'Renégats', threat: 5, wounds: 2 },
    sangsue: { name: 'Suceur de sang', threat: 6, wounds: 2 },
  },
  hexes: {
    1: { terrain: 'marais' },
    2: { terrain: 'marais' },
    3: { terrain: 'herbe', lieu: 'Спалений хутір' },
    4: { terrain: 'batiment', lieu: 'Церква', abri: true },
    5: { terrain: 'batiment', lieu: 'Рибальський хутір', abri: true },
    6: { terrain: 'batiment', lieu: 'Насосна станція', abri: true },
    7: { terrain: 'marais', lieu: 'Руїни села' },
    8: { terrain: 'foret' },
    9: { terrain: 'batiment', lieu: 'Механізований двір', abri: true },
    10: { terrain: 'marais' },
    11: { terrain: 'herbe', lieu: 'Хутір' },
    12: { terrain: 'marais' },
    13: { terrain: 'marais' },
    14: { terrain: 'foret' },
    15: { terrain: 'batiment', lieu: 'База «Чистого неба»', abri: true, faction: 'ciel-pur' },
    16: { terrain: 'marais' },
    17: { terrain: 'marais', lieu: 'Форпост' },
    // Une maison sans nom ni cercle : pas un lieu.
    18: { terrain: 'herbe' },
    19: { terrain: 'route' },
  },
});
