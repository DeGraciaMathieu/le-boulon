// Retours visuels de la campagne (brief v2 §16 ; carte 32). Lectures pures : elles traduisent
// les événements d'un step et la campagne en effets à jouer, sans rien modifier et sans toucher
// au DOM (testées par tests/effets.test.js). Le jeu des effets est dans effets-view.js, sur le
// modèle de fx.js de la v1.
//
//   campaignEffects(events) -> [effet], dans l'ordre des événements :
//     { kind: 'transition', tile, firstVisit }   traveled : passage d'une tuile à l'autre
//     { kind: 'card', cardType }                  place-card : carte de lieu révélée
//     { kind: 'wake', day }                       day-started : réveil
//     { kind: 'announce', tone, title, text }     annonce globale de l'Émission
//       tone 'signes' (carte Météo du matin), 'emission' (elle frappe, ou elle a pris le
//       joueur), 'abri' (passée à l'abri)
//     { kind: 'countdown', left }                 emission-countdown
//     { kind: 'rank', rank, name }                rank-up
//   emissionAmbience(campaign) -> null | { left }  Émission en cours sur la tuile : teinte et
//                                                  compte à rebours tant qu'elle dure

import content from '../content/index.js';
import { RANK_NAMES } from './pda.js';

const tileName = (id) => content.tiles[id]?.name ?? id;

const EFFECTS = {
  traveled: (e) => ({ kind: 'transition', tile: tileName(e.to.tile), firstVisit: Boolean(e.firstVisit) }),
  'place-card': (e) => ({ kind: 'card', cardType: e.cardType }),
  'day-started': (e) => ({ kind: 'wake', day: e.day }),
  weather: (e) => (e.card === 'signes-emission'
    ? { kind: 'announce', tone: 'signes', title: "Signes d'Émission", text: "Elle frappera aujourd'hui : repérer un abri" }
    : null),
  'emission-started': (e) => ({ kind: 'announce', tone: 'emission', title: 'Émission', text: `${e.apLeftToShelter} PA pour rejoindre un abri` }),
  'emission-countdown': (e) => ({ kind: 'countdown', left: e.left }),
  'emission-survived': () => ({ kind: 'announce', tone: 'abri', title: 'Émission passée', text: "À l'abri" }),
  'emission-caught': () => ({ kind: 'announce', tone: 'emission', title: "Pris par l'Émission", text: 'Évanoui à découvert' }),
  'rank-up': (e) => ({ kind: 'rank', rank: e.rank, name: RANK_NAMES[e.rank] ?? e.rank }),
};

export function campaignEffects(events) {
  return events.map((event) => EFFECTS[event.type]?.(event) ?? null).filter(Boolean);
}

export function emissionAmbience(campaign) {
  const emission = campaign.world.tiles[campaign.world.currentTile]?.zone?.emission;
  return emission && campaign.screen !== 'night' ? { left: emission.left } : null;
}
