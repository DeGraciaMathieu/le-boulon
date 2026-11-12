// Hubs (brief v2 §6.1, §4.3 ; carte 12) : écran Hub, services, actions sans PA, lit, coffre.
// Contenu : lieux tagués 'hub' de src/content/lieux.js, avec faction et services du §6.1
// ('marchand', 'barman', 'medecin', 'technicien', 'lit', 'coffre', 'contrats').
//
// ÉTAT (champs facultatifs : pas de changement de CAMPAIGN_VERSION) :
//   campaign.hub     { id }   pendant la visite d'un hub seulement (screen = 'hub', 'dialogue'
//                             ou 'night' quand on y dort)
//   campaign.chests  { [hubId]: [objet d'inventaire { kind, size, charges? }] }  créé au premier
//                             dépôt. Hypothèse v2 : un coffre par hub, sans limite de place.
//
// ACTIONS DE CAMPAGNE (CAMPAIGN_ACTIONS de campaign.js), toutes à 0 PA (§6.1) :
//   { type: 'enter-hub', hub? }   ouvre l'écran hub du lieu tagué 'hub' sur l'hexagone du
//     joueur (hub, s'il est donné, doit être celui-là). Le pas sur l'hexagone a déjà coûté son PA.
//     'enter-place' sur un hub fait de même (enterHubOrPlace), les autres lieux restent à places.js.
//     Refus : 'in-hub' | 'in-place' | 'in-dialogue' | 'in-combat' | 'day-over' | 'no-hub'
//   { type: 'leave-hub' }         retour à l'écran tuile. Refus : 'not-in-hub' | 'in-dialogue'
//   { type: 'chest-put', item }   range le premier objet de ce type de l'inventaire (pile et
//                                 charges comprises) dans le coffre du hub
//   { type: 'chest-take', item }  le reprend du coffre ; refus si la grille déborde
//     Refus : 'not-in-hub' | 'in-dialogue' | 'no-chest' | 'no-item' | 'not-in-chest'
//             | 'inventory-full'
//   { type: 'service', service, ...}  passe la main au handler HUB_SERVICES[service]
//     (draft, action, ctx, hubId) -> raison | undefined, au format d'un handler de campagne.
//     Refus : 'not-in-hub' | 'in-dialogue' | 'no-service' (absent de ce hub)
//             | 'service-unavailable' (pas encore branché) | raison du handler
//   Le lit est l'action sleep de rules/time.js (lit du hub, BED_PRICE hors de sa faction) ;
//   le réveil rend l'écran hub (réaction hubsAfterStep).
//
// DANS UN HUB, HUB_OVERRIDES remplace (step de campaign.js, quand campaign.hub est posé) :
//   use : objet utilisé sans PA ; move, exit, bolt, pickup, fight, flee, travel, camp,
//   explore, bolt-card : refusés ('in-hub'). Parler, s'équiper, dormir restent permis.
//   Zone sûre (§6.1) : pas de jetons ni de rencontres puisque la tuile ne se joue pas ;
//   la carte 8 (Émission) lit inHub(campaign) pour épargner le joueur.
//
// POINTS D'ACCROCHE :
//   HUB_SERVICES = { [service]: handler }    'marchand' (rules/traders.js), carte 22 'contrats',
//                                            barman, medecin, technicien
//   hubAt(campaign) -> hubId | null          hub sur l'hexagone du joueur
//   inHub(campaign) -> bool                  carte 8 Émission
//   hubView(campaign) -> null | { hub, faction, services, bedPrice, chest }   carte 26 Écran Hub
//     chest : contenu du coffre, null si le hub n'en a pas.
//
// ÉVÉNEMENTS :
//   { type: 'hub-entered', hub }   { type: 'hub-left', hub }
//   { type: 'chest-stored', hub, item }   { type: 'chest-taken', hub, item }
//   et ceux des actions relayées (used, day-ended…).

import content from '../../content/index.js';
import { dayState, storeDay } from '../campaign.js';
import { dayContext } from '../game.js';
import { enterPlace } from './places.js';
import { use } from './sheet.js';
import { usedSlots, inventorySlots } from './equipment.js';
import { memberPerks } from './factions.js';
import { BED_PRICE } from './time.js';
import { trade } from './traders.js';

export const HUB_SERVICES = { marchand: trade };

const refuseInHub = () => 'in-hub';

export const HUB_OVERRIDES = {
  use: useForFree,
  ...Object.fromEntries(['move', 'exit', 'bolt', 'pickup', 'fight', 'flee', 'travel', 'camp', 'explore', 'bolt-card']
    .map((type) => [type, refuseInHub])),
};

export function hubAt(campaign) {
  const { currentTile, hex } = campaign.world;
  const found = Object.entries(content.places).find(([, place]) =>
    place.tags.includes('hub') && place.tile === currentTile && place.hex === hex);
  return found?.[0] ?? null;
}

export function inHub(campaign) {
  return Boolean(campaign.hub);
}

export function hubView(campaign) {
  if (!campaign.hub) return null;
  const { id } = campaign.hub;
  const { faction, services } = content.places[id];
  return {
    hub: id,
    faction,
    services: [...services],
    bedPrice: memberPerks(campaign, faction).freeBed ? 0 : BED_PRICE,
    chest: services.includes('coffre') ? [...(campaign.chests?.[id] ?? [])] : null,
  };
}

// Handlers en déclarations de fonctions : campaign.js et ce module s'importent l'un l'autre.
export function enterHub(draft, { hub }, ctx) {
  if (draft.hub) return 'in-hub';
  if (draft.place) return 'in-place';
  if (draft.dialogue) return 'in-dialogue';
  const day = dayState(draft);
  if (day.combat) return 'in-combat';
  if (day.status !== 'playing') return 'day-over';
  const here = hubAt(draft);
  if (!here || (hub && hub !== here)) return 'no-hub';

  draft.hub = { id: here };
  draft.screen = 'hub';
  ctx.emit({ type: 'hub-entered', hub: here });
}

export function enterHubOrPlace(draft, action, ctx) {
  if (content.places[action.place]?.tags.includes('hub')) return enterHub(draft, { hub: action.place }, ctx);
  if (draft.hub) return 'in-hub';
  return enterPlace(draft, action, ctx);
}

export function leaveHub(draft, _action, ctx) {
  const refusal = visitRefusal(draft);
  if (refusal) return refusal;
  const { id } = draft.hub;
  delete draft.hub;
  draft.screen = 'tile';
  ctx.emit({ type: 'hub-left', hub: id });
}

export function chestPut(draft, { item }, ctx) {
  const refusal = chestRefusal(draft);
  if (refusal) return refusal;
  const index = draft.inventory.findIndex((owned) => owned.kind === item);
  if (index === -1) return 'no-item';

  const { id } = draft.hub;
  draft.chests ??= {};
  draft.chests[id] ??= [];
  draft.chests[id].push(...draft.inventory.splice(index, 1));
  ctx.emit({ type: 'chest-stored', hub: id, item });
}

export function chestTake(draft, { item }, ctx) {
  const refusal = chestRefusal(draft);
  if (refusal) return refusal;
  const { id } = draft.hub;
  const chest = draft.chests?.[id] ?? [];
  const index = chest.findIndex((stored) => stored.kind === item);
  if (index === -1) return 'not-in-chest';
  const capacity = inventorySlots({ equipment: draft.equipment, perks: draft.player.perks });
  if (usedSlots(draft.inventory) + chest[index].size > capacity) return 'inventory-full';

  draft.inventory.push(...chest.splice(index, 1));
  ctx.emit({ type: 'chest-taken', hub: id, item });
}

export function useService(draft, action, ctx) {
  const refusal = visitRefusal(draft);
  if (refusal) return refusal;
  const { id } = draft.hub;
  if (!content.places[id].services.includes(action.service)) return 'no-service';
  const handler = HUB_SERVICES[action.service];
  if (!handler) return 'service-unavailable';
  return handler(draft, action, ctx, id);
}

// Réaction (REACTIONS de campaign.js) : on se réveille dans le hub où l'on a dormi.
export function hubsAfterStep(draft, events) {
  if (draft.hub && events.some((event) => event.type === 'day-started')) draft.screen = 'hub';
}

function useForFree(draft, action, ctx) {
  const day = dayState(draft);
  const dctx = { ...dayContext(day, ctx.rng, ctx.emit), spend: () => {} };
  const refusal = use(day, action, dctx);
  if (refusal) return refusal;
  storeDay(draft, day);
}

function visitRefusal(draft) {
  if (!draft.hub) return 'not-in-hub';
  if (draft.dialogue) return 'in-dialogue';
}

function chestRefusal(draft) {
  const refusal = visitRefusal(draft);
  if (refusal) return refusal;
  if (!content.places[draft.hub.id].services.includes('coffre')) return 'no-chest';
}
