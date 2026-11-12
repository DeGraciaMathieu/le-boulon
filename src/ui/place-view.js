// Écran Lieu (brief v2 §5, §16 ; carte 25) et lieux cliquables sur la tuile. Lecture seule,
// comme board.js : les lectures viennent de place.js, les boutons envoient des actions par
// dispatch (enter-place, explore, bolt-card, leave-place de rules/places.js).
//
// ÉCRAN (section #lieu, à la place du plateau quand campaign.screen = 'place') :
//   illustration  portion de l'image de la tuile autour du lieu, agrandie (placeCrop) ;
//   paquet        dos de carte et nombre de cartes restantes, « vidé » à la fin ;
//   pile          cartes révélées, la dernière en haut, chacune avec son résultat (butin,
//                 test, quête, combat) accumulé par cardOutcomes depuis les événements ;
//   boutons       Explorer (1 PA), Boulon (1 PA), Quitter. Un combat dans le lieu se joue
//                 par les commandes du panneau (Combattre / Fuir).

import { el } from './board.js';
import { hexCenter } from './geometry.js';
import { cardOutcomes, NO_OUTCOMES, placeCrop, placeScreen, tilePlaces } from './place.js';

// Résultats des cartes jouées, gardés avec les sauvegardes (storage.js) : le moteur ne les garde
// pas ; events déjà lus : même tableau.
let outcomes = NO_OUTCOMES;
let readEvents = null;

function absorb(events) {
  if (events === readEvents) return;
  outcomes = cardOutcomes(outcomes, events);
  readEvents = events;
}

// Résultats à sauvegarder, events de la dernière action compris.
export function placeOutcomes(events = []) {
  absorb(events);
  return outcomes;
}

// Chargement d'une sauvegarde (saved : ceux de placeOutcomes) ou nouvelle partie (rien).
export function restorePlaceOutcomes(saved) {
  outcomes = saved?.cards && typeof saved.cards === 'object' ? { cards: saved.cards, combat: saved.combat ?? null } : NO_OUTCOMES;
  readEvents = null;
}

function h(tag, attrs = {}, ...children) {
  const node = Object.assign(document.createElement(tag), attrs);
  node.append(...children.filter((child) => child !== null && child !== undefined));
  return node;
}

// tile : content.tiles[id] ; size : { width, height } de son image ; events : ceux de la
// dernière action.
export function renderPlace(section, campaign, { tile, size, dispatch, events = [] }) {
  absorb(events);
  const screen = placeScreen(campaign, outcomes);
  if (!screen) {
    section.replaceChildren();
    return;
  }
  const button = (label, action, enabled) => h('button', {
    type: 'button', textContent: label, disabled: !enabled, onclick: () => dispatch(action),
  });
  const status = [screen.faction && `Tenu par : ${screen.faction}`, screen.approach && `Approche : ${screen.approach}`]
    .filter(Boolean).join(' · ');

  section.replaceChildren(
    h('header', { className: 'lieu-titre' },
      h('h2', { textContent: screen.name }),
      status ? h('div', { className: 'aide', textContent: status }) : null),
    illustration(screen.hex, tile, size),
    h('div', { className: 'lieu-table' }, deck(screen), pile(screen.cards)),
    h('div', { className: 'lieu-boutons' },
      button(screen.explore.cost ? `Explorer (${screen.explore.cost} PA)` : 'Explorer (gratuit, Fouilleur)', { type: 'explore' }, screen.explore.enabled),
      button(`Boulon (1 PA, ${screen.bolt.bolts} en poche)`, { type: 'bolt-card' }, screen.bolt.enabled),
      button('Quitter', { type: 'leave-place' }, screen.leave.enabled),
      screen.combat ? h('div', { className: 'alerte', textContent: 'Combat en cours : voir les commandes' }) : null),
  );
}

// Lieux explorables de la tuile : hexagone marqué, nom sous le centre.
export function renderPlaceMarks(board, campaign) {
  const { calage } = board;
  const places = tilePlaces(campaign);
  for (const polygon of board.grid.children) {
    polygon.classList.toggle('lieu', places.some((entry) => entry.hex === Number(polygon.dataset.hex)));
  }
  for (const place of places) {
    const { x, y } = hexCenter(place.hex, calage);
    const classes = ['lieu-nom', place.occupied && 'occupe', place.emptied && 'vide'].filter(Boolean).join(' ');
    const text = el('text', { class: classes, x, y: y + calage.taille * 0.55, 'text-anchor': 'middle' }, board.marks);
    text.textContent = place.name;
  }
}

function illustration(hex, tile, size) {
  const crop = placeCrop(hex, tile.calage, size);
  const svg = el('svg', { class: 'lieu-image', viewBox: `${crop.x} ${crop.y} ${crop.width} ${crop.height}` });
  el('image', { href: tile.image, width: size.width, height: size.height }, svg);
  return svg;
}

function deck(screen) {
  const back = h('div', { className: `carte dos${screen.remaining ? '' : ' epuise'}` },
    h('div', { className: 'carte-type', textContent: screen.remaining ? 'Paquet' : 'Vidé' }),
    h('div', { className: 'carte-texte', textContent: `${screen.remaining} carte(s)` }));
  return h('div', { className: 'lieu-paquet' }, back);
}

function pile(cards) {
  if (cards.length === 0) return h('ol', { className: 'lieu-pile' }, h('li', { className: 'aide', textContent: 'Aucune carte révélée' }));
  const items = [...cards].reverse().map((card) => h('li', { className: `carte ${card.type}${card.zone === 'inner' ? ' interieur' : ''}` },
    h('div', { className: 'carte-type', textContent: `${card.zone === 'inner' ? 'Intérieur ' : ''}${card.position} · ${card.label}` }),
    card.detail ? h('div', { className: 'carte-detail', textContent: card.detail }) : null,
    card.text ? h('div', { className: 'carte-texte', textContent: card.text }) : null,
    card.outcome.length ? h('ul', { className: 'carte-resultat' },
      ...card.outcome.map(({ text, tone }) => h('li', { className: tone, textContent: text }))) : null));
  return h('ol', { className: 'lieu-pile' }, ...items);
}
