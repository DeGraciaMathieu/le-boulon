// Dire au joueur quoi faire (brief v2 §16) : encart Objectif du panneau, introduction d'une
// nouvelle campagne, marqueur « ! » sur le donneur de la quête principale tant qu'elle n'est
// pas prise. Pures : elles lisent la campagne et le contenu, sans DOM (tests/objectif.test.js).
//
//   INTRO_LINES                    les 3 phrases de l'écran d'introduction
//   objectiveFocus(campaign) -> { title, step, target, tile, hex, here }
//     quête suivie : la quête principale si elle est active, sinon la première quête active ;
//     avant la quête principale : aller voir son donneur. target : texte de la cible ou null ;
//     here : la cible est sur la tuile courante (hex : son hexagone, ou null).
//   giverMarkers(campaign) -> [{ hex, npc, name }]  donneur de la quête principale non prise,
//     sur la tuile courante

import content from '../content/index.js';
import { questLog } from '../engine/rules/quests.js';
import { objectiveText, targetText, talkLabel } from './pda.js';

const MAIN_QUEST = 'le-guide';

export const INTRO_LINES = Object.freeze([
  'Vous êtes un stalker de plus, un bleu sans nom venu chercher fortune dans la Zone.',
  'Le Cordon est sa lisière : des fermes vides, des patrouilles, des anomalies, et le Camp des novices pour souffler.',
  'Le Marchand du bunker, au camp, a du travail pour qui ne pose pas trop de questions. Allez le voir.',
]);

export function objectiveFocus(campaign) {
  const { active } = questLog(campaign);
  const entry = active.find((quest) => quest.quest === MAIN_QUEST) ?? active[0];
  if (entry) {
    const step = entry.waiting ? 'Choisir la suite : voir le PDA' : objectiveText(entry.objective, campaign);
    return focus(campaign, entry.name, step, entry.target);
  }
  const giver = giverOf(campaign);
  if (giver) {
    const { tile, hex } = content.places[giver.place];
    return focus(campaign, 'Pour commencer', talkLabel(giver.name), { tile, place: giver.place, hex });
  }
  return focus(campaign, 'Aucune quête en cours', 'Les tableaux de contrats des hubs proposent du travail', null);
}

export function giverMarkers(campaign) {
  const giver = giverOf(campaign);
  const place = giver && content.places[giver.place];
  if (!place || place.tile !== campaign.world.currentTile) return [];
  return [{ hex: place.hex, npc: giver.npc, name: giver.name }];
}

// Donneur de la quête principale tant qu'elle n'est pas prise, s'il est en vie et quelque part.
function giverOf(campaign) {
  if (campaign.quests[MAIN_QUEST]) return null;
  const npc = content.quests[MAIN_QUEST]?.giver;
  const state = campaign.npcs[npc];
  if (!state?.alive || !state.place) return null;
  return { npc, place: state.place, name: content.npcs[npc].name };
}

function focus(campaign, title, step, target) {
  return {
    title,
    step,
    target: target ? targetText(target) : null,
    tile: target?.tile ?? null,
    hex: target?.hex ?? null,
    here: target?.tile === campaign.world.currentTile,
  };
}
