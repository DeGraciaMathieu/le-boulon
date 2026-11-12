// Tuile Agroprom v2 (brief v2 §3.1, §3.4), lue sur assets/tuiles/agroprom.png (la même image
// que la v1). Même format et même lecture de l'image que src/content/tuiles/cordon.js.
// src/engine/data/agroprom.js reste la tuile v1 de l'interface et du banc.
//
//   18  19   8
//   17   7   2   9
//   16   6   1   3  10
//   15   5   4  11
//   14  13  12

import { deepFreeze } from '../freeze.js';

export default deepFreeze({
  name: 'Agroprom',
  label: 'Агропром',
  image: 'assets/tuiles/agroprom.png',
  // Calage de la v1, vérifié par superposition.
  calage: { cx: 367.5, cy: 339.5, taille: 84.9 },
  level: 3,
  // Bord sud, côté Marais (entrée de la v1).
  entry: 14,
  // Paquet de la v1 (Menace 3 à 7), déjà au niveau 3.
  encounters: 'rencontres-agroprom',
  hexes: {
    1: { terrain: 'herbe' },
    2: { terrain: 'route' },
    3: { terrain: 'foret' },
    4: { terrain: 'herbe' },
    5: { terrain: 'route' },
    6: { terrain: 'herbe', lieu: 'Тунель', abri: true },
    // Repaire (§3.4), sans crâne sur l'image.
    7: { terrain: 'batiment', lieu: 'Фабрика', abri: true, repaire: true },
    // Tranchées et débris (hypothèse v1).
    8: { terrain: 'foret', radiation: true },
    9: { terrain: 'foret' },
    10: { terrain: 'herbe' },
    11: { terrain: 'foret' },
    12: { terrain: 'herbe' },
    13: { terrain: 'foret' },
    14: { terrain: 'herbe' },
    // Écusson militaire et losange de l'image.
    15: { terrain: 'batiment', lieu: 'Агропром', abri: true, faction: 'militaires', pnj: true },
    // Marais stagnant (hypothèse v1).
    16: { terrain: 'marais', lieu: 'Болото', radiation: true },
    17: { terrain: 'herbe' },
    18: { terrain: 'foret' },
    19: { terrain: 'foret' },
  },
});
