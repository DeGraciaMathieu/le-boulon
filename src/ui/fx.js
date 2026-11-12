// Retours visuels des moments clés, lus dans les événements du moteur après chaque rendu.
// Lecture seule : ce module ne touche jamais l'état. Les animations vivent dans board.css.
//
// ÉVÉNEMENTS SUIVIS :
//   bolt-thrown        trajectoire du pion vers l'hexagone visé, impulsion à l'impact
//   token-revealed     retournement du jeton (après l'impact si révélé au boulon)
//   anomaly-triggered  flash et secousse de l'hexagone, couleur par type d'anomalie
//   zone-card          la carte piochée apparaît brièvement avec son nom
//   emission-*         annonce, compte à rebours relancé à chaque PA, sortie à l'abri
//
// AMBIANCE D'ÉMISSION (renderEmission, à chaque rendu) : tant que state.zone.emission est
// posé et la partie en cours, <body> porte la classe en-emission (teinte, vignette, pulsation)
// et le bandeau affiche les PA restants. Les abris sont marqués par board.js.
//
// Toutes les traces ont pointer-events: none et disparaissent après TRACE_MS, animées ou
// non (prefers-reduced-motion coupe les animations dans board.css).

import { hexCenter, hexPoints } from './geometry.js';
import { ZONE_CARD_NAMES } from './journal.js';

const SVG_NS = 'http://www.w3.org/2000/svg';
const TRACE_MS = 1000;
const NOTICE_MS = 1400;

const card = document.getElementById('carte-zone');
const banner = document.getElementById('emission');
const bannerCount = document.getElementById('emission-pa');
const bannerText = document.getElementById('emission-texte');
let noticeTimer;
let cardTimer;

function trace(board, name, attrs) {
  const node = document.createElementNS(SVG_NS, name);
  for (const [attr, value] of Object.entries(attrs)) node.setAttribute(attr, value);
  board.fx.append(node);
  setTimeout(() => node.remove(), TRACE_MS);
  return node;
}

// Relance une animation CSS déjà jouée sur le même élément.
function replay(node, cls) {
  node.classList.remove(cls);
  void node.getBoundingClientRect();
  node.classList.add(cls);
}

function boltThrown(board, state, { target }) {
  const from = hexCenter(state.player.hex, board.calage);
  const to = hexCenter(target, board.calage);
  trace(board, 'line', { class: 'fx-trajet', x1: from.x, y1: from.y, x2: to.x, y2: to.y });
  trace(board, 'circle', { class: 'fx-impact', cx: to.x, cy: to.y, r: board.calage.taille * 0.8 });
}

function tokenRevealed(board, { hex, by }) {
  const token = board.tokens.querySelector(`.suspect[data-hex="${hex}"]`);
  if (!token) return;
  token.classList.toggle('apres-boulon', by === 'bolt');
  replay(token, 'retourne');
}

function anomalyTriggered(board, { hex, anomaly }) {
  trace(board, 'polygon', { class: `fx-anomalie ${anomaly}`, points: hexPoints(hex, board.calage) });
}

function zoneCard({ card: id }) {
  card.textContent = '';
  card.append(
    Object.assign(document.createElement('small'), { textContent: 'Carte Zone' }),
    Object.assign(document.createElement('strong'), { textContent: ZONE_CARD_NAMES[id] ?? id }),
  );
  card.classList.toggle('emission', id === 'emission');
  card.hidden = false;
  replay(card, 'apparait');
  clearTimeout(cardTimer);
  cardTimer = setTimeout(() => { card.hidden = true; }, TRACE_MS);
}

function emissionNotice(text) {
  banner.hidden = false;
  banner.classList.add('passee');
  bannerCount.textContent = '';
  bannerText.textContent = text;
  clearTimeout(noticeTimer);
  noticeTimer = setTimeout(() => {
    banner.classList.remove('passee');
    banner.hidden = !document.body.classList.contains('en-emission');
  }, NOTICE_MS);
}

export function playEffects(board, events, state) {
  for (const event of events) {
    if (event.type === 'bolt-thrown') boltThrown(board, state, event);
    else if (event.type === 'token-revealed') tokenRevealed(board, event);
    else if (event.type === 'anomaly-triggered') anomalyTriggered(board, event);
    else if (event.type === 'zone-card') zoneCard(event);
    else if (event.type === 'emission-started') replay(banner, 'annonce');
    else if (event.type === 'emission-countdown') replay(bannerCount, 'tic');
    else if (event.type === 'emission-survived') emissionNotice("Émission passée · à l'abri");
  }
}

export function renderEmission(state) {
  const emission = state.status === 'playing' ? state.zone?.emission : null;
  document.body.classList.toggle('en-emission', Boolean(emission));
  if (banner.classList.contains('passee')) return;
  banner.hidden = !emission;
  if (!emission) return;
  bannerCount.textContent = emission.left;
  bannerText.textContent = 'PA pour rejoindre un abri';
}

// Nouvelle partie : efface les traces et annonces restées de la précédente.
export function resetEffects(board) {
  board.fx.replaceChildren();
  clearTimeout(noticeTimer);
  clearTimeout(cardTimer);
  banner.classList.remove('passee');
  card.hidden = true;
}
