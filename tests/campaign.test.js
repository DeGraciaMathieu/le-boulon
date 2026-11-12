import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  createCampaign,
  step,
  dayState,
  CAMPAIGN_VERSION,
  CAMPAIGN_ACTIONS,
  REACTIONS,
} from '../src/engine/campaign.js';
import { neighbors } from '../src/engine/hex.js';
import content from '../src/content/index.js';

const jsonCopy = (value) => JSON.parse(JSON.stringify(value));

// Joue une suite d'actions et rend la campagne finale et tous les événements.
function play(campaign, actions) {
  const events = [];
  for (const action of actions) {
    const result = step(campaign, action);
    campaign = result.state;
    events.push(...result.events);
  }
  return { campaign, events };
}

// Quelques déplacements acceptés depuis l'entrée, choisis sans hasard.
function someMoves(campaign, count) {
  const actions = [];
  let hex = campaign.world.hex;
  for (let i = 0; i < count; i++) {
    hex = neighbors(hex)[0];
    actions.push({ type: 'move', to: hex });
  }
  return actions;
}

test('createCampaign pose tous les champs de 17.1', () => {
  const campaign = createCampaign({ seed: 7 });
  for (const key of [
    'version', 'seed', 'rng', 'day', 'mode', 'player', 'inventory', 'equipment', 'world',
    'places', 'npcs', 'quests', 'contracts', 'traders', 'reputation', 'rumors', 'stashes',
    'journal', 'screen',
  ]) {
    assert.ok(key in campaign, `champ ${key} manquant`);
  }
  for (const key of ['stats', 'rank', 'xp', 'perks', 'wounds', 'radiation', 'hunger', 'roubles', 'faction']) {
    assert.ok(key in campaign.player, `champ player.${key} manquant`);
  }
  for (const key of ['tiles', 'currentTile', 'hex', 'weather', 'emission']) {
    assert.ok(key in campaign.world, `champ world.${key} manquant`);
  }
  assert.deepEqual(Object.keys(campaign.world.emission).sort(), ['nextDay', 'today']);
});

test('jour 1, version, mode normal par défaut, écran tuile', () => {
  const campaign = createCampaign({ seed: 1 });
  assert.equal(campaign.version, CAMPAIGN_VERSION);
  assert.equal(campaign.day, 1);
  assert.equal(campaign.mode, 'normal');
  assert.equal(campaign.screen, 'tile');
  assert.equal(createCampaign({ seed: 1, mode: 'hardcore' }).mode, 'hardcore');
  assert.throws(() => createCampaign({ seed: 1, mode: 'facile' }));
});

test('la tuile courante porte une journée v1 et le joueur est sur son entrée', () => {
  const campaign = createCampaign({ seed: 3 });
  const id = campaign.world.currentTile;
  assert.ok(content.tiles[id], `tuile ${id} absente du contenu`);
  assert.equal(campaign.world.hex, content.tiles[id].entry);
  const day = dayState(campaign);
  assert.equal(day.status, 'playing');
  assert.equal(day.player.hex, campaign.world.hex);
  assert.deepEqual(day.inventory, campaign.inventory);
  assert.equal(day.rng, campaign.rng);
});

test('une seule source de vérité : la tuile stockée ne double pas les champs de campagne', () => {
  const tile = createCampaign({ seed: 3 }).world.tiles.agroprom;
  for (const key of ['seed', 'rng', 'inventory']) assert.ok(!(key in tile), `tile.${key} en double`);
  for (const key of ['hex', 'wounds', 'radiation', 'stats']) {
    assert.ok(!(key in tile.player), `tile.player.${key} en double`);
  }
});

test('même graine, même campagne ; autre graine, autre campagne', () => {
  assert.deepEqual(createCampaign({ seed: 42 }), createCampaign({ seed: 42 }));
  assert.notDeepEqual(createCampaign({ seed: 42 }).world, createCampaign({ seed: 43 }).world);
});

test('la campagne est sérialisable en JSON, avant et après des actions', () => {
  const campaign = createCampaign({ seed: 5 });
  assert.deepEqual(jsonCopy(campaign), campaign);
  const { campaign: later } = play(campaign, someMoves(campaign, 3));
  assert.deepEqual(jsonCopy(later), later);
});

test('une copie JSON rejoue la même suite', () => {
  const campaign = createCampaign({ seed: 11 });
  const actions = someMoves(campaign, 4);
  const direct = play(campaign, actions);
  const reloaded = play(jsonCopy(campaign), actions);
  assert.deepEqual(reloaded, direct);
});

test('les actions v1 sont relayées sur la tuile courante', () => {
  const campaign = createCampaign({ seed: 2 });
  const to = neighbors(campaign.world.hex)[0];
  const { state, events } = step(campaign, { type: 'move', to });
  assert.ok(events.some((e) => e.type === 'moved' && e.to === to));
  assert.equal(state.world.hex, to);
  assert.equal(dayState(state).player.hex, to);
  assert.ok(dayState(state).ap.spent > 0);
  assert.equal(dayState(state).turn, 1);
});

test('step est pur : la campagne reçue ne change pas', () => {
  const campaign = createCampaign({ seed: 2 });
  const before = jsonCopy(campaign);
  step(campaign, { type: 'move', to: neighbors(campaign.world.hex)[0] });
  assert.deepEqual(campaign, before);
});

test('un refus v1 rend la même campagne et un seul événement refused', () => {
  const campaign = createCampaign({ seed: 2 });
  const far = { type: 'move', to: 1 };
  const { state, events } = step(campaign, far);
  assert.equal(state, campaign);
  assert.deepEqual(events, [{ type: 'refused', action: far, reason: 'not-adjacent' }]);
  assert.equal(step(campaign, { type: 'voler' }).events[0].reason, 'unknown-action');
});

test('le RNG de campagne avance avec les tirages de la journée', () => {
  const campaign = createCampaign({ seed: 9 });
  const { campaign: later } = play(campaign, someMoves(campaign, 6));
  assert.equal(later.rng, dayState(later).rng);
  assert.notEqual(later.rng, campaign.rng);
});

test('blessures, radiations et inventaire remontent dans la campagne', () => {
  const campaign = createCampaign({ seed: 4 });
  const { campaign: later } = play(campaign, someMoves(campaign, 6));
  const day = dayState(later);
  assert.equal(later.player.wounds, day.player.wounds);
  assert.equal(later.player.radiation, day.player.radiation);
  assert.deepEqual(later.inventory, day.inventory);
});

test('une action de campagne et une réaction se branchent sans toucher au moteur v1', () => {
  CAMPAIGN_ACTIONS.test_wait = (draft, action, ctx) => {
    if (action.days < 1) return 'bad-days';
    draft.day += action.days;
    ctx.emit({ type: 'waited', days: action.days });
  };
  REACTIONS.push((draft, events, ctx) => {
    if (events.some((e) => e.type === 'waited')) ctx.emit({ type: 'test-reacted', day: draft.day });
  });
  try {
    const campaign = createCampaign({ seed: 1 });
    const { state, events } = step(campaign, { type: 'test_wait', days: 2 });
    assert.equal(state.day, 3);
    assert.equal(campaign.day, 1);
    assert.deepEqual(events, [{ type: 'waited', days: 2 }, { type: 'test-reacted', day: 3 }]);
    const refused = step(campaign, { type: 'test_wait', days: 0 });
    assert.equal(refused.state, campaign);
    assert.equal(refused.events[0].reason, 'bad-days');
  } finally {
    delete CAMPAIGN_ACTIONS.test_wait;
    REACTIONS.pop();
  }
});

test('le contenu est gelé', () => {
  assert.ok(Object.isFrozen(content));
  assert.ok(Object.isFrozen(content.tiles));
});
