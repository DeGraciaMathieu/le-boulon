// Paquet de rencontres : Marais (brief v2 §5.2, §13), format decks de src/content/validate.js,
// cartes au format de src/content/paquets/rencontres-agroprom.js.
// Hypothèse v2 : niveau 2, Menace 3 à 6, 1 à 2 blessures.

import { deepFreeze } from '../freeze.js';

export default deepFreeze({
  kind: 'rencontres',
  tile: 'marais',
  cards: [
    { id: 'chair', name: 'Chair', threat: 3, wounds: 1 },
    { id: 'chiens', name: 'Chiens aveugles', threat: 4, wounds: 1 },
    { id: 'pillards', name: 'Pillards', threat: 4, wounds: 1 },
    { id: 'sanglier', name: 'Sanglier muté', threat: 5, wounds: 2 },
    { id: 'renegats', name: 'Renégats', threat: 5, wounds: 2 },
    { id: 'sangsue', name: 'Suceur de sang', threat: 6, wounds: 2 },
  ],
});
