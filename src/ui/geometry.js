// Géométrie du plateau en pixels de l'image de la tuile (sommet pointu, voir src/engine/hex.js).

import { toAxial } from '../engine/hex.js';

// Centre de l'hexagone n d'après le calage { cx, cy, taille } de la tuile.
export function hexCenter(n, { cx, cy, taille }) {
  const { q, r } = toAxial(n);
  return {
    x: cx + Math.sqrt(3) * taille * (q + r / 2),
    y: cy + 1.5 * taille * r,
  };
}

// Les 6 sommets de l'hexagone n, en partant du sommet du haut, au format de l'attribut points.
export function hexPoints(n, calage) {
  const { x, y } = hexCenter(n, calage);
  return Array.from({ length: 6 }, (_, i) => {
    const angle = (Math.PI / 3) * i - Math.PI / 2;
    const px = x + calage.taille * Math.cos(angle);
    const py = y + calage.taille * Math.sin(angle);
    return `${px.toFixed(1)},${py.toFixed(1)}`;
  }).join(' ');
}
