import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createCampaign, step, dayState } from '../src/engine/campaign.js';
import { createItem } from '../src/engine/rules/sheet.js';
import { enemiesOf, startCombat, COMBAT_MODES } from '../src/engine/rules/combat.js';
import items from '../src/content/objets.js';
import factions from '../src/content/factions.js';
import AGROPROM_ENCOUNTERS from '../src/content/paquets/rencontres-agroprom.js';

const CARDS = {
  solo: { name: 'Pillard', threat: 3, wounds: 1, hp: 1, damage: 1, type: 'humain', faction: 'bandits' },
  meute: { name: 'Chiens', threat: 4, wounds: 1, hp: 1, damage: 1, type: 'mutant', trophy: 'queue-chien', count: 3 },
  patrouille: { name: 'Patrouille', threat: 5, wounds: 2, hp: 2, damage: 1, type: 'humain', faction: 'devoir', count: 2 },
  brute: { name: 'Brute', threat: 6, wounds: 2, hp: 4, damage: 3, type: 'humain', faction: null },
  ancienne: { name: 'Carte v1', threat: 4, wounds: 1 },
};

const ENCOUNTER_HEX = 9;
const START_HEX = 8;
const PREVIOUS_HEX = 2;

function testTile(terrain = 'herbe') {
  const hexes = {};
  for (let n = 1; n <= 19; n++) hexes[n] = { terrain };
  return { name: 'Test', entry: START_HEX, hexes, encounterCards: CARDS, composition: { encounters: 0 } };
}

const newCampaign = (options = {}) =>
  createCampaign({ seed: 1, tile: 'test', tiles: { test: testTile(options.terrain) }, ...options });

// Campagne déjà en combat v2 contre la carte `card` (rencontre sur l'hexagone 9).
function fighting(card, setup) {
  const campaign = newCampaign();
  const tile = campaign.world.tiles.test;
  tile.encounters = [{ hex: ENCOUNTER_HEX, card }];
  tile.combat = { hex: ENCOUNTER_HEX, card };
  tile.player.previousHex = PREVIOUS_HEX;
  setup?.(campaign);
  startCombat(campaign, { hex: ENCOUNTER_HEX, card }, { emit() {} });
  return campaign;
}

// Rejoue l'action avec d'autres états du RNG jusqu'à obtenir le tirage voulu.
function stepUntil(campaign, action, predicate) {
  for (let rng = 1; rng < 5000; rng++) {
    const result = step({ ...campaign, rng }, action);
    assert.notEqual(result.events[0]?.type, 'refused', JSON.stringify(result.events[0]));
    if (predicate(result.events, result.state)) return result;
  }
  throw new Error('aucun tirage ne convient');
}

const ofType = (events, type) => events.filter((event) => event.type === type);
const one = (events, type) => ofType(events, type)[0];
const refusal = (campaign, action) => step(campaign, action).events[0].reason;
const kinds = (campaign) => campaign.inventory.map((item) => item.kind);
const count = (campaign, kind) => kinds(campaign).filter((k) => k === kind).length;
const ammoLeft = (campaign, kind) =>
  campaign.inventory.filter((item) => item.kind === kind).reduce((total, item) => total + item.charges, 0);

const SHOOT = { type: 'shoot' };

test('réglage combatMode : rounds par défaut, rapide possible, inconnu refusé', () => {
  assert.deepEqual(COMBAT_MODES, ['rounds', 'rapide']);
  assert.equal(newCampaign().combatMode, 'rounds');
  assert.equal(newCampaign().combat, null);
  assert.equal(newCampaign({ combatMode: 'rapide' }).combatMode, 'rapide');
  assert.throws(() => newCampaign({ combatMode: 'lent' }), /combatMode/);
});

test('enemiesOf : une carte v1 donne un ennemi humain par défaut, count forme un groupe', () => {
  assert.deepEqual(enemiesOf(CARDS.ancienne), [
    { name: 'Carte v1', threat: 4, hp: 1, maxHp: 1, damage: 1, type: 'humain', faction: null, trophy: null },
  ]);
  const pack = enemiesOf(CARDS.meute);
  assert.equal(pack.length, 3);
  for (const dog of pack) {
    assert.deepEqual(dog, {
      name: 'Chiens', threat: 4, hp: 1, maxHp: 1, damage: 1, type: 'mutant', faction: null, trophy: 'queue-chien',
    });
  }
});

test('paquet Agroprom : champs v1 gardés, champs v2 valides, trophées au catalogue', () => {
  for (const [id, card] of Object.entries(AGROPROM_ENCOUNTERS)) {
    assert.ok(Number.isInteger(card.threat) && Number.isInteger(card.wounds), id);
    assert.ok(card.hp >= 1 && card.hp <= 4, `${id} : PV 1-4`);
    assert.ok(card.damage >= 1, id);
    assert.ok(['humain', 'mutant'].includes(card.type), id);
    if (card.type === 'mutant') assert.equal(card.faction ?? null, null, `${id} : un mutant n'a pas de faction`);
    if (card.faction) assert.ok(factions[card.faction], `${id} : faction ${card.faction}`);
    if (card.trophy) {
      assert.equal(card.type, 'mutant', `${id} : seuls les mutants donnent des trophées`);
      assert.equal(items[card.trophy]?.category, 'trophee', `${id} : trophée ${card.trophy}`);
    }
  }
  assert.ok(Object.values(AGROPROM_ENCOUNTERS).some((card) => (card.count ?? 1) > 1), 'au moins un groupe');
  for (const trophy of ['queue-chien', 'sabot']) {
    assert.equal(items[trophy].category, 'trophee');
    assert.ok(items[trophy].price > 0, 'revendable');
  }
});

// Rencontre posée sur le voisin 9 de l'hexagone de départ 8 : on y entre jusqu'à rater la Discrétion.
function revealFrom(campaign) {
  campaign.world.tiles.test.encounters = [{ hex: ENCOUNTER_HEX, card: 'solo' }];
  return stepUntil(campaign, { type: 'move', to: ENCOUNTER_HEX }, (events) =>
    events.some((event) => event.type === 'encounter-revealed'),
  );
}

test('mode rounds : une rencontre révélée ouvre le combat v2 (écran combat)', () => {
  const { state, events } = revealFrom(newCampaign());
  assert.equal(state.screen, 'combat');
  assert.equal(state.combat.card, 'solo');
  assert.equal(state.combat.hex, ENCOUNTER_HEX);
  assert.equal(state.combat.round, 1);
  assert.deepEqual(state.combat.enemies, enemiesOf(CARDS.solo));
  assert.equal(state.combat.previousScreen, 'tile');
  const started = one(events, 'combat-started');
  assert.equal(started.card, 'solo');
  assert.equal(started.enemies.length, 1);
});

test('mode rapide : la résolution v1 (fight, flee) reste en place', () => {
  const { state } = revealFrom(newCampaign({ combatMode: 'rapide' }));
  assert.equal(state.combat, null);
  assert.equal(state.screen, 'tile');
  assert.equal(refusal(state, SHOOT), 'not-in-combat');
  const { events } = step(state, { type: 'fight' });
  assert.equal(events[0].type, 'fight');
});

test('pendant le combat v2, seules les actions du round sont permises', () => {
  const campaign = fighting('solo');
  for (const action of [
    { type: 'move', to: PREVIOUS_HEX }, { type: 'fight' }, { type: 'flee' }, { type: 'equip', item: 'bandage' },
    { type: 'use', item: 'bandage' },
  ]) {
    assert.equal(refusal(campaign, action), 'in-combat', action.type);
  }
  for (const type of ['shoot', 'take-cover', 'grenade', 'heal', 'escape', 'parley']) {
    assert.equal(refusal(newCampaign(), { type }), 'not-in-combat', type);
  }
});

test('tirer : 1d6 + Tir + arme + couverture ≥ Menace, dégâts de l’arme, 1 munition, 0 PA', () => {
  const campaign = fighting('patrouille');
  for (const hit of [true, false]) {
    const { state, events } = stepUntil(campaign, SHOOT, (e) => one(e, 'shot').hit === hit);
    const shot = one(events, 'shot');
    assert.equal(shot.target, 0);
    assert.equal(shot.tir, 1);
    assert.equal(shot.weapon, 1);
    assert.equal(shot.cover, 0);
    assert.equal(shot.total, shot.roll + shot.tir + shot.weapon + shot.cover);
    assert.equal(shot.threat, 5);
    assert.equal(shot.hit, shot.total >= shot.threat);
    assert.equal(state.combat.enemies[0].hp, hit ? 1 : 2);
    assert.equal(ammoLeft(state, 'munitions'), ammoLeft(campaign, 'munitions') - 1);
    assert.equal(dayState(state).ap.left, dayState(campaign).ap.left);
  }
});

test('tirer : couverture du terrain, cible choisie, cible abattue refusée', () => {
  const campaign = fighting('patrouille', (c) => {
    c.world.tiles.test.tile.hexes[START_HEX] = { terrain: 'batiment' };
  });
  const { state, events } = stepUntil(campaign, { type: 'shoot', target: 1 }, (e) => one(e, 'shot').hit);
  assert.equal(one(events, 'shot').cover, 2);
  assert.equal(one(events, 'shot').target, 1);
  assert.equal(state.combat.enemies[1].hp, 1);
  assert.equal(refusal(campaign, { type: 'shoot', target: 5 }), 'no-target');
  const downed = structuredClone(campaign);
  downed.combat.enemies[0].hp = 0;
  assert.equal(refusal(downed, { type: 'shoot', target: 0 }), 'no-target');
  assert.equal(one(step({ ...downed, rng: 3 }, SHOOT).events, 'shot').target, 1);
});

test('tirer sans arme chargée : -1, dégâts 1, aucune munition', () => {
  const campaign = fighting('brute', (c) => {
    c.inventory = c.inventory.filter((item) => item.kind !== 'munitions');
  });
  const { state, events } = stepUntil(campaign, SHOOT, (e) => one(e, 'shot').hit);
  assert.equal(one(events, 'shot').weapon, -1);
  assert.equal(one(events, 'shot').damage, 1);
  assert.equal(state.combat.enemies[0].hp, 3);
});

test('tirer au fusil d’assaut : munitions dédiées 5,45 et dégâts 2', () => {
  const campaign = fighting('brute', (c) => {
    c.equipment.primary = createItem('fusil-assaut');
    c.inventory.push(createItem('munitions-545'));
  });
  const { state, events } = stepUntil(campaign, SHOOT, (e) => one(e, 'shot').hit);
  assert.equal(one(events, 'shot').weapon, 3);
  assert.equal(one(events, 'shot').damage, 2);
  assert.equal(state.combat.enemies[0].hp, 2);
  assert.equal(ammoLeft(state, 'munitions-545'), 5);
  assert.equal(ammoLeft(state, 'munitions'), ammoLeft(campaign, 'munitions'));
});

test('chaque ennemi debout attaque : 1d6 + Menace ≥ 4 + couverture + armure', () => {
  const campaign = fighting('patrouille');
  const { state, events } = stepUntil(campaign, SHOOT, (e) => !one(e, 'shot').hit);
  const attacks = ofType(events, 'enemy-attack');
  assert.equal(attacks.length, 2);
  let wounds = 0;
  attacks.forEach((attack, i) => {
    assert.equal(attack.enemy, i);
    assert.equal(attack.defense, 4);
    assert.equal(attack.total, attack.roll + attack.threat);
    assert.equal(attack.hit, attack.total >= attack.defense);
    assert.equal(attack.wounds, attack.hit ? 1 : 0);
    wounds += attack.wounds;
  });
  assert.equal(state.player.wounds, wounds);
  assert.equal(state.combat.round, 2);
  assert.ok(events.findIndex((e) => e.type === 'shot') < events.findIndex((e) => e.type === 'enemy-attack'));
});

test('défense : couverture du terrain et armure portée', () => {
  const campaign = fighting('brute', (c) => {
    c.world.tiles.test.tile.hexes[START_HEX] = { terrain: 'foret' };
    c.equipment.armor = createItem('veste-cuir');
  });
  const { events } = stepUntil(campaign, SHOOT, (e) => !one(e, 'shot').hit);
  assert.equal(one(events, 'enemy-attack').defense, 6);
});

test('armure : absorbe ses blessures une fois par combat (armorAbsorb)', () => {
  const campaign = fighting('brute', (c) => {
    c.equipment.armor = createItem('veste-cuir');
  });
  assert.equal(campaign.combat.absorb, 1);
  const first = stepUntil(campaign, SHOOT, (e) => !one(e, 'shot').hit && one(e, 'enemy-attack').hit);
  const attack = one(first.events, 'enemy-attack');
  assert.equal(attack.absorbed, 1);
  assert.equal(attack.wounds, 2);
  assert.equal(first.state.player.wounds, 2);
  assert.equal(first.state.combat.absorb, 0);
  const second = stepUntil(first.state, SHOOT, (e) => !one(e, 'shot').hit && one(e, 'enemy-attack').hit);
  assert.equal(one(second.events, 'enemy-attack').absorbed, 0);
  assert.equal(second.state.player.wounds, 5);
});

test('se mettre à couvert : +2 de défense ce round et le suivant, pas de tir', () => {
  const campaign = fighting('brute');
  const covered = step({ ...campaign, rng: 1 }, { type: 'take-cover' });
  assert.equal(ofType(covered.events, 'shot').length, 0);
  assert.deepEqual(one(covered.events, 'took-cover'), { type: 'took-cover', bonus: 2, rounds: 2 });
  assert.equal(one(covered.events, 'enemy-attack').defense, 6);
  const healthy = (c) => ({ ...c, player: { ...c.player, wounds: 0 } });
  const next = stepUntil(healthy(covered.state), SHOOT, (e) => !one(e, 'shot').hit);
  assert.equal(one(next.events, 'enemy-attack').defense, 6);
  const after = stepUntil(healthy(next.state), SHOOT, (e) => !one(e, 'shot').hit);
  assert.equal(one(after.events, 'enemy-attack').defense, 4);
});

test('grenade : 1 PV à tous les ennemis, consommée ; sans grenade : no-item', () => {
  const campaign = fighting('patrouille', (c) => c.inventory.push(createItem('grenade')));
  const { state, events } = step({ ...campaign, rng: 1 }, { type: 'grenade' });
  assert.deepEqual(one(events, 'grenade'), { type: 'grenade', damage: 1, targets: [0, 1] });
  assert.deepEqual(state.combat.enemies.map((enemy) => enemy.hp), [1, 1]);
  assert.equal(count(state, 'grenade'), 0);
  assert.equal(refusal(fighting('patrouille'), { type: 'grenade' }), 'no-item');
});

test('grenade sur une meute à 1 PV : victoire sans riposte', () => {
  const campaign = fighting('meute', (c) => c.inventory.push(createItem('grenade')));
  const { state, events } = step(campaign, { type: 'grenade' });
  assert.equal(ofType(events, 'enemy-down').length, 3);
  assert.equal(ofType(events, 'enemy-attack').length, 0);
  assert.equal(one(events, 'combat-ended').outcome, 'victory');
  assert.equal(state.combat, null);
});

test('soigner : un consommable de soin retire ses blessures', () => {
  const campaign = fighting('solo', (c) => {
    c.player.wounds = 3;
  });
  const { state, events } = step(campaign, { type: 'heal' });
  assert.deepEqual(one(events, 'used'), { type: 'used', item: 'bandage', wounds: -1 });
  assert.equal(count(state, 'bandage'), count(campaign, 'bandage') - 1);
  assert.equal(state.player.wounds, 2 + ofType(events, 'enemy-attack').reduce((t, a) => t + a.wounds, 0));
  const medkit = fighting('solo', (c) => {
    c.player.wounds = 3;
    c.inventory.push(createItem('trousse-soins'));
  });
  assert.deepEqual(one(step(medkit, { type: 'heal', item: 'trousse-soins' }).events, 'used').wounds, -2);
  assert.equal(refusal(campaign, { type: 'heal', item: 'vodka' }), 'not-healing');
  assert.equal(refusal(campaign, { type: 'heal', item: 'trousse-militaire' }), 'no-item');
  const empty = fighting('solo', (c) => {
    c.inventory = c.inventory.filter((item) => item.kind !== 'bandage');
  });
  assert.equal(refusal(empty, { type: 'heal' }), 'no-item');
});

test('fuir réussi : 2 PA, test de Discrétion, retour à l’hexagone précédent, le jeton reste', () => {
  const campaign = fighting('patrouille');
  const { state, events } = stepUntil(campaign, { type: 'escape' }, (e) => one(e, 'check').success);
  assert.equal(one(events, 'check').stat, 'discretion');
  assert.equal(ofType(events, 'enemy-attack').length, 0);
  assert.deepEqual(one(events, 'fled'), { type: 'fled', from: START_HEX, to: PREVIOUS_HEX, cost: 2 });
  assert.equal(one(events, 'combat-ended').outcome, 'fled');
  assert.equal(state.world.hex, PREVIOUS_HEX);
  assert.equal(dayState(state).ap.left, dayState(campaign).ap.left - 2);
  assert.deepEqual(state.world.tiles.test.encounters, [{ hex: ENCOUNTER_HEX, card: 'patrouille' }]);
  assert.equal(state.world.tiles.test.combat, null);
  assert.equal(state.combat, null);
  assert.equal(state.screen, 'tile');
});

test('fuir raté : une attaque gratuite de l’ennemi le plus menaçant, puis la fuite', () => {
  const campaign = fighting('patrouille');
  campaign.combat.enemies[1].threat = 6;
  const { state, events } = stepUntil(campaign, { type: 'escape' }, (e) => !one(e, 'check').success);
  const attacks = ofType(events, 'enemy-attack');
  assert.equal(attacks.length, 1);
  assert.equal(attacks[0].enemy, 1);
  assert.equal(attacks[0].free, true);
  assert.equal(state.world.hex, PREVIOUS_HEX);
  assert.equal(one(events, 'combat-ended').outcome, 'fled');
});

test('fuir sans 2 PA : not-enough-ap', () => {
  const campaign = fighting('solo', (c) => {
    c.world.tiles.test.ap.left = 1;
  });
  assert.equal(refusal(campaign, { type: 'escape' }), 'not-enough-ap');
});

test('victoire : rencontre retirée, écran rendu, pas de riposte', () => {
  const campaign = fighting('solo');
  const { state, events } = stepUntil(campaign, SHOOT, (e) => one(e, 'shot').hit);
  assert.equal(ofType(events, 'enemy-attack').length, 0);
  assert.deepEqual(one(events, 'enemy-down'), { type: 'enemy-down', enemy: 0, name: 'Pillard' });
  assert.deepEqual(one(events, 'encounter-removed'), { type: 'encounter-removed', hex: ENCOUNTER_HEX, card: 'solo' });
  const ended = one(events, 'combat-ended');
  assert.equal(ended.outcome, 'victory');
  assert.deepEqual(ended.trophies, []);
  assert.deepEqual(state.world.tiles.test.encounters, []);
  assert.equal(state.world.tiles.test.combat, null);
  assert.equal(state.combat, null);
  assert.equal(state.screen, 'tile');
  assert.equal(step(state, { type: 'move', to: ENCOUNTER_HEX }).events[0].type, 'moved');
});

test('mutants vaincus : un trophée revendable par mutant porteur', () => {
  const campaign = fighting('meute', (c) => c.inventory.push(createItem('grenade')));
  const { state, events } = step(campaign, { type: 'grenade' });
  assert.deepEqual(one(events, 'combat-ended').trophies, ['queue-chien', 'queue-chien', 'queue-chien']);
  assert.equal(count(state, 'queue-chien'), 3);
});

test('trophée sans place dans la grille : perdu et annoncé', () => {
  const campaign = fighting('meute', (c) => {
    c.inventory.push(createItem('grenade'));
    while (c.inventory.reduce((t, item) => t + item.size, 0) < 12) c.inventory.push(createItem('ration'));
  });
  const { state, events } = step(campaign, { type: 'grenade' });
  assert.ok(count(state, 'queue-chien') >= 1);
  assert.equal(ofType(events, 'trophy-lost').length, 3 - count(state, 'queue-chien'));
});

test('parlementer : pas avec des mutants ni une faction hostile', () => {
  assert.equal(refusal(fighting('meute'), { type: 'parley' }), 'mutants');
  assert.equal(refusal(fighting('solo'), { type: 'parley' }), 'hostile');
});

test('parlementer en neutre : péage par ennemi, payé en roubles', () => {
  const poor = fighting('patrouille');
  assert.equal(refusal(poor, { type: 'parley' }), 'not-enough-roubles');
  const rich = fighting('patrouille', (c) => {
    c.player.roubles = 500;
  });
  const { state, events } = step(rich, { type: 'parley' });
  assert.deepEqual(one(events, 'parley'), { type: 'parley', faction: 'devoir', standing: 'neutre', outcome: 'peage', toll: 100 });
  assert.equal(state.player.roubles, 400);
  assert.equal(one(events, 'combat-ended').outcome, 'peage');
  assert.equal(ofType(events, 'enemy-attack').length, 0);
  assert.deepEqual(state.world.tiles.test.encounters, []);
  assert.equal(state.combat, null);
});

test('parlementer en bons termes : échange (amical), fin du combat (allié ou membre)', () => {
  const friendly = fighting('patrouille', (c) => {
    c.reputation.devoir = 2;
  });
  const exchange = step(friendly, { type: 'parley' });
  assert.equal(one(exchange.events, 'parley').outcome, 'echange');
  assert.equal(exchange.state.combat, null);
  const ally = fighting('patrouille', (c) => {
    c.reputation.devoir = 3;
  });
  assert.equal(one(step(ally, { type: 'parley' }).events, 'parley').outcome, 'fin');
  const member = fighting('patrouille', (c) => {
    c.player.faction = 'devoir';
  });
  assert.equal(one(step(member, { type: 'parley' }).events, 'parley').outcome, 'fin');
});

test('parlementer sans faction (mercenaires) : péage', () => {
  const campaign = fighting('brute', (c) => {
    c.player.roubles = 100;
  });
  assert.equal(one(step(campaign, { type: 'parley' }).events, 'parley').outcome, 'peage');
});

test('mort au combat : le combat s’arrête, la partie est finie', () => {
  const campaign = fighting('brute', (c) => {
    c.player.wounds = 5;
  });
  const { state, events } = stepUntil(campaign, SHOOT, (e) => ofType(e, 'enemy-attack').some((a) => a.hit));
  assert.equal(state.player.wounds, 6);
  assert.equal(one(events, 'died').cause, 'combat');
  assert.equal(one(events, 'combat-ended').outcome, 'dead');
  assert.equal(state.combat, null);
  assert.equal(refusal(state, { type: 'move', to: PREVIOUS_HEX }), 'game-over');
});

test('chaque round s’annonce et chaque jet est dans les événements', () => {
  const campaign = fighting('patrouille');
  const { events } = stepUntil(campaign, SHOOT, (e) => !one(e, 'shot').hit);
  assert.deepEqual(events[0], { type: 'combat-round', round: 1 });
  for (const event of [one(events, 'shot'), ...ofType(events, 'enemy-attack')]) {
    assert.ok(Number.isInteger(event.roll) && event.roll >= 1 && event.roll <= 6);
  }
});

test('pur et sérialisable : l’état reçu ne bouge pas, une copie JSON rejoue à l’identique', () => {
  const campaign = fighting('patrouille', (c) => c.inventory.push(createItem('grenade')));
  const before = structuredClone(campaign);
  const copy = JSON.parse(JSON.stringify(campaign));
  for (const action of [SHOOT, { type: 'take-cover' }, { type: 'grenade' }, { type: 'escape' }]) {
    assert.deepEqual(step(copy, action), step(campaign, action));
  }
  assert.deepEqual(campaign, before);
});
