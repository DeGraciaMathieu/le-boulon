// Équipement (brief v2 §11.3) : emplacements, grille extensible, effets des objets portés.
// Catalogue et format des objets : src/content/objets.js.
//
// ÉTAT (campaign.equipment, passé à la journée v1 par dayState) :
//   { primary, sidearm, armor, detector, backpack,   objet d'inventaire { kind, size, ... } ou null
//     belt: [objet] }                                artefacts en ceinture, 1 à 3 selon l'armure
//   Un objet équipé ne prend pas de case dans la grille (hypothèse v2).
//   Une journée v1 sans champ equipment (createGame) garde les règles v1 : les lectures
//   ci-dessous rendent 0 ou null pour equipment undefined, et chaque règle v1 garde sa valeur
//   v1 dans ce cas (arme : pistolet de l'inventaire ; détecteur : portée 2).
//
// LECTURE (pures) :
//   emptyEquipment()                  emplacements vides
//   usedSlots(inventory)              cases occupées
//   inventorySlots({ equipment, perks })  12, ou 15 avec un sac ou le savoir-faire 'mule'
//                                     (hook de la carte 17 : perks = player.perks)
//   beltSlots(equipment)              emplacements de ceinture de l'armure (1 sans armure)
//   activeWeapon(equipment, inventory) -> { kind, bonus, damage, ammo } | null
//                                     arme équipée chargée (munitions dédiées présentes) au
//                                     plus fort bonus ; null si aucune
//   detectorOf(equipment)             { range, anomalyType } du détecteur porté, ou null
//   statBonus(equipment, stat)        bonus de ceinture à une stat (tests et combat)
//   radiationProtection(equipment)    armure + ceinture, retiré de chaque gain de radiation
//   armorAbsorb(equipment)            blessures absorbées par combat, armure + ceinture
//                                     (hook du combat v2, carte 18)
//   apBonus(equipment)                PA de ceinture par jour (hook de la carte 7)
//   beltRadiation(equipment)          radiations par jour des artefacts portés (hook de la carte 7)
//
// ACTIONS DE CAMPAGNE (CAMPAIGN_ACTIONS de src/engine/campaign.js), 0 PA (hypothèse v2) :
//   { type: 'equip', item }           prend le premier objet de ce type dans l'inventaire et le
//                                     met à son emplacement ; l'objet déjà là revient dans
//                                     l'inventaire. Une armure à moins d'emplacements de
//                                     ceinture renvoie les artefacts en trop dans l'inventaire.
//   { type: 'unequip', slot, item? }  remet l'objet dans l'inventaire ; item désigne
//                                     l'artefact pour slot 'belt' (le premier sinon).
//   Pas de surcharge : refus si l'inventaire dépasse la grille après l'échange.
//   Refus : 'in-combat' | 'no-item' | 'not-equippable' | 'unknown-slot' | 'empty-slot'
//           | 'belt-full' | 'inventory-full'.
//
// ÉVÉNEMENTS :
//   { type: 'equipped', item, slot }   { type: 'unequipped', item, slot }
//
// MISE EN PLACE : outfit(campaign) équipe le pistolet de départ et un détecteur Écho
// (hypothèse v2 : le brief ne fixe pas l'équipement de départ).

import catalog from '../../content/objets.js';

export const SLOTS = Object.freeze(['primary', 'sidearm', 'armor', 'detector', 'belt', 'backpack']);
export const BASE_INVENTORY_SLOTS = 12;
const MULE_SLOTS = 3;
// Hypothèse v2 : sans armure, un emplacement de ceinture.
const NO_ARMOR_BELT_SLOTS = 1;
const START_SIDEARM = 'pistolet';
const START_DETECTOR = 'echo';

export function emptyEquipment() {
  return { primary: null, sidearm: null, armor: null, detector: null, belt: [], backpack: null };
}

export function usedSlots(inventory) {
  return inventory.reduce((total, item) => total + item.size, 0);
}

export function inventorySlots({ equipment, perks = [] }) {
  const backpack = equipment?.backpack ? catalog[equipment.backpack.kind].backpack.slots : 0;
  const mule = perks.includes('mule') ? MULE_SLOTS : 0;
  // §11.3 : 15 cases avec Mule ou un sac, sans cumul (hypothèse v2).
  return BASE_INVENTORY_SLOTS + Math.max(backpack, mule);
}

export function beltSlots(equipment) {
  return equipment?.armor ? catalog[equipment.armor.kind].armor.beltSlots : NO_ARMOR_BELT_SLOTS;
}

export function activeWeapon(equipment, inventory) {
  const loaded = [equipment?.primary, equipment?.sidearm]
    .filter(Boolean)
    .map((item) => ({ kind: item.kind, ammo: catalog[item.kind].ammo, ...catalog[item.kind].weapon }))
    .filter((weapon) => inventory.some((item) => item.kind === weapon.ammo && item.charges > 0));
  if (loaded.length === 0) return null;
  return loaded.reduce((best, weapon) => (weapon.bonus > best.bonus ? weapon : best));
}

export function detectorOf(equipment) {
  return equipment?.detector ? catalog[equipment.detector.kind].detector : null;
}

function beltEffects(equipment) {
  return (equipment?.belt ?? []).map((item) => catalog[item.kind].belt);
}

const sum = (values) => values.reduce((total, value) => total + (value ?? 0), 0);

export function statBonus(equipment, stat) {
  return sum(beltEffects(equipment).map((belt) => belt.stats?.[stat]));
}

export function radiationProtection(equipment) {
  const armor = equipment?.armor ? catalog[equipment.armor.kind].armor.radiation : 0;
  return armor + sum(beltEffects(equipment).map((belt) => belt.radiation));
}

export function armorAbsorb(equipment) {
  const armor = equipment?.armor ? catalog[equipment.armor.kind].armor.absorb : 0;
  return armor + sum(beltEffects(equipment).map((belt) => belt.absorb));
}

export function apBonus(equipment) {
  return sum(beltEffects(equipment).map((belt) => belt.ap));
}

export function beltRadiation(equipment) {
  return sum(beltEffects(equipment).map((belt) => belt.cost));
}

export function outfit(campaign) {
  const index = campaign.inventory.findIndex((item) => item.kind === START_SIDEARM);
  if (index !== -1) [campaign.equipment.sidearm] = campaign.inventory.splice(index, 1);
  const { size } = catalog[START_DETECTOR];
  campaign.equipment.detector = { kind: START_DETECTOR, size };
}

export function equip(draft, { item: kind }, ctx) {
  if (inCombat(draft)) return 'in-combat';
  const index = draft.inventory.findIndex((owned) => owned.kind === kind);
  if (index === -1) return 'no-item';
  const slot = catalog[kind]?.slot;
  if (!slot) return 'not-equippable';

  const equipment = structuredClone(draft.equipment);
  const inventory = draft.inventory.filter((_, i) => i !== index);
  const item = draft.inventory[index];
  const returned = [];
  if (slot === 'belt') {
    if (equipment.belt.length >= beltSlots(equipment)) return 'belt-full';
    equipment.belt.push(item);
  } else {
    if (equipment[slot]) returned.push({ item: equipment[slot], slot });
    equipment[slot] = item;
  }
  returned.push(...beltOverflow(equipment));

  const refusal = rearrange(draft, equipment, inventory, returned);
  if (refusal) return refusal;
  ctx.emit({ type: 'equipped', item: kind, slot });
  emitReturned(returned, ctx);
}

export function unequip(draft, { slot, item: kind }, ctx) {
  if (inCombat(draft)) return 'in-combat';
  if (!SLOTS.includes(slot)) return 'unknown-slot';

  const equipment = structuredClone(draft.equipment);
  const returned = [];
  if (slot === 'belt') {
    const index = kind ? equipment.belt.findIndex((item) => item.kind === kind) : 0;
    if (index === -1 || equipment.belt.length === 0) return 'empty-slot';
    returned.push({ item: equipment.belt.splice(index, 1)[0], slot });
  } else {
    if (!equipment[slot]) return 'empty-slot';
    returned.push({ item: equipment[slot], slot });
    equipment[slot] = null;
  }
  returned.push(...beltOverflow(equipment));

  const refusal = rearrange(draft, equipment, [...draft.inventory], returned);
  if (refusal) return refusal;
  emitReturned(returned, ctx);
}

function inCombat(draft) {
  return Boolean(draft.world.tiles[draft.world.currentTile]?.combat);
}

function beltOverflow(equipment) {
  const extra = equipment.belt.splice(beltSlots(equipment));
  return extra.map((item) => ({ item, slot: 'belt' }));
}

// Pas de surcharge : l'échange n'a lieu que si tout tient dans la grille.
function rearrange(draft, equipment, inventory, returned) {
  inventory.push(...returned.map(({ item }) => item));
  const capacity = inventorySlots({ equipment, perks: draft.player.perks });
  if (usedSlots(inventory) > capacity) return 'inventory-full';
  draft.equipment = equipment;
  draft.inventory = inventory;
}

function emitReturned(returned, ctx) {
  for (const { item, slot } of returned) ctx.emit({ type: 'unequipped', item: item.kind, slot });
}
