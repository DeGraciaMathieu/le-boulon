// Planques et rumeurs (brief v2 §10.3, §10.1 ; carte 23).
//
// ÉTAT :
//   campaign.stashes = [{ id, tile, hex, level, source: 'pda' | 'rumeur' | 'indice', known, opened, day }]
//     id 'planque-<n>' ; level : niveau de la table de butin (tuile + 1, plafonné à 4).
//     known : le joueur sait où elle est (PDA lu, rumeur achetée) ; opened : déjà fouillée.
//   campaign.rumors = [{ type, tile, hex?, day, known?, expires?, stale?, ... }]
//     Format de rules/emission.js ({ type: 'artefact', tile, hex, item, day }), complété :
//       type 'planque'     { stash }               planque cachée, révélée à l'achat
//       type 'raccourci'   { from, to, path }      chemin d'hexagones voisins sans anomalie
//       type 'patrouille'  { hex }                 jeton de rencontre d'une tuile visitée
//       known    acheté au barman (absent : à vendre)
//       expires  jour de la prochaine Émission à sa création ; null tant que le calendrier
//                n'est pas posé (rempli par le hook de vieillissement)
//       stale    fausse : une Émission est passée depuis (§10.3)
//
// PDA (§10.3) : dropPda(draft, enemies, ctx), appelée par la fin de combat v2 (victoire,
//   rules/combat.js). Un jet par humain abattu, PDA_ROLL.min ou plus sur 1d6 ; au premier
//   succès, le PDA révèle une planque connue sur la tuile courante ou une tuile voisine.
//
// EFFET « reveler » { type: 'reveler', stash: true } (EFFECTS de rules/dialogue.js, §10.3) :
//   choix de dialogue ou carte d'exploration Indice (rules/places.js). Comme un PDA, pose une
//   planque connue (source 'indice') sur la tuile courante ou une tuile voisine. Sans stash,
//   l'effet reste celui de rules/places.js ({ place }).
//
// ACTION DE CAMPAGNE { type: 'open-stash' } (CAMPAIGN_ACTIONS de campaign.js) :
//   Sur l'hexagone d'une planque connue et pas encore fouillée, OPEN_COST PA : STASH_DRAWS
//   tirages dans la table n<level>-cache (rollLoot de places.js). Un objet qui ne tient pas
//   dans la grille est perdu (stored false), comme le butin des lieux.
//   Refus : 'in-place' | 'day-over' | 'no-stash' | 'not-enough-ap'
//
// BARMAN (HUB_SERVICES.barman de hubs.js), 0 PA comme tout le hub :
//   { type: 'service', service: 'barman', op: 'browse' }        rumeurs à vendre (sans leur
//     contenu) ; complète l'offre jusqu'à RUMOR_OFFER en inventant planque, raccourci ou
//     patrouille. Les rumeurs d'artefact rare naissent à l'Émission (rules/emission.js).
//   { type: 'service', service: 'barman', op: 'buy', index }    achète la rumeur index de
//     rumorsForSale ; une rumeur de planque rend la planque connue.
//   Refus : 'unknown-op' | 'no-rumor' | 'not-enough-roubles'
//
// VIEILLISSEMENT (DAY_HOOKS.emission de time.js, après scheduleEmission) : ageRumors(draft, ctx)
//   Une rumeur dont l'Émission expires est passée devient stale ; sa planque disparaît si elle
//   n'a pas été fouillée. Puis expires est rempli pour les rumeurs qui n'en ont pas.
//
// LECTURE (pures) :
//   rumorsForSale(campaign) -> [rumeur]    tileLevel(campaign, tileId) -> 1..4
//   rumorPrice(rumeur) -> roubles
//
// ÉVÉNEMENTS :
//   { type: 'pda-found', stash, tile, hex }
//   { type: 'stash-opened', stash, items: [{ item, stored }] }
//   { type: 'rumors-offered', hub, rumors: [{ index, type, price }] }
//   { type: 'rumor-bought', hub, rumor, price }   { type: 'roubles-changed', amount, roubles }
//   { type: 'stash-revealed', stash }   { type: 'rumor-aged', rumor }   { type: 'stash-gone', stash }
//
// HYPOTHÈSES V2 :
//   - PDA : un jet par humain abattu, 5 ou plus sur 1d6 ; un PDA au plus par combat ; pas de PDA
//     en mode de combat 'rapide' (la carte vise la fin de combat v2).
//   - Planque d'un PDA ou d'un indice : tuile courante ou voisine par une liaison ; hexagone libre (ni entrée,
//     ni lieu, ni autre planque, ni joueur).
//   - Niveau d'une tuile : tile.level, sinon le plus haut niveau des tables de ses lieux, sinon 1.
//     Butin de niveau +1 plafonné à 4 (tables 1 à 4), thème 'cache', 2 tirages, 1 PA.
//   - Prix : patrouille 100, raccourci 150, planque 200, artefact 300 roubles (§10.3 : 100 à 300).
//   - Les deux barmans vendent le même fil de rumeurs ; 3 rumeurs à vendre au plus.
//   - Une rumeur de planque cache une planque sur une tuile du contenu au hasard ; la planque
//     disparaît avec la rumeur à l'Émission suivante si elle n'a pas été fouillée. Une planque
//     de PDA ou d'indice ne vieillit pas.
//   - Indice sans hexagone libre (tuile pleine) : pas de planque, le choix n'est pas refusé.
//   - Raccourci : plus court chemin entre deux hexagones d'accès (liaisons et entrée) d'une tuile
//     visitée autre que la tuile courante, sans jeton d'anomalie.
//   - Patrouille : un jeton de rencontre d'une tuile visitée autre que la tuile courante.
//   - Une rumeur passe pour fausse au matin qui suit son Émission (hook de changement de jour).

import content from '../../content/index.js';
import { dayState, storeDay } from '../campaign.js';
import { dayContext, endDayIfExhausted } from '../game.js';
import { neighbors } from '../hex.js';
import { createItem } from './sheet.js';
import { tileHexes } from './tile.js';
import { zoneAfterAction } from './zone.js';
import { rollLoot } from './places.js';
import { EFFECTS } from './dialogue.js';

export const PDA_ROLL = Object.freeze({ min: 5 });
export const STASH_LEVEL_BONUS = 1;
export const MAX_LEVEL = 4;
export const STASH_DRAWS = 2;
export const OPEN_COST = 1;
export const RUMOR_PRICES = Object.freeze({ patrouille: 100, raccourci: 150, planque: 200, artefact: 300 });
export const RUMOR_OFFER = 3;

const STASH_THEME = 'cache';
const OPERATIONS = { browse, buy };
const INVENTED = Object.freeze({ planque: inventStash, raccourci: inventShortcut, patrouille: inventPatrol });

// places.js a déjà posé EFFECTS.reveler pour { place } : il est importé avant ce module.
const revealPlace = EFFECTS.reveler;
EFFECTS.reveler = (draft, effect, ctx) => (effect.stash ? revealStash(draft, ctx) : revealPlace(draft, effect, ctx));

export const rumorPrice = (rumor) => RUMOR_PRICES[rumor.type];

export function rumorsForSale(campaign) {
  return campaign.rumors.filter((rumor) => !rumor.known && !rumor.stale);
}

export function tileLevel(campaign, tileId) {
  const tile = tileData(campaign, tileId);
  if (tile?.level) return tile.level;
  const levels = Object.values(content.places)
    .filter((place) => place.tile === tileId && content.loot?.[place.loot])
    .map((place) => content.loot[place.loot].level);
  return levels.length > 0 ? Math.max(...levels) : 1;
}

export function dropPda(draft, enemies, ctx) {
  const humans = enemies.filter((enemy) => enemy.type === 'humain' && enemy.hp <= 0);
  const found = humans.some(() => ctx.rng.d6() >= PDA_ROLL.min);
  if (!found) return;
  const stash = placeStash(draft, ctx.rng.pick(nearbyTiles(draft)), ctx, { source: 'pda', known: true });
  if (stash) ctx.emit({ type: 'pda-found', stash: stash.id, tile: stash.tile, hex: stash.hex });
}

function revealStash(draft, ctx) {
  const stash = placeStash(draft, ctx.rng.pick(nearbyTiles(draft)), ctx, { source: 'indice', known: true });
  if (stash) ctx.emit({ type: 'stash-revealed', stash: stash.id });
}

function nearbyTiles(draft) {
  const here = draft.world.currentTile;
  return [here, ...Object.values(content.links[here] ?? {}).map((link) => link.tile)];
}

// Handlers en déclarations de fonctions : campaign.js et ce module s'importent l'un l'autre.
export function openStash(draft, _action, ctx) {
  if (draft.place) return 'in-place';
  const day = dayState(draft);
  if (day.status !== 'playing') return 'day-over';
  const stash = draft.stashes.find((candidate) => candidate.known && !candidate.opened
    && candidate.tile === draft.world.currentTile && candidate.hex === draft.world.hex);
  if (!stash) return 'no-stash';
  if (day.ap.left < OPEN_COST) return 'not-enough-ap';

  const dctx = dayContext(day, ctx.rng, ctx.emit);
  const spentBefore = day.ap.spent;
  dctx.spend(OPEN_COST);
  stash.opened = true;
  const items = [];
  for (const { item, qty } of rollLoot(`n${stash.level}-${STASH_THEME}`, ctx.rng, STASH_DRAWS)) {
    for (let i = 0; i < qty; i++) items.push({ item, stored: dctx.addItem(createItem(item)) });
  }
  ctx.emit({ type: 'stash-opened', stash: stash.id, items });
  zoneAfterAction(day, spentBefore, dctx);
  endDayIfExhausted(day, dctx);
  storeDay(draft, day);
}

export function barman(draft, action, ctx, hubId) {
  const operation = OPERATIONS[action.op];
  if (!operation) return 'unknown-op';
  return operation(draft, action, ctx, hubId);
}

export function ageRumors(draft, ctx) {
  for (const rumor of draft.rumors) {
    if (rumor.stale || rumor.expires == null || draft.day <= rumor.expires) continue;
    rumor.stale = true;
    ctx.emit({ type: 'rumor-aged', rumor: { ...rumor } });
    if (rumor.type === 'planque') dropStash(draft, rumor.stash, ctx);
  }
  for (const rumor of draft.rumors) rumor.expires ??= draft.world.emission.nextDay;
}

function browse(draft, _action, ctx, hubId) {
  inventRumors(draft, ctx);
  const rumors = rumorsForSale(draft).map((rumor, index) => ({ index, type: rumor.type, price: rumorPrice(rumor) }));
  ctx.emit({ type: 'rumors-offered', hub: hubId, rumors });
}

function buy(draft, { index }, ctx, hubId) {
  const rumor = rumorsForSale(draft)[index];
  if (!rumor) return 'no-rumor';
  const price = rumorPrice(rumor);
  if (draft.player.roubles < price) return 'not-enough-roubles';

  draft.player.roubles -= price;
  rumor.known = true;
  ctx.emit({ type: 'roubles-changed', amount: -price, roubles: draft.player.roubles });
  ctx.emit({ type: 'rumor-bought', hub: hubId, rumor: { ...rumor }, price });
  if (rumor.type !== 'planque') return;
  draft.stashes.find((stash) => stash.id === rumor.stash).known = true;
  ctx.emit({ type: 'stash-revealed', stash: rumor.stash });
}

function inventRumors(draft, ctx) {
  let kinds = Object.keys(INVENTED);
  while (rumorsForSale(draft).length < RUMOR_OFFER && kinds.length > 0) {
    const kind = ctx.rng.pick(kinds);
    const rumor = INVENTED[kind](draft, ctx);
    if (!rumor) {
      kinds = kinds.filter((other) => other !== kind);
      continue;
    }
    draft.rumors.push({ ...rumor, day: draft.day, expires: nextEmission(draft) });
  }
}

// L'Émission qui rendra fausse une rumeur née maintenant : celle d'aujourd'hui si elle n'est
// pas encore passée, sinon la prochaine du calendrier (null avant le premier changement de jour).
function nextEmission(draft) {
  const { today, nextDay } = draft.world.emission;
  return today ? draft.day : nextDay;
}

function inventStash(draft, ctx) {
  const stash = placeStash(draft, ctx.rng.pick(Object.keys(content.tiles)), ctx, { source: 'rumeur', known: false });
  return stash && { type: 'planque', tile: stash.tile, hex: stash.hex, stash: stash.id };
}

function inventShortcut(draft, ctx) {
  const candidates = otherVisitedTiles(draft).flatMap((tileId) => shortcutsOn(draft, tileId))
    .filter((shortcut) => !draft.rumors.some((rumor) => !rumor.stale && rumor.type === 'raccourci'
      && rumor.tile === shortcut.tile && rumor.from === shortcut.from && rumor.to === shortcut.to));
  if (candidates.length === 0) return null;
  return { type: 'raccourci', ...ctx.rng.pick(candidates) };
}

function inventPatrol(draft, ctx) {
  const candidates = otherVisitedTiles(draft)
    .flatMap((tileId) => draft.world.tiles[tileId].encounters.map(({ hex }) => ({ tile: tileId, hex })))
    .filter(({ tile, hex }) => !draft.rumors.some((rumor) => !rumor.stale && rumor.type === 'patrouille'
      && rumor.tile === tile && rumor.hex === hex));
  if (candidates.length === 0) return null;
  return { type: 'patrouille', ...ctx.rng.pick(candidates) };
}

function otherVisitedTiles(draft) {
  return Object.keys(draft.world.tiles).filter((tileId) => tileId !== draft.world.currentTile);
}

function shortcutsOn(draft, tileId) {
  const state = draft.world.tiles[tileId];
  const anomalies = new Set(state.tokens.filter((token) => token.kind === 'anomalie').map((token) => token.hex));
  const ends = [...new Set([...Object.keys(content.links[tileId] ?? {}).map(Number), state.tile.entry])]
    .filter((hex) => !anomalies.has(hex))
    .sort((a, b) => a - b);
  const shortcuts = [];
  for (const [i, from] of ends.entries()) {
    for (const to of ends.slice(i + 1)) {
      const path = shortestPath(from, to, anomalies);
      if (path) shortcuts.push({ tile: tileId, from, to, path });
    }
  }
  return shortcuts;
}

function shortestPath(from, to, blocked) {
  const previous = new Map([[from, null]]);
  const queue = [from];
  while (queue.length > 0) {
    const hex = queue.shift();
    if (hex === to) break;
    for (const next of neighbors(hex)) {
      if (previous.has(next) || blocked.has(next)) continue;
      previous.set(next, hex);
      queue.push(next);
    }
  }
  if (!previous.has(to)) return null;
  const path = [];
  for (let hex = to; hex !== null; hex = previous.get(hex)) path.unshift(hex);
  return path;
}

function placeStash(draft, tileId, ctx, { source, known }) {
  const tile = tileData(draft, tileId);
  const taken = new Set([
    tile.entry,
    ...Object.values(content.places).filter((place) => place.tile === tileId).map((place) => place.hex),
    ...draft.stashes.filter((stash) => stash.tile === tileId && !stash.opened).map((stash) => stash.hex),
  ]);
  if (tileId === draft.world.currentTile) taken.add(draft.world.hex);
  const free = tileHexes(tile).filter((hex) => !taken.has(hex));
  if (free.length === 0) return null;

  const stash = {
    id: `planque-${nextStashNumber(draft)}`,
    tile: tileId,
    hex: ctx.rng.pick(free),
    level: Math.min(MAX_LEVEL, tileLevel(draft, tileId) + STASH_LEVEL_BONUS),
    source,
    known,
    opened: false,
    day: draft.day,
  };
  draft.stashes.push(stash);
  return stash;
}

// Les ids des planques disparues restent pris : leur rumeur les nomme encore.
function nextStashNumber(draft) {
  const ids = [...draft.stashes.map((stash) => stash.id), ...draft.rumors.map((rumor) => rumor.stash).filter(Boolean)];
  return Math.max(0, ...ids.map((id) => Number(id.split('-')[1]))) + 1;
}

function dropStash(draft, id, ctx) {
  const index = draft.stashes.findIndex((stash) => stash.id === id && !stash.opened);
  if (index === -1) return;
  draft.stashes.splice(index, 1);
  ctx.emit({ type: 'stash-gone', stash: id });
}

// La tuile courante peut venir d'un jeu de tuiles de test (createCampaign({ tiles })).
function tileData(campaign, tileId) {
  return campaign.world.tiles[tileId]?.tile ?? content.tiles[tileId];
}
