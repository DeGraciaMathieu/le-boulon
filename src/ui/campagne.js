// Point d'entrée de l'interface v2 (brief v2 §3.2, §16 ; carte 24) : une campagne jouée par
// createCampaign/step de src/engine/campaign.js. Tient la campagne, la dessine (bandeau du haut,
// tuile courante, carte du monde, commandes, journal) et traduit la souris en actions. Lecture
// seule : rien ici ne modifie la campagne.
//
// SOURIS (tuile) :
//   survol d'un hexagone   aperçu : terrain, lieu, coût, sortie de liaison et sa destination ;
//   clic sur un voisin     { type: 'move', to } ;
//   clic sur le pion       { type: 'enter-place', place } si le pion est sur un lieu explorable,
//                          sinon { type: 'travel' } (hexagone de liaison) ;
//   clic droit             { type: 'bolt', target } ;
//   bouton Boulon          mode ciblage : les voisins s'allument, clic sur l'un d'eux = boulon,
//                          ailleurs ou Échap = annuler.
//
// ÉCRANS : la tuile, le lieu (place-view.js, carte 25) et l'écran Hub de hub-view.js à la
// place du plateau pendant une visite ; par-dessus, les fenêtres Dialogue (dialogue-window.js,
// ouverte par Parler à… sur l'hexagone d'un PNJ), Combat v2 en rounds (combat-window.js),
// PDA (pda-view.js) et Inventaire (inventory-view.js). Couche #ecran
// (cycle-view.js, carte 29), par priorité : titre, mort (imposée par la campagne), fin de
// campagne, nuit (imposée), fin de journée (bouton Finir la journée), rapport du réveil.
//
// SAUVEGARDE (storage.js) : autosave à chaque day-started ; emplacements 1 à 3 dans un hub ;
// export à tout moment ; en hardcore, la mort efface les sauvegardes de la campagne.
//
// RETOURS VISUELS (effets-view.js, carte 32) : joués après chaque rendu, à partir des événements
// du step ; l'ambiance d'Émission suit la campagne à chaque rendu.
//
// DÉMARRAGE : écran titre ; ?seed=<entier> dans l'adresse lance tout de suite une partie normale.

import { createCampaign, step, dayState } from '../engine/campaign.js';
import { travelTarget } from '../engine/rules/world.js';
import { entryCost } from '../engine/actions/move.js';
import { tokenAt, BOLT_COST } from '../engine/rules/suspects.js';
import { countCharges } from '../engine/rules/sheet.js';
import { encounterCards } from '../engine/rules/tile.js';
import content from '../content/index.js';
import { mountBoard, renderBoard, reachableHexes, boltTargets, el } from './board.js';
import { hexWarnings } from './hex-hints.js';
import { hexCenter } from './geometry.js';
import { describeEvent, ITEM_NAMES } from './journal.js';
import { linkExits, tileQuestMarkers, topBar } from './world-map.js';
import { renderWorld } from './world-view.js';
import { renderHub, HUB_LINES, HUB_REFUSALS } from './hub-view.js';
import { hubAt } from '../engine/rules/hubs.js';
import { PLACE_LINES, placeEntry, tilePlaces } from './place.js';
import { renderPlace, renderPlaceMarks } from './place-view.js';
import { mountDialogue } from './dialogue-window.js';
import { dialogueLine, npcsHere } from './dialogue-screen.js';
import { mountCombat } from './combat-window.js';
import { combatLine } from './combat-screen.js';
import { mountPda } from './pda-view.js';
import { mountInventory } from './inventory-view.js';
import { PDA_LINES } from './pda.js';
import { INVENTORY_LINES } from './inventory.js';
import { deathView } from '../engine/rules/death.js';
import { canManualSave } from '../engine/rules/save.js';
import { saves, MANUAL_SLOTS } from './storage.js';
import { parseSeed, titleSlots, campPreview, nightView, wakeReport, daySummary, endingView } from './cycle.js';
import { mountEffects } from './effets-view.js';
import { renderTitle, renderCamp, renderNight, renderWake, renderDeath, renderEnding } from './cycle-view.js';

const TERRAINS = { route: 'Route', herbe: 'Herbe', foret: 'Forêt', marais: 'Marais', batiment: 'Bâtiment' };
const USABLE = ['bandage', 'vodka', 'ration'];

const tileName = (id) => content.tiles[id].name;
// Un contrat est une quête générée : son nom est dans la campagne (rules/contracts.js).
const questName = (id) => content.quests[id]?.name ?? campaign.quests[id]?.quest?.name ?? id;

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
  respawned: (e) => `Réveil au ${content.places[e.hub].name} : inventaire perdu, XP ${e.xp.before} → ${e.xp.after}`,
  ...HUB_LINES,
  ...PLACE_LINES,
  ...PDA_LINES,
  ...INVENTORY_LINES,
};

const REFUSALS = {
  ...HUB_REFUSALS,
  'not-a-link': 'pas sur un hexagone de liaison',
  night: "c'est la nuit : se réveiller d'abord",
  'in-place': "dans un lieu : le quitter d'abord",
  'place-occupied': 'lieu occupé : combattre, se faufiler ou payer',
  'not-enough-roubles': 'pas assez de roubles',
  'not-enough-ap': 'pas assez de PA',
  'no-bolt': 'plus de boulons',
  fog: 'brouillard : le boulon ne sert à rien',
};

const params = new URLSearchParams(location.search);
const randomSeed = () => crypto.getRandomValues(new Uint32Array(1))[0];

const plateau = document.getElementById('plateau');
const hubSection = document.getElementById('hub');
const worldSvg = document.getElementById('monde');
const bar = document.getElementById('bandeau');
const commandsPanel = document.getElementById('commandes');
const savePanel = document.getElementById('sauvegarde');
const layerSection = document.getElementById('ecran');
const journal = document.getElementById('journal');
const preview = document.getElementById('apercu');
const table = document.getElementById('table');
const placeSection = document.getElementById('lieu');
const pda = mountPda(document.getElementById('pda'), document.getElementById('ouvrir-pda'), {
  dispatch,
  drawWorld: (svg, current) => renderWorld(svg, current, { tiles: content.tiles, sizes }),
});
const effects = mountEffects({ plateau, place: placeSection, layer: layerSection });
const inventory = mountInventory(document.getElementById('inventaire'), document.getElementById('ouvrir-inventaire'), { dispatch });

let campaign;
let board;
let sizes;
let lastEvents = [];
// Écran de la couche choisi par l'interface : { kind: 'title', error? } | { kind: 'camp' }
// | { kind: 'wake', report } | { kind: 'ending' } ; la nuit et la mort viennent de la campagne.
let layer = null;
// Événements depuis le dernier réveil : le résumé de la journée à l'écran nuit.
let dayEvents = [];
let deathCause = null;
// Mode ciblage du bouton Boulon : le prochain clic sur un voisin lance le boulon.
let targeting = false;

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
  if (campaign) renderTable();
  renderLayer();
}

function renderTable() {
  const day = dayState(campaign);
  if (board?.tileId !== campaign.world.currentTile) mountTile(campaign.world.currentTile);
  renderBoard(board, day, { targeting });
  renderTileMarks(day);
  renderPlaceMarks(board, campaign);
  table.dataset.screen = campaign.screen;
  const tile = content.tiles[campaign.world.currentTile];
  renderPlace(placeSection, campaign, { tile, size: sizes[campaign.world.currentTile], dispatch });
  renderWorld(worldSvg, campaign, { tiles: content.tiles, sizes });
  renderBar();
  renderCommands(day);
  renderSaves();
  const inHub = campaign.screen === 'hub';
  plateau.hidden = inHub;
  hubSection.hidden = !inHub;
  if (inHub) renderHub(hubSection, campaign, { dispatch, refresh: render });
  dialogueWindow.render(campaign);
  combatWindow.render(campaign, lastEvents);
  pda.render(campaign);
  inventory.render(campaign);
  effects.ambience(campaign);
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
    lines.push(h('div', { className: 'alerte', textContent: 'La nuit tombe.' }));
  } else if (campaign.combat) {
    lines.push(h('div', { className: 'alerte', textContent: 'Combat en cours' }));
  } else if (campaign.dialogue) {
    lines.push(h('div', { className: 'alerte', textContent: 'Dialogue en cours' }));
  } else if (campaign.screen === 'hub') {
    lines.push(h('div', { className: 'aide', textContent: 'Dans le hub : onglets à gauche' }));
  } else if (day.status !== 'playing') {
    lines.push(h('div', { className: 'alerte', textContent: day.status === 'dead' ? 'Mort dans la Zone.' : 'Journée finie.' }));
  } else if (day.combat) {
    const card = encounterCards(day.tile)[day.combat.card];
    lines.push(
      h('div', { className: 'alerte', textContent: `Combat : ${card?.name ?? day.combat.card} (Menace ${card?.threat})` }),
      button('Combattre', { type: 'fight' }),
      button('Fuir (2 PA)', { type: 'flee' }),
    );
  } else if (campaign.screen === 'place') {
    lines.push(...useButtons(button));
  } else {
    const entry = placeEntry(campaign);
    if (entry && !entry.occupied) lines.push(button(`Entrer : ${entry.name}`, { type: 'enter-place', place: entry.id }));
    for (const option of entry?.options ?? []) {
      const enter = button(`${entry.name} : ${option.label}`, { type: 'enter-place', place: entry.id, approach: option.approach });
      enter.disabled = !option.enabled;
      lines.push(enter);
    }
    for (const npc of npcsHere(campaign)) lines.push(button(`Parler à ${npc.name}`, { type: 'talk', npc: npc.id }));
    const token = tokenAt(day, day.player.hex);
    if (token?.revealed && token.kind === 'artefact') lines.push(button('Ramasser (1 PA)', { type: 'pickup' }));
    lines.push(boltButton(day));
    lines.push(...useButtons(button));
    const target = travelTarget(campaign);
    if (target) lines.push(button(`Passer à ${tileName(target.tile)} (1 PA)`, { type: 'travel' }));
    const hub = hubAt(campaign);
    if (hub) lines.push(button(`Entrer : ${content.places[hub].name}`, { type: 'enter-hub' }));
    lines.push(h('button', { type: 'button', id: 'finir', textContent: 'Finir la journée', onclick: () => showLayer({ kind: 'camp' }) }));
    const help = targeting
      ? 'Boulon : cliquez un hexagone voisin · Échap : annuler'
      : 'Clic : se déplacer · clic sur le pion : entrer dans le lieu ou voyager · clic droit : boulon';
    lines.push(h('div', { className: 'aide', textContent: help }));
  }
  commandsPanel.replaceChildren(...lines);
}

// Bouton Boulon : bascule le mode ciblage ; grisé sans boulon ou sans PA.
function boltButton(day) {
  const count = countCharges(day.inventory, 'boulons');
  const label = targeting ? 'Annuler le boulon' : `Boulon (${BOLT_COST} PA) · ${count} restant${count > 1 ? 's' : ''}`;
  const node = h('button', { type: 'button', className: `boulon${targeting ? ' actif' : ''}`, textContent: label, onclick: () => setTargeting(!targeting) });
  node.disabled = !targeting && (count === 0 || day.ap.left < BOLT_COST);
  return node;
}

function setTargeting(next) {
  targeting = next;
  render();
}

function useButtons(button) {
  return USABLE.filter((kind) => campaign.inventory.some((item) => item.kind === kind))
    .map((kind) => button(`Utiliser ${ITEM_NAMES[kind].toLowerCase()} (1 PA)`, { type: 'use', item: kind }));
}

function renderSaves() {
  const lines = [h('button', { type: 'button', textContent: 'Exporter (JSON)', onclick: () => report(saves.exportFile(campaign), 'Sauvegarde exportée') })];
  if (canManualSave(campaign)) {
    lines.push(h('div', { className: 'aide', textContent: 'Sauvegarder dans un emplacement :' }));
    for (const slot of MANUAL_SLOTS) {
      lines.push(h('button', { type: 'button', textContent: `Emplacement ${slot}`, onclick: () => report(saves.saveSlot(slot, campaign), `Sauvegarde : emplacement ${slot}`) }));
    }
  }
  savePanel.replaceChildren(...lines);
}

function report(result, success) {
  appendLine(result.ok ? success : `Refusé : ${result.error}`, 'save');
}

function renderLayer() {
  const show = chooseLayer();
  layerSection.hidden = !show;
  if (show) show();
}

function chooseLayer() {
  if (layer?.kind === 'title') return () => renderTitle(layerSection, { slots: titleSlots(saves.list()), error: layer.error }, titleHandlers);
  const death = deathView(campaign);
  if (death) return () => renderDeath(layerSection, death, deathCause, { respawn: () => dispatch({ type: 'respawn' }), title: () => showLayer({ kind: 'title' }) });
  if (layer?.kind === 'ending') return () => renderEnding(layerSection, endingView(campaign), { close: () => showLayer(null), title: () => showLayer({ kind: 'title' }) });
  const night = nightView(campaign);
  if (night) return () => renderNight(layerSection, night, daySummary(dayEvents), { wake: () => dispatch({ type: 'wake' }) });
  if (layer?.kind === 'camp') return () => renderCamp(layerSection, campPreview(campaign), { confirm: () => { layer = null; dispatch({ type: 'camp' }); }, cancel: () => showLayer(null) });
  if (layer?.kind === 'wake') return () => renderWake(layerSection, layer.report, { close: () => showLayer(null) });
  return null;
}

function showLayer(next) {
  layer = next;
  render();
}

const titleHandlers = {
  start(mode, seedText) {
    const seed = seedText.trim() ? parseSeed(seedText) : randomSeed();
    if (seed === null) return showLayer({ kind: 'title', error: 'graine invalide : un entier de 0 à 4294967295' });
    start(createCampaign({ seed, mode }));
  },
  load(slot) {
    const loaded = saves.load(slot);
    if (loaded.error) return showLayer({ kind: 'title', error: loaded.error });
    start(loaded.campaign);
  },
  async import(file) {
    const loaded = await saves.importFile(file);
    if (loaded.error) return showLayer({ kind: 'title', error: loaded.error });
    start(loaded.campaign);
  },
};

// Après chaque action : rapport du réveil et autosave, cause de la mort (hardcore : effacement),
// fin de campagne.
function afterStep(events) {
  const wake = wakeReport(events);
  if (wake) {
    dayEvents = [];
    layer = { kind: 'wake', report: wake };
    report(saves.autosave(campaign), 'Sauvegarde automatique');
  } else {
    dayEvents.push(...events);
  }
  const died = events.find((event) => event.type === 'died');
  if (died) {
    deathCause = died.cause;
    if (campaign.mode === 'hardcore') report(saves.eraseCampaign(campaign), 'Hardcore : sauvegarde effacée');
  }
  if (events.some((event) => event.type === 'quest-completed' && event.quest === 'le-guide')) layer = { kind: 'ending' };
}

function describe(event) {
  if (event.type === 'refused' && REFUSALS[event.reason]) return `Refusé : ${REFUSALS[event.reason]}`;
  return CAMPAIGN_LINES[event.type]?.(event) ?? combatLine(event) ?? dialogueLine(event) ?? describeEvent(event);
}

function appendEvents(events) {
  for (const event of events) {
    const text = describe(event);
    if (text) appendLine(text, event.type);
  }
}

function appendLine(text, type) {
  const line = h('li', { textContent: `J${campaign.day} · ${text}` });
  line.dataset.type = type;
  journal.append(line);
  journal.scrollTop = journal.scrollHeight;
}

function dispatch(action) {
  targeting = false;
  const result = step(campaign, action);
  campaign = result.state;
  lastEvents = result.events;
  appendEvents(result.events);
  afterStep(result.events);
  render();
  effects.play(result.events);
}

const hexOf = (event) => Number(event.target.closest('[data-hex]')?.dataset.hex) || null;

function describeHex(n) {
  const day = dayState(campaign);
  const hex = day.tile.hexes[n];
  const lines = [TERRAINS[hex.terrain]];
  if (hex.lieu) lines.push(`${hex.lieu}${hex.abri ? ' · abri' : ''}`);
  const exit = linkExits(campaign.world.currentTile).find((link) => link.hex === n);
  if (exit) lines.push(`Liaison vers ${exit.name} (1 PA)`);
  for (const marker of tileQuestMarkers(campaign).filter((m) => m.hex === n)) lines.push(`Quête : ${marker.name}`);
  const place = tilePlaces(campaign).find((entry) => entry.hex === n);
  if (place) lines.push(placeLine(place));

  lines.push(...hexWarnings(day, n));

  if (targeting) {
    lines.push(boltTargets(day).includes(n) ? 'Clic : lancer le boulon ici' : 'Hors de portée du boulon');
  } else if (n === campaign.world.hex) {
    lines.push(pawnHint(place, exit));
  } else if (reachableHexes(day).includes(n)) {
    const cost = entryCost(hex, day);
    lines.push(`Coût : ${cost} PA · reste ${day.ap.left - cost} PA`);
  } else {
    lines.push('Hors de portée');
  }
  return lines;
}

function pawnHint(place, exit) {
  if (place) return place.occupied ? 'Approche : voir les commandes' : 'Clic : entrer';
  return exit ? 'Clic : voyager' : 'Vous êtes ici';
}

function placeLine(place) {
  const state = place.emptied ? 'vidé' : place.explored ? `${place.explored} carte(s) jouée(s)` : 'inexploré';
  return `Lieu : ${place.name} · ${place.occupied ? `tenu par ${place.faction} · ` : ''}${state}`;
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
  if (targeting) {
    if (n && boltTargets(dayState(campaign)).includes(n)) dispatch({ type: 'bolt', target: n });
    else setTargeting(false);
    return showPreview(event);
  }
  if (!n) return;
  dispatch(n === campaign.world.hex ? pawnAction() : { type: 'move', to: n });
  showPreview(event);
});

document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape' && targeting) setTargeting(false);
});

// Sur un lieu explorable, le pion y entre ; sinon il voyage (liaison).
function pawnAction() {
  const entry = placeEntry(campaign);
  return entry ? { type: 'enter-place', place: entry.id } : { type: 'travel' };
}

plateau.addEventListener('contextmenu', (event) => {
  event.preventDefault();
  const n = hexOf(event);
  if (n) dispatch({ type: 'bolt', target: n });
});

function start(loaded) {
  campaign = loaded;
  lastEvents = [];
  journal.replaceChildren();
  board = null;
  layer = null;
  dayEvents = [];
  deathCause = null;
  targeting = false;
  effects.reset();
  render();
}

const dialogueWindow = mountDialogue({ onChoose: dispatch });
const combatWindow = mountCombat({ onAction: dispatch });

document.getElementById('nouvelle').addEventListener('click', () => showLayer({ kind: 'title' }));

sizes = await loadSizes();
const urlSeed = parseSeed(params.get('seed') ?? '');
if (urlSeed === null) showLayer({ kind: 'title' });
else start(createCampaign({ seed: urlSeed }));
