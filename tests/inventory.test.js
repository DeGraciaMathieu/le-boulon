import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createCampaign, step } from '../src/engine/campaign.js';
import { SLOT_NAMES, INVENTORY_LINES, inventoryGrid, equipmentView, beltText } from '../src/ui/inventory.js';

const give = (campaign, kind, size = 1) => campaign.inventory.push({ kind, size });

test('grille : 12 cases, objets rangés à la suite', () => {
  const grid = inventoryGrid(createCampaign({ seed: 1 }));
  assert.equal(grid.cells, 12);
  assert.equal(grid.used, grid.items.reduce((total, item) => total + item.size, 0));
  grid.items.forEach((item, i) => {
    const previous = grid.items[i - 1];
    assert.equal(item.start, previous ? previous.start + previous.size : 0);
  });
});

test('grille : nom, charges et emplacement d’équipement', () => {
  const campaign = createCampaign({ seed: 1 });
  give(campaign, 'meduse');
  const { items } = inventoryGrid(campaign);
  assert.deepEqual(items.find((item) => item.kind === 'boulons'), { ...items.find((item) => item.kind === 'boulons'), name: 'Boulons', charges: 10, slot: null });
  assert.equal(items.find((item) => item.kind === 'meduse').slot, 'belt');
});

test('grille : 15 cases avec le savoir-faire Mule', () => {
  const campaign = createCampaign({ seed: 1 });
  campaign.player.perks = ['mule'];
  assert.equal(inventoryGrid(campaign).cells, 15);
});

test('équipement : pistolet et détecteur Écho au départ, ceinture d’un emplacement', () => {
  const view = equipmentView(createCampaign({ seed: 1 }));
  assert.deepEqual(view.slots.map((slot) => slot.id), ['primary', 'sidearm', 'armor', 'detector', 'backpack']);
  assert.equal(view.slots[1].label, SLOT_NAMES.sidearm);
  assert.deepEqual(view.slots[1].item, { kind: 'pistolet', name: 'Pistolet' });
  assert.equal(view.slots[0].item, null);
  assert.deepEqual(view.belt, { size: 1, items: [] });
});

test('équipement : suit les actions equip et unequip', () => {
  let campaign = createCampaign({ seed: 1 });
  give(campaign, 'gouttelette');
  campaign = step(campaign, { type: 'equip', item: 'gouttelette' }).state;
  assert.deepEqual(equipmentView(campaign).belt.items, [{ kind: 'gouttelette', name: 'Gouttelette', effect: 'absorbe 1, 1 rad/jour' }]);
  assert.ok(!inventoryGrid(campaign).items.some((item) => item.kind === 'gouttelette'));
  campaign = step(campaign, { type: 'unequip', slot: 'sidearm' }).state;
  assert.equal(equipmentView(campaign).slots[1].item, null);
  assert.ok(inventoryGrid(campaign).items.some((item) => item.kind === 'pistolet'));
});

test('ceinture : texte des effets d’un artefact', () => {
  assert.equal(beltText({ stats: { discretion: 1 }, cost: 1 }), 'Discrétion +1, 1 rad/jour');
  assert.equal(beltText({ ap: 1, cost: 1 }), '+1 PA, 1 rad/jour');
  assert.equal(beltText({ radiation: 2, cost: 0 }), 'protège 2 rad, 0 rad/jour');
});

test('lignes du journal : equip et unequip', () => {
  assert.equal(INVENTORY_LINES.equipped({ item: 'meduse', slot: 'belt' }), "Équipé : Méduse (Ceinture d'artefacts)");
  assert.equal(INVENTORY_LINES.unequipped({ item: 'pistolet', slot: 'sidearm' }), 'Retiré : Pistolet (Arme de poing)');
});
