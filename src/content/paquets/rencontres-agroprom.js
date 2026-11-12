// Paquet de rencontres de l'Agroprom, repris de la v1 (hypothèse v1) :
// Menace 3 à 7, blessures en cas de défaite 1 à 3.
// Format decks de src/content/validate.js : { kind: 'rencontres', tile, cards }. Une carte :
// { id, name, threat, wounds, hp?, damage?, type?, faction?, trophy?, count? }. name, threat
// et wounds servent à la résolution v1 (encounters.js) ; les autres au combat v2
// (src/engine/rules/combat.js, ENEMY_DEFAULTS si absents) : PV 1-4 de chaque ennemi, dégâts
// par attaque, 'humain' | 'mutant', faction (content.factions), trophée (objet 'trophee' de
// objets.js), nombre d'ennemis du groupe. Le moteur les lit par id : encounterCards de
// src/engine/rules/tile.js. Valeurs v2 : hypothèse v2.

import { deepFreeze } from '../freeze.js';

export default deepFreeze({
  kind: 'rencontres',
  tile: 'agroprom',
  cards: [
    { id: 'pillard', name: 'Pillard', threat: 3, wounds: 1, hp: 1, damage: 1, type: 'humain', faction: 'bandits' },
    { id: 'chiens', name: 'Chiens aveugles', threat: 4, wounds: 1, hp: 1, damage: 1, type: 'mutant', trophy: 'queue-chien', count: 3 },
    { id: 'bandits', name: 'Bandits', threat: 5, wounds: 2, hp: 2, damage: 1, type: 'humain', faction: 'bandits', count: 2 },
    { id: 'sanglier', name: 'Sanglier muté', threat: 5, wounds: 2, hp: 2, damage: 2, type: 'mutant', trophy: 'sabot' },
    { id: 'militaires', name: 'Militaires', threat: 6, wounds: 2, hp: 2, damage: 1, type: 'humain', faction: 'militaires', count: 2 },
    { id: 'mercenaires', name: 'Mercenaires', threat: 7, wounds: 3, hp: 3, damage: 2, type: 'humain', faction: null, count: 2 },
  ],
});
