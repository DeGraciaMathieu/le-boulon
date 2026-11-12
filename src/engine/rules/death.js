// La mort (brief v2 §15, règle Q4 tranchée par Mathieu ; carte 29). Mode normal : le joueur se
// réveille au dernier hub visité. Mode hardcore : la mort efface la sauvegarde ; l'effacement
// est côté navigateur (eraseCampaign de src/ui/storage.js), le moteur refuse la réapparition.
//
// ÉTAT (champ facultatif : pas de changement de CAMPAIGN_VERSION) :
//   campaign.lastHub   id du dernier hub visité (entrée dans le hub ou nuit à son lit).
//                      Absent : START_HUB, le hub de départ (hypothèse v2).
//
// LECTURES (pures) :
//   isDead(campaign)       la journée de la tuile courante est en status 'dead'
//   respawnHub(campaign)   hub de réapparition
//   deathView(campaign) -> null | { mode, hub, hubName, lost: [kind], kept: [kind], roubles,
//                                   xp: { before, after } }   pour l'écran de mort
//
// ACTION DE CAMPAGNE (CAMPAIGN_ACTIONS de campaign.js) :
//   { type: 'respawn' }  mode normal, joueur mort. Perd l'inventaire et l'équipement, sauf les
//     objets de quête (catégorie 'quete', rendus par un PNJ) ; garde roubles et coffres, et
//     XP_KEPT de l'XP gagnée dans le rang en cours (le rang reste). La journée de la mort est
//     close (combat v1 et visite fermés), le joueur passe sur l'hexagone du hub, dans le hub
//     (campaign.hub) et la nuit au lit (night { rest: 'lit', place, cardDrawn: true }) : le
//     wake de rules/time.js lance le jour suivant et son autosave.
//     Refus : 'not-dead' | 'hardcore'. Permise la nuit (NIGHT_ACTIONS de rules/time.js).
//
// RÉACTION (REACTIONS de campaign.js) : rememberHub, sur 'hub-entered' et 'day-ended' au lit.
//
// ÉVÉNEMENT : { type: 'respawned', hub, lost: [kind], xp: { before, after } }
//
// HYPOTHÈSES V2 : blessures, radiations et faim remises à 0 ; « 10 % de l'XP du rang en cours »
// lu comme 10 % de l'XP gagnée depuis le seuil du rang ; l'équipement porté est perdu avec
// l'inventaire.

import content from '../../content/index.js';
import { dayState, storeDay } from '../campaign.js';
import { emptyEquipment } from './equipment.js';
import { RANKS } from './progression.js';
import { newTileState } from './world.js';

export const START_HUB = 'camp-novices';
export const XP_KEPT = 0.1;

const isQuestItem = (item) => content.items[item.kind]?.category === 'quete';

export function isDead(campaign) {
  return dayState(campaign).status === 'dead';
}

export function respawnHub(campaign) {
  return campaign.lastHub ?? START_HUB;
}

export function deathView(campaign) {
  if (!isDead(campaign)) return null;
  const hub = respawnHub(campaign);
  const carried = [...campaign.inventory, ...equippedItems(campaign.equipment)];
  return {
    mode: campaign.mode,
    hub,
    hubName: content.places[hub].name,
    lost: carried.filter((item) => !isQuestItem(item)).map((item) => item.kind),
    kept: carried.filter(isQuestItem).map((item) => item.kind),
    roubles: campaign.player.roubles,
    xp: { before: campaign.player.xp, after: keptXp(campaign.player) },
  };
}

// Handler en déclaration de fonction : campaign.js et ce module s'importent l'un l'autre.
export function respawn(draft, _action, ctx) {
  if (!isDead(draft)) return 'not-dead';
  if (draft.mode === 'hardcore') return 'hardcore';
  const { hub, lost, xp } = deathView(draft);

  closeDay(draft);
  draft.inventory = draft.inventory.filter(isQuestItem);
  draft.equipment = emptyEquipment();
  Object.assign(draft.player, { wounds: 0, radiation: 0, hunger: 0, xp: xp.after });
  delete draft.place;
  delete draft.dialogue;
  draft.combat = null;

  const { tile, hex } = content.places[hub];
  // Hub sur une tuile jamais visitée (dernier hub retenu sans y être allé) : tuile neuve.
  draft.world.tiles[tile] ??= newTileState({ tile, hex }, ctx);
  draft.world.currentTile = tile;
  draft.world.hex = hex;
  closeDay(draft);
  draft.hub = { id: hub };
  draft.lastHub = hub;
  draft.night = { rest: 'lit', place: hub, cardDrawn: true };
  draft.screen = 'night';
  ctx.emit({ type: 'respawned', hub, lost, xp });
}

export function rememberHub(draft, events) {
  for (const event of events) {
    if (event.type === 'hub-entered') draft.lastHub = event.hub;
    if (event.type === 'day-ended' && event.rest === 'lit') draft.lastHub = event.place;
  }
}

function keptXp({ rank, xp }) {
  const floor = RANKS.find(({ id }) => id === rank).xp;
  return floor + Math.floor((xp - floor) * XP_KEPT);
}

function equippedItems(equipment) {
  const { belt = [], ...slots } = equipment;
  return [...Object.values(slots).filter(Boolean), ...belt];
}

// Journée de la tuile courante finie : 0 PA, sans combat ni défaite.
function closeDay(draft) {
  const day = dayState(draft);
  day.status = 'night';
  day.combat = null;
  day.outcome = null;
  day.ap = { ...day.ap, left: 0 };
  day.player = { ...day.player, woundPenalty: false };
  storeDay(draft, day);
}
