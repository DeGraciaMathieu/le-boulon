import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createCampaign, step } from '../src/engine/campaign.js';
import { HUB_SERVICES } from '../src/engine/rules/hubs.js';
import { DAY_HOOKS } from '../src/engine/rules/time.js';
import {
  RESTOCK_DAYS, traderOf, stockOf, buyPrice, sellPrice, traderLine, trade, restockTraders,
} from '../src/engine/rules/traders.js';
import { createItem } from '../src/engine/rules/sheet.js';
import { createRng } from '../src/engine/rng.js';
import content from '../src/content/index.js';
import { validateContent } from '../src/content/validate.js';

const jsonCopy = (value) => JSON.parse(JSON.stringify(value));
const types = (events) => events.map((event) => event.type);
const reason = (result) => result.events[0].reason;

const BUNKER = 'marchand-bunker';
const BAR = 'stas';

// Campagne dans un hub, avec des roubles.
function inHub(hubId = 'camp-novices', { roubles = 10000, seed = 1 } = {}) {
  const campaign = jsonCopy(createCampaign({ seed }));
  const { tile, hex } = content.places[hubId];
  campaign.world.currentTile = tile;
  campaign.world.tiles[tile] ??= structuredClone(campaign.world.tiles.cordon);
  campaign.world.hex = hex;
  campaign.player.roubles = roubles;
  return step(campaign, { type: 'enter-hub' }).state;
}

const service = (campaign, action) => step(campaign, { type: 'service', service: 'marchand', ...action });
const count = (campaign, kind) => campaign.inventory.filter((item) => item.kind === kind).length;

// Contenu (§6.2)

test('un marchand par hub qui offre le service, et le contenu reste valide', () => {
  for (const [id, place] of Object.entries(content.places)) {
    if (!place.services?.includes('marchand')) continue;
    assert.ok(traderOf(id), `marchand de ${id}`);
  }
  assert.deepEqual(validateContent(content), []);
  assert.ok(Object.isFrozen(content.traders[BUNKER].stock[0]));
});

test('spécialités : Ciel Pur vend des détecteurs, le Bar des armes, Liberté armures légères et consommables', () => {
  const sells = (id, category) => content.traders[id].stock.some(({ item }) => content.items[item].category === category);
  assert.ok(sells('lev-marchand', 'detecteur'));
  assert.ok(sells(BAR, 'arme-epaule'));
  assert.ok(sells('matvii', 'armure') && sells('matvii', 'soin'));
  assert.ok(content.traders[BUNKER].sell.artefact > 1, 'le bunker achète bien les artefacts');
});

// Prix (§6.2) : base × coefficient × réputation

test('prix d’achat : base × coefficient × modificateur de réputation', () => {
  const campaign = inHub('bar');
  const { coefficient } = content.traders[BAR];
  assert.equal(buyPrice(campaign, BAR, 'fusil-pompe'), Math.round(1200 * coefficient * 1));
  campaign.reputation.devoir = 2;
  assert.equal(buyPrice(campaign, BAR, 'fusil-pompe'), Math.round(1200 * coefficient * 0.9));
  campaign.reputation.devoir = 3;
  assert.equal(buyPrice(campaign, BAR, 'fusil-pompe'), Math.round(1200 * coefficient * 0.8));
  campaign.reputation.devoir = -2;
  assert.equal(buyPrice(campaign, BAR, 'fusil-pompe'), null);
});

test('prix de revente : modificateur de revente et coefficient de catégorie', () => {
  const campaign = inHub('camp-novices');
  // Solitaires amical au départ (§9) : revente × 0,6.
  const { coefficient, sell } = content.traders[BUNKER];
  assert.equal(sellPrice(campaign, BUNKER, createItem('meduse')), Math.round(400 * coefficient * sell.artefact * 0.6));
  assert.equal(sellPrice(campaign, BUNKER, createItem('bandage')), Math.round(50 * coefficient * 0.6));
  assert.equal(sellPrice(campaign, BUNKER, createItem('pda')), null, 'objet de quête invendable');
});

test('revente : une boîte entamée vaut sa part de charges', () => {
  const campaign = inHub('camp-novices');
  const full = sellPrice(campaign, BUNKER, createItem('munitions'));
  assert.equal(sellPrice(campaign, BUNKER, { kind: 'munitions', size: 1, charges: 3 }), Math.round(full / 2));
});

test('Marchandeur : un cran de réputation de plus, sans lever le refus d’un hostile', () => {
  const campaign = inHub('bar');
  campaign.player.perks = ['marchandeur'];
  const { coefficient } = content.traders[BAR];
  assert.equal(buyPrice(campaign, BAR, 'fusil-pompe'), Math.round(1200 * coefficient * 0.9));
  campaign.reputation.devoir = 3;
  assert.equal(buyPrice(campaign, BAR, 'fusil-pompe'), Math.round(1200 * coefficient * 0.8));
  campaign.reputation.devoir = -2;
  assert.equal(buyPrice(campaign, BAR, 'fusil-pompe'), null);
});

test('membre du Devoir : prix d’allié au Bar', () => {
  const campaign = inHub('bar');
  campaign.player.faction = 'devoir';
  assert.equal(buyPrice(campaign, BAR, 'fusil-pompe'), Math.round(1200 * content.traders[BAR].coefficient * 0.8));
});

// Acheter et vendre

test('acheter : roubles débités, objet dans l’inventaire, stock diminué, sans PA', () => {
  const campaign = inHub('camp-novices');
  const price = buyPrice(campaign, BUNKER, 'bandage');
  const before = stockOf(campaign, BUNKER).bandage;
  const { state, events } = service(campaign, { op: 'buy', item: 'bandage' });
  assert.equal(state.player.roubles, campaign.player.roubles - price);
  assert.equal(count(state, 'bandage'), count(campaign, 'bandage') + 1);
  assert.equal(state.traders[BUNKER].stock.bandage, before - 1);
  assert.equal(state.traders[BUNKER].restockDay, campaign.day + RESTOCK_DAYS);
  assert.deepEqual(events.at(-1), { type: 'item-bought', trader: BUNKER, item: 'bandage', price, roubles: state.player.roubles });
  assert.deepEqual(state.world.tiles.cordon.ap, campaign.world.tiles.cordon.ap);
  assert.equal(campaign.traders[BUNKER], undefined, 'la campagne reçue ne change pas');
});

test('acheter : refus hors stock, épuisé, sans roubles, inventaire plein', () => {
  const campaign = inHub('camp-novices');
  assert.equal(reason(service(campaign, { op: 'buy', item: 'exosquelette' })), 'not-in-stock');
  assert.equal(reason(service(inHub('camp-novices', { roubles: 10 }), { op: 'buy', item: 'bandage' })), 'not-enough-roubles');

  const soldOut = jsonCopy(campaign);
  soldOut.traders[BUNKER] = { stock: { ...stockOf(campaign, BUNKER), bandage: 0 }, restockDay: 4 };
  assert.equal(reason(service(soldOut, { op: 'buy', item: 'bandage' })), 'not-in-stock');

  const full = jsonCopy(campaign);
  while (full.inventory.reduce((n, item) => n + item.size, 0) < 12) full.inventory.push(createItem('boulons'));
  assert.equal(reason(service(full, { op: 'buy', item: 'bandage' })), 'inventory-full');
});

test('rang requis : pas de fusil d’assaut pour un Bleu', () => {
  const campaign = inHub('bar');
  assert.equal(reason(service(campaign, { op: 'buy', item: 'fusil-assaut' })), 'rank-required');
  campaign.player.rank = 'experimente';
  assert.deepEqual(types(service(campaign, { op: 'buy', item: 'fusil-assaut' }).events), ['roubles-changed', 'item-bought']);
});

test('vendre : roubles crédités, objet retiré de l’inventaire', () => {
  const campaign = inHub('camp-novices');
  campaign.inventory.push(createItem('meduse'));
  const price = sellPrice(campaign, BUNKER, createItem('meduse'));
  const { state, events } = service(campaign, { op: 'sell', item: 'meduse' });
  assert.equal(state.player.roubles, campaign.player.roubles + price);
  assert.equal(count(state, 'meduse'), 0);
  assert.deepEqual(events.at(-1), { type: 'item-sold', trader: BUNKER, item: 'meduse', price, roubles: state.player.roubles });
});

test('vendre : refus sans l’objet ou pour un objet de quête', () => {
  const campaign = inHub('camp-novices');
  assert.equal(reason(service(campaign, { op: 'sell', item: 'meduse' })), 'no-item');
  campaign.inventory.push(createItem('pda'));
  assert.equal(reason(service(campaign, { op: 'sell', item: 'pda' })), 'not-for-sale');
});

test('hostile : refus d’acheter et de vendre (§6.2)', () => {
  const campaign = inHub('bar');
  campaign.reputation.devoir = -3;
  campaign.inventory.push(createItem('meduse'));
  assert.equal(reason(service(campaign, { op: 'buy', item: 'fusil-pompe' })), 'hostile');
  assert.equal(reason(service(campaign, { op: 'sell', item: 'meduse' })), 'hostile');
});

test('opération inconnue refusée', () => {
  assert.equal(reason(service(inHub(), { op: 'voler' })), 'unknown-op');
});

// Répliques (§6.2)

test('répliques : première visite, puis quête en cours, puis réputation', () => {
  const campaign = inHub('camp-novices');
  assert.deepEqual(traderLine(campaign, BUNKER), { line: 'premiere', text: content.traders[BUNKER].lines.premiere });
  const { state, events } = service(campaign, { op: 'browse' });
  assert.deepEqual(events, [{ type: 'trader-greeted', trader: BUNKER, line: 'premiere', text: content.traders[BUNKER].lines.premiere }]);
  assert.equal(traderLine(state, BUNKER).line, 'amical');
  state.quests.test = { status: 'active' };
  assert.equal(traderLine(state, BUNKER).line, 'quete');
  state.reputation.solitaires = -2;
  assert.equal(traderLine(state, BUNKER).line, 'hostile', 'un hostile ne parle que de son refus');
});

// Renouvellement (§6.2) : tous les 3 jours

test('restock : le stock revient au contenu tous les 3 jours', () => {
  const bought = service(inHub('camp-novices'), { op: 'buy', item: 'bandage' }).state;
  const base = content.traders[BUNKER].stock.find(({ item }) => item === 'bandage').quantity;
  const draft = jsonCopy(bought);
  const events = [];
  const ctx = { rng: createRng(1), emit: (event) => events.push(event) };

  draft.day += RESTOCK_DAYS - 1;
  restockTraders(draft, ctx);
  assert.equal(draft.traders[BUNKER].stock.bandage, base - 1);
  assert.deepEqual(events, []);

  draft.day += 1;
  restockTraders(draft, ctx);
  assert.equal(draft.traders[BUNKER].stock.bandage, base);
  assert.equal(draft.traders[BUNKER].restockDay, draft.day + RESTOCK_DAYS);
  assert.deepEqual(events, [{ type: 'trader-restocked', trader: BUNKER }]);
});

test('restock branché sur le nouveau jour (DAY_HOOKS.traders)', () => {
  assert.ok(DAY_HOOKS.traders.includes(restockTraders));
  const bought = jsonCopy(service(inHub('camp-novices'), { op: 'buy', item: 'bandage' }).state);
  bought.traders[BUNKER].restockDay = bought.day + 1;
  const asleep = step(bought, { type: 'sleep' }).state;
  const { state, events } = step(asleep, { type: 'wake' });
  assert.equal(state.traders[BUNKER].stock.bandage, stockOf(inHub(), BUNKER).bandage);
  assert.ok(types(events).includes('trader-restocked'));
});

test('branché sur le service marchand des hubs ; l’état reste du JSON', () => {
  assert.equal(HUB_SERVICES.marchand, trade);
  const { state } = service(inHub('base-liberte'), { op: 'buy', item: 'bandage' });
  assert.deepEqual(jsonCopy(state), state);
  assert.equal(state.traders.matvii.stock.bandage, stockOf(inHub('base-liberte'), 'matvii').bandage - 1);
});
