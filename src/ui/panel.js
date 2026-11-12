// Panneau latéral : PA, pistes, inventaire, mission, état de la Zone et commandes contextuelles.
// Lecture seule : le panneau dessine l'état et rend les actions choisies par onAction(action).

import { TRACK_MAX, INVENTORY_SLOTS, usedSlots } from '../engine/rules/sheet.js';
import { tokenAt } from '../engine/rules/suspects.js';
import { ENCOUNTER_CARDS } from '../engine/rules/encounters.js';
import { canExit } from './board.js';
import { ITEM_NAMES, MISSION_NAMES } from './journal.js';

const THRESHOLDS = [4, 6];
const USABLE = ['bandage', 'vodka', 'ration'];

const MISSION_GOALS = {
  recuperation: (p) => `Ramasser un artefact puis sortir · ${p.picked}/${p.needed}`,
  cartographie: (p) => `Révéler les 5 jetons d'origine puis sortir · ${p.revealed}/${p.needed}`,
};

function h(tag, attrs = {}, ...children) {
  const node = Object.assign(document.createElement(tag), attrs);
  node.append(...children.filter((child) => child !== null && child !== undefined));
  return node;
}

function track(label, value, cls) {
  const cells = Array.from({ length: TRACK_MAX }, (_, i) => h('span', {
    className: `case${i < value ? ' pleine' : ''}${THRESHOLDS.includes(i + 1) ? ' seuil' : ''}`,
    title: THRESHOLDS.includes(i + 1) ? `Seuil ${i + 1}` : '',
  }));
  return h('div', { className: `piste ${cls}` },
    h('span', { className: 'etiquette', textContent: `${label} ${value}/${TRACK_MAX}` }),
    h('div', { className: 'cases' }, ...cells));
}

function inventoryGrid(inventory) {
  const cells = [];
  for (const item of inventory) {
    const name = ITEM_NAMES[item.kind] ?? item.kind;
    const label = item.charges !== undefined ? `${name} ×${item.charges}` : name;
    cells.push(h('div', { className: `objet taille-${item.size}`, textContent: label }));
  }
  const free = INVENTORY_SLOTS - usedSlots(inventory);
  for (let i = 0; i < free; i += 1) cells.push(h('div', { className: 'objet vide' }));
  return h('div', { className: 'inventaire' }, ...cells);
}

function zoneStatus(state) {
  const lines = [h('div', { textContent: `Détecteur : ${state.detector.broken ? 'en panne' : 'actif'}` })];
  if (state.zone?.fog) lines.push(h('div', { className: 'alerte', textContent: 'Brouillard : boulon impossible' }));
  if (state.zone?.emission) {
    lines.push(h('div', { className: 'alerte emission', textContent: `ÉMISSION dans ${state.zone.emission.left} PA : rejoindre un abri` }));
  }
  return lines;
}

function commands(state, onAction) {
  const button = (label, action) => h('button', { type: 'button', textContent: label, onclick: () => onAction(action) });

  if (state.status !== 'playing') return [];
  if (state.combat) {
    const card = ENCOUNTER_CARDS[state.combat.card];
    return [
      h('div', { className: 'alerte', textContent: `Combat : ${card?.name ?? state.combat.card} (Menace ${card?.threat})` }),
      button('Combattre', { type: 'fight' }),
      button('Fuir (2 PA)', { type: 'flee' }),
    ];
  }

  const buttons = [];
  const token = tokenAt(state, state.player.hex);
  if (token?.revealed && token.kind === 'artefact') buttons.push(button('Ramasser (1 PA)', { type: 'pickup' }));
  for (const kind of USABLE) {
    if (state.inventory.some((item) => item.kind === kind)) {
      buttons.push(button(`Utiliser ${ITEM_NAMES[kind].toLowerCase()} (1 PA)`, { type: 'use', item: kind }));
    }
  }
  if (canExit(state)) buttons.push(button('Sortir de la tuile', { type: 'exit' }));
  buttons.push(h('div', { className: 'aide', textContent: 'Clic : se déplacer · clic droit : boulon (1 PA)' }));
  return buttons;
}

export function renderPanel(panel, state, onAction) {
  const { mission } = state;
  panel.replaceChildren(
    h('div', { className: 'pa' },
      h('span', { className: 'pa-valeur', textContent: state.ap.left }),
      h('span', { className: 'pa-label', textContent: `PA restants / ${state.ap.max}` })),
    h('section', {}, track('Blessures', state.player.wounds, 'blessures'), track('Radiations', state.player.radiation, 'radiations')),
    h('section', {},
      h('h2', { textContent: `Inventaire ${usedSlots(state.inventory)}/${INVENTORY_SLOTS}` }),
      inventoryGrid(state.inventory)),
    h('section', { className: `mission${mission.done ? ' remplie' : ''}${mission.impossible ? ' impossible' : ''}` },
      h('h2', { textContent: `Mission : ${MISSION_NAMES[mission.kind]}` }),
      h('div', { textContent: MISSION_GOALS[mission.kind](mission.progress) }),
      mission.done ? h('div', { textContent: 'Remplie : rejoindre un bord et sortir' }) : null,
      mission.impossible ? h('div', { textContent: 'Devenue impossible' }) : null),
    h('section', {}, h('h2', { textContent: 'Zone' }), ...zoneStatus(state)),
    h('section', { className: 'commandes' }, ...commands(state, onAction)),
  );
}
