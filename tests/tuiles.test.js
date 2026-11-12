// Données des 7 tuiles v2, des lieux et des liaisons (brief v2 §3, carte 5).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import content from '../src/content/index.js';
import { TERRAINS } from '../src/content/validate.js';
import { HEXES, isEdge } from '../src/engine/hex.js';
import { createCampaign } from '../src/engine/campaign.js';

const TILE_IDS = ['cordon', 'marais', 'decharge', 'agroprom', 'vallee-sombre', 'rostok', 'entrepots'];

// Brief v2 §5.3.
const LEVELS = { cordon: 1, marais: 2, decharge: 2, agroprom: 3, 'vallee-sombre': 3, rostok: 4, entrepots: 4 };

// Brief v2 §6.1.
const HUB_SERVICES = {
  'camp-novices': ['marchand', 'lit', 'coffre', 'contrats'],
  'base-ciel-pur': ['marchand', 'medecin', 'technicien', 'lit', 'contrats'],
  bar: ['marchand', 'barman', 'medecin', 'lit', 'coffre', 'contrats'],
  'base-liberte': ['marchand', 'barman', 'technicien', 'lit', 'contrats'],
};

// Bords de la tuile, rangées 3-4-5-4-3 de hex.js (les coins 8, 12, 14 et 18 comptent pour
// le nord ou le sud).
const SIDES = { nord: [18, 19, 8], sud: [14, 13, 12], ouest: [17, 16, 15], est: [9, 10, 11] };

// Brief v2 §3.2 : [tuile A, bord de A, tuile B, bord de B].
const LINKS = [
  ['cordon', 'nord', 'decharge', 'sud'],
  ['cordon', 'ouest', 'marais', 'est'],
  ['marais', 'nord', 'agroprom', 'sud'],
  ['agroprom', 'est', 'decharge', 'ouest'],
  ['decharge', 'est', 'vallee-sombre', 'ouest'],
  ['decharge', 'nord', 'rostok', 'sud'],
  ['rostok', 'nord', 'entrepots', 'sud'],
];

const { tiles, places, links } = content;

// Largeur et hauteur d'un PNG, lues dans son en-tête IHDR.
function imageSize(path) {
  const png = readFileSync(new URL(`../${path}`, import.meta.url));
  return { width: png.readUInt32BE(16), height: png.readUInt32BE(20) };
}

test('les 7 tuiles du §3.1 sont dans le contenu', () => {
  assert.deepEqual(Object.keys(tiles).sort(), [...TILE_IDS].sort());
});

test('chaque tuile décrit ses 19 hexagones avec un terrain valide', () => {
  for (const id of TILE_IDS) {
    const numbers = Object.keys(tiles[id].hexes).map(Number).sort((a, b) => a - b);
    assert.deepEqual(numbers, HEXES.map((h) => h.n), id);
    for (const [n, hex] of Object.entries(tiles[id].hexes)) {
      assert.ok(TERRAINS.includes(hex.terrain), `${id}.${n} : ${hex.terrain}`);
    }
  }
});

test('niveau de chaque tuile (§5.3) et entrée sur la tuile', () => {
  for (const id of TILE_IDS) {
    assert.equal(tiles[id].level, LEVELS[id], id);
    assert.ok(Object.hasOwn(tiles[id].hexes, tiles[id].entry), `${id}.entry`);
  }
});

test('le calage pose les 19 hexagones dans les limites de l’image', () => {
  for (const id of TILE_IDS) {
    const { image, calage } = tiles[id];
    const { width, height } = imageSize(image);
    const { cx, cy, taille } = calage;
    for (const { q, r } of HEXES) {
      const x = cx + Math.sqrt(3) * taille * (q + r / 2);
      const y = cy + 1.5 * taille * r;
      // Sommet pointu en haut et en bas, flancs à ±√3/2 taille.
      assert.ok(y - taille >= -1 && y + taille <= height + 1, `${id} : hexagone hors image en hauteur`);
      const half = (Math.sqrt(3) / 2) * taille;
      assert.ok(x - half >= -1 && x + half <= width + 1, `${id} : hexagone hors image en largeur`);
    }
    // La grille remplit l'image : 5 hexagones de large au centre.
    assert.ok(Math.abs(5 * Math.sqrt(3) * taille - width) <= 2, `${id} : taille ${taille} pour ${width} px`);
  }
});

test('chaque tuile a un paquet de rencontres au format de rules/tile.js', () => {
  for (const id of TILE_IDS) {
    const cards = Object.entries(tiles[id].encounterCards);
    assert.ok(cards.length >= 4, id);
    for (const [cardId, card] of cards) {
      assert.equal(typeof card.name, 'string', `${id}.${cardId}`);
      assert.ok(Number.isInteger(card.threat) && card.threat > 0, `${id}.${cardId}.threat`);
      assert.ok(Number.isInteger(card.wounds) && card.wounds > 0, `${id}.${cardId}.wounds`);
    }
  }
});

test('lieux et hexagones se répondent : étiquette, abri, irradié, repaire', () => {
  const placeAt = new Map(Object.entries(places).map(([id, p]) => [`${p.tile}.${p.hex}`, id]));
  for (const id of TILE_IDS) {
    for (const [n, hex] of Object.entries(tiles[id].hexes)) {
      const placeId = placeAt.get(`${id}.${n}`);
      assert.equal(Boolean(hex.lieu), Boolean(placeId), `${id}.${n} : lieu sans fiche ou fiche sans lieu`);
      if (!placeId) continue;
      const place = places[placeId];
      assert.equal(place.label, hex.lieu, placeId);
      assert.equal(place.tags.includes('abri'), Boolean(hex.abri), `${placeId} : abri`);
      assert.equal(place.tags.includes('irradie'), Boolean(hex.radiation), `${placeId} : irradié`);
      assert.equal(place.tags.includes('repaire'), Boolean(hex.repaire), `${placeId} : repaire`);
    }
  }
});

test('les 4 hubs du §6.1, avec leurs services, sur un abri', () => {
  const hubs = Object.entries(places).filter(([, p]) => p.tags.includes('hub'));
  assert.deepEqual(hubs.map(([id]) => id).sort(), Object.keys(HUB_SERVICES).sort());
  for (const [id, place] of hubs) {
    assert.deepEqual([...place.services].sort(), [...HUB_SERVICES[id]].sort(), id);
    assert.ok(place.tags.includes('abri'), id);
    assert.ok(place.faction, id);
  }
});

test('le Bar est à Rostok et la Base de Liberté aux Entrepôts (décision §19)', () => {
  assert.equal(places.bar.tile, 'rostok');
  assert.equal(places['base-liberte'].tile, 'entrepots');
});

test('les liaisons sont exactement celles du §3.2, sur le bon bord de chaque tuile', () => {
  const pairs = [];
  for (const [tile, exits] of Object.entries(links)) {
    for (const [hex, target] of Object.entries(exits)) {
      if (tile < target.tile) pairs.push([tile, Number(hex), target.tile, target.hex]);
    }
  }
  assert.equal(pairs.length, LINKS.length);
  for (const [a, sideA, b, sideB] of LINKS) {
    const [from] = Object.entries(links[a]).filter(([, t]) => t.tile === b);
    assert.ok(from, `pas de liaison ${a} -> ${b}`);
    const [hexA, { hex: hexB }] = [Number(from[0]), from[1]];
    assert.ok(SIDES[sideA].includes(hexA), `${a}.${hexA} n'est pas au ${sideA}`);
    assert.ok(SIDES[sideB].includes(hexB), `${b}.${hexB} n'est pas à l'${sideB}`);
    assert.ok(isEdge(hexA) && isEdge(hexB));
    assert.deepEqual(links[b][hexB], { tile: a, hex: hexA });
  }
});

test('la campagne commence au Cordon, sur le hub du Camp des novices', () => {
  const campaign = createCampaign({ seed: 1 });
  assert.equal(campaign.world.currentTile, 'cordon');
  assert.equal(campaign.world.hex, places['camp-novices'].hex);
  assert.equal(places['camp-novices'].tile, 'cordon');
});
