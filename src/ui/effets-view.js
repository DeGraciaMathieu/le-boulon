// Jeu des retours visuels de la campagne (brief v2 §16 ; carte 32), sur le modèle de fx.js de la
// v1 : après chaque rendu, les effets lus par effets.js sont joués sur la page. Lecture seule :
// ce module ne touche jamais la campagne. Les animations vivent dans effets.css.
//
//   transition  la tuile apparaît en fondu, son nom passe au centre du plateau
//   card        la carte du dessus de la pile du lieu se retourne
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

import { campaignEffects, emissionAmbience } from './effets.js';

const TRACE_MS = 1000;
const ANNOUNCE_MS = 2600;

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

// plateau : le SVG de la tuile ; place : la section du lieu ; layer : la couche #ecran.
export function mountEffects({ plateau, place, layer }) {
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

  const PLAY = {
    transition: ({ tile, firstVisit }) => {
      replay(plateau, 'fx-transition');
      flash(h('div', 'fx-tuile', firstVisit ? `${tile} · première visite` : tile), TRACE_MS);
    },
    card: () => replay(place.querySelector('.lieu-pile > li.carte'), 'fx-revele'),
    wake: () => replay(layer, 'fx-reveil'),
    announce: showAnnounce,
    countdown: () => replay(counter, 'tic'),
    rank: ({ name }) => {
      const stamp = flash(h('div', 'fx-rang'), 1600);
      stamp.append(h('small', '', 'Nouveau rang'), h('strong', '', name));
    },
  };

  return {
    play(events) {
      for (const effect of campaignEffects(events)) PLAY[effect.kind](effect);
    },
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
