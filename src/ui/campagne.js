// Point d'entrée de l'interface v2 (brief v2 §3.2, §16 ; carte 24) : une campagne jouée par
// createCampaign/step de src/engine/campaign.js. Tient la campagne, la dessine (bandeau du haut,
// tuile courante, carte du monde, commandes, journal) et traduit la souris en actions. Lecture
// seule : rien ici ne modifie la campagne.
//
// SOURIS (tuile) :
//   survol d'un hexagone   aperçu : terrain, lieu, coût, sortie de liaison et sa destination ;
//   clic sur un voisin     { type: 'move', to } ;
//   clic sur le pion       { type: 'travel' } si le pion est sur un hexagone de liaison ;
//   clic droit             { type: 'bolt', target }.
//
// ÉCRANS : la tuile, et par-dessus les fenêtres Dialogue (dialogue-window.js, ouverte par
// Parler à… sur l'hexagone d'un PNJ) et Combat v2 en rounds (combat-window.js). La nuit n'a
// que le bouton Se réveiller, en attendant l'écran Réveil et nuit.
//
// GRAINE : ?seed=<entier> dans l'adresse, sinon une graine au hasard.

import { createCampaign, step, dayState } from '../engine/campaign.js';
import { travelTarget } from '../engine/rules/world.js';
import { entryCost } from '../engine/actions/move.js';
import { tokenAt } from '../engine/rules/suspects.js';
import { encounterCards } from '../engine/rules/tile.js';
import content from '../content/index.js';
import { mountBoard, renderBoard, reachableHexes, el } from './board.js';
import { hexCenter } from './geometry.js';
import { describeEvent, ITEM_NAMES } from './journal.js';
import { linkExits, tileQuestMarkers, topBar } from './world-map.js';
import { renderWorld } from './world-view.js';
import { mountDialogue } from './dialogue-window.js';
import { dialogueLine, npcsHere } from './dialogue-screen.js';
import { mountCombat } from './combat-window.js';
import { combatLine } from './combat-screen.js';

const TERRAINS = { route: 'Route', herbe: 'Herbe', foret: 'Forêt', marais: 'Marais', batiment: 'Bâtiment' };
const USABLE = ['bandage', 'vodka', 'ration'];

const tileName = (id) => content.tiles[id].name;
const questName = (id) => content.quests[id]?.name ?? id;

// Lignes du journal pour les événements de campagne ; les autres passent par la v1.
const CAMPAIGN_LINES = {
  traveled: (e) => `Voyage : ${tileName(e.from.tile)} → ${tileName(e.to.tile)} (${e.cost} PA)${e.firstVisit ? ', première visite' : ''}`,
  'encounter-revealed': (e) => {
    const card = encounterCards(content.tiles[campaign.world.currentTile])[e.card];
    return `Rencontre : ${card?.name ?? e.card} (Menace ${card?.threat}) · combat !`;
  },
  'encounters-reset': (e) => `${tileName(e.tile)} : les rencontres ont bougé`,
  'day-ended': () => 'La journée est finie',
  'night-card': (e) => `Carte Nuit : ${e.card}`,
  'night-encounter': () => 'Rencontre de nuit',
  weather: (e) => `Météo : ${e.card}`,
  meal: (e) => `Repas : ${ITEM_NAMES[e.item] ?? e.item}`,
  hunger: (e) => `Faim : ${e.days} jour(s) sans manger`,
  'day-started': (e) => `Jour ${e.day} : ${e.ap} PA`,
  'quest-started': (e) => `Quête : ${questName(e.quest)}`,
  'quest-step': (e) => `Quête ${questName(e.quest)} : nouvelle étape`,
  'quest-completed': (e) => `Quête terminée : ${questName(e.quest)}`,
  'quest-failed': (e) => `Quête ratée : ${questName(e.quest)}`,
};

const REFUSALS = { 'not-a-link': 'pas sur un hexagone de liaison', night: "c'est la nuit : se réveiller d'abord" };

const params = new URLSearchParams(location.search);
const randomSeed = () => crypto.getRandomValues(new Uint32Array(1))[0];

const plateau = document.getElementById('plateau');
const worldSvg = document.getElementById('monde');
const bar = document.getElementById('bandeau');
const commandsPanel = document.getElementById('commandes');
const journal = document.getElementById('journal');
const preview = document.getElementById('apercu');

let campaign;
let board;
let sizes;
let lastEvents = [];

function loadSize(src) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve({ width: image.naturalWidth, height: image.naturalHeight });
    image.onerror = () => reject(new Error(`image introuvable : ${src}`));
    image.src = src;
  });
}

async function loadSizes() {
  const entries = await Promise.all(Object.entries(content.tiles).map(async ([id, tile]) => [id, await loadSize(tile.image)]));
  return Object.fromEntries(entries);
}

function h(tag, attrs = {}, ...children) {
  const node = Object.assign(document.createElement(tag), attrs);
  node.append(...children.filter((child) => child !== null && child !== undefined));
  return node;
}

function render() {
  const day = dayState(campaign);
  if (board?.tileId !== campaign.world.currentTile) mountTile(campaign.world.currentTile);
  renderBoard(board, day);
  renderTileMarks(day);
  renderWorld(worldSvg, campaign, { tiles: content.tiles, sizes });
  renderBar();
  renderCommands(day);
  dialogueWindow.render(campaign);
  combatWindow.render(campaign, lastEvents);
}

function mountTile(id) {
  const tile = content.tiles[id];
  board = mountBoard(plateau, { image: tile.image, calage: tile.calage, ...sizes[id] });
  board.tileId = id;
  board.marks = el('g', { class: 'marques' }, plateau);
  // Le pion reste au-dessus des marques.
  plateau.append(board.pawn);
}

// Tuile v2 : hexagones de liaison étiquetés de leur destination, cibles de quête.
function renderTileMarks(day) {
  const { calage } = board;
  const target = travelTarget(campaign);
  board.marks.replaceChildren();
  for (const exit of linkExits(campaign.world.currentTile)) {
    const { x, y } = hexCenter(exit.hex, calage);
    const group = el('g', { class: 'liaison' }, board.marks);
    const text = el('text', { x, y: y + calage.taille * 0.05, 'text-anchor': 'middle', 'dominant-baseline': 'central' }, group);
    text.textContent = `→ ${exit.name}`;
  }
  for (const polygon of board.grid.children) {
    const n = Number(polygon.dataset.hex);
    const isExit = linkExits(campaign.world.currentTile).some((exit) => exit.hex === n);
    polygon.classList.toggle('liaison', isExit);
    polygon.classList.toggle('sortie', n === campaign.world.hex && Boolean(target) && day.status === 'playing');
  }
  for (const marker of tileQuestMarkers(campaign)) {
    const { x, y } = hexCenter(marker.hex, calage);
    const group = el('g', { class: 'marqueur-quete' }, board.marks);
    const s = calage.taille * 0.18;
    el('path', { d: `M${x + calage.taille * 0.45},${y - s - calage.taille * 0.2} l${s},${s} l${-s},${s} l${-s},${-s} z` }, group);
    el('title', {}, group).textContent = marker.name;
  }
}

function renderBar() {
  const data = topBar(campaign);
  const item = (label, value, cls = '') => h('div', { className: `bandeau-item ${cls}` },
    h('span', { className: 'bandeau-valeur', textContent: value }),
    h('span', { className: 'bandeau-label', textContent: label }));
  bar.replaceChildren(
    item('Jour', data.day),
    item(data.tile, ''),
    item(`PA / ${data.apMax}`, data.ap, 'bandeau-pa'),
    item('Blessures', data.wounds, data.wounds >= 4 ? 'alerte' : ''),
    item('Radiations', data.radiation, data.radiation >= 4 ? 'alerte' : ''),
    item('Faim', data.hunger, data.hunger > 0 ? 'alerte' : ''),
    item('Roubles', data.roubles),
  );
  if (data.emission) bar.append(h('div', { className: 'bandeau-emission', textContent: 'ÉMISSION ANNONCÉE' }));
}

function renderCommands(day) {
  const button = (label, action) => h('button', { type: 'button', textContent: label, onclick: () => dispatch(action) });
  const lines = [];
  if (campaign.screen === 'night') {
    lines.push(h('div', { className: 'alerte', textContent: 'La nuit tombe.' }), button('Se réveiller', { type: 'wake' }));
  } else if (campaign.combat) {
    lines.push(h('div', { className: 'alerte', textContent: 'Combat en cours' }));
  } else if (campaign.dialogue) {
    lines.push(h('div', { className: 'alerte', textContent: 'Dialogue en cours' }));
  } else if (day.status !== 'playing') {
    lines.push(h('div', { className: 'alerte', textContent: day.status === 'dead' ? 'Mort dans la Zone.' : 'Journée finie.' }));
  } else if (day.combat) {
    const card = encounterCards(day.tile)[day.combat.card];
    lines.push(
      h('div', { className: 'alerte', textContent: `Combat : ${card?.name ?? day.combat.card} (Menace ${card?.threat})` }),
      button('Combattre', { type: 'fight' }),
      button('Fuir (2 PA)', { type: 'flee' }),
    );
  } else {
    for (const npc of npcsHere(campaign)) lines.push(button(`Parler à ${npc.name}`, { type: 'talk', npc: npc.id }));
    const token = tokenAt(day, day.player.hex);
    if (token?.revealed && token.kind === 'artefact') lines.push(button('Ramasser (1 PA)', { type: 'pickup' }));
    for (const kind of USABLE) {
      if (campaign.inventory.some((item) => item.kind === kind)) {
        lines.push(button(`Utiliser ${ITEM_NAMES[kind].toLowerCase()} (1 PA)`, { type: 'use', item: kind }));
      }
    }
    const target = travelTarget(campaign);
    if (target) lines.push(button(`Passer à ${tileName(target.tile)} (1 PA)`, { type: 'travel' }));
    lines.push(button('Bivouac', { type: 'camp' }));
    lines.push(h('div', { className: 'aide', textContent: 'Clic : se déplacer · clic sur le pion : voyager · clic droit : boulon' }));
  }
  commandsPanel.replaceChildren(...lines);
}

function describe(event) {
  if (event.type === 'refused' && REFUSALS[event.reason]) return `Refusé : ${REFUSALS[event.reason]}`;
  return CAMPAIGN_LINES[event.type]?.(event) ?? combatLine(event) ?? dialogueLine(event) ?? describeEvent(event);
}

function appendEvents(events) {
  for (const event of events) {
    const text = describe(event);
    if (!text) continue;
    const line = h('li', { textContent: `J${campaign.day} · ${text}` });
    line.dataset.type = event.type;
    journal.append(line);
  }
  journal.scrollTop = journal.scrollHeight;
}

function dispatch(action) {
  const result = step(campaign, action);
  campaign = result.state;
  lastEvents = result.events;
  appendEvents(result.events);
  render();
}

const hexOf = (event) => Number(event.target.closest('[data-hex]')?.dataset.hex) || null;

function describeHex(n) {
  const day = dayState(campaign);
  const hex = day.tile.hexes[n];
  const lines = [`Hexagone ${n} · ${TERRAINS[hex.terrain]}`];
  if (hex.lieu) lines.push(`${hex.lieu}${hex.abri ? ' · abri' : ''}`);
  const exit = linkExits(campaign.world.currentTile).find((link) => link.hex === n);
  if (exit) lines.push(`Liaison vers ${exit.name} (1 PA)`);
  for (const marker of tileQuestMarkers(campaign).filter((m) => m.hex === n)) lines.push(`Quête : ${marker.name}`);

  if (n === campaign.world.hex) {
    lines.push(exit ? 'Clic : voyager' : 'Vous êtes ici');
  } else if (reachableHexes(day).includes(n)) {
    const cost = entryCost(hex);
    lines.push(`Coût : ${cost} PA · reste ${day.ap.left - cost} PA`);
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
  preview.replaceChildren(...describeHex(n).map((line) => h('div', { textContent: line })));
  preview.style.left = `${event.clientX + 16}px`;
  preview.style.top = `${event.clientY + 16}px`;
  preview.hidden = false;
}

plateau.addEventListener('mousemove', showPreview);
plateau.addEventListener('mouseleave', () => { preview.hidden = true; });

plateau.addEventListener('click', (event) => {
  const n = hexOf(event);
  if (!n) return;
  dispatch(n === campaign.world.hex ? { type: 'travel' } : { type: 'move', to: n });
  showPreview(event);
});

plateau.addEventListener('contextmenu', (event) => {
  event.preventDefault();
  const n = hexOf(event);
  if (n) dispatch({ type: 'bolt', target: n });
});

function start(seed) {
  campaign = createCampaign({ seed });
  lastEvents = [];
  history.replaceState(null, '', `?seed=${seed}`);
  journal.replaceChildren();
  board = null;
  render();
}

const dialogueWindow = mountDialogue({ onChoose: dispatch });
const combatWindow = mountCombat({ onAction: dispatch });

document.getElementById('nouvelle').addEventListener('click', () => start(randomSeed()));

sizes = await loadSizes();
start(Number.parseInt(params.get('seed'), 10) || randomSeed());
