import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createGame, step as stepGame } from '../src/engine/game.js';
import { createCampaign, step, dayState } from '../src/engine/campaign.js';
import { neighbors, distance, HEXES } from '../src/engine/hex.js';
import { createItem, usedSlots, addItem, irradiate } from '../src/engine/rules/sheet.js';
import {
  emptyEquipment,
  inventorySlots,
  beltSlots,
  statBonus,
  radiationProtection,
  armorAbsorb,
  apBonus,
  beltRadiation,
} from '../src/engine/rules/equipment.js';

const jsonCopy = (value) => JSON.parse(JSON.stringify(value));
const kinds = (items) => items.map((item) => item.kind);
const equipAction = (item) => ({ type: 'equip', item });

// Campagne avec des objets en plus dans l'inventaire.
function campaignWith(...extra) {
  const campaign = createCampaign({ seed: 1 });
  campaign.inventory.push(...extra.map((kind) => createItem(kind)));
  return campaign;
}

function play(campaign, actions) {
  const events = [];
  for (const action of actions) {
    const result = step(campaign, action);
    assert.notEqual(result.events[0]?.type, 'refused', JSON.stringify(result.events[0]));
    campaign = result.state;
    events.push(...result.events);
  }
  return { campaign, events };
}

const refusal = (campaign, action) => step(campaign, action).events[0].reason;

function fakeTile() {
  const hexes = {};
  for (let n = 1; n <= 19; n++) hexes[n] = { terrain: 'herbe' };
  return { name: 'Test', entry: 8, hexes };
}

// Journée v1 sans jetons ni rencontres, avec un équipement de campagne.
function dayWith(equipment = emptyEquipment(), inventory = []) {
  const game = createGame({ seed: 1, tile: fakeTile() });
  return { ...game, tokens: [], encounters: [], equipment, inventory };
}

const worn = (kind) => createItem(kind);

test('départ : pistolet en arme de poing, détecteur Écho, ceinture vide', () => {
  const campaign = createCampaign({ seed: 1 });
  assert.equal(campaign.equipment.sidearm.kind, 'pistolet');
  assert.equal(campaign.equipment.detector.kind, 'echo');
  assert.deepEqual(campaign.equipment.belt, []);
  assert.ok(!kinds(campaign.inventory).includes('pistolet'));
  assert.deepEqual(dayState(campaign).equipment, campaign.equipment);
  assert.ok(!('equipment' in campaign.world.tiles.agroprom));
});

test('équiper range l\'objet à son emplacement et rend l\'ancien à l\'inventaire', () => {
  const campaign = campaignWith('pistolet-lourd', 'fusil-pompe');
  const { campaign: later, events } = play(campaign, [equipAction('pistolet-lourd'), equipAction('fusil-pompe')]);
  assert.equal(later.equipment.sidearm.kind, 'pistolet-lourd');
  assert.equal(later.equipment.primary.kind, 'fusil-pompe');
  assert.ok(kinds(later.inventory).includes('pistolet'));
  assert.ok(!kinds(later.inventory).includes('fusil-pompe'));
  assert.deepEqual(events.slice(0, 2), [
    { type: 'equipped', item: 'pistolet-lourd', slot: 'sidearm' },
    { type: 'unequipped', item: 'pistolet', slot: 'sidearm' },
  ]);
  assert.deepEqual(jsonCopy(later), later);
  assert.equal(campaign.equipment.sidearm.kind, 'pistolet', 'step reste pur');
});

test('déséquiper remet l\'objet dans l\'inventaire', () => {
  const { campaign, events } = play(createCampaign({ seed: 1 }), [{ type: 'unequip', slot: 'detector' }]);
  assert.equal(campaign.equipment.detector, null);
  assert.ok(kinds(campaign.inventory).includes('echo'));
  assert.deepEqual(events, [{ type: 'unequipped', item: 'echo', slot: 'detector' }]);
});

test('refus d\'équipement', () => {
  const campaign = campaignWith('meduse', 'gouttelette');
  assert.equal(refusal(campaign, equipAction('veles')), 'no-item');
  assert.equal(refusal(campaign, equipAction('bandage')), 'not-equippable');
  assert.equal(refusal(campaign, { type: 'unequip', slot: 'poche' }), 'unknown-slot');
  assert.equal(refusal(campaign, { type: 'unequip', slot: 'armor' }), 'empty-slot');
  assert.equal(refusal(campaign, { type: 'unequip', slot: 'belt' }), 'empty-slot');
  const { campaign: belted } = play(campaign, [equipAction('meduse')]);
  assert.equal(refusal(belted, equipAction('gouttelette')), 'belt-full');

  const fighting = structuredClone(campaign);
  fighting.world.tiles.agroprom.combat = { hex: 1, card: 'pillard' };
  assert.equal(refusal(fighting, equipAction('meduse')), 'in-combat');
});

test('ceinture : 1 emplacement sans armure, celui de l\'armure sinon ; le surplus revient à l\'inventaire', () => {
  assert.equal(beltSlots(emptyEquipment()), 1);
  const campaign = campaignWith('exosquelette', 'meduse', 'gouttelette', 'epine');
  const { campaign: later } = play(campaign, [
    equipAction('exosquelette'), equipAction('meduse'), equipAction('gouttelette'), equipAction('epine'),
  ]);
  assert.deepEqual(kinds(later.equipment.belt), ['meduse', 'gouttelette', 'epine']);

  const { campaign: bare, events } = play(later, [{ type: 'unequip', slot: 'armor' }]);
  assert.deepEqual(kinds(bare.equipment.belt), ['meduse']);
  assert.ok(['exosquelette', 'gouttelette', 'epine'].every((kind) => kinds(bare.inventory).includes(kind)));
  assert.equal(events.filter((e) => e.type === 'unequipped').length, 3);

  const { campaign: unbelted } = play(later, [{ type: 'unequip', slot: 'belt', item: 'gouttelette' }]);
  assert.deepEqual(kinds(unbelted.equipment.belt), ['meduse', 'epine']);
});

test('grille : 12 cases, 15 avec un sac ou Mule, sans cumul', () => {
  const backpack = { ...emptyEquipment(), backpack: worn('sac') };
  assert.equal(inventorySlots({ equipment: emptyEquipment() }), 12);
  assert.equal(inventorySlots({ equipment: undefined }), 12);
  assert.equal(inventorySlots({ equipment: backpack }), 15);
  assert.equal(inventorySlots({ equipment: emptyEquipment(), perks: ['mule'] }), 15);
  assert.equal(inventorySlots({ equipment: backpack, perks: ['mule'] }), 15);

  const draft = { equipment: backpack, player: {}, inventory: [] };
  while (addItem(draft, createItem('bandage')));
  assert.equal(usedSlots(draft.inventory), 15);
});

test('pas de surcharge : déséquiper le sac ou un objet est refusé si la grille déborde', () => {
  const campaign = campaignWith('sac');
  const { campaign: packed } = play(campaign, [equipAction('sac')]);
  while (usedSlots(packed.inventory) < 15) packed.inventory.push(createItem('bandage'));
  assert.equal(refusal(packed, { type: 'unequip', slot: 'backpack' }), 'inventory-full');
  assert.equal(refusal(packed, { type: 'unequip', slot: 'sidearm' }), 'inventory-full');
});

test('combat v1 : arme équipée chargée au plus fort bonus, munitions dédiées', () => {
  const equipment = { ...emptyEquipment(), primary: worn('fusil-assaut'), sidearm: worn('pistolet') };
  const hex = neighbors(8)[0];
  const fightWith = (inventory) => {
    const day = { ...dayWith(equipment, inventory), combat: { hex, card: 'mercenaires' } };
    day.encounters = [{ hex, card: 'mercenaires' }];
    return stepGame(day, { type: 'fight' });
  };

  const rifle = fightWith([createItem('munitions-545'), createItem('munitions')]);
  assert.equal(rifle.events[0].weapon, 3);
  const pistol = fightWith([createItem('munitions')]);
  assert.equal(pistol.events[0].weapon, 1);
  assert.equal(fightWith([]).events[0].weapon, -1);
});

test('combat v1 : la défaite dépense la munition de l\'arme utilisée', () => {
  const equipment = { ...emptyEquipment(), primary: worn('fusil-pompe') };
  const hex = neighbors(8)[0];
  for (let seed = 0; seed < 20; seed++) {
    const day = { ...dayWith(equipment, [createItem('cartouches-12'), createItem('munitions')]), rng: seed };
    day.combat = { hex, card: 'mercenaires' };
    day.encounters = [{ hex, card: 'mercenaires' }];
    const { state, events } = stepGame(day, { type: 'fight' });
    if (events[0].won) continue;
    assert.equal(state.inventory.find((item) => item.kind === 'cartouches-12').charges, 5);
    assert.equal(state.inventory.find((item) => item.kind === 'munitions').charges, 6);
    return;
  }
  assert.fail('aucune défaite sur 20 graines');
});

// Un hexagone voisin de l'entrée et un jeton posé à `range` de lui.
function scanFrom(equipment, kind, range) {
  const to = neighbors(8)[0];
  const hex = HEXES.map(({ n }) => n).find((n) => distance(to, n) === range && n !== 8);
  const day = dayWith(equipment);
  day.tokens = [{ hex, kind, revealed: false, original: true, ...(kind === 'anomalie' && { anomaly: 'electro' }) }];
  const { events } = stepGame(day, { type: 'move', to });
  return events.find((e) => e.type === 'token-revealed' && e.by === 'detector');
}

test('détecteur : portée Écho 1, Ours 2, Vélès 3, rien sans détecteur', () => {
  const wearing = (kind) => ({ ...emptyEquipment(), detector: worn(kind) });
  assert.ok(scanFrom(wearing('echo'), 'artefact', 1));
  assert.equal(scanFrom(wearing('echo'), 'artefact', 2), undefined);
  assert.ok(scanFrom(wearing('ours'), 'artefact', 2));
  assert.equal(scanFrom(wearing('ours'), 'artefact', 3), undefined);
  assert.ok(scanFrom(wearing('veles'), 'artefact', 3));
  assert.equal(scanFrom(emptyEquipment(), 'artefact', 1), undefined);
});

test('détecteur : seul le Vélès révèle les anomalies, avec leur type', () => {
  const wearing = (kind) => ({ ...emptyEquipment(), detector: worn(kind) });
  assert.equal(scanFrom(wearing('ours'), 'anomalie', 1), undefined);
  const sensed = scanFrom(wearing('veles'), 'anomalie', 3);
  assert.equal(sensed.kind, 'anomalie');
  assert.equal(sensed.anomaly, 'electro');
});

test('ceinture : bonus de stat aux tests et au Tir du combat', () => {
  const equipment = { ...emptyEquipment(), belt: [worn('compas'), worn('epine')] };
  assert.equal(statBonus(equipment, 'tir'), 2);
  assert.equal(statBonus(equipment, 'survie'), 1);
  assert.equal(statBonus(undefined, 'tir'), 0);

  const hex = neighbors(8)[0];
  const day = { ...dayWith(equipment), combat: { hex, card: 'pillard' } };
  day.encounters = [{ hex, card: 'pillard' }];
  assert.equal(stepGame(day, { type: 'fight' }).events[0].tir, day.player.stats.tir + 2);

  const token = neighbors(8)[0];
  const trap = dayWith(equipment);
  trap.tokens = [{ hex: token, kind: 'anomalie', anomaly: 'electro', revealed: false, original: true }];
  const check = stepGame(trap, { type: 'move', to: token }).events.find((e) => e.type === 'check');
  assert.equal(check.bonus, trap.player.stats.survie + 1);
});

test('radiations : l\'armure et la ceinture retiennent une partie de chaque gain', () => {
  const equipment = { ...emptyEquipment(), armor: worn('combinaison-stalker'), belt: [worn('bulle')] };
  assert.equal(radiationProtection(equipment), 4);
  const draft = { equipment, player: { radiation: 0, wounds: 0 } };
  const events = [];
  irradiate(draft, 5, 'zone', (e) => events.push(e));
  assert.equal(draft.player.radiation, 1);
  assert.deepEqual(events, [{ type: 'irradiated', amount: 1, cause: 'zone', blocked: 4 }]);
});

test('hooks : absorption, PA et coût en radiation de la ceinture', () => {
  const equipment = {
    ...emptyEquipment(),
    armor: worn('exosquelette'),
    belt: [worn('gouttelette'), worn('flamme'), worn('compas')],
  };
  assert.equal(armorAbsorb(equipment), 4);
  assert.equal(apBonus(equipment), 2);
  assert.equal(beltRadiation(equipment), 5);
  assert.equal(armorAbsorb(undefined), 0);
});

test('boisson énergétique : +2 PA sans coût, une fois par jour', () => {
  const day = dayWith(emptyEquipment(), [createItem('boisson-energetique'), createItem('boisson-energetique')]);
  const { state, events } = stepGame(day, { type: 'use', item: 'boisson-energetique' });
  assert.equal(state.ap.left, day.ap.left + 2);
  assert.deepEqual(events[0], { type: 'used', item: 'boisson-energetique', ap: 2 });
  const again = stepGame(state, { type: 'use', item: 'boisson-energetique' });
  assert.equal(again.events[0].reason, 'once-per-day');
});

test('nouveaux consommables : trousse militaire et antirad', () => {
  const day = dayWith(emptyEquipment(), [createItem('trousse-militaire'), createItem('antirad')]);
  day.player.wounds = 4;
  day.player.radiation = 5;
  const healed = stepGame(day, { type: 'use', item: 'trousse-militaire' }).state;
  assert.equal(healed.player.wounds, 1);
  assert.equal(stepGame(healed, { type: 'use', item: 'antirad' }).state.player.radiation, 1);
});
