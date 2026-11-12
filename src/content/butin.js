// Tables de butin (brief v2 §5.3, carte 11) : { [tableId]: { level, entries: [{ item, weight,
// qty? }] } }, format en tête de src/content/validate.js, tirage par rollLoot de
// src/engine/rules/places.js (1 tirage par carte Butin, 2 par Cache réussie).
//
// Une table par niveau (1 Cordon ; 2 Marais, Décharge ; 3 Agroprom, Vallée Sombre ; 4 Rostok
// hors hub, Entrepôts) et par thème, id `n<niveau>-<thème>` :
//   commun     vivres, soins, munitions, boulons : fermes, hameaux, ruines
//   militaire  munitions, armes, grenades, trousses : postes, bases, usines tenues
//   irradie    artefacts et antiradiations : lieux irradiés, champs d'anomalies
//   cache      armes, armures, détecteurs, artefacts : cartes Cache et paquets intérieurs
// Les objets suivent les prix du §12 : plus la table est profonde, plus le tirage vaut cher.
//
// Hypothèse v2 : tous les poids et quantités (le brief ne donne que les niveaux). Pas d'objet
// de quête (posés par les cartes Indice), ni de trophée (laissés par les mutants, §13), ni de
// combinaison de faction (vendues par leurs bases).

import { deepFreeze } from './freeze.js';

const table = (level, weights) => ({
  level,
  entries: Object.entries(weights).map(([item, weight]) =>
    (Array.isArray(weight) ? { item, weight: weight[0], qty: weight[1] } : { item, weight })),
});

// Poids, ou [poids, quantité].
export default deepFreeze({
  'n1-commun': table(1, {
    ration: [6, 2], conserve: 3, bandage: 5, vodka: 4, munitions: 5, boulons: 4,
    'cartouches-12': 1, 'boisson-energetique': 1,
  }),
  'n1-militaire': table(1, {
    munitions: [6, 2], 'cartouches-12': 2, bandage: 3, 'trousse-soins': 2, ration: 3, grenade: 1,
    pistolet: 1, 'veste-cuir': 1,
  }),
  'n1-irradie': table(1, { meduse: 3, gouttelette: 1, epine: 1, vodka: 4, antirad: 1, boulons: 3 }),
  'n1-cache': table(1, {
    pistolet: 2, 'veste-cuir': 2, echo: 2, 'trousse-soins': 3, munitions: [4, 2], antirad: 2,
    meduse: 1, sac: 1, grenade: 1,
  }),

  'n2-commun': table(2, {
    ration: [4, 2], conserve: 4, saucisson: 1, bandage: 4, 'trousse-soins': 2, vodka: 3, antirad: 1,
    munitions: 4, 'cartouches-12': 3, boulons: 3, 'boisson-energetique': 1,
  }),
  'n2-militaire': table(2, {
    munitions: [4, 2], 'cartouches-12': 4, 'munitions-545': 1, grenade: 2, 'trousse-soins': 2,
    conserve: 2, 'pistolet-lourd': 1, 'fusil-pompe': 1, 'veste-cuir': 1,
  }),
  'n2-irradie': table(2, {
    meduse: 3, gouttelette: 3, epine: 2, ressort: 1, 'oeil-de-chat': 1, bouillie: 1, antirad: 3, vodka: 2,
  }),
  'n2-cache': table(2, {
    'pistolet-lourd': 2, 'fusil-pompe': 1, 'veste-cuir': 1, 'combinaison-stalker': 1, ours: 1,
    'trousse-militaire': 1, antirad: 3, gouttelette: 2, ressort: 1, grenade: 2, sac: 1,
  }),

  'n3-commun': table(3, {
    conserve: 4, saucisson: 2, 'trousse-soins': 3, bandage: 2, antirad: 3, 'cartouches-12': [3, 2],
    'munitions-545': 2, munitions: 2, boulons: 3, 'boisson-energetique': 2, grenade: 1,
  }),
  'n3-militaire': table(3, {
    'munitions-545': [5, 2], 'cartouches-12': 3, grenade: 3, 'trousse-militaire': 2, conserve: 2,
    'fusil-assaut': 1, 'combinaison-stalker': 1, ours: 1,
  }),
  'n3-irradie': table(3, {
    gouttelette: 2, 'oeil-de-chat': 2, bouillie: 2, coquille: 2, cristal: 1, flamme: 1,
    'pierre-de-lune': 1, antirad: 4,
  }),
  'n3-cache': table(3, {
    'fusil-assaut': 2, 'combinaison-stalker': 2, ours: 2, 'trousse-militaire': 2, 'pierre-de-lune': 1,
    cristal: 1, coquille: 1, grenade: 2, antirad: 2,
  }),

  'n4-commun': table(4, {
    saucisson: 3, conserve: 3, 'trousse-soins': 3, 'trousse-militaire': 1, antirad: 4,
    'munitions-545': [4, 2], 'cartouches-12': 2, boulons: 2, 'boisson-energetique': 2, grenade: 2,
  }),
  'n4-militaire': table(4, {
    'munitions-545': [5, 2], grenade: 3, 'trousse-militaire': 3, antirad: 2, 'fusil-assaut': 2,
    'fusil-precision': 1, 'combinaison-stalker': 1,
  }),
  'n4-irradie': table(4, {
    cristal: 2, flamme: 2, 'pierre-de-lune': 2, batterie: 2, croute: 1, bulle: 1, ame: 1, antirad: 4,
  }),
  'n4-cache': table(4, {
    'fusil-precision': 2, veles: 1, exosquelette: 1, 'trousse-militaire': 3, 'munitions-545': [3, 2],
    'combinaison-stalker': 2, batterie: 1, bulle: 1, ame: 1, compas: 1, croute: 1,
  }),
});
