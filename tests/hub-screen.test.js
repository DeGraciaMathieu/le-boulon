import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createCampaign, step } from '../src/engine/campaign.js';
import content from '../src/content/index.js';
import { HUB_TABS, hubTabs, hubScreen, traderScreen, chestScreen, contractsScreen, barmanScreen } from '../src/ui/hub.js';

// La campagne part sur l'hexagone du Camp des novices (Cordon, hexagone 5).
function inCamp({ roubles = 0 } = {}) {
  const campaign = createCampaign({ seed: 3 });
  campaign.player.roubles = roubles;
  return step(campaign, { type: 'enter-hub' }).state;
}

const service = (campaign, extra) => step(campaign, { type: 'service', ...extra });

test('hors d’un hub : aucune lecture', () => {
  const campaign = createCampaign({ seed: 3 });
  assert.deepEqual(hubTabs(campaign), []);
  assert.equal(hubScreen(campaign), null);
  assert.equal(traderScreen(campaign), null);
  assert.equal(chestScreen(campaign), null);
  assert.equal(contractsScreen(campaign), null);
  assert.equal(barmanScreen(campaign), null);
});

test('onglets : ceux du §16 que le hub a, dans l’ordre du §16', () => {
  const campaign = inCamp();
  assert.deepEqual(hubTabs(campaign).map(({ id }) => id), ['marchand', 'coffre', 'contrats', 'dormir']);
  assert.ok(hubTabs(campaign).every(({ ready }) => ready));
  assert.deepEqual(HUB_TABS.map(({ label }) => label),
    ['Marchand', 'Barman', 'Médecin', 'Technicien', 'Coffre', 'Contrats', 'Dormir']);
});

test('onglets : un service sans handler moteur est marqué non prêt', () => {
  const campaign = inCamp();
  campaign.hub = { id: 'bar' };
  const tabs = Object.fromEntries(hubTabs(campaign).map((tab) => [tab.id, tab.ready]));
  assert.equal(tabs.barman, true);
  assert.equal(tabs.medecin, false);
  assert.equal(tabs.marchand, true);
  assert.equal(tabs.coffre, true);
});

test('écran hub : nom, faction, palier et prix du lit', () => {
  const screen = hubScreen(inCamp({ roubles: 30 }));
  assert.equal(screen.name, content.places['camp-novices'].name);
  assert.equal(screen.faction, 'solitaires');
  assert.equal(screen.factionName, 'Solitaires');
  assert.equal(typeof screen.standing, 'string');
  assert.equal(typeof screen.bed.price, 'number');
  assert.equal(screen.bed.affordable, 30 >= screen.bed.price);
});

test('marchand : stock plein, prix d’achat et de vente du moteur', () => {
  const campaign = inCamp({ roubles: 1000 });
  const screen = traderScreen(campaign);
  assert.equal(screen.trader, 'marchand-bunker');
  assert.equal(screen.name, 'Le Marchand du bunker');
  assert.equal(screen.line.line, 'premiere');
  assert.equal(screen.stock.length, content.traders['marchand-bunker'].stock.length);
  const bandage = screen.stock.find(({ item }) => item === 'bandage');
  assert.equal(bandage.quantity, 5);
  assert.equal(bandage.refusal, null);

  const bought = service(campaign, { service: 'marchand', op: 'buy', item: 'bandage' });
  const paid = bought.events.find(({ type }) => type === 'item-bought').price;
  assert.equal(paid, bandage.price);
  assert.equal(traderScreen(bought.state).stock.find(({ item }) => item === 'bandage').quantity, 4);

  const vodka = screen.inventory.find(({ kind }) => kind === 'vodka');
  const sold = service(campaign, { service: 'marchand', op: 'sell', item: 'vodka' });
  assert.equal(sold.events.find(({ type }) => type === 'item-sold').price, vodka.price);
});

test('marchand : refus prévus = refus du moteur', () => {
  const poor = inCamp({ roubles: 0 });
  const screen = traderScreen(poor);
  const bandage = screen.stock.find(({ item }) => item === 'bandage');
  assert.equal(bandage.refusal, 'not-enough-roubles');
  const refused = service(poor, { service: 'marchand', op: 'buy', item: 'bandage' });
  assert.equal(refused.events[0].reason, 'not-enough-roubles');

  const rich = inCamp({ roubles: 5000 });
  const grenade = traderScreen(rich).stock.find(({ item }) => item === 'grenade');
  assert.equal(grenade.rank, 'experimente');
  assert.equal(grenade.refusal, 'rank-required');
  assert.equal(service(rich, { service: 'marchand', op: 'buy', item: 'grenade' }).events[0].reason, 'rank-required');
});

test('marchand : hostile, tout est refusé des deux côtés', () => {
  const campaign = inCamp({ roubles: 5000 });
  campaign.reputation.solitaires = -3;
  const screen = traderScreen(campaign);
  assert.ok(screen.stock.every(({ price, refusal }) => price === null && refusal === 'hostile'));
  assert.ok(screen.inventory.every(({ refusal }) => refusal === 'hostile'));
});

test('marchand : objet de quête invendable, grille pleine refusée', () => {
  const campaign = inCamp({ roubles: 5000 });
  campaign.inventory.push({ kind: 'pda', size: 1 });
  const screen = traderScreen(campaign);
  assert.equal(screen.inventory.find(({ kind }) => kind === 'pda').refusal, 'not-for-sale');

  while (campaign.inventory.length < screen.slots.max) campaign.inventory.push({ kind: 'ration', size: 1 });
  const full = traderScreen(campaign);
  assert.equal(full.slots.used, full.slots.max);
  assert.equal(full.stock.find(({ item }) => item === 'bandage').refusal, 'inventory-full');
});

test('coffre : inventaire et coffre côte à côte, suivis des actions', () => {
  let campaign = inCamp();
  assert.deepEqual(chestScreen(campaign).chest, []);
  campaign = step(campaign, { type: 'chest-put', item: 'vodka' }).state;
  const screen = chestScreen(campaign);
  assert.deepEqual(screen.chest.map(({ kind, refusal }) => [kind, refusal]), [['vodka', null]]);
  assert.ok(!screen.inventory.some(({ kind }) => kind === 'vodka'));
});

test('coffre : absent d’un hub sans coffre', () => {
  const campaign = inCamp();
  campaign.hub = { id: 'base-ciel-pur' };
  assert.equal(chestScreen(campaign), null);
});

test('contrats : non tiré, puis 3 offres lues du tableau', () => {
  let campaign = inCamp();
  assert.deepEqual(contractsScreen(campaign), { drawn: false, offers: [] });
  campaign = service(campaign, { service: 'contrats' }).state;
  const screen = contractsScreen(campaign);
  assert.equal(screen.drawn, true);
  assert.equal(screen.offers.length, 3);
  for (const offer of screen.offers) {
    assert.equal(offer.tileName, content.tiles[offer.tile].name);
    assert.ok(offer.roubles > 0 && offer.xp > 0 && offer.deadline > 0);
    assert.equal(offer.daysLeft, 3);
  }
  const [first] = screen.offers;
  const accepted = service(campaign, { service: 'contrats', contract: first.id }).state;
  assert.equal(contractsScreen(accepted).offers.length, 2);
  assert.ok(accepted.quests[first.id]);
});

// Le Camp des novices n'a pas de barman : la campagne est posée au Bar de Rostok.
function inBar({ roubles = 0 } = {}) {
  const campaign = inCamp({ roubles });
  campaign.hub = { id: 'bar' };
  return campaign;
}

test('barman : absent d’un hub sans barman', () => {
  assert.equal(barmanScreen(inCamp()), null);
});

test('barman : offre tirée à la consultation, rumeurs sans contenu avec leur prix', () => {
  const campaign = inBar({ roubles: 150 });
  assert.deepEqual(barmanScreen(campaign), { name: 'Fedir', roubles: 150, forSale: [], known: [] });
  const browsed = service(campaign, { service: 'barman', op: 'browse' });
  const offered = browsed.events.find(({ type }) => type === 'rumors-offered').rumors;
  const screen = barmanScreen(browsed.state);
  assert.ok(screen.forSale.length > 0);
  assert.deepEqual(screen.forSale.map(({ index, type, price }) => ({ index, type, price })), offered);
  for (const rumor of screen.forSale) {
    assert.deepEqual(Object.keys(rumor), ['index', 'type', 'price', 'refusal']);
    assert.equal(rumor.refusal, 150 < rumor.price ? 'not-enough-roubles' : null);
  }
});

test('barman : refus prévu = refus du moteur', () => {
  const browsed = service(inBar({ roubles: 0 }), { service: 'barman', op: 'browse' }).state;
  const [rumor] = barmanScreen(browsed).forSale;
  assert.equal(rumor.refusal, 'not-enough-roubles');
  const refused = service(browsed, { service: 'barman', op: 'buy', index: rumor.index });
  assert.equal(refused.events[0].reason, 'not-enough-roubles');
});

test('barman : la rumeur achetée passe dans les connues, fraîche puis périmée', () => {
  const browsed = service(inBar({ roubles: 1000 }), { service: 'barman', op: 'browse' }).state;
  const [first, ...rest] = barmanScreen(browsed).forSale;
  const bought = service(browsed, { service: 'barman', op: 'buy', index: first.index });
  assert.equal(bought.events.find(({ type }) => type === 'rumor-bought').price, first.price);

  const screen = barmanScreen(bought.state);
  assert.equal(screen.roubles, 1000 - first.price);
  assert.equal(screen.forSale.length, rest.length);
  assert.equal(screen.known.length, 1);
  const [known] = screen.known;
  const rumor = bought.state.rumors.find((candidate) => candidate.known);
  assert.equal(known.type, first.type);
  assert.equal(known.tileName, content.tiles[rumor.tile].name);
  assert.equal(known.stale, false);
  if (known.type === 'planque') assert.equal(known.opened, false);

  rumor.stale = true;
  assert.equal(barmanScreen(bought.state).known[0].stale, true);
});

test('barman : une rumeur d’artefact rare dit l’objet et l’hexagone', () => {
  const campaign = inBar();
  campaign.rumors.push({ type: 'artefact', tile: 'cordon', hex: 7, item: 'meduse', day: 1, known: true });
  const [known] = barmanScreen(campaign).known;
  assert.equal(known.hex, 7);
  assert.equal(known.itemName, content.items.meduse.name);
  assert.equal(known.opened, null);
  assert.equal(known.expires, null);
});
