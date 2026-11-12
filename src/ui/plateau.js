// Plateau vivant (direction plateau, lot L6 ; proposition §4). Lectures pures : elles traduisent
// les événements d'un step en pas du plateau pour le séquenceur, sans rien modifier et sans
// toucher au DOM (testées par tests/plateau.test.js). Le jeu des pas est dans plateau-view.js.
//
//   boardBeats(events, tile) -> événements avec les pas du plateau insérés après leur source ;
//   tile : la tuile courante après le step (les jetons des autres tuiles ne se voient pas).
//     { type: MOTIONS.pawn, from, to }               A3 moved, fled, traveled (from null : le
//                                                    pion arrive d'une autre tuile)
//     { type: MOTIONS.flip, token, hex }             A5 token-revealed, encounter-revealed
//     { type: MOTIONS.drop, token, hexes }           A6 patrouille, chiens, rencontres reposées,
//                                                    jetons reposés après l'Émission ; hexes null :
//                                                    tous les jetons de ce genre sur la tuile
//     { type: MOTIONS.wave, hex, tone, avoided }     A10 anomaly-triggered, anomaly-avoided
//     { type: MOTIONS.emission, left, start }        A15 emission-started, emission-countdown
//     { type: MOTIONS.dusk }                         A16 day-ended
//   token : 'suspect' ou 'rencontre' (classes des jetons de board.js).
//   emissionTrack(left) -> { cells: [{ lit }], left, max }   piste du compte à rebours

import { EMISSION_COUNTDOWN } from '../engine/rules/zone.js';

export const MOTIONS = Object.freeze({
  pawn: 'plateau-pion',
  flip: 'plateau-retourne',
  drop: 'plateau-pose',
  wave: 'plateau-onde',
  emission: 'plateau-emission',
  dusk: 'plateau-lampe',
});

const TONES = ['electro', 'gravitationnelle', 'bruleuse'];

// Teinte de l'onde : le type d'anomalie, 'inconnue' pour un type sans couleur propre.
export function anomalyTone(anomaly) {
  return TONES.includes(anomaly) ? anomaly : 'inconnue';
}

const here = (eventTile, tile) => (eventTile ?? tile) === tile;
const pawn = (from, to) => ({ type: MOTIONS.pawn, from, to });
const flip = (token, hex) => ({ type: MOTIONS.flip, token, hex });
const drop = (token, hexes) => ({ type: MOTIONS.drop, token, hexes });
const wave = (e, avoided) => ({ type: MOTIONS.wave, hex: e.hex, tone: anomalyTone(e.anomaly), avoided });

// Un hexagone null (carte de lieu, chiens sans place) ne se voit pas sur la tuile.
const MOTION_OF = {
  moved: (e) => e.from !== e.to && pawn(e.from, e.to),
  fled: (e) => !e.place && e.from !== e.to && pawn(e.from, e.to),
  traveled: (e, tile) => e.to.tile === tile && pawn(null, e.to.hex),
  'token-revealed': (e) => flip('suspect', e.hex),
  'encounter-revealed': (e) => e.hex !== null && flip('rencontre', e.hex),
  patrol: (e) => drop('rencontre', [e.to]),
  'patrol-arrived': (e, tile) => here(e.tile, tile) && drop('rencontre', [e.hex]),
  'dogs-placed': (e) => e.hex !== null && drop('rencontre', [e.hex]),
  'encounters-reset': (e, tile) => here(e.tile, tile) && e.hexes.length > 0 && drop('rencontre', e.hexes),
  'suspects-reset': (e, tile) => here(e.tile, tile) && drop('suspect', null),
  'rare-artefact': (e, tile) => here(e.tile, tile) && drop('suspect', [e.hex]),
  'anomaly-triggered': (e) => e.hex !== null && wave(e, false),
  'anomaly-avoided': (e) => e.hex !== null && wave(e, true),
  'emission-started': (e) => ({ type: MOTIONS.emission, left: e.apLeftToShelter, start: true }),
  'emission-countdown': (e) => ({ type: MOTIONS.emission, left: e.left, start: false }),
  'day-ended': () => ({ type: MOTIONS.dusk }),
};

export function boardBeats(events, tile) {
  return events.flatMap((event) => {
    const motion = MOTION_OF[event.type]?.(event, tile);
    return motion ? [event, motion] : [event];
  });
}

export function emissionTrack(left) {
  const lit = Math.max(0, Math.min(EMISSION_COUNTDOWN, left));
  return { cells: Array.from({ length: EMISSION_COUNTDOWN }, (_, i) => ({ lit: i < lit })), left: lit, max: EMISSION_COUNTDOWN };
}
