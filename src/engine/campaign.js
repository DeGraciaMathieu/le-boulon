// État de campagne v2 (brief v2 §17.1) autour du moteur v1, sans le réécrire.
//
// API :
//   createCampaign({ seed, mode = 'normal', tile, tiles, combatMode = 'rounds' })  -> campaign
//     mode : 'normal' | 'hardcore' ; combatMode : 'rounds' (combat v2) | 'rapide' (v1)
//     tile : id de la tuile de départ (START_TILE par défaut), cherché dans tiles
//     (content.tiles par défaut) ; toute tuile au format de src/engine/data/agroprom.js convient.
//   step(campaign, action)                     -> { state, events }
//     Même contrat que src/engine/game.js : pur, la campagne reçue n'est jamais modifiée ;
//     une action refusée rend le même objet campaign et un seul événement
//     { type: 'refused', action, reason }.
//   dayState(campaign)       -> état v1 de la journée sur la tuile courante (lecture seule)
//   storeDay(draft, day)     range un état v1 dans le brouillon d'une campagne
//   CAMPAIGN_VERSION, MODES, CAMPAIGN_ACTIONS, REACTIONS
//
// FORME DE L'ÉTAT (100 % JSON : JSON.parse(JSON.stringify(c)) rejoue à l'identique) :
//   {
//     version,                     CAMPAIGN_VERSION ; à monter à chaque changement de forme
//                                  (migrations : carte 3)
//     seed,                        graine de départ
//     rng,                         état du RNG (uint32), UN SEUL flux pour toute la campagne,
//                                  journées v1 comprises
//     day,                         compteur de jours, commence à 1                   carte 7
//     mode,                        'normal' | 'hardcore' (§15)                       carte 29
//     player: {
//       stats,                     { tir, survie, discretion, endurance } de la v1    carte 17
//       rank, xp, perks,           'bleu', 0, [] (rules/progression.js)              carte 17
//       wounds, radiation,         pistes 0-6 de la v1 (rules/sheet.js)
//       hunger,                    jours sans manger                                 carte 7
//       roubles,                   0 (hypothèse v2)                                  cartes 12, 13
//       faction,                   'solitaires' (§9, rejointe par défaut)            carte 16
//     },
//     inventory,                   grille v1 [{ kind, size, charges? }]              carte 9
//     equipment,                   emplacements d'équipement (rules/equipment.js)    carte 9
//     world: {
//       tiles: { [id]: tileState } état v1 de la tuile, SANS les champs de campagne
//                                  (voir « Une seule source de vérité »)             cartes 2, 6
//       currentTile,               id de la tuile courante (clé de content.tiles)    carte 6
//       hex,                       hexagone du joueur sur la tuile courante (1-19)
//       weather,                   null, carte Météo du matin                        carte 7
//       emission: { nextDay, today }  null, false                                    carte 8
//     },
//     places: { [id]: placeState }                                                   carte 10
//     npcs: { [id]: npcState }                                                       carte 19
//     quests: { [id]: questState }                                                   carte 15
//     contracts: { [hubId]: [...] }                                                  carte 22
//     traders: { [id]: { stock, restockDay } }                                       carte 13
//     reputation: { [factionId]: -3..3 }  valeurs de départ du §9 (rules/factions.js) carte 16
//     rumors, stashes,             []                                                carte 23
//     journal,                     [] journal du PDA                                 cartes 15, 28
//     dialogue?,                   { npc, dialogue, node, previousScreen } pendant un
//                                  dialogue seulement (rules/dialogue.js)            carte 14
//     combatMode,                  'rounds' | 'rapide' (rules/combat.js)             carte 18
//     combat,                      null, combat v2 en cours (rules/combat.js)        carte 18
//     screen,                      'tile' | 'place' | 'hub' | 'dialogue' | 'combat' | 'night'
//                                  toujours 'tile' ici ; chaque carte d'écran le change
//   }
//
// UNE SEULE SOURCE DE VÉRITÉ : un état v1 (src/engine/game.js) mélange la journée, la tuile et
// le joueur. La campagne garde le joueur ; world.tiles[id] garde le reste. Champs v1 tenus
// par la campagne et retirés de tileState :
//   rng -> campaign.rng ; inventory -> campaign.inventory ; seed -> campaign.seed ;
//   player.hex -> world.hex ; player.wounds, radiation, stats -> campaign.player.
// player.perks -> campaign.player : dayState les prête aux règles v1 (savoir-faire), storeDay
// ne les range pas dans la tuile.
// equipment -> campaign.equipment : dayState le prête aux règles v1, qui le lisent sans le changer.
// Restent dans tileState : tile (données), status, turn, ap, player.{ previousHex,
// woundPenalty }, tokens, detector, encounters, encounterDeck, combat, zone, mission, outcome.
// La carte 7 (Temps) sortira ap et status de la tuile vers la journée ; la carte 2 remplacera
// tileState.tile (copie des données) par une référence à content.tiles.
// dayState() recompose l'état v1 complet, storeDay() le redécoupe.
//
// BRANCHER UNE RÈGLE :
//   - Action v1 (move, exit, use, bolt, pickup, fight, flee) : rien à faire, step la relaie au
//     step v1 sur la tuile courante. Une règle par tuile s'écrit dans src/engine/rules/ comme
//     en v1 (en-tête de game.js). Pendant un combat v2 (campaign.combat), step refuse
//     'in-combat' à toute action autre que celles du round (combatRefusal de rules/combat.js).
//   - Action de campagne (sleep, camp, travel, talk, buy…) : écrire un handler
//     (draft, action, ctx) -> string | undefined dans src/engine/rules/<module>.js et
//     l'ajouter à CAMPAIGN_ACTIONS ci-dessous. Une action de campagne masque une action v1 du
//     même nom. Comme en v1, le handler valide d'abord et rend une raison de refus sans rien
//     toucher, sinon il modifie le brouillon draft (copie de la campagne) et annonce ce qu'il
//     fait par ctx.emit(event). Pour agir sur la journée : day = dayState(draft), le modifier,
//     puis storeDay(draft, day). Changer de tuile : draft.world.currentTile = id avant storeDay.
//   - Réaction (jour qui passe, Émission globale, délai de quête…) : ajouter une fonction
//     (draft, events, ctx) à REACTIONS. Elles tournent dans l'ordre après chaque action
//     acceptée, de campagne ou v1, et voient tous les événements de ce step.
//   - ctx.rng : RNG à graine dont l'état est reporté dans draft.rng à la fin du step ;
//     ctx.emit(event) ajoute un événement.
//   - Contenu (tuiles, lieux, objets, PNJ…) : src/content/index.js, objets gelés. L'état ne
//     garde que des ids et ce qui change en jeu.
//
// L'interface v1 (src/ui) et le banc v1 (bench/) restent branchés sur game.js.

import { createGame, step as stepDay } from './game.js';
import { createRng } from './rng.js';
import content from '../content/index.js';
import { talk, choose } from './rules/dialogue.js';
import { join, startingReputation } from './rules/factions.js';
import { emptyEquipment, outfit, equip, unequip } from './rules/equipment.js';
import { raiseStat, learnPerk } from './rules/progression.js';
import { COMBAT_MODES, combatOnReveal, combatRefusal, shoot, takeCover, grenade, heal, escape, parley } from './rules/combat.js';

export const CAMPAIGN_VERSION = 1;

export const MODES = Object.freeze(['normal', 'hardcore']);

// Départ au Cordon (§3.1), sur son entrée : le Camp des novices.
const START_TILE = 'cordon';
const START_RANK = 'bleu';
const START_FACTION = 'solitaires';
// Hypothèse v2 : le brief ne fixe pas les roubles de départ.
const START_ROUBLES = 0;

export const CAMPAIGN_ACTIONS = {
  talk, choose, join, equip, unequip, 'raise-stat': raiseStat, 'learn-perk': learnPerk,
  shoot, 'take-cover': takeCover, grenade, heal, escape, parley,
};

export const REACTIONS = [combatOnReveal];

export function createCampaign({ seed, mode = 'normal', tile = START_TILE, tiles = content.tiles, combatMode = 'rounds' }) {
  if (!MODES.includes(mode)) throw new Error(`mode inconnu : ${mode}`);
  if (!COMBAT_MODES.includes(combatMode)) throw new Error(`combatMode inconnu : ${combatMode}`);
  if (!tiles[tile]) throw new Error(`tuile inconnue : ${tile}`);
  const day = createGame({ seed, tile: tiles[tile] });
  const campaign = {
    version: CAMPAIGN_VERSION,
    seed,
    rng: day.rng,
    day: 1,
    mode,
    player: {
      stats: day.player.stats,
      rank: START_RANK,
      xp: 0,
      perks: [],
      wounds: day.player.wounds,
      radiation: day.player.radiation,
      hunger: 0,
      roubles: START_ROUBLES,
      faction: START_FACTION,
    },
    inventory: day.inventory,
    equipment: emptyEquipment(),
    world: {
      tiles: {},
      currentTile: tile,
      hex: day.player.hex,
      weather: null,
      emission: { nextDay: null, today: false },
    },
    places: {},
    npcs: {},
    quests: {},
    contracts: {},
    traders: {},
    reputation: startingReputation(),
    rumors: [],
    stashes: [],
    journal: [],
    combatMode,
    combat: null,
    screen: 'tile',
  };
  storeDay(campaign, day);
  outfit(campaign);
  return campaign;
}

export function step(campaign, action) {
  const blocked = combatRefusal(campaign, action);
  if (blocked) return { state: campaign, events: [{ type: 'refused', action, reason: blocked }] };
  const handler = CAMPAIGN_ACTIONS[action.type];
  const result = handler ? runCampaignAction(campaign, action, handler) : relayToTile(campaign, action);
  if (result.state === campaign) return result;

  const { state: draft, events } = result;
  const rng = createRng(draft.rng);
  const ctx = { rng, emit: (event) => events.push(event) };
  for (const react of REACTIONS) react(draft, events, ctx);
  draft.rng = rng.state();
  return { state: draft, events };
}

export function dayState(campaign) {
  const { world, player } = campaign;
  const tile = world.tiles[world.currentTile];
  return {
    ...tile,
    seed: campaign.seed,
    rng: campaign.rng,
    inventory: campaign.inventory,
    equipment: campaign.equipment,
    player: {
      ...tile.player,
      hex: world.hex,
      wounds: player.wounds,
      radiation: player.radiation,
      stats: player.stats,
      perks: player.perks,
    },
  };
}

export function storeDay(draft, day) {
  // equipment, prêté par dayState et jamais modifié par les règles v1, est laissé de côté.
  const { seed, rng, inventory, equipment, player, ...tile } = day;
  // perks, prêtés comme equipment, restent dans campaign.player.
  const { hex, wounds, radiation, stats, perks, ...tilePlayer } = player;
  draft.rng = rng;
  draft.inventory = inventory;
  draft.world.hex = hex;
  Object.assign(draft.player, { wounds, radiation, stats });
  draft.world.tiles[draft.world.currentTile] = { ...tile, player: tilePlayer };
}

function runCampaignAction(campaign, action, handler) {
  const draft = structuredClone(campaign);
  const events = [];
  const rng = createRng(draft.rng);
  const ctx = { rng, emit: (event) => events.push(event) };
  const refusal = handler(draft, action, ctx);
  if (refusal) return { state: campaign, events: [{ type: 'refused', action, reason: refusal }] };
  draft.rng = rng.state();
  return { state: draft, events };
}

function relayToTile(campaign, action) {
  const day = dayState(campaign);
  const result = stepDay(day, action);
  if (result.state === day) return { state: campaign, events: result.events };
  const draft = structuredClone(campaign);
  storeDay(draft, result.state);
  return { state: draft, events: result.events };
}
