import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createCampaign } from '../src/engine/campaign.js';
import { createSaveStore, MANUAL_SLOTS } from '../src/ui/storage.js';

// localStorage factice : seul ce que storage.js utilise.
function fakeStorage() {
  const items = new Map();
  return {
    items,
    getItem: (key) => (items.has(key) ? items.get(key) : null),
    setItem: (key, value) => items.set(key, String(value)),
    removeItem: (key) => items.delete(key),
  };
}

const brokenStorage = {
  getItem() { throw new Error('accès refusé'); },
  setItem() { throw new Error('quota dépassé'); },
  removeItem() { throw new Error('accès refusé'); },
};

const at = (iso) => () => new Date(iso);
const inHub = (campaign) => ({ ...campaign, screen: 'hub' });

test('3 emplacements manuels', () => {
  assert.deepEqual(MANUAL_SLOTS, [1, 2, 3]);
});

test('autosave puis load rend la même campagne', () => {
  const store = createSaveStore({ storage: fakeStorage() });
  const campaign = createCampaign({ seed: 4 });
  assert.equal(store.autosave(campaign).ok, true);
  assert.deepEqual(store.load('auto').campaign, campaign);
});

test('un emplacement manuel est refusé hors d’un hub', () => {
  const storage = fakeStorage();
  const store = createSaveStore({ storage });
  const result = store.saveSlot(1, createCampaign({ seed: 4 }));
  assert.equal(result.ok, false);
  assert.match(result.error, /hub/);
  assert.equal(storage.items.size, 0);
});

test('emplacement manuel dans un hub, numéro hors 1-3 refusé', () => {
  const store = createSaveStore({ storage: fakeStorage() });
  const campaign = inHub(createCampaign({ seed: 4 }));
  assert.equal(store.saveSlot(2, campaign).ok, true);
  assert.deepEqual(store.load(2).campaign, campaign);
  assert.equal(store.saveSlot(4, campaign).ok, false);
});

test('liste : emplacements occupés avec jour et date, autosave en tête', () => {
  const storage = fakeStorage();
  const campaign = createCampaign({ seed: 9, mode: 'hardcore' });
  createSaveStore({ storage, now: at('2026-11-12T08:00:00.000Z') }).saveSlot(3, inHub({ ...campaign, day: 5 }));
  createSaveStore({ storage, now: at('2026-11-12T09:30:00.000Z') }).autosave({ ...campaign, day: 6 });
  const list = createSaveStore({ storage }).list();
  assert.deepEqual(list, [
    { slot: 'auto', day: 6, savedAt: '2026-11-12T09:30:00.000Z', mode: 'hardcore', seed: 9 },
    { slot: 3, day: 5, savedAt: '2026-11-12T08:00:00.000Z', mode: 'hardcore', seed: 9 },
  ]);
});

test('une sauvegarde corrompue est signalée sans planter', () => {
  const storage = fakeStorage();
  storage.setItem('le-boulon.save.auto', '{cassé');
  const store = createSaveStore({ storage });
  assert.ok(store.load('auto').error);
  const [entry, ...rest] = store.list();
  assert.equal(entry.slot, 'auto');
  assert.ok(entry.error);
  assert.deepEqual(rest, []);
});

test('emplacement vide : load rend une erreur claire', () => {
  const result = createSaveStore({ storage: fakeStorage() }).load(1);
  assert.equal(result.campaign, undefined);
  assert.match(result.error, /vide/);
});

test('localStorage qui lève ou absent : aucune exception ne sort', () => {
  const campaign = createCampaign({ seed: 1 });
  for (const storage of [brokenStorage, undefined]) {
    const store = createSaveStore({ storage });
    assert.equal(store.autosave(campaign).ok, false);
    assert.ok(store.load('auto').error);
    assert.deepEqual(store.list(), []);
    assert.equal(store.eraseCampaign(campaign).ok, false);
  }
});

test('hardcore : eraseCampaign efface l’autosave et les emplacements de cette campagne seulement', () => {
  const storage = fakeStorage();
  const store = createSaveStore({ storage });
  const doomed = createCampaign({ seed: 7, mode: 'hardcore' });
  const other = createCampaign({ seed: 8 });
  store.autosave(doomed);
  store.saveSlot(1, inHub(doomed));
  store.saveSlot(2, inHub(other));
  assert.equal(store.eraseCampaign(doomed).ok, true);
  assert.deepEqual(store.list().map((entry) => entry.slot), [2]);
});

test('exportFile télécharge la campagne en JSON', () => {
  const clicks = [];
  const anchor = { click() { clicks.push({ href: this.href, download: this.download }); } };
  const doc = { createElement: (tag) => (assert.equal(tag, 'a'), anchor) };
  const urls = { createObjectURL: (blob) => (urls.blob = blob, 'blob:x'), revokeObjectURL: (url) => (urls.revoked = url) };
  const store = createSaveStore({ storage: fakeStorage(), document: doc, URL: urls });
  const campaign = { ...createCampaign({ seed: 2 }), day: 12 };
  assert.equal(store.exportFile(campaign).ok, true);
  assert.deepEqual(clicks, [{ href: 'blob:x', download: 'le-boulon-jour-12.json' }]);
  assert.equal(urls.blob.type, 'application/json');
  assert.equal(urls.revoked, 'blob:x');
});

test('importFile relit un fichier exporté, refuse un fichier invalide', async () => {
  const store = createSaveStore({ storage: fakeStorage() });
  const campaign = createCampaign({ seed: 2 });
  let blob;
  const urls = { createObjectURL: (b) => (blob = b, 'blob:x'), revokeObjectURL() {} };
  const doc = { createElement: () => ({ click() {} }) };
  createSaveStore({ storage: fakeStorage(), document: doc, URL: urls }).exportFile(campaign);
  assert.deepEqual((await store.importFile(blob)).campaign, campaign);
  const bad = await store.importFile(new Blob(['{"version":1}']));
  assert.ok(bad.error);
});
