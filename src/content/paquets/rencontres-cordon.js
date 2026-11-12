// Paquet de rencontres : Cordon (brief v2 §5.2, §13), format decks de src/content/validate.js,
// cartes au format de src/content/paquets/rencontres-agroprom.js.
// Hypothèse v2 : niveau 1, Menace 2 à 5, 1 à 2 blessures.

import { deepFreeze } from '../freeze.js';

export default deepFreeze({
  kind: 'rencontres',
  tile: 'cordon',
  cards: [
    { id: 'pillard', name: 'Pillard', threat: 2, wounds: 1 },
    { id: 'chiens', name: 'Chiens aveugles', threat: 3, wounds: 1 },
    { id: 'chair', name: 'Chair', threat: 3, wounds: 1 },
    { id: 'bandits', name: 'Bandits', threat: 4, wounds: 1 },
    { id: 'sanglier', name: 'Sanglier muté', threat: 4, wounds: 2 },
    { id: 'militaires', name: 'Patrouille militaire', threat: 5, wounds: 2 },
  ],
});
