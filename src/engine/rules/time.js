// Le temps (brief v2 §4, §14, carte 7) : fin de journée, nuit, météo, faim, nouveau jour.
// Contenu : content.decks (src/content/paquets/nuit.js, meteo.js), content.places (lits des hubs).
//
// FIN DE JOURNÉE (trois façons, §4.1) : les PA restants sont perdus (ap.left = 0), la journée
// v1 de la tuile passe en status 'night', screen = 'night' et campaign.night est posé :
//   campaign.night  { rest, place?, cardDrawn }   présent seulement pendant la nuit
//     rest       'lit' | 'abri' | 'decouvert'     abri : hexagone abri de la tuile (tile.hexes[n].abri)
//     place      hub du lit
//     cardDrawn  carte Nuit déjà résolue (true d'office pour un lit)
//   Champ facultatif : pas de changement de CAMPAIGN_VERSION.
//
// ACTIONS DE CAMPAGNE (CAMPAIGN_ACTIONS de campaign.js) :
//   { type: 'sleep' }  lit d'un hub : lieu tagué 'hub' avec le service 'lit' sur l'hexagone du
//                      joueur (écran 'hub' compris). Gratuit dans le hub de sa faction
//                      (memberPerks(...).freeBed de factions.js), sinon BED_PRICE roubles.
//                      -1 blessure tout de suite. Le lendemain sans malus de bivouac.
//     Refus : 'game-over' | 'in-combat' | 'no-bed' | 'not-enough-roubles'
//   { type: 'camp' }   bivouac là où l'on est : 'abri' ou 'decouvert'.
//     Refus : 'game-over' | 'in-combat'
//   { type: 'wake' }   résout la nuit puis lance le nouveau jour (newDay).
//     1. Bivouac, carte Nuit pas encore tirée : carte Nuit du paquet de la tuile (kind 'nuit',
//        tile = tuile courante). À découvert, sauf carte 'rencontre' : test de Discrétion de nuit
//        (Fantôme compris), échec = rencontre de nuit. Une rencontre de nuit ouvre un combat v2
//        (startCombat de combat.js) sur l'hexagone du joueur, carte piochée dans le paquet de
//        rencontres de la tuile ; le combat rend l'écran 'night' et un second wake lance le jour.
//     2. Sinon : newDay.
//     Refus : 'not-night' (pas la nuit) | 'game-over' (mort pendant la nuit)
//   Pendant la nuit, step refuse 'night' à toute autre action, sauf celles du combat
//   (nightRefusal, appelée par step de campaign.js après combatRefusal).
//
// RÉACTION (REACTIONS de campaign.js) : endDayOnExhaustion
//   Journée v1 en status 'night' hors écran nuit (0 PA par une action v1, un voyage, une fuite) :
//   bivouac forcé là où l'on est. L'événement { type: 'day-ended', reason: 'no-ap' } est déjà
//   émis par la règle qui a dépensé le dernier PA. La défaite v1 par la nuit est retirée : plus
//   d'événement 'game-over' de cause 'night', tileState.outcome remis à null. Après un combat
//   de nuit, le 'day-ended' que combat.js réémet à 0 PA est retiré (la journée est déjà finie).
//
// NOUVEAU JOUR : newDay(draft, ctx, hooks = DAY_HOOKS), dans cet ordre :
//   1. day + 1
//   2. hooks de changement de jour, dans l'ordre DAY_HOOK_ORDER, chacun (draft, ctx) :
//        npcs      PNJ itinérants (carte 19, rules/npcs.js)
//        traders   restock des marchands (restockTraders de rules/traders.js)
//        emission  calendrier de l'Émission (carte 8) : pose world.emission avant la Météo ;
//                  puis vieillissement des rumeurs (ageRumors de rules/stashes.js, carte 23)
//        quests    délais des quêtes (carte 15) ; renouvellement des contrats (carte 22,
//                  renewContracts de rules/contracts.js)
//        patrols   circulation des patrouilles (movePatrols de rules/patrols.js, LBL-49)
//      Chaque carte ajoute sa fonction dans son tableau ci-dessous.
//   3. carte Météo : 'signes-emission' si world.emission.nextDay === day (le paquet reste à la
//      carte 8 pour l'annonce, l'Émission elle-même n'est pas jouée ici), sinon pioche pondérée
//      (count) parmi les autres cartes du paquet 'meteo'. world.weather = id de la carte.
//   4. repas : une ration, sinon le premier objet de catégorie 'nourriture' ; hunger = 0.
//      Rien à manger : hunger + 1.
//   5. budget de PA : BASE_AP + Endurance + apBonus(equipment) - HUNGER_MALUS (hunger ≥ 1)
//      - OPEN_AIR_MALUS (bivouac à découvert) - 1 (4 blessures ou plus, pénalité v1, posée une
//      fois : player.woundPenalty), jamais sous 0. ap.spent = 0, ap.boosted retiré (boisson
//      énergétique de nouveau permise). Journée v1 de la tuile courante en 'playing'.
//   6. coût de ceinture : beltRadiation(equipment) radiations (cause 'ceinture'), puis faim de
//      2 jours ou plus : 1 blessure (cause 'faim'). Ces blessures passent par wound (sheet.js).
//   7. paquet Zone de la tuile courante remélangé (setupZone), avec la carte Émission le jour
//      annoncé seulement (world.emission.today, rules/emission.js).
//   8. screen 'tile', campaign.night retiré, événement day-started (l'autosave de la carte 29
//      s'y branche).
//
// MÉTÉO ET NUIT DANS LES RÈGLES : dayState prête weather (id de carte Météo) et isNight
// (écran nuit) à la journée v1. Lectures pures :
//   weatherOf(state)              carte Météo du jour, ou null (journée v1, jour 1)
//   conditionsBonus(state, stat)  Discrétion : stealth de la carte Météo + Fantôme
//                                 (stealthBonus de progression.js, night = isNight,
//                                 rain = carte 'pluie') ; ajouté par skillCheck (game.js)
//   detectorModifier(state)       detector de la carte Météo, ajouté à la portée du détecteur
//                                 (scanWithDetector, suspects.js)
//
// ÉVÉNEMENTS :
//   { type: 'day-ended', reason: 'sleep' | 'camp' | 'no-ap', rest?, place?, cost?, healed? }
//   { type: 'night-card', deck, card }        { type: 'night-encounter', card }
//   { type: 'weather', card }                 { type: 'meal', item }
//   { type: 'hunger', days, ap, wounds }      { type: 'day-started', day, ap, weather }
//   et ceux de la fiche (irradiated, wounded, died) et du combat (combat-started…).
//
// HYPOTHÈSES V2 :
//   - Le jour 1 n'a pas de carte Météo (weather null).
//   - Les compositions des paquets Nuit et Météo, les effets des cartes Nuit.
//   - La rencontre de nuit se joue en combat v2 même en combatMode 'rapide' ; la fuite y coûte
//     2 PA comme le jour, donc impossible à 0 PA.
//   - Le coût de ceinture n'est pas réduit par la protection contre les radiations.
//   - La faim de 2 jours ou plus donne 1 blessure chaque matin tant qu'on ne mange pas.
//   - Le lit soigne au coucher ; dormir au lit se fait à toute heure, PA restants perdus.
//   - ap et status restent dans l'état de la tuile courante : le nouveau budget va à la tuile
//     où l'on se réveille ; seul son paquet Zone est remélangé.

import { dayState, storeDay } from '../campaign.js';
import { BASE_AP, skillCheck } from '../game.js';
import { startCombat } from './combat.js';
import { encounterCards } from './tile.js';
import { setupZone } from './zone.js';
import { scheduleEmission } from './emission.js';
import { ageRumors } from './stashes.js';
import { apBonus, beltRadiation } from './equipment.js';
import { memberPerks } from './factions.js';
import { stealthBonus } from './progression.js';
import { TRACK_MAX, RADIATION_RESET, WOUND_PENALTY_AT, irradiate, wound } from './sheet.js';
import { restockTraders } from './traders.js';
import { renewContracts } from './contracts.js';
import { movePatrols } from './patrols.js';
import content from '../../content/index.js';

export const BED_PRICE = 50;
export const OPEN_AIR_MALUS = 2;
export const HUNGER_MALUS = 2;
// « Deux jours de suite : en plus, 1 blessure » (§4.4).
const STARVING_DAYS = 2;
const STARVING_WOUNDS = 1;
const WOUND_AP_MALUS = 1;
const MEAL = 'ration';
const UINT32_MAX = 0xffffffff;

export const DAY_HOOK_ORDER = Object.freeze(['npcs', 'traders', 'emission', 'quests', 'patrols']);

export const DAY_HOOKS = Object.freeze({
  npcs: Object.freeze([]),
  traders: Object.freeze([restockTraders]),
  emission: Object.freeze([scheduleEmission, ageRumors]),
  quests: Object.freeze([renewContracts]),
  patrols: Object.freeze([movePatrols]),
});

// respawn : mort pendant la nuit (rules/death.js).
const NIGHT_ACTIONS = Object.freeze(['wake', 'respawn']);

export function weatherOf(state) {
  if (!state.weather) return null;
  return content.decks.meteo.cards.find((card) => card.id === state.weather) ?? null;
}

export function conditionsBonus(state, stat) {
  if (stat !== 'discretion') return 0;
  const weather = weatherOf(state);
  const rain = weather?.type === 'pluie';
  return (weather?.stealth ?? 0) + stealthBonus(state, { night: state.isNight === true, rain });
}

export function detectorModifier(state) {
  return weatherOf(state)?.detector ?? 0;
}

export function nightRefusal(campaign, action) {
  if (campaign.screen === 'night' && !campaign.combat && !NIGHT_ACTIONS.includes(action.type)) return 'night';
}

// Handlers en déclarations de fonctions : campaign.js et ce module s'importent l'un l'autre.
export function sleep(draft, _action, ctx) {
  const refusal = dayRefusal(draft);
  if (refusal) return refusal;
  const hub = bedHere(draft);
  if (!hub) return 'no-bed';
  const cost = memberPerks(draft, content.places[hub].faction).freeBed ? 0 : BED_PRICE;
  if (draft.player.roubles < cost) return 'not-enough-roubles';

  draft.player.roubles -= cost;
  const healed = Math.min(1, draft.player.wounds);
  draft.player.wounds -= healed;
  endDay(draft, { rest: 'lit', place: hub, cardDrawn: true });
  ctx.emit({ type: 'day-ended', reason: 'sleep', rest: 'lit', place: hub, cost, healed });
}

export function camp(draft, _action, ctx) {
  const refusal = dayRefusal(draft);
  if (refusal) return refusal;
  const rest = restHere(draft);
  endDay(draft, { rest, cardDrawn: false });
  ctx.emit({ type: 'day-ended', reason: 'camp', rest });
}

export function wake(draft, _action, ctx) {
  if (draft.screen !== 'night') return 'not-night';
  if (dayState(draft).status === 'dead') return 'game-over';
  if (!draft.night.cardDrawn) {
    draft.night.cardDrawn = true;
    resolveNight(draft, ctx);
    if (draft.combat) return;
  }
  newDay(draft, ctx);
}

export function endDayOnExhaustion(draft, events, ctx) {
  dropNightDefeat(events);
  if (draft.screen === 'night') {
    if (events.some((event) => event.type === 'combat-ended')) dropEvents(events, isNoApDayEnd);
    return;
  }
  const tile = draft.world.tiles[draft.world.currentTile];
  if (tile?.status !== 'night' || draft.combat) return;
  tile.outcome = null;
  draft.night = { rest: restHere(draft), cardDrawn: false };
  draft.screen = 'night';
}

export function newDay(draft, ctx, hooks = DAY_HOOKS) {
  draft.day += 1;
  for (const name of DAY_HOOK_ORDER) for (const hook of hooks[name]) hook(draft, ctx);

  draft.world.weather = drawWeather(draft, ctx);
  ctx.emit({ type: 'weather', card: draft.world.weather });
  eatBreakfast(draft, ctx);

  const day = dayState(draft);
  startBudget(draft, day);
  const cost = beltRadiation(draft.equipment);
  if (cost > 0) payBelt(day, cost, ctx);
  if (draft.player.hunger >= STARVING_DAYS) wound(day, STARVING_WOUNDS, 'faim', ctx.emit);
  reshuffleZone(day, draft.world.emission.today, ctx);
  storeDay(draft, day);

  delete draft.night;
  draft.screen = 'tile';
  ctx.emit({ type: 'day-started', day: draft.day, ap: day.ap.max, weather: draft.world.weather });
}

function dayRefusal(draft) {
  const day = dayState(draft);
  if (day.status !== 'playing') return 'game-over';
  if (day.combat) return 'in-combat';
}

function bedHere(draft) {
  const { currentTile, hex } = draft.world;
  const hubs = Object.entries(content.places).filter(([, place]) =>
    place.tile === currentTile && place.tags.includes('hub') && place.services?.includes('lit'));
  return hubs.find(([, place]) => place.hex === hex)?.[0]
    ?? (draft.screen === 'hub' && hubs.length === 1 ? hubs[0][0] : undefined);
}

function restHere(draft) {
  const { tile } = draft.world.tiles[draft.world.currentTile];
  return tile.hexes[draft.world.hex]?.abri ? 'abri' : 'decouvert';
}

function endDay(draft, night) {
  const day = dayState(draft);
  day.ap = { ...day.ap, left: 0 };
  day.status = 'night';
  storeDay(draft, day);
  draft.night = night;
  draft.screen = 'night';
}

function resolveNight(draft, ctx) {
  const deck = nightDeckOf(draft.world.currentTile);
  const card = weightedPick(content.decks[deck].cards, ctx.rng);
  ctx.emit({ type: 'night-card', deck, card: card.id });

  const day = dayState(draft);
  if (card.type === 'radiations') irradiate(day, card.amount, 'nuit', ctx.emit);
  if (card.type === 'blessure') wound(day, card.amount, 'nuit', ctx.emit);
  storeDay(draft, day);
  if (day.status !== 'playing' && day.status !== 'night') return;

  const ambushed = card.type === 'rencontre'
    || (draft.night.rest === 'decouvert' && !nightCheck(draft, ctx));
  if (ambushed) nightEncounter(draft, ctx);
}

function nightDeckOf(tile) {
  return Object.keys(content.decks).find((id) => content.decks[id].kind === 'nuit' && content.decks[id].tile === tile);
}

function nightCheck(draft, ctx) {
  const day = dayState(draft);
  const success = skillCheck(day, 'discretion', 0, ctx);
  storeDay(draft, day);
  return success;
}

function nightEncounter(draft, ctx) {
  const day = dayState(draft);
  if (day.encounterDeck.length === 0) day.encounterDeck = ctx.rng.shuffle(Object.keys(encounterCards(day.tile)));
  const card = day.encounterDeck.shift();
  // Le combat v2 se joue sur une journée en cours ; il la rend à 'night' en finissant à 0 PA.
  day.status = 'playing';
  storeDay(draft, day);
  ctx.emit({ type: 'night-encounter', card });
  startCombat(draft, { hex: draft.world.hex, card }, ctx);
}

function drawWeather(draft, ctx) {
  const { cards } = content.decks.meteo;
  const announced = cards.find((card) => card.type === 'emission');
  if (draft.world.emission?.nextDay === draft.day) return announced.id;
  return weightedPick(cards.filter((card) => card !== announced), ctx.rng).id;
}

function weightedPick(cards, rng) {
  const pool = cards.flatMap((card) => Array(card.count ?? 1).fill(card));
  return rng.pick(pool);
}

function eatBreakfast(draft, ctx) {
  const { inventory, player } = draft;
  const isFood = (item) => content.items[item.kind]?.category === 'nourriture';
  const ration = inventory.findIndex((item) => item.kind === MEAL);
  const meal = ration >= 0 ? ration : inventory.findIndex(isFood);
  if (meal >= 0) {
    const [{ kind }] = inventory.splice(meal, 1);
    player.hunger = 0;
    ctx.emit({ type: 'meal', item: kind });
    return;
  }
  player.hunger += 1;
  const wounds = player.hunger >= STARVING_DAYS ? STARVING_WOUNDS : 0;
  ctx.emit({ type: 'hunger', days: player.hunger, ap: -HUNGER_MALUS, wounds });
}

function startBudget(draft, day) {
  const wounded = draft.player.wounds >= WOUND_PENALTY_AT;
  const malus = (draft.player.hunger >= 1 ? HUNGER_MALUS : 0)
    + (draft.night.rest === 'decouvert' ? OPEN_AIR_MALUS : 0)
    + (wounded ? WOUND_AP_MALUS : 0);
  const max = Math.max(0, BASE_AP + draft.player.stats.endurance + apBonus(draft.equipment) - malus);
  day.ap = { max, left: max, spent: 0 };
  day.status = 'playing';
  day.outcome = null;
  day.player = { ...day.player, woundPenalty: wounded };
}

// Les radiations des artefacts portés, sans la protection de l'armure (hypothèse v2).
function payBelt(day, cost, ctx) {
  const { player } = day;
  player.radiation = Math.min(TRACK_MAX, player.radiation + cost);
  ctx.emit({ type: 'irradiated', amount: cost, cause: 'ceinture' });
  if (player.radiation < TRACK_MAX) return;
  player.radiation = RADIATION_RESET;
  wound(day, 1, 'radiation', ctx.emit);
}

function reshuffleZone(day, emission, ctx) {
  const { rng } = day;
  day.rng = ctx.rng.int(0, UINT32_MAX);
  setupZone(day, { emission });
  day.rng = rng;
}

const isNoApDayEnd = (event) => event.type === 'day-ended' && event.reason === 'no-ap';

function dropNightDefeat(events) {
  dropEvents(events, (event) => event.type === 'game-over' && event.outcome?.cause === 'night');
}

function dropEvents(events, matches) {
  for (let i = events.length - 1; i >= 0; i--) if (matches(events[i])) events.splice(i, 1);
}
