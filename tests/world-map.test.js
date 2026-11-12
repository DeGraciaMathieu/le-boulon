import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createCampaign, step } from '../src/engine/campaign.js';
import { startQuest } from '../src/engine/rules/quests.js';
import { createRng } from '../src/engine/rng.js';
import content from '../src/content/index.js';
import { WORLD_LAYOUT, worldMap, linkExits, tileQuestMarkers, topBar } from '../src/ui/world-map.js';

const fakeCtx = () => ({ rng: createRng(1), emit: () => {} });

// Campagne posée sur l'hexagone de liaison du Cordon vers la Décharge, puis voyage.
function travelToDecharge() {
  const campaign = createCampaign({ seed: 3 });
  campaign.world.hex = 19;
  return step(campaign, { type: 'travel' }).state;
}

test('disposition : les 7 tuiles du §3.2, une case chacune', () => {
  assert.deepEqual(Object.keys(WORLD_LAYOUT).sort(), Object.keys(content.tiles).sort());
  const cells = Object.values(WORLD_LAYOUT).map(({ col, row }) => `${col},${row}`);
  assert.equal(new Set(cells).size, cells.length);
});

test('disposition : chaque liaison relie deux cases voisines', () => {
  for (const [a, b] of worldMap(createCampaign({ seed: 1 })).links) {
    const dc = Math.abs(WORLD_LAYOUT[a].col - WORLD_LAYOUT[b].col);
    const dr = Math.abs(WORLD_LAYOUT[a].row - WORLD_LAYOUT[b].row);
    assert.equal(dc + dr, 1, `${a} ↔ ${b}`);
  }
});

test('carte du monde : 7 liaisons, chacune une seule fois', () => {
  const { links } = worldMap(createCampaign({ seed: 1 }));
  assert.equal(links.length, 7);
  assert.ok(links.some(([a, b]) => [a, b].sort().join() === 'cordon,decharge'));
});

test('carte du monde : au départ, seul le Cordon est connu et courant', () => {
  const { tiles } = worldMap(createCampaign({ seed: 1 }));
  assert.equal(tiles.length, 7);
  const cordon = tiles.find((tile) => tile.id === 'cordon');
  assert.deepEqual([cordon.known, cordon.current, cordon.name], [true, true, 'Cordon']);
  assert.ok(tiles.filter((tile) => tile.id !== 'cordon').every((tile) => !tile.known && !tile.current));
});

test('carte du monde : après un voyage, la Décharge est courante et le Cordon reste connu', () => {
  const { tiles } = worldMap(travelToDecharge());
  const byId = Object.fromEntries(tiles.map((tile) => [tile.id, tile]));
  assert.deepEqual([byId.decharge.known, byId.decharge.current], [true, true]);
  assert.deepEqual([byId.cordon.known, byId.cordon.current], [true, false]);
});

test('carte du monde : un marqueur par quête active qui a une cible', () => {
  const campaign = createCampaign({ seed: 1 });
  assert.deepEqual(worldMap(campaign).markers, []);
  startQuest(campaign, 'chiens-cordon', fakeCtx());
  const { markers } = worldMap(campaign);
  assert.equal(markers.length, 1);
  assert.equal(markers[0].quest, 'chiens-cordon');
  assert.equal(markers[0].tile, 'cordon');
});

test('carte du monde : une quête finie ne marque plus rien', () => {
  const campaign = createCampaign({ seed: 1 });
  startQuest(campaign, 'chiens-cordon', fakeCtx());
  campaign.quests['chiens-cordon'].status = 'done';
  assert.deepEqual(worldMap(campaign).markers, []);
});

test('sorties : les hexagones de liaison de la tuile et leur destination', () => {
  assert.deepEqual(linkExits('cordon').sort((a, b) => a.hex - b.hex), [
    { hex: 15, tile: 'marais', name: 'Marais' },
    { hex: 19, tile: 'decharge', name: 'Décharge' },
  ]);
  assert.equal(linkExits('decharge').length, 4);
});

test('marqueurs de tuile : seulement les cibles de la tuile courante qui ont un hexagone', () => {
  const campaign = createCampaign({ seed: 1 });
  // Cible sans hexagone (la tuile du Cordon seulement) : rien sur la tuile.
  startQuest(campaign, 'chiens-cordon', fakeCtx());
  assert.deepEqual(tileQuestMarkers(campaign), []);
  // Cible : Bohdan, au Camp des novices (hexagone 5).
  startQuest(campaign, 'dette-bohdan', fakeCtx());
  assert.deepEqual(tileQuestMarkers(campaign), [{ hex: 5, quest: 'dette-bohdan', name: 'La dette de Bohdan' }]);
  const away = travelToDecharge();
  startQuest(away, 'dette-bohdan', fakeCtx());
  assert.deepEqual(tileQuestMarkers(away), []);
});

test('bandeau : jour, PA, pistes, faim, roubles, pas d\'Émission annoncée au départ', () => {
  const campaign = createCampaign({ seed: 1 });
  const bar = topBar(campaign);
  assert.equal(bar.day, 1);
  assert.equal(bar.ap, campaign.world.tiles.cordon.ap.left);
  assert.equal(bar.apMax, campaign.world.tiles.cordon.ap.max);
  assert.deepEqual([bar.wounds, bar.radiation, bar.hunger, bar.roubles], [0, 0, 0, 0]);
  assert.equal(bar.emission, false);
  assert.equal(bar.tile, 'Cordon');
});

test('bandeau : Émission annoncée pour un jour à venir ou en cours, pas pour un jour passé', () => {
  const campaign = createCampaign({ seed: 1 });
  campaign.world.emission = { nextDay: 3, today: false };
  assert.equal(topBar(campaign).emission, true);
  campaign.world.emission = { nextDay: null, today: true };
  assert.equal(topBar(campaign).emission, true);
  campaign.day = 4;
  campaign.world.emission = { nextDay: 3, today: false };
  assert.equal(topBar(campaign).emission, false);
});

test('les lectures ne modifient pas la campagne', () => {
  const campaign = createCampaign({ seed: 1 });
  startQuest(campaign, 'chiens-cordon', fakeCtx());
  const before = JSON.stringify(campaign);
  worldMap(campaign);
  tileQuestMarkers(campaign);
  topBar(campaign);
  assert.equal(JSON.stringify(campaign), before);
});
