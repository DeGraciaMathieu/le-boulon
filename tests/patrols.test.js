import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createCampaign, step, dayState, REACTIONS } from '../src/engine/campaign.js';
import {
  movePatrols, syncPatrols, patrolsAfterStep, patrolsOf, patrolsOn, startingPatrols, isPatrol,
  PATROL_MOVE_ON, DEFEAT_REPUTATION,
} from '../src/engine/rules/patrols.js';
import { DAY_HOOKS, DAY_HOOK_ORDER } from '../src/engine/rules/time.js';
import { encounterCard } from '../src/engine/rules/tile.js';
import { reputationOf } from '../src/engine/rules/factions.js';
import { createRng } from '../src/engine/rng.js';
import { distance, neighbors } from '../src/engine/hex.js';
import content from '../src/content/index.js';

const jsonCopy = (value) => JSON.parse(JSON.stringify(value));
const types = (events) => events.map((event) => event.type);

function ctxWith(rng = createRng(1)) {
  const events = [];
  return { ctx: { rng, emit: (event) => events.push(event) }, events };
}

// RNG dont le d6 rend toujours la même face.
function fixedD6(face) {
  return { ...createRng(9), d6: () => face };
}

const tokensOf = (campaign, tile = campaign.world.currentTile) =>
  campaign.world.tiles[tile].encounters.filter((encounter) => encounter.patrol);

// Campagne sur la tuile de départ de la patrouille, son jeton seul sur la tuile, à `away`
// hexagones du joueur.
function facing(patrol, { seed = 1, combatMode = 'rounds' } = {}) {
  const { tile } = content.patrols[patrol];
  const campaign = jsonCopy(createCampaign({ seed, tile, combatMode }));
  campaign.world.patrols = [{ id: patrol, tile }];
  const state = campaign.world.tiles[tile];
  state.encounters = [];
  state.suspects = [];
  const player = campaign.world.hex;
  const target = neighbors(player).find((n) => state.tile.hexes[n]);
  const token = neighbors(target).find((n) => state.tile.hexes[n] && n !== player && distance(n, player) > 1);
  state.encounters.push({ hex: token, card: patrol, patrol });
  return { campaign, target, token };
}

// Premier seed où le test de Discrétion échoue en entrant à côté du jeton.
function meet(patrol, options = {}) {
  for (let seed = 1; seed < 200; seed++) {
    const { campaign, target, token } = facing(patrol, { ...options, seed });
    const result = step(campaign, { type: 'move', to: target });
    if (result.events.some((event) => event.type === 'patrol-met')) return { ...result, token };
  }
  throw new Error('aucune rencontre');
}

test('contenu : une carte de rencontre humaine par patrouille, partie d\'une tuile', () => {
  assert.ok(Object.keys(content.patrols).length > 0);
  for (const [id, patrol] of Object.entries(content.patrols)) {
    assert.ok(content.tiles[patrol.tile], id);
    assert.ok(content.factions[patrol.faction], id);
    assert.equal(patrol.type, 'humain');
    assert.ok(isPatrol(id));
  }
  assert.deepEqual(startingPatrols(), Object.entries(content.patrols).map(([id, { tile }]) => ({ id, tile })));
});

test('encounterCard lit la carte d\'une patrouille sur n\'importe quelle tuile', () => {
  for (const tile of Object.values(content.tiles)) {
    assert.equal(encounterCard(tile, 'patrouille-bandits'), content.patrols['patrouille-bandits']);
  }
  assert.equal(encounterCard(content.tiles.cordon, 'pillard').name, 'Pillard');
});

test('la circulation est un hook de changement de jour', () => {
  assert.ok(DAY_HOOK_ORDER.includes('patrols'));
  assert.deepEqual(DAY_HOOKS.patrols, [movePatrols]);
});

test('une campagne neuve n\'a pas encore de patrouilles dans son état', () => {
  const campaign = createCampaign({ seed: 1 });
  assert.equal(campaign.world.patrols, undefined);
  assert.deepEqual(patrolsOf(campaign), startingPatrols());
});

test(`sous ${PATROL_MOVE_ON} au d6, une patrouille reste sur sa tuile`, () => {
  const draft = jsonCopy(createCampaign({ seed: 1 }));
  const { ctx } = ctxWith(fixedD6(PATROL_MOVE_ON - 1));
  movePatrols(draft, ctx);
  assert.deepEqual(draft.world.patrols, startingPatrols());
});

test(`à ${PATROL_MOVE_ON} ou plus, elle passe sur une tuile voisine reliée`, () => {
  const draft = jsonCopy(createCampaign({ seed: 1 }));
  const { ctx } = ctxWith(fixedD6(PATROL_MOVE_ON));
  movePatrols(draft, ctx);
  for (const [i, { id, tile }] of startingPatrols().entries()) {
    const moved = draft.world.patrols[i];
    assert.equal(moved.id, id);
    const exits = Object.values(content.links[tile]).map((link) => link.tile);
    assert.ok(exits.includes(moved.tile), `${id} : ${tile} -> ${moved.tile}`);
  }
});

test('une patrouille qui arrive sur la tuile du joueur pose un jeton, hors du joueur', () => {
  const draft = jsonCopy(createCampaign({ seed: 4 }));
  draft.world.patrols = [{ id: 'patrouille-bandits', tile: draft.world.currentTile }];
  const before = draft.world.tiles.cordon.encounters.length;
  const { ctx, events } = ctxWith();
  syncPatrols(draft, ctx);

  const [token] = tokensOf(draft);
  assert.equal(draft.world.tiles.cordon.encounters.length, before + 1);
  assert.deepEqual(token, { hex: token.hex, card: 'patrouille-bandits', patrol: 'patrouille-bandits' });
  assert.notEqual(token.hex, draft.world.hex);
  assert.deepEqual(events, [{ type: 'patrol-arrived', patrol: 'patrouille-bandits', tile: 'cordon', hex: token.hex }]);

  syncPatrols(draft, ctxWith().ctx);
  assert.equal(tokensOf(draft).length, 1, 'une seule pose');
});

test('une patrouille qui quitte la tuile du joueur retire son jeton', () => {
  const draft = jsonCopy(createCampaign({ seed: 4 }));
  draft.world.patrols = [{ id: 'patrouille-bandits', tile: 'cordon' }];
  syncPatrols(draft, ctxWith().ctx);
  const [{ hex }] = tokensOf(draft);
  draft.world.patrols[0].tile = 'decharge';
  const { ctx, events } = ctxWith();
  syncPatrols(draft, ctx);
  assert.deepEqual(tokensOf(draft), []);
  assert.deepEqual(events, [{ type: 'patrol-left', patrol: 'patrouille-bandits', tile: 'cordon', hex }]);
});

test('voyager vers la tuile d\'une patrouille y pose son jeton ; en repartir l\'enlève', () => {
  const start = jsonCopy(createCampaign({ seed: 6 }));
  start.world.patrols = [{ id: 'patrouille-bandits', tile: 'decharge' }];
  start.world.hex = 19;
  const there = step(start, { type: 'travel' });
  assert.equal(there.state.world.currentTile, 'decharge');
  assert.deepEqual(patrolsOn(there.state, 'decharge'), ['patrouille-bandits']);
  const [token] = tokensOf(there.state);
  assert.notEqual(token.hex, there.state.world.hex);
  assert.ok(types(there.events).includes('patrol-arrived'));

  const back = step(there.state, { type: 'travel' });
  assert.equal(back.state.world.currentTile, 'cordon');
  assert.deepEqual(tokensOf(back.state, 'decharge'), []);
});

test('le nouveau jour fait circuler les patrouilles', () => {
  let campaign = createCampaign({ seed: 2 });
  campaign = step(campaign, { type: 'camp' }).state;
  const { state } = step(campaign, { type: 'wake' });
  assert.ok(Array.isArray(state.world.patrols));
  assert.equal(state.world.patrols.length, startingPatrols().length);
});

test('la réaction des patrouilles passe avant l\'ouverture du combat', () => {
  assert.equal(REACTIONS[0], patrolsAfterStep);
});

test('patrouille hostile rencontrée : combat v2 contre sa carte', () => {
  const { state, events, token } = meet('patrouille-bandits');
  const met = events.find((event) => event.type === 'patrol-met');
  assert.deepEqual(met, { type: 'patrol-met', patrol: 'patrouille-bandits', faction: 'bandits', hex: token, stance: 'combat' });
  assert.equal(state.screen, 'combat');
  assert.equal(state.combat.card, 'patrouille-bandits');
  assert.equal(state.combat.enemies.length, content.patrols['patrouille-bandits'].count);
  assert.equal(state.combat.enemies[0].name, 'Bande de bandits');
});

test('patrouille amicale rencontrée (§9) : échange au lieu du combat, le jeton reste', () => {
  const { state, events, token } = meet('patrouille-solitaires');
  assert.equal(reputationOf(state, 'solitaires'), 2);
  assert.equal(events.find((event) => event.type === 'patrol-met').stance, 'echange');
  assert.ok(!types(events).includes('encounter-revealed'));
  assert.ok(!types(events).includes('combat-started'));
  assert.equal(state.combat, null);
  assert.equal(dayState(state).combat, null);
  assert.ok(tokensOf(state).some((encounter) => encounter.hex === token));
});

test('patrouille battue : dispersée, -1 de réputation avec sa faction', () => {
  const draft = jsonCopy(facing('patrouille-devoir').campaign);
  const before = reputationOf(draft, 'devoir');
  const card = 'patrouille-devoir';
  const events = [
    { type: 'combat-ended', outcome: 'victory', hex: 3, card, trophies: [] },
    { type: 'encounter-removed', hex: 3, card },
  ];
  const { ctx, events: emitted } = ctxWith();
  patrolsAfterStep(draft, events, ctx);
  assert.deepEqual(draft.world.patrols, []);
  assert.equal(reputationOf(draft, 'devoir'), before + DEFEAT_REPUTATION);
  assert.deepEqual(types(emitted), ['patrol-dispersed', 'reputation-changed']);
});

test('combat rapide gagné contre une patrouille : même dispersion', () => {
  const draft = jsonCopy(facing('patrouille-bandits').campaign);
  const card = 'patrouille-bandits';
  const events = [{ type: 'fight', card, won: true }, { type: 'encounter-removed', hex: 3, card }];
  const { ctx } = ctxWith();
  patrolsAfterStep(draft, events, ctx);
  assert.equal(reputationOf(draft, 'bandits'), -3);
});

test('péage : patrouille dispersée sans changer la réputation', () => {
  const draft = jsonCopy(facing('patrouille-liberte').campaign);
  const card = 'patrouille-liberte';
  const events = [
    { type: 'combat-ended', outcome: 'peage', hex: 3, card, trophies: [] },
    { type: 'encounter-removed', hex: 3, card },
  ];
  const { ctx, events: emitted } = ctxWith();
  patrolsAfterStep(draft, events, ctx);
  assert.deepEqual(draft.world.patrols, []);
  assert.deepEqual(types(emitted), ['patrol-dispersed']);
});

test('fuite : la patrouille et son jeton restent', () => {
  const { state } = meet('patrouille-bandits');
  const fled = step(state, { type: 'escape' });
  assert.ok(types(fled.events).includes('fled'));
  assert.deepEqual(patrolsOn(fled.state, state.world.currentTile), ['patrouille-bandits']);
  assert.equal(tokensOf(fled.state).length, 1);
});

test('combat rapide contre une patrouille : la carte est lue par encounterCard', () => {
  const { state } = meet('patrouille-bandits', { combatMode: 'rapide' });
  const { events } = step(state, { type: 'fight' });
  const fight = events.find((event) => event.type === 'fight');
  assert.equal(fight.threat, content.patrols['patrouille-bandits'].threat);
});

test('état sérialisable et déterministe', () => {
  const play = () => {
    let campaign = createCampaign({ seed: 11 });
    for (let day = 0; day < 4; day++) {
      campaign = step(campaign, { type: 'camp' }).state;
      campaign = step(campaign, { type: 'wake' }).state;
      if (campaign.combat) break;
    }
    return campaign;
  };
  const a = play();
  assert.deepEqual(a, play());
  assert.deepEqual(jsonCopy(a), a);
});
