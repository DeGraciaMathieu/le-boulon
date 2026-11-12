// Tuile Rostok (brief v2 §3.1, §3.4), lue sur assets/tuiles/rostok.png. Même format et
// même lecture de l'image que src/content/tuiles/cordon.js.
//
//   18  19   8
//   17   7   2   9
//   16   6   1   3  10
//   15   5   4  11
//   14  13  12
//
// Hypothèse v2 : l'image ne nomme que le Bar et la Cour mécanisée. L'Usine Rostok (grands
// toits au nord), la Barrière du Devoir (bâtiments sur la route du sud) et les Dortoirs
// (barres de bâtiments à l'est) sont nommés en regardant l'image (§3.4).

import { deepFreeze } from '../freeze.js';

export default deepFreeze({
  name: 'Rostok',
  label: 'Росток',
  image: 'assets/tuiles/rostok.png',
  // Image 735 x 679, vérifiée par superposition.
  calage: { cx: 367.5, cy: 339.5, taille: 84.9 },
  level: 4,
  // Hypothèse v2 : on arrive par la Barrière du Devoir, liaison de la Décharge.
  entry: 13,
  encounters: 'rencontres-rostok',
  hexes: {
    1: { terrain: 'batiment' },
    2: { terrain: 'batiment' },
    3: { terrain: 'batiment', lieu: 'Гуртожитки', abri: true },
    4: { terrain: 'batiment', lieu: 'Бар 100 рентген', abri: true, faction: 'devoir' },
    5: { terrain: 'route' },
    6: { terrain: 'foret' },
    7: { terrain: 'route' },
    8: { terrain: 'foret' },
    9: { terrain: 'batiment', lieu: 'Механізований двір', abri: true },
    10: { terrain: 'foret' },
    11: { terrain: 'foret' },
    12: { terrain: 'foret' },
    13: { terrain: 'route', lieu: 'Блокпост «Обов\'язку»', faction: 'devoir' },
    14: { terrain: 'foret' },
    15: { terrain: 'foret' },
    16: { terrain: 'foret' },
    17: { terrain: 'foret' },
    18: { terrain: 'foret' },
    19: { terrain: 'batiment', lieu: 'Завод «Росток»', abri: true },
  },
});
