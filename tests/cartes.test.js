import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createCampaign, step } from '../src/engine/campaign.js';
import {
  BEATS, cardBeats, zoneFace, peekFace, zoneDeck, nextDiscard, wakeCards, settleEnemies,
} from '../src/ui/cartes.js';

const types = (beats) => beats.map((beat) => beat.type);

test('cardBeats : la carte Zone sort après son événement, avec son gain', () => {
  const beats = cardBeats([
    { type: 'moved', to: 3 },
    { type: 'zone-card', card: 'cachette' },
    { type: 'cache-found', item: 'bandage', stored: true },
  ]);
  assert.deepEqual(types(beats), ['moved', 'zone-card', BEATS.zone, 'cache-found']);
  assert.deepEqual(beats[2].face, { title: 'Cachette', text: 'Un consommable oublié.', gain: '+ Bandage' });
});

test('zoneFace : le gain s’arrête à la carte suivante', () => {
  const face = zoneFace('calme', [{ type: 'zone-card', card: 'cachette' }, { type: 'cache-found', item: 'vodka', stored: true }]);
  assert.equal(face.gain, null);
  assert.equal(zoneFace('emission', [{ type: 'emission-started', apLeftToShelter: 3 }]).gain, '3 PA pour un abri');
  assert.match(zoneFace('cachette', [{ type: 'cache-found', item: 'ration', stored: false }]).gain, /sac plein/);
});

test('cardBeats : cartes de lieu, désamorcée et aperçu au boulon', () => {
  const beats = cardBeats([
    { type: 'place-card', place: 'atp', card: 'x', cardType: 'butin', position: 1, zone: 'main' },
    { type: 'card-defused', place: 'atp', card: 'y', position: 2, zone: 'main' },
    { type: 'card-peeked', place: 'atp', card: 'z', cardType: 'anomalie' },
  ]);
  assert.deepEqual(types(beats), ['place-card', BEATS.place, 'card-defused', BEATS.place, 'card-peeked', BEATS.peek]);
  assert.deepEqual(beats[5].face, peekFace('anomalie'));
  assert.equal(peekFace('anomalie').title, 'Anomalie');
});

test('cardBeats : Nuit et Météo posées avant le réveil, retournées après', () => {
  const beats = cardBeats([{ type: 'night-card', deck: 'nuit-cordon', card: 'nuit-calme' }, { type: 'day-started', day: 2, ap: 10 }]);
  assert.deepEqual(types(beats), ['night-card', BEATS.wakeDeal, 'day-started', BEATS.wake]);
});

test('cardBeats : un seul tampon de mission par step, quête prise comprise', () => {
  const taken = cardBeats([{ type: 'quest-started', quest: 'q' }, { type: 'quest-step', quest: 'q', step: 'a' }]);
  assert.deepEqual(types(taken), ['quest-started', 'quest-step', BEATS.mission]);
  const advanced = cardBeats([
    { type: 'quest-step', quest: 'q', step: 'b' },
    { type: 'xp-gained', amount: 5 },
    { type: 'quest-completed', quest: 'q' },
    { type: 'roubles-changed', amount: 100 },
  ]);
  assert.deepEqual(types(advanced), ['quest-step', 'xp-gained', 'quest-completed', BEATS.mission, 'roubles-changed']);
  assert.equal(advanced[3].done, true);
  assert.equal(cardBeats([{ type: 'quest-step', quest: 'q', step: 'b' }])[1].done, false);
});

test('cardBeats : tir qui touche et ennemi abattu ; un tir raté ne donne rien', () => {
  const beats = cardBeats([
    { type: 'shot', target: 0, hit: false, hp: 3, damage: 1 },
    { type: 'shot', target: 1, hit: true, hp: 0, damage: 2 },
    { type: 'enemy-down', enemy: 1, name: 'Chair' },
  ]);
  assert.deepEqual(beats.filter((beat) => beat.type === BEATS.enemy), [
    { type: BEATS.enemy, index: 1, hp: 0, damage: 2, down: false },
    { type: BEATS.enemy, index: 1, down: true },
  ]);
});

test('zoneDeck : cartes restantes du paquet Zone de la tuile courante', () => {
  const campaign = createCampaign({ seed: 1 });
  const { deck } = campaign.world.tiles[campaign.world.currentTile].zone;
  assert.deepEqual(zoneDeck(campaign), { left: deck.length });
});

test('nextDiscard : empile les cartes Zone, vidée au réveil et au voyage', () => {
  const discard = nextDiscard([], [{ type: 'zone-card', card: 'calme' }, { type: 'zone-card', card: 'radio' }]);
  assert.deepEqual(discard, ['calme', 'radio']);
  assert.deepEqual(nextDiscard(discard, [{ type: 'day-started', day: 2 }, { type: 'zone-card', card: 'chiens' }]), ['chiens']);
  assert.deepEqual(nextDiscard(discard, [{ type: 'traveled', to: { tile: 'decharge' } }]), []);
});

test('wakeCards : carte Nuit avec son effet, puis Météo', () => {
  const cards = wakeCards([
    { type: 'day-ended', reason: 'camp' },
    { type: 'night-card', deck: 'nuit-cordon', card: 'vent-radioactif' },
    { type: 'weather', card: 'pluie' },
    { type: 'day-started', day: 2, ap: 10, weather: 'pluie' },
  ]);
  assert.deepEqual(cards, [
    { kind: 'nuit', title: 'Vent radioactif', text: '+1 radiation' },
    { kind: 'meteo', title: 'Pluie', text: 'Discrétion +1, détecteur -1' },
  ]);
});

test('wakeCards : un vrai réveil donne au moins la carte Météo', () => {
  const night = step(createCampaign({ seed: 1 }), { type: 'camp' }).state;
  const { events } = step(night, { type: 'wake' });
  const cards = wakeCards(events);
  assert.equal(cards.at(-1).kind, 'meteo');
  assert.ok(cards.every((card) => card.title && typeof card.text === 'string'));
});

test('settleEnemies : PV après le tir, abattu ; la liste d’origine ne bouge pas', () => {
  const enemies = [{ index: 0, hp: 3, maxHp: 3, down: false }, { index: 1, hp: 2, maxHp: 2, down: false }];
  const settled = settleEnemies(enemies, [
    { type: 'shot', target: 0, hit: true, hp: 1, damage: 2 },
    { type: 'shot', target: 1, hit: true, hp: 0, damage: 2 },
    { type: 'enemy-down', enemy: 1, name: 'Chair' },
    { type: 'enemy-attack', enemy: 0, hit: true },
  ]);
  assert.deepEqual(settled.map(({ hp, down }) => ({ hp, down })), [{ hp: 1, down: false }, { hp: 0, down: true }]);
  assert.equal(enemies[1].hp, 2);
});
