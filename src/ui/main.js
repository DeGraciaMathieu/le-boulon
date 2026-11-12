// Point d'entrée de l'interface : tient l'état courant, le dessine, et traduit la souris en actions du moteur.
//
// SOURIS :
//   survol d'un hexagone   aperçu : coût en PA, terrain, lieu, abri, PA restants une fois entré ;
//   clic sur un voisin     { type: 'move', to } ;
//   clic sur le pion       { type: 'exit' } si le pion est sur un hexagone de bord ;
//   clic droit             { type: 'bolt', target } : boulon lancé sur l'hexagone voisin visé.
//
// GRAINE : ?seed=<entier> dans l'adresse, sinon une graine au hasard.

import { createGame, step } from '../engine/game.js';
import agroprom, { calage } from '../engine/data/agroprom.js';
import { entryCost } from '../engine/actions/move.js';
import { mountBoard, renderBoard, reachableHexes, canExit } from './board.js';

const TERRAINS = { route: 'Route', herbe: 'Herbe', foret: 'Forêt', marais: 'Marais', batiment: 'Bâtiment' };

const params = new URLSearchParams(location.search);
const seed = Number.parseInt(params.get('seed'), 10) || crypto.getRandomValues(new Uint32Array(1))[0];

let state = createGame({ seed, tile: agroprom });
const board = mountBoard(document.getElementById('plateau'), { image: 'assets/tuile-agroprom.png', calage });
const preview = document.getElementById('apercu');

function dispatch(action) {
  const result = step(state, action);
  state = result.state;
  renderBoard(board, state);
  return result.events;
}

const hexOf = (event) => Number(event.target.closest('[data-hex]')?.dataset.hex) || null;

function describe(n) {
  const hex = state.tile.hexes[n];
  const lines = [`Hexagone ${n} · ${TERRAINS[hex.terrain]}`];
  if (hex.lieu) lines.push(`${hex.lieu}${hex.abri ? ' · abri' : ''}`);

  if (n === state.player.hex) {
    lines.push(canExit(state) ? 'Clic : sortir de la tuile' : 'Vous êtes ici');
  } else if (reachableHexes(state).includes(n)) {
    const cost = entryCost(hex);
    lines.push(`Coût : ${cost} PA · reste ${state.ap.left - cost} PA`);
  } else {
    lines.push('Hors de portée');
  }
  return lines;
}

function showPreview(event) {
  const n = hexOf(event);
  if (!n) {
    preview.hidden = true;
    return;
  }
  preview.replaceChildren(...describe(n).map((line) => Object.assign(document.createElement('div'), { textContent: line })));
  preview.style.left = `${event.clientX + 16}px`;
  preview.style.top = `${event.clientY + 16}px`;
  preview.hidden = false;
}

board.svg.addEventListener('mousemove', showPreview);
board.svg.addEventListener('mouseleave', () => { preview.hidden = true; });

board.svg.addEventListener('click', (event) => {
  const n = hexOf(event);
  if (!n) return;
  dispatch(n === state.player.hex ? { type: 'exit' } : { type: 'move', to: n });
  showPreview(event);
});

board.svg.addEventListener('contextmenu', (event) => {
  event.preventDefault();
  const n = hexOf(event);
  if (n) dispatch({ type: 'bolt', target: n });
});

renderBoard(board, state);
