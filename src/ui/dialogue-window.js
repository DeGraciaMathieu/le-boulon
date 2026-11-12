// Fenêtre Dialogue (brief v2 §16 ; carte 27) : portrait (pictogramme de faction), texte, choix
// numérotés, choix grisés avec leur condition. Lit dialogueWindow (dialogue-screen.js) et
// envoie { type: 'choose', index } par onChoose ; touches 1 à 9 pour choisir.
//
//   mountDialogue({ onChoose }) -> { render(campaign) }   la fenêtre s'ajoute à document.body

import { el } from './board.js';
import { dialogueWindow } from './dialogue-screen.js';

// Hypothèse v2 : le brief ne dessine pas les pictogrammes ; une initiale sur un hexagone de
// la couleur de la faction (classe faction-<id> de fenetres.css).
const HEX_POINTS = '40,4 71,22 71,58 40,76 9,58 9,22';

function h(tag, attrs = {}, ...children) {
  const node = Object.assign(document.createElement(tag), attrs);
  node.append(...children.filter((child) => child !== null && child !== undefined));
  return node;
}

function portrait(view) {
  const svg = el('svg', { class: `portrait faction-${view.faction ?? 'aucune'}`, viewBox: '0 0 80 80', 'aria-hidden': 'true' });
  el('polygon', { points: HEX_POINTS }, svg);
  const letter = el('text', { x: 40, y: 42, 'text-anchor': 'middle', 'dominant-baseline': 'central' }, svg);
  letter.textContent = (view.factionName ?? view.name).charAt(0);
  return svg;
}

function choiceItem(choice, onChoose) {
  const button = h('button', {
    type: 'button',
    className: 'choix',
    disabled: !choice.available,
    onclick: () => onChoose({ type: 'choose', index: choice.index }),
  }, h('span', { className: 'choix-numero', textContent: `${choice.number}.` }), ` ${choice.text}`);
  const requirement = choice.requirement && h('span', { className: 'choix-condition', textContent: choice.requirement });
  return h('li', {}, button, requirement);
}

export function mountDialogue({ onChoose }) {
  const root = h('div', { className: 'fenetre fenetre-dialogue', hidden: true });
  root.setAttribute('role', 'dialog');
  root.setAttribute('aria-modal', 'true');
  document.body.append(root);
  let view = null;

  document.addEventListener('keydown', (event) => {
    const choice = view?.choices[Number(event.key) - 1];
    if (choice?.available) onChoose({ type: 'choose', index: choice.index });
  });

  return {
    render(campaign) {
      view = dialogueWindow(campaign);
      root.hidden = !view;
      if (!view) return;
      root.replaceChildren(h('div', { className: 'cadre-fenetre' },
        h('header', { className: 'dialogue-tete' }, portrait(view),
          h('div', {}, h('h2', { textContent: view.name }), h('div', { className: 'faction', textContent: view.factionName ?? 'Sans faction' }))),
        h('p', { className: 'dialogue-texte', textContent: view.text }),
        h('ol', { className: 'choix-liste' }, ...view.choices.map((choice) => choiceItem(choice, onChoose)))));
    },
  };
}
