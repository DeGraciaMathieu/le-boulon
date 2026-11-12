import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createCampaign, step } from '../src/engine/campaign.js';
import content from '../src/content/index.js';
import { campaignEffects, emissionAmbience } from '../src/ui/effets.js';

test('effets : un événement sans retour visuel ne donne rien', () => {
  assert.deepEqual(campaignEffects([{ type: 'moved', to: 3 }, { type: 'weather', card: 'pluie' }]), []);
});

test('effets : voyage, carte de lieu, réveil, rang, dans l’ordre des événements', () => {
  const effects = campaignEffects([
    { type: 'traveled', from: { tile: 'cordon' }, to: { tile: 'decharge' }, cost: 1, firstVisit: true },
    { type: 'place-card', place: 'pont', card: 'x', cardType: 'butin', position: 1, zone: 'main' },
    { type: 'day-started', day: 3, ap: 12 },
    { type: 'rank-up', rank: 'experimente' },
  ]);
  assert.deepEqual(effects, [
    { kind: 'transition', tile: content.tiles.decharge.name, firstVisit: true },
    { kind: 'card', cardType: 'butin' },
    { kind: 'wake', day: 3 },
    { kind: 'rank', rank: 'experimente', name: 'Expérimenté' },
  ]);
});

test('effets : annonces de l’Émission, des signes du matin à la sortie', () => {
  const effects = campaignEffects([
    { type: 'weather', card: 'signes-emission' },
    { type: 'emission-started', apLeftToShelter: 3 },
    { type: 'emission-countdown', left: 2 },
    { type: 'emission-survived', hex: 5 },
    { type: 'emission-caught' },
  ]);
  assert.deepEqual(effects.map((effect) => effect.tone ?? effect.kind), ['signes', 'emission', 'countdown', 'abri', 'emission']);
  assert.equal(effects[1].text, '3 PA pour rejoindre un abri');
  assert.equal(effects[2].left, 2);
});

test('effets : un vrai réveil (camp puis wake) donne l’effet de réveil du nouveau jour', () => {
  const night = step(createCampaign({ seed: 1 }), { type: 'camp' }).state;
  const { state, events } = step(night, { type: 'wake' });
  assert.deepEqual(campaignEffects(events).filter((effect) => effect.kind === 'wake'), [{ kind: 'wake', day: state.day }]);
});

test('ambiance : rien hors Émission, PA restants pendant', () => {
  const campaign = createCampaign({ seed: 1 });
  assert.equal(emissionAmbience(campaign), null);
  campaign.world.tiles[campaign.world.currentTile].zone.emission = { left: 2 };
  assert.deepEqual(emissionAmbience(campaign), { left: 2 });
  campaign.screen = 'night';
  assert.equal(emissionAmbience(campaign), null);
});
