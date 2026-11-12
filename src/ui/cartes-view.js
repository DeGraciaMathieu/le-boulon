// Cartes physiques (direction plateau, lot L5) : paquets, cartes qui sortent, se retournent et
// rejoignent une pile. Les données viennent de cartes.js (pures) ; le style de cartes.css.
// Lecture seule : ne touche jamais la campagne.
//
//   paquet Zone   posé sur la table dans le coin bas droit du plateau (#paquet-zone, même
//                 grid-area que #plateau, sans changer la grille) : paquet, cartes restantes,
//                 défausse avec la dernière carte tirée ; visible sur la tuile seulement
//   carte de mission  l'encart Objectif (renderMission) ; garde l'étape affichée avant le step
//                 pour la tamponner quand la quête avance
//
// SÉQUENCEUR : les pas de BEATS (cardBeats de cartes.js) s'enregistrent ici. L'état final est
// déjà dessiné : chaque animation part de l'ancien état et revient à l'état dessiné.
//   A8 zone      la carte sort du paquet, se retourne, montre son effet, rejoint la défausse
//   A8 lieu      la carte du dessus de la pile du lieu sort du paquet et se retourne en place
//   A8 aperçu    (boulon) la carte est montrée près du paquet du lieu puis y retourne
//   réveil       Nuit et Météo posées face cachée pendant le fondu du réveil, puis retournées
//   A13 mission  l'ancienne étape est tamponnée « ✓ », puis la nouvelle s'écrit
//   A12 ennemi   les pastilles de PV perdues s'éteignent ; abattu : la carte se retourne
// Mode réduit : fondu de la carte concernée. Accélérer : les animations vont à leur fin et les
// cartes volantes disparaissent.

import { BEATS, zoneDeck, nextDiscard } from './cartes.js';
import { ZONE_CARD_NAMES } from './journal.js';
import { fade } from './sequencer.js';

const MS = { zone: 1100, place: 700, peek: 1000, wake: 700, mission: 700, enemy: 400 };
const FLIP_MS = 220;

function h(tag, attrs = {}, ...children) {
  const node = Object.assign(document.createElement(tag), attrs);
  node.append(...children.filter((child) => child !== null && child !== undefined && child !== false));
  return node;
}

const rect = (node) => node.getBoundingClientRect();
const finished = (animation) => animation?.finished.catch(() => {});
const shown = (node) => Boolean(node?.isConnected && node.getClientRects().length);

function face({ title, text, gain }, small = 'Carte Zone') {
  return h('div', { className: 'carte-face' },
    h('small', { textContent: small }),
    h('b', { textContent: title }),
    text ? h('p', { textContent: text }) : null,
    gain ? h('div', { className: 'carte-gain', textContent: gain }) : null);
}

// table : #table ; place : la section du lieu ; layer : la couche #ecran ; objective : l'encart
// Objectif ; sequencer : le séquenceur de campagne.js.
export function mountCards({ table, place, layer, objective, sequencer }) {
  const zone = h('div', { id: 'paquet-zone', 'aria-hidden': 'true' });
  table.append(zone);
  const flying = new Set();
  let discard = [];
  let readEvents = null;
  let previous = null;
  let current = null;

  // Une carte volante en position fixe, posée sur r (rectangle d'écran).
  function fly(node, r) {
    Object.assign(node.style, { left: `${r.left}px`, top: `${r.top}px`, width: `${r.width}px`, height: `${r.height}px` });
    document.body.append(node);
    flying.add(node);
    return node;
  }

  function land(node) {
    node.remove();
    flying.delete(node);
  }

  function settle(root) {
    for (const node of flying) land(node);
    for (const animation of root?.getAnimations?.({ subtree: true }) ?? []) animation.finish();
  }

  const move = (from, to) => `translate(${from.left - to.left}px, ${from.top - to.top}px) scale(${from.width / to.width}, ${from.height / to.height})`;

  // Retournement en deux temps : un dos part de from et tourne sur la tranche au-dessus de
  // target, puis target tourne de la tranche à plat.
  async function flipFrom(target, from, { hold = 0, wait } = {}) {
    const to = rect(target);
    const back = fly(h('div', { className: 'carte-volante dos' }), to);
    await finished(back.animate([
      { transform: move(rect(from), to) },
      { transform: 'rotateY(90deg)' },
    ], { duration: FLIP_MS, easing: 'ease-in' }));
    land(back);
    await finished(target.animate([{ transform: 'rotateY(-90deg)' }, { transform: 'none' }], { duration: FLIP_MS, easing: 'ease-out' }));
    if (hold) await wait(hold);
  }

  // A8 zone : paquet -> scène (retournée) -> défausse.
  async function zoneCard({ face: card }, ctx) {
    const deck = zone.querySelector('.paquet');
    const pile = zone.querySelector('.defausse');
    if (!shown(deck)) return;
    const d = rect(deck);
    const scene = { left: d.left - 190, top: d.top - 40, width: 170, height: 120 };
    const node = fly(h('div', { className: 'carte-volante recto' }, face(card)), scene);
    await flipFrom(node, deck, { hold: 450, wait: ctx.wait });
    if (ctx.signal.aborted) return;
    await finished(node.animate([{ transform: 'none' }, { transform: move(rect(pile), scene), opacity: 0.6 }], { duration: 230, easing: 'ease-in', fill: 'forwards' }));
    land(node);
  }

  // A8 lieu : la carte du dessus de la pile sort du paquet du lieu.
  const topCard = () => place.querySelector('.lieu-pile > li.carte');
  const placeDeck = () => place.querySelector('.lieu-paquet .carte');
  async function placeCard() {
    const card = topCard();
    if (shown(card) && shown(placeDeck())) await flipFrom(card, placeDeck());
  }

  // A8 aperçu : la carte vue au boulon, montrée à côté du paquet puis rendue.
  async function peekCard({ face: card }, ctx) {
    const deck = placeDeck();
    if (!shown(deck)) return;
    const d = rect(deck);
    const scene = { left: d.right + 12, top: d.top, width: 170, height: d.height };
    const node = fly(h('div', { className: 'carte-volante recto' }, face(card, 'Aperçu')), scene);
    await flipFrom(node, deck, { hold: 450, wait: ctx.wait });
    if (ctx.signal.aborted) return;
    await finished(node.animate([{ transform: 'none' }, { transform: `${move(d, scene)} rotateY(90deg)` }], { duration: 250, easing: 'ease-in', fill: 'forwards' }));
    land(node);
  }

  // Réveil : face cachée pendant le fondu, puis retournées l'une après l'autre.
  const wakeNodes = () => [...layer.querySelectorAll('.carte-reveil')];
  const deal = () => wakeNodes().forEach((node) => node.classList.add('face-cachee'));
  const reveal = () => wakeNodes().forEach((node) => node.classList.remove('face-cachee'));
  async function wake(_beat, ctx) {
    for (const node of wakeNodes()) {
      node.classList.remove('face-cachee');
      await ctx.wait(ctx.duration / 2);
    }
  }

  // A13 : l'ancienne étape tamponnée, puis la nouvelle qui s'écrit.
  async function mission({ done }, ctx) {
    const card = objective.querySelector('.objectif-encart');
    const changed = previous && (done || previous.step !== current?.step || previous.title !== current?.title);
    if (!card || !changed) return;
    const old = h('div', { className: 'mission-ancienne' },
      h('span', { className: 'objectif-titre', textContent: `Objectif · ${previous.title}` }),
      h('span', { className: 'objectif-etape', textContent: previous.step }),
      h('span', { className: 'tampon', textContent: '✓' }));
    card.append(old);
    flying.add(old);
    await finished(old.querySelector('.tampon').animate([
      { transform: 'scale(2.4) rotate(-20deg)', opacity: 0 },
      { transform: 'scale(1) rotate(-12deg)', opacity: 1 },
    ], { duration: 220, easing: 'cubic-bezier(.3,1.6,.6,1)', fill: 'backwards' }));
    await ctx.wait(200);
    if (ctx.signal.aborted) return;
    await finished(old.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 120, fill: 'forwards' }));
    land(old);
    await finished(card.querySelector('.objectif-etape')?.animate([{ clipPath: 'inset(0 100% 0 0)' }, { clipPath: 'inset(0 0 0 0)' }], { duration: 200, easing: 'steps(12)' }));
  }

  // A12 : pastilles qui s'éteignent ; abattu : la carte se retourne.
  const enemyCard = (index) => document.querySelector(`.fenetre-combat .ennemi[data-index="${index}"]`);
  async function enemy({ index, hp, damage, down }) {
    const card = enemyCard(index);
    if (!card) return;
    if (!down) {
      const pips = [...card.querySelectorAll('.pv rect')].slice(hp, hp + damage);
      await Promise.all(pips.map((pip) => finished(pip.animate([
        { fill: '#ff6a4a', opacity: 1 }, { fill: '#fff7e2', opacity: 1, offset: 0.3 }, { opacity: 0.2 },
      ], { duration: 380, easing: 'ease-out' }))));
      return;
    }
    card.classList.remove('abattu');
    await finished(card.animate([{ transform: 'none' }, { transform: 'rotateY(90deg)' }], { duration: 180, easing: 'ease-in' }));
    card.classList.add('abattu');
    await finished(card.animate([{ transform: 'rotateY(-90deg)' }, { transform: 'none' }], { duration: 180, easing: 'ease-out' }));
  }
  const enemyFinish = ({ index, down }) => {
    const card = enemyCard(index);
    if (down) card?.classList.add('abattu');
    settle(card);
  };

  const PLAY = {
    [BEATS.zone]: { play: zoneCard, reduced: () => fade(zone.querySelector('.defausse')), finish: () => settle(zone) },
    [BEATS.place]: { play: placeCard, reduced: () => fade(topCard()), finish: () => settle(place) },
    [BEATS.peek]: { play: peekCard, reduced: () => fade(placeDeck()), finish: () => settle(place) },
    [BEATS.wakeDeal]: { play: deal, ms: 0, finish: reveal },
    [BEATS.wake]: { play: wake, reduced: () => { reveal(); return fade(layer.querySelector('.cartes-reveil')); }, finish: () => { reveal(); settle(layer); } },
    [BEATS.mission]: { play: mission, reduced: () => fade(objective.querySelector('.objectif-encart')), finish: () => settle(objective) },
    [BEATS.enemy]: { play: enemy, reduced: (beat) => { enemyFinish(beat); return fade(enemyCard(beat.index)); }, finish: enemyFinish },
  };
  for (const [type, { play, reduced, finish, ms }] of Object.entries(PLAY)) {
    const kind = Object.keys(BEATS).find((key) => BEATS[key] === type);
    sequencer.register(type, play, { duration: ms ?? MS[kind], reduced, finish });
  }

  return {
    // Paquet Zone de la tuile courante ; events : ceux du dernier step (même tableau : déjà lus).
    render(campaign, events = []) {
      if (events !== readEvents) {
        discard = nextDiscard(discard, events);
        readEvents = events;
      }
      const deck = campaign.screen === 'tile' ? zoneDeck(campaign) : null;
      zone.hidden = !deck;
      if (!deck) return;
      const top = discard.at(-1);
      zone.replaceChildren(
        h('div', { className: 'defausse', title: `Défausse : ${discard.length} carte(s) tirée(s) aujourd’hui` },
          top ? h('div', { className: 'carte-face' }, h('small', { textContent: 'Défausse' }), h('b', { textContent: ZONE_CARD_NAMES[top] ?? top })) : h('small', { textContent: 'Défausse' })),
        h('div', { className: 'paquet', title: `Paquet Zone : ${deck.left} carte(s), une tirée tous les 3 PA` },
          h('span', { textContent: 'Zone' }), h('small', { textContent: deck.left })));
    },
    // Encart Objectif en carte de mission. focus : objectiveFocus ; onShow : clic sur la carte.
    renderMission(focus, onShow) {
      previous = current;
      current = focus;
      const target = focus.target && h('div', { className: 'objectif-cible', textContent: `Cible : ${focus.target}${focus.here ? '' : ' · autre tuile'}` });
      objective.replaceChildren(h('button', { type: 'button', className: 'objectif-encart carte-mission', title: 'Montrer la cible', onclick: onShow },
        h('span', { className: 'objectif-titre', textContent: `Objectif · ${focus.title}` }),
        h('span', { className: 'objectif-etape', textContent: focus.step }),
        target));
    },
    // Nouvelle partie : plus de défausse ni de carte en vol.
    reset() {
      discard = [];
      previous = null;
      current = null;
      settle(null);
    },
  };
}
