import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createCampaign, step } from '../src/engine/campaign.js';
import { PLACE_FEE } from '../src/engine/rules/places.js';
import content from '../src/content/index.js';
import { CARD_TYPES, PLACE_LINES, placeCrop, placeEntry, placeScreen, tilePlaces } from '../src/ui/place.js';

const ATP_HEX = content.places.atp.hex;
const AVANT_POSTE_HEX = content.places['avant-poste'].hex;

// Campagne posée sur l'hexagone d'un lieu du Cordon, puis entrée.
function at(hex, options = {}) {
  const campaign = createCampaign({ seed: 5, ...options });
  campaign.world.hex = hex;
  return campaign;
}

function enterAtp(options) {
  return step(at(ATP_HEX, options), { type: 'enter-place', place: 'atp' }).state;
}

test('tuile : les lieux explorables du Cordon, sans le hub', () => {
  const places = tilePlaces(createCampaign({ seed: 5 }));
  assert.deepEqual(places.map((p) => p.id).sort(), ['atp', 'avant-poste', 'elevateur', 'ferme-cordon', 'fosse-dechets']);
  assert.ok(places.every((p) => p.explored === 0 && !p.emptied));
});

test('tuile : l’avant-poste est tenu par les Militaires, l’ATP est libre', () => {
  const places = Object.fromEntries(tilePlaces(createCampaign({ seed: 5 })).map((p) => [p.id, p]));
  assert.equal(places['avant-poste'].occupied, true);
  assert.equal(places['avant-poste'].faction, 'Militaires');
  assert.equal(places.atp.occupied, false);
});

test('entrée : rien hors d’un lieu, un lieu libre sans approche', () => {
  assert.equal(placeEntry(at(1)), null);
  const entry = placeEntry(at(ATP_HEX));
  assert.equal(entry.id, 'atp');
  assert.equal(entry.occupied, false);
  assert.deepEqual(entry.options, []);
});

test('entrée : un lieu occupé propose combattre, se faufiler, payer (grisé sans roubles)', () => {
  const entry = placeEntry(at(AVANT_POSTE_HEX));
  assert.deepEqual(entry.options.map((o) => o.approach), ['combattre', 'se-faufiler', 'payer']);
  assert.deepEqual(entry.options.map((o) => o.enabled), [true, true, false]);

  const rich = at(AVANT_POSTE_HEX);
  rich.player.roubles = PLACE_FEE;
  assert.ok(placeEntry(rich).options.every((o) => o.enabled));
});

test('écran : null hors visite, paquet complet à l’entrée', () => {
  assert.equal(placeScreen(at(ATP_HEX)), null);
  const screen = placeScreen(enterAtp());
  assert.equal(screen.name, content.places.atp.name);
  assert.equal(screen.hex, ATP_HEX);
  assert.deepEqual(screen.cards, []);
  const deckSize = content.decks.atp.cards.reduce((sum, card) => sum + (card.count ?? 1), 0);
  assert.equal(screen.remaining, deckSize);
  assert.deepEqual(screen.explore, { cost: 1, enabled: true });
  assert.equal(screen.leave.enabled, true);
});

test('écran : Explorer pose une carte sur la pile, typée et numérotée', () => {
  const before = enterAtp();
  const { state, events } = step(before, { type: 'explore' });
  const played = events.find((e) => e.type === 'place-card');
  const screen = placeScreen(state);
  assert.equal(screen.cards.length, 1);
  assert.equal(screen.cards[0].id, played.card);
  assert.equal(screen.cards[0].position, 1);
  assert.equal(screen.cards[0].zone, 'main');
  assert.equal(screen.cards[0].label, CARD_TYPES[played.cardType]);
  assert.equal(screen.remaining, placeScreen(before).remaining - 1);
});

test('écran : un combat dans le lieu grise Explorer, Boulon et Quitter', () => {
  const { state } = step(at(AVANT_POSTE_HEX, { combatMode: 'rapide' }), { type: 'enter-place', place: 'avant-poste', approach: 'combattre' });
  const screen = placeScreen(state);
  assert.equal(screen.combat, true);
  assert.equal(screen.approach, 'Combattre');
  assert.equal(screen.explore.enabled, false);
  assert.equal(screen.bolt.enabled, false);
  assert.equal(screen.leave.enabled, false);
});

test('quitter : la progression reste visible sur la tuile', () => {
  // Première graine dont la première carte de l'ATP laisse sortir (ni combat ni dialogue).
  const explored = Array.from({ length: 30 }, (_, seed) => step(enterAtp({ seed }), { type: 'explore' }).state)
    .find((state) => placeScreen(state)?.leave.enabled);
  const left = step(explored, { type: 'leave-place' }).state;
  assert.equal(placeScreen(left), null);
  assert.equal(tilePlaces(left).find((p) => p.id === 'atp').explored, 1);
});

test('illustration : carré centré sur le lieu, gardé dans l’image', () => {
  const { calage } = content.tiles.cordon;
  const size = { width: 735, height: 679 };
  const center = placeCrop(1, calage, size);
  assert.equal(center.width, center.height);
  assert.ok(Math.abs(center.x + center.width / 2 - calage.cx) < 1e-9);
  for (let hex = 8; hex <= 19; hex++) {
    const crop = placeCrop(hex, calage, size);
    assert.ok(crop.x >= 0 && crop.y >= 0, `hexagone ${hex}`);
    assert.ok(crop.x + crop.width <= size.width && crop.y + crop.height <= size.height, `hexagone ${hex}`);
  }
});

test('journal : une ligne pour chaque événement de lieu d’une visite', () => {
  let campaign = enterAtp({ combatMode: 'rapide' });
  const events = [];
  while (campaign.place && !campaign.places.atp.emptied) {
    const result = step(campaign, campaign.place && placeScreen(campaign).combat ? { type: 'fight' } : { type: 'explore' });
    if (result.state === campaign) break;
    events.push(...result.events);
    campaign = result.state;
  }
  const placeEvents = events.filter((e) => e.type.startsWith('place-') || e.type === 'loot-found');
  assert.ok(placeEvents.length > 0);
  for (const event of placeEvents) assert.equal(typeof PLACE_LINES[event.type]?.(event), 'string', event.type);
});
