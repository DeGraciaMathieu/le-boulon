// Paramètres de règles portés par la tuile (brief v2 §17.1 : règles paramétrées par la tuile).
//
// Les règles suspects, encounters et zone lisent la tuile courante (state.tile) par ces
// fonctions au lieu de supposer l'Agroprom. Une tuile au format de src/engine/data/agroprom.js
// peut ajouter :
//   encounterCards   { [id]: { name, threat, wounds } }  son paquet de rencontres
//   composition: {   chaque champ surcharge la valeur globale de TILE_DEFAULTS
//     suspects,      ['anomalie' | 'artefact' | 'rien', ...]  jetons suspects posés
//     anomalies,     ['electro' | 'gravitationnelle' | 'bruleuse', ...]  types tirés
//     encounters,    nombre de jetons de rencontre posés
//     zone,          [id] cartes du paquet Zone hors Émission (l'Émission est toujours ajoutée)
//   }
// Les hexagones de la tuile sont les clés de tile.hexes (numéros de src/engine/hex.js) : un
// numéro absent n'existe pas sur cette tuile (ni jeton, ni rencontre, ni chiens).
//
// API (pures) :
//   tileHexes(tile)           [n] numéros des hexagones de la tuile, triés
//   hasHex(tile, n)           true si n est un hexagone de la tuile
//   suspectComposition(tile)  anomalyKinds(tile)  encounterCount(tile)  zoneCards(tile)
//   encounterCards(tile)      paquet de la tuile, sinon DEFAULT_ENCOUNTER_CARDS
//
// HYPOTHÈSE V2 : une tuile sans encounterCards (tuiles factices des tests v1) joue le paquet
// de l'Agroprom, seul paquet existant.

import AGROPROM_ENCOUNTERS from '../../content/paquets/rencontres-agroprom.js';

export const DEFAULT_ENCOUNTER_CARDS = AGROPROM_ENCOUNTERS;

export const TILE_DEFAULTS = Object.freeze({
  suspects: Object.freeze(['anomalie', 'anomalie', 'artefact', 'artefact', 'rien']),
  anomalies: Object.freeze(['electro', 'gravitationnelle', 'bruleuse']),
  encounters: 3,
  // Le brief en liste 9 (calme ×3) ; une 4e carte calme complète les 10 avec l'Émission.
  zone: Object.freeze(['patrouille', 'chiens', 'brouillard', 'cachette', 'radio', 'calme', 'calme', 'calme', 'calme']),
});

const composition = (tile, key) => tile.composition?.[key] ?? TILE_DEFAULTS[key];

export function tileHexes(tile) {
  return Object.keys(tile.hexes)
    .map(Number)
    .sort((a, b) => a - b);
}

export function hasHex(tile, n) {
  return Object.hasOwn(tile.hexes, n);
}

export const suspectComposition = (tile) => composition(tile, 'suspects');
export const anomalyKinds = (tile) => composition(tile, 'anomalies');
export const encounterCount = (tile) => composition(tile, 'encounters');
export const zoneCards = (tile) => composition(tile, 'zone');

export function encounterCards(tile) {
  return tile.encounterCards ?? DEFAULT_ENCOUNTER_CARDS;
}
