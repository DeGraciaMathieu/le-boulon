// Tuile Cordon (brief v2 §3.1, §3.4), lue sur assets/tuiles/cordon.png. Format de
// src/engine/data/agroprom.js ; champs documentés en tête de src/content/validate.js.
//
// Vue de l'image (rangée du haut à celle du bas), numéros de src/engine/hex.js :
//   18  19   8
//   17   7   2   9
//   16   6   1   3  10
//   15   5   4  11
//   14  13  12
//
// Terrain : 'foret' seulement sous les pictogrammes blancs doublés (légende §3.3) ; 'route'
// là où une route traverse l'hexagone ; 'batiment' sous un lieu bâti.

import { deepFreeze } from '../freeze.js';

export default deepFreeze({
  name: 'Cordon',
  label: 'Кордон',
  image: 'assets/tuiles/cordon.png',
  // Pose de la grille sur l'image (735 x 679), vérifiée par superposition :
  // cx, cy = centre de l'hexagone 1 ; taille = rayon d'un hexagone (centre -> sommet).
  calage: { cx: 367.5, cy: 339.5, taille: 84.9 },
  level: 1,
  // Départ de la campagne : le Camp des novices.
  entry: 5,
  // Hypothèse v2 : niveau 1, Menace 2 à 5, 1 à 2 blessures.
  encounterCards: {
    pillard: { name: 'Pillard', threat: 2, wounds: 1 },
    chiens: { name: 'Chiens aveugles', threat: 3, wounds: 1 },
    chair: { name: 'Chair', threat: 3, wounds: 1 },
    bandits: { name: 'Bandits', threat: 4, wounds: 1 },
    sanglier: { name: 'Sanglier muté', threat: 4, wounds: 2 },
    militaires: { name: 'Patrouille militaire', threat: 5, wounds: 2 },
  },
  hexes: {
    1: { terrain: 'route' },
    // Le crâne de l'image est sur l'hexagone de l'ATP.
    2: { terrain: 'batiment', lieu: 'АТП', abri: true, repaire: true },
    3: { terrain: 'herbe' },
    // Pictogramme simple, pas doublé : pas de forêt.
    4: { terrain: 'herbe' },
    // Le trèfle et le losange de l'image touchent cet hexagone. Le trèfle est rendu à la
    // Fosse aux déchets (§3.4), le hub restant une zone sûre (§6.1).
    5: { terrain: 'batiment', lieu: 'Табір новачків', abri: true, faction: 'solitaires', pnj: true },
    6: { terrain: 'herbe', lieu: 'Могильник відходів', radiation: true },
    // PNJ blessé de l'Élévateur (§3.4).
    7: { terrain: 'batiment', lieu: 'Елеватор', abri: true, pnj: true },
    8: { terrain: 'foret' },
    9: { terrain: 'foret' },
    10: { terrain: 'foret' },
    11: { terrain: 'herbe' },
    12: { terrain: 'foret' },
    // Militaires : pas d'abri tant qu'ils tiennent l'avant-poste (§3.4).
    13: { terrain: 'batiment', lieu: 'Застава', faction: 'militaires' },
    14: { terrain: 'foret' },
    // Route vers le Marais, sous la forêt.
    15: { terrain: 'foret' },
    16: { terrain: 'herbe' },
    17: { terrain: 'route' },
    18: { terrain: 'batiment', lieu: 'Ферма', abri: true },
    19: { terrain: 'route' },
  },
});
