// Plateau vivant (direction plateau, lot L6) : les pas du plateau (MOTIONS de plateau.js, insérés
// par boardBeats dans les événements du step) s'enregistrent ici dans le séquenceur. L'état final
// est déjà dessiné par board.js : chaque animation part de l'ancienne position et revient à la
// place dessinée. Lecture seule : ne touche jamais la campagne. Le style est dans board.css.
//
//   A3  pawn      le pion saute d'hexagone en hexagone, léger rebond à l'arrivée ; arrivé d'une
//                 autre tuile, il tombe sur l'hexagone d'entrée (MS.pawn)
//   A5  flip      le jeton se retourne : le dos (« ? », « ! ») bascule, la face arrive (MS.flip)
//   A6  drop      les jetons tombent sur leur hexagone, ombre qui se resserre, petit rebond
//   A10 wave      onde colorée par type d'anomalie, en pointillés et « évitée » si évitée
//   A15 emission  piste du compte à rebours (cases = PA restants) ; à son début elle s'annonce,
//                 à chaque PA une case s'éteint ; les abris pulsent fort
//   A16 dusk      la lumière de la lampe baisse sur la table ; elle reste basse la nuit
//
// MISE EN PLACE (stage, avant que la file ne joue) : l'état final est dessiné avant les pas qui
// précèdent (cubes de PA, etc.) ; stage remet pion et jetons dans leur état de départ (pion sur
// l'hexagone quitté, jeton face cachée, jeton pas encore posé) jusqu'à leur propre pas.
//
// AMBIANCE (ambience, à chaque rendu) : la piste d'Émission suit la campagne et se cale en haut
// du plateau ; la lampe est basse pendant la nuit.
// Mode réduit : fondu du nœud concerné. Accélérer : animations finies, traces retirées.

import { MOTIONS, emissionTrack } from './plateau.js';
import { emissionAmbience } from './effets.js';
import { hexCenter } from './geometry.js';
import { el } from './board.js';
import { fade } from './sequencer.js';

const MS = { pawn: 300, fall: 450, flip: 400, drop: 350, stagger: 70, wave: 800, emission: 1200, tick: 500, dusk: 1000 };
const LIFT = 'translate(-12px, -70px) scale(1.4)';
const SHADOW_HIGH = 'drop-shadow(14px 28px 8px rgb(0 0 0 / 0.25))';
const SHADOW_LOW = 'drop-shadow(2px 4px 2px rgb(0 0 0 / 0.6))';

function h(tag, className, text) {
  return Object.assign(document.createElement(tag), { className, textContent: text ?? '' });
}

// Relance une animation CSS déjà jouée sur le même élément.
function replay(node, cls) {
  if (!node) return;
  node.classList.remove(cls);
  void node.getBoundingClientRect();
  node.classList.add(cls);
}

const finished = (animations) => Promise.all(animations.map((animation) => animation?.finished.catch(() => {})));

// plateau : le SVG de la tuile ; board() : le plateau monté (campagne.js le remonte à chaque tuile).
export function mountBoardMotion({ plateau, sequencer, board }) {
  const track = h('div', 'piste-emission');
  track.hidden = true;
  const lamp = h('div', 'lampe');
  document.body.append(lamp, track);
  // Traces passagères (dos de jeton, ondes) : retirées à la fin du pas ou à l'accélération.
  const traces = new Set();
  // Nœuds tenus dans leur état de départ par stage (style en ligne), et dos des jetons à retourner.
  const held = new Set();
  const backs = new Map();

  const trace = (node) => {
    traces.add(node);
    return node;
  };
  const clear = () => {
    for (const node of traces) node.remove();
    traces.clear();
    backs.clear();
  };
  const hold = (node, style) => {
    Object.assign(node.style, style);
    held.add(node);
  };
  const release = (nodes) => {
    for (const node of nodes) {
      node.style.transform = '';
      node.style.opacity = '';
      held.delete(node);
    }
  };
  const settle = () => {
    for (const node of [plateau, track, lamp]) {
      for (const animation of node.getAnimations?.({ subtree: true }) ?? []) animation.finish();
    }
    release([...held]);
    clear();
  };
  const tokenNodes = (token, hexes) => [...board().tokens.querySelectorAll(`.jeton.${token}`)]
    .filter((node) => !hexes || hexes.includes(Number(node.dataset.hex)));
  const backKey = ({ token, hex }) => `${token}:${hex}`;

  // Dos du jeton : copie de la face, marquée « ? » ou « ! », posée par-dessus dans la couche fx.
  function makeBack(face, token) {
    const back = trace(face.cloneNode(true));
    back.setAttribute('class', `jeton ${token} dos${token === 'suspect' ? ' cache' : ''}`);
    for (const text of [...back.querySelectorAll('text')].slice(1)) text.remove();
    back.querySelector('text').textContent = token === 'suspect' ? '?' : '!';
    board().fx.append(back);
    return back;
  }

  const STAGE = {
    [MOTIONS.pawn]: ({ from, to }) => {
      const { pawn: node, calage } = board();
      if (from === null) return hold(node, { opacity: '0' });
      const start = hexCenter(from, calage);
      const end = hexCenter(to, calage);
      hold(node, { transform: `translate(${start.x - end.x}px, ${start.y - end.y}px)` });
    },
    [MOTIONS.flip]: (beat) => {
      const [face] = tokenNodes(beat.token, [beat.hex]);
      if (!face) return;
      hold(face, { opacity: '0' });
      backs.set(backKey(beat), makeBack(face, beat.token));
    },
    [MOTIONS.drop]: ({ token, hexes }) => {
      for (const node of tokenNodes(token, hexes)) hold(node, { opacity: '0' });
    },
  };

  // A3 : saut en arc d'un centre à l'autre ; sans départ, chute sur l'hexagone d'arrivée.
  function pawn({ from, to }) {
    const { pawn: node, calage } = board();
    release([node]);
    if (from === null) {
      return node.animate([
        { transform: LIFT, opacity: 0 },
        { opacity: 1, offset: 0.3 },
        { transform: 'none', offset: 0.7 },
        { transform: 'translate(0, -6px)', offset: 0.85 },
        { transform: 'none' },
      ], { duration: MS.fall, easing: 'ease-in' }).finished;
    }
    const start = hexCenter(from, calage);
    const end = hexCenter(to, calage);
    const dx = start.x - end.x;
    const dy = start.y - end.y;
    return node.animate([
      { transform: `translate(${dx}px, ${dy}px)` },
      { transform: `translate(${dx / 2}px, ${dy / 2 - calage.taille * 0.35}px) scale(1.12)`, offset: 0.45 },
      { transform: 'none', offset: 0.78 },
      { transform: 'translate(0, -5px)', offset: 0.89 },
      { transform: 'none' },
    ], { duration: MS.pawn, easing: 'ease-in-out' }).finished;
  }

  // A5 : un dos (copie du jeton, face cachée) bascule jusqu'à la tranche, puis la face arrive.
  function flip(beat) {
    const [face] = tokenNodes(beat.token, [beat.hex]);
    if (!face) return;
    const back = backs.get(backKey(beat)) ?? makeBack(face, beat.token);
    release([face]);
    const half = MS.flip / 2;
    const edge = 'translateY(-10px) perspective(300px) rotateY(90deg) scale(1.1)';
    return finished([
      back.animate([{ transform: 'none' }, { transform: edge }], { duration: half, easing: 'ease-in', fill: 'forwards' }),
      face.animate([{ transform: edge.replace('90deg', '-90deg') }, { transform: 'none' }],
        { duration: half, delay: half, easing: 'ease-out', fill: 'backwards' }),
    ]).then(() => back.remove());
  }

  // A6 : chute depuis la lampe, l'ombre se resserre en touchant le carton, petit rebond.
  function drop({ token, hexes }) {
    const nodes = tokenNodes(token, hexes);
    release(nodes);
    return finished(nodes.map((node, i) => node.animate([
      { transform: LIFT, opacity: 0, filter: SHADOW_HIGH },
      { opacity: 1, offset: 0.25 },
      { transform: 'none', filter: SHADOW_LOW, offset: 0.7 },
      { transform: 'translate(0, -5px)', offset: 0.85 },
      { transform: 'none', filter: SHADOW_LOW },
    ], { duration: MS.drop, delay: i * MS.stagger, easing: 'ease-in', fill: 'backwards' })));
  }

  // A10 : deux anneaux qui s'élargissent, teinte du type (fx-anomalie de board.css).
  async function wave({ hex, tone, avoided }, ctx) {
    const { calage, fx } = board();
    const { x, y } = hexCenter(hex, calage);
    const cls = `fx-anomalie ${tone}${avoided ? ' evitee' : ''}`;
    const nodes = ['', ' echo'].map((echo) => trace(el('circle', { class: cls + echo, cx: x, cy: y, r: calage.taille * 0.8 }, fx)));
    if (avoided) {
      const word = trace(el('text', { class: 'fx-evitee', x, y: y + calage.taille * 0.05, 'text-anchor': 'middle', 'dominant-baseline': 'central' }, fx));
      word.textContent = 'évitée';
      nodes.push(word);
    }
    await ctx.wait(ctx.duration);
    for (const node of nodes) node.remove();
  }

  // A15 : la piste s'annonce, ou la case du PA dépensé s'éteint ; les abris pulsent fort.
  function emission({ left, start }) {
    for (const polygon of board().grid.querySelectorAll('.hex.abri')) replay(polygon, 'appel');
    if (start) return replay(track, 'annonce');
    replay(track.querySelectorAll('.case-emission')[left], 'eteinte');
  }

  // A16 : la lampe baisse ; elle reste basse (classe basse) jusqu'au réveil.
  function dusk() {
    lamp.classList.add('basse');
    return lamp.animate([
      { opacity: 0 },
      { opacity: 0.7, offset: 0.35 },
      { opacity: 0.5, offset: 0.45 },
      { opacity: 1 },
    ], { duration: MS.dusk, easing: 'ease-in' }).finished;
  }

  // Mode réduit : le nœud tenu par stage apparaît en fondu à son pas.
  function appear(nodes) {
    release(nodes);
    return Promise.all(nodes.map((node) => fade(node)));
  }

  const PLAY = {
    [MOTIONS.pawn]: { play: pawn, reduced: () => appear([board().pawn]), ms: (beat) => (beat.from === null ? MS.fall : MS.pawn) },
    [MOTIONS.flip]: {
      play: flip,
      reduced: (beat) => {
        backs.get(backKey(beat))?.remove();
        return appear(tokenNodes(beat.token, [beat.hex]));
      },
      ms: MS.flip,
    },
    [MOTIONS.drop]: { play: drop, reduced: (beat) => appear(tokenNodes(beat.token, beat.hexes)), ms: MS.drop },
    [MOTIONS.wave]: { play: wave, reduced: wave, ms: MS.wave },
    [MOTIONS.emission]: { play: emission, reduced: () => fade(track), ms: (beat) => (beat.start ? MS.emission : MS.tick) },
    [MOTIONS.dusk]: {
      play: dusk,
      reduced: () => {
        lamp.classList.add('basse');
        return fade(lamp);
      },
      ms: MS.dusk,
    },
  };
  for (const [type, { play, reduced, ms }] of Object.entries(PLAY)) {
    sequencer.register(type, play, {
      duration: ms,
      reduced,
      finish: (beat) => {
        settle();
        if (beat.type === MOTIONS.dusk) lamp.classList.add('basse');
      },
    });
  }

  function placeTrack() {
    const box = plateau.getBoundingClientRect();
    track.style.left = `${box.left + box.width / 2}px`;
    track.style.top = `${box.top + 10}px`;
  }
  window.addEventListener('resize', placeTrack);

  return {
    // Met pion et jetons dans leur état de départ ; à appeler juste avant sequencer.play(beats).
    stage(beats) {
      for (const beat of beats) STAGE[beat.type]?.(beat);
    },
    // events : ceux du step qui vient d'être rendu ; un day-ended laisse la lampe au pas dusk.
    ambience(campaign, events = []) {
      const night = campaign.screen === 'night';
      if (!night) lamp.classList.remove('basse');
      else if (!events.some((event) => event.type === 'day-ended')) lamp.classList.add('basse');

      const emission = emissionAmbience(campaign);
      track.hidden = !emission || plateau.hidden;
      if (track.hidden) return;
      const { cells, left } = emissionTrack(emission.left);
      const boxes = h('span', 'cases-emission');
      boxes.append(...cells.map((cell) => h('i', `case-emission${cell.lit ? ' allumee' : ''}`)));
      track.replaceChildren(h('b', 'piste-titre', 'Émission'), boxes, h('small', '', `${left} PA pour un abri`));
      placeTrack();
    },
  };
}
