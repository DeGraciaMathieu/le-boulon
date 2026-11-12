// Patrouilles entre tuiles (brief v2 §10.2, §9 ; carte LBL-49). Contenu : content.patrols
// (src/content/patrouilles.js), content.links (chemins entre tuiles).
//
// ÉTAT : campaign.world.patrols  [{ id, tile }]   tuile où se trouve chaque patrouille.
//   Posé à la première synchronisation depuis content.patrols (startingPatrols) : champ
//   facultatif, pas de changement de CAMPAIGN_VERSION. Une patrouille dispersée en sort.
//   Sur la tuile courante, chaque patrouille présente a un jeton de rencontre
//   { hex, card: id, patrol: id } dans world.tiles[tuile].encounters ; ce jeton n'existe que
//   sur la tuile courante (les autres tuiles ne voient pas leurs patrouilles).
//
// CIRCULATION (hook 'patrols' de DAY_HOOKS, rules/time.js) : movePatrols(draft, ctx)
//   Chaque matin, chaque patrouille jette 1d6 : à PATROL_MOVE_ON ou plus, elle passe sur une
//   tuile voisine tirée au hasard parmi celles que relie content.links. Puis syncPatrols.
//
// SYNCHRONISATION : syncPatrols(draft, ctx), aussi appelée à l'arrivée d'un voyage
//   (travel de rules/world.js, après la repose des rencontres) :
//   - retire les jetons des patrouilles absentes de la tuile courante, et tous les jetons
//     de patrouille des autres tuiles ('patrol-left' si le jeton était sur la tuile courante) ;
//   - pose un jeton pour chaque patrouille de la tuile courante qui n'en a pas
//     (placeEncounter de encounters.js, ni sur le joueur ni sur l'entrée) -> 'patrol-arrived'.
//
// RENCONTRE (réaction patrolsAfterStep, en tête de REACTIONS de campaign.js) :
//   Le jeton se joue comme une rencontre de la tuile (encounterOnEnter : test de Discrétion,
//   puis combat v2 ou combat rapide) ; sa carte vient de encounterCard de tile.js.
//   - Jeton révélé -> 'patrol-met' avec l'attitude encounterStance de factions.js. Patrouille
//     amicale ('echange', §9) : pas de combat, l'événement 'encounter-revealed' est remplacé
//     par 'patrol-met' et le jeton reste. Sinon le combat s'ouvre comme pour toute rencontre.
//   - Jeton retiré ('encounter-removed' : victoire, péage, échange) -> la patrouille est
//     dispersée ('patrol-dispersed'). Victoire en combat : réputation de sa faction
//     DEFEAT_REPUTATION (changeReputation de factions.js, §9 « combats contre des membres »).
//   - Fuite : le jeton reste, la patrouille aussi.
//
// LECTURE (pure) :
//   patrolsOf(campaign) -> [{ id, tile }]      patrolsOn(campaign, tile) -> [id]
//   startingPatrols()   -> [{ id, tile }]      isPatrol(card) -> bool
//
// ÉVÉNEMENTS :
//   { type: 'patrol-arrived', patrol, tile, hex }    { type: 'patrol-left', patrol, tile, hex }
//   { type: 'patrol-met', patrol, faction, hex, stance }
//   { type: 'patrol-dispersed', patrol, faction }
//   et 'reputation-changed' de factions.js.
//
// HYPOTHÈSES V2 (chiffres et lectures absents du §10.2) :
//   - PATROL_MOVE_ON = 4 (une chance sur deux de bouger chaque matin), une tuile par jour au plus.
//   - Les déplacements hors de la tuile courante ne sont pas annoncés : seule une rumeur
//     (§10.3) dira où est une patrouille. Le jet de déplacement n'est donc pas journalisé.
//   - Le jeton de patrouille porte sa carte dès la pose (card non null).
//   - Une patrouille dispersée ne revient pas.
//   - Battre une patrouille : -1 de réputation avec sa faction ; péage ou échange : rien.
//   - Une patrouille amicale rencontrée ne propose qu'un échange de paroles : le commerce
//     itinérant n'est pas dans cette carte.

import { placeEncounter } from './encounters.js';
import { changeReputation, encounterStance } from './factions.js';
import { tileHexes } from './tile.js';
import content from '../../content/index.js';

export const PATROL_MOVE_ON = 4;
export const DEFEAT_REPUTATION = -1;

const patrolData = (id) => content.patrols?.[id];

export function isPatrol(card) {
  return Boolean(card && patrolData(card));
}

export function startingPatrols() {
  return Object.entries(content.patrols ?? {}).map(([id, { tile }]) => ({ id, tile }));
}

export function patrolsOf(campaign) {
  return campaign.world.patrols ?? startingPatrols();
}

export function patrolsOn(campaign, tile) {
  return patrolsOf(campaign).filter((patrol) => patrol.tile === tile).map((patrol) => patrol.id);
}

export function movePatrols(draft, ctx) {
  draft.world.patrols = patrolsOf(draft).map((patrol) => movePatrol(patrol, ctx));
  syncPatrols(draft, ctx);
}

function movePatrol(patrol, ctx) {
  const roll = ctx.rng.d6();
  const exits = Object.values(content.links[patrol.tile] ?? {}).map((link) => link.tile);
  if (roll < PATROL_MOVE_ON || exits.length === 0) return patrol;
  return { ...patrol, tile: ctx.rng.pick(exits) };
}

export function syncPatrols(draft, ctx) {
  const { currentTile } = draft.world;
  draft.world.patrols = patrolsOf(draft);
  const here = patrolsOn(draft, currentTile);
  for (const [id, state] of Object.entries(draft.world.tiles)) {
    const stays = (encounter) => !encounter.patrol || (id === currentTile && here.includes(encounter.patrol));
    for (const encounter of state.encounters) {
      if (id === currentTile && !stays(encounter)) {
        ctx.emit({ type: 'patrol-left', patrol: encounter.patrol, tile: id, hex: encounter.hex });
      }
    }
    state.encounters = state.encounters.filter(stays);
  }
  const current = draft.world.tiles[currentTile];
  for (const patrol of here) {
    if (!current.encounters.some((encounter) => encounter.patrol === patrol)) placePatrol(draft, current, patrol, ctx);
  }
}

function placePatrol(draft, state, patrol, ctx) {
  const allowed = tileHexes(state.tile).filter((hex) => hex !== draft.world.hex);
  const hex = placeEncounter(state, ctx.rng, allowed);
  if (hex === null) return;
  Object.assign(state.encounters.at(-1), { card: patrol, patrol });
  ctx.emit({ type: 'patrol-arrived', patrol, tile: draft.world.currentTile, hex });
}

export function patrolsAfterStep(draft, events, ctx) {
  if (!draft.world.patrols) return;
  meetPatrol(draft, events, ctx);
  disperseSettled(draft, events, ctx);
}

function meetPatrol(draft, events, ctx) {
  const index = events.findIndex((event) => event.type === 'encounter-revealed' && isPatrol(event.card));
  if (index < 0) return;
  const { hex, card } = events[index];
  const { faction } = patrolData(card);
  const stance = encounterStance(draft, faction);
  if (stance === 'echange') {
    draft.world.tiles[draft.world.currentTile].combat = null;
    events.splice(index, 1);
  }
  ctx.emit({ type: 'patrol-met', patrol: card, faction, hex, stance });
}

function disperseSettled(draft, events, ctx) {
  for (const { type, card } of events) {
    if (type !== 'encounter-removed' || !draft.world.patrols.some((patrol) => patrol.id === card)) continue;
    const { faction } = patrolData(card);
    draft.world.patrols = draft.world.patrols.filter((patrol) => patrol.id !== card);
    ctx.emit({ type: 'patrol-dispersed', patrol: card, faction });
    if (wonAgainst(events, card)) changeReputation(draft, faction, DEFEAT_REPUTATION, ctx);
  }
}

// Combat v2 ('combat-ended' en victoire) ou combat rapide v1 ('fight' gagné).
function wonAgainst(events, card) {
  return events.some((event) => event.card === card
    && ((event.type === 'combat-ended' && event.outcome === 'victory') || (event.type === 'fight' && event.won)));
}
