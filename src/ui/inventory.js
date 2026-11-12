// Lectures de l'écran Inventaire (brief v2 §16, §11.3, §12 ; carte 28) : grille, emplacements
// d'équipement, ceinture d'artefacts. Pures : elles lisent la campagne et le contenu, sans rien
// modifier, et ne touchent pas au DOM (testées par tests/inventory.test.js). Le rendu est dans
// inventory-view.js.
//
//   SLOT_NAMES                    { [slot]: libellé } des emplacements d'equipment.js
//   inventoryGrid(campaign) -> { cells, used, items: [{ kind, name, size, charges, start, slot }] }
//     cells : cases de la grille (inventorySlots) ; start : première case de l'objet, les
//     objets rangés à la suite dans l'ordre de l'inventaire ; slot : emplacement où l'action
//     equip le met, ou null.
//   equipmentView(campaign) -> { slots: [{ id, label, item }], belt: { size, items } }
//     slots : arme principale, arme de poing, armure, détecteur, sac ; item : { kind, name } ou
//     null ; belt.items : [{ kind, name, effect }] artefacts portés, belt.size : emplacements.
//   INVENTORY_LINES  { [type]: (event) -> texte } lignes du journal du bas pour equip et
//                    unequip, reprises par campagne.js

import content from '../content/index.js';
import { inventorySlots, usedSlots, beltSlots } from '../engine/rules/equipment.js';

export const SLOT_NAMES = Object.freeze({
  primary: 'Arme principale',
  sidearm: 'Arme de poing',
  armor: 'Armure',
  detector: 'Détecteur',
  backpack: 'Sac',
  belt: "Ceinture d'artefacts",
});

const BELT_STATS = { tir: 'Tir', survie: 'Survie', discretion: 'Discrétion' };

const itemName = (kind) => content.items[kind]?.name ?? kind;

export const INVENTORY_LINES = Object.freeze({
  equipped: (e) => `Équipé : ${itemName(e.item)} (${SLOT_NAMES[e.slot]})`,
  unequipped: (e) => `Retiré : ${itemName(e.item)} (${SLOT_NAMES[e.slot]})`,
});

export function inventoryGrid(campaign) {
  let start = 0;
  const items = campaign.inventory.map((item) => {
    const entry = {
      kind: item.kind,
      name: itemName(item.kind),
      size: item.size,
      charges: item.charges ?? null,
      start,
      slot: content.items[item.kind]?.slot ?? null,
    };
    start += item.size;
    return entry;
  });
  return {
    cells: inventorySlots({ equipment: campaign.equipment, perks: campaign.player.perks }),
    used: usedSlots(campaign.inventory),
    items,
  };
}

export function equipmentView(campaign) {
  const { equipment } = campaign;
  const slots = ['primary', 'sidearm', 'armor', 'detector', 'backpack'].map((id) => ({
    id,
    label: SLOT_NAMES[id],
    item: equipment[id] ? { kind: equipment[id].kind, name: itemName(equipment[id].kind) } : null,
  }));
  const belt = {
    size: beltSlots(equipment),
    items: equipment.belt.map(({ kind }) => ({ kind, name: itemName(kind), effect: beltText(content.items[kind].belt) })),
  };
  return { slots, belt };
}

// « Tir +1, absorbe 1, 1 rad/jour » : effets d'un artefact en ceinture (objets.js).
export function beltText(belt) {
  const parts = Object.entries(belt.stats ?? {}).map(([stat, n]) => `${BELT_STATS[stat]} +${n}`);
  if (belt.absorb) parts.push(`absorbe ${belt.absorb}`);
  if (belt.ap) parts.push(`+${belt.ap} PA`);
  if (belt.radiation) parts.push(`protège ${belt.radiation} rad`);
  parts.push(`${belt.cost} rad/jour`);
  return parts.join(', ');
}
