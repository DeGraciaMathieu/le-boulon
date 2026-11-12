// Paquet de rencontres : Cordon (brief v2 §5.2, §13), format decks de src/content/validate.js,
// cartes au format de src/content/paquets/rencontres-agroprom.js (champs du combat v2 compris).
// Hypothèse v2 : niveau 1, Menace 2 à 5, 1 à 2 blessures.
// Hypothèse v2 aussi : PV, dégâts, type, faction, trophée et nombre de chaque carte (LBL-54).

import { deepFreeze } from '../freeze.js';

export default deepFreeze({
  kind: 'rencontres',
  tile: 'cordon',
  cards: [
    { id: 'pillard', name: 'Pillard', threat: 2, wounds: 1, hp: 1, damage: 1, type: 'humain', faction: 'bandits' },
    { id: 'chiens', name: 'Chiens aveugles', threat: 3, wounds: 1, hp: 1, damage: 1, type: 'mutant', trophy: 'queue-chien', count: 2 },
    { id: 'chair', name: 'Chair', threat: 3, wounds: 1, hp: 2, damage: 1, type: 'mutant' },
    { id: 'bandits', name: 'Bandits', threat: 4, wounds: 1, hp: 2, damage: 1, type: 'humain', faction: 'bandits', count: 2 },
    { id: 'sanglier', name: 'Sanglier muté', threat: 4, wounds: 2, hp: 2, damage: 2, type: 'mutant', trophy: 'sabot' },
    { id: 'militaires', name: 'Patrouille militaire', threat: 5, wounds: 2, hp: 2, damage: 1, type: 'humain', faction: 'militaires', count: 2 },
  ],
});
