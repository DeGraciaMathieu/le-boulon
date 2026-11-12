// Tables de butin et paquets d'exploration du contenu (brief v2 §5.1-5.3, carte 11), et
// paquets de rencontres des tuiles au format decks.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import content from '../src/content/index.js';
import { createCampaign, step } from '../src/engine/campaign.js';
import { rollLoot } from '../src/engine/rules/places.js';
import { encounterCards, cardsById, DEFAULT_ENCOUNTER_CARDS } from '../src/engine/rules/tile.js';
import { createRng } from '../src/engine/rng.js';

const { places, decks, loot, tiles, items } = content;
const hubs = Object.entries(places).filter(([, place]) => place.tags.includes('hub'));
const explorable = Object.entries(places).filter(([, place]) => !place.tags.includes('hub'));
const size = (deck) => deck.cards.reduce((sum, card) => sum + (card.count ?? 1), 0);

test('chaque lieu hors hub a son paquet d’exploration de 4 à 10 cartes (§5.1)', () => {
  assert.ok(explorable.length >= 39);
  for (const [id, place] of explorable) {
    const deck = decks[place.deck];
    assert.ok(deck, `${id} : pas de paquet`);
    assert.equal(deck.kind, 'exploration', id);
    assert.equal(deck.place, id, id);
    assert.ok(size(deck) >= 4 && size(deck) <= 10, `${id} : ${size(deck)} cartes`);
  }
});

test('les hubs n’ont pas de paquet : zones sûres de services (hypothèse v2)', () => {
  assert.equal(hubs.length, 4);
  for (const [id, place] of hubs) assert.equal(place.deck, undefined, id);
});

test('la table de butin d’un lieu suit le niveau de sa tuile (§5.3)', () => {
  for (const [id, place] of explorable) {
    const table = loot[place.loot];
    assert.ok(table, `${id} : pas de table`);
    assert.equal(table.level, tiles[place.tile].level, id);
  }
});

test('tables de butin : niveaux 1 à 4, poids entiers positifs, objets vendables du catalogue', () => {
  const levels = new Set(Object.values(loot).map((table) => table.level));
  assert.deepEqual([...levels].sort(), [1, 2, 3, 4]);
  for (const [id, table] of Object.entries(loot)) {
    assert.ok(table.entries.length > 0, id);
    for (const { item, weight, qty } of table.entries) {
      assert.ok(items[item], `${id} : ${item}`);
      assert.notEqual(items[item].category, 'quete', `${id} : ${item}`);
      assert.ok(Number.isInteger(weight) && weight > 0, `${id}.${item}.weight`);
      assert.ok(qty === undefined || (Number.isInteger(qty) && qty > 0), `${id}.${item}.qty`);
    }
  }
});

test('le butin s’enrichit avec le niveau : valeur moyenne d’un tirage croissante', () => {
  const average = (tableId) => {
    const { entries } = loot[tableId];
    const total = entries.reduce((sum, e) => sum + e.weight, 0);
    return entries.reduce((sum, e) => sum + (e.weight / total) * items[e.item].price * (e.qty ?? 1), 0);
  };
  for (const theme of ['commun', 'militaire', 'irradie', 'cache']) {
    const values = [1, 2, 3, 4].map((level) => average(`n${level}-${theme}`));
    assert.deepEqual(values, [...values].sort((a, b) => a - b), theme);
  }
});

test('chaque type de carte d’exploration du §5.2 sert au moins une fois', () => {
  const types = new Set(Object.values(decks).flatMap((deck) => deck.cards.map((card) => card.type)));
  for (const type of ['butin', 'cache', 'anomalie', 'occupant', 'pnj', 'indice', 'passage', 'rien']) {
    assert.ok(types.has(type), type);
  }
});

test('l’ATP porte l’indice de l’acte 1 que la quête fixe en 3e position', () => {
  assert.ok(decks[places.atp.deck].cards.some((card) => card.id === 'indice-acte1' && card.type === 'indice'));
});

test('les lieux longs ouvrent un paquet intérieur plus riche (Souterrains, Complexe)', () => {
  for (const id of ['souterrains', 'complexe']) {
    const passage = decks[places[id].deck].cards.find((card) => card.type === 'passage');
    assert.ok(passage, id);
    const inner = decks[passage.deck];
    assert.equal(inner.kind, 'exploration', id);
    assert.ok(inner.cards.some((card) => card.loot?.endsWith('-cache')), id);
  }
});

test('rollLoot sur une table du contenu : tirages à graine, objets de la table', () => {
  const first = rollLoot('n2-irradie', createRng(3), 5);
  assert.deepEqual(rollLoot('n2-irradie', createRng(3), 5), first);
  const allowed = loot['n2-irradie'].entries.map((e) => e.item);
  assert.equal(first.length, 5);
  for (const { item } of first) assert.ok(allowed.includes(item), item);
});

test('rencontres : un paquet decks { kind: rencontres, tile, cards } par tuile', () => {
  for (const [id, tile] of Object.entries(tiles)) {
    const deck = decks[tile.encounters];
    assert.ok(deck, id);
    assert.equal(deck.kind, 'rencontres', id);
    assert.equal(deck.tile, id, id);
    assert.ok(deck.cards.length >= 4, id);
    for (const card of deck.cards) {
      assert.equal(typeof card.name, 'string', `${id}.${card.id}`);
      assert.ok(Number.isInteger(card.threat) && card.threat > 0, `${id}.${card.id}.threat`);
      assert.ok(Number.isInteger(card.wounds) && card.wounds > 0, `${id}.${card.id}.wounds`);
    }
  }
});

test('encounterCards lit le paquet de la tuile et rend toujours le même dictionnaire par id', () => {
  const cordon = encounterCards(tiles.cordon);
  assert.deepEqual(Object.keys(cordon), decks['rencontres-cordon'].cards.map((card) => card.id));
  assert.equal(encounterCards(tiles.cordon), cordon);
  // Une tuile relue d'une sauvegarde garde l'id du paquet.
  assert.equal(encounterCards(JSON.parse(JSON.stringify(tiles.cordon))), cordon);
  assert.equal(encounterCards(tiles.agroprom), DEFAULT_ENCOUNTER_CARDS);
  assert.equal(cardsById(decks['rencontres-agroprom']), DEFAULT_ENCOUNTER_CARDS);
  assert.ok(Object.isFrozen(cordon));
});

test('chaque occupant d’un paquet de lieu est une carte du paquet de rencontres de sa tuile', () => {
  for (const [id, place] of explorable) {
    const known = encounterCards(tiles[place.tile]);
    const inner = decks[place.deck].cards.filter((c) => c.type === 'passage').map((c) => decks[c.deck]);
    for (const deck of [decks[place.deck], ...inner]) {
      for (const card of deck.cards.filter((c) => c.type === 'occupant')) {
        assert.ok(known[card.encounter], `${id}.${card.id} : ${card.encounter}`);
      }
    }
  }
});

test('explorer un lieu du contenu : la Ferme du Cordon donne le butin de ses tables', () => {
  let campaign = createCampaign({ seed: 11 });
  campaign.world.tiles.cordon.zone.deck = [];
  campaign.world.hex = 18;
  Object.assign(campaign.player.stats, { survie: 20, discretion: 20 });
  campaign = step(campaign, { type: 'enter-place', place: 'ferme-cordon' }).state;
  assert.equal(campaign.screen, 'place');
  const events = [];
  // Jusqu'au premier refus : lieu vidé, ou combat contre l'occupant.
  for (let refused = false; !refused;) {
    const result = step(campaign, { type: 'explore' });
    refused = result.events.some((e) => e.type === 'refused');
    campaign = result.state;
    events.push(...result.events);
  }
  const allowed = new Set(['n1-commun', 'n1-cache'].flatMap((t) => loot[t].entries.map((e) => e.item)));
  const found = events.filter((e) => e.type === 'loot-found').flatMap((e) => e.items);
  assert.ok(found.length > 0);
  for (const { item } of found) assert.ok(allowed.has(item), item);
});
