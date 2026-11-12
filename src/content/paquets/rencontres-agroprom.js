// Paquet de rencontres de l'Agroprom, repris de la v1 (hypothèse v1) :
// Menace 3 à 7, blessures en cas de défaite 1 à 3.
// Format d'un paquet de rencontres de tuile : { [id]: { name, threat, wounds, hp?, damage?,
// type?, faction?, trophy?, count? } }. name, threat et wounds servent à la résolution v1
// (encounters.js) ; les autres au combat v2 (src/engine/rules/combat.js, ENEMY_DEFAULTS si
// absents) : PV 1-4 de chaque ennemi, dégâts par attaque, 'humain' | 'mutant', faction
// (content.factions), trophée (objet 'trophee' de objets.js), nombre d'ennemis du groupe.
// Valeurs v2 : hypothèse v2.

import { deepFreeze } from '../freeze.js';

export default deepFreeze({
  pillard: { name: 'Pillard', threat: 3, wounds: 1, hp: 1, damage: 1, type: 'humain', faction: 'bandits' },
  chiens: { name: 'Chiens aveugles', threat: 4, wounds: 1, hp: 1, damage: 1, type: 'mutant', trophy: 'queue-chien', count: 3 },
  bandits: { name: 'Bandits', threat: 5, wounds: 2, hp: 2, damage: 1, type: 'humain', faction: 'bandits', count: 2 },
  sanglier: { name: 'Sanglier muté', threat: 5, wounds: 2, hp: 3, damage: 2, type: 'mutant', trophy: 'sabot' },
  militaires: { name: 'Militaires', threat: 6, wounds: 2, hp: 2, damage: 1, type: 'humain', faction: 'militaires', count: 2 },
  mercenaires: { name: 'Mercenaires', threat: 7, wounds: 3, hp: 3, damage: 2, type: 'humain', faction: null, count: 2 },
});
