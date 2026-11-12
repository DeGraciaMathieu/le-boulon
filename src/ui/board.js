// Dessin du plateau SVG : tuile en fond, grille calée, jetons face cachée, pion.
// Lecture seule : ce module ne modifie jamais l'état, il le dessine.
//
// COUCHES (dans l'ordre, de bas en haut) :
//   fond    l'image de la tuile ;
//   grille  un polygone transparent par hexagone, data-hex = numéro ;
//   jetons  les jetons face cachée de state.tokens et state.encounters ;
//   pion    le joueur.

import { HEXES, neighbors, isEdge } from '../engine/hex.js';
import { entryCost } from '../engine/actions/move.js';
import { hexCenter, hexPoints } from './geometry.js';

const SVG_NS = 'http://www.w3.org/2000/svg';
const TILE_WIDTH = 735;
const TILE_HEIGHT = 679;

function el(name, attrs = {}, parent) {
  const node = document.createElementNS(SVG_NS, name);
  for (const [attr, value] of Object.entries(attrs)) node.setAttribute(attr, value);
  if (parent) parent.append(node);
  return node;
}

// Prépare le <svg> une fois pour toutes et rend ses couches.
export function mountBoard(svg, { image, calage }) {
  svg.setAttribute('viewBox', `0 0 ${TILE_WIDTH} ${TILE_HEIGHT}`);
  svg.replaceChildren();
  el('image', { href: image, width: TILE_WIDTH, height: TILE_HEIGHT }, svg);

  const grid = el('g', { class: 'grille' }, svg);
  for (const { n } of HEXES) el('polygon', { class: 'hex', 'data-hex': n, points: hexPoints(n, calage) }, grid);

  const tokens = el('g', { class: 'jetons' }, svg);
  const pawn = el('circle', { class: 'pion', r: calage.taille * 0.28 }, svg);
  return { svg, grid, tokens, pawn, calage };
}

// Voisins où le joueur peut entrer avec les PA qui lui restent.
export function reachableHexes(state) {
  if (state.status !== 'playing') return [];
  return neighbors(state.player.hex)
    .filter((n) => entryCost(state.tile.hexes[n]) <= state.ap.left);
}

// Sortie possible : partie en cours et pion sur un hexagone de bord.
export function canExit(state) {
  return state.status === 'playing' && isEdge(state.player.hex);
}

export function renderBoard(board, state) {
  const reachable = reachableHexes(state);
  for (const polygon of board.grid.children) {
    const n = Number(polygon.dataset.hex);
    const here = n === state.player.hex;
    polygon.classList.toggle('atteignable', reachable.includes(n));
    polygon.classList.toggle('joueur', here);
    polygon.classList.toggle('sortie', here && canExit(state));
  }
  renderTokens(board, state);

  const { x, y } = hexCenter(state.player.hex, board.calage);
  board.pawn.setAttribute('cx', x);
  board.pawn.setAttribute('cy', y);
  board.svg.dataset.status = state.status;
}

// Forme supposée tant que les jetons n'existent pas dans le moteur : { hex, revealed? }.
// Un jeton révélé n'est plus face cachée : il n'est pas dessiné ici.
function renderTokens(board, state) {
  const hidden = [...(state.tokens ?? []), ...(state.encounters ?? [])]
    .filter((token) => Number.isInteger(token?.hex) && !token.revealed);
  board.tokens.replaceChildren();
  const size = board.calage.taille * 0.36;
  for (const token of hidden) {
    const { x, y } = hexCenter(token.hex, board.calage);
    el('rect', {
      class: 'jeton', x: x - size / 2, y: y - board.calage.taille * 0.55, width: size, height: size, rx: 4,
    }, board.tokens);
  }
}
