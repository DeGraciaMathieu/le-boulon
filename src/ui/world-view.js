// Carte du monde (brief v2 §3.2) : vue réduite des 7 tuiles, liaisons, position du joueur,
// tuiles jamais visitées grisées, marqueurs de quête. Lecture seule, comme board.js : elle sert
// à se repérer, aucun clic n'y envoie d'action.

import { el } from './board.js';
import { hexCenter } from './geometry.js';
import { worldMap } from './world-map.js';

const CELL_WIDTH = 120;
const CELL_HEIGHT = 110;
const GAP = 14;
const COLUMNS = 3;
const ROWS = 4;
const LABEL_HEIGHT = 14;

const cellOrigin = ({ col, row }) => ({
  x: GAP + col * (CELL_WIDTH + GAP),
  y: GAP + row * (CELL_HEIGHT + LABEL_HEIGHT + GAP),
});

// Point de l'image (en pixels) ramené dans la case de la tuile.
function toCell(cell, point, size) {
  const origin = cellOrigin(cell);
  return { x: origin.x + (point.x / size.width) * CELL_WIDTH, y: origin.y + (point.y / size.height) * CELL_HEIGHT };
}

// tiles : content.tiles ; sizes : { [id]: { width, height } } des images, lues au chargement.
export function renderWorld(svg, campaign, { tiles, sizes }) {
  const map = worldMap(campaign);
  const cells = Object.fromEntries(map.tiles.map((tile) => [tile.id, tile]));
  svg.setAttribute('viewBox', `0 0 ${GAP + COLUMNS * (CELL_WIDTH + GAP)} ${GAP + ROWS * (CELL_HEIGHT + LABEL_HEIGHT + GAP)}`);
  svg.replaceChildren();

  const links = el('g', { class: 'liaisons' }, svg);
  for (const [a, b] of map.links) {
    const from = centerOf(cells[a]);
    const to = centerOf(cells[b]);
    el('line', { x1: from.x, y1: from.y, x2: to.x, y2: to.y }, links);
  }

  for (const tile of map.tiles) {
    const { x, y } = cellOrigin(tile);
    const group = el('g', { class: `tuile-monde${tile.known ? ' connue' : ' inconnue'}${tile.current ? ' courante' : ''}`, 'data-tile': tile.id }, svg);
    el('image', { href: tiles[tile.id].image, x, y, width: CELL_WIDTH, height: CELL_HEIGHT, preserveAspectRatio: 'none' }, group);
    el('rect', { class: 'cadre', x, y, width: CELL_WIDTH, height: CELL_HEIGHT }, group);
    const name = el('text', { x: x + CELL_WIDTH / 2, y: y + CELL_HEIGHT + LABEL_HEIGHT - 3, 'text-anchor': 'middle' }, group);
    name.textContent = tile.name;
    el('title', {}, group).textContent = tile.known ? `${tile.name} (${tile.label})` : `${tile.name} : jamais visitée`;
  }

  const markers = el('g', { class: 'marqueurs-quete' }, svg);
  const unplaced = {};
  for (const marker of map.markers) {
    const cell = cells[marker.tile];
    let point;
    if (marker.hex) {
      point = toCell(cell, hexCenter(marker.hex, tiles[marker.tile].calage), sizes[marker.tile]);
    } else {
      // Cible sans hexagone : coin haut droit de la case, un losange par quête.
      const index = unplaced[marker.tile] = (unplaced[marker.tile] ?? -1) + 1;
      const origin = cellOrigin(cell);
      point = { x: origin.x + CELL_WIDTH - 10 - index * 14, y: origin.y + 10 };
    }
    const group = el('g', { class: 'marqueur-quete' }, markers);
    el('path', { d: `M${point.x},${point.y - 7} l7,7 l-7,7 l-7,-7 z` }, group);
    el('title', {}, group).textContent = marker.name;
  }

  const current = cells[campaign.world.currentTile];
  const here = toCell(current, hexCenter(campaign.world.hex, tiles[current.id].calage), sizes[current.id]);
  el('circle', { class: 'pion-monde', cx: here.x, cy: here.y, r: 5 }, svg);
}

function centerOf(cell) {
  const { x, y } = cellOrigin(cell);
  return { x: x + CELL_WIDTH / 2, y: y + CELL_HEIGHT / 2 };
}
