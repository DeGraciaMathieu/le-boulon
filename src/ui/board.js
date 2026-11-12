// Dessin du plateau SVG : tuile en fond, grille calée, jetons, pion.
// Lecture seule : ce module ne modifie jamais l'état, il le dessine.
//
// COUCHES (dans l'ordre, de bas en haut) :
//   fond    l'image de la tuile ;
//   grille  un polygone transparent par hexagone, data-hex = numéro ;
//   jetons  les jetons suspects (cachés ou révélés) et les rencontres ;
//   fx      les traces passagères des retours visuels (fx.js) ;
//   pion    le joueur.

import { HEXES, neighbors, isEdge } from '../engine/hex.js';
import { entryCost } from '../engine/actions/move.js';
import { encounterCards } from '../engine/rules/tile.js';
import { isBlocked } from '../engine/rules/suspects.js';
import { hexCenter, hexPoints } from './geometry.js';

const SVG_NS = 'http://www.w3.org/2000/svg';
const TILE_WIDTH = 735;
const TILE_HEIGHT = 679;

export function el(name, attrs = {}, parent) {
  const node = document.createElementNS(SVG_NS, name);
  for (const [attr, value] of Object.entries(attrs)) node.setAttribute(attr, value);
  if (parent) parent.append(node);
  return node;
}

// Prépare le <svg> une fois pour toutes et rend ses couches. width et height : taille de
// l'image en pixels (les tuiles v2 ne font pas toutes la même, brief v2 §3.1).
export function mountBoard(svg, { image, calage, width = TILE_WIDTH, height = TILE_HEIGHT }) {
  svg.setAttribute('viewBox', `0 0 ${width} ${height}`);
  svg.replaceChildren();
  el('image', { href: image, width, height }, svg);

  const grid = el('g', { class: 'grille' }, svg);
  for (const { n } of HEXES) el('polygon', { class: 'hex', 'data-hex': n, points: hexPoints(n, calage) }, grid);

  const tokens = el('g', { class: 'jetons' }, svg);
  const fx = el('g', { class: 'fx' }, svg);
  const pawn = el('circle', { class: 'pion', r: calage.taille * 0.28 }, svg);
  return { svg, grid, tokens, fx, pawn, calage };
}

// Voisins où le joueur peut entrer avec les PA qui lui restent : ni combat en cours, ni anomalie révélée.
export function reachableHexes(state) {
  if (state.status !== 'playing' || state.combat) return [];
  return neighbors(state.player.hex)
    .filter((n) => entryCost(state.tile.hexes[n]) <= state.ap.left && !isBlocked(state, n));
}

// Sortie possible : partie en cours, hors combat, pion sur un hexagone de bord.
export function canExit(state) {
  return state.status === 'playing' && !state.combat && isEdge(state.player.hex);
}

// Pendant une Émission en cours, les abris portent la classe abri.
export function renderBoard(board, state) {
  const reachable = reachableHexes(state);
  const shelters = Boolean(state.zone?.emission) && state.status === 'playing';
  for (const polygon of board.grid.children) {
    const n = Number(polygon.dataset.hex);
    const here = n === state.player.hex;
    polygon.classList.toggle('atteignable', reachable.includes(n));
    polygon.classList.toggle('joueur', here);
    polygon.classList.toggle('sortie', here && canExit(state));
    polygon.classList.toggle('abri', shelters && Boolean(state.tile.hexes[n].abri));
  }
  renderTokens(board, state);

  const { x, y } = hexCenter(state.player.hex, board.calage);
  board.pawn.setAttribute('cx', x);
  board.pawn.setAttribute('cy', y);
  board.svg.dataset.status = state.status;
}

// Jetons suspects en haut de l'hexagone, rencontres en bas : les deux peuvent partager une case.
//   suspect caché  carré « ? »            révélé  type lisible, anomalie bloquante marquée ✕
//   rencontre      rond « ! » si cachée, nom de la carte une fois révélée
function renderTokens(board, state) {
  board.tokens.replaceChildren();
  const size = board.calage.taille * 0.42;
  for (const token of state.tokens ?? []) {
    const { x, y } = hexCenter(token.hex, board.calage);
    const kind = token.revealed ? token.kind : 'cache';
    const group = el('g', { class: `jeton suspect ${kind}`, 'data-hex': token.hex }, board.tokens);
    el('rect', { x: x - size / 2, y: y - board.calage.taille * 0.62, width: size, height: size, rx: 5 }, group);
    label(group, x, y - board.calage.taille * 0.62 + size / 2, SUSPECT_LABELS[token.revealed ? (token.anomaly ?? token.kind) : 'cache']);
    if (token.revealed && token.kind === 'anomalie') {
      label(group, x, y - board.calage.taille * 0.62 - 10, 'BLOQUÉ', 'bloque');
    }
  }
  for (const encounter of state.encounters ?? []) {
    const { x, y } = hexCenter(encounter.hex, board.calage);
    const revealed = encounter.card !== null;
    const group = el('g', { class: `jeton rencontre${revealed ? ' revelee' : ''}` }, board.tokens);
    el('circle', { cx: x, cy: y + board.calage.taille * 0.48, r: size * 0.5 }, group);
    label(group, x, y + board.calage.taille * 0.48, revealed ? encounterCards(state.tile)[encounter.card].name.split(' ')[0] : '!');
  }
}

const SUSPECT_LABELS = {
  cache: '?', artefact: 'ART', rien: '—', electro: 'ÉLEC', gravitationnelle: 'GRAV', bruleuse: 'BRÛL',
};

function label(parent, x, y, text, cls = '') {
  const node = el('text', { x, y, class: cls, 'text-anchor': 'middle', 'dominant-baseline': 'central' }, parent);
  node.textContent = text;
}
