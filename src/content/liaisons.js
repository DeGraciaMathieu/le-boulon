// Liaisons entre tuiles (brief v2 §3.2) : sortir par l'hexagone de bord `hex` d'une tuile
// mène à l'hexagone de bord `hex` de la tuile voisine. Chaque liaison est écrite des deux
// côtés (format en tête de src/content/validate.js).
//
// Hexagones choisis sur les images, sur une route visible quand il y en a une :
//   cordon 19 (route du nord)            <-> decharge 13 (КПП, route du sud)
//   cordon 15 (route de l'ouest)         <-> marais 11 (chemin du Хутір)
//   marais 19 (route du nord)            <-> agroprom 14 (entrée sud de la v1, sans route)
//   agroprom 9 (chemin de l'est)         <-> decharge 17 (chemin du nord-ouest)
//   decharge 9 (piste de l'est)          <-> vallee-sombre 15 (route de l'ouest)
//   decharge 19 (Блокпост, route nord)   <-> rostok 13 (Barrière du Devoir, route du sud)
//   rostok 8 (voie du nord)              <-> entrepots 13 (piste du sud)

import { deepFreeze } from './freeze.js';

const PAIRS = [
  ['cordon', 19, 'decharge', 13],
  ['cordon', 15, 'marais', 11],
  ['marais', 19, 'agroprom', 14],
  ['agroprom', 9, 'decharge', 17],
  ['decharge', 9, 'vallee-sombre', 15],
  ['decharge', 19, 'rostok', 13],
  ['rostok', 8, 'entrepots', 13],
];

const links = {};
for (const [a, hexA, b, hexB] of PAIRS) {
  (links[a] ??= {})[hexA] = { tile: b, hex: hexB };
  (links[b] ??= {})[hexB] = { tile: a, hex: hexA };
}

export default deepFreeze(links);
