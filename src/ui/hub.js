// Lectures de l'écran Hub et de l'écran Marchand (brief v2 §16, §6 ; carte 26). Pures : elles
// lisent la campagne et le contenu sans rien modifier et ne touchent pas au DOM (testées par
// tests/hub-screen.test.js). Le dessin est dans hub-view.js.
//
//   hubTabs(campaign)       -> [{ id, label, service, ready }]  onglets du §16 que ce hub a ;
//                              ready : faux pour un service que le moteur n'a pas encore branché
//   hubScreen(campaign)     -> null | { hub, name, faction, factionName, standing, tabs,
//                                       bed: { price, affordable } | null }
//   traderScreen(campaign)  -> null | { trader, name, line, roubles, slots: { used, max },
//                                       inventory: [{ kind, name, size, charges, price, refusal }],
//                                       stock: [{ item, name, size, quantity, price, rank, refusal }] }
//     price : prix de vente (inventaire) ou d'achat (stock), null si le marchand refuse ;
//     refusal : la raison que rendrait le moteur (rules/traders.js), null si l'échange passe.
//   chestScreen(campaign)   -> null | { slots, inventory: [{ kind, name, size, charges }],
//                                       chest: [{ kind, name, size, charges, refusal }] }
//   contractsScreen(campaign) -> null | { drawn, offers: [{ id, name, type, tile, tileName,
//                                         deadline, roubles, xp, daysLeft, refusal }] }
//     drawn : faux tant que le tableau n'a pas été tiré (première consultation, 0 PA).
//
// Les refus sont recalculés ici pour griser les objets ; le moteur reste seul juge à l'action.

import content from '../content/index.js';
import { hubView, HUB_SERVICES } from '../engine/rules/hubs.js';
import { traderOf, stockOf, buyPrice, sellPrice, traderLine } from '../engine/rules/traders.js';
import { contractBoard, OFFER_DAYS } from '../engine/rules/contracts.js';
import { standing } from '../engine/rules/factions.js';
import { RANKS } from '../engine/rules/progression.js';
import { usedSlots, inventorySlots } from '../engine/rules/equipment.js';

// Onglets dans l'ordre du §16, avec le service du §6.1 qui les ouvre.
export const HUB_TABS = Object.freeze([
  { id: 'marchand', label: 'Marchand', service: 'marchand' },
  { id: 'barman', label: 'Barman', service: 'barman' },
  { id: 'medecin', label: 'Médecin', service: 'medecin' },
  { id: 'technicien', label: 'Technicien', service: 'technicien' },
  { id: 'coffre', label: 'Coffre', service: 'coffre' },
  { id: 'contrats', label: 'Contrats', service: 'contrats' },
  { id: 'dormir', label: 'Dormir', service: 'lit' },
]);

// Coffre et lit sont des actions du hub (chest-put/take, sleep), pas des HUB_SERVICES.
const HUB_ACTIONS = ['coffre', 'lit'];

export const RANK_NAMES = Object.freeze({
  bleu: 'Bleu', experimente: 'Expérimenté', veteran: 'Vétéran', expert: 'Expert', maitre: 'Maître',
});

const rankIndex = (rank) => RANKS.findIndex(({ id }) => id === rank);
const itemName = (kind) => content.items[kind]?.name ?? kind;

export function hubTabs(campaign) {
  const view = hubView(campaign);
  if (!view) return [];
  return HUB_TABS.filter(({ service }) => view.services.includes(service))
    .map((tab) => ({ ...tab, ready: HUB_ACTIONS.includes(tab.service) || Boolean(HUB_SERVICES[tab.service]) }));
}

export function hubScreen(campaign) {
  const view = hubView(campaign);
  if (!view) return null;
  const hasBed = view.services.includes('lit');
  return {
    hub: view.hub,
    name: content.places[view.hub].name,
    faction: view.faction,
    factionName: content.factions[view.faction]?.name ?? view.faction,
    standing: standing(campaign, view.faction),
    tabs: hubTabs(campaign),
    bed: hasBed ? { price: view.bedPrice, affordable: campaign.player.roubles >= view.bedPrice } : null,
  };
}

export function traderScreen(campaign) {
  const view = hubView(campaign);
  const id = view && traderOf(view.hub);
  if (!id) return null;
  const slots = slotsOf(campaign);
  const stock = stockOf(campaign, id);
  return {
    trader: id,
    name: content.npcs[content.traders[id].npc]?.name ?? id,
    line: traderLine(campaign, id),
    roubles: campaign.player.roubles,
    slots,
    inventory: campaign.inventory.map((item) => {
      const price = sellPrice(campaign, id, item);
      return { ...describeItem(item), price, refusal: sellRefusal(campaign, id, item.kind, price) };
    }),
    stock: content.traders[id].stock.map(({ item, rank }) => {
      const price = buyPrice(campaign, id, item);
      const quantity = stock[item] ?? 0;
      const offer = { item, name: itemName(item), size: content.items[item].size, quantity, price, rank: rank ?? null };
      return { ...offer, refusal: buyRefusal(campaign, offer, slots) };
    }),
  };
}

export function chestScreen(campaign) {
  const view = hubView(campaign);
  if (!view?.chest) return null;
  const slots = slotsOf(campaign);
  return {
    slots,
    inventory: campaign.inventory.map(describeItem),
    chest: view.chest.map((item) => ({
      ...describeItem(item),
      refusal: slots.used + item.size > slots.max ? 'inventory-full' : null,
    })),
  };
}

export function contractsScreen(campaign) {
  const view = hubView(campaign);
  if (!view?.services.includes('contrats')) return null;
  const slots = slotsOf(campaign);
  return {
    drawn: Boolean(campaign.contracts[view.hub]),
    offers: contractBoard(campaign, view.hub).map((offer) => {
      const { quest } = offer;
      const parcel = offer.type === 'livraison' ? content.items[content.contracts[offer.template].item] : null;
      return {
        id: offer.id,
        name: quest.name,
        type: offer.type,
        tile: offer.tile,
        tileName: content.tiles[offer.tile].name,
        deadline: quest.deadline,
        roubles: quest.rewards.roubles,
        xp: quest.rewards.xp,
        daysLeft: OFFER_DAYS - (campaign.day - offer.offered),
        refusal: parcel && slots.used + parcel.size > slots.max ? 'inventory-full' : null,
      };
    }),
  };
}

function slotsOf(campaign) {
  return {
    used: usedSlots(campaign.inventory),
    max: inventorySlots({ equipment: campaign.equipment, perks: campaign.player.perks }),
  };
}

function describeItem(item) {
  return { kind: item.kind, name: itemName(item.kind), size: item.size, charges: item.charges ?? null };
}

// Même ordre de refus que buy() de rules/traders.js.
function buyRefusal(campaign, { price, quantity, rank, size }, slots) {
  if (price === null) return 'hostile';
  if (!(quantity > 0)) return 'not-in-stock';
  if (rank && rankIndex(campaign.player.rank) < rankIndex(rank)) return 'rank-required';
  if (campaign.player.roubles < price) return 'not-enough-roubles';
  if (slots.used + size > slots.max) return 'inventory-full';
  return null;
}

// Même ordre de refus que sell() de rules/traders.js ; buyPrice n'est null que chez un hostile.
function sellRefusal(campaign, id, kind, price) {
  if (buyPrice(campaign, id, kind) === null) return 'hostile';
  if (price === null) return 'not-for-sale';
  return null;
}
