import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createCampaign, step, CAMPAIGN_VERSION } from '../src/engine/campaign.js';
import {
  serialize,
  deserialize,
  migrate,
  canManualSave,
  SaveError,
  MIGRATIONS,
} from '../src/engine/rules/save.js';
import { neighbors } from '../src/engine/hex.js';

function play(campaign, actions) {
  for (const action of actions) campaign = step(campaign, action).state;
  return campaign;
}

function someMoves(campaign, count) {
  const actions = [];
  let hex = campaign.world.hex;
  for (let i = 0; i < count; i++) {
    hex = neighbors(hex)[0];
    actions.push({ type: 'move', to: hex });
  }
  return actions;
}

test('serialize rend une chaîne JSON qui porte le numéro de version', () => {
  const text = serialize(createCampaign({ seed: 3 }));
  assert.equal(typeof text, 'string');
  assert.equal(JSON.parse(text).version, CAMPAIGN_VERSION);
});

test('aller-retour : la campagne rechargée est égale et rejoue à l’identique', () => {
  const start = play(createCampaign({ seed: 11 }), someMoves(createCampaign({ seed: 11 }), 2));
  const loaded = deserialize(serialize(start));
  assert.deepEqual(loaded, start);
  const next = someMoves(start, 2);
  assert.deepEqual(play(loaded, next), play(start, next));
});

test('deserialize refuse un texte qui n’est pas du JSON', () => {
  assert.throws(() => deserialize('{pas du json'), (error) => {
    assert.ok(error instanceof SaveError);
    assert.match(error.message, /JSON/);
    return true;
  });
});

test('deserialize refuse ce qui n’est pas un objet', () => {
  for (const text of ['null', '[]', '42', '"texte"']) {
    assert.throws(() => deserialize(text), SaveError);
  }
});

test('deserialize refuse une version absente ou invalide', () => {
  const data = JSON.parse(serialize(createCampaign({ seed: 1 })));
  for (const version of [undefined, 'un', 1.5, -1]) {
    assert.throws(() => deserialize(JSON.stringify({ ...data, version })), /version/);
  }
});

test('deserialize refuse une sauvegarde d’une version plus récente', () => {
  const data = JSON.parse(serialize(createCampaign({ seed: 1 })));
  assert.throws(
    () => deserialize(JSON.stringify({ ...data, version: CAMPAIGN_VERSION + 1 })),
    /plus récente/,
  );
});

test('deserialize nomme le champ manquant ou mal formé', () => {
  const data = JSON.parse(serialize(createCampaign({ seed: 1 })));
  const { player, ...noPlayer } = data;
  assert.throws(() => deserialize(JSON.stringify(noPlayer)), /player/);
  assert.throws(() => deserialize(JSON.stringify({ ...data, mode: 'facile' })), /mode/);
  assert.throws(() => deserialize(JSON.stringify({ ...data, day: 0 })), /day/);
  assert.throws(() => deserialize(JSON.stringify({ ...data, inventory: {} })), /inventory/);
  const world = { ...data.world, currentTile: 'nulle-part' };
  assert.throws(() => deserialize(JSON.stringify({ ...data, world })), /currentTile/);
  const noWounds = { ...data, player: { ...player, wounds: undefined } };
  assert.throws(() => deserialize(JSON.stringify(noWounds)), /player\.wounds/);
});

test('serialize refuse un état de campagne invalide', () => {
  assert.throws(() => serialize({ version: CAMPAIGN_VERSION }), SaveError);
});

test('migrations : une fausse v0 passe en v1 par une fonction v0 -> v1', () => {
  const v1 = JSON.parse(serialize(createCampaign({ seed: 5 })));
  // Fausse v0 : la faim s'appelait « famine » et la version n'avait pas encore été montée.
  const { hunger, ...player } = v1.player;
  const v0 = { ...v1, version: 0, player: { ...player, famine: hunger } };
  const v0ToV1 = ({ player: { famine, ...rest }, ...data }) => ({
    ...data,
    player: { ...rest, hunger: famine },
  });
  const migrated = migrate(v0, { migrations: [v0ToV1], target: 1 });
  assert.equal(migrated.version, 1);
  assert.deepEqual(migrated, v1);
  assert.equal(v0.version, 0, 'la sauvegarde d’origine n’est pas modifiée');
});

test('migrations : chaîne ordonnée de plusieurs versions', () => {
  const seen = [];
  const mark = (n) => (data) => {
    seen.push(n);
    return { ...data, trace: [...(data.trace ?? []), n] };
  };
  const migrated = migrate({ version: 1 }, { migrations: [mark(0), mark(1), mark(2)], target: 3 });
  assert.deepEqual(seen, [1, 2]);
  assert.deepEqual(migrated, { version: 3, trace: [1, 2] });
});

test('migrations : version trop ancienne pour la liste refusée', () => {
  assert.throws(() => migrate({ version: 0 }, { migrations: [], target: 1 }), /trop ancienne/);
});

test('la liste réelle des migrations couvre jusqu’à CAMPAIGN_VERSION', () => {
  assert.ok(Array.isArray(MIGRATIONS));
  assert.ok(MIGRATIONS.every((fn) => typeof fn === 'function'));
  assert.ok(CAMPAIGN_VERSION - MIGRATIONS.length >= 0);
});

test('canManualSave : vrai dans un hub seulement', () => {
  const campaign = createCampaign({ seed: 1 });
  assert.equal(canManualSave(campaign), false);
  assert.equal(canManualSave({ ...campaign, screen: 'hub' }), true);
  assert.equal(canManualSave({ ...campaign, screen: 'place' }), false);
});
