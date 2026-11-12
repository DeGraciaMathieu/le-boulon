// Jeu des retours visuels de la campagne (brief v2 §16 ; carte 32), sur le modèle de fx.js de la
// v1 : après chaque rendu, les effets lus par effets.js sont joués sur la page. Lecture seule :
// ce module ne touche jamais la campagne. Les animations vivent dans effets.css.
//
// SÉQUENCEUR (sequencer.js, lot L1) : chaque type d'événement qui donne un effet est enregistré
// dans le séquenceur ; un pas dure le temps de l'animation CSS (BEAT_MS, 0 pour le compteur qui
// bat à chaque PA). Accélérer finit l'animation CSS en cours ; les annonces et le tampon de rang,
// qui portent une information, restent affichés jusqu'à leur fin. Mode réduit : fondu du plateau,
// ou du réveil ; annonces et rang s'affichent (effets.css coupe leur mouvement).
//
//   transition  la tuile apparaît en fondu, son nom passe au centre du plateau
//   wake        l'écran du réveil sort du noir
//   announce    bande d'annonce de l'Émission en travers de l'écran
//   countdown   le compteur d'Émission bat à chaque PA dépensé
//   rank        tampon du nouveau rang
//
// AMBIANCE (ambience, à chaque rendu) : tant que l'Émission est en cours, <body> porte la classe
// en-emission (teinte de board.css) et un compteur des PA restants reste affiché.
//
// Tout ce qui est posé ici a pointer-events: none : aucun effet ne bloque l'entrée du joueur.
// Les traces disparaissent après TRACE_MS, les annonces après ANNOUNCE_MS.

import { EFFECT_TYPES, eventEffect, emissionAmbience } from './effets.js';
import { fade } from './sequencer.js';

const TRACE_MS = 1000;
const ANNOUNCE_MS = 2600;
const BEAT_MS = { transition: 700, wake: 900, announce: 700, countdown: 0, rank: 400 };

function h(tag, className, text) {
  return Object.assign(document.createElement(tag), { className, textContent: text });
}

// Relance une animation CSS déjà jouée sur le même élément.
function replay(node, cls) {
  if (!node) return;
  node.classList.remove(cls);
  void node.getBoundingClientRect();
  node.classList.add(cls);
}

// Amène à leur fin les animations CSS en cours sur le nœud et ses descendants.
function settle(node) {
  for (const animation of node?.getAnimations?.({ subtree: true }) ?? []) animation.finish();
}

// plateau : le SVG de la tuile ; layer : la couche #ecran ;
// sequencer : le séquenceur de campagne.js, où les effets s'enregistrent.
export function mountEffects({ plateau, layer, sequencer }) {
  const overlay = h('div', 'effets');
  const counter = h('div', 'fx-compteur');
  counter.hidden = true;
  overlay.append(counter);
  document.body.append(overlay);
  let announce = null;

  function flash(node, ms) {
    overlay.append(node);
    setTimeout(() => node.remove(), ms);
    return node;
  }

  function showAnnounce({ tone, title, text }) {
    announce?.remove();
    announce = flash(h('div', `fx-annonce ${tone}`), ANNOUNCE_MS);
    announce.append(h('strong', '', title), h('span', '', text));
  }

  const showTile = ({ tile, firstVisit }) => flash(h('div', 'fx-tuile', firstVisit ? `${tile} · première visite` : tile), TRACE_MS);
  const showRank = ({ name }) => {
    const stamp = flash(h('div', 'fx-rang'), 1600);
    stamp.append(h('small', '', 'Nouveau rang'), h('strong', '', name));
  };

  // Par effet : play (animation normale), reduced (mode réduit), finish (accélération).
  const PLAY = {
    transition: {
      play: (effect) => {
        replay(plateau, 'fx-transition');
        showTile(effect);
      },
      reduced: (effect) => {
        showTile(effect);
        return fade(plateau);
      },
      finish: () => settle(plateau),
    },
    wake: {
      play: () => replay(layer, 'fx-reveil'),
      reduced: () => fade(layer),
      finish: () => settle(layer),
    },
    announce: { play: showAnnounce, reduced: showAnnounce },
    countdown: { play: () => replay(counter, 'tic') },
    rank: { play: showRank, reduced: showRank },
  };

  const handler = (name) => (event) => {
    const effect = eventEffect(event);
    return effect && PLAY[effect.kind][name]?.(effect);
  };
  for (const type of EFFECT_TYPES) {
    sequencer.register(type, handler('play'), {
      duration: (event) => BEAT_MS[eventEffect(event)?.kind] ?? 0,
      reduced: handler('reduced'),
      finish: handler('finish'),
    });
  }

  return {
    ambience(campaign) {
      const emission = emissionAmbience(campaign);
      document.body.classList.toggle('en-emission', Boolean(emission));
      counter.hidden = !emission;
      if (emission) counter.textContent = `Émission · ${emission.left} PA`;
    },
    // Nouvelle partie : efface les annonces restées de la précédente.
    reset() {
      overlay.replaceChildren(counter);
      announce = null;
    },
  };
}
