import { test } from 'node:test';
import assert from 'node:assert/strict';
import { boardBeats, emissionTrack, anomalyTone, MOTIONS } from '../src/ui/plateau.js';
import { EMISSION_COUNTDOWN } from '../src/engine/rules/zone.js';

const motions = (events, tile = 'cordon') => boardBeats(events, tile).filter((beat) => Object.values(MOTIONS).includes(beat.type));

test('plateau : chaque pas suit son événement source, les autres passent tels quels', () => {
  const moved = { type: 'moved', from: 10, to: 11, cost: 1 };
  const revealed = { type: 'token-revealed', hex: 11, kind: 'anomalie', anomaly: 'electro', original: true, by: 'enter' };
  const triggered = { type: 'anomaly-triggered', hex: 11, anomaly: 'electro' };
  const other = { type: 'wounded', amount: 1 };
  assert.deepEqual(boardBeats([moved, revealed, triggered, other], 'cordon'), [
    moved, { type: MOTIONS.pawn, from: 10, to: 11 },
    revealed, { type: MOTIONS.flip, token: 'suspect', hex: 11 },
    triggered, { type: MOTIONS.wave, hex: 11, tone: 'electro', avoided: false },
    other,
  ]);
});

test('plateau : pion (A3), immobile ou dans un lieu il ne bouge pas, arrivé d’une autre tuile il tombe', () => {
  assert.deepEqual(motions([
    { type: 'fled', from: 5, to: 4, cost: 2 },
    { type: 'fled', from: 5, to: 5, cost: 0, wounds: 1 },
    { type: 'fled', from: 5, to: 4, cost: 2, place: 'ferme' },
    { type: 'traveled', from: { tile: 'cordon', hex: 3 }, to: { tile: 'decharge', hex: 20 }, cost: 1, firstVisit: true },
  ], 'decharge'), [
    { type: MOTIONS.pawn, from: 5, to: 4 },
    { type: MOTIONS.pawn, from: null, to: 20 },
  ]);
});

test('plateau : retournements (A5) seulement sur la tuile', () => {
  assert.deepEqual(motions([
    { type: 'encounter-revealed', hex: 7, card: 'bandits' },
    { type: 'encounter-revealed', hex: null, card: 'bandits', place: 'ferme' },
  ]), [{ type: MOTIONS.flip, token: 'rencontre', hex: 7 }]);
});

test('plateau : jetons posés (A6), ceux des autres tuiles ignorés', () => {
  assert.deepEqual(motions([
    { type: 'patrol', from: 3, to: 8 },
    { type: 'patrol-arrived', patrol: 'p1', tile: 'cordon', hex: 9 },
    { type: 'patrol-arrived', patrol: 'p2', tile: 'marais', hex: 9 },
    { type: 'dogs-placed', hex: null },
    { type: 'dogs-placed', hex: 12 },
    { type: 'encounters-reset', tile: 'cordon', hexes: [] },
    { type: 'encounters-reset', tile: 'cordon', hexes: [2, 6] },
    { type: 'suspects-reset' },
    { type: 'suspects-reset', tile: 'marais' },
    { type: 'suspects-reset', tile: 'cordon' },
    { type: 'rare-artefact', tile: 'cordon', hex: 14, item: 'meduse' },
  ]), [
    { type: MOTIONS.drop, token: 'rencontre', hexes: [8] },
    { type: MOTIONS.drop, token: 'rencontre', hexes: [9] },
    { type: MOTIONS.drop, token: 'rencontre', hexes: [12] },
    { type: MOTIONS.drop, token: 'rencontre', hexes: [2, 6] },
    { type: MOTIONS.drop, token: 'suspect', hexes: null },
    { type: MOTIONS.drop, token: 'suspect', hexes: null },
    { type: MOTIONS.drop, token: 'suspect', hexes: [14] },
  ]);
});

test('plateau : onde (A10) colorée par type, évitée, rien pour une carte de lieu', () => {
  assert.deepEqual(motions([
    { type: 'anomaly-avoided', hex: 4, anomaly: 'gravitationnelle' },
    { type: 'anomaly-triggered', hex: null, anomaly: 'bruleuse' },
    { type: 'anomaly-triggered', hex: 6, anomaly: 'mysterieuse' },
  ]), [
    { type: MOTIONS.wave, hex: 4, tone: 'gravitationnelle', avoided: true },
    { type: MOTIONS.wave, hex: 6, tone: 'inconnue', avoided: false },
  ]);
  assert.equal(anomalyTone('bruleuse'), 'bruleuse');
  assert.equal(anomalyTone(undefined), 'inconnue');
});

test('plateau : Émission (A15) et fin de journée (A16)', () => {
  assert.deepEqual(motions([
    { type: 'emission-started', apLeftToShelter: 3 },
    { type: 'emission-countdown', left: 2 },
    { type: 'day-ended', reason: 'camp', rest: 'decouvert' },
  ]), [
    { type: MOTIONS.emission, left: 3, start: true },
    { type: MOTIONS.emission, left: 2, start: false },
    { type: MOTIONS.dusk },
  ]);
});

test('plateau : piste du compte à rebours, une case par PA du compte, bornée', () => {
  const track = emissionTrack(2);
  assert.equal(track.max, EMISSION_COUNTDOWN);
  assert.equal(track.cells.length, EMISSION_COUNTDOWN);
  assert.deepEqual(track.cells.map((cell) => cell.lit), [true, true, false]);
  assert.equal(emissionTrack(-1).left, 0);
  assert.equal(emissionTrack(9).left, EMISSION_COUNTDOWN);
});
