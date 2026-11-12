import { test } from 'node:test';
import assert from 'node:assert/strict';
import catalog from '../src/content/objets.js';
import content from '../src/content/index.js';
import { ITEMS } from '../src/engine/rules/sheet.js';
import { SLOTS } from '../src/engine/rules/equipment.js';

const ofCategory = (category) => Object.values(catalog).filter((item) => item.category === category);

// Champ de données attendu pour chaque emplacement.
const SLOT_DATA = {
  primary: 'weapon',
  sidearm: 'weapon',
  armor: 'armor',
  detector: 'detector',
  belt: 'belt',
  backpack: 'backpack',
};

function isDeepFrozen(value) {
  if (!Object.isFrozen(value)) return false;
  return Object.values(value).every((child) => !child || typeof child !== 'object' || isDeepFrozen(child));
}

test('le catalogue est gelé en profondeur et rangé dans le contenu', () => {
  assert.ok(isDeepFrozen(catalog));
  assert.equal(content.items, catalog);
  assert.equal(ITEMS, catalog);
});

test('toutes les catégories du §12 sont présentes', () => {
  for (const category of [
    'arme-poing', 'arme-epaule', 'munitions', 'armure', 'detecteur', 'soin', 'antirad',
    'nourriture', 'divers', 'artefact', 'quete',
  ]) {
    assert.ok(ofCategory(category).length > 0, `catégorie ${category} vide`);
  }
  assert.ok(ofCategory('artefact').filter((item) => item.belt).length >= 15, 'une quinzaine d\'artefacts');
});

test('chaque objet a un nom, une taille et un prix ; les objets de quête ne se vendent pas', () => {
  for (const [id, item] of Object.entries(catalog)) {
    assert.equal(typeof item.name, 'string', id);
    assert.ok(Number.isInteger(item.size) && item.size > 0, id);
    if (item.category === 'quete') assert.equal(item.price, null, id);
    else assert.ok(item.price > 0, id);
  }
});

test('un objet équipable a son emplacement et les données qui vont avec', () => {
  for (const [id, item] of Object.entries(catalog)) {
    if (!item.slot) continue;
    assert.ok(SLOTS.includes(item.slot), id);
    assert.ok(item[SLOT_DATA[item.slot]], `${id} sans ${SLOT_DATA[item.slot]}`);
  }
});

test('armes : bonus du §12 et munitions dédiées existantes', () => {
  assert.equal(catalog.pistolet.weapon.bonus, 1);
  assert.equal(catalog['pistolet-lourd'].weapon.bonus, 2);
  for (const item of ofCategory('arme-epaule')) {
    assert.ok(item.weapon.bonus >= 2 && item.weapon.bonus <= 4);
    assert.equal(item.weapon.damage, 2);
    assert.ok(item.price >= 1200 && item.price <= 5000);
  }
  for (const item of [...ofCategory('arme-poing'), ...ofCategory('arme-epaule')]) {
    assert.equal(catalog[item.ammo].category, 'munitions');
  }
  for (const item of ofCategory('munitions')) assert.equal(item.charges, 6);
});

test('armures, détecteurs, sac : ordres de grandeur du §12 et du §11.3', () => {
  for (const item of ofCategory('armure')) {
    assert.ok(item.armor.absorb >= 1 && item.armor.absorb <= 3);
    assert.ok(item.armor.beltSlots >= 1 && item.armor.beltSlots <= 3);
    assert.ok(item.price >= 500 && item.price <= 15000);
  }
  assert.deepEqual(
    ['echo', 'ours', 'veles'].map((id) => [catalog[id].detector.range, catalog[id].price]),
    [[1, 300], [2, 1500], [3, 5000]],
  );
  assert.ok(catalog.veles.detector.anomalyType);
  assert.ok(!catalog.ours.detector.anomalyType);
  assert.equal(catalog.sac.backpack.slots, 3);
});

test('consommables : soins, antiradiations, nourriture, divers', () => {
  assert.deepEqual(
    ['bandage', 'trousse-soins', 'trousse-militaire'].map((id) => [catalog[id].use.wounds, catalog[id].price]),
    [[-1, 50], [-2, 200], [-3, 600]],
  );
  assert.deepEqual(['vodka', 'antirad'].map((id) => catalog[id].use.radiation), [-2, -4]);
  for (const item of ofCategory('nourriture')) {
    assert.ok(item.use.meal);
    assert.ok(item.price >= 30 && item.price <= 80);
  }
  assert.equal(catalog.boulons.charges, 10);
  assert.deepEqual(catalog['boisson-energetique'].use, { ap: 2, oncePerDay: true, cost: 0 });
});

test('artefacts : un bonus en ceinture contre un coût en radiation, 400 à 6000', () => {
  for (const item of ofCategory('artefact').filter((artefact) => artefact.belt)) {
    const { stats, absorb, ap, radiation, cost } = item.belt;
    assert.ok(stats || absorb || ap || radiation, `${item.name} sans bonus`);
    assert.ok(Number.isInteger(cost) && cost >= 0);
    assert.ok(item.price >= 400 && item.price <= 6000);
  }
});
