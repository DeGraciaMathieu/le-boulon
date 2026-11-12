// Point d'entrée du contenu v2 (brief v2 §17.2) : objets JavaScript gelés, jamais de JSON.
//
// Chaque carte de contenu ajoute ses fichiers sous src/content/ (tuiles/<id>.js, lieux.js,
// objets.js, pnj.js, quetes/<id>.js, factions.js, paquets/…) et les range ici, sous une clé
// à elle. Le moteur lit le contenu par cet index ; l'état de campagne ne garde que des ids.
//
//   tiles    { [id]: tuile au format de src/engine/data/agroprom.js }   carte 5 (Données des tuiles)
//
// En attendant la carte 5, la seule tuile est l'Agroprom de la v1, importée telle quelle :
// src/engine/data/agroprom.js reste en place pour l'interface et le banc v1.

// Format de chaque collection et test de cohérence : src/content/validate.js.
// deepFreeze gèle aussi les hexagones d'Agroprom, que la v1 ne gelait qu'en surface.

import agroprom from '../engine/data/agroprom.js';
import { deepFreeze } from './freeze.js';

export default deepFreeze({
  tiles: { agroprom },
});
