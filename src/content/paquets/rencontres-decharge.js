// Paquet de rencontres : Décharge (brief v2 §5.2, §13), format decks de src/content/validate.js,
// cartes au format de src/content/paquets/rencontres-agroprom.js (champs du combat v2 compris).
// Hypothèse v2 : niveau 2, Menace 3 à 6, 1 à 2 blessures ; bandits surreprésentés.
// Hypothèse v2 aussi : PV, dégâts, type, faction, trophée et nombre de chaque carte (LBL-54).

import { deepFreeze } from '../freeze.js';

export default deepFreeze({
  kind: 'rencontres',
  tile: 'decharge',
  cards: [
    { id: 'pillard', name: 'Pillard', threat: 3, wounds: 1, hp: 1, damage: 1, type: 'humain', faction: 'bandits' },
    { id: 'chiens', name: 'Chiens aveugles', threat: 4, wounds: 1, hp: 1, damage: 1, type: 'mutant', trophy: 'queue-chien', count: 3 },
    { id: 'bandits', name: 'Bandits', threat: 5, wounds: 2, hp: 2, damage: 1, type: 'humain', faction: 'bandits', count: 2 },
    { id: 'racketteurs', name: 'Racketteurs', threat: 5, wounds: 2, hp: 2, damage: 1, type: 'humain', faction: 'bandits', count: 2 },
    { id: 'sanglier', name: 'Sanglier muté', threat: 5, wounds: 2, hp: 3, damage: 2, type: 'mutant', trophy: 'sabot' },
    { id: 'pseudo-chien', name: 'Pseudo-chien', threat: 6, wounds: 2, hp: 3, damage: 2, type: 'mutant' },
  ],
});
