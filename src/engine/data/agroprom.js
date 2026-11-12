// Tuile Agroprom, case par case. Les numéros sont ceux de src/engine/hex.js.
//
// L'image assets/tuile-agroprom.png a des hexagones à sommet pointu (rangées
// 3-4-5-4-3), comme la grille de hex.js : aucune rotation à appliquer.
//
// Vue de l'image (rangée du haut à celle du bas) :
//   18  19   8
//   17   7   2   9
//   16   6   1   3  10
//   15   5   4  11
//   14  13  12

import agropromEncounters from '../../content/paquets/rencontres-agroprom.js';
import { cardsById } from '../rules/tile.js';

// Pose de la grille sur l'image, en pixels de l'image (735 x 679) :
// cx, cy = centre de l'hexagone 1 ; taille = rayon d'un hexagone (centre -> sommet).
export const calage = Object.freeze({ cx: 367.5, cy: 339.5, taille: 84.9 });

export default Object.freeze({
  name: 'Agroprom',
  // Bord sud, côté Cordon.
  entry: 14,
  // Paquet de rencontres de la tuile (src/engine/rules/tile.js). Composition par défaut.
  encounterCards: cardsById(agropromEncounters),
  hexes: Object.freeze({
    1: { terrain: 'herbe' },
    2: { terrain: 'route' },
    3: { terrain: 'foret' },
    4: { terrain: 'herbe' },
    5: { terrain: 'route' },
    6: { terrain: 'herbe', lieu: 'Тунель', abri: true },
    7: { terrain: 'batiment', lieu: 'Фабрика', abri: true },
    // Tranchées et débris (hypothèse v1).
    8: { terrain: 'herbe', radiation: true },
    9: { terrain: 'foret' },
    10: { terrain: 'herbe' },
    11: { terrain: 'foret' },
    12: { terrain: 'herbe' },
    13: { terrain: 'foret' },
    14: { terrain: 'herbe' },
    15: { terrain: 'batiment', lieu: 'Агропром', abri: true },
    // Marais stagnant (hypothèse v1).
    16: { terrain: 'marais', lieu: 'Болото', radiation: true },
    17: { terrain: 'herbe' },
    18: { terrain: 'foret' },
    19: { terrain: 'herbe' },
  }),
});
