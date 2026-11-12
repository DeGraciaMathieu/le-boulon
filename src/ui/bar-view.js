// Bandeau du haut en pistes (direction plateau, lot L2) : objets de plateau à la place des chiffres.
// Les données viennent de bar.js (pures) ; le style de bar.css. Lecture seule : ne touche jamais
// la campagne.
//
//   piste de PA       une alvéole par PA, un cube en bois par PA restant ; les cubes dépensés
//                     sont dans le bac « dépensés », les cubes retenus par une pénalité restent
//                     barrés au bout de la piste, leur cause écrite dessous et au survol
//   pistes à crans    blessures, radiations, faim ; les seuils marqués d'avance (« −1 PA »)
//   pile de pièces    roubles
// Le chiffre reste écrit à côté de chaque piste ; au survol, la définition de BAR_HINTS (aide.js).
//
// SÉQUENCEUR : les pas du bandeau (BEATS de bar.js, insérés par barBeats dans les événements du
// step) s'enregistrent ici. L'état final est déjà dessiné : chaque animation part de l'ancienne
// position et revient à la place dessinée.
//   A1 spend    les cubes dépensés glissent de leur alvéole vers « dépensés » (350 ms)
//   A1 penalty  le cube retenu en cours de journée tremble et s'étiquette (350 ms)
//   A2 wake     les cubes reviennent un à un ; les cubes retenus restent dehors, étiquette en
//               évidence (800 ms)
//   A9 notch    les crans gagnés s'allument en rouge, la piste tremble, un seuil franchi clignote
//               (400 ms)
// Mode réduit : fondu de la piste concernée. Accélérer : les animations en cours vont à leur fin.

import { apTrack, notchTracks, coinStack, BEATS } from './bar.js';
import { BAR_HINTS } from './aide.js';
import { topBar } from './world-map.js';
import { fade } from './sequencer.js';

const TRAY_SHOWN = 12;
const CELL_CLASS = { cube: 'pleine', vide: 'vide', retenu: 'retenu' };
const MS = { spend: 350, penalty: 350, wake: 800, notch: 400 };
const TRACKS = [
  ['blessures', 'Blessures'],
  ['radiations', 'Radiations'],
  ['faim', 'Faim'],
];

function h(tag, attrs = {}, ...children) {
  const node = Object.assign(document.createElement(tag), attrs);
  node.append(...children.filter((child) => child !== null && child !== undefined));
  return node;
}

// Relance une animation CSS déjà jouée sur le même élément.
function replay(node, cls) {
  if (!node) return;
  node.classList.remove(cls);
  void node.getBoundingClientRect();
  node.classList.add(cls);
}

// Décalage qui ramène visuellement node à la place de from.
function offset(node, from) {
  const a = node.getBoundingClientRect();
  const b = from.getBoundingClientRect();
  return { x: b.left + b.width / 2 - (a.left + a.width / 2), y: b.top + b.height / 2 - (a.top + a.height / 2) };
}

function cube(cls = '') {
  return h('i', { className: `cube ${cls}`.trim() });
}

function apTrackNode(track) {
  const cells = track.slots.map((slot) => {
    const held = slot.kind === 'retenu';
    const cell = h('span', { className: `alveole ${CELL_CLASS[slot.kind]}`, title: slot.title ?? '' },
      slot.kind === 'vide' ? null : cube(held ? 'retenu' : ''),
      h('b', { textContent: held ? slot.tag : slot.n }));
    if (held) cell.dataset.cause = slot.cause;
    return cell;
  });
  const spent = Math.min(track.spent, TRAY_SHOWN);
  const lost = Math.min(track.lost, Math.max(0, TRAY_SHOWN - spent));
  const tray = h('span', { className: 'depenses', title: `${track.spent} PA dépensés aujourd'hui${track.lost ? ` · ${track.lost} perdus` : ''}` },
    h('span', { className: 'bac' }, ...Array.from({ length: spent }, () => cube('mini')), ...Array.from({ length: lost }, () => cube('mini perdu'))),
    h('small', { textContent: 'dépensés' }));
  return h('div', { className: 'piste piste-pa', title: BAR_HINTS.pa },
    h('span', { className: 'piste-titre', textContent: 'PA' }),
    h('span', { className: 'alveoles' }, ...cells),
    tray,
    h('span', { className: 'piste-chiffre' }, h('strong', { textContent: track.left }), ` / ${track.max}`));
}

function notchTrackNode(id, label, track) {
  const notches = track.notches.map((notch) => h('span', { className: `cran${notch.lit ? ' allume' : ''}${notch.mark ? ' seuil' : ''}`, title: notch.mark?.title ?? '' },
    h('i'),
    notch.mark ? h('small', { textContent: notch.mark.tag }) : null));
  return h('div', { className: `piste piste-crans piste-${id}`, title: BAR_HINTS[id] },
    h('b', { className: 'piste-titre', textContent: label }),
    h('span', { className: 'crans' }, ...notches),
    h('strong', { className: 'piste-chiffre', textContent: track.value }));
}

function coinsNode(roubles) {
  const coins = Array.from({ length: coinStack(roubles) }, () => h('i', { className: 'piece' }));
  return h('div', { className: 'piste piste-roubles', title: BAR_HINTS.roubles },
    h('b', { className: 'piste-titre', textContent: 'Roubles' }),
    h('span', { className: 'pile' }, ...coins),
    h('strong', { className: 'piste-chiffre', textContent: roubles }));
}

// bar : l'élément #bandeau ; sequencer : le séquenceur de campagne.js.
export function mountBar(bar, sequencer) {
  const find = (selector) => bar.querySelector(selector);
  const all = (selector) => [...bar.querySelectorAll(selector)];
  const settle = () => {
    for (const animation of bar.getAnimations?.({ subtree: true }) ?? []) animation.finish();
  };
  const finished = (animations) => Promise.all(animations.map((animation) => animation?.finished.catch(() => {})));

  // A1 : chaque cube parti du bout des cubes restants glisse jusqu'au bac.
  function spend({ count }) {
    const empties = all('.alveole.vide').slice(0, count);
    const moved = all('.depenses .cube:not(.perdu)').slice(-count);
    return finished(moved.map((node, i) => {
      const from = empties[empties.length - 1 - i] ?? empties[0];
      if (!from) return null;
      const { x, y } = offset(node, from);
      return node.animate([
        { transform: `translate(${x}px, ${y}px)` },
        { transform: `translate(${x / 2}px, ${y - 14}px) rotate(45deg)`, offset: 0.45 },
        { transform: 'none' },
      ], { duration: MS.spend, easing: 'cubic-bezier(.5,0,.2,1)' });
    }));
  }

  // A1 : le cube retenu par une pénalité en cours de journée.
  function penalty({ cause }) {
    for (const cell of all(`.alveole.retenu[data-cause="${cause}"]`)) replay(cell, 'retient');
  }

  // A2 : les cubes reviennent du bac un à un, les retenus restent dehors, étiquetés.
  function wake() {
    const tray = find('.depenses');
    const cubes = all('.alveole.pleine .cube');
    for (const cell of all('.alveole.retenu')) replay(cell, 'etiquette');
    const step = cubes.length ? (MS.wake - 300) / cubes.length : 0;
    return finished(cubes.map((node, i) => {
      const { x, y } = offset(node, tray);
      return node.animate([
        { transform: `translate(${x}px, ${y}px)`, opacity: 0 },
        { transform: `translate(${x}px, ${y}px)`, opacity: 1, offset: 0.1 },
        { transform: 'none', opacity: 1 },
      ], { duration: 300, delay: i * step, easing: 'ease-out', fill: 'backwards' });
    }));
  }

  // A9 : crans gagnés en rouge, piste qui tremble, seuil franchi qui clignote.
  function notch({ track, from, to, crossed }) {
    const node = find(`.piste-${track}`);
    if (!node) return;
    replay(node, 'tremble');
    const notches = [...node.querySelectorAll('.cran')];
    for (const cran of notches.slice(from, to)) replay(cran, 'touche');
    for (const n of crossed) replay(notches[n - 1], 'franchi');
  }

  const PLAY = {
    [BEATS.spend]: { play: spend, reduced: () => fade(find('.piste-pa')), ms: MS.spend },
    [BEATS.penalty]: { play: penalty, reduced: () => fade(find('.piste-pa')), ms: MS.penalty },
    [BEATS.wake]: { play: wake, reduced: () => fade(find('.piste-pa')), ms: MS.wake },
    [BEATS.notch]: { play: notch, reduced: (beat) => fade(find(`.piste-${beat.track}`)), ms: MS.notch },
  };
  for (const [type, { play, reduced, ms }] of Object.entries(PLAY)) {
    sequencer.register(type, play, { duration: ms, reduced, finish: settle });
  }

  return {
    render(campaign) {
      const data = topBar(campaign);
      const tracks = notchTracks(campaign);
      const item = (hint, label, value) => h('div', { className: 'bandeau-item', title: BAR_HINTS[hint] },
        h('span', { className: 'bandeau-valeur', textContent: value }),
        h('span', { className: 'bandeau-label', textContent: label }));
      bar.replaceChildren(
        item('jour', 'Jour', data.day),
        item('tuile', data.tile, ''),
        apTrackNode(apTrack(campaign)),
        h('div', { className: 'pistes-etat' },
          ...TRACKS.map(([id, label]) => notchTrackNode(id, label, tracks[id])),
          coinsNode(data.roubles)),
      );
      if (data.emission) bar.append(h('div', { className: 'bandeau-emission', textContent: "ÉMISSION AUJOURD'HUI : restez près d'un abri" }));
    },
  };
}
