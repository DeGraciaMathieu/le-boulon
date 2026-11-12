// Écran Inventaire (brief v2 §16, §11.3 ; carte 28) : grille, emplacements d'équipement,
// ceinture d'artefacts. Lit les lectures d'inventory.js ; clic sur un objet équipable :
// { type: 'equip', item } ; bouton Retirer : { type: 'unequip', slot, item? }
// (rules/equipment.js).

import { h, mountScreen } from './screen.js';
import { inventoryGrid, equipmentView, SLOT_NAMES } from './inventory.js';

// Hypothèse v2 : 6 cases par rangée (le brief ne fixe pas la forme de la grille).
const COLUMNS = 6;

export function mountInventory(root, toggle, { dispatch }) {
  const screen = mountScreen(root, toggle, 'Inventaire');

  function render(campaign) {
    screen.body.replaceChildren(renderEquipment(campaign, dispatch), renderGrid(campaign, dispatch));
  }
  return { render, close: screen.close };
}

function renderGrid(campaign, dispatch) {
  const grid = inventoryGrid(campaign);
  const total = Math.max(grid.cells, grid.used);
  const cells = Array.from({ length: total }, (_, n) => place(h('div', { className: 'case' }), n, 1));
  const items = grid.items.flatMap((item) => {
    const label = item.charges !== null ? `${item.name} ×${item.charges}` : item.name;
    const title = `${label}${item.slot ? ' · clic : équiper' : ''}`;
    return segments(item).map(({ start, span }, i) => {
      const node = place(h('div', { className: `objet${item.slot ? ' equipable' : ''}`, title, textContent: i === 0 ? label : '' }), start, span);
      if (item.slot) node.onclick = () => dispatch({ type: 'equip', item: item.kind });
      return node;
    });
  });
  return h('section', {},
    h('h3', { textContent: `Sac · ${grid.used} / ${grid.cells} cases` }),
    h('div', { className: 'grille', style: `--colonnes: ${COLUMNS}` }, ...cells, ...items));
}

// Un objet rangé en fin de rangée continue sur la suivante : un morceau par rangée.
function segments({ start, size }) {
  const parts = [];
  for (let n = start; n < start + size; n += parts.at(-1).span) {
    parts.push({ start: n, span: Math.min(start + size - n, COLUMNS - (n % COLUMNS)) });
  }
  return parts;
}

function place(node, n, span) {
  node.style.gridRow = String(Math.floor(n / COLUMNS) + 1);
  node.style.gridColumn = `${(n % COLUMNS) + 1} / span ${span}`;
  return node;
}

function renderEquipment(campaign, dispatch) {
  const { slots, belt } = equipmentView(campaign);
  const remove = (action) => h('button', { type: 'button', textContent: 'Retirer', onclick: () => dispatch(action) });
  const beltCells = Array.from({ length: belt.size }, (_, i) => {
    const artefact = belt.items[i];
    return artefact
      ? h('li', { className: 'emplacement plein' },
        h('span', { textContent: artefact.name }),
        h('span', { className: 'effet', textContent: artefact.effect }),
        remove({ type: 'unequip', slot: 'belt', item: artefact.kind }))
      : h('li', { className: 'emplacement vide', textContent: 'libre' });
  });
  return h('section', { className: 'equipement' },
    h('h3', { textContent: 'Équipement' }),
    h('table', {}, ...slots.map((slot) => h('tr', {},
      h('th', { textContent: slot.label }),
      h('td', { textContent: slot.item?.name ?? '—' }),
      h('td', {}, slot.item ? remove({ type: 'unequip', slot: slot.id }) : null)))),
    h('h3', { textContent: `${SLOT_NAMES.belt} · ${belt.items.length} / ${belt.size}` }),
    h('ul', { className: 'ceinture' }, ...beltCells));
}
