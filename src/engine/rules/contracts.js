// Contrats générés (brief v2 §8.1, §8.4, §6.1, §9 ; carte 22). Modèles : src/content/contrats.js.
//
// UN CONTRAT ACCEPTÉ = UNE QUÊTE GÉNÉRÉE (rules/quests.js) : l'offre porte sa quête au format
// 8.2 ({ name, start, deadline, rewards, steps }, plus contract), que startQuest range dans
// campaign.quests[id].quest. Objectifs, délai, récompenses et journal du PDA sont ceux des quêtes.
//
// GÉNÉRATION d'une offre (offerContract), à partir d'un modèle du hub :
//   tuile cible  tirée parmi les tuiles de niveau <= maxTileLevel(rang) (§8.4 « selon le rang »).
//                Hypothèse v2 : bleu 1, expérimenté 2, vétéran 3, expert et maître 4.
//   récompense   roubles = base × distance × niveau (§8.4) ; distance : liaisons entre la tuile
//                du hub et la cible, hypothèse v2 : la tuile du hub compte pour 1.
//                XP = CONTRACT_XP × niveau (hypothèse v2).
//   délai        tiré dans [min, max] du modèle (§8.4 : 2 à 5 jours).
//   objectifs    (hypothèse v2, le brief ne dit que les 5 types de la v1) :
//     livraison     'rapporter' { item: colis du modèle, npc } : un PNJ vivant de la tuile cible,
//                   hors du hub ; le colis est remis à l'acceptation
//     recuperation  'explorer' { place, card } un lieu de la tuile cible (avec un paquet), la
//                   carte contractCardId(item) de rules/places.js fixée en tête de son paquet
//                   donne l'objet ; puis 'rapporter' { item du modèle, npc : le marchand du hub }
//     elimination   'eliminer' { encounter, tile } : une carte de rencontre de la tuile cible
//     escorte       'escorter' { npc, place } : un stalker vivant du hub vers un lieu de la cible
//     cartographie  'cartographier' { tile }
//   Les lieux cibles sont les lieux de la tuile qui ne sont pas des hubs. Un modèle sans cible
//   possible sur la tuile tirée essaie les autres tuiles, puis les autres modèles du hub.
//
// TABLEAU (§8.1 : 3 visibles par hub) : service 'contrats' des hubs (HUB_SERVICES de hubs.js),
//   0 PA comme tout le hub.
//   { type: 'service', service: 'contrats' }               consulte : le tableau est tiré à la
//                                                          première consultation
//   { type: 'service', service: 'contrats', contract: id }  accepte
//     Refus : 'unknown-contract' (absent de ce tableau) | 'inventory-full' (colis)
// RENOUVELLEMENT (DAY_HOOKS.quests de rules/time.js) : chaque matin, les offres affichées depuis
//   OFFER_DAYS jours sont retirées (hypothèse v2 : 3 jours, comme les stocks des marchands) et
//   chaque tableau des hubs à contrats est complété à BOARD_SIZE.
// ÉCHEC (§8.4) : contrat raté (délai, PNJ mort) -> FAILURE_REPUTATION auprès de la faction du
//   hub (réaction contractsAfterStep, après questsAfterStep). Hypothèse v2 : -1, et rien en
//   réputation pour un contrat réussi.
//
// ÉTAT : campaign.contracts { [hubId]: [offre] }, offres affichées seulement ;
//   offre { id, template, type, tile, offered (jour), quest }
//   quest.contract = { hub, faction, template }.
//
// ÉVÉNEMENTS :
//   { type: 'contracts-board', hub, contracts: [id] }    { type: 'contract-accepted', hub, contract }
//   { type: 'contracts-renewed', hubs }                   { type: 'contract-failed', contract, hub, faction }
//   { type: 'item-gained', kind, cause: 'contrat' }       et ceux des quêtes.

import content from '../../content/index.js';
import { startQuest } from './quests.js';
import { encounterCards } from './tile.js';
import { changeReputation } from './factions.js';
import { RANKS } from './progression.js';
import { createItem } from './sheet.js';
import { contractCardId } from './places.js';
import { usedSlots, inventorySlots } from './equipment.js';

export { CONTRACT_TYPES } from '../../content/validate.js';
export const BOARD_SIZE = 3;
// Hypothèse v2 : durée d'affichage d'une offre et XP par niveau de tuile.
export const OFFER_DAYS = 3;
export const CONTRACT_XP = 25;
export const FAILURE_REPUTATION = -1;

const TYPE_NAMES = Object.freeze({
  livraison: 'Livraison', recuperation: 'Récupération', elimination: 'Élimination',
  escorte: 'Escorte', cartographie: 'Cartographie',
});

// Hypothèse v2 : niveau de tuile maximal par rang, dans l'ordre de RANKS.
const RANK_LEVELS = Object.freeze([1, 2, 3, 4, 4]);

export function tileDistance(from, to) {
  const seen = new Map([[from, 0]]);
  const queue = [from];
  while (queue.length) {
    const tile = queue.shift();
    if (tile === to) return seen.get(tile);
    for (const { tile: next } of Object.values(content.links[tile] ?? {})) {
      if (!seen.has(next)) {
        seen.set(next, seen.get(tile) + 1);
        queue.push(next);
      }
    }
  }
  return null;
}

export function maxTileLevel(rank) {
  return RANK_LEVELS[RANKS.findIndex(({ id }) => id === rank)];
}

export function contractReward(base, distance, level) {
  return base * Math.max(1, distance) * level;
}

export function contractBoard(campaign, hubId) {
  return campaign.contracts[hubId] ?? [];
}

export function offerContract(campaign, hubId, templateId, rng, id) {
  const template = content.contracts[templateId];
  const hubTile = content.places[hubId].tile;
  const tiles = Object.keys(content.tiles)
    .filter((tile) => content.tiles[tile].level <= maxTileLevel(campaign.player.rank));
  for (const tile of rng.shuffle(tiles)) {
    const steps = TARGETS[template.type](campaign, { hubId, tile, template, rng });
    if (!steps) continue;
    const distance = tileDistance(hubTile, tile);
    const { level } = content.tiles[tile];
    const quest = {
      name: `${TYPE_NAMES[template.type]} : ${content.tiles[tile].name}`,
      start: Object.keys(steps)[0],
      deadline: rng.int(...template.deadline),
      rewards: { roubles: contractReward(template.reward, distance, level), xp: CONTRACT_XP * level },
      contract: { hub: hubId, faction: template.faction, template: templateId },
      steps,
    };
    return { id, template: templateId, type: template.type, tile, offered: campaign.day, quest };
  }
  return null;
}

// Handler du service 'contrats' (HUB_SERVICES de rules/hubs.js).
export function useContractBoard(draft, action, ctx, hubId) {
  if (action.contract === undefined) {
    if (!draft.contracts[hubId]) fillBoard(draft, hubId, ctx.rng);
    ctx.emit({ type: 'contracts-board', hub: hubId, contracts: draft.contracts[hubId].map(({ id }) => id) });
    return;
  }
  const board = contractBoard(draft, hubId);
  const offer = board.find(({ id }) => id === action.contract);
  if (!offer) return 'unknown-contract';
  const { item } = content.contracts[offer.template];
  const parcel = offer.type === 'livraison' ? createItem(item) : null;
  const capacity = inventorySlots({ equipment: draft.equipment, perks: draft.player.perks });
  if (parcel && usedSlots(draft.inventory) + parcel.size > capacity) return 'inventory-full';

  board.splice(board.indexOf(offer), 1);
  ctx.emit({ type: 'contract-accepted', hub: hubId, contract: offer.id });
  if (parcel) {
    draft.inventory.push(parcel);
    ctx.emit({ type: 'item-gained', kind: item, cause: 'contrat' });
  }
  startQuest(draft, offer.id, ctx, offer.quest);
}

// Hook de changement de jour (DAY_HOOKS.quests de rules/time.js).
export function renewContracts(draft, ctx) {
  const hubs = contractHubs();
  for (const hubId of hubs) {
    draft.contracts[hubId] = contractBoard(draft, hubId).filter(({ offered }) => draft.day - offered < OFFER_DAYS);
    fillBoard(draft, hubId, ctx.rng);
  }
  ctx.emit({ type: 'contracts-renewed', hubs });
}

// Réaction (REACTIONS de campaign.js), après questsAfterStep.
export function contractsAfterStep(draft, events, ctx) {
  for (const event of events.filter(({ type }) => type === 'quest-failed')) {
    const contract = draft.quests[event.quest].quest?.contract;
    if (!contract) continue;
    ctx.emit({ type: 'contract-failed', contract: event.quest, hub: contract.hub, faction: contract.faction });
    changeReputation(draft, contract.faction, FAILURE_REPUTATION, ctx);
  }
}

const contractHubs = () => Object.keys(content.places)
  .filter((id) => content.places[id].services?.includes('contrats'));

function fillBoard(draft, hubId, rng) {
  const board = contractBoard(draft, hubId);
  draft.contracts[hubId] = board;
  const templates = Object.keys(content.contracts)
    .filter((id) => content.contracts[id].places.includes(hubId));
  while (board.length < BOARD_SIZE) {
    const offer = rng.shuffle(templates)
      .map((templateId) => offerContract(draft, hubId, templateId, rng, freeId(draft, hubId)))
      .find(Boolean);
    if (!offer) return;
    board.push(offer);
  }
}

function freeId(draft, hubId) {
  const taken = (id) => draft.quests[id] || contractBoard(draft, hubId).some((offer) => offer.id === id);
  let n = 1;
  while (taken(`contrat-${hubId}-${draft.day}-${n}`)) n += 1;
  return `contrat-${hubId}-${draft.day}-${n}`;
}

const single = (objective) => ({ contrat: { objective, next: [] } });

const placesOn = (tile) => Object.keys(content.places)
  .filter((id) => content.places[id].tile === tile && !content.places[id].tags.includes('hub'));

const aliveNpcs = (campaign, keep) => Object.keys(campaign.npcs)
  .filter((id) => campaign.npcs[id].alive && keep(campaign.npcs[id], content.npcs[id]));

const pickOrNull = (rng, items) => (items.length ? rng.pick(items) : null);

// type -> (campaign, { hubId, tile, template, rng }) -> étapes de la quête, ou null sans cible.
const TARGETS = {
  livraison: (campaign, { hubId, tile, template, rng }) => {
    const npc = pickOrNull(rng, aliveNpcs(campaign, (state) => state.tile === tile && state.place && state.place !== hubId));
    return npc && single({ type: 'rapporter', item: template.item, npc });
  },
  recuperation: (campaign, { hubId, tile, template, rng }) => {
    const place = pickOrNull(rng, placesOn(tile).filter((id) => content.places[id].deck));
    const [npc] = aliveNpcs(campaign, (state, data) => state.place === hubId && data?.role === 'marchand');
    if (!place || !npc) return null;
    return {
      aller: { objective: { type: 'explorer', place, card: contractCardId(template.item) }, next: ['rapporter'] },
      rapporter: { objective: { type: 'rapporter', item: template.item, npc }, next: [] },
    };
  },
  elimination: (campaign, { tile, rng }) => {
    const encounter = pickOrNull(rng, Object.keys(encounterCards(content.tiles[tile])));
    return encounter && single({ type: 'eliminer', encounter, tile });
  },
  escorte: (campaign, { hubId, tile, rng }) => {
    const npc = pickOrNull(rng, aliveNpcs(campaign, (state, data) => state.place === hubId && data?.role === 'stalker'));
    const place = pickOrNull(rng, placesOn(tile));
    return npc && place && single({ type: 'escorter', npc, place });
  },
  cartographie: (campaign, { tile }) => single({ type: 'cartographier', tile }),
};
