// Tuile Vallée Sombre (brief v2 §3.1, §3.4), lue sur assets/tuiles/vallee-sombre.png. Même
// format et même lecture de l'image que src/content/tuiles/cordon.js.
//
//   18  19   8
//   17   7   2   9
//   16   6   1   3  10
//   15   5   4  11
//   14  13  12

import { deepFreeze } from '../freeze.js';

export default deepFreeze({
  name: 'Vallée Sombre',
  label: 'Темна долина',
  image: 'assets/tuiles/vallee-sombre.png',
  // Image 736 x 688 : la tuile occupe les lignes 8 à 687 et toute la largeur.
  calage: { cx: 368, cy: 347.5, taille: 85 },
  level: 3,
  // Hypothèse v2 : on arrive par la liaison de la Décharge.
  entry: 15,
  // Hypothèse v2 : niveau 3, Menace 4 à 7, 1 à 3 blessures ; bandits surreprésentés.
  encounterCards: {
    bandits: { name: 'Bandits', threat: 4, wounds: 1 },
    chiens: { name: 'Chiens aveugles', threat: 4, wounds: 1 },
    sanglier: { name: 'Sanglier muté', threat: 5, wounds: 2 },
    'bandits-armes': { name: 'Bandits armés', threat: 6, wounds: 2 },
    snork: { name: 'Snork', threat: 6, wounds: 2 },
    sangsue: { name: 'Suceur de sang', threat: 7, wounds: 3 },
  },
  hexes: {
    1: { terrain: 'route' },
    2: { terrain: 'herbe' },
    // Accès au laboratoire, acte 3 (§3.4).
    3: { terrain: 'batiment', lieu: 'Завод', abri: true },
    4: { terrain: 'foret' },
    5: { terrain: 'route', lieu: 'Міст' },
    6: { terrain: 'herbe' },
    // Base des bandits : crâne de l'image (§3.4).
    7: { terrain: 'batiment', lieu: 'Фабрика', abri: true, repaire: true, faction: 'bandits' },
    8: { terrain: 'foret' },
    9: { terrain: 'foret' },
    10: { terrain: 'batiment', lieu: 'Заправка' },
    11: { terrain: 'foret' },
    12: { terrain: 'herbe' },
    13: { terrain: 'route' },
    14: { terrain: 'batiment', lieu: 'Ферма', abri: true },
    15: { terrain: 'route' },
    16: { terrain: 'foret' },
    17: { terrain: 'herbe', lieu: 'Ущелина' },
    18: { terrain: 'foret' },
    19: { terrain: 'route', lieu: 'Розбите КПП' },
  },
});
