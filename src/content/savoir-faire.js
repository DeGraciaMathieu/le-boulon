// Savoir-faire du brief v2 §11.2 (carte 17), clé = id du savoir-faire (player.perks).
//
// FORMAT : celui de la collection perks de src/content/validate.js, { name, effect }.
//   effect : texte du §11.2, affiché sur la fiche.
// Les effets sont des règles du moteur, lues par hasPerk : l'en-tête de
// src/engine/rules/progression.js dit où chacun est branché.

import { deepFreeze } from './freeze.js';

export default deepFreeze({
  'pied-leger': { name: 'Pied léger', effect: 'La forêt coûte 1 PA' },
  bouliste: { name: 'Bouliste', effect: 'Un boulon révèle 2 hexagones en ligne' },
  'oeil-de-lynx': { name: 'Œil de lynx', effect: 'Détecteur +1 de portée' },
  coriace: { name: 'Coriace', effect: 'Seuil de mort à 7 blessures' },
  'peau-dure': { name: 'Peau dure', effect: '−1 radiation à chaque gain' },
  fouilleur: { name: 'Fouilleur', effect: 'Explorer une carte de lieu coûte 0 PA une fois par lieu' },
  marchandeur: { name: 'Marchandeur', effect: 'Un cran de réputation de plus pour les prix' },
  tireur: { name: 'Tireur', effect: '+1 Tir au fusil' },
  fantome: { name: 'Fantôme', effect: '+1 Discrétion la nuit et sous la pluie' },
  infirmier: { name: 'Infirmier', effect: 'Les bandages soignent 2 blessures' },
  mule: { name: 'Mule', effect: "+3 cases d'inventaire" },
  instinct: { name: 'Instinct', effect: "Annonce l'Émission dès le matin même sans carte de signes" },
});
