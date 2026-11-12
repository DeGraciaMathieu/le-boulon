// Point d'entrée de l'interface : tient l'état courant, le dessine (plateau, panneau, journal,
// écran de fin) et traduit la souris et les boutons en actions du moteur.
//
// SOURIS :
//   survol d'un hexagone   aperçu : coût en PA, terrain, lieu, abri, PA restants une fois entré ;
//   clic sur un voisin     { type: 'move', to } ;
//   clic sur le pion       { type: 'exit' } si le pion est sur un hexagone de bord ;
//   clic droit             { type: 'bolt', target } : boulon lancé sur l'hexagone voisin visé.
//
// RETOURS : après chaque rendu, fx.js anime les événements de l'action (boulon, anomalie,
// carte Zone, Émission).
// PANNEAU : boutons Combattre, Fuir, Ramasser, Utiliser, Sortir selon l'état (panel.js).
// FIN : Rejouer relance la même graine, Nouvelle partie en tire une autre (reportée dans l'adresse).
//
// GRAINE : ?seed=<entier> dans l'adresse, sinon une graine au hasard.

import { createGame, step } from '../engine/game.js';
import agroprom, { calage } from '../engine/data/agroprom.js';
import { entryCost } from '../engine/actions/move.js';
import { missionAssigned } from '../engine/rules/mission.js';
import { mountBoard, renderBoard, reachableHexes, canExit } from './board.js';
import { renderPanel } from './panel.js';
import { appendEvents, CAUSE_NAMES } from './journal.js';
import { playEffects, renderEmission, resetEffects } from './fx.js';

const TERRAINS = { route: 'Route', herbe: 'Herbe', foret: 'Forêt', marais: 'Marais', batiment: 'Bâtiment' };

const params = new URLSearchParams(location.search);
const randomSeed = () => crypto.getRandomValues(new Uint32Array(1))[0];

let state;
const board = mountBoard(document.getElementById('plateau'), { image: 'assets/tuile-agroprom.png', calage });
const panel = document.getElementById('panneau');
const journal = document.getElementById('journal');
const preview = document.getElementById('apercu');
const endScreen = document.getElementById('fin');

function render() {
  renderBoard(board, state);
  renderPanel(panel, state, dispatch);
  renderEmission(state);
  renderEnd();
}

function renderEnd() {
  const { outcome } = state;
  endScreen.hidden = !outcome;
  if (!outcome) return;
  document.getElementById('fin-titre').textContent = outcome.result === 'win' ? 'Victoire' : 'Défaite';
  document.getElementById('fin-cause').textContent = CAUSE_NAMES[outcome.cause] ?? outcome.cause;
  document.getElementById('fin-score').textContent = `Score : ${outcome.score} roubles`;
  document.getElementById('fin-graine').textContent = `Graine : ${state.seed}`;
}

function start(seed) {
  state = createGame({ seed, tile: agroprom });
  history.replaceState(null, '', `?seed=${seed}`);
  journal.replaceChildren();
  resetEffects(board);
  appendEvents(journal, [missionAssigned(state)]);
  render();
}

function dispatch(action) {
  const result = step(state, action);
  state = result.state;
  appendEvents(journal, result.events);
  render();
  playEffects(board, result.events, state);
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

document.getElementById('rejouer').addEventListener('click', () => start(state.seed));
document.getElementById('nouvelle').addEventListener('click', () => start(randomSeed()));

start(Number.parseInt(params.get('seed'), 10) || randomSeed());
