// Lectures de l'interface v2 (brief v2 §3.2, §16) : carte du monde, sorties de la tuile,
// marqueurs de quête, bandeau du haut. Pures : elles lisent la campagne et le contenu, sans
// rien modifier, et ne touchent pas au DOM (testées par tests/world-map.test.js).
//
//   worldMap(campaign)          -> { tiles: [{ id, name, label, col, row, known, current }],
//                                    links: [[a, b]], markers: [{ tile, hex?, quest, name }] }
//   linkExits(tileId)           -> [{ hex, tile, name }]   hexagones de liaison de la tuile
//   tileQuestMarkers(campaign)  -> [{ hex, quest, name }]  cibles de quête sur la tuile courante
//   topBar(campaign)            -> { day, tile, ap, apMax, wounds, radiation, hunger, roubles, emission }

import content from '../content/index.js';
import { dayState } from '../engine/campaign.js';
import { knownTiles } from '../engine/rules/world.js';
import { questLog } from '../engine/rules/quests.js';

// Cases de la vue réduite, recopiées du schéma du §3.2 (colonne, rangée).
export const WORLD_LAYOUT = Object.freeze({
  entrepots: { col: 1, row: 0 },
  rostok: { col: 1, row: 1 },
  agroprom: { col: 0, row: 2 },
  decharge: { col: 1, row: 2 },
  'vallee-sombre': { col: 2, row: 2 },
  marais: { col: 0, row: 3 },
  cordon: { col: 1, row: 3 },
});

export function worldMap(campaign) {
  const known = knownTiles(campaign);
  const tiles = Object.entries(WORLD_LAYOUT).map(([id, cell]) => ({
    id,
    name: content.tiles[id].name,
    label: content.tiles[id].label,
    ...cell,
    known: known.includes(id),
    current: id === campaign.world.currentTile,
  }));
  return { tiles, links: linkPairs(), markers: questTargets(campaign) };
}

export function linkExits(tileId) {
  return Object.entries(content.links[tileId] ?? {})
    .map(([hex, { tile }]) => ({ hex: Number(hex), tile, name: content.tiles[tile].name }));
}

export function tileQuestMarkers(campaign) {
  return questTargets(campaign)
    .filter((marker) => marker.tile === campaign.world.currentTile && marker.hex)
    .map(({ hex, quest, name }) => ({ hex, quest, name }));
}

// Hypothèse v2 : l'Émission est « annoncée » dès que son jour est fixé et pas encore passé,
// et pendant le jour même.
export function topBar(campaign) {
  const { ap } = dayState(campaign);
  const { player, world } = campaign;
  const { nextDay, today } = world.emission ?? {};
  return {
    day: campaign.day,
    tile: content.tiles[world.currentTile].name,
    ap: ap.left,
    apMax: ap.max,
    wounds: player.wounds,
    radiation: player.radiation,
    hunger: player.hunger,
    roubles: player.roubles,
    emission: Boolean(today) || (nextDay != null && nextDay >= campaign.day),
  };
}

// Chaque liaison est écrite des deux côtés dans content.links : on la garde une fois.
function linkPairs() {
  const pairs = new Set();
  for (const [a, exits] of Object.entries(content.links)) {
    for (const { tile: b } of Object.values(exits)) pairs.add([a, b].sort().join('|'));
  }
  return [...pairs].map((pair) => pair.split('|'));
}

function questTargets(campaign) {
  return questLog(campaign).active
    .filter((entry) => entry.target)
    .map(({ target, quest, name }) => ({ ...target, quest, name }));
}
