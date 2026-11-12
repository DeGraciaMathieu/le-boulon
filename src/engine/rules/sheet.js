// Fiche du joueur : blessures, radiations, inventaire.
//
// DEPUIS UN HANDLER OU UNE RÉACTION (ctx, voir src/engine/game.js) :
//   ctx.wound(n, cause)            +n blessures (piste 0-6). En atteignant 4 : -1 PA sur le
//                                  budget restant (jamais sous 0, une seule fois par partie,
//                                  ap.spent ne bouge pas). À 6 : status 'dead' ; à 7 avec le
//                                  savoir-faire Coriace (piste 0-7, rules/progression.js).
//   ctx.irradiate(n, cause)        +n radiations (piste 0-6), moins la protection de l'armure
//                                  et de la ceinture (equipment.js), et 1 de moins avec Peau
//                                  dure (jamais sous 0). À 6 : 1 blessure (cause
//                                  'radiation'), puis la piste retombe à 3.
//   ctx.addItem(item) -> bool      range un objet (createItem) ; false si la grille (12 cases,
//                                  15 avec sac ou Mule : inventorySlots d'equipment.js) n'a
//                                  pas la place, l'inventaire est alors inchangé.
//   ctx.removeItem(kind, cause) -> item | null
//                                  retire ou détruit le premier objet de ce type.
//   ctx.useCharge(kind) -> bool    dépense 1 munition ou 1 boulon ; false s'il n'en reste
//                                  aucun. Une boîte vide est retirée et libère sa case.
//
// LECTURE (pures, utilisables par l'UI) :
//   createItem(kind, extra)        objet { kind, size, charges? } du catalogue ITEMS
//                                  (src/content/objets.js)
//   usedSlots(inventory)           cases occupées (défini dans equipment.js)
//   inventoryCapacity(state)       taille de la grille (12, ou 15 avec sac ou Mule)
//   countCharges(inventory, kind)  munitions ou boulons restants ; pour un autre type, le
//                                  nombre d'objets
//   consumables(inventory)         types des consommables présents (un par objet), pour
//                                  choisir lequel détruire
//
// ACTION JOUEUR { type: 'use', item } : tout objet du catalogue avec un champ use. 1 PA (ou
//   use.cost), consomme l'objet. Soins : blessures (bandage : 2 avec Infirmier) ; antiradiations : radiations ;
//   nourriture : sans effet en journée, le repas se prend au réveil (rules/time.js) ; boisson énergétique :
//   +2 PA restants, une fois par jour (ap.boosted, remis à zéro avec le budget de PA).
//   Refus : 'not-usable' | 'no-item' | 'not-enough-ap' | 'once-per-day'.
//
// ÉVÉNEMENTS :
//   { type: 'wounded', amount, cause }        { type: 'irradiated', amount, cause, blocked? }
//   blocked : radiations retenues par la protection (absent si aucune)
//   { type: 'ap-penalty', amount: 1, cause: 'wounds' }
//   { type: 'died', cause }                   { type: 'item-removed', kind, cause }
//   { type: 'used', item, wounds?, radiation?, ap? }

import catalog from '../../content/objets.js';
import { BASE_INVENTORY_SLOTS, inventorySlots, radiationProtection, usedSlots } from './equipment.js';
import { hasPerk } from './progression.js';

export { usedSlots };

export const TRACK_MAX = 6;
const TOUGH_TRACK_MAX = 7;
const THICK_SKIN = 1;
const MEDIC_BANDAGE_WOUNDS = -2;
export const INVENTORY_SLOTS = BASE_INVENTORY_SLOTS;
export const WOUND_PENALTY_AT = 4;
export const RADIATION_RESET = 3;

export const ITEMS = catalog;

const STARTING_KINDS = ['pistolet', 'munitions', 'boulons', 'bandage', 'bandage', 'vodka', 'ration'];

export function createItem(kind, extra = {}) {
  const { size, charges } = ITEMS[kind];
  const item = { kind, size, ...extra };
  if (charges) item.charges = charges;
  return item;
}

export function startingInventory() {
  return STARTING_KINDS.map((kind) => createItem(kind));
}

export function countCharges(inventory, kind) {
  return inventory
    .filter((item) => item.kind === kind)
    .reduce((total, item) => total + (item.charges ?? 1), 0);
}

export function consumables(inventory) {
  return inventory.filter((item) => ITEMS[item.kind].consumable).map((item) => item.kind);
}

export function wound(draft, amount, cause, emit) {
  const { player } = draft;
  const deathAt = hasPerk(draft, 'coriace') ? TOUGH_TRACK_MAX : TRACK_MAX;
  player.wounds = Math.min(deathAt, player.wounds + amount);
  emit({ type: 'wounded', amount, cause });

  if (player.wounds >= WOUND_PENALTY_AT && !player.woundPenalty) {
    player.woundPenalty = true;
    draft.ap.left = Math.max(0, draft.ap.left - 1);
    emit({ type: 'ap-penalty', amount: 1, cause: 'wounds' });
  }
  if (player.wounds === deathAt) {
    draft.status = 'dead';
    emit({ type: 'died', cause });
  }
}

export function irradiate(draft, amount, cause, emit) {
  const { player } = draft;
  const protection = radiationProtection(draft.equipment) + (hasPerk(draft, 'peau-dure') ? THICK_SKIN : 0);
  const taken = Math.max(0, amount - protection);
  const blocked = amount - taken;
  player.radiation = Math.min(TRACK_MAX, player.radiation + taken);
  emit({ type: 'irradiated', amount: taken, cause, ...(blocked > 0 && { blocked }) });
  if (player.radiation < TRACK_MAX) return;

  player.radiation = RADIATION_RESET;
  wound(draft, 1, 'radiation', emit);
}

export function addItem(draft, item) {
  if (usedSlots(draft.inventory) + item.size > inventoryCapacity(draft)) return false;
  draft.inventory.push(item);
  return true;
}

export function removeItem(draft, kind, cause, emit) {
  const index = draft.inventory.findIndex((item) => item.kind === kind);
  if (index === -1) return null;
  const [item] = draft.inventory.splice(index, 1);
  emit({ type: 'item-removed', kind, cause });
  return item;
}

export function useCharge(draft, kind) {
  const index = draft.inventory.findIndex((item) => item.kind === kind && item.charges > 0);
  if (index === -1) return false;
  const item = draft.inventory[index];
  item.charges -= 1;
  if (item.charges === 0) draft.inventory.splice(index, 1);
  return true;
}

export function inventoryCapacity(draft) {
  return inventorySlots({ equipment: draft.equipment, perks: draft.player.perks });
}

const USE_COST = 1;

export function use(draft, { item }, ctx) {
  const effect = ITEMS[item]?.use;
  if (!effect) return 'not-usable';
  const index = draft.inventory.findIndex((owned) => owned.kind === item);
  if (index === -1) return 'no-item';
  const cost = effect.cost ?? USE_COST;
  if (draft.ap.left < cost) return 'not-enough-ap';
  if (effect.oncePerDay && draft.ap.boosted) return 'once-per-day';

  ctx.spend(cost);
  draft.inventory.splice(index, 1);
  const medic = item === 'bandage' && hasPerk(draft, 'infirmier');
  ctx.emit({ type: 'used', item, ...applyUse(draft, medic ? { ...effect, wounds: MEDIC_BANDAGE_WOUNDS } : effect) });
}

function applyUse(draft, { wounds, radiation, ap }) {
  const { player } = draft;
  const changes = {};
  if (wounds) {
    player.wounds = Math.max(0, player.wounds + wounds);
    changes.wounds = wounds;
  }
  if (radiation) {
    player.radiation = Math.max(0, player.radiation + radiation);
    changes.radiation = radiation;
  }
  if (ap) {
    draft.ap.left += ap;
    draft.ap.boosted = true;
    changes.ap = ap;
  }
  return changes;
}
