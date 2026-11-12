// Paquet de rencontres : Vallée Sombre (brief v2 §5.2, §13), format decks de src/content/validate.js,
// cartes au format de src/content/paquets/rencontres-agroprom.js (champs du combat v2 compris).
// Hypothèse v2 : niveau 3, Menace 4 à 7, 1 à 3 blessures ; bandits surreprésentés.
// Hypothèse v2 aussi : PV, dégâts, type, faction, trophée et nombre de chaque carte (LBL-54).

import { deepFreeze } from '../freeze.js';

export default deepFreeze({
  kind: 'rencontres',
  tile: 'vallee-sombre',
  cards: [
    { id: 'bandits', name: 'Bandits', threat: 4, wounds: 1, hp: 2, damage: 1, type: 'humain', faction: 'bandits', count: 2 },
    { id: 'chiens', name: 'Chiens aveugles', threat: 4, wounds: 1, hp: 1, damage: 1, type: 'mutant', trophy: 'queue-chien', count: 3 },
    { id: 'sanglier', name: 'Sanglier muté', threat: 5, wounds: 2, hp: 2, damage: 2, type: 'mutant', trophy: 'sabot' },
    { id: 'bandits-armes', name: 'Bandits armés', threat: 6, wounds: 2, hp: 2, damage: 2, type: 'humain', faction: 'bandits', count: 2 },
    { id: 'snork', name: 'Snork', threat: 6, wounds: 2, hp: 3, damage: 2, type: 'mutant' },
    { id: 'sangsue', name: 'Suceur de sang', threat: 7, wounds: 3, hp: 4, damage: 2, type: 'mutant' },
  ],
});
