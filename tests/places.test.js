import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createCampaign, step, dayState } from '../src/engine/campaign.js';
import {
  PLACES,
  DECKS,
  LOOT,
  PLACE_FEE,
  fixCard,
  refillPlaces,
  rollLoot,
  placeView,
} from '../src/engine/rules/places.js';
import { DIALOGUES, EFFECTS } from '../src/engine/rules/dialogue.js';
import { createRng } from '../src/engine/rng.js';
import { countCharges } from '../src/engine/rules/sheet.js';

// Lieu factice sur l'hexagone de départ du Cordon, avec son paquet de cartes.
let placeCount = 0;
function placeWith(cards, more = {}) {
  placeCount += 1;
  const id = `lieu-test-${placeCount}`;
  PLACES[id] = { name: 'Lieu test', label: 'Тест', tile: 'cordon', hex: 5, tags: [], deck: id, loot: 'test', ...more };
  DECKS[id] = { kind: 'exploration', place: id, cards };
  return id;
}

LOOT.test = { level: 1, entries: [{ item: 'bandage', weight: 1 }] };
LOOT.riche = { level: 1, entries: [{ item: 'ration', weight: 1, qty: 2 }, { item: 'vodka', weight: 3 }] };
DECKS.sous_sol = { kind: 'exploration', cards: [{ id: 'cave', type: 'rien', text: 'Une cave humide.' }] };
DIALOGUES['pnj-test'] = { start: 'a', nodes: { a: { text: 'Salut.', choices: [{ text: 'Au revoir.' }] } } };

// Campagne de départ, paquet Zone vidé pour que les PA dépensés ne piochent rien.
function campaignWith({ stats = {}, perks = [], roubles = 0, reputation = {}, combatMode } = {}) {
  const campaign = createCampaign({ seed: 7, combatMode });
  Object.assign(campaign.player.stats, stats);
  campaign.player.perks = perks;
  campaign.player.roubles = roubles;
  Object.assign(campaign.reputation, reputation);
  campaign.world.tiles.cordon.zone.deck = [];
  return campaign;
}

function play(campaign, actions) {
  const events = [];
  for (const action of actions) {
    const result = step(campaign, action);
    campaign = result.state;
    events.push(...result.events);
  }
  return { campaign, events };
}

const apLeft = (campaign) => dayState(campaign).ap.left;
const ofType = (events, type) => events.filter((event) => event.type === type);
const explores = (n) => Array.from({ length: n }, () => ({ type: 'explore' }));
const SURE = 20;
const NEVER = -20;

test('entrer dans un lieu bascule sur la vue du lieu sans PA de plus (le pas sur l’hexagone a coûté 1 PA)', () => {
  const place = placeWith([{ id: 'r', type: 'rien' }]);
  const start = campaignWith();
  const { campaign, events } = play(start, [{ type: 'enter-place', place }]);
  assert.equal(campaign.screen, 'place');
  assert.deepEqual(campaign.place, { id: place });
  assert.equal(apLeft(campaign), apLeft(start));
  assert.equal(ofType(events, 'place-entered').length, 1);
});

test('entrer : refus hors de l’hexagone, lieu inconnu, déjà dedans', () => {
  const place = placeWith([{ id: 'r', type: 'rien' }]);
  const far = placeWith([{ id: 'r', type: 'rien' }], { hex: 9 });
  const campaign = campaignWith();
  assert.equal(step(campaign, { type: 'enter-place', place: far }).events[0].reason, 'not-here');
  assert.equal(step(campaign, { type: 'enter-place', place: 'nulle-part' }).events[0].reason, 'unknown-place');
  const inside = step(campaign, { type: 'enter-place', place }).state;
  assert.equal(step(inside, { type: 'enter-place', place }).events[0].reason, 'in-place');
});

test('explorer coûte 1 PA et révèle les cartes une par une jusqu’au lieu vidé', () => {
  const place = placeWith([
    { id: 'r1', type: 'rien', count: 2 },
    { id: 'r2', type: 'rien', text: 'Une pièce vide.' },
    { id: 'r3', type: 'rien' },
  ]);
  const start = step(campaignWith(), { type: 'enter-place', place }).state;
  const { campaign, events } = play(start, explores(4));
  const cards = ofType(events, 'place-card');
  assert.equal(cards.length, 4);
  assert.deepEqual(cards.map((e) => e.position), [1, 2, 3, 4]);
  assert.deepEqual([...cards.map((e) => e.card)].sort(), ['r1', 'r1', 'r2', 'r3']);
  assert.equal(cards.find((e) => e.card === 'r2').text, 'Une pièce vide.');
  assert.equal(apLeft(campaign), apLeft(start) - 4);
  assert.equal(ofType(events, 'place-emptied').length, 1);
  assert.equal(campaign.places[place].emptied, true);
  assert.equal(step(campaign, { type: 'explore' }).events[0].reason, 'place-emptied');
});

test('quitter garde la progression ; on reprend là où on s’était arrêté', () => {
  const place = placeWith([{ id: 'a', type: 'rien' }, { id: 'b', type: 'rien' }, { id: 'c', type: 'rien' }]);
  const { campaign: out, events: first } = play(campaignWith(), [
    { type: 'enter-place', place }, { type: 'explore' }, { type: 'leave-place' },
  ]);
  assert.equal(out.screen, 'tile');
  assert.equal(out.place, undefined);
  assert.equal(ofType(first, 'place-left').length, 1);
  assert.equal(step(out, { type: 'explore' }).events[0].reason, 'not-in-place');
  const { events } = play(out, [{ type: 'enter-place', place }, ...explores(2)]);
  const all = [...ofType(first, 'place-card'), ...ofType(events, 'place-card')].map((e) => e.card);
  assert.deepEqual([...all].sort(), ['a', 'b', 'c']);
  assert.deepEqual(ofType(events, 'place-card').map((e) => e.position), [2, 3]);
});

test('dans un lieu, les actions de tuile sont refusées', () => {
  const place = placeWith([{ id: 'r', type: 'rien' }]);
  const inside = step(campaignWith(), { type: 'enter-place', place }).state;
  for (const action of [{ type: 'move', to: 4 }, { type: 'exit' }, { type: 'bolt', target: 4 }, { type: 'pickup' }]) {
    assert.equal(step(inside, action).events[0].reason, 'in-place');
  }
});

test('carte fixée par la quête : toujours à sa position, avant ou après la première entrée', () => {
  const cards = [
    { id: 'a', type: 'rien' }, { id: 'b', type: 'rien' }, { id: 'c', type: 'rien' },
    { id: 'indice-acte1', type: 'indice' }, { id: 'd', type: 'rien' },
  ];
  for (const seed of [1, 2, 3]) {
    const place = placeWith(cards);
    const before = campaignWith();
    before.rng = seed;
    assert.equal(fixCard(before, place, 'indice-acte1', 3), undefined);
    const { events } = play(before, [{ type: 'enter-place', place }, ...explores(5)]);
    assert.equal(ofType(events, 'place-card')[2].card, 'indice-acte1');
    assert.equal(ofType(events, 'place-card').filter((e) => e.card === 'indice-acte1').length, 1);
  }
  const place = placeWith(cards);
  const campaign = structuredClone(play(campaignWith(), [{ type: 'enter-place', place }, { type: 'explore' }]).campaign);
  const late = campaign.places[place].pool.at(-1);
  assert.equal(fixCard(campaign, place, late, 3), undefined);
  const { events } = play(campaign, explores(4));
  assert.equal(ofType(events, 'place-card')[1].card, late);
});

test('fixCard : refus d’une carte ou d’un lieu inconnus', () => {
  const place = placeWith([{ id: 'a', type: 'rien' }]);
  const campaign = campaignWith();
  assert.equal(fixCard(campaign, place, 'zzz', 1), 'unknown-card');
  assert.equal(fixCard(campaign, 'nulle-part', 'a', 1), 'unknown-place');
});

test('butin : objets tirés de la table du lieu', () => {
  const place = placeWith([{ id: 'b', type: 'butin' }]);
  const start = step(campaignWith(), { type: 'enter-place', place }).state;
  const { campaign, events } = play(start, [{ type: 'explore' }]);
  const [loot] = ofType(events, 'loot-found');
  assert.deepEqual(loot.items, [{ item: 'bandage', stored: true }]);
  assert.equal(countCharges(campaign.inventory, 'bandage'), countCharges(start.inventory, 'bandage') + 1);
});

test('rollLoot : tirage pondéré et quantité, table absente = rien', () => {
  const rng = createRng(1);
  const drawn = Array.from({ length: 200 }, () => rollLoot('riche', rng)).flat();
  assert.ok(drawn.every(({ item }) => item === 'ration' || item === 'vodka'));
  assert.ok(drawn.filter(({ item }) => item === 'vodka').length > 100);
  assert.ok(drawn.filter(({ item }) => item === 'ration').every(({ qty }) => qty === 2));
  assert.deepEqual(rollLoot('absente', rng), []);
  assert.deepEqual(rollLoot(undefined, rng), []);
});

test('cache : test réussi, butin plus riche (2 tirages) ; raté, piège', () => {
  const place = placeWith([{ id: 'c', type: 'cache', stat: 'survie' }]);
  const ok = play(campaignWith({ stats: { survie: SURE } }), [{ type: 'enter-place', place }, { type: 'explore' }]);
  assert.equal(ofType(ok.events, 'check')[0].stat, 'survie');
  assert.equal(ofType(ok.events, 'loot-found')[0].items.length, 2);

  const trapped = placeWith([{ id: 'c', type: 'cache' }]);
  const ko = play(campaignWith({ stats: { survie: NEVER, discretion: NEVER } }), [
    { type: 'enter-place', place: trapped }, { type: 'explore' },
  ]);
  assert.equal(ofType(ko.events, 'loot-found').length, 0);
  assert.deepEqual(ofType(ko.events, 'trap-triggered')[0], { type: 'trap-triggered', place: trapped, card: 'c', trap: 'blessure' });
  assert.equal(ko.campaign.player.wounds, 1);
});

test('cache sans stat : le meilleur de Survie et Discrétion ; piège bruit : rencontre', () => {
  const place = placeWith([{ id: 'c', type: 'cache', trap: 'bruit' }]);
  const { campaign, events } = play(campaignWith({ stats: { survie: NEVER, discretion: NEVER - 1 } }), [
    { type: 'enter-place', place }, { type: 'explore' },
  ]);
  assert.equal(ofType(events, 'check')[0].stat, 'survie');
  assert.ok(dayState(campaign).combat);
});

test('anomalie intérieure : test de Survie à l’aveugle, raté = effet', () => {
  const place = placeWith([{ id: 'x', type: 'anomalie', anomaly: 'electro' }]);
  const { campaign, events } = play(campaignWith({ stats: { survie: NEVER } }), [
    { type: 'enter-place', place }, { type: 'explore' },
  ]);
  assert.equal(ofType(events, 'anomaly-triggered')[0].anomaly, 'electro');
  assert.equal(campaign.player.wounds, 2);
  assert.equal(dayState(campaign).detector.broken, true);

  const safe = play(campaignWith({ stats: { survie: SURE } }), [{ type: 'enter-place', place }, { type: 'explore' }]);
  assert.equal(ofType(safe.events, 'anomaly-avoided').length, 1);
  assert.equal(safe.campaign.player.wounds, 0);
});

test('boulon (1 PA) : désamorce une anomalie avant de la révéler, sinon montre la carte suivante', () => {
  const place = placeWith([{ id: 'x', type: 'anomalie', anomaly: 'bruleuse' }]);
  const start = step(campaignWith({ stats: { survie: NEVER } }), { type: 'enter-place', place }).state;
  const { campaign, events } = play(start, [{ type: 'bolt-card' }]);
  assert.equal(apLeft(campaign), apLeft(start) - 1);
  assert.equal(countCharges(campaign.inventory, 'boulons'), countCharges(start.inventory, 'boulons') - 1);
  assert.equal(ofType(events, 'card-defused')[0].card, 'x');
  assert.equal(campaign.player.wounds, 0);
  assert.equal(campaign.places[place].emptied, true);

  const quiet = placeWith([{ id: 'r', type: 'rien' }]);
  const peek = play(campaignWith(), [{ type: 'enter-place', place: quiet }, { type: 'bolt-card' }]);
  assert.deepEqual(ofType(peek.events, 'card-peeked')[0], { type: 'card-peeked', place: quiet, card: 'r', cardType: 'rien' });
  assert.equal(peek.campaign.places[quiet].revealed.length, 0);

  const noBolt = step(campaignWith(), { type: 'enter-place', place: quiet }).state;
  noBolt.inventory = noBolt.inventory.filter((item) => item.kind !== 'boulons');
  assert.equal(step(noBolt, { type: 'bolt-card' }).events[0].reason, 'no-bolt');
});

test('occupant, mode rapide : combat v1 sur place ; victoire, la carte est jouée ; fuite, on quitte le lieu', () => {
  const place = placeWith([{ id: 'o', type: 'occupant', encounter: 'pillard' }]);
  const inCombat = play(campaignWith({ stats: { tir: SURE }, combatMode: 'rapide' }), [{ type: 'enter-place', place }, { type: 'explore' }]);
  assert.deepEqual(dayState(inCombat.campaign).combat, { hex: null, card: 'pillard', place });
  assert.equal(step(inCombat.campaign, { type: 'explore' }).events[0].reason, 'in-combat');
  assert.equal(step(inCombat.campaign, { type: 'leave-place' }).events[0].reason, 'in-combat');

  const won = play(inCombat.campaign, [{ type: 'fight' }]);
  assert.equal(ofType(won.events, 'fight')[0].won, true);
  assert.equal(dayState(won.campaign).combat, null);
  assert.equal(won.campaign.screen, 'place');

  const fled = play(inCombat.campaign, [{ type: 'flee' }]);
  assert.equal(fled.campaign.screen, 'tile');
  assert.equal(fled.campaign.place, undefined);
  assert.equal(dayState(fled.campaign).combat, null);
  assert.equal(fled.campaign.world.hex, 5);
  assert.equal(apLeft(fled.campaign), apLeft(inCombat.campaign) - 2);
});

test('occupant, mode rounds : combat v2 depuis le lieu ; victoire, retour au lieu, la carte est jouée ; fuite, la carte reste et on quitte le lieu', () => {
  const place = placeWith([{ id: 'o', type: 'occupant', encounter: 'pillard' }]);
  const inCombat = play(campaignWith({ stats: { tir: SURE, discretion: SURE } }), [{ type: 'enter-place', place }, { type: 'explore' }]);
  assert.equal(inCombat.campaign.screen, 'combat');
  assert.equal(inCombat.campaign.combat.card, 'pillard');
  assert.equal(ofType(inCombat.events, 'combat-started').length, 1);
  assert.equal(step(inCombat.campaign, { type: 'explore' }).events[0].reason, 'in-combat');
  assert.equal(step(inCombat.campaign, { type: 'leave-place' }).events[0].reason, 'in-combat');

  const won = play(inCombat.campaign, [{ type: 'shoot' }]);
  assert.equal(ofType(won.events, 'combat-ended')[0].outcome, 'victory');
  assert.equal(won.campaign.combat, null);
  assert.equal(dayState(won.campaign).combat, null);
  assert.equal(won.campaign.screen, 'place');
  assert.deepEqual(won.campaign.place, { id: place });
  assert.deepEqual(won.campaign.places[place].revealed, ['o']);

  const fled = play(inCombat.campaign, [{ type: 'escape' }]);
  assert.equal(ofType(fled.events, 'combat-ended')[0].outcome, 'fled');
  assert.equal(fled.campaign.screen, 'tile');
  assert.equal(fled.campaign.place, undefined);
  assert.equal(dayState(fled.campaign).combat, null);
  assert.equal(fled.campaign.world.hex, 5);
  assert.equal(apLeft(fled.campaign), apLeft(inCombat.campaign) - 2);
  assert.deepEqual(fled.campaign.places[place].revealed, []);
  assert.equal(fled.campaign.places[place].emptied, false);
  const again = play(fled.campaign, [{ type: 'enter-place', place }, { type: 'explore' }]);
  assert.equal(ofType(again.events, 'place-card')[0].card, 'o');
});

test('piège « bruit », mode rounds : la cache ratée ouvre un combat v2 qui ramène au lieu', () => {
  const place = placeWith([{ id: 'c', type: 'cache', stat: 'survie', trap: 'bruit' }]);
  const { campaign } = play(campaignWith({ stats: { survie: NEVER, tir: SURE } }), [{ type: 'enter-place', place }, { type: 'explore' }]);
  assert.equal(campaign.screen, 'combat');
  const won = play(campaign, Array.from({ length: 4 }, () => ({ type: 'shoot' })));
  assert.equal(ofType(won.events, 'combat-ended')[0].outcome, 'victory');
  assert.equal(won.campaign.screen, 'place');
});

test('PNJ : la carte lance le dialogue, qui ramène au lieu', () => {
  const place = placeWith([{ id: 'p', type: 'pnj', npc: 'pnj-test' }]);
  const { campaign, events } = play(campaignWith(), [{ type: 'enter-place', place }, { type: 'explore' }]);
  assert.equal(ofType(events, 'dialogue-started')[0].npc, 'pnj-test');
  assert.equal(campaign.screen, 'dialogue');
  assert.equal(step(campaign, { type: 'explore' }).events[0].reason, 'in-dialogue');
  const back = step(campaign, { type: 'choose', index: 0 }).state;
  assert.equal(back.screen, 'place');
});

test('indice : événement et effets de quête par les hooks de dialogue', () => {
  const place = placeWith([{ id: 'note', type: 'indice', text: 'Un PDA.', effects: [{ type: 'roubles', amount: 50 }] }]);
  const { campaign, events } = play(campaignWith(), [{ type: 'enter-place', place }, { type: 'explore' }]);
  assert.deepEqual(ofType(events, 'clue-found')[0], { type: 'clue-found', place, card: 'note' });
  assert.equal(campaign.player.roubles, 50);
});

test('passage : ouvre un paquet intérieur exploré avant la suite ; le lieu est vidé quand tout est fini', () => {
  const place = placeWith([{ id: 'trappe', type: 'passage', deck: 'sous_sol' }]);
  const { campaign, events } = play(campaignWith(), [{ type: 'enter-place', place }, ...explores(2)]);
  assert.equal(ofType(events, 'passage-opened')[0].deck, 'sous_sol');
  assert.deepEqual(ofType(events, 'place-card').map((e) => [e.card, e.zone]), [['trappe', 'main'], ['cave', 'inner']]);
  assert.equal(campaign.places[place].emptied, true);
});

test('Fouilleur : la première exploration de chaque lieu coûte 0 PA', () => {
  const cards = [{ id: 'a', type: 'rien' }, { id: 'b', type: 'rien' }];
  const one = placeWith(cards);
  const two = placeWith(cards);
  const start = campaignWith({ perks: ['fouilleur'] });
  const { campaign } = play(start, [
    { type: 'enter-place', place: one }, ...explores(2), { type: 'leave-place' },
    { type: 'enter-place', place: two }, { type: 'explore' },
  ]);
  assert.equal(apLeft(campaign), apLeft(start) - 1);
});

test('pas assez de PA : refus', () => {
  const place = placeWith([{ id: 'a', type: 'rien' }]);
  const campaign = step(campaignWith(), { type: 'enter-place', place }).state;
  campaign.world.tiles.cordon.ap.left = 0;
  campaign.world.tiles.cordon.status = 'playing';
  assert.equal(step(campaign, { type: 'explore' }).events[0].reason, 'not-enough-ap');
});

test('après l’Émission, un lieu vidé reprend la moitié de ses cartes de butin (arrondie au-dessus)', () => {
  const place = placeWith([{ id: 'b', type: 'butin', count: 3 }, { id: 'r', type: 'rien' }]);
  let { campaign } = play(campaignWith(), [{ type: 'enter-place', place }, ...explores(4), { type: 'leave-place' }]);
  assert.equal(campaign.places[place].emptied, true);
  const draft = structuredClone(campaign);
  const events = [];
  refillPlaces(draft, { rng: createRng(1), emit: (e) => events.push(e) });
  assert.deepEqual(events, [{ type: 'place-refilled', place, cards: 2 }]);
  assert.deepEqual(draft.places[place].pool, ['b', 'b']);
  assert.equal(draft.places[place].emptied, false);
  const again = play(draft, [{ type: 'enter-place', place }, ...explores(2)]);
  assert.equal(ofType(again.events, 'loot-found').length, 2);
});

test('lieu occupé (§5.4) : refus sans approche, payer, se faufiler, combattre', () => {
  const place = placeWith([{ id: 'a', type: 'rien' }, { id: 'b', type: 'rien' }], { faction: 'militaires' });
  const hostile = { reputation: { militaires: -2 } };
  assert.equal(step(campaignWith(hostile), { type: 'enter-place', place }).events[0].reason, 'place-occupied');
  assert.equal(step(campaignWith(hostile), { type: 'enter-place', place, approach: 'voler' }).events[0].reason, 'bad-approach');
  assert.equal(step(campaignWith(hostile), { type: 'enter-place', place, approach: 'payer' }).events[0].reason, 'not-enough-roubles');

  const friends = step(campaignWith({ reputation: { militaires: 2 } }), { type: 'enter-place', place });
  assert.equal(friends.state.screen, 'place');

  const paid = play(campaignWith({ ...hostile, roubles: PLACE_FEE }), [{ type: 'enter-place', place, approach: 'payer' }, { type: 'explore' }]);
  assert.equal(paid.campaign.player.roubles, 0);
  assert.equal(ofType(paid.events, 'place-card').length, 1);

  const sneaky = play(campaignWith({ ...hostile, stats: { discretion: SURE } }), [
    { type: 'enter-place', place, approach: 'se-faufiler' }, ...explores(2),
  ]);
  assert.deepEqual(ofType(sneaky.events, 'check').map((e) => e.stat), ['discretion', 'discretion']);
  assert.equal(ofType(sneaky.events, 'place-card').length, 2);

  const spotted = play(campaignWith({ ...hostile, stats: { discretion: NEVER } }), [
    { type: 'enter-place', place, approach: 'se-faufiler' }, { type: 'explore' },
  ]);
  assert.equal(ofType(spotted.events, 'place-card').length, 0);
  assert.ok(dayState(spotted.campaign).combat);
  assert.equal(ofType(spotted.events, 'sneak-failed').length, 1);

  const assault = play(campaignWith({ ...hostile, stats: { tir: SURE }, combatMode: 'rapide' }), [{ type: 'enter-place', place, approach: 'combattre' }]);
  assert.ok(dayState(assault.campaign).combat);
  assert.equal(step(assault.campaign, { type: 'explore' }).events[0].reason, 'in-combat');
  const cleared = play(assault.campaign, [{ type: 'fight' }, { type: 'explore' }]);
  assert.equal(ofType(cleared.events, 'place-cleared').length, 1);
  assert.equal(cleared.campaign.places[place].cleared, true);
  assert.equal(ofType(cleared.events, 'place-card').length, 1);
});

test('lieu occupé, mode rounds : combattre ouvre un combat v2 ; la victoire vide le lieu, la fuite le quitte', () => {
  const place = placeWith([{ id: 'a', type: 'rien' }, { id: 'b', type: 'rien' }], { faction: 'militaires' });
  const hostile = { reputation: { militaires: -2 }, stats: { tir: SURE, discretion: SURE } };
  const assault = play(campaignWith(hostile), [{ type: 'enter-place', place, approach: 'combattre' }]);
  assert.equal(assault.campaign.screen, 'combat');
  assert.equal(assault.campaign.combat.previousScreen, 'place');
  assert.equal(step(assault.campaign, { type: 'explore' }).events[0].reason, 'in-combat');

  const cleared = play(assault.campaign, [...Array.from({ length: 4 }, () => ({ type: 'shoot' })), { type: 'explore' }]);
  assert.equal(ofType(cleared.events, 'place-cleared').length, 1);
  assert.equal(cleared.campaign.places[place].cleared, true);
  assert.equal(cleared.campaign.screen, 'place');
  assert.equal(ofType(cleared.events, 'place-card').length, 1);

  const fled = play(assault.campaign, [{ type: 'escape' }]);
  assert.equal(fled.campaign.place, undefined);
  assert.equal(fled.campaign.places[place].cleared, false);
});

test('effet de dialogue « reveler » { place } : le lieu est connu', () => {
  const place = placeWith([{ id: 'a', type: 'rien' }]);
  const draft = campaignWith();
  const events = [];
  assert.equal(EFFECTS.reveler(draft, { type: 'reveler', place }, { emit: (e) => events.push(e) }), undefined);
  assert.equal(draft.places[place].known, true);
  assert.deepEqual(events, [{ type: 'place-revealed', place }]);
  assert.equal(EFFECTS.reveler(draft, { type: 'reveler', place: 'nulle-part' }, { emit() {} }), 'unknown-place');
});

test('placeView : lecture pour l’écran Lieu', () => {
  const place = placeWith([{ id: 'a', type: 'rien' }, { id: 'b', type: 'rien' }]);
  const campaign = play(campaignWith(), [{ type: 'enter-place', place }, { type: 'explore' }]).campaign;
  const view = placeView(campaign);
  assert.equal(view.place, place);
  assert.equal(view.revealed.length, 1);
  assert.equal(view.remaining, 1);
  assert.equal(view.emptied, false);
  assert.equal(placeView(campaignWith()), null);
});

test('état sérialisable et rejeu identique', () => {
  const place = placeWith([{ id: 'b', type: 'butin', count: 2 }, { id: 'x', type: 'anomalie' }, { id: 'r', type: 'rien' }]);
  const actions = [{ type: 'enter-place', place }, ...explores(2), { type: 'leave-place' }, { type: 'enter-place', place }, { type: 'explore' }];
  const a = play(campaignWith(), actions);
  const b = play(JSON.parse(JSON.stringify(campaignWith())), actions);
  assert.deepEqual(a.events, b.events);
  assert.deepEqual(JSON.parse(JSON.stringify(a.campaign)), a.campaign);
});
