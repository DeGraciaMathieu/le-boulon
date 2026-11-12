// Tuile Décharge (brief v2 §3.1, §3.4), lue sur assets/tuiles/decharge.png. Même format et
// même lecture de l'image que src/content/tuiles/cordon.js.
//
//   18  19   8
//   17   7   2   9
//   16   6   1   3  10
//   15   5   4  11
//   14  13  12

import { deepFreeze } from '../freeze.js';

export default deepFreeze({
  name: 'Décharge',
  label: 'Звалище',
  image: 'assets/tuiles/decharge.png',
  // Image 735 x 685 : la tuile occupe les lignes 0 à 679, 6 px blancs dessous.
  calage: { cx: 367.5, cy: 339.5, taille: 84.9 },
  level: 2,
  // Hypothèse v2 : on arrive par le КПП, liaison du Cordon.
  entry: 13,
  encounters: 'rencontres-decharge',
  hexes: {
    // Arrêt de bus, PNJ (§3.4) : le losange de l'image est juste au-dessus, sur le coin de 2.
    1: { terrain: 'route', lieu: 'Автобусна зупинка', pnj: true },
    2: { terrain: 'batiment', lieu: 'Руїни', abri: true, radiation: true },
    3: { terrain: 'herbe' },
    // Pictogramme simple, pas doublé : pas de forêt.
    4: { terrain: 'herbe' },
    5: { terrain: 'herbe' },
    // Dépôt irradié (§3.4) : le trèfle de l'image est dessiné sur le bord de 16, près de
    // l'étiquette « Депо ».
    6: { terrain: 'batiment', lieu: 'Депо', abri: true, radiation: true },
    7: { terrain: 'herbe' },
    8: { terrain: 'foret' },
    9: { terrain: 'foret' },
    10: { terrain: 'foret' },
    11: { terrain: 'foret' },
    12: { terrain: 'foret' },
    13: { terrain: 'route', lieu: 'КПП' },
    // Très irradié (§3.4), sans trèfle sur l'image.
    14: { terrain: 'herbe', lieu: 'Стоянка покинутої техніки', radiation: true },
    15: { terrain: 'route' },
    16: { terrain: 'batiment', lieu: 'Тунель', abri: true },
    17: { terrain: 'route' },
    18: { terrain: 'herbe' },
    // Cible rouge : barrage des bandits (§3.3).
    19: { terrain: 'route', lieu: 'Блокпост', faction: 'bandits' },
  },
});
