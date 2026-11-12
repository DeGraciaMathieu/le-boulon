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
//   wakeReport(events)         -> null | { day, ap, night, weather, meal, hunger, encounter,
//                                          wounds, radiation }  événements du wake qui a lancé le jour
//   daySummary(events)         -> { moves, tiles, roubles, xp, wounds, radiation, items,
//                                   victories, quests }  résumé de la veille : événements de la journée
//   isEnding(campaign)         la quête principale « Le Guide » est finie
//   endingView(campaign)       -> null | { epilogue, stats: [[label, valeur]], choices: [texte] }

import content from '../content/index.js';
import { dayState } from '../engine/campaign.js';
import { OPEN_AIR_MALUS } from '../engine/rules/time.js';
import { MANUAL_SLOTS } from './storage.js';
import { RANK_NAMES } from './hub.js';

const MAIN_QUEST = 'le-guide';
const MARSH_ARC = 'souvenir-du-guide';
const SEED_MAX = 2 ** 32 - 1;

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

export function wakeReport(events) {
  const started = events.find((e) => e.type === 'day-started');
  if (!started) return null;
  const card = events.find((e) => e.type === 'night-card')?.card;
  return {
    day: started.day,
    ap: started.ap,
    night: card ? NIGHT_LABELS[card] ?? card : null,
    weather: WEATHER_LABELS[started.weather] ?? started.weather,
    meal: itemName(events.find((e) => e.type === 'meal')?.item) ?? null,
    hunger: events.find((e) => e.type === 'hunger')?.days ?? null,
    encounter: events.some((e) => e.type === 'night-encounter'),
    wounds: sumOf(events, 'wounded'),
    radiation: sumOf(events, 'irradiated'),
  };
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
