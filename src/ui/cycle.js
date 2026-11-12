// Lectures des écrans Titre, Réveil et nuit, Fin de campagne (brief v2 §15, §16 ; carte 29).
// Pures : elles lisent la campagne, les événements et le contenu, sans rien modifier, et ne
// touchent pas au DOM (testées par tests/cycle.test.js). L'écran de mort lit deathView de
// src/engine/rules/death.js.
//
//   parseSeed(text)            -> entier 0..2^32-1 | null   graine saisie à l'écran titre
//   titleSlots(entries)        -> [{ slot, label, detail, empty, error }]  'auto' puis 1, 2, 3 ;
//                                 entries : saves.list() de src/ui/storage.js
//   campPreview(campaign)      -> { rest, label, malus, apLost }  avant de finir la journée
//   nightView(campaign)        -> null | { rest, label, place, cardDrawn }  écran nuit (hors combat)
//   wakeReport(events, budget?) -> null | { day, ap, apChanges: [{ amount, label }], night,
//                                          weather, meal, hunger, fight, wounds, radiation }
//                                 events : ceux de la nuit (après le dernier day-ended), combat de
//                                 nuit compris, jusqu'au wake qui a lancé le jour ; budget :
//                                 { campaign, rest } (campagne après le wake, repos de la nuit),
//                                 sans lui apChanges est vide. apChanges : écarts à BASE_AP.
//   returnReminder(campaign)   -> null | { hub, cost, text }  ≤ RETURN_REMINDER_AP PA restants et
//                                 lit de hub le plus proche hors de portée (coût en PA, liaisons comprises)
//   daySummary(events)         -> { moves, tiles, roubles, xp, wounds, radiation, items,
//                                   victories, quests }  résumé de la veille : événements de la journée
//   isEnding(campaign)         la quête principale « Le Guide » est finie
//   endingView(campaign)       -> null | { epilogue, stats: [[label, valeur]], choices: [texte] }

import content from '../content/index.js';
import { dayState } from '../engine/campaign.js';
import { BASE_AP } from '../engine/game.js';
import { neighbors } from '../engine/hex.js';
import { entryCost } from '../engine/actions/move.js';
import { HUNGER_MALUS, OPEN_AIR_MALUS, WOUND_AP_MALUS } from '../engine/rules/time.js';
import { WOUND_PENALTY_AT } from '../engine/rules/sheet.js';
import { apBonus } from '../engine/rules/equipment.js';
import { isBlocked } from '../engine/rules/suspects.js';
import { TRAVEL_COST } from '../engine/rules/world.js';
import { COMBAT_OUTCOMES } from './combat-screen.js';
import { MANUAL_SLOTS } from './storage.js';
import { RANK_NAMES } from './hub.js';

const MAIN_QUEST = 'le-guide';
const MARSH_ARC = 'souvenir-du-guide';
const SEED_MAX = 2 ** 32 - 1;
export const RETURN_REMINDER_AP = 3;

const REST_LABELS = { lit: 'Lit du hub', abri: 'Bivouac dans un abri', decouvert: 'Bivouac à découvert' };
const NIGHT_LABELS = { 'nuit-calme': 'Nuit calme', 'vent-radioactif': 'Vent radioactif', froid: 'Froid', rodeurs: 'Rôdeurs' };
const WEATHER_LABELS = {
  calme: 'Calme',
  brouillard: 'Brouillard',
  pluie: 'Pluie : Discrétion +1, détecteur −1',
  'signes-emission': 'Signes d’Émission',
};

const itemName = (kind) => content.items[kind]?.name ?? kind;
const sumOf = (events, type) => events.filter((e) => e.type === type).reduce((total, e) => total + e.amount, 0);

export function parseSeed(text) {
  const trimmed = String(text).trim();
  if (!/^\d+$/.test(trimmed)) return null;
  const seed = Number(trimmed);
  return seed <= SEED_MAX ? seed : null;
}

export function titleSlots(entries) {
  return ['auto', ...MANUAL_SLOTS].map((slot) => {
    const entry = entries.find((candidate) => candidate.slot === slot);
    const label = slot === 'auto' ? 'Continuer' : `Emplacement ${slot}`;
    if (!entry) return { slot, label, detail: 'vide', empty: true, error: false };
    if (entry.error) return { slot, label, detail: entry.error, empty: false, error: true };
    const savedAt = entry.savedAt.slice(0, 16).replace('T', ' ');
    return { slot, label, detail: `Jour ${entry.day} · ${entry.mode} · graine ${entry.seed} · ${savedAt}`, empty: false, error: false };
  });
}

export function campPreview(campaign) {
  const day = dayState(campaign);
  const rest = day.tile.hexes[campaign.world.hex]?.abri ? 'abri' : 'decouvert';
  return { rest, label: rest === 'abri' ? 'Abri' : 'À découvert', malus: rest === 'abri' ? 0 : OPEN_AIR_MALUS, apLost: day.ap.left };
}

export function nightView(campaign) {
  if (campaign.screen !== 'night' || campaign.combat) return null;
  const { rest, place, cardDrawn } = campaign.night;
  return { rest, label: REST_LABELS[rest], place: place ? content.places[place].name : null, cardDrawn };
}

export function wakeReport(events, budget = null) {
  const night = events.slice(events.findLastIndex((e) => e.type === 'day-ended') + 1);
  const started = night.find((e) => e.type === 'day-started');
  if (!started) return null;
  const card = night.find((e) => e.type === 'night-card')?.card;
  const fight = night.some((e) => e.type === 'night-encounter') ? night.find((e) => e.type === 'combat-ended') : null;
  return {
    day: started.day,
    ap: started.ap,
    apChanges: budget ? apChanges(night, budget) : [],
    night: card ? NIGHT_LABELS[card] ?? card : null,
    weather: WEATHER_LABELS[started.weather] ?? started.weather,
    meal: itemName(night.find((e) => e.type === 'meal')?.item) ?? null,
    hunger: night.find((e) => e.type === 'hunger')?.days ?? null,
    fight: fight ? COMBAT_OUTCOMES[fight.outcome] ?? fight.outcome : null,
    wounds: sumOf(night, 'wounded'),
    radiation: sumOf(night, 'irradiated'),
  };
}

// Les termes du budget de newDay (rules/time.js), dans l'ordre de leur calcul.
function apChanges(events, { campaign, rest }) {
  const { endurance } = campaign.player.stats;
  const belt = apBonus(campaign.equipment);
  return [
    endurance !== 0 && { amount: endurance, label: 'Endurance' },
    belt !== 0 && { amount: belt, label: 'artefacts à la ceinture' },
    events.some((e) => e.type === 'hunger') && { amount: -HUNGER_MALUS, label: 'faim : rien à manger au réveil' },
    rest === 'decouvert' && { amount: -OPEN_AIR_MALUS, label: 'nuit à découvert' },
    woundsAtBudget(events, campaign) >= WOUND_PENALTY_AT && { amount: -WOUND_AP_MALUS, label: `${WOUND_PENALTY_AT} blessures ou plus` },
  ].filter(Boolean);
}

// Le budget est fixé juste après le repas : les blessures suivantes (faim, ceinture) n'y comptent pas.
function woundsAtBudget(events, campaign) {
  const meal = events.findIndex((e) => e.type === 'meal' || e.type === 'hunger');
  return campaign.player.wounds - sumOf(events.slice(meal + 1), 'wounded');
}

export function returnReminder(campaign) {
  if (campaign.screen !== 'tile') return null;
  const day = dayState(campaign);
  if (day.status !== 'playing' || day.combat || day.ap.left > RETURN_REMINDER_AP) return null;
  const nearest = nearestBed(campaign, day);
  if (!nearest || nearest.cost <= day.ap.left) return null;
  const hub = content.places[nearest.hub].name;
  return { hub, cost: nearest.cost, text: `Le hub est à ${nearest.cost} PA (${hub}) : le lit soigne et évite la carte Nuit.` };
}

// Plus court chemin en PA (Dijkstra) sur les hexagones de toutes les tuiles, liaisons comprises.
// Seules les anomalies révélées de la tuile courante bloquent.
function nearestBed(campaign, day) {
  const beds = Object.entries(content.places)
    .filter(([, place]) => place.tags.includes('hub') && place.services?.includes('lit'));
  const hexesOf = (tile) => (tile === campaign.world.currentTile ? day.tile.hexes : content.tiles[tile].hexes);
  const key = (tile, hex) => `${tile}:${hex}`;
  const costs = new Map([[key(campaign.world.currentTile, campaign.world.hex), 0]]);
  const queue = [{ tile: campaign.world.currentTile, hex: campaign.world.hex, cost: 0 }];
  const done = new Set();
  while (queue.length) {
    queue.sort((a, b) => a.cost - b.cost);
    const { tile, hex, cost } = queue.shift();
    if (done.has(key(tile, hex))) continue;
    done.add(key(tile, hex));
    const bed = beds.find(([, place]) => place.tile === tile && place.hex === hex);
    if (bed) return { hub: bed[0], cost };
    const steps = neighbors(hex)
      .filter((n) => hexesOf(tile)[n] && !(tile === campaign.world.currentTile && isBlocked(day, n)))
      .map((n) => ({ tile, hex: n, cost: cost + entryCost(hexesOf(tile)[n], day) }));
    const link = content.links[tile]?.[hex];
    if (link) steps.push({ tile: link.tile, hex: link.hex, cost: cost + TRAVEL_COST });
    for (const next of steps) {
      if (next.cost >= (costs.get(key(next.tile, next.hex)) ?? Infinity)) continue;
      costs.set(key(next.tile, next.hex), next.cost);
      queue.push(next);
    }
  }
  return null;
}

export function daySummary(events) {
  const questName = (id) => content.quests[id]?.name ?? id;
  return {
    moves: events.filter((e) => e.type === 'moved').length,
    tiles: events.filter((e) => e.type === 'traveled').map((e) => content.tiles[e.to.tile].name),
    roubles: sumOf(events, 'roubles-changed'),
    xp: sumOf(events, 'xp-gained'),
    wounds: sumOf(events, 'wounded'),
    radiation: sumOf(events, 'irradiated'),
    items: events.flatMap((e) => {
      if (e.type === 'item-gained') return [itemName(e.kind)];
      if (e.type === 'artefact-picked') return ['Artefact'];
      return [];
    }),
    victories: events.filter((e) => e.type === 'combat-ended' && e.outcome === 'victory').length,
    quests: events.filter((e) => e.type === 'quest-completed').map((e) => questName(e.quest)),
  };
}

export function isEnding(campaign) {
  return campaign.quests[MAIN_QUEST]?.status === 'done';
}

export function endingView(campaign) {
  if (!isEnding(campaign)) return null;
  const quests = Object.values(campaign.quests);
  const count = (status) => quests.filter((quest) => quest.status === status).length;
  return {
    epilogue: content.quests[MAIN_QUEST].epilogue,
    stats: [
      ['Jours dans la Zone', campaign.day],
      ['Roubles', campaign.player.roubles],
      ['Rang', RANK_NAMES[campaign.player.rank]],
      ['Quêtes finies', count('done')],
      ['Quêtes ratées', count('failed')],
    ],
    choices: endingChoices(campaign),
  };
}

function endingChoices(campaign) {
  const { history } = campaign.quests[MAIN_QUEST];
  const oath = history.includes('a4-devoir') ? 'au Devoir' : 'à Liberté';
  const marsh = campaign.quests[MARSH_ARC]?.status === 'done' ? 'les notes du Guide retrouvées' : 'laissé de côté';
  return [
    `Acte 4 : le serment ${oath}`,
    `Arc du Marais : ${marsh}`,
    `Faction : ${content.factions[campaign.player.faction].name}`,
  ];
}
