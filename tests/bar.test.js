import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createCampaign, step } from '../src/engine/campaign.js';
import { neighbors } from '../src/engine/hex.js';
import { HUNGER_MALUS, OPEN_AIR_MALUS } from '../src/engine/rules/time.js';
import { WOUND_PENALTY_AT, RADIATION_RESET, TRACK_MAX } from '../src/engine/rules/sheet.js';
import { apTrack, notchTracks, coinStack, barSnapshot, barBeats, BEATS, COIN_MAX } from '../src/ui/bar.js';

const jsonCopy = (value) => JSON.parse(JSON.stringify(value));
const fresh = () => jsonCopy(createCampaign({ seed: 1 }));
const tileOf = (campaign) => campaign.world.tiles[campaign.world.currentTile];
const kinds = (track) => track.slots.map((slot) => slot.kind);

function setAp(campaign, ap, player = {}) {
  const tile = tileOf(campaign);
  tile.ap = { ...tile.ap, ...ap };
  tile.player = { ...tile.player, ...player };
}

test('apTrack : au départ, dix cubes dans leurs alvéoles', () => {
  const track = apTrack(fresh());
  assert.equal(track.slots.length, 10);
  assert.deepEqual(kinds(track), Array(10).fill('cube'));
  assert.equal(track.left, 10);
  assert.equal(track.max, 10);
});

test('apTrack : les PA dépensés laissent des alvéoles vides', () => {
  const campaign = fresh();
  setAp(campaign, { left: 7, spent: 3 });
  const track = apTrack(campaign);
  assert.deepEqual(kinds(track), [...Array(7).fill('cube'), ...Array(3).fill('vide')]);
  assert.equal(track.spent, 3);
  assert.equal(track.lost, 0);
});

test('apTrack : faim et nuit à découvert retiennent des cubes au bout de la piste, étiquetés', () => {
  const campaign = fresh();
  campaign.player.hunger = 1;
  const max = 10 - HUNGER_MALUS - OPEN_AIR_MALUS;
  setAp(campaign, { max, left: max, spent: 0 });
  const track = apTrack(campaign);
  assert.equal(track.slots.length, 10);
  const held = track.slots.filter((slot) => slot.kind === 'retenu');
  assert.deepEqual(held.map((slot) => slot.cause), [...Array(HUNGER_MALUS).fill('faim'), ...Array(OPEN_AIR_MALUS).fill('decouvert')]);
  assert.match(held[0].title, /faim/);
  assert.equal(held[0].tag, 'faim');
});

test('apTrack : 4 blessures au réveil retiennent un cube, la pénalité du jour aussi', () => {
  const atWake = fresh();
  atWake.player.wounds = WOUND_PENALTY_AT;
  setAp(atWake, { max: 9, left: 9, spent: 0 }, { woundPenalty: true });
  assert.deepEqual(apTrack(atWake).slots.filter((s) => s.kind === 'retenu').map((s) => s.cause), ['blessures']);

  const midDay = fresh();
  midDay.player.wounds = WOUND_PENALTY_AT;
  setAp(midDay, { left: 6, spent: 3 }, { woundPenalty: true });
  const track = apTrack(midDay);
  assert.deepEqual(kinds(track), [...Array(6).fill('cube'), ...Array(3).fill('vide'), 'retenu']);
  assert.equal(track.slots[9].cause, 'blessures');
  assert.match(track.slots[9].title, /−1 PA : 4 blessures/);
});

test('apTrack : PA perdus en fin de journée et boisson du jour', () => {
  const ended = fresh();
  setAp(ended, { left: 0, spent: 4 });
  tileOf(ended).status = 'night';
  const track = apTrack(ended);
  assert.equal(track.lost, 6);
  assert.equal(track.slots.filter((slot) => slot.kind === 'retenu').length, 0);

  const boosted = fresh();
  setAp(boosted, { left: 12, spent: 0, boosted: true });
  assert.deepEqual(kinds(apTrack(boosted)), Array(12).fill('cube'));
});

test('notchTracks : seuils marqués d’avance, crans allumés', () => {
  const campaign = fresh();
  campaign.player.wounds = 2;
  campaign.player.hunger = 1;
  const { blessures, radiations, faim } = notchTracks(campaign);
  assert.equal(blessures.size, TRACK_MAX);
  assert.deepEqual(blessures.notches.filter((n) => n.lit).map((n) => n.n), [1, 2]);
  assert.equal(blessures.notches[WOUND_PENALTY_AT - 1].mark.tag, '−1 PA');
  assert.equal(blessures.notches[TRACK_MAX - 1].mark.tag, 'mort');
  assert.match(radiations.notches[TRACK_MAX - 1].mark.title, new RegExp(`retour à ${RADIATION_RESET}`));
  assert.equal(faim.notches[0].mark.tag, `−${HUNGER_MALUS} PA`);
  assert.equal(faim.value, 1);
});

test('notchTracks : Coriace allonge la piste des blessures', () => {
  const campaign = fresh();
  campaign.player.perks = ['coriace'];
  assert.equal(notchTracks(campaign).blessures.size, TRACK_MAX + 1);
});

test('coinStack : une pièce par tranche de 100 roubles, pile plafonnée', () => {
  assert.equal(coinStack(0), 0);
  assert.equal(coinStack(1), 1);
  assert.equal(coinStack(250), 3);
  assert.equal(coinStack(1e6), COIN_MAX);
});

test('barBeats : un déplacement fait glisser son cube en tête de séquence', () => {
  const campaign = fresh();
  const before = barSnapshot(campaign);
  const result = step(campaign, { type: 'move', to: neighbors(campaign.world.hex)[0] });
  const beats = barBeats(result.events, before, barSnapshot(result.state));
  assert.deepEqual(beats[0], { type: BEATS.spend, count: result.state.world.tiles.cordon.ap.spent });
  assert.deepEqual(beats.slice(1), result.events);
});

test('barBeats : blessure, irradiation, faim et réveil donnent leurs pas après l’événement', () => {
  const before = { ...barSnapshot(fresh()), wounds: 3, radiation: 5 };
  const after = { ...before, day: 2, spent: 0 };
  const events = [
    { type: 'hunger', days: 2, ap: -2, wounds: 1 },
    { type: 'irradiated', amount: 2, cause: 'ceinture' },
    { type: 'wounded', amount: 1, cause: 'radiation' },
    { type: 'ap-penalty', amount: 1, cause: 'wounds' },
    { type: 'day-started', day: 2, ap: 7 },
  ];
  const beats = barBeats(events, { ...before, day: 1, spent: 6 }, after).filter((beat) => beat.type.startsWith('bandeau-'));
  assert.deepEqual(beats, [
    { type: BEATS.notch, track: 'faim', from: 1, to: 2, crossed: [2] },
    { type: BEATS.notch, track: 'radiations', from: 5, to: TRACK_MAX, crossed: [TRACK_MAX] },
    { type: BEATS.notch, track: 'blessures', from: 3, to: 4, crossed: [WOUND_PENALTY_AT] },
    { type: BEATS.penalty, cause: 'blessures' },
    { type: BEATS.wake },
  ]);
});
