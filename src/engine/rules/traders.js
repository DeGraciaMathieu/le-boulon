// Marchands des hubs (brief v2 §6.2, §6.3, §9 ; carte 13). Contenu : src/content/marchands.js.
//
// ÉTAT : campaign.traders[id] = { stock: { [itemId]: quantité }, restockDay }
//   Créé à la première visite (op 'browse', 'buy' ou 'sell') avec le stock plein du contenu ;
//   absent, le marchand a son stock plein et c'est la première visite (réplique 'premiere').
//   restockDay : jour où le stock revient au contenu (RESTOCK_DAYS jours plus tard).
//   Hypothèse v2 : le cycle de 3 jours part de la première visite ; les objets revendus par
//   le joueur ne rejoignent pas le stock.
//
// PRIX (§6.2) : prix de base (content.items) × coefficient du marchand × modificateur de
//   réputation (PRICE_MODIFIERS de factions.js, faction du hub). Revente : × sell[catégorie]
//   du marchand en plus. Arrondi au rouble (hypothèse v2).
//   Hostile : refus d'acheter et de vendre. Membre du Devoir ou de Liberté : prix d'allié.
//   Marchandeur (§11.2) : un cran de réputation de plus, plafonné à allié ; il ne lève pas le
//   refus d'un hostile (hypothèse v2).
//   Hypothèse v2 : une boîte entamée (charges) se revend au prorata de ses charges ; un objet de
//   quête (price null) ne se vend pas ; tout marchand rachète tout le reste.
//
// RANGS (§6.2) : un objet du stock avec rank ne se vend qu'à partir de ce rang (RANKS).
//
// RÉPLIQUES (§6.2), dans l'ordre : hostile, premiere (première visite), quete (une quête
//   active, hypothèse v2 : n'importe laquelle), puis le palier de réputation.
//
// SERVICE (HUB_SERVICES.marchand de hubs.js), 0 PA comme tout le hub :
//   { type: 'service', service: 'marchand', op: 'browse' }        réplique du marchand
//   { type: 'service', service: 'marchand', op: 'buy', item }     achète une unité du stock
//   { type: 'service', service: 'marchand', op: 'sell', item }    vend le premier objet de ce
//                                                                 type de l'inventaire
//   Refus : 'no-trader' | 'unknown-op' | 'hostile' | 'not-in-stock' | 'rank-required'
//           | 'not-enough-roubles' | 'inventory-full' | 'no-item' | 'not-for-sale'
//
// NOUVEAU JOUR (DAY_HOOKS.traders de time.js) : restockTraders(draft, ctx).
//
// LECTURE (pures) :
//   traderOf(hubId) -> id | null           stockOf(campaign, id) -> { [itemId]: quantité }
//   buyPrice(campaign, id, itemId) -> n | null (refus)
//   sellPrice(campaign, id, objet d'inventaire) -> n | null (refus)
//   traderLine(campaign, id) -> { line, text }
//
// ÉVÉNEMENTS :
//   { type: 'trader-greeted', trader, line, text }
//   { type: 'item-bought', trader, item, price, roubles }
//   { type: 'item-sold', trader, item, price, roubles }
//   { type: 'roubles-changed', amount, roubles }   { type: 'trader-restocked', trader }

import content from '../../content/index.js';
import { PRICE_MODIFIERS, STANDINGS, priceModifier, standing } from './factions.js';
import { RANKS, hasPerk } from './progression.js';
import { usedSlots, inventorySlots } from './equipment.js';
import { createItem } from './sheet.js';

export const RESTOCK_DAYS = 3;

const OPERATIONS = { browse, buy, sell };

const rankIndex = (rank) => RANKS.findIndex(({ id }) => id === rank);

export function traderOf(hubId) {
  const found = Object.entries(content.traders).find(([, trader]) => trader.place === hubId);
  return found?.[0] ?? null;
}

export function stockOf(campaign, id) {
  return { ...(campaign.traders[id]?.stock ?? fullStock(id)) };
}

export function buyPrice(campaign, id, itemId) {
  const modifier = modifierFor(campaign, id);
  if (!modifier) return null;
  return Math.round(content.items[itemId].price * content.traders[id].coefficient * modifier.buy);
}

export function sellPrice(campaign, id, item) {
  const modifier = modifierFor(campaign, id);
  const { price, category, charges } = content.items[item.kind];
  if (!modifier || price === null) return null;
  const trader = content.traders[id];
  const share = charges ? (item.charges ?? charges) / charges : 1;
  return Math.round(price * trader.coefficient * (trader.sell?.[category] ?? 1) * modifier.sell * share);
}

export function traderLine(campaign, id) {
  const line = lineKey(campaign, id);
  return { line, text: content.traders[id].lines[line] };
}

export function trade(draft, action, ctx, hubId) {
  const id = traderOf(hubId);
  if (!id) return 'no-trader';
  const operation = OPERATIONS[action.op];
  if (!operation) return 'unknown-op';
  return operation(draft, action, ctx, id);
}

export function restockTraders(draft, ctx) {
  for (const [id, state] of Object.entries(draft.traders)) {
    if (draft.day < state.restockDay) continue;
    draft.traders[id] = freshState(draft, id);
    ctx.emit({ type: 'trader-restocked', trader: id });
  }
}

function browse(draft, _action, ctx, id) {
  const greeting = traderLine(draft, id);
  openAccount(draft, id);
  ctx.emit({ type: 'trader-greeted', trader: id, ...greeting });
}

function buy(draft, { item }, ctx, id) {
  const price = buyPrice(draft, id, item);
  if (price === null) return 'hostile';
  const entry = content.traders[id].stock.find((offer) => offer.item === item);
  if (!entry || !(stockOf(draft, id)[item] > 0)) return 'not-in-stock';
  if (entry.rank && rankIndex(draft.player.rank) < rankIndex(entry.rank)) return 'rank-required';
  if (draft.player.roubles < price) return 'not-enough-roubles';
  const bought = createItem(item);
  const capacity = inventorySlots({ equipment: draft.equipment, perks: draft.player.perks });
  if (usedSlots(draft.inventory) + bought.size > capacity) return 'inventory-full';

  openAccount(draft, id).stock[item] -= 1;
  draft.inventory.push(bought);
  payRoubles(draft, -price, ctx);
  ctx.emit({ type: 'item-bought', trader: id, item, price, roubles: draft.player.roubles });
}

function sell(draft, { item }, ctx, id) {
  if (!modifierFor(draft, id)) return 'hostile';
  const index = draft.inventory.findIndex((owned) => owned.kind === item);
  if (index === -1) return 'no-item';
  const price = sellPrice(draft, id, draft.inventory[index]);
  if (price === null) return 'not-for-sale';

  openAccount(draft, id);
  draft.inventory.splice(index, 1);
  payRoubles(draft, price, ctx);
  ctx.emit({ type: 'item-sold', trader: id, item, price, roubles: draft.player.roubles });
}

function payRoubles(draft, amount, ctx) {
  draft.player.roubles += amount;
  ctx.emit({ type: 'roubles-changed', amount, roubles: draft.player.roubles });
}

function openAccount(draft, id) {
  draft.traders[id] ??= freshState(draft, id);
  return draft.traders[id];
}

function freshState(campaign, id) {
  return { stock: fullStock(id), restockDay: campaign.day + RESTOCK_DAYS };
}

function fullStock(id) {
  return Object.fromEntries(content.traders[id].stock.map(({ item, quantity }) => [item, quantity]));
}

function factionOf(id) {
  return content.places[content.traders[id].place].faction;
}

function modifierFor(campaign, id) {
  const faction = factionOf(id);
  const modifier = priceModifier(campaign, faction);
  if (!modifier || !hasPerk(campaign, 'marchandeur')) return modifier;
  const next = STANDINGS[Math.min(STANDINGS.indexOf(tierOfModifier(modifier)) + 1, STANDINGS.length - 1)];
  return PRICE_MODIFIERS[next];
}

function tierOfModifier(modifier) {
  return STANDINGS.find((tier) => PRICE_MODIFIERS[tier] === modifier);
}

function lineKey(campaign, id) {
  const tier = standing(campaign, factionOf(id));
  if (tier === 'hostile') return 'hostile';
  if (!campaign.traders[id]) return 'premiere';
  if (Object.values(campaign.quests).some((quest) => quest.status === 'active')) return 'quete';
  return tier;
}
