// Paquet de rencontres : Entrepôts militaires (brief v2 §5.2, §13), format decks de src/content/validate.js,
// cartes au format de src/content/paquets/rencontres-agroprom.js.
// Hypothèse v2 : niveau 4, Menace 5 à 8, 2 à 3 blessures.

import { deepFreeze } from '../freeze.js';

export default deepFreeze({
  kind: 'rencontres',
  tile: 'entrepots',
  cards: [
    { id: 'zombies', name: 'Zombies', threat: 5, wounds: 2 },
    { id: 'pseudo-chien', name: 'Pseudo-chien', threat: 5, wounds: 2 },
    { id: 'snork', name: 'Snork', threat: 6, wounds: 2 },
    { id: 'mercenaires', name: 'Mercenaires', threat: 7, wounds: 3 },
    { id: 'sangsue', name: 'Suceur de sang', threat: 7, wounds: 3 },
    { id: 'chimere', name: 'Chimère', threat: 8, wounds: 3 },
  ],
});
