// Paquet de rencontres : Rostok (brief v2 §5.2, §13), format decks de src/content/validate.js,
// cartes au format de src/content/paquets/rencontres-agroprom.js (champs du combat v2 compris).
// Hypothèse v2 : niveau 4, Menace 5 à 8, 2 à 3 blessures.
// Hypothèse v2 aussi : PV, dégâts, type, faction, trophée et nombre de chaque carte (LBL-54).
// Zombies : stalkers zombifiés, type 'mutant' pour qu'ils ne parlementent pas (§13).

import { deepFreeze } from '../freeze.js';

export default deepFreeze({
  kind: 'rencontres',
  tile: 'rostok',
  cards: [
    { id: 'zombies', name: 'Zombies', threat: 5, wounds: 2, hp: 2, damage: 1, type: 'mutant', count: 2 },
    { id: 'pseudo-chien', name: 'Pseudo-chien', threat: 5, wounds: 2, hp: 3, damage: 2, type: 'mutant' },
    { id: 'snork', name: 'Snork', threat: 6, wounds: 2, hp: 3, damage: 2, type: 'mutant' },
    { id: 'mercenaires', name: 'Mercenaires', threat: 7, wounds: 3, hp: 3, damage: 2, type: 'humain', faction: null, count: 2 },
    { id: 'sangsue', name: 'Suceur de sang', threat: 7, wounds: 3, hp: 4, damage: 2, type: 'mutant' },
    { id: 'controleur', name: 'Contrôleur', threat: 8, wounds: 3, hp: 4, damage: 2, type: 'mutant' },
  ],
});
