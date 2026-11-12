// Écran Hub et écran Marchand (brief v2 §16, §6 ; carte 26), en HTML. Lit la campagne par les
// lectures pures de hub.js et n'agit que par dispatch(action) : rien ici ne modifie la campagne.
//
// ONGLETS : ceux du §16 que le hub a (hubTabs). Un service que le moteur n'a pas encore
// branché (médecin, technicien) reste visible et grisé.
//   Marchand    inventaire et stock côte à côte ; glisser un objet d'une grille à l'autre, ou
//               double-clic, pour vendre { service 'marchand', op 'sell' } ou acheter (op 'buy').
//               Ouvrir l'onglet envoie op 'browse' (réplique du marchand, 0 PA).
//   Barman      rumeurs à vendre (type et prix, sans le contenu) et rumeurs connues, fraîches
//               ou périmées. Ouvrir l'onglet envoie { service 'barman', op 'browse' } (le barman
//               complète son offre, 0 PA) ; Acheter envoie op 'buy' avec l'index de la rumeur.
//   Coffre      inventaire et coffre côte à côte, mêmes gestes : chest-put / chest-take.
//   Contrats    le tableau est tiré à la première consultation ({ service 'contrats' }) ;
//               Accepter envoie { service 'contrats', contract }.
//   Dormir      { type: 'sleep' } ; la nuit et le réveil restent à campagne.js.
//
// API :
//   renderHub(section, campaign, { dispatch, refresh })   dessine l'écran hub dans section ;
//     refresh() redessine sans action (changement d'onglet)
//   HUB_LINES   { [type d'événement]: (event) -> ligne de journal }
//   HUB_REFUSALS { [raison]: texte }

import content from '../content/index.js';
import { hubScreen, traderScreen, chestScreen, contractsScreen, barmanScreen, RANK_NAMES } from './hub.js';

const itemName = (kind) => content.items[kind]?.name ?? kind;
const hubName = (id) => content.places[id]?.name ?? id;
const traderName = (id) => content.npcs[content.traders[id]?.npc]?.name ?? id;

const tileName = (id) => content.tiles[id]?.name ?? id;

const RUMOR_NAMES = { planque: 'Planque', artefact: 'Artefact rare', raccourci: 'Raccourci', patrouille: 'Patrouille' };

const STANDING_NAMES = { hostile: 'hostile', neutre: 'neutre', amical: 'amical', allie: 'allié' };

export const HUB_REFUSALS = {
  'in-hub': 'impossible dans un hub',
  'not-in-hub': 'hors d’un hub',
  'no-hub': 'pas de hub ici',
  hostile: 'le marchand refuse de traiter avec vous',
  'not-in-stock': 'plus en stock',
  'rank-required': 'rang insuffisant',
  'not-enough-roubles': 'pas assez de roubles',
  'inventory-full': 'inventaire plein',
  'no-item': 'objet absent',
  'not-for-sale': 'ne se vend pas',
  'not-in-chest': 'absent du coffre',
  'no-chest': 'pas de coffre ici',
  'no-service': 'service absent de ce hub',
  'service-unavailable': 'service pas encore branché',
  'unknown-contract': 'contrat retiré du tableau',
  'no-rumor': 'rumeur plus en vente',
};

export const HUB_LINES = {
  'hub-entered': (e) => `Entrée : ${hubName(e.hub)} (zone sûre, 0 PA)`,
  'hub-left': (e) => `Sortie : ${hubName(e.hub)}`,
  'chest-stored': (e) => `Coffre : ${itemName(e.item)} rangé`,
  'chest-taken': (e) => `Coffre : ${itemName(e.item)} repris`,
  'trader-greeted': (e) => `${traderName(e.trader)} : « ${e.text} »`,
  'item-bought': (e) => `Achat : ${itemName(e.item)} pour ${e.price} ₽ (reste ${e.roubles} ₽)`,
  'item-sold': (e) => `Vente : ${itemName(e.item)} pour ${e.price} ₽ (total ${e.roubles} ₽)`,
  'roubles-changed': (e) => `Roubles : ${e.amount > 0 ? '+' : ''}${e.amount} (${e.roubles} ₽)`,
  'trader-restocked': (e) => `${traderName(e.trader)} : stock renouvelé`,
  'contracts-board': (e) => `Tableau des contrats : ${e.contracts.length} offre(s)`,
  'contract-accepted': () => 'Contrat accepté',
  'contracts-renewed': () => 'Les tableaux des contrats sont renouvelés',
  'rumors-offered': (e) => `Barman : ${e.rumors.length} rumeur(s) à vendre`,
  'rumor-bought': (e) => `Rumeur achetée : ${rumorText(e.rumor)} pour ${e.price} ₽`,
  'stash-revealed': () => 'Planque marquée sur la carte',
  'rumor-aged': (e) => `Rumeur périmée par l’Émission : ${rumorText(e.rumor)}`,
  'stash-gone': () => 'Une planque de rumeur a été vidée par l’Émission',
  'contract-failed': (e) => `Contrat raté (réputation : ${content.factions[e.faction]?.name ?? e.faction})`,
};

let currentTab = null;

function h(tag, attrs = {}, ...children) {
  const node = Object.assign(document.createElement(tag), attrs);
  node.append(...children.filter((child) => child !== null && child !== undefined));
  return node;
}

export function renderHub(section, campaign, { dispatch, refresh }) {
  const screen = hubScreen(campaign);
  if (!screen.tabs.some(({ id }) => id === currentTab)) currentTab = screen.tabs[0]?.id ?? null;

  const header = h('header', { className: 'hub-tete' },
    h('h2', { textContent: screen.name }),
    h('span', { className: 'hub-faction', textContent: `${screen.factionName} · ${STANDING_NAMES[screen.standing]}` }),
    h('span', { className: 'hub-surete', textContent: 'Zone sûre · aucune action ne coûte de PA' }),
    h('button', { type: 'button', className: 'hub-quitter', textContent: 'Quitter le hub', onclick: () => dispatch({ type: 'leave-hub' }) }));

  const tabs = h('nav', { className: 'hub-onglets' }, ...screen.tabs.map((tab) => h('button', {
    type: 'button',
    textContent: tab.label,
    className: tab.id === currentTab ? 'actif' : '',
    disabled: !tab.ready,
    title: tab.ready ? '' : HUB_REFUSALS['service-unavailable'],
    onclick: () => openTab(tab.id, campaign, { dispatch, refresh }),
  })));

  section.replaceChildren(header, tabs, h('div', { className: 'hub-contenu' }, ...TAB_BODIES[currentTab](campaign, dispatch, screen)));
}

// Ouvrir un onglet : le marchand salue, le tableau des contrats se tire à la première consultation.
function openTab(id, campaign, { dispatch, refresh }) {
  currentTab = id;
  if (id === 'marchand') dispatch({ type: 'service', service: 'marchand', op: 'browse' });
  else if (id === 'barman') dispatch({ type: 'service', service: 'barman', op: 'browse' });
  else if (id === 'contrats' && !contractsScreen(campaign).drawn) dispatch({ type: 'service', service: 'contrats' });
  else refresh();
}

const TAB_BODIES = {
  marchand: traderBody,
  barman: barmanBody,
  coffre: chestBody,
  contrats: contractsBody,
  dormir: bedBody,
};

function traderBody(campaign, dispatch) {
  const trader = traderScreen(campaign);
  const sell = (item) => dispatch({ type: 'service', service: 'marchand', op: 'sell', item: item.kind });
  const buy = (offer) => dispatch({ type: 'service', service: 'marchand', op: 'buy', item: offer.item });
  return [
    h('p', { className: 'hub-replique' }, h('strong', { textContent: `${trader.name} : ` }), `« ${trader.line.text} »`),
    h('div', { className: 'hub-grilles' },
      grid({
        title: `Inventaire · ${trader.slots.used}/${trader.slots.max} cases · ${trader.roubles} ₽`,
        side: 'inventaire',
        cells: trader.inventory.map((item) => ({
          key: item.kind, name: item.name, size: item.size, charges: item.charges, refusal: item.refusal,
          price: item.price === null ? null : `vend ${item.price} ₽`, act: () => sell(item),
        })),
        capacity: trader.slots.max,
        accepts: 'stock',
      }),
      grid({
        title: 'Stock du marchand',
        side: 'stock',
        cells: trader.stock.map((offer) => ({
          key: offer.item, name: offer.name, size: offer.size, quantity: offer.quantity, refusal: offer.refusal,
          price: offer.price === null ? null : `${offer.price} ₽`,
          note: offer.rank ? `rang ${RANK_NAMES[offer.rank]}` : null, act: () => buy(offer),
        })),
        accepts: 'inventaire',
      })),
    h('div', { className: 'aide', textContent: 'Glisser un objet vers l’autre grille (ou double-clic) : vendre ou acheter' }),
  ];
}

function barmanBody(campaign, dispatch) {
  const bar = barmanScreen(campaign);
  const forSale = bar.forSale.length
    ? h('ul', { className: 'hub-contrats' }, ...bar.forSale.map((rumor) => h('li', { className: 'hub-contrat' },
      h('strong', { textContent: `Rumeur : ${RUMOR_NAMES[rumor.type]}` }),
      h('span', { className: 'objet-prix', textContent: `${rumor.price} ₽` }),
      h('button', {
        type: 'button',
        textContent: 'Acheter',
        disabled: Boolean(rumor.refusal),
        title: rumor.refusal ? HUB_REFUSALS[rumor.refusal] : '',
        onclick: () => dispatch({ type: 'service', service: 'barman', op: 'buy', index: rumor.index }),
      }))))
    : h('p', { className: 'aide', textContent: 'Rien à vendre pour l’instant.' });
  const known = bar.known.length
    ? h('ul', { className: 'hub-contrats' }, ...bar.known.map((rumor) => h('li', { className: `hub-contrat${rumor.stale ? ' perimee' : ''}` },
      h('strong', { textContent: `${RUMOR_NAMES[rumor.type]} · ${rumor.tileName}` }),
      h('span', { textContent: rumorText(rumor) }),
      h('span', { className: 'objet-info', textContent: rumorAge(rumor) }))))
    : h('p', { className: 'aide', textContent: 'Aucune rumeur connue.' });
  return [
    h('p', { className: 'hub-replique' }, h('strong', { textContent: bar.name }), ', barman'),
    h('div', { className: 'hub-grilles' },
      h('section', { className: 'hub-zone' }, h('h3', { textContent: `Rumeurs à vendre · ${bar.roubles} ₽` }), forSale),
      h('section', { className: 'hub-zone' }, h('h3', { textContent: 'Rumeurs connues' }), known)),
    h('div', { className: 'aide', textContent: 'Une rumeur devient fausse après la prochaine Émission.' }),
  ];
}

// Contenu d'une rumeur connue (§10.3), lu d'une lecture barmanScreen ou d'un événement du moteur.
function rumorText(rumor) {
  const where = tileName(rumor.tile);
  if (rumor.type === 'planque') return `planque à ${where}, hexagone ${rumor.hex}${rumor.opened ? ' (fouillée)' : ''}`;
  if (rumor.type === 'artefact') return `${itemName(rumor.item)} à ${where}, hexagone ${rumor.hex}`;
  if (rumor.type === 'raccourci') return `raccourci à ${where} : ${rumor.path.join(' → ')}`;
  return `patrouille à ${where}, hexagone ${rumor.hex}`;
}

function rumorAge(rumor) {
  if (rumor.stale) return 'Périmée : une Émission est passée';
  if (rumor.expires === null) return `Fraîche (jour ${rumor.day})`;
  return `Fraîche jusqu’à l’Émission du jour ${rumor.expires}`;
}

function chestBody(campaign, dispatch) {
  const chest = chestScreen(campaign);
  return [
    h('div', { className: 'hub-grilles' },
      grid({
        title: `Inventaire · ${chest.slots.used}/${chest.slots.max} cases`,
        side: 'inventaire',
        cells: chest.inventory.map((item) => ({ key: item.kind, ...item, act: () => dispatch({ type: 'chest-put', item: item.kind }) })),
        capacity: chest.slots.max,
        accepts: 'stock',
      }),
      grid({
        title: 'Coffre',
        side: 'stock',
        cells: chest.chest.map((item) => ({ key: item.kind, ...item, act: () => dispatch({ type: 'chest-take', item: item.kind }) })),
        accepts: 'inventaire',
      })),
    h('div', { className: 'aide', textContent: 'Glisser un objet vers l’autre grille (ou double-clic) : ranger ou reprendre' }),
  ];
}

function contractsBody(campaign, dispatch) {
  const board = contractsScreen(campaign);
  if (!board.drawn) {
    return [h('button', { type: 'button', textContent: 'Consulter le tableau', onclick: () => dispatch({ type: 'service', service: 'contrats' }) })];
  }
  if (!board.offers.length) return [h('p', { className: 'aide', textContent: 'Aucune offre pour l’instant.' })];
  return [h('ul', { className: 'hub-contrats' }, ...board.offers.map((offer) => h('li', { className: 'hub-contrat' },
    h('strong', { textContent: offer.name }),
    h('span', { textContent: `Récompense : ${offer.roubles} ₽ · ${offer.xp} XP` }),
    h('span', { textContent: `Délai : ${offer.deadline} jour(s) · offre affichée encore ${offer.daysLeft} jour(s)` }),
    h('button', {
      type: 'button',
      textContent: 'Accepter',
      disabled: Boolean(offer.refusal),
      title: offer.refusal ? HUB_REFUSALS[offer.refusal] : '',
      onclick: () => dispatch({ type: 'service', service: 'contrats', contract: offer.id }),
    }))))];
}

function bedBody(campaign, dispatch, screen) {
  const { price, affordable } = screen.bed;
  return [
    h('p', { textContent: price === 0 ? 'Lit offert par la faction.' : `Lit : ${price} ₽ la nuit.` }),
    h('p', { className: 'aide', textContent: 'Dormir finit la journée : −1 blessure, réveil dans le hub.' }),
    h('button', {
      type: 'button',
      textContent: 'Dormir',
      disabled: !affordable,
      title: affordable ? '' : HUB_REFUSALS['not-enough-roubles'],
      onclick: () => dispatch({ type: 'sleep' }),
    }),
  ];
}

// Grille d'objets ; accepts : côté dont on peut y déposer un objet par glisser-déposer.
function grid({ title, side, cells, capacity, accepts }) {
  const body = h('div', { className: 'hub-grille' });
  for (const [index, cell] of cells.entries()) body.append(itemCell(cell, side, index));
  const empty = (capacity ?? 0) - cells.reduce((total, { size }) => total + size, 0);
  for (let i = 0; i < empty; i += 1) body.append(h('div', { className: 'objet vide' }));

  const zone = h('section', { className: `hub-zone hub-${side}` }, h('h3', { textContent: title }), body);
  zone.addEventListener('dragover', (event) => {
    if (dragged?.side === accepts) event.preventDefault();
  });
  zone.addEventListener('drop', (event) => {
    event.preventDefault();
    if (dragged?.side === accepts) dragged.act();
  });
  return zone;
}

let dragged = null;

function itemCell(cell, side, index) {
  const usable = !cell.refusal;
  const node = h('div', {
    className: `objet${usable ? '' : ' refuse'}`,
    draggable: usable,
    title: cell.refusal ? HUB_REFUSALS[cell.refusal] ?? cell.refusal : '',
    ondblclick: () => usable && cell.act(),
    ondragstart: (event) => {
      dragged = { side, act: cell.act };
      event.dataTransfer.setData('text/plain', `${side}:${index}`);
    },
    ondragend: () => { dragged = null; },
  },
  h('span', { className: 'objet-nom', textContent: cell.name }),
  cell.charges !== null && cell.charges !== undefined ? h('span', { className: 'objet-info', textContent: `${cell.charges} ch.` }) : null,
  cell.quantity !== undefined ? h('span', { className: 'objet-info', textContent: `×${cell.quantity}` }) : null,
  cell.price ? h('span', { className: 'objet-prix', textContent: cell.price }) : null,
  cell.note ? h('span', { className: 'objet-info', textContent: cell.note }) : null);
  node.style.gridColumn = `span ${cell.size}`;
  node.dataset.kind = cell.key;
  return node;
}
