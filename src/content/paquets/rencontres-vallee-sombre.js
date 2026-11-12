// Paquet de rencontres : Vallée Sombre (brief v2 §5.2, §13), format decks de src/content/validate.js,
// cartes au format de src/content/paquets/rencontres-agroprom.js.
// Hypothèse v2 : niveau 3, Menace 4 à 7, 1 à 3 blessures ; bandits surreprésentés.

import { deepFreeze } from '../freeze.js';

export default deepFreeze({
  kind: 'rencontres',
  tile: 'vallee-sombre',
  cards: [
    { id: 'bandits', name: 'Bandits', threat: 4, wounds: 1 },
    { id: 'chiens', name: 'Chiens aveugles', threat: 4, wounds: 1 },
    { id: 'sanglier', name: 'Sanglier muté', threat: 5, wounds: 2 },
    { id: 'bandits-armes', name: 'Bandits armés', threat: 6, wounds: 2 },
    { id: 'snork', name: 'Snork', threat: 6, wounds: 2 },
    { id: 'sangsue', name: 'Suceur de sang', threat: 7, wounds: 3 },
  ],
});
