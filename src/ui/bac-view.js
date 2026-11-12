// Bac à dés (direction plateau, lot L3 ; proposition §4 A7, §5 outil 2) : tapis de feutre olive où
// se jouent tous les jets (tests de compétence, tirs, attaques ennemies). Un dé ivoire en 3D CSS
// roule, s'arrête sur la valeur tirée, puis s'écrit la phrase du jet (bac.js), verdict coloré.
// Vide, le bac reste sobre : « Dernier jet ». Avant un tir, la fenêtre de combat y inscrit le
// seuil à atteindre (prepare).
//
//   const tray = mountDiceTray(home, sequencer)   home : l'emplacement du bac dans le panneau
//   tray.dock(host)      déplace le bac dans host (fenêtre de combat) ; sans host, le ramène chez lui
//   tray.prepare(text)   ligne du seuil avant un tir ; null l'efface
//   tray.reset()         nouvelle partie : bac vide, ramené chez lui
//
// SÉQUENCEUR : chaque type de DICE_TYPES est enregistré ; le dé roule ROLL_MS, puis la phrase
// s'écrit en WRITE_MS. Accélérer pose la face finale et la phrase. Mode réduit : la face finale
// s'affiche directement et la phrase apparaît en fondu.

import { DICE_TYPES, faceTurn, rollParts, rollView } from './bac.js';
import { fade } from './sequencer.js';

export const ROLL_MS = 900;
export const WRITE_MS = 300;

// Faces : valeur, placement sur le cube, points dans une grille 3 × 3 (cases 1 à 9).
const FACES = [
  [1, 'avant', [5]], [6, 'arriere', [1, 3, 4, 6, 7, 9]], [3, 'droite', [1, 5, 9]],
  [4, 'gauche', [1, 3, 7, 9]], [2, 'haut', [1, 9]], [5, 'bas', [1, 3, 5, 7, 9]],
];

function h(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

const pose = ({ x, y }, dx = 0, dy = 0, z = 0) => `translateX(${dx}px) translateY(${dy}px) rotateX(${x}deg) rotateY(${y}deg) rotateZ(${z}deg)`;

function buildDie() {
  const cube = h('div', 'bac-cube');
  for (const [value, side, pips] of FACES) {
    const face = h('div', `bac-face ${side}`);
    face.dataset.valeur = value;
    for (const cell of pips) face.append(Object.assign(h('i'), { style: `grid-area: p${cell}` }));
    cube.append(face);
  }
  return cube;
}

export function mountDiceTray(home, sequencer) {
  const node = h('section', 'bac');
  node.setAttribute('aria-live', 'polite');
  const title = h('h2', 'bac-titre');
  const scene = h('div', 'bac-scene');
  const cube = buildDie();
  scene.append(cube);
  const sentence = h('p', 'bac-phrase');
  const hint = h('p', 'bac-avant');
  const body = h('div', 'bac-corps');
  body.append(scene, sentence);
  node.append(title, body, hint);
  home.append(node);

  function empty() {
    title.textContent = 'Dernier jet';
    node.classList.add('vide');
    sentence.replaceChildren(h('span', 'bac-rien', 'aucun jet pour l’instant'));
    cube.style.transform = pose(faceTurn(1));
  }

  function stop() {
    for (const animation of cube.getAnimations?.() ?? []) animation.cancel();
  }

  function begin(view) {
    stop();
    node.classList.remove('vide');
    title.textContent = `Dernier jet · ${view.title}`;
    sentence.replaceChildren();
    cube.setAttribute('aria-label', `dé : ${view.roll}`);
    cube.style.transform = pose(faceTurn(view.roll));
  }

  function write(view) {
    sentence.replaceChildren(...rollParts(view).map(({ text, part }) => {
      const span = h('span', `bac-${part}`, text);
      if (part === 'verdict') span.classList.add(view.tone);
      return span;
    }));
  }

  function settle(view) {
    begin(view);
    write(view);
  }

  async function play(event, ctx) {
    const view = rollView(event);
    begin(view);
    const turn = faceTurn(view.roll);
    const tumble = { x: turn.x - 720, y: turn.y + 540 };
    cube.animate([
      { transform: pose(tumble, -80, -16, 90) },
      { transform: pose({ x: turn.x - 25, y: turn.y + 15 }, 6, 0, 4), offset: 0.75 },
      { transform: pose(turn) },
    ], { duration: ROLL_MS, easing: 'cubic-bezier(.2,.7,.3,1)' });
    await ctx.wait(ROLL_MS);
    write(view);
    await fade(sentence, WRITE_MS);
  }

  for (const type of DICE_TYPES) {
    sequencer.register(type, play, {
      duration: ROLL_MS + WRITE_MS,
      finish: (event) => {
        stop();
        settle(rollView(event));
      },
      reduced: (event) => {
        settle(rollView(event));
        return fade(sentence);
      },
    });
  }
  empty();
  hint.hidden = true;

  return {
    dock(host = home) {
      if (node.parentNode !== host) host.append(node);
    },
    prepare(text) {
      hint.textContent = text ?? '';
      hint.hidden = !text;
    },
    reset() {
      stop();
      this.dock();
      this.prepare(null);
      empty();
    },
  };
}
