// Émission globale (brief v2 §10.1, §4.2 ; carte 8). La carte Émission elle-même, son compte à
// rebours de 3 PA et ses effets sur la tuile courante restent ceux de la v1 (rules/zone.js).
//
// ÉTAT : campaign.world.emission = { nextDay, today }
//   nextDay  jour de la prochaine Émission ; null avant le premier changement de jour
//   today    true le jour annoncé tant que l'Émission n'a pas eu lieu ; false dès qu'elle passe
//
// CALENDRIER (hook 'emission' de DAY_HOOKS, rules/time.js) : scheduleEmission(draft, ctx)
//   Au premier changement de jour, nextDay = 1 + écart. Une Émission passée relance
//   nextDay = jour de l'Émission + écart. Écart tiré entre EMISSION_GAP.min et .max
//   (« tous les 3 à 5 jours »). today = (nextDay === day). Le hook tourne avant la Météo :
//   time.js sort la carte « signes d'Émission » le matin même (« prévient qu'elle aura lieu
//   ce jour-là, sans dire quand », §10.1) et remélange le paquet Zone du jour avec la carte
//   Émission dans son dernier tiers seulement ce jour-là (setupZone, rules/zone.js).
//
// RÉACTION (REACTIONS de campaign.js) : emissionAfterStep(draft, events, ctx)
//   1. L'Émission est sortie pendant ce step (événement emission-survived ou emission-caught
//      de zone.js) :
//        prise sans abri : 5 blessures déjà posées par zone.js ; le joueur s'évanouit jusqu'au
//        lendemain : bivouac à découvert forcé (journée en 'night', 0 PA, night = { rest:
//        'decouvert', cardDrawn: false }, écran 'night'). La défaite v1 (game-over de cause
//        'emission') est retirée. Mort des blessures : la partie s'arrête comme en v1.
//        Puis emissionAftermath.
//   2. Sinon, journée finie (day-ended) le jour annoncé sans que la carte soit sortie :
//      l'Émission passe pendant la nuit. Au lit ou dans un abri : rien ; à découvert :
//      5 blessures (cause 'emission'). Puis emissionAftermath.
//   3. Paquet Zone de la tuile courante accordé au calendrier :
//        hors du jour annoncé, ou compte à rebours déjà lancé : pas de carte Émission (retire
//        celle de la v1 sur une tuile neuve ; au jour 1, createCampaign l'a déjà retirée par
//        dropEmissionCard) ;
//        jour annoncé, carte pas encore sortie, paquet sans elle (voyage) : la carte est placée
//        dans le dernier tiers des pioches qui restent (emissionPositions de zone.js).
//      Voyage pendant le compte à rebours : le compte passe à la tuile d'arrivée.
//
// APRÈS L'ÉMISSION, SUR TOUTES LES TUILES : emissionAftermath(draft, ctx, { resetCurrent })
//   - jetons suspects retirés et reposés (placeSuspects, original false) sur chaque tuile de
//     world.tiles ; la tuile courante seulement si resetCurrent (abrité, zone.js l'a déjà fait) ;
//   - lieux vidés remplis en partie (refillPlaces, rules/places.js) ;
//   - PNJ isolés en danger (endangerNpcs cause 'emission', rules/npcs.js) ;
//   - un artefact rare sur une tuile au hasard : jeton suspect artefact avec item (pickup de
//     suspects.js donne cet objet) et une rumeur { type: 'artefact', tile, hex, item, day }
//     dans campaign.rumors (le barman la vendra, carte 23) ;
//   - calendrier relancé : today false, nextDay = jour + écart.
//
// ÉVÉNEMENTS :
//   { type: 'day-ended', reason: 'emission', rest: 'decouvert' }
//   { type: 'emission-night', rest, sheltered }
//   { type: 'suspects-reset', tile }      { type: 'rare-artefact', tile, hex, item }
//   { type: 'emission-aftermath', tiles }  tuiles dont les jetons ont été reposés
//   et ceux de la fiche (wounded, died), des lieux (place-refilled), des PNJ (npc-died).
//
// HYPOTHÈSES V2 :
//   - Le calendrier compte depuis le jour 1 : première Émission entre le jour 4 et le jour 6.
//   - Écart tiré uniformément entre 3 et 5 jours.
//   - Une Émission annoncée qui n'est pas sortie avant la fin de la journée passe la nuit ;
//     le lit et le bivouac dans un abri protègent.
//   - Artefact rare : un artefact du contenu dont le prix vaut RARE_PRICE ou plus, sur une
//     tuile déjà visitée (world.tiles), hexagone libre (ni jeton, ni rencontre, ni entrée, ni
//     joueur). Il disparaît à l'Émission suivante avec les autres jetons.
//   - Le PA d'un voyage ne fait pas avancer le compte à rebours (il ne fait pas piocher non plus).

import { dayState, storeDay } from '../campaign.js';
import { placeSuspects } from './suspects.js';
import { refillPlaces } from './places.js';
import { endangerNpcs } from './npcs.js';
import { tileHexes } from './tile.js';
import { wound } from './sheet.js';
import { emissionPositions, DRAW_EVERY, EMISSION_WOUNDS } from './zone.js';
import content from '../../content/index.js';

// « tous les 3 à 5 jours » (§10.1).
export const EMISSION_GAP = Object.freeze({ min: 3, max: 5 });
// Hypothèse v2 : le brief ne chiffre pas « rare ».
export const RARE_PRICE = 2000;

const FIRST_DAY = 1;
const CARD = 'emission';

export function rareArtefacts() {
  return Object.keys(content.items)
    .filter((id) => content.items[id].category === 'artefact' && content.items[id].price >= RARE_PRICE);
}

export function scheduleEmission(draft, ctx) {
  const emission = draft.world.emission;
  emission.nextDay ??= FIRST_DAY + gap(ctx.rng);
  while (emission.nextDay < draft.day) emission.nextDay += gap(ctx.rng);
  emission.today = emission.nextDay === draft.day;
}

export function emissionAfterStep(draft, events, ctx) {
  const passed = events.find((event) => event.type === 'emission-survived' || event.type === 'emission-caught');
  if (passed) {
    if (passed.type === 'emission-caught') faint(draft, events, ctx);
    emissionAftermath(draft, ctx, { resetCurrent: passed.type === 'emission-caught' });
  } else if (draft.world.emission.today && draft.night && events.some((event) => event.type === 'day-ended')) {
    nightEmission(draft, ctx);
    emissionAftermath(draft, ctx);
  }
  syncZone(draft, events, ctx);
}

export function emissionAftermath(draft, ctx, { resetCurrent = true } = {}) {
  const tiles = Object.keys(draft.world.tiles).filter((id) => resetCurrent || id !== draft.world.currentTile);
  for (const id of tiles) resetSuspects(draft, id, ctx);
  refillPlaces(draft, ctx);
  endangerNpcs(draft, ctx, { cause: 'emission' });
  placeRareArtefact(draft, ctx);
  draft.world.emission = { nextDay: draft.day + gap(ctx.rng), today: false };
  ctx.emit({ type: 'emission-aftermath', tiles });
}

function gap(rng) {
  return rng.int(EMISSION_GAP.min, EMISSION_GAP.max);
}

function faint(draft, events, ctx) {
  const day = dayState(draft);
  if (day.status !== 'emission') return;
  day.status = 'night';
  day.ap = { ...day.ap, left: 0 };
  day.outcome = null;
  storeDay(draft, day);
  draft.night = { rest: 'decouvert', cardDrawn: false };
  draft.screen = 'night';
  dropEmissionDefeat(events);
  ctx.emit({ type: 'day-ended', reason: 'emission', rest: 'decouvert' });
}

function dropEmissionDefeat(events) {
  const defeat = events.findIndex((event) => event.type === 'game-over' && event.outcome?.cause === 'emission');
  if (defeat >= 0) events.splice(defeat, 1);
}

function nightEmission(draft, ctx) {
  const { rest } = draft.night;
  const sheltered = rest !== 'decouvert';
  ctx.emit({ type: 'emission-night', rest, sheltered });
  if (sheltered) return;
  const day = dayState(draft);
  wound(day, EMISSION_WOUNDS, 'emission', ctx.emit);
  storeDay(draft, day);
}

function resetSuspects(draft, id, ctx) {
  const state = draft.world.tiles[id];
  const hex = id === draft.world.currentTile ? draft.world.hex : state.tile.entry;
  const board = { tile: state.tile, player: { hex } };
  placeSuspects(board, ctx.rng, { original: false });
  state.tokens = board.tokens;
  ctx.emit({ type: 'suspects-reset', tile: id });
}

function placeRareArtefact(draft, ctx) {
  const id = ctx.rng.pick(Object.keys(draft.world.tiles));
  const state = draft.world.tiles[id];
  const taken = new Set([
    ...state.tokens.map((token) => token.hex),
    ...state.encounters.map((encounter) => encounter.hex),
    state.tile.entry,
  ]);
  if (id === draft.world.currentTile) taken.add(draft.world.hex);
  const free = tileHexes(state.tile).filter((hex) => !taken.has(hex));
  if (free.length === 0) return;

  const hex = ctx.rng.pick(free);
  const item = ctx.rng.pick(rareArtefacts());
  state.tokens.push({ hex, kind: 'artefact', revealed: false, original: false, item });
  draft.rumors.push({ type: 'artefact', tile: id, hex, item, day: draft.day });
  ctx.emit({ type: 'rare-artefact', tile: id, hex, item });
}

function syncZone(draft, events, ctx) {
  const state = draft.world.tiles[draft.world.currentTile];
  if (!state?.zone) return;
  const travel = events.find((event) => event.type === 'traveled');
  if (travel) carryCountdown(draft.world.tiles[travel.from.tile].zone, state.zone);

  const { zone } = state;
  const cardPending = draft.world.emission.today && !zone.emission;
  if (!cardPending) dropEmissionCard(zone);
  else if (!zone.deck.includes(CARD)) insertCard(state, ctx);
}

// Jour 1 de la campagne (createCampaign) : pas d'Émission avant le calendrier.
export function dropEmissionCard(zone) {
  zone.deck = zone.deck.filter((card) => card !== CARD);
}

function carryCountdown(from, to) {
  if (from === to || !from?.emission) return;
  to.emission = from.emission;
  from.emission = null;
}

// La carte Émission dans le dernier tiers des pioches qui restent aujourd'hui.
function insertCard(state, ctx) {
  const { spent, left } = state.ap;
  const draws = Math.floor((spent + left) / DRAW_EVERY) - Math.floor(spent / DRAW_EVERY);
  if (draws === 0) return;
  const { deck } = state.zone;
  const { first, last } = emissionPositions(draws * DRAW_EVERY, deck.length + 1);
  deck.splice(ctx.rng.int(first - 1, last - 1), 0, CARD);
}
