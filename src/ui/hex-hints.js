// Textes du plateau sans numéro d'hexagone (les numéros ne sont pas dessinés sur la tuile) :
// position sur la tuile, direction d'un pas, avertissements de l'infobulle. Fonctions pures.
//
//   tileArea(n)             'centre' | '<direction>' (cœur) | 'bord <direction>' (anneau extérieur)
//   towards(from, to)       'vers le nord-est', "vers l'ouest"… direction de to vu depuis from
//   hexWarnings(state, n)   lignes d'alerte de l'infobulle pour l'hexagone n (état d'une journée)

import { distance, neighbors } from '../engine/hex.js';
import { tokenAt } from '../engine/rules/suspects.js';
import { hexCenter } from './geometry.js';

// Huit secteurs de 45°, dans le sens trigonométrique depuis l'est.
const COMPASS = ['est', 'nord-est', 'nord', 'nord-ouest', 'ouest', 'sud-ouest', 'sud', 'sud-est'];
const UNIT = { cx: 0, cy: 0, taille: 1 };

function compass(from, to) {
  const a = hexCenter(from, UNIT);
  const b = hexCenter(to, UNIT);
  // L'axe y du plateau descend : on l'inverse pour un angle trigonométrique.
  const angle = Math.atan2(a.y - b.y, b.x - a.x);
  const sector = Math.round(angle / (Math.PI / 4));
  return COMPASS[(sector + COMPASS.length) % COMPASS.length];
}

export function tileArea(n) {
  const ring = distance(1, n);
  if (ring === 0) return 'centre';
  const direction = compass(1, n);
  return ring === 1 ? direction : `bord ${direction}`;
}

export function towards(from, to) {
  const direction = compass(from, to);
  return /^[aeiou]/.test(direction) ? `vers l'${direction}` : `vers le ${direction}`;
}

// Entrer sur n ou à côté d'une rencontre lance un test de Discrétion (rules/encounters.js),
// +1 en forêt ; un jeton caché se révèle au boulon depuis un hexagone voisin.
export function hexWarnings(state, n) {
  if (n === state.player.hex) return [];
  const lines = [];
  const nearEncounter = (state.encounters ?? []).some((encounter) => distance(n, encounter.hex) <= 1);
  if (nearEncounter) {
    const forest = state.tile.hexes[n].terrain === 'foret';
    lines.push(`Rencontre voisine : test de Discrétion${forest ? ' (+1 en forêt)' : ''}`);
  }
  const token = tokenAt(state, n);
  if (token && !token.revealed) {
    lines.push(neighbors(state.player.hex).includes(n) ? 'Jeton inconnu : boulon conseillé' : 'Jeton inconnu');
  }
  return lines;
}
