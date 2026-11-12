// Fiche du joueur : blessures, radiations, inventaire.
//
// DEPUIS UN HANDLER OU UNE RÉACTION (ctx, voir src/engine/game.js) :
//   ctx.wound(n, cause)            +n blessures (piste 0-6). En atteignant 4 : -1 PA sur le
//                                  budget restant (jamais sous 0, une seule fois par partie,
//                                  ap.spent ne bouge pas). À 6 : status 'dead'.
//   ctx.irradiate(n, cause)        +n radiations (piste 0-6). À 6 : 1 blessure (cause
//                                  'radiation'), puis la piste retombe à 3.
//   ctx.addItem(item) -> bool      range un objet (createItem) ; false si la grille de 12
//                                  cases n'a pas la place, l'inventaire est alors inchangé.
//   ctx.removeItem(kind, cause) -> item | null
//                                  retire ou détruit le premier objet de ce type.
//   ctx.useCharge(kind) -> bool    dépense 1 munition ou 1 boulon ; false s'il n'en reste
//                                  aucun. Une boîte vide est retirée et libère sa case.
//
// LECTURE (pures, utilisables par l'UI) :
//   createItem(kind, extra)        objet { kind, size, charges? } du catalogue ITEMS
//   usedSlots(inventory)           cases occupées
//   countCharges(inventory, kind)  munitions ou boulons restants ; pour un autre type, le
//                                  nombre d'objets
//   consumables(inventory)         types des consommables présents (un par objet), pour
//                                  choisir lequel détruire
//
// ACTION JOUEUR { type: 'use', item: 'bandage' | 'vodka' | 'ration' } : 1 PA, consomme l'objet.
//   bandage -1 blessure, vodka -2 radiations, ration sans effet en v1 (simple consommation,
//   la faim n'existe pas encore).
//   Refus : 'not-usable' | 'no-item' | 'not-enough-ap'.
//
// ÉVÉNEMENTS :
//   { type: 'wounded', amount, cause }        { type: 'irradiated', amount, cause }
//   { type: 'ap-penalty', amount: 1, cause: 'wounds' }
//   { type: 'died', cause }                   { type: 'item-removed', kind, cause }
//   { type: 'used', item, wounds?, radiation? }

export const TRACK_MAX = 6;
export const INVENTORY_SLOTS = 12;
const WOUND_PENALTY_AT = 4;
const RADIATION_RESET = 3;

export const ITEMS = Object.freeze({
  pistolet: { size: 2 },
  munitions: { size: 1, charges: 6 },
  boulons: { size: 1, charges: 10 },
  bandage: { size: 1, consumable: true },
  vodka: { size: 1, consumable: true },
  ration: { size: 1, consumable: true },
  artefact: { size: 1 },
});

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

export function usedSlots(inventory) {
  return inventory.reduce((total, item) => total + item.size, 0);
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
  const before = player.wounds;
  player.wounds = Math.min(TRACK_MAX, before + amount);
  emit({ type: 'wounded', amount, cause });

  if (player.wounds >= WOUND_PENALTY_AT && !player.woundPenalty) {
    player.woundPenalty = true;
    draft.ap.left = Math.max(0, draft.ap.left - 1);
    emit({ type: 'ap-penalty', amount: 1, cause: 'wounds' });
  }
  if (player.wounds === TRACK_MAX) {
    draft.status = 'dead';
    emit({ type: 'died', cause });
  }
}

export function irradiate(draft, amount, cause, emit) {
  const { player } = draft;
  player.radiation = Math.min(TRACK_MAX, player.radiation + amount);
  emit({ type: 'irradiated', amount, cause });
  if (player.radiation < TRACK_MAX) return;

  player.radiation = RADIATION_RESET;
  wound(draft, 1, 'radiation', emit);
}

export function addItem(draft, item) {
  if (usedSlots(draft.inventory) + item.size > INVENTORY_SLOTS) return false;
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

const USE_COST = 1;

const USE_EFFECTS = {
  bandage: (player) => {
    player.wounds = Math.max(0, player.wounds - 1);
    return { wounds: -1 };
  },
  vodka: (player) => {
    player.radiation = Math.max(0, player.radiation - 2);
    return { radiation: -2 };
  },
  ration: () => ({}),
};

export function use(draft, { item }, ctx) {
  const effect = USE_EFFECTS[item];
  if (!effect) return 'not-usable';
  const index = draft.inventory.findIndex((owned) => owned.kind === item);
  if (index === -1) return 'no-item';
  if (draft.ap.left < USE_COST) return 'not-enough-ap';

  ctx.spend(USE_COST);
  draft.inventory.splice(index, 1);
  ctx.emit({ type: 'used', item, ...effect(draft.player) });
}
