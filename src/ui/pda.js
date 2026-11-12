// Lectures du PDA (brief v2 §16, §8.5, §9, §10.3, §11 ; cartes 28 et 32) : onglets Quêtes,
// Carte du monde, Journal, Rumeurs, Factions, Fiche. La Carte du monde est dessinée par
// world-view.js à partir de worldMap (world-map.js). Pures : elles lisent la campagne et le contenu, sans rien modifier, et ne
// touchent pas au DOM (testées par tests/pda.test.js). Le rendu est dans pda-view.js.
//
//   PDA_TABS                      [{ id, label }] onglets, dans l'ordre affiché
//   objectiveText(objective, campaign) -> texte de l'objectif d'une étape ; « explorer » dit le
//                                       rang de la carte cherchée, goal dit ce qu'on cherche
//   pdaQuests(campaign)  -> { active: [{ quest, name, objective, place, deadline, options }],
//                             done: [{ quest, name }], failed: [{ quest, name, reason }] }
//   pdaJournal(campaign) -> [{ day, text }]  journal du PDA (campaign.journal), le plus récent
//                           en premier ; une nouvelle étape dit son objectif
//   pdaRumors(campaign)  -> [{ type, name, tileName, text, age, stale }] rumeurs connues, les
//                           fraîches d'abord, la plus récente en premier
//   pdaFactions(campaign) -> [{ id, name, reputation, standing, member }]
//   pdaSheet(campaign)   -> { rank, xp, nextRank, stats, statPoints, perks, perkPicks,
//                             available, wounds, radiation, faction }
//     stats : [{ id, label, value, canRaise }] ; perks : savoir-faire appris
//     [{ id, name, effect }] ; available : ceux qu'on peut encore apprendre (même forme).
//   targetText(target) -> « Lieu (Tuile) » ou « Tuile » : cible d'une quête (questLog)
//   PDA_LINES  { [type]: (event) -> texte } lignes du journal du bas pour les actions de la
//              fiche (stat-raised, perk-learned), reprises par campagne.js

import content from '../content/index.js';
import { questLog } from '../engine/rules/quests.js';
import { reputationOf, standing, isMember } from '../engine/rules/factions.js';
import { knownRumors, RUMOR_NAMES, rumorText, rumorAge } from './hub.js';
import { RANKS, STATS, STAT_MAX, statPointsLeft, perkPicksLeft } from '../engine/rules/progression.js';

export const PDA_TABS = Object.freeze([
  { id: 'quetes', label: 'Quêtes' },
  { id: 'carte', label: 'Carte du monde' },
  { id: 'journal', label: 'Journal' },
  { id: 'rumeurs', label: 'Rumeurs' },
  { id: 'factions', label: 'Factions' },
  { id: 'fiche', label: 'Fiche' },
]);

export const RANK_NAMES = Object.freeze({
  bleu: 'Bleu', experimente: 'Expérimenté', veteran: 'Vétéran', expert: 'Expert', maitre: 'Maître',
});

export const STAT_NAMES = Object.freeze({
  tir: 'Tir', survie: 'Survie', discretion: 'Discrétion', endurance: 'Endurance',
});

export const STANDING_NAMES = Object.freeze({
  hostile: 'Hostile', neutre: 'Neutre', amical: 'Amical', allie: 'Allié',
});

const FAILURES = { deadline: 'délai dépassé', 'npc-dead': 'PNJ mort' };

const JOURNAL_KINDS = {
  'quest-started': 'Quête reçue',
  'quest-step': 'Nouvelle étape',
  'quest-branch': 'Choix à faire',
  'quest-completed': 'Quête terminée',
  'quest-failed': 'Quête ratée',
};

const nameOf = (collection, id) => content[collection][id]?.name ?? id;
const placeName = (id) => nameOf('places', id);
const npcName = (id) => nameOf('npcs', id);
const tileName = (id) => content.tiles[id]?.name ?? id;
const questOf = (id, campaign) => campaign.quests[id]?.quest ?? content.quests[id];

const OBJECTIVES = {
  visiter: (o) => `Se rendre à ${placeName(o.place)}`,
  explorer: (o, campaign) => `Fouiller ${placeName(o.place)}${cardHint(o, campaign)}`,
  parler: (o) => `Parler à ${npcName(o.npc)}`,
  rapporter: (o) => `Rapporter ${nameOf('items', o.item)} à ${npcName(o.npc)}`,
  eliminer: (o) => `Éliminer ${o.encounter}${o.tile ? ` (${tileName(o.tile)})` : ''}`,
  escorter: (o) => `Escorter ${npcName(o.npc)} jusqu'à ${placeName(o.place)}`,
  cartographier: (o) => `Cartographier ${tileName(o.tile)}`,
  survivre: (o, campaign) => (o.emission ? "Survivre à l'Émission" : `Survivre jusqu'au jour ${o.day} (aujourd'hui ${campaign.day})`),
};

export const PDA_LINES = Object.freeze({
  'stat-raised': (e) => `${STAT_NAMES[e.stat]} monte à ${e.value}`,
  'perk-learned': (e) => `Savoir-faire appris : ${content.perks[e.perk]?.name ?? e.perk}`,
});

// goal (facultatif, contenu des quêtes) : ce que l'étape cherche, en clair.
export function objectiveText(objective, campaign) {
  const text = OBJECTIVES[objective.type]?.(objective, campaign) ?? objective.type;
  return objective.goal ? `${text} : ${objective.goal}` : text;
}

// Rang de la carte fixée par la quête dans le paquet du lieu (fixCard de rules/places.js), et
// combien il en reste à tirer une fois la fouille commencée.
function cardHint({ place, card }, campaign) {
  const state = campaign.places?.[place];
  const position = Object.entries(state?.fixed ?? {}).find(([, id]) => id === card)?.[0];
  if (!position) return '';
  const left = position - (state.revealed?.length ?? 0);
  if (left <= 1) return ' (prochaine carte)';
  return left < position ? ` (carte ${position}, encore ${left} à tirer)` : ` (carte ${position})`;
}

export function pdaQuests(campaign) {
  const log = questLog(campaign);
  return {
    active: log.active.map((entry) => ({
      quest: entry.quest,
      name: entry.name,
      objective: objectiveText(entry.objective, campaign),
      place: entry.target ? targetText(entry.target) : null,
      deadline: entry.daysLeft === null ? null : `${entry.daysLeft} jour(s) restant(s)`,
      options: entry.options,
    })),
    done: log.done.map(({ quest, name }) => ({ quest, name })),
    failed: log.failed.map(({ quest, name, reason }) => ({ quest, name, reason: FAILURES[reason] ?? reason })),
  };
}

export function pdaJournal(campaign) {
  return campaign.journal.map((entry) => ({ day: entry.day, text: journalText(entry, campaign) })).reverse();
}

// Une nouvelle étape dit aussi son objectif.
function journalText({ kind, quest, step }, campaign) {
  const definition = questOf(quest, campaign);
  const text = `${JOURNAL_KINDS[kind] ?? kind} : ${definition?.name ?? quest}`;
  const objective = definition?.steps[step]?.objective;
  return kind === 'quest-step' && objective ? `${text} · ${objectiveText(objective, campaign)}` : text;
}

export function pdaRumors(campaign) {
  return knownRumors(campaign)
    .map((rumor) => ({
      type: rumor.type,
      name: RUMOR_NAMES[rumor.type] ?? rumor.type,
      tileName: rumor.tileName,
      text: rumorText(rumor),
      age: rumorAge(rumor),
      stale: rumor.stale,
      day: rumor.day,
    }))
    .sort((a, b) => a.stale - b.stale || b.day - a.day)
    .map(({ day, ...rumor }) => rumor);
}

export function pdaFactions(campaign) {
  return Object.values(content.factions).map(({ id, name }) => ({
    id,
    name,
    reputation: reputationOf(campaign, id),
    standing: STANDING_NAMES[standing(campaign, id)],
    member: isMember(campaign, id),
  }));
}

export function pdaSheet(campaign) {
  const { player } = campaign;
  const statPoints = statPointsLeft(campaign);
  const perkPicks = perkPicksLeft(campaign);
  const next = RANKS.find((rank) => rank.xp > player.xp);
  const perk = (id) => ({ id, name: content.perks[id].name, effect: content.perks[id].effect });
  return {
    rank: RANK_NAMES[player.rank],
    xp: player.xp,
    nextRank: next ? { name: RANK_NAMES[next.id], xp: next.xp } : null,
    stats: STATS.map((id) => ({
      id,
      label: STAT_NAMES[id],
      value: player.stats[id],
      canRaise: statPoints > 0 && player.stats[id] < STAT_MAX,
    })),
    statPoints,
    perks: player.perks.map(perk),
    perkPicks,
    available: Object.keys(content.perks).filter((id) => !player.perks.includes(id)).map(perk),
    wounds: player.wounds,
    radiation: player.radiation,
    faction: content.factions[player.faction]?.name ?? player.faction,
  };
}

export function targetText({ tile, place }) {
  return place ? `${placeName(place)} (${tileName(tile)})` : tileName(tile);
}
