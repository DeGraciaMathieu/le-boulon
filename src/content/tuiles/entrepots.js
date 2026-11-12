// Tuile Entrepôts militaires (brief v2 §3.1, §3.4), lue sur
// assets/tuiles/entrepots-militaires.png. Même format et même lecture de l'image que
// src/content/tuiles/cordon.js.
//
//   18  19   8
//   17   7   2   9
//   16   6   1   3  10
//   15   5   4  11
//   14  13  12
//
// Décision de Mathieu (§19) : le grand cercle est la Base de Liberté ; l'étiquette
// « Бар 100 рентген » de l'image est une erreur, le Bar est à Rostok. La route du Nord
// (fin de la v2) n'a pas de liaison : aucune tuile au nord.

import { deepFreeze } from '../freeze.js';

export default deepFreeze({
  name: 'Entrepôts militaires',
  label: 'Армійські склади',
  image: 'assets/tuiles/entrepots-militaires.png',
  // Image 735 x 679, vérifiée par superposition.
  calage: { cx: 367.5, cy: 339.5, taille: 84.9 },
  level: 4,
  // Hypothèse v2 : on arrive par la liaison de Rostok.
  entry: 13,
  // Hypothèse v2 : niveau 4, Menace 5 à 8, 2 à 3 blessures.
  encounterCards: {
    zombies: { name: 'Zombies', threat: 5, wounds: 2 },
    'pseudo-chien': { name: 'Pseudo-chien', threat: 5, wounds: 2 },
    snork: { name: 'Snork', threat: 6, wounds: 2 },
    mercenaires: { name: 'Mercenaires', threat: 7, wounds: 3 },
    sangsue: { name: 'Suceur de sang', threat: 7, wounds: 3 },
    chimere: { name: 'Chimère', threat: 8, wounds: 3 },
  },
  hexes: {
    1: { terrain: 'route' },
    // Rochers au nord-est (§3.4).
    2: { terrain: 'route', lieu: 'Аномальне поле' },
    3: { terrain: 'marais' },
    4: { terrain: 'batiment', lieu: 'База «Свободи»', abri: true, faction: 'liberte' },
    5: { terrain: 'herbe' },
    // Maisons à l'ouest (§3.4).
    6: { terrain: 'batiment', lieu: 'Покинуте село', abri: true },
    // Cercle sans étiquette autour d'une cabane : hypothèse v2, une cabane de garde forestier.
    7: { terrain: 'batiment', lieu: 'Лісова сторожка', abri: true },
    8: { terrain: 'foret' },
    9: { terrain: 'foret' },
    10: { terrain: 'marais', lieu: 'Озеро' },
    11: { terrain: 'herbe' },
    12: { terrain: 'herbe' },
    13: { terrain: 'herbe' },
    14: { terrain: 'foret' },
    15: { terrain: 'foret' },
    16: { terrain: 'foret' },
    17: { terrain: 'foret' },
    18: { terrain: 'foret' },
    19: { terrain: 'foret' },
  },
});
